# CampusHub Backend

CS 5500 CampusHub backend using TypeScript, Express, and Mongoose.
Lab 2 defined the OpenAPI contract; Lab 3 persists resources and reservations in MongoDB
behind an isolated Routes → Controllers → Services → Models architecture.

## Setup

- Node.js `>=24.21.0`, npm `>=11.19.1`, and a reachable MongoDB server (local default `mongodb://127.0.0.1:27017`).
- Run `npm ci` in this directory.
- Copy `.env-example` to `.env` if `.env` does not already exist, then adjust values if needed.
- Start MongoDB, for example `brew services start mongodb/brew/mongodb-community`.
- Run `npm run seed` once to load the sample resource catalog.
- Run `npm run dev`, or `npm run build` followed by `npm start`.

| Variable          | Default                     | Purpose                                                      |
| ----------------- | --------------------------- | ------------------------------------------------------------ |
| `PORT`            | `3000`                      | HTTP port on `127.0.0.1`; integer from 1 to 65535            |
| `MONGODB_URI`     | `mongodb://127.0.0.1:27017` | MongoDB connection string (`mongodb://` or `mongodb+srv://`) |
| `MONGODB_DB_NAME` | `campushub`                 | Database name; overrides any database path in the URI        |

All environment variables are read and validated only in [src/config/environment.ts](src/config/environment.ts).
The server connects to MongoDB **before** it listens; if the database is unreachable it exits with an error after 5 seconds.
Stop the development watcher with Ctrl+C, which closes the HTTP server and the database connection.

## Contract and Endpoints

[docs/openapi.json](docs/openapi.json) is the authoritative OpenAPI 3.0.3 contract.
Successes return objects or arrays directly, and all errors return `{ "code": "...", "message": "..." }`.

| Method | Path                                 | Success                    | Relevant errors                          |
| ------ | ------------------------------------ | -------------------------- | ---------------------------------------- |
| GET    | `/api/v1/health`                     | `200` status and timestamp | `500`                                    |
| GET    | `/api/v1/resources`                  | `200` resource array       | `400`, `500`                             |
| POST   | `/api/v1/reservations`               | `201` reservation          | `400`, `404`, `409`, `413`, `415`, `500` |
| GET    | `/api/v1/reservations/user/{userId}` | `200` reservation array    | `400`, `500`                             |
| PATCH  | `/api/v1/reservations/{id}/cancel`   | `200` reservation          | `400`, `404`, `409`, `500`               |
| PATCH  | `/api/v1/reservations/{id}/confirm`  | `200` reservation          | `400`, `404`, `409`, `500`               |

Unknown routes return `404 NOT_FOUND`. Application errors never expose internal stacks to clients.
Health does not probe MongoDB.

### Resources

```sh
curl -i 'http://127.0.0.1:3000/api/v1/resources'
curl -i 'http://127.0.0.1:3000/api/v1/resources?type=ROOM'
curl -i 'http://127.0.0.1:3000/api/v1/resources?type=STUDY_ROOM'
curl -i 'http://127.0.0.1:3000/api/v1/resources?type='
curl -i 'http://127.0.0.1:3000/api/v1/resources?isAvailable=true'
curl -i 'http://127.0.0.1:3000/api/v1/resources?type=ROOM&isAvailable=false'
```

Domain types are `ROOM`, `EQUIPMENT`, and `LAB`.
`STUDY_ROOM` is a query-only alias for `ROOM`, supporting the assignment's example while preserving its domain enum.
`isAvailable` accepts exactly the literal strings `true` or `false`; `type` and `isAvailable` may be combined and are then applied together.
Empty, repeated, unsupported, or unknown query parameters return `400 VALIDATION_ERROR`.

`npm run seed` upserts this catalog. IDs are MongoDB ObjectIds; fixed values mirror Lab 2's `res-101`…`res-104`
so manual requests stay copyable, and reseeding never changes an existing ID.

