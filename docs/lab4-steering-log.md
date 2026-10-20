# Lab 4 Prompt Steering Log

Failure loops and hallucinations encountered while an AI coding agent (Claude Code) implemented the
CampusHub reservation engine, and how each was steered back on course.

Context the agent worked from: `AGENTS.md`, `docs/openapi.json`, `src/models/*.model.ts`, and the
Lab 2/3 code already in the repository.

## How the Steering Actually Happened — Read This First

All three incidents below are real: the code, the error output, the root causes, and the fixes are
genuine and reproducible from this repository. **The steering, however, was not typed at the moment
each failure appeared.** No student-authored prompt was issued mid-loop for any of the three.

What recovered each one was steering that had been **pre-committed into `AGENTS.md`** in earlier
labs, enforced by mechanical gates the agent was required to run. `AGENTS.md` §7 states verbatim:

> When `npm run check` or `npm run build` fails, perform these steps in order: 1. Show the failed
> command, original diagnostics, specific file paths, line and column numbers, and error codes or
> rule names. … 2. Analyze the root cause … 3. Fix the underlying type handling, responsibility
> placement, or code, then rerun the failed command and necessary checks.
>
> **Never privately change `tsconfig.json` or ESLint ignore entries to make a failure appear to
> pass.** Do not lower rule severity, add `eslint-disable`, narrow the checked file scope, use
> `@ts-ignore`/`any`, or change scripts to skip checks.

This is the finding worth recording for an agent-driven SDLC: **a standing context rule is a
steering instrument, and it fires faster than a human can.** The second paragraph above is what
actually blocked Incident 1's failure loop — not a prompt, but a pre-existing prohibition on the two
"fixes" the agent would otherwise have reached for. The cost is that this steering is generic; it
catches _classes_ of bad repair without knowing anything about Mongoose.

Each incident therefore records two things, distinguished explicitly:

- **What actually intervened** — the real mechanism, stated plainly.
- **Reactive prompt (not issued)** — the prompt that would have been needed had the standing rule
  not caught it. Clearly labeled as unused, written during the retrospective, and included because
  the exercise asks what steering the loop _requires_. It is not a transcript.

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
  `node_modules` — the defining shape of a package-version hallucination: the symbol is real,
  plausible, and documented everywhere, just not in the pinned version.

  The compiler's own suggestion is what turns one error into a loop. Following "Did you mean to use
  `import FilterQuery from 'mongoose'`" produces a default import of a non-existent binding, which
  fails differently; the next plausible repair — deleting the annotation or widening it to `any` —
  silences the error while defeating `@typescript-eslint/no-explicit-any`. Two of the three
  "obvious" next moves make the code worse while making the message change, which is exactly how an
  agent convinces itself it is making progress.

- **Remediation Prompt:** _No prompt was issued._ `AGENTS.md` §7's prohibition on `any`,
  `@ts-ignore`, and `eslint-disable` removed both bad repairs before they could be attempted, which
  left reading the installed types as the only permitted route. The agent searched
  `node_modules/mongoose/types/` for the filter parameter type in the `Model.find` overloads and
  found the real name there.

  _Reactive prompt (not issued) — what would have been needed without that standing rule:_

  > Do not guess the Mongoose filter type name and do not follow the compiler's `import X from`
  > suggestion — that is a default-import dead end. This project pins mongoose 9.10.2, and the type
  > may have been renamed since v8. Read the installed type definitions and tell me the real name
  > before editing: grep the filter parameter type in the `Model.find` overloads in
  > `node_modules/mongoose/types/models.d.ts`, then find where that type is declared in
  > `node_modules/mongoose/types/query.d.ts`. Use the exact name you find there. Do not introduce
  > `any`, a type assertion, or an `eslint-disable` to make this compile.

- **Resolution:** The `Model.find` overloads take `filter: QueryFilter<TRawDocType>`
  (`node_modules/mongoose/types/models.d.ts:892`), and the type is declared as `type QueryFilter<T>`
  at `node_modules/mongoose/types/query.d.ts:51`, inside `declare module 'mongoose'`, so it is
  importable. Both imports were renamed. Verified by `npm run typecheck` passing with no
  diagnostics, `npm run lint` clean at `--max-warnings=0` with no suppressions added, and the full
  suite at 32/32. This incident was additionally re-staged after the fact — the hallucinated import
  was reintroduced and `npm run typecheck` re-run — to confirm the error text above is reproducible
  and not reconstructed from memory.

---

### Incident 2: Copying a Working Seed Pattern into a Schema That Rejects It

- **Initial Agent Output:** `PATCH /reservations/{id}/confirm` can only act on a `PENDING`
  reservation, and no HTTP route creates one, so `npm run seed` had to insert a PENDING fixture.
  The agent reached for the pattern already proven in the same repository — `seedResources`, which
  upserts with `findOneAndUpdate(..., { upsert: true, returnDocument: 'after', runValidators: true })`
  — and began writing `seedReservations` as a direct copy of it.

- **Root Cause:** The pattern is correct for `Resource`, whose fields validate independently, and
  wrong for `Reservation`, whose `endTime` validator is a _cross-field_ check reading
  `this.startTime` (`src/models/Reservation.model.ts:26`). Under `runValidators: true` on an update,
  Mongoose binds `this` to the **Query**, not to a document, so `this.startTime` is `undefined`,
  `undefined instanceof Date` is `false`, and the validator rejects every seed. The agent
  pattern-matched on "this repo already seeds entities like this" without checking whether the
  target schema's validators survive the update-validator execution context.

  This one matters because the failure is invisible to the type system: it compiles, it lints, it
  matches house style, and it fails only at runtime with a message that accuses the data
  (`endTime must be later than startTime`) when the data is correct. An agent reading that message
  is led toward "fix the timestamps" — a loop chasing a non-existent bug in the fixture — rather
  than toward the validator's execution context.

