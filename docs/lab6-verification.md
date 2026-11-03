# Lab 6 — Codebase Refactoring & Context Optimization

Date: November 2, 2026 (America/Los_Angeles).

## Scope and design

Preserve the OpenAPI contract and Route → Controller → Service → Model boundaries.
Use the existing Express 5 error chain, extract reservation state into React hooks,
and share the existing type-only domain declarations. No dependencies, compiler
settings, lint exclusions, or API behavior were changed. Human review of rules and
code is still required; automated verification is not human approval.

## Part 1 — Context optimization

- Replaced repeated frontend rules in `.cursorrules` with a concise pointer to
  `AGENTS.md` and a source-first discovery policy. Existing dependency and architecture
  constraints remain in `AGENTS.md`.
- Added `.cursorignore`: dependencies, `dist/`, `build/`, coverage, maps, logs,
  lockfiles, secrets, and historical lab verification/steering logs are excluded
  from automatic context. Relevant contracts and historical evidence can still be
  read explicitly when needed.
- Codex follows the source-selection rules in `AGENTS.md`; `.cursorignore` is a
  Cursor context filter, not an access-control mechanism or a claim that every
  agent automatically honors it. Ignore configuration does not skip tests or lint.

Lightweight query run by the coding agent:

> Using only `src/`, identify the health endpoint's route → controller → service
> chain and where unexpected request errors are handled. Return source locations only.

Reproduce the bounded lookup:

```sh
rg -n 'healthRouter|healthController|getHealth|errorHandler' \
  src/app.ts src/routes/health.routes.ts src/controllers/health.controller.ts \
  src/services/health.service.ts src/middleware/errorHandler.ts
```

Source-only answer:

- `src/app.ts:11` mounts the health router under `/api/v1`.
- `src/routes/health.routes.ts:6` maps `GET /health` to `healthController`.
- `src/controllers/health.controller.ts:9` returns `getHealth()` as HTTP 200 JSON.
- `src/services/health.service.ts:3` implements `getHealth`.
- `src/app.ts:15` mounts `errorHandler`, defined in `src/middleware/errorHandler.ts:15`.

The lookup returned **877 bytes**. At measurement time, both source trees totaled
**110,426 bytes**, so selective input was **99.21% smaller** than loading all source.
A rough bytes/4 proxy is 220 versus 27,607 tokens. These are input-size estimates,
not measured model billing tokens, a controlled before/after model run, or proof of
an absolute minimum. Existing chat/rule/tool context is not included. No dependency,
build, lockfile, or historical report appeared in the query result.

Ignore patterns were checked with Git's gitignore-compatible matcher (using
`git -c core.excludesFile=.cursorignore check-ignore --no-index`): backend/frontend
node_modules, dist, lockfiles, and local environment files all matched. This verifies
pattern matching, not Cursor UI indexing telemetry.

## Part 2 — Bloat and redundancy audit

| Finding before refactoring                                                                                     | Resolution                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Controllers already had no try/catch wrappers; Express 5 forwarded promise failures                            | Retained this behavior; renamed the existing central middleware to the required `src/middleware/errorHandler.ts` and updated application/test imports |
| Axios failures were already normalized in one API function                                                     | Kept normalization there; reused `describeApiError` for booking fallback messages                                                                     |
| `App.tsx` was 176 lines and combined catalog UI with reservation fetching/mutations                            | Moved reservation operations to `useReservations`                                                                                                     |
| `BookingForm.tsx` was 139 lines (below 150), but coupled five state fields, validation, and submission with UI | Extracted `useBookingForm`                                                                                                                            |
| `UserReservations.tsx` held cancellation state and swallowed callback failures                                 | Extracted `useCancellation`; failures now have a visible fallback and the button is re-enabled                                                        |
| Frontend duplicated Resource, Reservation, creation payload, and status/type unions                            | Frontend now type-imports/re-exports backend declarations; `CreateReservationDTO` aliases `CreateReservationRequest`                                  |

Database record interfaces and service result interfaces remain separate: they
represent persistence fields and domain outcomes, rather than duplicated wire DTOs.
No generic framework, class hierarchy, or extra runtime package was added.

## Part 3 — Guided abstraction passes

The user supplied the three structured refactoring prompts in the lab brief.
They were applied with these repository-specific constraints:

1. **Backend:** keep current status/error bodies and Express 5 rejection forwarding;
   mount one `errorHandler` after routes and the 404 handler. Retain `headersSent`
   delegation and safe JSON parser errors. Do not manufacture redundant try/catch
   blocks merely to remove them.
