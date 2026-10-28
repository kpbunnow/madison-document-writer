# Independent test seam migration

The owner-requested maintainability plan keeps every historical assertion while
moving checks from implicit application-bundle names to explicit owner factories.
This is a test migration, not replacement of the browser harness or its production
integration coverage.

## Inventory and guard

`node tools/test_seams.cjs` prints a read-only JSON inventory of maintained JS/CJS
tests and fixtures, excluding inert reference snapshots. Local require dependencies
are followed so a suite calling bundle_test is included even without a direct eval.
It records direct eval,
Function constructors, VM evaluation, browser evaluation and the 74 fields retained
by the current test-only core hook. Constant string concatenations and String.raw payloads are folded before matching
hook bindings, so formatter-split test code remains visible. Matches are candidate consumers,
not proof of execution or proof that an unmentioned hook is dead.

The initial inventory has 91 files that read an application bundle and evaluate
code, 59 files with isolated owner/VM evaluation and 32 files with browser evaluate
calls. These are source-file categories, not suite/coverage counts, and overlap.
The complete per-file inventory is reproducible; the legacy evaluator baseline is
`tests/fixtures/test-seam-baseline.json`.

`audit_test_seams.js` rejects new/worsened whole-application evaluation and requires
lowering the baseline as files migrate. Isolated owner construction through explicit
services is allowed. Existing production browser checks retain their own role.

## Migration rules

- Move one suite to its real public owner factory with explicit test services.
- Preserve every assertion's meaning and list old/new access in its PR.
- Keep live arrays, lazy values and mutable test overrides observable at their
  original checkpoints; do not silently replace them with captured namespaces.
- Retire a test-only retained binding only after checking all direct, helper and
  browser consumers. Text search alone cannot establish that it is unused.
- Keep the full gate and source-bound evidence on the final committed PR head.

The new maintainability tests already construct focused screen, event, validation,
pagination and Reports owners independently. Their frozen pre-refactor functions
provide differential expectations without booting Writer or creating production
hooks. The existing 91 application evaluators remain migration work; this inventory
does not claim M6 is complete.
