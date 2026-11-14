# Maintainability Phase 3 — JavaScript change locality and state boundaries (2026-11-14)

Owner-authorized continuation of the 90+ maintainability plan after Phase 2 (PRs 513–516). Starting main: b99ac6f5c2cd3f3e5fff609b0f4c0e78b45d7f3b. Its post-merge Full gate, browser and regression checks, CodeQL and Windows recovery all passed. R82, helper build 83, authoring 16, case schema 5, summary 6 and backup 2 stay unchanged. No release is packaged or deployed. This records implementation evidence, not maintainability points or City acceptance.

## Phase 2 review before Phase 3

Each Phase 2 extraction was compared line by line against the code it replaced:

- integrity verification phases;
- issuance and cash validation;
- index metadata and final exclusions;
- parcel history;
- projection value primitives;
- pricing resolution;
- prior offenses.

Check order, short-circuiting, exception classes and messages, eager historical fallback transformation, the per-operation seen-citation set and call-time policy reads all match. The ECMAScript whitespace literal moved to `projection_values.py` unchanged, code point for code point. Every new helper module is declared in both runtime manifest sections and in the source inventory. The tool changes bind results to the measured source and reject unknown suites and mutants. The Phase 2 suites pass on main.

No behavior defect was found. Two record defects are corrected here:

- The H3/H4 status rows in the Phase 2 record still read "gate pending". Both merged in #516.
- The Radon compatibility docstring in `tools/maintainability_py.py` still named `case_projection.py`. The separator literal now lives in `projection_values.py`, the only maintained Python file the escaped-copy treatment applies to. The treatment and its equivalence checks are unchanged.

## Workflow locality census (pre-edit record)

`node tools/workflow_locality.cjs` measures the workflows configured in `tools/workflow-locality.json`. It identifies functions by the lexical identities the complexity ratchet uses. Nested functions are part of their owner unless listed separately. The census is syntactic, and it counts four things:

- **Peers:** semantic dependencies reached through `services`. A grouped service counts each operation (`inspection.validISO`), so grouping cannot hide them.
- **Live state:** members read or written on the live-state modules (`*_state.js`, `state.js`), with writes listed separately.
- **Live queries:** references to `writer_queries.js`, whether called or passed on to a calculation as an explicit lookup. Some queries initialize shared state (`eventsFor`).
- **DOM:** references to browser globals.

**Mutable peer access** is peers plus live-state members plus queries. **Calculation** figures cover the functions in the calculation role. **Totals** unite every role, including any new fact provider or coordinator, so moving a dependency into a provider still counts against the workflow.

The pre-edit census was recorded from untouched main in `maintainability/locality-baseline-2026-11-14.json` before any workflow edit. `tests/unit/audit_workflow_locality.js` refuses any later calculation or total figure above it.

| Workflow | Owner | Maintenance tasks | Calculation access | Workflow total |
| --- | --- | --- | ---: | ---: |
| document-eligibility | `new_documents.js` | Accela status rules, follow-up limits, issue lifecycle faults | 8 | 8 |
| followup-drafting | `reinspection.js` | Worksheet checks, carried items/dues/notes, follow-up refusals | 17 | 29 |
| correction-preparation | `correction_preparation.js` | Comparison fields, readiness checks, visit patch | 11 | 17 |
| live-field-repaint | `app_screens.js` | When a passive repaint keeps the field being typed in; caret/selection | 4 | 5 |
| import-plan | `accela_import.js` | Imported inspection selection; import readiness | 5 | 22 |

What each calculation phase reaches before editing:

- **document-eligibility:**
  - six live queries: `doc`, `docsFor`, `isReferredCase`, `openItems`, `recordHead`, `unchecked`;
  - two peers: `sourceDocFor`, `worksheetFaults`.
- **followup-drafting:**
  - eleven peer operations: ten inspection and authoring operations, plus `ui.toast`;
  - six live queries.
- **correction-preparation:**
  - nine live queries;
  - `workspaceState.CASEDIR`;
  - `services.today`.