2. **Frontend:** `client/src/hooks/useReservations.ts` owns list fetching, refresh,
   create, and cancel API operations. `useBookingForm.ts` owns validation/form state;
   `useCancellation.ts` owns pending/error state. `App` composes the list hook and
   passes its data/actions to the two components, preserving their props contracts.
   The frontend lives in `client/src`, so this is the lab's frontend `src/hooks` path.
3. **Types:** use `src/types/reservation.ts` as the single shared declaration layer.
   Type-only imports erase at build time; the browser does not import Express,
   Mongoose, or server runtime code. Existing backend `rootDir` remains unchanged.

## Verification

| Check                                                                 | Result                                                                                                 |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Backend `npm test` against isolated MongoDB                           | 32 passed, 0 failed; both live HTTP suites assert responses against `docs/openapi.json`                |
| Backend `npm run check`                                               | TypeScript, ESLint, Prettier passed                                                                    |
| Backend `npm run build`                                               | Passed                                                                                                 |
| Frontend `npm test`                                                   | 19 passed across 6 files                                                                               |
| Frontend `npm run lint`                                               | Passed without diagnostics after final hook adjustment                                                 |
| Frontend `npm run build`                                              | Passed; shared types compile successfully                                                              |
| `npx --yes @redocly/cli@2.55.0 lint docs/openapi.json --extends spec` | Passed                                                                                                 |
| `npm run dev`, port 3136                                              | Real health HTTP 200, `status: ok`, valid UTC ISO timestamp; seeded catalog HTTP 200                   |
| `npm start`, port 3137                                                | Real compiled health HTTP 200, `status: ok`, valid UTC ISO timestamp; global 404 body matches contract |

Regression tests retain the booking → conflict → cancellation flow. New tests cover
visible cancellation failure/button recovery, resetting loading/errors on student
change, ignoring stale list responses, not fetching invalid student IDs, and clearing previous-user data on a failed switch.

Test-first evidence: the cancellation failure test initially failed because no
`role="alert"` existed; the hook-switch test initially failed with `expected false
to be true` for loading. Both pass with the extracted hooks.

### Environment issues and limitations

- Initial backend tests failed under the sandbox: `listen EPERM` in
  `src/tests/errors.test.ts:11:22`, and MongoDB `connect EPERM` in
  `src/tests/lab2.test.ts:50:22` / `src/tests/lab4.test.ts:77:22`. Outside the sandbox,
  HTTP sockets worked but MongoDB returned `ECONNREFUSED` at port 27017. These were
  environment failures, not TypeScript or layering violations.
- Started a temporary MongoDB at `127.0.0.1:27018`, with data/logs under
  `/tmp/campushub-lab6-mongo`. Test suites use their own databases; manual checks used
  `campushub_lab6_manual`. Development data and `.env` were not changed.
- Backend lint's existing `dist/**` ignore does not cover `client/dist/`. After the
  frontend build, it reports `no-restricted-syntax` at the generated bundle's `1:1`
  (no stack trace). Generated client artifacts were moved to `/tmp` before rerunning
  backend checks. No source exclusions or lint rules were changed to pass checks.
  Run backend checks before building the client, or remove/move generated client
  output first. The front-end build itself was verified separately.
- An intermediate hook version triggered oxlint `react(set-state-in-effect)` at
  `client/src/hooks/useReservations.ts:31:5`. The final hook derives loading/error
  visibility from the current query associated with completed results instead; no lint
  severity or configuration was changed.
- Actual Cursor model-token telemetry was unavailable; input measurements above
  are explicitly estimates. Human review remains unrecorded.

### Independent code review

A read-only reviewer identified two additional user-switch regressions: returning
A → B → A while B was pending reused A's completed loading/error state; and a local
cancellation error survived switching students. Added tests that reproduced both
failures, then associated each response with its query identity and keyed the
reservation list component by student. Old query errors cannot update a new query's
result. The list now hides outdated rows while refreshing. A follow-up review found no
remaining important regressions.

## Submission

Repository: <https://github.khoury.northeastern.edu/postedism/campushub-backend>

The repository contains `.cursorrules`, `.cursorignore`, `AGENTS.md`,
`src/middleware/errorHandler.ts`, `client/src/hooks/useReservations.ts`, supporting
hooks, shared type imports, tests, and this report. Remote push and Canvas submission
are verified separately after committing; no submission success is inferred here.
