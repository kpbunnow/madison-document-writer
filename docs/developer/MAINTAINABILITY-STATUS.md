# Maintainability development status

Historical delivery baseline at Phase 6 starting main `dd584ce02f1375031da7935d6015e82d1f3778a0`, 2026-11-14. The owner's 90+ plan is dated 2026-11-14, version 1.0; this is its current delivery/evidence index, not a redefinition of the scorecard. The [original strict assessment](../history/MAINTAINABILITY-EVALUATION-2026-11-14.md) retains all twenty criteria and 75/100 at `6e90380`. The long [earlier development ledger](MAINTAINABILITY-PLAN.md) remains historical provenance.

## Phases and remaining items

| Phase | Actual delivery | Status and limits |
| --- | --- | --- |
| 0 — baseline | #511; MAINTAINABILITY-BASELINE-2026-11-14.md and frozen debt cohort | Recorded; original source/provenance retained |
| 1 — contracts/coverage/negative evidence | #512; corrections #513, #524 | Implemented checked port/diagnostics; coverage/type targets still open, original measurements remain dated |
| 2 — helper reasoning cost | #514–#516; MAINTAINABILITY-PHASE2-2026-11-14.md | Coordinators/authorities and extracted leaves retained; low MI remains |
| 3 — locality/complexity | #517–#520; review fixes #521 | Scoped calculation views and reduced JS complexity; total coupling unchanged, long-factory target unmet |
| 4 — real-owner test migration | #522–#523; review fix #524 | Five full migrations plus partial feature migration; two integration reclassifications explicitly retained, no hook retirement |
| 5 — policy/compatibility/duplication | #525; MAINTAINABILITY-PHASE5-2026-11-14.md | Delivered, cross-runtime fixes/guards and reviewed candidates; no global mutation/duplication score |
| 6 — diagnostics/docs/handoff | [#526](https://github.com/kpbunnow/madison-document-writer/pull/526); MAINTAINABILITY-PHASE6-2026-11-14.md | Independent AI handoff completed on candidate 8145df2; no material defect in exercised scope. Final checked head/checks and merge status belong to the PR; no score awarded. |
| 7 — final audit/score/closure | [#527](https://github.com/kpbunnow/madison-document-writer/pull/527); [full audit](MAINTAINABILITY-PHASE7-2026-11-14.md) | Audit/fixes delivered through exact-head verification; independent87/100 (16/17/19/17/18). Quality-target closure FAILED: total<90 and Modularity<17. Bounded followup prepared, not implemented; final head/check/merge status in PR. |

All prior delivery heads below were rechecked against GitHub during Phase 6. A passing check at one head does not approve later edits. Their Full-gate links and exact final source heads are preserved; detailed Windows/security checks remain on each PR. No branch-only or fast result is relabeled as merge evidence.

| PR | Final checked head | Merge commit | Full gate |
| --- | --- | --- | --- |
| [#511](https://github.com/kpbunnow/madison-document-writer/pull/511) | `2e6f481088b4ec160385edb1835bf1796679b5c7` | `f06d535ecb0a0fbaea188d621ce3a745c5fc0dc8` | [passed](https://github.com/kpbunnow/madison-document-writer/actions/runs/43553494002/job/132322895781) |
| [#512](https://github.com/kpbunnow/madison-document-writer/pull/512) | `95a63ab9ae94f9cee77ad0c3803392ce580c0291` | `3183bff1a529b655a4e2f6b1e1d79f76bc8610cf` | [passed](https://github.com/kpbunnow/madison-document-writer/actions/runs/43561446465/job/132347356644) |
| [#513](https://github.com/kpbunnow/madison-document-writer/pull/513) | `1d97fd178364a13408d6fb4d92d089752baa81c8` | `6859382339ac1e636dca206ec77409df1e9f030b` | [passed](https://github.com/kpbunnow/madison-document-writer/actions/runs/43599702975/job/132463522193) |
| [#514](https://github.com/kpbunnow/madison-document-writer/pull/514) | `51843b90c6f54523f280db3bf9118607572cd47f` | `544541424cc414165a82ca90bda2741d9e3b3d43` | [passed](https://github.com/kpbunnow/madison-document-writer/actions/runs/43600653166/job/132466573523) |
| [#515](https://github.com/kpbunnow/madison-document-writer/pull/515) | `c947580ee261ffb5c7dc0363c2a81ab303ab7b33` | `ae21684ae96894ae280d1031932b63fa6a2d6dd8` | [passed](https://github.com/kpbunnow/madison-document-writer/actions/runs/43602710637/job/132472483829) |
| [#516](https://github.com/kpbunnow/madison-document-writer/pull/516) | `66d775909530e1d8acf69cb66f578647c7baf934` | `b99ac6f5c2cd3f3e5fff609b0f4c0e78b45d7f3b` | [passed](https://github.com/kpbunnow/madison-document-writer/actions/runs/43604165073/job/132476893479) |
| [#517](https://github.com/kpbunnow/madison-document-writer/pull/517) | `808da1b5377716810426fdfdf9a72fa634b9c01b` | `6f35e191f88388777a5de797520f0a400fc03f41` | [passed](https://github.com/kpbunnow/madison-document-writer/actions/runs/43606646822/job/132484775132) |
| [#518](https://github.com/kpbunnow/madison-document-writer/pull/518) | `f05fb59097c3d9329150aca94674ffae1b1a75fc` | `7eff35507d164600ae40e7b7864b63aec305bee5` | [passed](https://github.com/kpbunnow/madison-document-writer/actions/runs/43608552581/job/132490408509) |
| [#519](https://github.com/kpbunnow/madison-document-writer/pull/519) | `c1b390ab9787432a754f033101212e426b0164ea` | `c8d79ca17ab8a8c8697bf62f5bb7c5541d12b88f` | [passed](https://github.com/kpbunnow/madison-document-writer/actions/runs/43610353755/job/132495890796) |
| [#520](https://github.com/kpbunnow/madison-document-writer/pull/520) | `a0ba12fc4bae3b2409b500a8d1cf2eeac8547348` | `8f3071ee855cbc2d4147d6282b560cc537a1bff1` | [passed](https://github.com/kpbunnow/madison-document-writer/actions/runs/43615043234/job/132515616941) |
| [#521](https://github.com/kpbunnow/madison-document-writer/pull/521) | `68b0233b047f4d9ec8494b47ecb39a8446a7b3a7` | `4d340e6a7948d842982f7f4f7e03bcdf7c448b7d` | [passed](https://github.com/kpbunnow/madison-document-writer/actions/runs/43624471792/job/132539602641) |
| [#522](https://github.com/kpbunnow/madison-document-writer/pull/522) | `ec4d02da982a64bcaeb2cdd468924bef758ce462` | `6a51282fa7a17330860b0d6dd13d8cad443b2934` | [passed](https://github.com/kpbunnow/madison-document-writer/actions/runs/43634473223/job/132570108582) |
| [#523](https://github.com/kpbunnow/madison-document-writer/pull/523) | `266126ca0696ed2bdf25d5d0819bb047df377a30` | `7b472d7ec05671c8ab5ef601b4fe37bf9a98acdf` | [passed](https://github.com/kpbunnow/madison-document-writer/actions/runs/43636742684/job/132577568610) |
| [#524](https://github.com/kpbunnow/madison-document-writer/pull/524) | `15c2af828694f29fe1560cd972c817efe1dd349d` | `f078911b3ee0101f2bc1178de19968490cbd8a13` | [passed](https://github.com/kpbunnow/madison-document-writer/actions/runs/43640359907/job/132588991804) |
| [#525](https://github.com/kpbunnow/madison-document-writer/pull/525) | `d35658c4a714584483410dd0fbd94567a08e751d` | `dd584ce02f1375031da7935d6015e82d1f3778a0` | [passed](https://github.com/kpbunnow/madison-document-writer/actions/runs/43643960639/job/132599263383) |

Phase 5 final evidence: 432 regression suites, 306 axe checks, 69 historical print variants, 31 targeted mutants detected; current main's automatic checks also passed. These are source-bound snapshot counts, not a substitute for Phase 6/7 verification. Release R82/build 83, authoring 16/scoped 13, schema 5, summary 6, backup 2 and draft recovery 1 remain unchanged.

## Evidence not yet earned

- Fresh full coverage on the final codebase, including explicit treatment of Chromium-executed code and every maintained denominator; Phase 1 deficits remain.
- Broad checked JS/Python assurance: six checked JS files are 0.98% at this snapshot; no locked Python checker.
- Further coherent low-MI/complexity and long-factory work; a wrapper-only metric improvement cannot erase extracted debt.
- A final same-rubric twenty-criterion score at least 90/100, every dimension at least 17/20, no criterion below 3/5. Phase 7 independently scores87/100 and explicitly fails target closure; future work must earn the target without changing the rubric.
- Human/City/native/staff/legal acceptance remains in ACCEPTANCE-RECORD.md and PRODUCTION-READINESS.md. AI handoff independence does not close it.

No release was packaged or deployed. Phase 6 does not authorize UI/workflow redesign. Correct materially defective documentation and repeat affected independent tasks before marking the handoff complete.

The Phase 7 [diagnostic corrections](MAINTAINABILITY-PHASE7-2026-11-14.md) supersede inflated complete-function counts in older snapshots without changing their bytes. Current code-only MI, default MI, coverage heads, typed scope and candidate/moved cohorts remain separate. [F1–F4](MAINTAINABILITY-90-GAP-FOLLOWUP-2026-11-14.md) are prepared bounded work, not completed design changes or promised points.