| ID                         | Resource         | Type      | Operationally available |
| -------------------------- | ---------------- | --------- | ----------------------- |
| `000000000000000000000101` | Study Room 302   | ROOM      | Yes                     |
| `000000000000000000000102` | 3D Printer A     | EQUIPMENT | Yes                     |
| `000000000000000000000103` | Computer Lab 201 | LAB       | Yes                     |
| `000000000000000000000104` | Study Room 304   | ROOM      | No                      |

### Reservations

```sh
curl -i -X POST 'http://127.0.0.1:3000/api/v1/reservations' \
  -H 'Content-Type: application/json' \
  -d '{
    "resourceId": "000000000000000000000101",
    "userId": "user-456",
    "startTime": "2099-10-01T10:00:00Z",
    "endTime": "2099-10-01T11:00:00Z"
  }'
```

The first request returns `201` with a server-generated ObjectId `id`, the four submitted fields,
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

### Status transitions

```sh
curl -i -X PATCH 'http://127.0.0.1:3000/api/v1/reservations/<id>/cancel'
curl -i -X PATCH 'http://127.0.0.1:3000/api/v1/reservations/000000000000000000000201/confirm'
```

Both routes take no request body and return `200` with the updated reservation.

- `CANCELLED` is terminal and a status is never a legal source for a transition to itself, so
  cancelling an already-cancelled reservation, or confirming a confirmed or cancelled one, returns
  `409 INVALID_STATE_TRANSITION` rather than silently succeeding.
- Cancelling releases the interval immediately: the same window becomes bookable again on the very
  next request.
- An `id` that is not an existing reservation's ObjectId returns `404 RESERVATION_NOT_FOUND`,
  matching how creation treats an unknown `resourceId`.
- Each transition is one conditional update, so concurrent cancellations of the same reservation
  produce exactly one `200` and the rest `409`.
- `POST /reservations` creates `CONFIRMED` reservations, so `npm run seed` also upserts one
  `PENDING` reservation (`000000000000000000000201`, Computer Lab 201) to exercise `confirm`.
  Reseeding returns it to `PENDING` so the transition can be retried.

Reservations persist across server restarts. To repeat the manual tests from a clean state,
drop the reservations collection (for example `mongosh campushub --eval 'db.reservations.drop()'`) and run `npm run seed` again.

- The user listing returns every reservation that user owns, including `CANCELLED` ones and ones
  whose `endTime` has passed, so a cancellation stays visible. Add `?status=PENDING|CONFIRMED|CANCELLED`
  to narrow it. A user without reservations receives `[]`.
- IDs use 1–64 ASCII letters, digits, underscores, or hyphens, starting with a letter or digit.
  A `resourceId` that is not an existing resource's ObjectId (including Lab 2's `res-101`) returns `404 RESOURCE_NOT_FOUND`.
- Creation accepts exactly `resourceId`, `userId`, `startTime`, and `endTime`; clients cannot assign `id` or `status`.
- Timestamps require a real calendar date, uppercase `T`, seconds, and `Z` or a numeric offset. Optional fractions have 1–3 digits. Supported years are 0001–9999, including after UTC normalization; leap seconds are not accepted.
- `startTime` must precede `endTime`. Past reservations may be created and stay listed after they end.
- Intervals are half-open: `[startTime, endTime)`. Adjacent bookings are allowed. Overlap on another resource is allowed.
- An operationally unavailable resource returns `409 RESOURCE_UNAVAILABLE`.
- Reservation creation requires uncompressed JSON. The parser enforces a 16 KiB limit; malformed JSON returns `400`, oversized input `413`, and unsupported media, charset, or compressed encoding `415`. JSON parsing applies only to reservation creation.

## Verification

```sh
npm test                 # Jest + Supertest + in-memory MongoDB (Lab 7)
npm run test:coverage    # same, with the coverage report and 80% thresholds
npm run test:contract    # earlier node:test suites; need a local MongoDB
npm run check
npm run build
npx --yes @redocly/cli@2.55.0 lint docs/openapi.json --extends spec
```

