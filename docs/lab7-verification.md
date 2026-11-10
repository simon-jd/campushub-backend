# Lab 7 — Dynamic Test Generation & Edge-Case Prediction

Date: November 9, 2026 (America/Los_Angeles).

Human review of the tests and the changes below is still required; this file records
only what the agent actually ran.

## What was added

| Area          | Files                                                                                                                                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Configuration | `jest.config.ts`, `src/test/setup.ts` (per-file in-memory MongoDB, cleared after each test), `src/test/factories.ts` (seed helpers that go through the Services)                                                                                                    |
| Service tests | `src/services/__tests__/reservation.service.test.ts`, `src/services/__tests__/resource.service.test.ts`                                                                                                                                                             |
| HTTP tests    | `src/routes/__tests__/reservation.routes.test.ts`, `src/routes/__tests__/resource.routes.test.ts`, `src/routes/__tests__/reservation.fuzz.test.ts` (seeded boundary fuzzing), `src/controllers/__tests__/failure-handling.test.ts` (500 paths via stubbed Services) |
| Scripts       | `npm test` → `jest`; `npm run test:coverage`; the earlier `node:test` suites moved to `npm run test:contract`                                                                                                                                                       |

## Existing implementation decisions reviewed

- **Dependencies** (`AGENTS.md` §2 requires approval and an allowlist update): `jest`,
  `ts-jest`, `@types/jest`, `supertest`, `@types/supertest`, `mongodb-memory-server`
  — all requested by the assignment — plus `@types/semver`. The last one is needed
  because `tsconfig.json` has `skipLibCheck: false` and `mongodb-memory-server`'s
  `.d.ts` imports `semver`; adding the types was chosen over relaxing the compiler.
  `AGENTS.md` was updated with the reason. The install reported 29 `npm audit`
  advisories in the dev-dependency tree; none were triaged or fixed here.
- **`tsconfig.json`**: `types` is now `["node", "jest"]` so `describe`/`it`/`expect`
  type-check. No strictness option was changed.
- **`src/app.ts`** (production code): `connectDatabase` now passes
  `runtimeAdapters: { os }` to the driver. Without it, every connection made inside Jest
  failed with `Missing required sub-document 'driver' in the client metadata document`:
  the driver (mongodb 7.6) builds its handshake metadata with a dynamic `import('os')`,
  which does not work in Jest's VM sandbox, and MongoDB 8 rejects a handshake without a
  `driver` field. `runtimeAdapters` is the driver's documented option; behaviour outside
  Jest is unchanged (the 32 earlier `node:test` cases still pass).
- **`jest.config.ts`** uses `module.exports = config` rather than `export default`.
  Jest's ts-node loader forces `module: commonjs`, which conflicts with the project's
  `Node16` mode (TS5110), so Node loads the file natively instead.
  ts-jest runs with `isolatedModules: true` for the same reason (it cannot type-check
  under `Node16`); ts-jest prints a deprecation warning for this option on every run.
  Full type-checking of the tests still happens in `npm run typecheck`.

## Edge cases covered

Double booking (exact match, 1 ms overlap at either end, containment both ways,
different UTC offsets for the same instant); half-open boundaries (back-to-back is
allowed, a 1 ms gap is allowed); `endTime` before / equal to / 1 ms before `startTime`
(rejected by the validator over HTTP and by the schema in the Service); unparseable and
impossible dates (Feb 30, Feb 29 in a non-leap year, month 13, hour 24, missing zone,
year 0); missing, extra and mistyped payload fields; NoSQL-operator-shaped input;
non-existent, malformed and unavailable resources; cancelled slots being released and
PENDING slots still blocking; terminal CANCELLED state; 415 / 413 / malformed JSON;
15 simultaneous identical requests (exactly one 201); randomised overlapping requests
checked against an independent oracle; and 500 responses that must not leak internals.

## Results observed

```text
npm test                  → Test Suites: 6 passed, Tests: 159 passed (exit 0)
npx jest --coverage       → exit 0, thresholds (80%) met
npm run check             → exit 0 (tsc, eslint --max-warnings=0, prettier)
npm run build             → exit 0
npm run test:contract     → 32 passed (run against a temporary local mongod)
```

```text
File                      | % Stmts | % Branch | % Funcs | % Lines
All files                 |     100 |      100 |     100 |     100
 controllers              |     100 |      100 |     100 |     100
 services                 |     100 |      100 |     100 |     100
```

The first coverage run already exceeded 80%, so no follow-up "coverage gap" tests were
needed. `coverage/` is git-ignored by the repository rules (`AGENTS.md` §6), so the
report above is the committed record; `npm run test:coverage` regenerates it.

## Historical mutation-testing record (not rerun in this review)

The pre-existing working-tree record states that seven deliberate bugs were injected one at a time into `reservation.service.ts` and the
whole suite was run; each was caught (and the file restored afterwards via `git checkout`):

| Mutation                                        | Failing tests |
| ----------------------------------------------- | ------------- |
| `$lt` → `$lte` on `startTime` (end boundary)    | 2             |
| `$gt` → `$gte` on `endTime` (start boundary)    | 2             |
| Cancelled reservations still block the slot     | 2             |
| Per-resource booking lock removed               | 4             |
| `CANCELLED` allowed as a source for `CANCELLED` | 3             |
| Unavailable-resource check removed              | 2             |
| User-list status filter ignored                 | 2             |