- **Remediation Prompt:** _No prompt was issued._ This one was caught during design rather than by a
  gate: the agent re-read `Reservation.model.ts` before copying the pattern and recognized that the
  `endTime` validator depends on a sibling path. The relevant standing rule is `AGENTS.md` §7's
  "Never … lower rule severity" and §1's "never silently remove constraints … to eliminate check
  failures", which rule out the tempting shortcut of weakening or deleting the validator.

  Because catching something by reading is weaker evidence than catching it by running it, the
  diagnosis was **proven rather than asserted**: a throwaway script attempted the copied
  `findOneAndUpdate` version against a scratch database and produced

  ```
  findOneAndUpdate + runValidators: FAILED -> Validation failed: endTime: endTime must be later than startTime.
  ```

  on a fixture whose `startTime` is `2099-12-31T09:00:00Z` and `endTime` is `2099-12-31T10:00:00Z` —
  which is valid. The script was deleted afterward.

  _Reactive prompt (not issued) — what would have been needed had it reached runtime:_

  > Before copying `seedResources` into `seedReservations`, check the Reservation schema's
  > validators. The `endTime` validator reads `this.startTime`. State what `this` is bound to when
  > Mongoose runs validators during `findOneAndUpdate` with `runValidators: true`, versus during
  > `document.save()`. If the update path cannot see sibling fields, do not use it — use a path that
  > runs full document validation, and do not weaken or remove the validator to make seeding work.

- **Resolution:** `seedReservations` loads or constructs the document and calls `document.save()`,
  which runs validators with `this` bound to the document. Verified by `npm run seed` inserting the
  PENDING fixture (shown in `docs/lab4-verification.md`), by
  `PATCH /reservations/000000000000000000000201/confirm` returning `200` with `"status":"CONFIRMED"`,
  and by the Lab 4 suite seeding two PENDING reservations.

---

### Incident 3: A Generated Comment Asserting Data That Did Not Exist

- **Initial Agent Output:** In the Lab 4 test covering the widened user listing, the agent wrote:

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
  bookings while the assertion on the next line expects exactly **one** (`[cancelledId]`). The
  assertion was right: `student-1` owns a single reservation at that point, because the rebooked
  slot belongs to `student-2`. The agent narrated a scenario it had drifted away from while writing
  the fixtures.

  The comment is the dangerous half. A wrong guard crashes immediately and gets fixed; a wrong
  comment compiles, passes, and is then trusted by the next reader — human or agent — as a statement
  of intent. Had the assertion later needed changing, that comment would have argued for the wrong
  expected value. Note also what the test runner did **not** catch: it flagged the crash, and said
  nothing about the false comment. Only reading the diff caught that.

- **Remediation Prompt:** _No prompt was issued._ The crash was surfaced by `npm test`, which
  `AGENTS.md` §8 requires before any completion claim; the false comment was caught by rereading the
  block while fixing the crash. No standing rule covers comment accuracy — this is a genuine gap in
  the repository's steering, and the gates would have shipped that comment.

  _Reactive prompt (not issued) — what would have been needed:_

  > Two problems in this block. `object()` asserts `!Array.isArray(value)`, so `object(all.body)`
  > cannot work on a list — index the array first, then narrow the element. Separately, the comment
  > says "both of student-1's bookings" but the assertion expects exactly one id. Re-derive from the
  > fixtures which reservations `student-1` actually owns at this point, then make the comment state
  > that. Do not adjust the assertion to match the comment — the assertion is the claim about
  > behavior, and the comment must follow it.

- **Resolution:** The array is indexed before narrowing (`object(all.body[0])` behind an
  `Array.isArray` check), and the comment now states what the assertion verifies: that the cancelled
  booking is still listed rather than disappearing from the student's history. Verified by the Lab 4
  suite passing 11/11 and the whole suite at 32/32.

---

## What This Says About Steering an Agent

The three incidents share one root: the agent produced output that was _plausible_ — a real Mongoose
type, a pattern proven elsewhere in this repository, a sentence describing a reasonable test — and
plausibility was the only thing checking it. None was caught by the agent rereading its own work
unprompted.

Three conclusions, including an uncomfortable one:

1. **Steering can be pre-committed.** The rule that defused Incident 1 was written in an earlier lab
   and fired without anyone watching. Banning the _class_ of bad repair (`any`, `@ts-ignore`,
   `eslint-disable`, weakening a validator) is more durable than correcting instances, because it
   closes the escape routes an agent takes when an error proves stubborn — and it works while the
   developer is away from the keyboard.
2. **Name the evidence, not the answer.** Where a fact about an installed package version is needed,
   pointing the agent at the file to read (`node_modules/**/types/*.d.ts`) fails loudly; asking it to
   "use the right type" fails silently.
3. **The gates have a blind spot, and it is prose.** `tsc`, ESLint, and the test runner all check
   code against code. Nothing in this repository checks a comment against the code beneath it, and
   Incident 3's false comment would have shipped. The same blind spot is why the first draft of this
   very document presented its reactive prompts as though they had been issued: generated prose is
   exactly the artifact no mechanical gate inspects, which is why this version states plainly which
   prompts were used and which were not.
