# Independent Phase 7 code audit — 2026-11-14 UTC

**87/100. The unchanged90-point development target remains unmet.** Modularity16/20 also misses the required17-point dimension minimum; all twenty criteria meet the3-point floor. No weights, anchors, thresholds, scope or acceptance targets were changed. The final scorecard is an independent engineering judgment, not ISO certification, formula-based repository MI or City/native acceptance.

Reviewed code: `2010d78930728a8c70959e6f7da4f35c92146095`. Original rubric/source: `6e90380af8b31536c5d7371aa08fb5b59a5c500b`; implementation-start comparison: `3183bff1a529b655a4e2f6b1e1d79f76bc8610cf`. The full147-path development diff and merge lineage were reviewed, including diagnostic/integration corrections #513/#521/#524/#525 and this audit's two diagnostic fixes. `diff-ledger.json` binds every changed path and diff. Runtime/policy/dependency/trust/identity sources are unchanged between audit-start6fbbe77 and2010; the latter changes measurement implementations and their tests.

Reviewer: separate user-authorized AI reviewer, not implementation author or human/City assessor. Prior exposure: Phase6 handoff and evidence assembly, including the temporary, restored, unshipped preference probe. No Phase7 implementation, canonical edit, push, merge, release packaging, deployment or external message was performed by this reviewer. Parent-supplied receipts were independently checked; targeted tests/probes below were independently executed.

## Fixed all-twenty scorecard

| Dimension | Original | Final |
| --- | ---: | ---: |
| Modularity |14 |16 |
| Reusability |15 |17 |
| Analysability |15 |19 |
| Modifiability |14 |17 |
| Testability |17 |18 |
| Total |75 |87 |

| Criterion | Points | Concrete evidence / deduction |
| --- | ---: | --- |
| Modularity: Import boundaries and cycle control |5/5 |Zero cycles; enforced boundaries and complete extracted-helper runtime manifest. |
| Modularity: Feature ownership and cohesion |4/5 |Named helper phases improve navigation, but broad store/server/projection/pricing owners remain. |
| Modularity: State encapsulation |4/5 |Lazy explicit views, poisoned-state/change-locality and replacement/staleness tests; shared mutable coordination remains. |
| Modularity: Behavioral decoupling |3/5 |Selected calculations are easier to test; complete workflow dependencies and671/52 cross-area coupling remain. |
| Reusability: Shared calculations and presentation helpers |5/5 |Real reusable leaves, production consumers, independent value/refusal/order/parity evidence. |
| Reusability: Explicit consumer contracts |4/5 |Explicit bounded ports and six checked implementations; most critical consumers/Python remain unchecked. |
| Reusability: Cross-runtime policy maintenance |4/5 |Machine-checked owner/compatibility inventory and actual parity; coordinated mirrors remain. |
| Reusability: Composable component and harness reuse |4/5 |Bounded real-owner fixtures reject unbound peers; broad import/composition setup remains. |
| Analysability: Navigation and developer documentation |5/5 |Current owner/effect maps and independently completed clean handoff; AI limits explicit. |
| Analysability: Static analysis and debt inventory |5/5 |Corrected source-bound census, original MI variants, debt/cohort and scope controls independently verified. |
| Analysability: Failure diagnostics and reproducibility |5/5 |Reproducible actual-owner transport/proof/pending/import/save refusals with retained-state evidence. |
| Analysability: Measured change impact |4/5 |Complete source-bound coverage and scoped mutations/locality evidence; coverage targets/blind spots remain. |
| Modifiability: Controlled changes and regression protection |5/5 |Focused lineage, preserved oracles/identities/trust/locks, required exact-head process retained. |
| Modifiability: Local control-flow simplicity |4/5 |Material selected reductions;130JS/136Python functions above10, maxPython32 and30long factories remain. |
| Modifiability: Change locality and static type assurance |3/5 |Meaningful isolated changes; only306 checkedJS logic lines/~0.98%, no locked Python checker. |
| Modifiability: Compatibility and independently versioned contracts |5/5 |Compatibility inventory, independently passed parity and unchanged historical identities/oracles. |
| Testability: Behavioral and differential test strength |4/5 |Strong value/refusal/order comparisons and negative mutations; no global mutation assurance. |
| Testability: Unit isolation and accessible seams |4/5 |Five full migrations plus three feature scenarios; two justified integration reclassifications are not seven full migrations. |
| Testability: Reproducible verification and evidence |5/5 |Frozen dependencies/source-runtime evidence and recovery protocol retained; final delivery CI remains required. |
| Testability: Failure, interruption and recovery tests |5/5 |Retained Windows/long-session catalog and added independent failure/race checks; no new City/native claim. |

`scorecard.json` retains each original score, evidence and explicit deduction/limit. The below-target contingency is prepared in `MAINTAINABILITY-90-GAP-FOLLOWUP-2026-11-14.md`: F1 actual checked request/result producers and consumers; F2 cohesive publication-validation ownership; F3 meaningful uncovered refusal/interruption outcomes; F4 real whole-workflow dependency reduction. I reviewed its acceptance conditions: no unchecked typed wrapper, moved dependency hidden from the census, denominator reduction, authority cache, broad rewrite or promise of points. If a required architectural/policy change exceeds existing authority, the specific decision must be presented; otherwise retain the deduction.

## Correctness and preservation review

