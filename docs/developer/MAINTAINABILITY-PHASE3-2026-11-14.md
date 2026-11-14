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
