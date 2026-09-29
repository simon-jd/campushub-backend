# Lab 1 Initialization and Review Record

## Scope and Status

This section is the single record of review status. It previously also appeared in AGENTS.md section 1, which now holds only standing rules.

- Authorization: the user approved the revised rules and requested execution of Part 3.
- Human review of AGENTS.md: **completed**.
- Express application, startup entry point, and health check: **implemented**.
- Boundary-verification prompt, static checks, and HTTP verification of development and compiled entry points: **completed**.
- Human review of generated code: **completed**. The user confirmed that the code had been reviewed without concerns, then requested English documentation.
- Remote repository: **created and pushed** to the private [postedism/campushub-backend](https://github.khoury.northeastern.edu/postedism/campushub-backend) repository on Khoury GitHub. Local `main` tracks `origin/main`.
- PR creation and course-platform submission: **not performed**.

## Initialization Decisions (Historical Record)

- Initialized a `main` branch in the separate `campushub-backend` directory; the course directory itself was not initialized as a Git repository.
- That stage created only configuration and directory scaffolding, without executing Part 3.
- Express and Mongoose were the application dependencies; development dependencies were separately allowlisted.
- Selected TypeScript 5.9: at initialization, npm's latest tag was 7.0.2 while typescript-eslint declared support for `<6.1.0`. An unsupported combination was not installed blindly.
- Used a `.d.ts` environment declaration as the initial type-checking input. There was no application implementation yet; compilation did not constitute runtime verification.
- Prepared development and production startup commands, which became usable after the server entry point was created.
- Checked configuration with the actual tools, without adding business tests or a test framework for initialization.

## Configuration References

- [typescript-eslint getting started](https://typescript-eslint.io/getting-started/)
- [ESLint configuration files](https://eslint.org/docs/latest/use/configure/configuration-files)

## Initialization Check Results (Historical Record)

- Observed environment: Node.js `v26.8.2` and npm `11.19.1`, meeting the lab's stated minimum versions.
- `npm run check`: passed strict type checking, lint, and formatting checks.
- `npm run build`: passed; only `.d.ts` files existed then, so no runnable server was generated.
- `npm ls --depth=0`: passed; all direct dependencies were allowlisted in AGENTS.md, with no dependency-resolution errors.
- Installation audit output: 209 packages, 0 reported known vulnerabilities. This records only that npm audit result at that time.
- Effective ESLint configuration: future route, controller, and service files enabled restrictions on `any`, unhandled Promises, and the relevant direct imports.
- Executed TypeScript with `ts-node` and imported Express/Mongoose successfully, without starting HTTP or database connections.
- Node loaded the local environment file and read `PORT=3000`.
- Git ignored `.env`, dependencies, and build output paths; source, configuration, and context rules were eligible for version control.
- HTTP and generated-code boundary checks had not yet run at that stage; those results covered initialization only.
- An independent agent's read-only review found no Critical or Important issues and considered the work ready for human review. Its note about stale check status was resolved by updating these observed results. That review did not substitute for human review.

## Part 3 Generation Prompt

After the user approved AGENTS.md, implementation followed the original prompt and the reviewed rules:

> Generate an initial Express server file (`src/app.ts`) and a baseline health-check endpoint (`GET /api/v1/health`).

Verification covered strict typing, directory responsibilities, the dependency allowlist, no business logic in routes, no database queries in Controllers,
and HTTP `200` with the standard success JSON envelope, `data.status`, and `data.timestamp`.

## First Human Review Revisions

- Defined Services as the sole host of Mongoose query calls and explicitly deferred the Repository pattern. Distinguished connection lifecycle management from business queries.
- Updated Service import restrictions to allow Mongoose and Models while preserving database import restrictions for Routes and Controllers.
- Defined success/failure JSON envelopes, HTTP status codes, and the shared error-response format.
- Required Health to retain its layers and response interface, with a Service returning only status and timestamp; no classes, delays, or probing dependencies.
- Removed the requirement for a separate callable interface for every ordinary function while retaining explicit signatures and data interfaces.
- Required real diagnostic locations and available stacks on check failures, analysis of typing or architectural causes, and prohibited bypassing checks through weakened configuration or ignored files.
- The user's requested database-responsibility change authorized the lint adjustment. It did not change tsconfig, check scripts, rule severity, or ignore scope.
- After revision, `npm run check` and `npm run build` passed.
- Seven checks against the actual ESLint import rules passed: Services could import Mongoose/Models but not Express/the native MongoDB driver; Controllers could not import Mongoose/Models; Routes could not import Services directly.
- Restrictions on `any` and unhandled Promises remained errors in every layer. Git differences confirmed that tsconfig, dependencies, check scripts, and ignore files were unchanged.
- At that stage, app/server/health code had not been generated and HTTP verification had not run.

## Part 3 Implementation and Verification

- Call path: `app.ts` → `health.routes.ts` → `health.controller.ts` → `health.service.ts`.
- `HealthResponse` and shared success/failure interfaces reside in `interfaces/`. The Service contains one synchronous function returning status and a UTC ISO timestamp.
- `error.middleware.ts` handles 404 and consistent 500 responses, forwarding errors after headers have been sent to avoid duplicate responses.
- The entry point validates the port and handles listener errors. It binds only to `127.0.0.1`, does not connect to a database, and adds no dependencies.
- Added `middleware/` for the approved shared error handling, without adding a business architecture layer, classes, or response builders.
- `npm run check`: passed TypeScript, ESLint, and Prettier checks.
- `npm run build`: passed and produced a runnable `dist/server.js`.
- `npm run dev` listened on `127.0.0.1:3000`. `curl -i` returned HTTP `200` with this observed response:

```json
{
  "success": true,
  "data": { "status": "ok", "timestamp": "2026-09-29T02:11:15.534Z" }
}
```

- Development entry point: HTTP `200`, JSON content type, exact field sets, status value, current timestamp range, ISO timestamp format, and the shared 404 response all passed.
- Stopped the development process and started the compiled entry point with `npm start`; health and shared 404 checks passed.
- Nine invalid PORT values (empty string, 0, 65536, -1, 1.5, abc, 3000junk, 1e3, and 3000 with surrounding spaces) produced clear errors and exit status 1.
- Starting a second compiled process on an occupied port produced EADDRINUSE and exit status 1; the original service remained responsive.
- A temporary HTTP application mounted the actual error middleware. Synchronous throws and asynchronous Promise rejections both returned the shared 500 JSON without exposing private test-error content. Errors after headers were sent were correctly forwarded. The temporary application was closed and is not included in production code.
- Development and compiled verification processes were stopped. No tsconfig, lint ignores, dependencies, or check scripts were changed.
- Verification used real HTTP requests and Node's built-in assertions, without adding a test framework or production test routes.

### Development Startup Environment Error

The first `npm run dev` attempt in the restricted execution environment failed with this original diagnostic:

```text
Error: EMFILE: too many open files, watch
    at FSWatcher._handle.onchange (node:internal/fs/watchers:269:21)
Emitted 'error' event on FSWatcher instance at:
    at FSWatcher._handle.onchange (node:internal/fs/watchers:275:12)
errno: -24, syscall: 'watch', code: 'EMFILE', filename: null
```

The failure occurred in Node's file watcher with no project source location; typing and architectural checks had already passed.
After changing only the tool's execution permissions, the identical `npm run dev` command started successfully and passed HTTP verification.
This was treated as an execution-environment limitation. Code, type configuration, rules, and ignore entries were not changed to bypass checks.

### Final Review Fix

- Express 5 also invokes the `app.listen` callback on listener failure. The initial `src/server.ts:10` ignored that case and printed a false success message despite correctly exiting with failure.
- Added an occupied-port assertion that stdout must not contain a startup-success message on failure. The first run failed with `ERR_ASSERTION` at temporary check `[eval1]:13:10`, capturing the misleading listener address.
- Moved the success log to `server.once('listening')` while retaining the error event handler, without changing scripts or configuration.
- Clarified in README that the application can exit while the development watcher parent continues waiting.
- The same occupied-port assertion then passed: stdout was empty, stderr contained EADDRINUSE, and the exit status was 1.
- After the fix, `npm run check` and `npm run build` passed. Both final development and compiled entry points were rechecked for health `200`, a current ISO timestamp, and the shared 404 response. All passed, and verification processes were stopped.
- An independent agent reviewed the final code and found no Critical or Important issues. That agent review remained separate from human code review.

## Final Human Review and Documentation Language

- The user personally reviewed the generated code and confirmed that there were no concerns.
- At the user's request, the rules, README, verification record, and companion implementation plan were translated into English.
- The translation preserves the approved constraints, historical diagnostics, and observed results. Application source and behavior were not changed.
