# CampusHub Backend

CS 5500 CampusHub backend using TypeScript, Express, and Mongoose.
Lab 2 implements an OpenAPI contract and a local in-memory reservation engine.

## Setup

- Node.js `>=24.21.0`, npm `>=11.19.1`.
- Run `npm ci` in this directory.
- Optionally copy `.env-example` to `.env` if `.env` does not already exist.
- Run `npm run dev`, or `npm run build` followed by `npm start`.

The server binds to `127.0.0.1`; `PORT` defaults to `3000` and must be an integer from 1 to 65535.
A database is **not required**. Stop the development watcher with Ctrl+C.

## Contract and Endpoints

[docs/openapi.json](docs/openapi.json) is the authoritative OpenAPI 3.0.3 contract.
At the user's instruction, Lab 2 takes precedence over Lab 1's response envelopes:
successes return objects or arrays directly, and all errors return `{ "code": "...", "message": "..." }`.
The existing health endpoint follows the same direct-object convention.

| Method | Path                                 | Success                        | Relevant errors                          |
| ------ | ------------------------------------ | ------------------------------ | ---------------------------------------- |
| GET    | `/api/v1/health`                     | `200` status and timestamp     | `500`                                    |
| GET    | `/api/v1/resources`                  | `200` resource array           | `400`, `500`                             |
| POST   | `/api/v1/reservations`               | `201` reservation              | `400`, `404`, `409`, `413`, `415`, `500` |
| GET    | `/api/v1/reservations/user/{userId}` | `200` active reservation array | `400`, `500`                             |

Unknown routes return `404 NOT_FOUND`. Application errors never expose internal stacks to clients.

### Resources

```sh
curl -i 'http://127.0.0.1:3000/api/v1/resources'
curl -i 'http://127.0.0.1:3000/api/v1/resources?type=ROOM'
curl -i 'http://127.0.0.1:3000/api/v1/resources?type=STUDY_ROOM'
curl -i 'http://127.0.0.1:3000/api/v1/resources?type='
```

Domain types are `ROOM`, `EQUIPMENT`, and `LAB`.
`STUDY_ROOM` is a query-only alias for `ROOM`, supporting the assignment's example while preserving its domain enum.
Empty, repeated, unsupported, or unknown query parameters return `400 VALIDATION_ERROR`.

| ID        | Resource         | Type      | Operationally available |
| --------- | ---------------- | --------- | ----------------------- |
| `res-101` | Study Room 302   | ROOM      | Yes                     |
| `res-102` | 3D Printer A     | EQUIPMENT | Yes                     |
| `res-103` | Computer Lab 201 | LAB       | Yes                     |
| `res-104` | Study Room 304   | ROOM      | No                      |

### Reservations

```sh
curl -i -X POST 'http://127.0.0.1:3000/api/v1/reservations' \
  -H 'Content-Type: application/json' \
  -d '{
    "resourceId": "res-101",
    "userId": "user-456",
    "startTime": "2026-10-01T10:00:00Z",
    "endTime": "2026-10-01T11:00:00Z"
  }'
```

On a fresh process, this returns `201` with a server-generated UUID, the four submitted fields,
UTC-normalized timestamps, and `"status": "CONFIRMED"`.
Repeating it returns `409`:

```json
{
  "code": "DOUBLE_BOOKING",
  "message": "Resource is already reserved for this time slot."
}
```

```sh
curl -i 'http://127.0.0.1:3000/api/v1/reservations/user/user-456'
```

Active reservations are `PENDING` or `CONFIRMED` with `endTime` later than the current time.
The example dates match the assignment; use future dates to see active results after October 1, 2026.
Another user or a user without active reservations receives `[]`.

- IDs use 1–64 ASCII letters, digits, underscores, or hyphens, starting with a letter or digit.
- Creation accepts exactly `resourceId`, `userId`, `startTime`, and `endTime`; clients cannot assign `id` or `status`.
- Timestamps require a real calendar date, uppercase `T`, seconds, and `Z` or a numeric offset. Optional fractions have 1–3 digits. Supported years are 0001–9999, including after UTC normalization; leap seconds are not accepted.
- `startTime` must precede `endTime`. Past reservations may be created in this lab but are excluded from active results after they end.
- Intervals are half-open: `[startTime, endTime)`. Adjacent bookings are allowed. Overlap on another resource is allowed.
- A missing resource returns `404 RESOURCE_NOT_FOUND`; an operationally unavailable resource returns `409 RESOURCE_UNAVAILABLE`.
- Reservation creation requires uncompressed JSON. The parser enforces a 16 KiB limit; malformed JSON returns `400`, oversized input `413`, and unsupported media, charset, or compressed encoding `415`. JSON parsing applies only to reservation creation.

## Verification

```sh
npm test
npm run check
npm run build
npx --yes @redocly/cli@2.55.0 lint docs/openapi.json --extends spec
```

`npm test` uses Node's built-in test runner, real local HTTP requests, and offline Mongoose validation.
It needs permission to listen on localhost. No test-framework dependency or running database is needed.
The response assertions check the schema features used by this contract; Redocly separately validates OpenAPI structure and references.
The pinned Redocly command runs as a one-off tool and does not change the project's dependency allowlist or lockfile.

`npm run check` runs strict TypeScript, ESLint, and Prettier checks. `npm run build` compiles `src/` to `dist/`.
Tests are under `src/tests/` so existing type and lint checks cover them without changing compiler scope; they are never imported by the server.
The compiled suite can also run with `node --test dist/tests/*.test.js` after building.
See [Lab 2 verification](docs/lab2-verification.md) for observed results and the [implementation plan](docs/superpowers/plans/2026-09-28-lab2.md) for design decisions.

## Structure and Limits

```text
src/
  app.ts          HTTP composition and route mounting
  server.ts       Port validation and listener lifecycle
  routes/         HTTP method/path mappings only
  controllers/    Request validation and HTTP response handling
  services/       Resource catalog, reservation state, and conflict logic
  models/         Typed Mongoose schemas and models; no queries
  types/          Lab 2 domain interfaces and environment declarations
  interfaces/     Health and internal Service result contracts
  validation/     Shared pure input guards
  middleware/     Safe JSON errors and 404 handling
  tests/          HTTP, schema, and error-handling verification
```

Services remain the sole future host of Mongoose queries. No Repository layer is introduced.
The Mongoose schemas are validated offline and describe future persistence; current requests use in-memory Services.
Mongoose manages an internal `_id`; API `id` is a separate explicit field. Future persistence must map document internals to API records.
Unique-index declarations are not proof of database-enforced uniqueness without a connected database and built indexes.

Data resets on restart. Synchronous conflict checking and insertion prevent interleaving in one process;
this does not provide cross-process or distributed booking protection. There is no authentication or user database lookup.
Do not deploy this local lab implementation as a production booking system.

## Review and Submission

Lab 1's historical review is recorded in [docs/lab1-verification.md](docs/lab1-verification.md).
Lab 2 introduces new code and revised responses; its human review must be recorded separately.
Review `docs/openapi.json` → `src/types/reservation.ts` → validation/Services → Controllers/Routes → models/tests.

School repository: [postedism/campushub-backend](https://github.khoury.northeastern.edu/postedism/campushub-backend).
Submit the repository URL to the Lab 2 Canvas assignment after reviewing the work.