## Remaining limits

- Concurrency tests exercise one server process only; the service's lock does not
  protect several processes sharing one database (documented in the service).
- Each Jest worker boots its own `mongod`; the first run downloads a binary into
  `node_modules/.cache`, which needs network access.
- Canvas submission requires the student to submit the repository link.
- `jest.config.ts` is retained because Lab 7 explicitly requires that filename, overriding
  the general `.mts` tooling convention. It is loaded by Jest but is outside the
  source-only compiler and ESLint globs; those checks cover the test source.
- The service suites use a real isolated MongoDB. They are service-level database
  integration tests rather than pure mocked unit tests, as permitted by the lab.

## Current review and verification

On November 9, 2026, the current review reran the following checks:

- `npm test -- --runInBand --coverage`: 6 suites, 159 tests passed; statements,
  branches, functions and lines were 100% for both Services and Controllers.
- `npm run check` and `npm run build`: passed after correcting TS2322 in
  the missing-field test: spreading the typed booking payload creates a mutable
  `Record<string, unknown>` without weakening the domain interface.
- `npx --yes @redocly/cli@2.55.0 lint docs/openapi.json --extends spec`: passed
  with network access; the initial restricted-network attempt failed with ENOTFOUND.
- `npm run test:contract`: all 32 earlier tests passed using a temporary MongoDB.
- `npm run dev` and `npm run start`: each returned HTTP 200 for health (including
  a valid UTC ISO timestamp) and the seeded resource catalog. Temporary data was removed
  by stopping the in-memory database.

The initial sandboxed Jest run failed at `src/test/setup.ts:12` with `listen EPERM`
when MongoMemoryServer attempted to allocate a port. Repeating with local listener
permissions passed; no application workaround was needed. The deprecated ts-jest
`isolatedModules` option still emits a warning but does not fail verification.

An independent agent performed a read-only review. The review found no critical
correctness defect; anonymous test types were replaced with named contracts, and two
test names were corrected to match what their assertions actually establish. This
agent review is not human approval. The historical mutation results above were not
rerun and are not claimed as fresh evidence.

## Human review comments and dispositions

On November 9, 2026 the user supplied the review comments below in the session, after
the Lab 7 commit (`b85277e`). They are recorded as the user's stated comments, in the
user's own scope. This section is **not** a record that the user has personally read all
the context rules and generated code, or that they approve the lab as a whole
(`AGENTS.md` §7); no such statement was made.

| #   | Comment from the user                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Disposition                                                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **[P2] Clicking the already-selected category leaves the page on "loading" forever** (`client/src/App.tsx`, around line 62). After the page has loaded, clicking the selected "All" sets loading to true but the category value is unchanged, so no new request runs. Other categories behave the same; after a failure, clicking the current category cannot retry. Reproduced with a temporary test. Suggested: return early for the same category, or add an explicit refresh mechanism. | **Fixed.** Same category with no error now returns early; same category after a failed load re-runs the request through a reload counter. Two regression tests were added in `client/src/App.test.tsx`; both failed before the fix. Client suite: 21 passed; `tsc -b` and `oxlint` clean.                                      |
| 2   | **[P2] After a frontend build, backend lint fails** (`eslint.config.mts`, line 7). The ignore list covers only the root `dist/`, not `client/dist/`, so generated JavaScript is linted as source and fails `no-restricted-syntax`; the order of checks matters and the README documents manual cleanup. Suggested: exclude the frontend build directory precisely.                                                                                                                          | **Fixed with the user's explicit approval.** The agent first reproduced the failure and proposed the one-line diff (`AGENTS.md` §7 requires approval for lint-ignore changes); the user replied to apply it. `client/dist/**` was added to `ignores`; no rule was weakened. The README note about manual cleanup was replaced. |
| 3   | **No authentication or authorization** (documented deployment limit). A requester can query and create reservations for any student ID, and can cancel another student's reservation given its ID.                                                                                                                                                                                                                                                                                          | **Not changed.** Acknowledged as a documented limitation; fixing it needs an authentication design outside Lab 7.                                                                                                                                                                                                              |
| 4   | **Duplicate-booking protection works within one process only** (documented deployment limit; `src/services/reservation.service.ts` line 25 uses an in-memory queue). With several server processes sharing one database, double booking is still possible.                                                                                                                                                                                                                                  | **Not changed.** Acknowledged as a documented limitation. The Lab 7 concurrency tests exercise one process only and therefore do not contradict or cover this limit.                                                                                                                                                           |

Verification actually run for the two fixes (November 9, 2026):

- `client/`: `npx vitest run` 21 passed (two new regression tests failed before the fix);
  `npx oxlint` and `tsc -b` exit 0; `npm run build` succeeded.
- Lint ignore: with a freshly built `client/dist/` present, `npx eslint . --max-warnings=0`
  exits 0. With `eslint.config.mts` temporarily stashed back to its previous state, the
  same command fails with `no-restricted-syntax` on `client/dist/assets/index-*.js`
  (the reported defect), then the fix was restored. The generated output was removed afterwards.
- Backend: `npm run check` and `npm run build` exit 0; `npm test` 6 suites / 159 tests
  passed; coverage stays 100% for Services and Controllers.
- Not rerun for these two fixes: the mutation record, `npm run test:contract`,
  the Redocly contract lint and dev/start smoke checks (none of those inputs changed).
