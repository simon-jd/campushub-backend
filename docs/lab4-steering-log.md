# Lab 4 Prompt Steering Log

Failure loops and hallucinations encountered while steering an AI coding agent (Claude Code) to
implement the CampusHub reservation engine, and the prompt adjustments that recovered from them.
Each incident below actually occurred during Part 2; none is reconstructed or illustrative.

Context the agent worked from: `AGENTS.md`, `docs/openapi.json`, `src/models/*.model.ts`, and the
Lab 2/3 code already in the repository.

---

### Incident 1: Hallucinated `FilterQuery` Export from Mongoose

- **Initial Agent Output:** Both `listResources` and `listUserReservations` needed to build a query
  object incrementally, so the agent typed them with Mongoose's filter type and emitted
  `import type { FilterQuery } from 'mongoose';` in `src/services/resource.service.ts` and
  `src/services/reservation.service.ts`. `npm run typecheck` rejected both files:

  ```
  src/services/reservation.service.ts(2,15): error TS2614: Module '"mongoose"' has no exported
    member 'FilterQuery'. Did you mean to use 'import FilterQuery from "mongoose"' instead?
  src/services/resource.service.ts(2,15): error TS2614: Module '"mongoose"' has no exported
    member 'FilterQuery'. Did you mean to use 'import FilterQuery from "mongoose"' instead?
  ```

- **Root Cause:** `FilterQuery<T>` is the correct name in Mongoose 5 through 8, which is the
  overwhelming majority of Mongoose code written to date. This repository pins `mongoose@9.10.2`,
  where the type was renamed to `QueryFilter<T>`. The agent generated the identifier from the
  dominant pattern in its training data instead of from the type definitions actually installed in
  `node_modules`, which is the defining shape of a package-version hallucination: the symbol is
  real, plausible, and documented everywhere — just not in the pinned version.

  The compiler's own suggestion is the trap that turns a single error into a loop. Following
  "Did you mean to use `import FilterQuery from 'mongoose'`" produces a default import of a
  non-existent binding, which fails differently, and the next plausible repair — deleting the
  annotation or widening it to `any` — would have silently defeated `@typescript-eslint/no-explicit-any`
  and the project's rule against assertion-based escapes. Two of the three "obvious" next moves make
  the code worse while making the error message change, which is exactly how an agent convinces
  itself it is making progress.

- **Remediation Prompt:** The steering move was to forbid guessing and force a read of the installed
  types, naming the evidence the answer had to come from:

  > Do not guess the Mongoose filter type name and do not follow the compiler's `import X from`
  > suggestion — that is a default-import dead end. This project pins mongoose 9.10.2, and the type
  > may have been renamed since v8. Read the installed type definitions and tell me the real name
  > before editing: grep for the filter parameter type in the `Model.find` overloads in
  > `node_modules/mongoose/types/models.d.ts`, then find where that type is declared in
  > `node_modules/mongoose/types/query.d.ts`. Use the exact name you find there. Do not introduce
  > `any`, a type assertion, or an `eslint-disable` to make this compile.

- **Resolution:** The `Model.find` overloads take `filter: QueryFilter<TRawDocType>`
  (`node_modules/mongoose/types/models.d.ts:892`), and the type is declared as
  `type QueryFilter<T>` at `node_modules/mongoose/types/query.d.ts:51`, inside
  `declare module 'mongoose'`, so it is importable. Both imports were renamed to `QueryFilter`.
  Verified by `npm run typecheck` passing with no diagnostics, `npm run lint` clean at
  `--max-warnings=0` with no suppressions added, and the full suite at 32/32.

---

### Incident 2: Copying a Working Seed Pattern into a Schema That Rejects It

- **Initial Agent Output:** `PATCH /reservations/{id}/confirm` can only act on a `PENDING`
  reservation, and no HTTP route creates one, so `npm run seed` had to insert a PENDING fixture.
  The agent reached for the pattern already proven in the same repository — `seedResources`, which
  upserts with `findOneAndUpdate(..., { upsert: true, returnDocument: 'after', runValidators: true })`
  — and started writing `seedReservations` as a direct copy of it.

- **Root Cause:** The pattern is correct for `Resource`, whose fields validate independently, and
  wrong for `Reservation`, whose `endTime` validator is a _cross-field_ check reading
  `this.startTime` (`src/models/Reservation.model.ts:26`). Under `runValidators: true` on an update,
  Mongoose binds `this` to the **Query**, not to a document, so `this.startTime` is `undefined`,
  `undefined instanceof Date` is `false`, and the validator rejects every seed. The agent pattern-
  matched on "this repo already seeds entities like this" without checking whether the target
  schema's validators survive the update-validator execution context.

  This one is worth recording precisely because the failure is invisible to the type system: it
  compiles, it lints, it matches house style, and it fails only at runtime with a message that
  accuses the data (`endTime must be later than startTime`) when the data is in fact correct. An
  agent reading that message is led straight toward "fix the timestamps" — a loop chasing a
  non-existent bug in the fixture — rather than toward the validator's execution context.

