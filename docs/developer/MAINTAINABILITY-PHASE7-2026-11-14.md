# Phase 7 strict audit — 87/100, acceptance target remains open

Audit date: 2026-11-14 UTC. Starting main `6fbbe77a12fe5b88c0cc6731205685d3e32f5091`; corrected diagnostic code `2010d78930728a8c70959e6f7da4f35c92146095`. Delivery [PR #527](https://github.com/kpbunnow/madison-document-writer/pull/527) records the final reviewed head, repeated final-source diagnostics, exact-head GitHub checks, merge and main status. Final report/evidence assembly changes documentation/inventory only after that corrected code. No application behavior, release/format identity, issued fact, approved wording, dependency lock, trust input or frozen reference changes; no release package/deployment.

**Independent engineering maintainability score: 87/100**, versus original **75/100** at `6e90380af8b31536c5d7371aa08fb5b59a5c500b`. Same twenty criteria, five equal 20-point dimensions and 0–5 criterion scale. ISO/IEC25010-aligned reviewer judgment, not certification, industry percentile or a blended formula-based MI. No points are awarded merely for intent, suite counts, a helper move or a desired92.

**Quality-target closure fails:** total 87 is below90 and Modularity16 is below17. Every criterion is at least3/5. Passing CI permits merging corrected tools/evidence; it does not override this quality acceptance failure. The plan's explicit below-target contingency is used: [bounded F1–F4 follow-up](MAINTAINABILITY-90-GAP-FOLLOWUP-2026-11-14.md) is prepared, not implemented or promised points. Phase 7 audit delivery is distinct from closing the 90+ development goal.

## Complete unchanged-rubric scorecard

[Independent report](maintainability/phase7-independent/REVIEW.md), [all 20 machine-readable criteria](maintainability/phase7-independent/scorecard.json), [diff ledger](maintainability/phase7-independent/diff-ledger.json), review receipts and manifest retain authorship, source hashes, deductions and evidence limits. The reviewer is the separately user-authorized AI agent, not the code/doc implementation author or a human/City assessor; prior Phase 6 exposure and restored unmerged exercise are disclosed.

| Dimension | Original | Current |
| --- | ---: | ---: |
| Modularity | 14/20 | **16/20** |
| Reusability | 15/20 | **17/20** |
| Analysability | 15/20 | **19/20** |
| Modifiability | 14/20 | **17/20** |
| Testability | 17/20 | **18/20** |
| Total | 75/100 | **87/100** |

| Dimension / criterion | Original | Current | Evidence and explicit deduction |
| --- | ---: | ---: | --- |
| Modularity — Import boundaries and cycle control | 5/5 | 5/5 | Zero cycles remain enforced; helper leaf direction is acyclic; preserved runtime manifest includes extracted modules. No deduction; import structure does not alone imply behavioral independence. |
| Modularity — Feature ownership and cohesion | 4/5 | 4/5 | Five helper families now expose named verification, cash/group, index/parcel and value phases with independent tests. Broad store/server/projection/pricing owners remain; code-only MI has five zero helpers (default/regular-comment four). Strong, comprehensive cohesion is not demonstrated. |
| Modularity — State encapsulation | 3/5 | 4/5 | Correction/eligibility/follow-up/repaint calculations use explicit lazy lookup views; actual poisoned-state and live replacement/staleness checks passed. Shared mutable workspace and imperative coordinators remain; no application-wide immutable state claim. |
| Modularity — Behavioral decoupling | 2/5 | 3/5 | Selected decisions can be exercised without service/root state; bounded change exercises and cancellation fixes are meaningful. Workflow dependency totals remain 8/29/17/5 and cross-area references remain 671 over52 pairs. Moving reads to view providers makes testing easier but does not establish strong end-to-end decoupling. |
| Reusability — Shared calculations and presentation helpers | 4/5 | 5/5 | Extracted Python calculation leaves have production consumers and independently executed refusal/order/parity checks; shared parcel owner removes accidental mirror drift. Maximum credit applies to reusable calculation criterion, not broad program simplicity. |
| Reusability — Explicit consumer contracts | 4/5 | 4/5 | Explicit bounded service interfaces retained; six real implementations strictly checked with actual wrong-call rejection. Selected critical import/commit/pending producer-consumer paths largely remain unchecked; no locked Python type assurance. |
| Reusability — Cross-runtime policy maintenance | 3/5 | 4/5 | Machine-checked owner/compatibility inventory, actual parity tests, explicit historical mirrors and reviewed lexical duplication candidates. Cross-language policy still needs coordinated changes; exact lexical matching excludes semantic/cross-language clones. |
| Reusability — Composable component and harness reuse | 4/5 | 4/5 | Bounded-services fixtures compose actual owners and preserve lazy replacement; unbound peers fail. Import workflow fixture remains broad and maintains core-like initial/service wiring; residual integration setup is real. |
| Analysability — Navigation and developer documentation | 4/5 | 5/5 | Current code map, hotspot/effect map, measurement guide and independently exercised clean handoff verified exact source/evidence assembly. AI independence from author is demonstrated; no human onboarding/City acceptance inferred. |
| Analysability — Static analysis and debt inventory | 4/5 | 5/5 | Corrected source-bound complexity/MI/coupling/seam/checked-code trends verified through2010. All1241 full input hashes and scoped hashes/tree match;819 unique actualPython AST definitions reconcile; three original MI variants match strict replay. Conservative cohort ambiguity and reviewed debt maps explicit. Syntax equality does not prove import/effect/semantic equivalence. No automatic move/improvement credit. Complete semantic mapping is not claimed. |
| Analysability — Failure diagnostics and reproducibility | 4/5 | 5/5 | Independent actual-owner unavailable/proof/pending/import/save reproductions retain observed refusals, exact state/effect evidence and reproducible probes. Scope is synthetic controlled peers and real temporary helper files; no native/City inference. |
| Analysability — Measured change impact | 3/5 | 4/5 | Fresh6fb source-bound full431-suite coverage reviewed:1,241 input hashes, tree/inputDigest, complete166JS/70Python denominators and subgroup sums/rates verified. Explicit gaps/blind spots retained; meaningful locality and scoped mutations also pass. JS runtime statement, Python high-risk statement/branch and developer thresholds remain unmet; browser-executed code/developerJS unmeasured; no global mutation or exact production coverage claim. |
| Modifiability — Controlled changes and regression protection | 5/5 | 5/5 | Focused development lineage including diagnostic/integration fixes; original historical assertions, lockfiles, identities and trust inputs preserved; exact-head process remains. Current reviewed main is reported green by parent; reviewer did not independently query external CI and final delivery still needs exact-head checks. |
| Modifiability — Local control-flow simplicity | 3/5 | 4/5 | Helper verify/index/pricing phases and selected JS operations materially simpler; 3000 corrections and5x1500 workflow comparisons plus helper failure-order tests passed. Final2010 metrics:130JS functions above10;136Python functions above10/max32; runtime max25 and30long factories remain. Every new leaf/tool is counted. |
| Modifiability — Change locality and static type assurance | 2/5 | 3/5 | Two meaningful plain-view rule changes and independent profile preference owner exercise are localized; six checked implementations reject wrong calls. Only~0.98% JS logic checked; selected critical consumers and Python public boundaries not checked. Strong broad assurance is not demonstrated. |
| Modifiability — Compatibility and independently versioned contracts | 4/5 | 5/5 | Compatibility/rule inventory identifies historical current variants; helper/browser parity independently passed; exact identities/approved language/trust/locks unchanged; baseline historical oracles preserved. No release or City/native acceptance awarded; independent local review does not repeat all69 print variants. |
| Testability — Behavioral and differential test strength | 4/5 | 4/5 | Value/refusal/order/failure comparisons, async races,8 migrated-owner mutations and existing historical/property/integration protection. Hand-seeded scoped mutants are not global mutation adequacy; fresh complete coverage/mutation evidence pending. |
| Testability — Unit isolation and accessible seams | 3/5 | 4/5 | Five full migrations plus3 feature scenarios construct actual owners; mutation evidence passed and62 remaining whole-app files have stated integration reasons. Two original files retain integration scenarios; classification correction is justified but is not seven full migrations. No comprehensive isolation credit. |
| Testability — Reproducible verification and evidence | 5/5 | 5/5 | Frozen toolchains, exact source/runtime evidence protocol and authenticated gate recovery remain; repeated local targeted checks pass. No full local gate rerun or fresh external CI query by reviewer; final publication requirements unchanged. |
| Testability — Failure, interruption and recovery tests | 5/5 | 5/5 | Original interruption/Windows/long-session catalog retained; additional actual genesis/link/duplicate/recovery, stale continuation and negative-outcome guards. Existing native catalog is retained evidence; independent reviewer used synthetic Linux seams and does not claim new City/native acceptance. |

## Development review and compatibility

Independent review examined the complete147-file development diff from original 6e90380 through main 6fbbe77, including the integration/diagnostic repairs. Rechecked five helper families and all extracted verification/group/cash/index/parcel/value leaves; correction/eligibility/follow-up and repaint calculation views; seven named migration files; consumer types; coverage denominators; mutation outcomes; startup/async cancellation and historical authority. No new concrete runtime regression was confirmed in the reviewed scope. This is bounded review evidence, not proof no bug can exist.

The seven migration targets are **five full migrations, partial feature-scenario migration and two justified integration reclassifications**. Do not call them seven full migrations. Current inventory retains62 intentional whole-app evaluators; reviewed independent boundaries show165 browser modules, zero cycles, 44 retained hook fields. No scenario/assertion/hook was discarded to improve a score.

Calculation mutable access falls to zero in selected correction/eligibility/follow-up/repaint decisions, but end-to-end totals remain17/8/29/5 (import comparison5/22); service-area references remain 671 across 52 directional pairs. Both benefits and limits count. Six checked implementations are 306 logic lines,0.98% of measured JS; no locked Python checker. Pinned TS7 defaults strict=true and wrong-call probes demonstrate actual checking; no invented missing-strict bug is claimed.

Helper owns authorization, source/head/integrity and atomic publication. Current/retained authoring, scoped13/ordinary16, case5 and legacy readers, summary6, workspace backup2 versus draft recovery1, dated pricing, frozen facts and mandatory-appearance hold remain. Existing real projection corpus/captured flows, compatibility/print, store/refusal/interruption and parity suites are required in the final exact-head gate; old passing evidence is not relabeled a new gate.

## Confirmed diagnostic defects and fixes

- **P7-D1 — MI comparability gap.** The diagnostic tool emitted only Radon default/comment-inclusive MI while the original strict assessment reports default, regular-comments and code-only variants. All three are now retained per file/group, with the original default `mi` alias unchanged. Code-only disables the comment bonus. Default has four zero-MI helpers; code-only still has **five**, including case_integrity. Its default5.95 is not a code-only improvement.
- **P7-D2 — duplicate complete census.** Radon exposes class methods/closures under both class-qualified and bare lists. The old tool counted899 rows where817 distinct source functions existed at6fb; similar historical complete-series claims were inflated. Corrected collection prefers qualified ownership and counts each file/line/column/name once; distinct names/locations/files and closure flags remain. Real Radon probe failed before and passes now. Thirteen measurement tests preserve all original assertions and add duplication/order/name/MI-variant/denominator regressions; eight prior diagnostic-review and seven UTF8 tests also pass.

Historical raw records remain unchanged, including the Phase 6 compact receipt. Their **complete-series count/distribution is superseded**, not silently corrected or credited as a program improvement. Flat CLI counts, unique-function strict replays and the three MI variants are separate. The final corrected code contains819 unique functions (two genuine diagnostic helpers added), not817 or899; flat CLI803 and above10 count136 remain separately recorded. A shared MI-summary helper avoids introducing an unnecessary new above10 function.

## Same-method source comparison

Original strict scripts re-read archived source bytes without executing old applications. Original/implementation/current Python file hashes were independently verified against Git. Radon6.0.1, ESLint10.14.0 and the same current pinned runtime/counting rules are used throughout; all Unicode-separator copies require AST/LF equivalence. [Compact comparison](maintainability/phase7-summary-2026-11-14.json) binds raw receipt hashes and methods; raw JSON, scripts and baseline source fingerprints are in the delivered evidence archive.

| Full maintained scope | Original6e90380 | Implementation3183bff | Corrected2010d789 |
| --- | ---: | ---: | ---: |
| JS functions | 5,566 | 5,566 | 5,917 |
| JS above10 / maximum | 261 /20 | 261 /20 | 130 /20 |
| Long JS factories >80 | 32 | 32 | 30 (target20 unmet) |
| Python files / unique functions | 58 /715 | 63 /767 | 70 /819 |
| Unique Python above10 / maximum | 131 /52 | 131 /52 | 136 /32 (runtime maximum25) |
| Code-only MI, SLOC-weighted | 14.3769 | 15.0465 | 16.0937 |

The code-only result is modest improvement, not disappearance of concentrated debt. Four default/five code-only zero helpers remain. Runtime/developer groups, means/medians/weighted summaries, complete/CLI distributions and every file remain separate. No JS/blended MI, coverage-adjusted score or automatic rank is invented.

### Unchanged and moved/split function cohorts

Against original source,5,234 JS and680 Python functions retain the same lexical identity and normalized AST; against implementation start,5,243 JS and717 Python functions do. All have attributed complexity. These are **syntax-unchanged cohorts**, not semantic/import/effect proofs. Their remaining above10 counts are129 JS and119 Python: inherited hotspots are visible instead of hidden by newly small helpers.

Exact identity/syntax matches are globally reserved. Changed anonymous ordinals are only candidates; unique equivalent syntax elsewhere is **not automatically a move**. Ninety-nine unreserved JS equivalent-syntax sites and174 changed lexical-ID sites against original remain labeled candidates with no movement/simplicity credit.55JS/1Python automatic nondebt gaps remain explicit. Candidate collisions and scope limitations are retained, not hidden.

Independent source/context review accepts20 actual Python relocations (19 projection-value operations and one initial-citation group validator). Six frozen debt responsibility splits are separately mapped to exact successor IDs, complexities, AST hashes, order explanations and supporting suites: correction item/citation changes; correction visit result/outcome/date; citation check targets/fields; worksheet item/date checks; jstr/number text; initial notice group predicates. Every originally missing debt identity has a reviewed disposition, while automatic nondebt gaps remain open. Coordinators and **all** new leaves/tools remain in full metrics. AST candidate rows alone earn no decoupling/cohesion credit.

## Coverage, types and negative detection

Audit-start clean 6fbbe77 collection: all 431 discovered unit suites run once and pass under instrumentation, including 12 browser-class suites serially. Full gate also has separate fixtures/tagcheck.js, hence432 total regression suites. All166 JS and 70 Python files remain in denominators, including unexecuted files. Independent review reconciled input hashes, suite discovery, group sums and rates.

| Scope at exact6fb source | Statements | Branches | Target |
| --- | ---: | ---: | --- |
| JS runtime | 81.3% | 81.0% | 85% /75% — statements unmet |
| JS high-risk | 93.0% | 89.8% | 90% /85% — met |
| Python runtime | 89.9% | 84.7% | 85% /75% — met |
| Python high-risk | 85.7% | 82.4% | 90% /85% — unmet |
| Python developer | 66.6% | 66.0% | 80% /70% — unmet |

This exact-source table is not relabeled final code: final delivery repeats collection on its clean PR head and records the actual later counts/source in the PR and artifact. The two changed measurement implementations and their test additions are diagnostic-only, but developer denominators and their source binding must still be rechecked. Code executing inside Chromium and developer JavaScript are not measured by this collector; automated/native/City acceptance is not inferred. No missing file is dropped.

At exact6fb,31 configured hand-seeded mutants were detected with no survivors/timeouts/invalid or baseline failures, all source inputs verified. The final PR head receives another pilot before merge. Normal failing-suite status is required; signal/spawn/timeout/invalid syntax cannot be counted as killed. This is targeted detection, not global mutation score. Actual checked contracts compile and six deliberately wrong calls fail at their own probes; declarations alone are insufficient. Coverage/typing/control-flow targets remain explicit follow-up rather than deductions erased by suite counts.

## Delivery, final review and unclosed goal

[PR #527](https://github.com/kpbunnow/madison-document-writer/pull/527) holds the final reviewed SHA, actual Full gate/PR format/security/Windows outcomes, final-source diagnostic receipts, expected-head normal merge and post-merge main status. Local targeted checks do not replace that gate; diagnostics/fast mode do not approve a release. Final metadata assembly is independently compared with the assessed code; actual final-source results must be checked before merge. No reference hashes, assertions, deadlines or locks are weakened.

The current code remains maintainable with demonstrated improvements and material concentrated debt. **The90+ goal is not closed.** F1–F4 propose real critical consumer contracts, cohesive publication ownership, missing refusal/interruption coverage and an honest reduction in end-to-end reasoning dependency. A broad rewrite, arbitrary reclassification or architecture/authority change is not an automatic fallback; any required owner decision must be identified first. City/native/staff/legal acceptance remains in the living records and separate from this engineering score.
