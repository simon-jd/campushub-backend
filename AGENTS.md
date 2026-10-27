# CampusHub: AI Development Rules

This file applies to the entire `campushub-backend` repository and provides version-controlled context for the CS 5500 semester project. The OpenAPI contract in `docs/openapi.json` (created in Lab 2, updated for MongoDB persistence in Lab 3) governs current API behavior.
Read this file, the user's current request, and the relevant code before starting work. Stay within the scope authorized by the user.

## 1. Human Review and Rule Changes

- Record review status and one-time verification results in `docs/`, for example `docs/lab1-verification.md`, never in this file. This file holds only standing rules.
- Never record agent self-checks, tool results, or another agent's review as human approval. Record the actual review status.
- Explain the reason and impact of future rule changes. Never silently remove constraints, disable rules, or reduce strictness to eliminate check failures.

## 2. Technology Stack and Dependency Allowlist

- Use Node.js `>=24.21.0`, npm `>=11.19.1`, TypeScript, Express, and Mongoose.
- The only permitted direct runtime dependencies are `express` and `mongoose`. Node.js built-in modules are allowed.
- The only permitted direct development dependencies are `typescript`, `ts-node`, `@types/node`, `@types/express`, `eslint`, `@eslint/js`, `typescript-eslint`, `jiti`, and `prettier`.
- The allowlist governs direct dependencies. npm resolves their transitive dependencies into the lockfile; do not treat those packages as independently approved application imports.
- Before adding or replacing a direct dependency, explain why it is necessary and obtain user approval, then update this file and the lockfile.
- Use npm and commit `package-lock.json`. Use `npm ci` when installing from an existing lockfile.
- The project uses TypeScript 5.9 and Node 24 type definitions to stay within tooling support and avoid APIs above the project's minimum runtime version.
- Write application source in `.ts`, declarations in `.d.ts`, and tooling configuration in `.mts` or JSON. Do not author `.js`, `.cjs`, `.mjs`, or `.jsx` application or tooling files.
- Generated JavaScript in `dist/` and third-party files in `node_modules/` are exempt from the source extension restriction. Do not edit them manually or commit them.
- Use CommonJS application output with TypeScript `Node16` module resolution. Keep development and compiled execution consistent; do not mix unverified module settings.

## 3. Architectural Boundaries

The application call direction is **Routes → Controllers → Services → Models**. Models define data; Services are the sole location for Mongoose query calls.
Do not combine multiple layers' responsibilities in one file, even for a simple endpoint.

