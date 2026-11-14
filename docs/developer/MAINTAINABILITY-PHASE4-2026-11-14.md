# Maintainability Phase 4 — the seven identified test migrations (2026-11-14)

Owner-authorized continuation of the 90+ maintainability plan after Phase 3 (PRs #517–#520). Starting main: `8f3071ee855cbc2d4147d6282b560cc537a1bff1`. Its post-merge Full gate, browser and regression checks, CodeQL and Windows recovery all passed. R82, helper build 83, authoring 16, case schema 5, summary 6 and backup 2 stay unchanged. No release is packaged or deployed. This records implementation evidence, not maintainability points or City acceptance.

## Classification revalidated

`tests/fixtures/test-seam-baseline.json` on the starting main classified exactly the plan's seven files as migratable:

| File | Evaluations | Recorded owner |
| --- | ---: | --- |
| `audit_feature_accela_import.js` | 7 | Accela import: 23 private bindings of one owner |
| `audit_import_r13.js` | 1 | Accela import: `accelaPlan`, `acceptAccela`, `sqlReport` |
| `audit_lookup.js` | 1 | Accela import lookup |
| `audit_r36.js` | 1 | Accela import: `accelaTable`, `accelaPlan`, `acceptAccela` |
| `audit_r37.js` | 1 | Accela import lookup: `findDatabaseCase`, `accelaPlan` |
| `audit_r59_import_selection.js` | 1 | Accela import: selection, `accelaPanel` |
| `audit_safety.js` | 1 | Shared case comparison: `compareSharedCase`, `resolvedCaseFields` |

Reading the suites showed that the recorded owners undercount what they exercise.

- **Wider scenarios.** Several scenarios run through issuance, reinspection, follow-up drafting and the workspace click router, not only the import owner.
- **No unclassified evaluators.** None is a reason to reclassify a file as integration.
- **Every hook is public.** Each binding the suites use is a public member of a real owner factory, so they can be migrated to those owners.

## Delivery

| Package | Scope | PR |
| --- | --- | --- |
| E1 | Owner workflow fixtures; `audit_r36`, `audit_r37`, `audit_lookup`, `audit_r59_import_selection`, `audit_safety`; mutation evidence | this PR |
| E2 | `audit_import_r13`, `audit_feature_accela_import` | pending |

## E1 — method

Two fixtures compose the real owners each scenario's outcome depends on. They do it the way `app_core.js` does: the same factories, the same service names and late-bound service getters. Each call evaluates fresh modules, so module state, `WriterState` and the jsdom document are all new. No Writer startup runs and no test hook is used.

- **`tests/fixtures/import_workflow.cjs`** composes the real owners for:
  - import and import events, plus the workspace click router, registered in core's order;
  - snow cases, citation pricing, the reviewed library, court numbering and record integrity;
  - document creation (`createEditorScreens().newDoc`) and the reinspection owner;
  - reinspection entry, new documents, the worksheet workflow and case status;
  - working papers, the address parser and recipient workflow, and visit recording;
  - test-build issuance (`initTestFixtures().issueDocument`), with the real event log and projection.
- **`tests/fixtures/shared_case_workflow.cjs`** composes the real language-catalog owner, which holds shared-case comparison, field resolution and workspace patch staging. It adds the real record-integrity, working-papers and draft-persistence owners.
- **`tests/fixtures/bounded_services.cjs`** bounds every other peer. A test supplies an implementation through `bound`, and owners read the binding when called, so a test can replace it at any point as the old global reassignments did. An unbound use fails naming the service. Grouped peers are bounded per member.

These fixtures do the following:

- **Initial state.** They start from the same initial values `app_core.js` assigns to the fields these owners read. An uninitialized `LOOKUP_SERIAL` would otherwise silently disable the lookup completion guard.
- **Build mode.** They use the test build the old suites ran against (`__TEST_BUILD__`), where the helper transport accepts a missing session token.
- **Entry fields.** They check that their import entry-field list matches `app_core.js`.
- **Print sources.** These are the one bounded owner output. The document body is composed in `app_core.js`, so issuance records a deterministic stand-in snapshot. No migrated assertion depends on its content. The lookup and selection suites still verify that a refused import leaves issued history and frozen sources unchanged.

## E1 — correspondence

Every original `assert.*(…)` and `ok(…)` call was compared as an AST, ignoring positions, against its migrated version. All are identical and in the same order. The only edits are setup and teardown: old reassignments of page globals become `h.bound.*` rebindings, and the closing `eval` of the bundle becomes a direct call.

| Suite | Assertion calls (original → migrated) | Runtime checks | Bounded peers actually used |
| --- | --- | ---: | --- |
| `audit_r37.js` | 18 → 18, identical | 18 | helperJSON, isLocked, render, saveDrafts, scheduleDraftSave, toast |
| `audit_r36.js` | 28 → 28, identical | 28 | isLocked, render, saveDrafts, toast |
| `audit_lookup.js` | 23 → 23, identical | 25 | freezeSources, helperJSON, render, saveDrafts, scheduleDraftSave, toast |
| `audit_r59_import_selection.js` | 24 → 24, identical | 23 | freezeSources, helperJSON, render, renderKeep, saveDrafts, scheduleDraftSave, toast |
| `audit_safety.js` | 16 → 16, identical | 16 | idbSet, scheduleRecoveryBackup |

Runtime checks differ from the call count where a call sits in a loop (lookup), or where the `ok` helper's own `assert.ok` is counted once (r59). Seeded inputs, scenario order and failure order are unchanged.

### Refusal coverage retained

- **r36:** Scheduled and Assist rows are discarded, and there is no Accela-document warning.
- **r37:** other, blank or missing categories do not route to a snow case.
- **lookup:**
  - malformed, wrong-case, landmark and district sources are rejected, and a result without a live source is refused;
  - a scheduled-only result is refused;
  - an unreviewed direct accept is refused, and reusing an issued initial inspection is blocked with history unchanged;
  - an unavailable share blocks, and so do duplicate shared files and a filename/content mismatch;
  - a database failure keeps the previous review, and a cancelled late response changes nothing.
- **r59:**
  - a hidden used result cannot be selected, and a selection that became hidden is cleared;
  - the blank candidate is refused, and a non-candidate row is refused;
  - shared checks started for an earlier selection never import the current one (two orderings).
- **safety:**
  - a missing choice and a wrongly typed merge value throw;
  - a storage failure commits nothing and releases the patch lock.

### Negative mutation evidence

`tests/unit/audit_owner_migration_mutations.js` runs each migrated suite unmodified, then again with one deliberate regression in the rule it guards. The edit is applied exactly once to the compiled owners. Each mutated run fails on the assertion for that rule:

| Suite | Regression | Detected by |
| --- | --- | --- |
| `audit_r37.js` | Record Category no longer makes a snow case | the snow-route assertion |
| `audit_r36.js` | Scheduled rows are no longer hidden | the discarded-rows deep-equality |
| `audit_lookup.js` | duplicate shared files no longer refused | "Duplicate shared case files block creation" |
| `audit_r59_import_selection.js` | selection no longer advances the selection serial | "A listed candidate can be selected" |
| `audit_safety.js` | a reviewed merge value is replaced by the shared value | the merged-owner assertion |

### Hooks

No retained test hook was retired. Candidate consumers were compared for all 44 retained fields before and after E1, using the folded inventory in `tools/test_seams.cjs`. No field lost its last consumer. `worksheetCheckPanel` had no candidate consumer before E1 either, and remains for the separate review its retirement needs. The seam baseline drops the five migrated entries, and `audit_test_seams.js` passes.

## E1 — verification

- The five migrated suites pass: r37 and r36, lookup with 25 checks, r59 with 23, and safety.
- `audit_owner_migration_mutations.js`: five of five regressions detected.
- `audit_test_seams.js`: passes. The whole-application evaluator files drop from 67 to 62 (the 91 in `TEST-SEAMS.md` is that inventory's original figure), and isolated evaluators number 168.
- Formatting, ESLint, the repository inventory audit and the release-input audit: recorded in the PR.
- GitHub Full gate, PR format, CodeQL and Windows recovery are required on the exact head before merge.

No City, staff, legal or native acceptance is claimed.