No confirmed new runtime regression remains from this bounded review. Five helper families and all extracted leaves were examined: integrity context/anchor/registry acquisition stays in case_integrity; ordered pure verdict phases in integrity_verification do not publish. Store retains locks, expected-head scans, merge/validation, atomic publication and recovery receipts; cash/initial-issuance leaves retain dated/historical/mandatory holds. Server retains authenticated routes and consuming-thread source/revision/integrity/projection acceptance; index/parcel calculations cannot authorize records. Projection values and pricing retain JS semantics, dated policy, site/owner/window decisions and issued money/history.

Correction, new-document eligibility, follow-up drafting and repaint views preserve live checkpoints and simplify isolated reasoning. Their complete dependency totals remain8/29/17/5;671 cross-area occurrences over52 pairs remain. Both provider and coordinator reads are counted. Other browser diffs preserve due dates, family cutoffs, fixed printable facts, original-PDF binding, correction lineage, edit/deposit/focus/message ordering, catalog escaping and Reports read-only/as-of semantics. R82/helper83, authoring16/scoped13, case5, summary6, backup2, approved wording, trust and dependency locks are unchanged.

The two migration reclassifications have genuine core-composed readiness/rendering/lifecycle responsibilities. Existing assertion/scenario coverage remains; they receive no fictional full-migration credit. Six checkedJS files are real strict implementations with six wrong-call rejections. PinnedTS7 defaults strict=true, confirmed by a null/implicit-any probe; the absence of an explicit flag is not a finding.

## Diagnostic defects found and resolved

- P7-D1: original code-only/regular-comment/default MI variants were missing from the maintained tool. Correction77f76c8 preserves default alias and adds all variants using identical files/SLOC weights. All70 archived audit-start files match the original strict replay rounded values.
- P7-D2: Radon classes also expose bare methods; the old complete census counted methods/closures twice. My synthetic three-function example returned five rows before and three qualified rows after correction. Classes-first source-location dedup preserves distinct names/locations and closure flags. All819 final actualPython AST function locations reconcile exactly. Raw old inflated receipts remain historical/superseded.
- P7-D3: a draft cohort inferred moves from unique AST sites and changed anonymous ordinals, producing six many-to-one targets, including pre-existing identical syntax. Final receipt reserves exact IDs, labels99 JS equivalent-syntax and174 changed-ID sites only as candidates, and awards no move/semantic/improvement credit. Six debt splits and twenty actual Python relocations were separately source/context reviewed.55JS/1Python nondebt automatic gaps remain explicit. AST equality alone does not prove imports, captures or effects unchanged.

Final cohort provenance binds three sourceSHAs, three catalog hashes, five script hashes, method and exact independent debt-map hash. Referenced external ZIP files must be assembled at their declared relative paths. `final-cohort-review.json` retains that check; no blanket move inference was approved.

## Executed and independently reconciled evidence

Independent targeted executions passed: five helper phase/parity suites (7/5/3/4/5tests);3,000 correction comparisons; five workflow operations×1,500scenarios; Reports/import settlement races; two600-case plain-view change exercises; eight migrated-owner negative mutations; six checked-contract probes; current module/seam/locality/runtime/policy/outcome/teardown guards. Diagnostic correction13/8/7tests passed; the final MI-summary change repeats its13-test suite and the realRadon probe successfully. Raw command logs remain outside committed evidence.

At exact6fbbe77, I reconciled all1,241 input hashes/tree/digest, exact431 discovered unit suites once each (all passed), all166JS/70Python denominator files and every subgroup sum/rate. Rates: JSruntime81.3% statements/81.0%branches; JShigh-risk93.0/89.8; Pyruntime89.9/84.7; Pyhigh-risk85.7/82.4; developer66.6/66.0. RuntimeJS statement, Pythonhigh-risk and developer targets remain unmet. Chromium-executed code/developerJS are unmeasured. The separate tagcheck accounts for the full gate's additional suite.

The exact6fb31-mutant receipt also reconciles all input hashes/configuredIDs:31normal failed-suite outcomes, zero baseline failures/survivors/timeouts/invalid. This is a scoped pilot, not a global score. These6fb receipts are carried forward only with unchanged-runtime source equivalence; they are not relabeled exact2010 coverage/mutations. Parent is collecting fresh final-head evidence before delivery.

Final2010 metrics are source-bound and independently hashed:5,917JS functions/130above10/max20;30long factories;819uniquePython functions/136above10/max32 (runtime max25). Code-only MI weighted mean14.3769original→15.0465implementation→16.0937final. Five helpers remain at code-only zero; four-zero/verifier5.95 statements apply default/regular-comment variants. Adding leaves/tools never removes them from totals. All current complexities are attributed; complete semantic mapping is not claimed.

Original-method replays, corrected-current hashes, explicit debt maps/relocations, conservative cohort, coverage/mutation checks and defect resolution are retained in the structured receipts. One reviewer AST command mistakenly used defaultPython3.12; it failed on valid3.14 syntax and was rerun successfully with required3.14. This was setup error, not a program/tool defect.

## Delivery limits

This is the final independent code judgment for2010, not a final-head merge/CI attestation. Subsequent documentation-only assembly may carry it forward with exact code equivalence and independently checked source-bound receipts. Full gate, PR format, security and Windows checks must pass on the exact delivered head; fresh final-head coverage/mutations must retain failures/denominators. I did not independently query externalCI, rerun the full local gate or perform City/native/staff/legal acceptance. The90-point target and below-minimum Modularity result remain open after this audit batch.
