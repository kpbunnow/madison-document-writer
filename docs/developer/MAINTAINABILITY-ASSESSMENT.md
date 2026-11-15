# Current maintenance architecture assessment

Current assessed source `902be70db582a66ec54a0e2e747b880db5b852e2`. **Independent strict score 90/100**, original75 and Phase7 87. Original target90, dimension minimum17 and criterion minimum3: **met**. The [full twenty-criterion assessment](MAINTAINABILITY-FINAL-2026-11-15.md) records all evidence and deductions. [F1–F4](MAINTAINABILITY-FOLLOWUP-2026-11-15.md) are implemented through #528–#530; historical assessments remain dated evidence, not current counts. Exact delivery checks/merge status belong to the respective PRs and external delivery receipt.

The [October architecture audit](../history/MAINTAINABILITY-ARCHITECTURE-2026-10-29.md) is preserved byte-for-byte, including its original counts, exception register and stopping decision. Its historical assertions do not describe today's owners. The [Phase 6 receipt](maintainability/phase6-structure-2026-11-14.json) remains dated provenance; its duplicate-inflated complete census is superseded by the corrected [Phase 7 comparison](maintainability/phase7-summary-2026-11-14.json), not rewritten as a new measurement.

## Current structure and limits

| Evidence at the stated source | Result | Interpretation |
| --- | ---: | --- |
| Maintained JS files, including shared.js | 167 | 166 app modules plus shared asset; generated/vendor excluded |
| JS cycles / complexity above 20 / nesting above 4 | 0 / 0 / 0 | Structural controls, not proof of behavioral independence |
| JS functions above 10 / long factories above 80 logic lines | 131 / 30 | Baseline 261 / 32; long-factory target 20 remains unmet |
| Cross-area references / directional pairs | 669 / 52 | Two real authoring-peer dependencies removed; all providers/direct imports remain counted |
| Whole-app evaluator files | 62 integration, 0 migratable | Five original suites migrated, two explicitly reclassified; no claim all seven migrated |
| Checked JavaScript | 11 JS files plus one declaration, 460 logic lines (1.47%) | A real checked port, far from application-wide assurance |
| Python Radon CLI functions above 10 / maximum | 136 / 32 | Runtime 106 / 25; developer tools 30 / 32; includes extracted helpers |
| Python unique complete-series functions above 10 | 136 | 820 unique source locations; duplicate qualified/bare method rows removed, separate from flat CLI804 |
| Python MI zero | 5 code-only /4 default | Store, server, projection, pricing and verifier remain clamped in code-only; verifier5.95 is default/comment-inclusive only |
| Ruff C901 exceptions | 3 | Different metric from Radon; do not combine them |

The earlier Phase 3 record's129 complex JS functions is its own checkpoint, not Phase 7 snapshot's130; current131 includes the acknowledgment predicate. Previous complete-Python rows counted methods/closures twice; the old143 above10 and899-function series is invalid as a unique-function census and is superseded, not a code improvement. Python's total above-10 count is not an improvement over the baseline 131: new diagnostic tools and extracted phases are counted. Runtime verifier maximum/reasoning improvements do not establish a repository-wide score. Phase 7 compares original/implementation unchanged cohorts and independently reviewed moves/splits without inferring semantic movement from AST similarity.

## Authority and changed ownership

Core remains the explicit composition/startup root; scoped state boundaries retain live replacement. Calculation phases accept narrow lookup views while coordinators retain live reads and ordered effects. [02-CODE-MAP.md](02-CODE-MAP.md) maps the affected workflows, pure leaves, service boundaries and tests. [HOTSPOT-REGISTER.md](HOTSPOT-REGISTER.md) records the original five helper families together with their extracted leaves and remaining debt.

Integrity verification remains in `case_integrity.verify_record` and its request-local context; pure predicates live in `integrity_verification`. Store locks, expected heads and atomic publication remain in `case_store`; cash/group validation leaves cannot publish. Server routes retain transport/authentication and read scheduling; `index_validation` and `parcel_history` perform narrow calculations. Browser/helper rule ownership is in [policy-compatibility.json](../../tools/policy-compatibility.json), with actual parity suites and preserved variants; see [Phase 5](MAINTAINABILITY-PHASE5-2026-11-14.md).

The verified case remains authoritative; Reporting Index is a cache. Held device work is not shared publication, a filed marker is not PDF proof, and a delivery draft is not receipt of delivery. No universal registry, integrity cache across operations or new format/version bypass was introduced.

## Verification and diagnostics

Phase 5 final head `d35658c4a714584483410dd0fbd94567a08e751d` passed Full gate [43643960639](https://github.com/kpbunnow/madison-document-writer/actions/runs/43643960639): 432 regression suites, 306 axe checks and 69 historical print variants. PR #525 merged as the snapshot main with the same tested tree; its automatic main Full gate, Windows and security checks also passed. These counts are evidence for that source, not perpetual current counts. Phase 6 also passed its exact-head checks; the final follow-up evidence is in [MAINTAINABILITY-FINAL-2026-11-15.md](MAINTAINABILITY-FINAL-2026-11-15.md).

Targeted diagnostic proof at the Phase 5 head detected all 31 seeded mutations, with zero survivors/timeouts/invalid outcomes. The lexical clone inventory reduced three measured candidates to one deliberately retained storage coordinator fragment. Neither number is a global mutation score or duplication percentage. See [MAINTENANCE-MEASUREMENTS.md](MAINTENANCE-MEASUREMENTS.md) for source-bound reproduction, denominators, exclusions and unsupported cases.

[MAINTAINER-HANDOFF.md](MAINTAINER-HANDOFF.md) gives a clean setup, owner-change exercise and three synthetic failure traces, including evidence sanitization and retention checks. Independent handoff results and assistance belong in the Phase 6 record; an AI reviewer independent of the author is not a human or City acceptance reviewer.

## Behavior-preserving method

Retain the original before changing ordered/rendering/persistence rules; compare results, error classes/messages, peer order and state/DOM effects, then demonstrate detection with syntax-valid mutants. Never alter historical assertions, frozen references, expected hashes, locks or deadlines to make a change pass. Correct intentional ownership metadata explicitly and retain the assertions that enforce it. Require the complete GitHub gate, PR format, security and applicable Windows checks on the exact merged head. Diagnostic/fast runs do not approve release or merge.

## Remaining evidence and accepted boundaries

Complete measured coverage targets and their raw fractions are recorded in [MAINTAINABILITY-FINAL-2026-11-15.md](MAINTAINABILITY-FINAL-2026-11-15.md); execution inside Chromium and developer JavaScript remain unmeasured. Broad typing remains open. Python typing is not enforced by a locked checker. Five code-only/four default zero-MI helpers, long factories, pricing/projection complexity, developer-tool complexity and whole-workflow behavioral coupling remain visible. Intentional historical/cross-language implementations are not removable merely to improve a metric.

[MAINTAINABILITY-STATUS.md](MAINTAINABILITY-STATUS.md) records actual delivery heads and work remaining. Phase 7 replays the original/implementation/current structure and strict MI variants, reviews the full development diffs and all twenty unchanged criteria, and repeats final-source diagnostics; exact source-specific receipts and limitations remain explicit. Phase 7 retains its historical87/100. Current independent score 90/100 and original-rubric target result (met) are recorded separately. Release identities, independently versioned formats, issued facts, legal holds and City/native acceptance remain unchanged. No package or deployment is authorized by this record.
