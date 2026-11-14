# Phase 0/1 review and corrections — 2026-11-14

Reviewed merged PRs 511 and 512 on main 3183bff1a529b655a4e2f6b1e1d79f76bc8610cf. All reported main checks passed. The new runtime annotations and equivalent-expression changes retained their behavior in the existing contract, escaping, mailing and browser gates. No runtime change is made in this corrective batch; release and format identities remain unchanged.

The coverage/type targets recorded as backlog in Phase 1 are still backlog. This review does not award score or interpret diagnostic instrumentation as merge/release or City acceptance evidence.

## Corrected diagnostic defects

- **JavaScript historical cohorts.** `--scope-commit` filtered input hashes and Python files but still reported the entire current JavaScript scope. Against the recorded R73 file cohort, the old tool reported 166 JS files while hashing 153; corrected reporting filters file/function metrics and checked-code share consistently to 153. Import cycles, service areas and test seams explicitly remain whole-checkout structural measurements, not historical cohort statistics.
- **Invalid mutation classification and selection.** A Python mutation producing `return ???` failed importing a real synthetic module and was counted as killed. Python compilation and JS syntax checks now reject invalid code before running suites. Unknown or empty explicit mutant selections are refused instead of returning a zero-mutant report.
- **Coverage ordering and denominators.** Non-browser suites previously shared one pool across languages; Python could run before JavaScript producers completed. The existing gate's language-phase barrier now applies. A maintained Python file omitted by the collector is refused rather than silently disappearing from the denominator. Unexecuted files remain included with zero coverage; vendor files remain excluded.
- **Source binding.** Coverage and mutation reports previously named a Git commit without retaining copied input hashes, and diagnostics could finish after a checkout change. They now bind copied bytes and verify source identity, file set and hashes before/after execution. Maintainability reports similarly retain and verify complete measurement-source inputs in addition to the original scoped metric digest. A changed source invalidates the result.

## Verification

- `audit_phase1_review.py`: seven regression tests passed, covering cohort metrics/checked-share, missing cohort file refusal, actual invalid Python classification, valid mutation restoration, unknown/empty selection, missing Python denominator refusal, unexecuted file inclusion, JS-before-Python ordering, unknown suite refusal and source identity/file/content changes.
- `audit_maintainability_measurement.py`: all nine existing tests passed.
- `audit_checked_contracts.js`: six checked entries and six wrong-call refusals passed.
- `audit_coverage_js.js`: original mapped statement/branch attribution and unexecuted-file checks passed.
- Complete existing mutation pilot rerun: 16 killed, zero survived/timeout/invalid, no baseline failures.
- Instrumented smoke: three selected suites passed; all maintained Python files retained and input hashes bound. This is a subset diagnostic, not a new complete-coverage claim.
- Complexity ratchet passed without baseline or cap changes. Required exact-head GitHub checks remain mandatory before merge.

Original baseline and Phase 1 result records remain intact as provenance. Their previously published results are not relabeled as newly measured source-bound results. Corrections and reproduction logs were retained outside the source checkout. Phase 2 will use the corrected tools for new measurements.