- **live-field-repaint:**
  - `editor.modal`, `editor.picker`;
  - `isLocked`, `window.getSelection`.
- **import-plan:**
  - two peers, one import-state serial and two draft queries. Earlier work (B5) already separated these phases.

### Locality targets

- **document-eligibility, followup-drafting, correction-preparation:** decisions become pure calculations over explicit per-operation facts, built by one named provider. Each workflow needs at least 20% fewer calculation-phase mutable peer accesses, with no growth in its total. Existing authorities keep their timing:
  - expected-head comparison, worksheet faults and source-change checks still run on every attempt;
  - nothing is cached across asynchronous work.
- **live-field-repaint:** the keep-editing decision becomes a pure calculation. DOM swap, focus and selection effects stay ordered in the coordinator. Native Undo, paste, selection and listener lifetime must not change.
- **import-plan:** recorded for comparison. No regression.

## Complexity starting point

| Measurement | Plan baseline | Starting main | Target |
| --- | ---: | ---: | --- |
| JS functions above complexity 10 | 261 | 261 | ≤ 130 |
| JS functions above complexity 20 | 0 | 0 | 0 |
| Long JS factories (> 80 nonblank/noncomment lines) | 32 | 32 | ≤ 20, by cohesive extraction |
| JS nesting above 4 | 0 | 0 | 0 |
| Import cycles | 0 | 0 | 0 |

## Delivered work

| Package | Scope | PR |
| --- | --- | --- |
| D0 | Phase 2 review, workflow locality census, pre-edit record | #517 (merged) |
| D1 | Correction preparation calculations over explicit lookups | #518 (merged) |
| D2 | Document eligibility, follow-up drafting and repaint decisions | #519 (merged) |
| D3 | Complexity batch over 20 owners, change exercises, this record | this PR |

Each workflow extraction follows the same pattern:

- **Retained original.** The original owner is kept as a hash-checked fixture, committed before the production change.
- **Calculations.** The new calculations take the draft or visit and an explicit lookup view.
- **Provider.** One named provider per workflow builds that view. Each lookup resolves its service binding or live read when called, at the original point and in the original order. Laziness and short-circuits are unchanged.
- **Public interface.** Public operations, lifted-splice names and signatures are unchanged.
- **Authorities.** Expected-head comparison, worksheet faults, source changes, eligibility and the case-folder check run on every attempt. Nothing is cached across asynchronous work.

## Workflow locality results

| Workflow | Calculation access (before → after) | Workflow total | Calculation functions |
| --- | ---: | ---: | ---: |
| document-eligibility | 8 → 0 | 8 → 8 | 6 → 12 |
| followup-drafting | 17 → 0 | 29 → 29 | 6 → 19 |
| correction-preparation | 11 → 0 | 17 → 17 | 6 → 22 |
| live-field-repaint | 4 → 0 | 5 → 5 | 1 → 3 |
| import-plan (comparison) | 5 → 5 | 22 → 22 | 6 → 6 |

In the four changed workflows, calculation-phase mutable peer access falls by 100%. The target was at least 20%.

Workflow totals are unchanged, and that is deliberate. Every live read is still counted at its provider or coordinator. `tests/unit/audit_workflow_locality.js` now refuses any pre-edit dependency that leaves a workflow's census without a recorded removal. All five workflows keep exactly their pre-edit dependency sets.

That guard had a real case to catch. When the import share phases were split, the import-plan total briefly fell from 22 to 19, only because the new phases were not yet listed. They are now listed as coordinators, and the total is back to 22.

No dependency was removed by renaming, bagging or an uncounted façade. The improvement is that the decisions can now be read, tested and changed with a plain lookup object, without the workspace, the services object or the whole owner.

## Change exercises

`tests/unit/audit_locality_change_exercises.js` makes two realistic rule changes to in-memory copies of the modules. Each is verified at the calculation level only:

- live workspace state is poisoned, so any read or write throws;
- no services object exists;
- a plain object supplies the lookups.