| Location           | Permitted responsibilities                                                                                                   | Prohibited responsibilities                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/app.ts`       | Create the Express application, mount shared middleware and routes, export the application and the database connection shell | Listen on a port, connect at import time, business logic, database queries                       |
| `src/server.ts`    | Load configuration through `src/config/`, connect the database, start listening, handle startup failures and shutdown        | Route definitions or business rules                                                              |
| `src/config/`      | Read, default, and validate environment variables into typed configuration                                                   | Express, Mongoose, connections, business logic                                                   |
| `src/routes/`      | Map paths and HTTP methods to existing Controllers and middleware                                                            | Inline business logic, direct Service calls, database access                                     |
| `src/controllers/` | Read and validate HTTP input, call Services, set response status and body, forward errors                                    | Import or call Mongoose Models, direct database queries, business rules                          |
| `src/services/`    | Business logic and persistence operations, call Mongoose Models, accept and return typed data                                | Express request/response objects, HTTP status codes, route registration, HTTP response envelopes |
| `src/models/`      | Define and export Mongoose schemas, record interfaces, document types, indexes, and models                                   | Execute queries, handle requests, implement business rules                                       |
| `src/scripts/`     | Operational entry points such as seeding: load config, connect, call Services, disconnect                                    | Express handling, direct Model queries, business rules                                           |
| `src/middleware/`  | Shared HTTP middleware, consistent 404 and error responses                                                                   | Business rules, database queries                                                                 |
| `src/interfaces/`  | Request, response, business data, and function contracts                                                                     | Executable logic with side effects                                                               |
| `src/types/`       | Type-only domain contracts (including Lab 2 reservation.ts) and third-party type extensions                                  | Application runtime logic                                                                        |

- Do not introduce unused classes, generic base classes, dependency injection containers, or additional architectural layers.
- Since Lab 3, Services persist all domain data in MongoDB through Mongoose. Do not keep domain records in memory. The only permitted in-process state is the per-resource booking queue that serializes the overlap check and insert. The health check must remain independent of MongoDB.
- Model files are named `src/models/<Entity>.model.ts` (for example `Resource.model.ts`). Each exports a named record interface for the stored fields, the schema parameterized with it, and the model. MongoDB `_id` is the API `id`; Services map documents to the API types in `src/types/` and never return Mongoose documents to Controllers.
- Shared pure input guards may live in `src/validation/`. They have no HTTP responses, database access, or mutable business state.
- `src/types/reservation.ts` contains the Lab 2 domain interfaces requested by the assignment; it must contain only type declarations. Health-specific interfaces remain in `interfaces/`.
- During persistence work, all Mongoose reads and writes, including `find`, `findOne`, `create`, `save`, updates, deletes, and aggregation, must reside in `services/`. Controllers call Services; Model files only define and export schemas, interfaces, and models without executing queries.
- The course brief describes Services as "pure business logic". In this project that means Services contain no HTTP concerns (no Express objects, status codes, or response envelopes) and are the only layer that calls Mongoose Models. This still satisfies the brief's rule that Controllers make no direct database queries.
- **Do not introduce the Repository pattern at this stage.** If it becomes necessary, explain the reason and obtain user approval before updating this file, directory conventions, and lint boundaries together. Do not leave contradictory architectural rules in place.
- Database connection and disconnection belong to startup lifecycle management, not business queries. `src/app.ts` exports `connectDatabase`/`disconnectDatabase`, which take a `DatabaseConfig` from `src/config/`. Importing `app.ts` must never connect; `server.ts`, scripts, and tests decide when to connect. Business reads and writes remain confined to Services.
- Read environment variables only through `src/config/`. Do not hardcode connection strings, database names, or ports elsewhere; never print a connection string, which may contain credentials.
- Import direction and responsibilities require manual review. Current lint rules cover only some direct imports (routes, controllers, services, models, config, scripts); they do not prove complete architectural compliance.

### Minimal Health-Check Implementation

- Even the health-check endpoint must follow **Route → Controller → Service**, with a `HealthResponse` data interface in `interfaces/`.
- Use one ordinary synchronous Service function to return a plain status object: `{ status: 'ok', timestamp: string }`. Generate the timestamp for each call as a UTC ISO 8601 string, for example with `new Date().toISOString()`.
- The Controller calls the Service and returns its status object using the JSON contract below. The Route only maps to the Controller.
- Do not add a `HealthService` class, a corresponding `IHealthService`, factories, mock adapters, or unnecessary forwarding layers. Keep only the required layer files and data interfaces.
- Do not add simulated delays, periodic heartbeats, heartbeat libraries, database probes, or unrelated dependencies.

### Consistent Controller JSON Responses

- Follow `docs/openapi.json` as the authoritative Lab 2 contract. Successful endpoints return their domain object or array directly; do not wrap responses in `success` or `data`.
- All error responses use the shared `ErrorResponse` interface from `src/types/reservation.ts`: `{ code: string, message: string }`. Do not wrap errors in `error`.
- Controllers own HTTP status codes and error mapping. Services return typed domain results without Express objects, HTTP codes, or response envelopes.
- Use `200` for successful reads and health, `201` for a created reservation, `400` for invalid input, `404` for missing resources/routes, `409` for booking conflicts/unavailable resources, `413` for oversized bodies, `415` for unsupported request media, and `500` for unexpected errors. Document each implemented response in the contract.
- Health returns `{ status: 'ok', timestamp: string }`. All other success shapes must match their referenced OpenAPI schemas.
- Unexpected failures use `INTERNAL_ERROR` and a generic message. Never disclose stacks, database details, request bodies, or sensitive configuration to clients.
- Keep response handling explicit and small; do not add generic builders, base classes, or decorators.

## 4. Type Safety and Coding Standards

- Preserve `strict: true`, `allowJs: false`, `noEmitOnError: true`, and the existing strict compiler checks.
- Explicitly type every function and method parameter and return value. Async functions must specify `Promise<T>`.
- Define named interfaces for custom structured inputs, outputs, request/response bodies, and database records. Do not obscure contracts with anonymous object shapes or overly broad object types.
- Define interfaces for all function signatures and DB schemas as follows: every parameter and return type is explicit, and every structured parameter, return value, and schema shape is a named interface. Ordinary functions do not require an additional callable interface. Add a function interface only when a callable contract must actually be reused or substituted. Use existing Express callback types with the relevant generic arguments; use primitive types such as `string` and `number` directly.
- Parameterize Mongoose schemas and models with their corresponding data interfaces so that the definitions remain consistent.
- Do not use explicit or implicit `any`, `as any`, double assertions, `@ts-ignore`, or disabled lint rules to bypass checks.
- Treat external input and unknown errors as `unknown`, then narrow them with runtime checks. A type assertion is not input validation.
- Use `import type` for type-only symbols and follow the repository's Prettier configuration.
- Use clear names and small functions. Comments should explain constraints or reasons rather than restate the code.

## 5. Async Work and Error Handling

- Every Promise must be awaited, returned to a caller that handles failure, or followed by a `.catch(...)` that actually handles the error.
- Do not hide unhandled work with bare `void promise`, swallow exceptions, or disguise failures as successful responses.
- Express async handlers must forward failures into the shared error chain: return a Promise the framework can handle, or catch an `unknown` error and call `next(error)`. Forward each error only once.
- Never send another response after a response is complete. Do not return internal stacks or sensitive configuration to clients.
- Keep simple synchronous logic synchronous; do not add unnecessary async wrappers for demonstration purposes.
- Default the port to `3000` when unset. Accept only integers from `1–65535` and report invalid configuration clearly.
- Connect to MongoDB before listening. If startup fails after connecting, close the connection so the process can exit.

## 6. Environment Files and Version Control

- Keep `.env` local and never commit it. Include only non-secret example values in `.env-example`.
- Do not commit or manually edit `node_modules/`, `dist/`, logs, coverage output, or temporary verification files.
- Commit source, context rules, tooling configuration, the lockfile, and necessary documentation.
- Do not rewrite existing history or overwrite the user's uncommitted work. Follow the user's actual authorization for remote pushes, publication, and course-platform submissions.
- Use concise `type: summary` commit messages, such as `chore: initialize backend tooling` or `feat: add health endpoint`.
- PR/diff descriptions must explain what changed and why, which context rules were applied, what verification actually ran, and what remains unfinished. Never invent test results or human review records.

## 7. Verification and Completion Claims

- After changes, run `npm run check` and `npm run build`, and read their results before reporting completion.
- When `npm run check` or `npm run build` fails, perform these steps in order:
  1. Show the failed command, original diagnostics, specific file paths, line and column numbers, and error codes or rule names. Show the stack trace when the tool provides one. Explicitly state when no stack or location is available; do not invent either. Redact sensitive values.
  2. Analyze the root cause: identify TypeScript narrowing, null handling, or interface mismatches, versus architectural violations such as cross-layer access. Report formatting, dependency, or tooling configuration issues separately rather than forcing them into those two categories.
  3. Fix the underlying type handling, responsibility placement, or code, then rerun the failed command and necessary checks. Report any remaining failures individually.
- **Never privately change `tsconfig.json` or ESLint ignore entries to make a failure appear to pass.** Do not lower rule severity, add `eslint-disable`, narrow the checked file scope, use `@ts-ignore`/`any`, or change scripts to skip checks. If a configuration change is genuinely needed, present the evidence, impact, and proposed diff first and obtain explicit user approval for that change.
- Passing type checks and compilation does not replace actual HTTP verification.
- `dev` and `start` run `src/server.ts` and `dist/server.js`, respectively. Start them and request the endpoint before claiming runtime verification passed.
- After generating Part 3 code, run `npm run dev` and request `GET /api/v1/health`. Confirm HTTP `200`, `status` equal to `ok`, and a valid UTC ISO 8601 `timestamp`; also review layering and types.
- If generated code violates a boundary, correct the rules or implementation and verify again. Record actual deviations rather than inventing failures or retries.
- The user must personally read both the context rules and generated code. Automated checks cannot replace either review.

## 8. Contract and Verification

- Maintain `docs/openapi.json` before changing endpoint behavior. Keep request validation, interfaces, Mongoose schemas, and HTTP responses consistent with it.
- Preserve Route → Controller → Service → Model for every resources/reservations endpoint (Lab 2's three, plus the Lab 4 status transitions). Persist data only through Services; never in a Router or Controller.
- Validate `unknown` inputs before passing typed data to Services. Reject missing/unexpected fields, malformed dates, invalid intervals, and invalid query values with contract errors.
- Overlap uses half-open intervals for the same resource. Non-cancelled overlapping reservations block creation; adjacent intervals do not. Cancelling releases an interval immediately, so the slot becomes bookable again.
- Reservation status transitions are a state machine, not a free-form field update: `CANCELLED` is terminal, and a status is never a legal source for a transition to itself. Perform a transition as one conditional update so concurrent requests cannot both succeed, and report a status that forbids the transition as `409 INVALID_STATE_TRANSITION`, distinct from the `404` used for a missing reservation.
- Run `npm test`, contract validation, `npm run check`, and `npm run build`, plus development and compiled HTTP smoke checks before claiming a lab verified. The Lab 2 and Lab 4 HTTP suites are the regression suite; behavior changes require a contract change first.
- Both HTTP suites assert live responses against `docs/openapi.json` through `src/tests/contract.helper.ts`, which fails when an endpoint returns a status the contract never declared. Keep new endpoints wired into that check rather than asserting shapes by hand.
- HTTP tests and manual checks require a running MongoDB. Tests create, seed, and drop their own per-suite, per-process database (`campushub_test_<pid>`, `campushub_lab4_<pid>`); never point tests at development data. Manual checks require `npm run seed` first.
- The built-in Node test runner requires no added dependency. Tests in `src/tests/` are included in existing compiler/lint coverage; do not mount them in the application.

## 9. Frontend Client (Lab 5)

Sections 2–8 govern the Express backend. `client/` is a separate Vite application and is outside the backend dependency allowlist. Do not add its packages (`react`, `axios`, `tailwindcss`, and their tooling) to the backend `package.json`, and do not add a CORS dependency so the browser can call port 3000. The client dev server proxies `/api` to `http://127.0.0.1:3000`.

- Component architecture: functional components only, each with an explicit props interface.
- State management: `useState`, `useEffect`, or custom hooks. Do not call the API from JSX.
- Styling: Tailwind utility classes in `client/`. Do not introduce a second styling system there.
- The typed API module is `client/src/api/campushubApi.ts`. It must stay aligned with `docs/openapi.json`. The lab text mentions `docs/openapi.yaml`; this repository's contract is `docs/openapi.json`.
- Backend `npm run check` does not typecheck the client. Verify the client with `npm test`, `npm run lint`, and `npm run build` inside `client/`.
- `.tsx` files belong only in `client/`. The backend source-extension rules are unchanged.
