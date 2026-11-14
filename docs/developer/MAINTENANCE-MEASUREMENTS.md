# Source-bound maintenance measurements

These procedures measure maintenance diagnostics. They never replace the Full gate or packaging evidence. Read the [handoff setup](MAINTAINER-HANDOFF.md) first. Use the current frozen application runtime plus a separate analysis environment. Run from the repository root, with output outside the checkout. Do not edit, commit, switch branches or update the source inventory during a measurement; changed source invalidates the receipt.

```sh
python3 -m venv "$DW_HANDOFF_RUNTIME/analysis-venv"
"$DW_HANDOFF_RUNTIME/analysis-venv/bin/python" -m pip install --require-hashes -r tools/analysis-requirements.txt
export DW_ANALYSIS_PYTHON="$DW_HANDOFF_RUNTIME/analysis-venv/bin/python"
mkdir -p "$DW_HANDOFF_ARTIFACTS/metrics"
python3 tools/measure_maintainability.py --analysis-python "$DW_ANALYSIS_PYTHON" --out "$DW_HANDOFF_ARTIFACTS/metrics/current"
python3 tools/hotspot_inventory.py "$DW_HANDOFF_ARTIFACTS/metrics/current/metrics.json" > "$DW_HANDOFF_ARTIFACTS/metrics/current/hotspots.json"
python3 tools/measure_duplication.py --out "$DW_HANDOFF_ARTIFACTS/metrics/clones.json"
```

Use a Python 3.14.10 analysis interpreter: older Python cannot parse this source. The hash-locked Radon/coverage packages are diagnostic dependencies, not application dependencies. No new lock is introduced. Preserve raw JSON and SUMMARY.md together. `hotspot_inventory.py` takes its complexity from the supplied metrics file but reads the current AST; run it immediately against the same unchanged source. Bind both files by SHA-256 in a receipt, as Phase 6 does.

## Compare the same scope

The original strict baseline is `6e90380af8b31536c5d7371aa08fb5b59a5c500b`. The Phase 2 implementation start is `3183bff1a529b655a4e2f6b1e1d79f76bc8610cf` with review corrections delivered in #513. The Phase 6 start is `dd584ce02f1375031da7935d6015e82d1f3778a0`. Use full Git history when comparing them.

```sh
python3 tools/measure_maintainability.py --analysis-python "$DW_ANALYSIS_PYTHON" --scope-commit 6e90380af8b31536c5d7371aa08fb5b59a5c500b --out "$DW_HANDOFF_ARTIFACTS/metrics/original-file-cohort"
```

`--scope-commit` filters **current files tracked at the baseline**, not historical source content and not unchanged functions. It cannot prove improvement of the same functions after moves. Retain both complete-current and baseline-file cohorts; record moves with [the frozen debt cohort](maintainability/baseline-cohort-2026-11-14.json). Structural cycles, service areas and seams still describe the whole current checkout. Phase 7 must explicitly map unchanged/moved functions and include new leaves/tools; a better average from adding small files is not evidence of simpler old functions.

JavaScript uses ESLint lexical identities, with separate complexity/length/nesting series; anonymous identity collisions are recorded limitations. Python Radon flat CLI, complete methods/closures and Ruff C901 are distinct. MI exists here for Python only. Radon's Unicode-separator compatibility copy must preserve AST and LF count. Never invent JS or blended MI.

## Coverage, types and mutation detection

```sh
python3 tools/measure_coverage.py --analysis-python "$DW_ANALYSIS_PYTHON" --workers 2 --out "$DW_HANDOFF_ARTIFACTS/coverage"
python3 tools/mutation_pilot.py --out "$DW_HANDOFF_ARTIFACTS/mutations.json"
node tests/unit/audit_checked_contracts.js
```

Coverage copies source and retains every maintained file, including unexecuted ones. JavaScript statements/branches use Node inspector/source-map attribution; Python uses coverage.py and subprocesses. **Code executing inside Chromium is not measured.** Browser-launching suites remain serial. A `--suites` subset is a diagnostic subset, never complete coverage; record requested/actual suites, failures, skips and denominator. JS high-risk, JS runtime, Python high-risk/runtime/developer groups are explicit in `tools/coverage-groups.json`. Do not suppress a file because the collector missed it.

The last complete coverage record is [Phase 1](MAINTAINABILITY-PHASE1-2026-11-14.md), not a current-source result: JS runtime statements 80.3% (target 85%), Python high-risk 82.6% / 79.6% (target 90% / 85%), developer 62.0% / 63.5% (target 80% / 70%). It predates diagnostic fixes in [the review record](MAINTAINABILITY-PHASE1-REVIEW-2026-11-14.md). Preserve provenance; do not rebrand it as fresh verified coverage.

The checked entry list is `tools/checked-js.json`, currently six files. Wrong calls must fail at their own probe; build completion alone is not type assurance. No locked Python checker exists yet. Mutation pilot receipts distinguish normal detected failure, survivor, timeout and invalid syntax/process outcome. Unknown/empty selections fail. Inspect counts and every baseline result; CLI completion by itself does not prove detection. Phase 5 detected 31/31 targeted mutations; that is not a global mutation score. Never count a signal, timeout, spawn error or invalid code as a detected regression.

## Duplication and evidence limits

Lexical candidates use exact identifiers/literals and Python logical indentation, default 80 tokens / 8 lines. Comments/spacing, tests, frozen references, generated/vendor files, CSS/HTML/SQL and cross-language/semantic matching are excluded. Hash matches require actual token comparison. Candidate overlap is not summed as a percentage. Review each candidate as accidental, intentional policy mirror, historical implementation or deferred debt with an owner/reason. Phase 5's one retained case/index refusal fragment preserves distinct write authorities; do not combine it merely to reduce a count.

Keep source commit/tree/clean state, scoped input hashes/digest, complete measurement input digest, actual toolchain, thresholds, selected suites, unsupported execution and raw receipt hashes. A diagnostic artifact does not become gate or City evidence because it has a hash. All twenty original scoring criteria and weights stay unchanged; Phase 7 awards scores only from demonstrated current evidence.