| Exercise | Change | Verified | Owners/fixtures needed before → after |
| --- | --- | --- | --- |
| A | A correction explanation needs at least 20 characters (was 10) | 600 generated drafts; the reason check changes only for 10–19 characters (122 changed), every other check identical | Whole correction owner, workspace DOCS/CASES/REINSP/EVENTS/CASEDIR and a services object → `correctionCheckList` with a plain view |
| B | The compliance refusal says what to do with the remaining items | 600 generated permission scenarios; only the compliance refusal changes, every other refusal and permission identical | Whole reinspection owner with `ui`/`inspection`/`authoring` services and workspace state → `followupDraftRefusal` with a plain view |

Neither exercise needed a browser, the services object or live state. Before Phase 3, both checks were reachable only through owners that read live workspace collections and a services object.

## Complexity results

| Measurement | Plan baseline | Now | Target |
| --- | ---: | ---: | --- |
| JS functions above complexity 10 | 261 | 129 | ≤ 130 (met) |
| JS functions above complexity 20 | 0 | 0 | 0 |
| Long JS factories (> 80 lines) | 32 | 30 | ≤ 20 (not reached) |
| JS nesting above 4 | 0 | 0 | 0 |
| Import cycles | 0 | 0 | 0 |

These owners now have every function at complexity 10 or below:

- the workflow owners: `correction_preparation`, `new_documents`, `reinspection`, `app_screens`;
- `document_render`, `snow_cases`, `reports_screens`, `deposit_step`, `case_status`, `inspection_history`, `accela_import`, `accessibility`, `reports_services`;
- `case_file_rules`, `document_delivery`, `editor_screens`, `language_discovery`, `saved_work`, `citation_workflow`, `administration`.

The splits follow three rules:

- **Builders** become same-order sub-builders. Concatenation is identical, and all 69 historical print variants stay byte-exact.
- **Handlers** become ordered guard and effect phases.
- **Object construction** uses spread phases that keep key order and `uid` call order.

Long-function baselines fell for these factories:

| Factory | Lines before → after |
| --- | --- |
| `createCorrectionPreparation` | 233 → below the limit |
| `initAdministration` | 94 → below the limit |
| `createAccessibility` | 187 → 173 |
| `createDocumentDelivery` | 176 → 150 |
| `createReportsServices` | 167 → 138 |

### Targets not reached and remaining debt

- **Long factories: 30, against an aim of 20.** The remaining factories mostly hold ordered listener registration and instance state. The plan allows constructors to keep these, and splitting them further would not improve comprehension. Each needs its own cohesive extraction; none is claimed here.
- **Remaining complex functions.** These owners still have functions above 10, chiefly:
  - pricing: `citation_policy`, `citation_pricing`;
  - JS projection: `case_projection`;
  - catalog review: `language_catalog`.

  They carry JS/Python parity and historical pricing contracts, so they are left for separately reviewed work with their own differential evidence.
- **Python:** unchanged in Phase 3.
- **Service-area coupling:** unchanged. `app_core.js` was not edited.

## Defects found before commit

The comparison suites caught four behaviour differences introduced during extraction, before any was committed:

- **Due-spacing service order.** The extracted due-spacing lookup resolved its service after evaluating its argument; the original resolved it before. Ordered service-get comparison caught it; the lookup now keeps the original expression.
- **Extra case read.** The split case-file validator read `f.case` one extra time. The retained-validator comparison caught it through its observed-read check.
- **Shadowed name.** A generic helper named `plural` would have shadowed an existing page-global name. It was renamed before commit.
- **Census omission.** The census omission described above, which led to the new anti-omission guard.

## Verification

Each package records its own targeted results, local fast-tier result and exact-head GitHub checks. The fast tier gives reduced coverage only and is not merge evidence.

This package ran:

- every owner's referencing suites, all passing;
- the full historical print-variant comparison (69 variants exact);
- the retained-reference comparisons for correction, eligibility/follow-up, case-file validation, deposit completion, delivery, reports and import;
- the census and change exercises;
- the complexity ratchet, ESLint and the formatter.

No City, staff, legal or native acceptance is claimed. Phase 3 does not by itself establish an overall maintainability score.