`npm test` runs Jest. Every test file starts its own `mongodb-memory-server` instance (`src/test/setup.ts`), connects the
real Mongoose models to it, and empties it between tests, so no installed MongoDB or `.env` is needed (the first run
downloads a `mongod` binary). Suites live in `__tests__` folders next to the code: `src/services/__tests__/`,
`src/routes/__tests__/` (Supertest against the real Express app) and `src/controllers/__tests__/`. Coverage is collected
from `src/services/` and `src/controllers/` and fails below 80% statements, branches, functions and lines.

`npm run test:contract` runs the earlier Lab 2–4 `node:test` suites. They use real local HTTP requests and a throwaway
database named `campushub_test_<pid>` on the MongoDB from your configuration, which must be running; they fail rather than skip when it is not.
Model tests validate schemas offline. They need permission to listen on localhost.

`npm run check` runs strict TypeScript, ESLint, and Prettier checks. `npm run build` compiles `src/` to `dist/`.
The compiled suite can also run with `node --env-file-if-exists=.env --test dist/tests/*.test.js` after building.
See [Lab 3 verification](docs/lab3-verification.md) for observed results and design decisions.

## Structure and Limits

```text
src/
  app.ts          Express composition, route mounting, and the database connection shell
  server.ts       Loads config, connects to MongoDB, listens, and shuts down cleanly
  config/         Environment variable parsing and validation (the only reader of process.env values)
  routes/         HTTP method/path mappings only
  controllers/    Request validation and HTTP status/response handling; no Mongoose
  services/       Business rules and every Mongoose query; no Express
  models/         Typed Mongoose schemas, exported record interfaces, and models; no queries
  scripts/        Operational entry points (seed) that call Services
  types/          API domain interfaces and environment declarations
  interfaces/     Health and internal Service result contracts
  validation/     Shared pure input guards
  middleware/     Safe JSON errors and 404 handling
  tests/          HTTP, schema, and error-handling verification
```

The API `id` of a resource or reservation is its MongoDB `_id` in hexadecimal; Services map documents to API records.
`Reservation.resourceId` is stored as an ObjectId reference to `Resource`.

The overlap check and insert are separate database round trips, and standalone MongoDB has no multi-document
transactions. Bookings for the same resource are therefore serialized inside one server process. This does not
protect against several server processes sharing one database. There is no authentication or user database lookup.
Do not deploy this lab implementation as a production booking system.

## Frontend

Lab 5 adds a React client in [client/](client/). It uses the existing API and does not change it.

- Start MongoDB, run `npm run seed` if the catalog is empty, then `npm run dev` in this directory.
- In a second terminal, run `npm ci` and `npm run dev` inside `client/`.
- Open `http://127.0.0.1:5173`. Vite proxies `/api` to `http://127.0.0.1:3000`.
- The student ID defaults to `user-456`. Choose a resource, pick a start and end, and book it. An overlapping booking shows a conflict alert. Cancel releases that time slot.

## Review and Submission

Lab 1 and Lab 2 records are in [docs/lab1-verification.md](docs/lab1-verification.md) and [docs/lab2-verification.md](docs/lab2-verification.md).
Lab 3's human layer-isolation audit must be recorded separately in [docs/lab3-verification.md](docs/lab3-verification.md).
Review `docs/openapi.json` → `src/models/` → `src/services/` → `src/controllers/` → `src/routes/` → `src/app.ts` → tests.

School repository: [postedism/campushub-backend](https://github.khoury.northeastern.edu/postedism/campushub-backend).
Submit the repository URL to the Lab 3 Canvas assignment after reviewing the work.

## Lab 6: refactoring and context optimization

See [the audit and verification report](docs/lab6-verification.md) for the context
query, measurements, design choices, regression checks, and environment limitations.

- `.cursorrules` and `.cursorignore` keep routine context focused on source.
- `src/middleware/errorHandler.ts` centralizes shared HTTP failures.
- `client/src/hooks/useReservations.ts`, `useBookingForm.ts`, and `useCancellation.ts`
  separate reservation state and operations from rendering.
- The client imports shared domain types from `src/types/reservation.ts`.

Backend lint ignores the generated `client/dist/` build output, so backend checks and
the client build can run in either order. Hand-written client source is not widened or
narrowed by this: the client is checked with its own `npm run lint` inside `client/`.
