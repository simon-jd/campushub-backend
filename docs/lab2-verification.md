# Lab 2 Implementation and Verification

## Scope and Authority

- Source: [CS 5500 Lab 2](https://docs.google.com/document/d/1EKIoxOw7OtgoknDJnoBVwaV8t4PokhDYlQefW0MkJzs/edit?tab=t.0). The initial pasted attachment ended mid-example; the complete Google document was exported and read before implementation.
- The user requested complete Lab 2 implementation and explicitly made its design authoritative over conflicting Lab 1 conventions.
- Generated contract: `docs/openapi.json` (OpenAPI 3.0.3, an explicitly allowed JSON alternative).
- Required interfaces: `src/types/reservation.ts`. Required router: `src/routes/reservation.routes.ts`.
- Runtime: three required business endpoints, existing health endpoint, and minimal in-memory Services; no database is started or connected.
- Human review of Lab 2 code: **not yet recorded**. Lab 1 approval does not constitute review of these changes.
- Canvas submission: **not performed**. The repository URL is the submission deliverable.

## Contract-Driven Generation

The implementation instruction was: use `docs/openapi.json` as the authoritative contract to generate the User, Resource, CreateReservationRequest, Reservation, and ErrorResponse interfaces; define the required Routes; implement only the Controllers and in-memory Services needed to exercise those routes; preserve strict checks and keep all HTTP handling out of Services.

The contract was written before the implementation. HTTP tests were then written and run against Lab 1: all 12 behavior subtests failed, including the obsolete health envelope and missing business endpoints. The same tests passed after implementation.

## Decisions Resolving Assignment Ambiguities

- Lab 2's direct arrays/objects and `{ code, message }` errors replace Lab 1's envelopes consistently, including health and shared middleware. AGENTS.md was updated explicitly; compiler and lint constraints were preserved.
- The domain enum remains `ROOM`, `EQUIPMENT`, `LAB`. The assignment's `STUDY_ROOM` curl filter is supported as a query-only alias for `ROOM`.
- A separate `CreateReservationRequest` excludes server-generated `id` and `status`, matching the assignment's POST example. Created reservations are `CONFIRMED`.
- Active reservations are non-cancelled and have a future `endTime`. Empty results return `[]`; user IDs are syntax-checked without inventing an authentication subsystem.
- Resource `isAvailable` denotes operational availability, not whether all future time slots are empty. Overlap uses half-open intervals and compares actual instants after parsing timezone offsets.
- Runtime date checks enforce calendar validity, timezone presence, interval order, and the documented millisecond-precision ISO subset; `format: date-time` alone does not implement those checks.
- Mongoose schemas retain explicit API IDs separately from internal `_id`. They are prepared and tested offline, not used as a pretend database.

## Verification Evidence

Observed environment: Node.js `v26.8.2`, npm `11.19.1`.

- `npx --yes @redocly/cli@2.55.0 lint docs/openapi.json --extends spec`: **passed**; valid OpenAPI description, no structural/reference errors. This one-off tool was not added to project dependencies.
- `npm test`: **20/20 passed**, zero failures, cancelled tests, or skips.
- `node --test dist/tests/*.test.js`: **20/20 passed** after the final rebuild; same cases exercised in compiled execution.
- `npm run check`: TypeScript, ESLint, and Prettier checks passed after the fixes documented below.
- `npm run build`: passed after the fixes below, without changing `tsconfig.json` or ESLint ignores.
- `npm run dev` on port 31350 and `npm start` on port 31351 each passed these 9 real curl scenarios:

| Scenario                                   | Expected and observed status         |
| ------------------------------------------ | ------------------------------------ |
| Health object                              | 200                                  |
| List all four resources                    | 200                                  |
| Filter with assignment alias `STUDY_ROOM`  | 200                                  |
| Empty type filter                          | 400                                  |
| Create the assignment's sample reservation | 201                                  |
| Repeat the same reservation                | 409, `DOUBLE_BOOKING`                |
| Fetch that user's active reservations      | 200, exactly the created reservation |
| Missing request fields                     | 400                                  |
| Invalid calendar date (`2026-02-30`)       | 400                                  |

Both entry-point processes and their watcher children were stopped after checking. Different test ports avoided interfering with other local applications. Each fresh process allowed the first creation, confirming that the lab's in-memory state resets on restart.

The automated HTTP suite also covers partial/enclosing/contained overlaps, equivalent instants with different offsets, adjacent slots, separate resources, five simultaneous competing requests (one `201`, four `409`), user isolation, expired bookings, malformed JSON, unexpected fields, repeated queries, unsupported media, and the 16 KiB limit. Every observed required-endpoint response is checked against the response schema selected by path, method, and HTTP status in the contract.

The response assertion helper implements only the schema features this contract uses; it is not a general-purpose OpenAPI validator. Redocly supplies independent specification validation. Offline model tests check required fields, enums, UUIDs, strict unknown-field handling, string/boolean casts, dates, and interval ordering. Error-middleware tests exercise synchronous throws, Promise rejections, and errors after headers are sent using actual HTTP.

## Diagnostics and Corrections

No diagnostics were bypassed through a compiler, lint, ignore, or dependency change.

1. The first HTTP test launch inside the restricted tool environment failed with `listen EPERM: operation not permitted 127.0.0.1` at `Server.setupListenHandle (node:net:2306:21)`. The same test command ran with localhost execution permissions. This was an environment permission issue, not a typing or architecture defect.
2. The first format check reported `Code style issues found in 3 files` for `src/controllers/reservation.controller.ts`, `src/controllers/resource.controller.ts`, and `src/middleware/error.middleware.ts`. Prettier supplied no line numbers or stack. A second targeted formatting pass resolved the formatting-only diagnostics; the project configuration was unchanged.
3. `src/models/reservation.model.ts(17,5): error TS2322` reported that the validator's `this: Reservation` was incompatible with Mongoose's document-or-query context. The compiler supplied no runtime stack. The ts-node test wrapper reported `createTSError` at `node_modules/ts-node/src/index.ts:859:12`, `reportTSError:863:19`, and `getOutput:1077:36`. The fix uses `this: unknown`, verifies that it is an object with a valid `startTime`, and then checks interval ordering. This was a type-narrowing/interface issue, not a layering violation.
4. `src/tests/errors.test.ts(52,11): error TS7022` reported a circular/implicit-any inference for a fetch result. An explicit `Awaited<ReturnType<typeof fetch>>` annotation preserves the actual fetch type. No cast to `any`, ignored diagnostic, or configuration change was used; the compiler supplied no runtime stack.
5. `src/tests/errors.test.ts:33:7` reported `@typescript-eslint/no-unused-vars` for the fourth error-handler parameter. The fixture now forwards errors when headers have not started; all four parameters retain Express's error-handler signature. ESLint supplied no runtime stack. This was an unused-parameter issue.
6. `src/tests/lab2.test.ts:401:17` reported `@typescript-eslint/prefer-promise-reject-errors` for rejecting an `unknown` caught value in the native HTTP regression fixture. The fixture now preserves an existing `Error` or constructs one with the original cause. This was an error-type narrowing issue, not an architectural violation; ESLint supplied no runtime stack.
7. Mongoose warned that `validateSync()` is deprecated. Offline tests were updated to await `validate()` and assert fulfilled/rejected validation promises; no warning was suppressed.

## Limitations and Review

Reservations and resources live in one process's memory. There is no durable storage, authentication, user existence lookup, cancellation endpoint, or multi-worker booking lock. None is required for this lab. The typed Mongoose schemas do not by themselves enforce cross-document or database uniqueness; future persistence must revisit query validation and concurrency.

A fresh independent agent reviewed the complete code, contract, layering, and test coverage. It found no material booking defects and identified two parser/contract edge cases. The parent reproduced both with real HTTP: corrupted gzip returned `500` instead of a client error; a GET health request with an irrelevant malformed JSON body returned `400` instead of its documented `200`. These were treated as contract-correctness fixes before publication.

The parser now runs only on `POST /reservations` and rejects compressed bodies with `415`. Both regressions failed before the change and passed afterward, followed by the full 20/20 source and compiled suites and the 18 entry-point smoke scenarios. The optional review suggestion to check state after failed resource bookings was also included. No review findings remain deferred.

The reviewer did not independently verify final test commands, the final documentation, publication, Canvas submission, human approval, distributed persistence, or authentication. The parent verified the first three locally; implementation commit `e3041dd3af60e29518a3534efcf40f3df2818564` was pushed to `main` at the [Khoury repository](https://github.khoury.northeastern.edu/postedism/campushub-backend), and `git ls-remote` matched the local commit. Canvas submission and human approval remain unperformed, and distributed persistence/authentication remain explicitly outside this local lab's scope. Automated or agent review is not human approval.

## References Used During Implementation

- [OpenAPI 3.0.3 specification](https://spec.openapis.org/oas/v3.0.3.html)
- [Mongoose validation](https://mongoosejs.com/docs/validation.html)
- [Redocly CLI lint command](https://redocly.com/docs/cli/commands/lint)
