# Bounded follow-up to the Phase 7 audit

The strict audit improves on the original 75/100 but does **not** earn the unchanged 90-point acceptance target. This is a prepared follow-up under the plan's explicit below-target contingency, not shipped implementation or a promise of future points. Keep the original twenty criteria, dimension minimum 17/20 and criterion minimum 3/5. Do not close the target by moving thresholds, changing scope or awarding intent.

## F1 — a real checked case-store producer/consumer port

Start at `record_commit.saveCandidate`, `shared_case_storage.writeToFolder`, `helper_requests.helperJSON` and `contracts.CaseStoreRequest/CaseStoreResult`. Current type declarations alone are insufficient when the real callers remain unchecked.

Inventory actual payload/response construction and reads: retained `idempotencyEvent`, `baseRevision`, `baseCase`, case/schema/history identities, definitive versus uncertain failure, committed `file/name/revision`, independently verified proof and pending retry. Select a cohesive typed path whose producer and consumer implementations, plus a representative real composition call, compile with strict checking. Do not add an unchecked wrapper that merely passes a typed declaration around, broad `any`, casts, ignored errors or a universal services bag. Keep runtime acceptance and historical optional fields intact; helper validation still distrusts browser input.

Acceptance: strict checked entries include actual producer/consumer code; positive supported current/legacy shapes compile; malformed base/head/acknowledgment and wrong result reads fail at the real caller probe. Refused/uncertain acknowledgment retains pending work, retry uses current work/retained identity, and first failure/effect order matches the retained source. Add explicit scope/checked-logic and denominator evidence. This may strengthen contract/locality evidence; it does not establish broad Python or whole-application type assurance.

## F2 — cohesive publication-validation ownership

Review `case_store.validate_publication`, `_validate_publication_identity` and related source/visit/outcome checks, with `validate_history` and `_save_case` as retained authorities. The candidate is a coherent publication-validation operation, not one moved function or a new module for every branch. If appropriate, use a narrow publication-validation owner with explicit calendar/policy operations; document why its consumers and responsibility are cohesive.

Before extraction, retain the original and land meaningful differential tests over ordinary/correction/grouped/current/legacy/snow histories, malformed identities/sources/visits and each interrupted callback. Keep expected-head scanning, lock acquisition, merge, validation, atomic publish, receipt/registry side effects and first refusal in the existing coordinator order. Preserve issued snapshots, original pricing, due-date exceptions and the mandatory-appearance hold. Compare real locked-store refusal paths, exact messages/results, untouched inputs and writes not performed. Include deliberately bypassed source/visit/identity checks in negative detection.

Acceptance: the operation has a documented narrow API with real consumers; no new authority or security cache; retained references, source/order tests, manifest/runtime import checks and current/legacy compatibility pass. Count the coordinator **and every extracted leaf** in complexity, MI, high-risk coverage and hotspot inventory. A lower wrapper score alone earns no cohesion or decoupling point.

## F3 — close demonstrated coverage gaps

At clean audited source 6fbbe77, all 431 unit suites passed instrumented collection. Gaps remain: JS runtime statements 81.3% versus 85%; Python high-risk 85.7% statements / 82.4% branches versus 90% / 85%; Python developer 66.6% / 66.0% versus 80% / 70%. Final corrected-source receipts belong to the delivery artifact; do not relabel these earlier counts as later source.

Use per-file uncovered lines/branches to choose missing refusal/interruption outcomes, particularly helper request/publication edges and gate/release tools. Test actual orchestration in an isolated synthetic source/output tree with controlled process boundaries; do not run a nested full gate against its parent's evidence or mirror implementation text. Keep each unexecuted file and each extracted helper in its denominator. Separate unsupported Chromium/developer-JS coverage and native branches; do not infer Windows/City coverage from Linux mocks. Retain all original assertions, scenarios, timeouts and frozen references.

Acceptance: a full source-bound collection, complete requested/actual suite sets, failed/skipped/unrun accounting, subgroup sums and tool/source receipts, plus syntax-valid targeted mutants that fail for the intended missing invariant. A subset smoke or a newly smaller denominator cannot close a target.

## F4 — justify a real reduction in reasoning dependency

The selected calculation views are more testable, but total workflow dependencies and 671 cross-area references / 52 directional pairs remain. Begin with one concrete maintenance task in correction, document eligibility or follow-up drafting. Trace its complete decision/effect dependency set, not only its pure calculation. Propose a responsibility boundary and demonstrate which actual dependency/repeated responsibility becomes unnecessary and why correctness is preserved.

Expected-head/source/eligibility/worksheet faults must still be evaluated at their authorized attempt and asynchronous boundaries. Do not move a live read earlier, cache authority across awaits, hide a dependency behind a façade/provider or delete it from the census. If an honest reduction requires changing an owner-approved architectural boundary or observable policy, present that specific design decision before implementing it; a broad rewrite is not the default fallback. If the dependency is inherently required, retain the deduction rather than manufacture a numerical reduction.

Acceptance: independently reproducible before/after maintenance exercise, complete census with providers/new owners included, actual live replacement/cancellation/staleness tests, no historical/authority/order regression, and independent review of the demonstrated design gain. This is necessary to address the below-minimum Modularity result; analysis tools alone cannot do so.

## Delivery and scoring

Keep these as focused review batches with targeted checks and Full gate, PR format, CodeQL/security and Windows on each final exact head. Measure after actual implementation; rerun affected coverage, contract/negative/compatibility and unchanged/moved cohorts. An independent reviewer then re-scores all twenty original criteria with concrete deductions. The target remains open unless at least 90/100, every dimension at least 17/20 and every criterion at least 3/5 are actually earned. No release identity change, packaging, deployment or City/native/staff/legal acceptance is part of this follow-up document.

## Delivered follow-up, 2026-11-15

The above is the original proposal, not a claim that work existed on its proposal date. F1–F4 are now delivered through #528–#530. [Final independent assessment](MAINTAINABILITY-FINAL-2026-11-15.md) records 90/100, original target result **met**, full measured denominators, exact-source receipts and remaining deductions. Historical score87 and failed intermediate targets remain intact.
