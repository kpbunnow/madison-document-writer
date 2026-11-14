# Strict maintainability evaluation — Document Writer R82

Assessment date: 2026-11-14 UTC. Source: GitHub main `6e90380af8b31536c5d7371aa08fb5b59a5c500b`, after merged [PR #510](https://github.com/kpbunnow/madison-document-writer/pull/510). The checkout is clean. R82/helper build 83 and all independently versioned formats remain unchanged. This assessment makes no application-code changes and produces no application release or deployment.

## Overall judgment

**Engineering maintainability score: 75/100.** The program has strong verification and change-control safeguards, with material maintenance debt concentrated in large Python helper modules and runtime coupling. It is maintainable under its existing disciplined process; it is not yet an exemplary example of low-cost, independently understandable modern code.

This is an **ISO/IEC 25010-aligned assessment**, using its five maintainability characteristics. It is not an ISO certification, an industry percentile, a security certification, or an automatically calculated Maintainability Index. There is no universally standardized numerical “Strict Modern Industry Standard” composite score. The weighting and deductions below are explicit reviewer judgments; the structural and tool metrics are measured.

The **formula-based Maintainability Index (MI)** is reported separately for Python. No unmeasured JavaScript MI or blended repository MI is invented. JavaScript receives current-parser ESLint control-flow and structural measurements. The engineering score includes both languages and the supporting development process.

## 1. Scoring method and detailed scorecard

Five dimensions carry 20 points each. Each comprises four criteria scored 0–5: 0 = no supporting evidence; 1 = ad hoc; 2 = partial with substantial gaps; 3 = established with material limitations; 4 = strong with limited gaps; 5 = comprehensive, directly demonstrated controls for that criterion. Maximum credit requires evidence, not intent. Unknown coverage or acceptance is not treated as passed.

| Dimension | Score | Percentage |
| --- | ---: | ---: |
| Modularity | **14/20** | 70% |
| Reusability | **15/20** | 75% |
| Analysability | **15/20** | 75% |
| Modifiability | **14/20** | 70% |
| Testability | **17/20** | 85% |
| **Total** | **75/100** | **75%** |

For this report only: 90–100 = exemplary; 80–89 = strong with limited debt; 70–79 = maintainable with material concentrated debt; 60–69 = substantial recurring maintenance cost; below 60 = high maintenance risk. These bands are not ISO or MI bands. Adjacent numerical scores should not be interpreted as measured precision.

| Dimension | Criterion | Points | Evidence and deduction |
| --- | --- | ---: | --- |
| Modularity | Import boundaries and cycle control | 5/5 | 165 modules, zero cycles, enforced import boundaries. |
| Modularity | Feature ownership and cohesion | 4/5 | Named owners and separate frontend/helper authority; some broad owners remain. |
| Modularity | State encapsulation | 3/5 | Six state boundaries and 70 owned fields; live shared state still connects features. |
| Modularity | Behavioral decoupling | 2/5 | 98 owners, 671 cross-area reference occurrences and 52 directional area pairs. |
| Reusability | Shared calculations and presentation helpers | 4/5 | Leaf modules and independent facts/services can be reused without startup. |
| Reusability | Explicit consumer contracts | 4/5 | 122 statically explicit interfaces, no opaque declarations, maximum 25 direct fields. |
| Reusability | Cross-runtime policy maintenance | 3/5 | Browser/helper mirrors are tested but still require coordinated changes; clone coverage is unmeasured. |
| Reusability | Composable component and harness reuse | 4/5 | 162 isolated evaluator files and shared harnesses; some setup remains tied to the whole application. |
| Analysability | Navigation and developer documentation | 4/5 | Developer entry guide, code map, ownership and domain rules exist; the older architecture audit is a historical snapshot. |
| Analysability | Static analysis and debt inventory | 4/5 | Enforced boundaries/ratchets and newly reproduced metrics; no continuous mixed-language MI trend. |
| Analysability | Failure diagnostics and reproducibility | 4/5 | Source-bound retained evidence, explicit failure scenarios, helper logging and reproductions. |
| Analysability | Measured change impact | 3/5 | Behavioral suites and invariants are extensive; repository-wide branch coverage and mutation score are not established. |
| Modifiability | Controlled changes and regression protection | 5/5 | Focused PRs, exact-head full checks, reviewed ancestry and immutable historical assertions. |
| Modifiability | Local control-flow simplicity | 3/5 | JS maximum 20, but 261 JS and 131 Radon Python functions exceed 10; Python maximum 52. |
| Modifiability | Change locality and static type assurance | 2/5 | Large helper modules and composition root; CI typechecks contracts.js rather than the application as a whole. |
| Modifiability | Compatibility and independently versioned contracts | 4/5 | Historical print, identities and formats are protected; mirrored rules and historical exceptions increase change cost. |
| Testability | Behavioral and differential test strength | 4/5 | 411 suites, property/differential scenarios and targeted negative mutations; no global mutation/branch-coverage measure. |
| Testability | Unit isolation and accessible seams | 3/5 | 67 whole-application evaluator files remain: 60 intentional integration files, seven classified migratable. |
| Testability | Reproducible verification and evidence | 5/5 | Pinned toolchains, full gates, source/runtime hashes, sealed artifacts and a verified real gate-only retry. |
| Testability | Failure, interruption and recovery tests | 5/5 | 20 native Windows checks and 120 long-session browser cycles with exactly-once edits and restoration checks. |

The principal deductions are for coupling, helper complexity, incomplete application-wide type assurance, and remaining whole-application test dependencies. The score is not reduced merely because the product is offline, uses JavaScript, preserves historical legal output, or deliberately retains its single composition root.

## 2. Measured source structure

Scope: 165 maintained browser modules plus `app/assets/shared.js`; 58 top-level maintained Python files in `helper/`, `tools/`, and `policy/`. Vendored dependencies, generated bundles, frozen reference implementations, tests, historical sources, and application data are excluded from production code metrics. Tests are examined separately for architecture and verification. CSS/HTML/data are not assigned a formula-based MI.

| Measurement | Current result | Interpretation |
| --- | ---: | --- |
| Browser module import cycles | 0 | Strong enforced structural boundary; does not prove behavioral independence |
| Directed browser-module import edges | 742 | Static imports within the module directory |
| JavaScript functions, including callbacks/getters/adapters | 5,566 | Small adapters lower the mean; do not read the mean alone |
| JS cyclomatic complexity: mean / median / 95th percentile / maximum | 2.76 / 1 / 10 / 20 | ESLint 10.14.0, same method for historical comparison |
| JS functions above complexity 10 / 20 | 261 / 0 | 4.69% exceed the stricter diagnostic threshold of 10 |
| JS nesting findings above four levels | 0 | Repository ratchet passes |
| JS functions above 80 nonblank/noncomment lines | 32 | Remaining findings are enclosing factories; still navigation/reasoning cost |
| Python functions, including nested functions and methods | 715 | Radon function census, excluding class aggregate entries |
| Python complexity: mean / median / 95th percentile / maximum | 6.48 / 5 / 17 / 52 | Radon 6.0.1 |
| Python Radon functions above complexity 10 | 131 | 18.32%; a broader measure than the existing Ruff check |
| Python Ruff C901 exceptions above 10 | 5 | Different algorithm; not interchangeable with the Radon count |
| Explicit service interfaces / maximum directly declared fields | 122 / 25 | Nested groups counted separately; no opaque declarations |
| Writer service areas / owners | 8 / 98 | Current owner-approved single composition root |
| Cross-area reference occurrences / directional area pairs | 671 / 52 | Repeated lazy references, not 671 unique module edges |
| Root-state importers / owned Writer state fields | 11 / 70 | Six controlled state boundaries retain live state semantics |
| Whole-application evaluator files | 67 | 60 intentional integration, seven classified migratable |
| Isolated evaluator files / retained hook fields | 162 / 44 | Test-file census, not test-case or branch-coverage counts |

The composition root is 2,436 physical lines. `new_documents.js` is 1,753, `accela_import.js` 1,227, and `reinspection.js` 1,137. Much of this is explicit composition or separated operations; file length is a navigation/hotspot signal, not proof of a defect. Splitting files while adding circular interfaces would make the design worse.

## 3. Formula-based Python Maintainability Index

Tool: pinned Radon 6.0.1, installed outside the repository with a hash-checked diagnostic lock. The application's dependencies and locks were not changed. Every Python file's raw values and source hash are provided in the metrics archive.

The code-only normalized variant is:

`MI = clamp(100 × (171 − 5.2 × ln(V) − 0.23 × G − 16.2 × ln(L)) / 171, 0, 100)`

Here `V` is Halstead volume, `G` is Radon's module aggregate cyclomatic complexity, and `L` is Radon's logical lines of code. Tool definitions matter: this is not asserted to be byte-for-byte equivalent to Visual Studio's measurements. Disabling the comment term prevents comment volume or multiline data strings from lifting the strict code score.

| Python file-index summary | Mean | Median | SLOC-weighted mean |
| --- | ---: | ---: | ---: |
| Code only; comment bonus disabled | 33.43 | 34.99 | 14.38 |
| Regular comments credited; multiline strings excluded | 40.03 | 41.13 | 18.68 |
| Radon default; multiline strings included as comments | 42.72 | 43.88 | 20.30 |

The weighted values are **descriptive averages of file indices**, not a standardized repository MI formula. Do not compare them with the 75/100 engineering score. There are no zero-volume files receiving an automatic 100. Total Python scope is 11,017 SLOC and 9,102 logical lines.

Common normalized MI bands are below 10 = low, 10 to below 20 = moderate, 20+ = higher maintainability. Under the code-only variant, five files are below 10, six are 10–19.99, and 47 are 20+. Under Radon's default variant, five are below 10 and 53 are 20+. These historical tool bands are quite permissive and do not establish modern engineering excellence or correctness.

The contrast between a code-only median of **34.99** and a weighted average of **14.38** shows that difficult maintenance is concentrated in the larger modules.

### Critical module hotspots

| File | SLOC | Code-only MI | Default MI | Highest Radon function complexity |
| --- | ---: | ---: | ---: | ---: |
| `helper/case_store.py` | 1,817 | 0.00 | 0.00 | 32 |
| `helper/server.py` | 1,570 | 0.00 | 0.00 | 38 |
| `helper/case_projection.py` | 837 | 0.00 | 0.00 | 16 |
| `helper/case_integrity.py` | 542 | 0.00 | 0.00 | 52 |
| `helper/citation_pricing.py` | 429 | 0.00 | 0.00 | 38 |

An index of zero is the formula's lower clamp, not a claim that the file cannot be maintained or contains a confirmed bug. Large module size and aggregate branching can saturate the formula even when individual operations are separated. These files also own sensitive validation, history and integrity rules, so they deserve focused maintenance rather than a mechanical rewrite.

| Python hotspot | Function | Source line | Radon complexity |
| --- | --- | ---: | ---: |
| `helper/case_integrity.py` | `verify_record` | 404 | 52 |
| `helper/citation_pricing.py` | `resolve` | 36 | 38 |
| `helper/server.py` | `read_index` | 230 | 38 |
| `helper/case_store.py` | `_validate_initial_notice_group` | 1043 | 32 |
| `tools/gate_artifacts.py` | `select` | 155 | 32 |
| `helper/server.py` | `lookup_parcels` | 449 | 31 |
| `helper/case_store.py` | `legacy_scheduled_citation_base` | 1098 | 28 |
| `tools/build.py` | `render_deploy_guide` | 157 | 28 |

Ruff's five exceptions must not be presented as “only five complex Python functions.” Radon counts Boolean expressions, assertions, comprehensions and other constructs differently. Both measurements are retained; neither is silently substituted for the other.

### Analyzer compatibility limitation

Radon 6.0.1 initially rejected `helper/case_projection.py`: its raw analyzer uses `str.splitlines()`, splitting legal Unicode line-separator characters inside the `JS_SPACE` string. Python itself parses the source correctly. For analysis only, those characters were escaped **inside string tokens**, with identical `ast.dump()` and LF counts verified before measuring. Production source is unchanged; the original and analysis hashes and transform flag are retained. The same treatment was used on the historical source. Thus 57 current files were measured directly and one through this AST-equivalent compatibility copy. This is disclosed rather than dropping a core module or calling valid application code a syntax bug.

## 4. Comparison with the recorded R73 review baseline

The available original code-review baseline is `567567ce0e1a852bd05c6e118df21b2f89fb3feb` (R73). Its source was read through `git archive` into an analysis-only directory; no worktree, branch edit, application execution or old deployment was made. Both snapshots use the same current ESLint/Radon tools and counting rules. This is a source-metric comparison, not a retroactive engineering score.

| Same-tool measurement | R73 baseline | Current R82 |
| --- | ---: | ---: |
| JS files in metric scope, including shared.js | 154 | 166 |
| JS functions | 5,221 | 5,566 |
| Maximum JS complexity | 75 | **20** |
| JS functions above complexity 20 | 3 | **0** |
| JS functions above complexity 10 | 250 (4.79%) | 261 (4.69%) |
| Python files in metric scope | 53 | 58 |
| Python default MI, descriptive SLOC-weighted mean | 18.88 | 20.30 |
| Python code-only MI, descriptive SLOC-weighted mean | 13.74 | 14.38 |
| Code-only MI on the common 53-file cohort, SLOC-weighted mean | 13.74 | 13.99 |
| Python files at the MI zero floor | 5 | 5 |

**Interpretation:** JavaScript's worst control-flow outliers improved substantially. The Python helper's structural maintainability improved little on the comparable file cohort. More files and tests reflect added capabilities and decomposition, not automatically better or worse quality. No comparable historical ISO-aligned composite was available, so no invented “before” score or percentage improvement is reported.

## 5. Verification and engineering safeguards

Current main [Full gate 43546176469](https://github.com/kpbunnow/madison-document-writer/actions/runs/43546176469) and all seven reported main checks passed. PR #510's exact reviewed head passed the complete gate and a real gate-only rerun, with its artifacts independently checked against source/runtime, authenticated job metadata, ZIP digests and 694 sealed files.

- 411 regression suites passed. Suite count is not a line/branch coverage percentage.
- 306 axe screen/theme checkpoints passed. This is not complete WCAG conformance.
- 69 historical authored-print variants passed.
- 17 report-fact expressions remained protected.
- 20 native Windows interruption/recovery checks passed.
- 120 long-session browser cycles checked exactly-once edits and persisted restoration.
- Fresh assessment-time module-boundary, scoped-architecture, test-seam, complexity and service-area checks passed.
- GitHub confirms protected main with Full gate and PR format in its required contexts; inaccessible protection details and approval/bypass configuration are not inferred.
- Dependencies/toolchains are pinned; Python installation uses hashes; no fast result substitutes for Full gate. Dependency update configuration exists on a monthly schedule.

The typed CI entry point is `app/modules/contracts.js`, a small standalone contract module with no imports. This does not establish application-wide static type coverage. Existing JSDoc and runtime checks remain useful, but their complete type coverage is not measured.

Repository-wide branch coverage, a global mutation score, quantitative duplication coverage, and an independent new-maintainer handoff were not established. Targeted mutation checks and extensive differential/property tests exist and receive credit; their existence is not extrapolated into 100% coverage. A successful security workflow is not proof that there are no vulnerabilities.

## 6. Recommended maintenance order

1. **Address the five Python hotspots through behavior-preserving phases.** Start with an explicit validation/routing/transaction map and failure-order tests for `case_store`, `server`, `case_integrity`, `case_projection` and `citation_pricing`. Extract cohesive predicates and preparation phases where that reduces reasoning cost. Preserve transaction ownership, integrity reads, history, exact refusals and publication ordering. Do not split only to increase MI, loosen validation, or rewrite old issued output.
2. **Measure risk coverage and add broader type checks incrementally.** Record branch coverage for high-risk helper and publication/import paths; retain meaningful negative/property tests. Expand checked JS contracts to service ports, payloads and critical consumers, with a documented type-check scope. A wholesale TypeScript rewrite is not required.
3. **Migrate the seven explicitly migratable whole-app evaluator files.** Preserve their assertions and production-browser coverage. Keep the 60 intentional integration files as integration tests unless evidence supports a better boundary; reducing a count is not an end in itself.
4. **Reduce specific costly cross-area dependencies.** Use the existing coupling census to identify a small operation that can receive a stable fact/query or command port. Preserve the owner-approved composition-root design and source-order requirements. Avoid a universal service registry or a second declaration of every dependency.
5. **Retain this same-tool baseline and test developer handoff.** Trend hotspots, not just means. Refresh the current assessment alongside changes, and have another maintainer complete a small realistic change from the runbook. Quantify time and difficulty before committing to further framework or layout changes.

For new ordinary code, complexity 10 is a useful stricter review trigger, with explicit reviewed exceptions for guarded legacy/security operations. It is a recommended project policy, not an ISO requirement. Any improvement must retain the full exact-head gate; score improvement cannot authorize skipping tests or changing frozen references.

## 7. Operational and acceptance boundaries

The repository still records open City-environment, staff-task, manual accessibility, printing/Outlook and legal acceptance items. This assessment does not mark them complete or assume the user's independent City testing failed. Those items affect operational readiness and assurance, not the formula-based MI. Their current completed evidence would need to be supplied/recorded before judging that readiness.

The recommendation is **targeted continued maintenance, not a broad rebuild**. Current regression protection is a major asset. Concentrating the next work on helper reasoning cost, type/coverage evidence and the seven existing test migrations offers a better maintenance return than cosmetic file splitting.

## 8. Evidence, reproducibility and references

The accompanying archive contains the complete scorecard, per-file Python metrics/CSV, every JS function-complexity record/CSV, current and R73 snapshots of metrics, source hashes, structural inventories, diagnostic tool hash lock, measurement scripts and verification summaries. It excludes dependencies, application/vendor source archives, operational records and credentials.

Reproduction requires the source commits, frozen project dependencies and the separately pinned diagnostic Radon environment. `README.md` in the archive describes commands and scope. Measurements are read-only and remain separate from merge/release approval.

Conceptual references: [ISO/IEC 25010 quality model](https://www.iso.org/standard/78176.html), [Microsoft Maintainability Index meaning](https://learn.microsoft.com/en-us/visualstudio/code-quality/code-metrics-maintainability-index-range-and-meaning), [Radon metric definitions](https://radon.readthedocs.io/en/latest/intro.html). These explain the model and formulas; this work is not represented as an external certified audit.