- **Remediation Prompt:** Rather than let it run and then debug the misleading message, the agent
  was steered to check the execution context first and to prove the claim empirically:

  > Before copying `seedResources` into `seedReservations`, check the Reservation schema's
  > validators. The `endTime` validator reads `this.startTime`. State what `this` is bound to when
  > Mongoose runs validators during `findOneAndUpdate` with `runValidators: true`, versus during
  > `document.save()`. If the update path cannot see sibling fields, do not use it — use a path that
  > runs full document validation, and do not weaken or remove the validator to make seeding work.
  > Then prove it: write a throwaway script that attempts the `findOneAndUpdate` version against a
  > scratch database and show me the actual error.

- **Resolution:** The throwaway probe confirmed the diagnosis rather than leaving it a plausible
  story — the copied pattern fails with:

  ```
  findOneAndUpdate + runValidators: FAILED -> Validation failed: endTime: endTime must be later than startTime.
  ```

  on data whose `startTime` is `2099-12-31T09:00:00Z` and `endTime` is `2099-12-31T10:00:00Z`, which
  is valid. `seedReservations` was therefore written to load or construct the document and call
  `document.save()`, which runs validators with `this` bound to the document, and the probe script
  was deleted. Verified by `npm run seed` inserting the PENDING fixture (shown in
  `docs/lab4-verification.md`), by `PATCH /reservations/000000000000000000000201/confirm` returning
  `200` with `"status":"CONFIRMED"`, and by the Lab 4 suite seeding two PENDING reservations.

---

### Incident 3: A Generated Comment Asserting Data That Did Not Exist

- **Initial Agent Output:** In the Lab 4 test that checks the widened user listing, the agent wrote:

  ```ts
  // Both of student-1's bookings are present, including the cancelled one.
  assert.deepEqual(ids(all.body), [cancelledId]);
  assert.equal(object(object(all.body)[0]).status, 'CANCELLED');
  ```

  The run failed inside the shared helper, not in an assertion about the API:

  ```
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
    ok(typeof value === 'object' && value !== null && !Array.isArray(value))
      at object (src/tests/contract.helper.ts:16:10)
      at TestContext.<anonymous> (src/tests/lab4.test.ts:276:31)
  ```

- **Root Cause:** Two distinct context-degradation failures in three lines. First, `object()` is a
  narrowing guard that _deliberately rejects arrays_, and the agent wrapped an array in it anyway
  (`object(all.body)`) while reusing a helper it had written minutes earlier — it recalled the
  helper's name and forgot its contract. Second, and more serious, the comment claims **two**
  bookings while the assertion on the very next line expects exactly **one** (`[cancelledId]`).
  The assertion was right: `student-1` has a single reservation in this scenario, because the rebooked
  slot belongs to `student-2`. The agent narrated a scenario it had drifted away from while writing
  the fixtures, and that narration disagreed with the code underneath it.

  The comment is the dangerous half. A wrong guard crashes immediately and gets fixed; a wrong
  comment compiles, passes, and is then trusted by the next reader — human or agent — as a statement
  of intent. Had the assertion later needed changing, that comment would have argued for the wrong
  expected value.

- **Remediation Prompt:**

  > Two problems in this block. `object()` asserts `!Array.isArray(value)`, so `object(all.body)`
  > cannot work on a list — index the array first, then narrow the element. Separately, the comment
  > says "both of student-1's bookings" but the assertion expects exactly one id. Re-derive from the
  > fixtures above which reservations `student-1` actually owns at this point in the test, then make
  > the comment state that. Do not adjust the assertion to match the comment — the assertion is the
  > claim about behavior, and the comment must follow it.

- **Resolution:** The array is now indexed before narrowing (`object(all.body[0])` behind an
  `Array.isArray` check), and the comment was rewritten to state what the assertion verifies: that
  the cancelled booking is still listed rather than disappearing from the student's history.
  Verified by the Lab 4 suite passing 11/11 and the whole suite at 32/32.

---

## What Transferred to the Rest of the Lab

The three incidents share one root: the agent produced output that was _plausible_ — a real Mongoose
type, a pattern proven elsewhere in this repository, a sentence describing a reasonable test — and
plausibility was the only thing checking it. Each was caught by a mechanical gate rather than by
rereading the generated code: `tsc` for Incident 1, a deliberate throwaway probe for Incident 2, the
test runner for Incident 3.

Two prompting rules were applied for the remainder of Part 2:

1. **Name the evidence, not the answer.** When the agent needs a fact about an installed package
   version, the prompt points it at the file to read (`node_modules/**/types/*.d.ts`) instead of
   asking it to recall the API. "Read X and tell me what you found" fails loudly; "use the right
   type" fails silently.
2. **Refuse the error-message-shaped fix.** Compiler suggestions and runtime validator messages both
   point at the symptom. The prompts explicitly forbade the fixes that make an error disappear
   without making the code correct — `any`, assertions, `eslint-disable`, weakening a validator, or
   editing fixture data to satisfy a validator that is misreporting its own context.
