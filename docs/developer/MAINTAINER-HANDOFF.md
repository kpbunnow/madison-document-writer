# Independent maintainer handoff runbook

Purpose: reproduce setup, locate a bounded change and explain refusals using synthetic data. This is an engineering exercise, not City/native/staff acceptance or a replacement for required checks. [Current assessment](MAINTAINABILITY-ASSESSMENT.md), [code map](02-CODE-MAP.md), [hotspots](HOTSPOT-REGISTER.md), [rule inventory](../../tools/policy-compatibility.json), [testing](05-TESTING.md) and [development standard](DEVELOPMENT-STANDARD.md) are the navigation entry points.

## Clean setup (Linux/cloud exercise)

Start from a clean clone of the specified candidate commit, not a copy of another developer's build or node_modules. A separate local clone is acceptable for this exercise; record its local origin and original GitHub source. No worktree is required. Select an installed **Python 3.14.10** interpreter explicitly: the cloud's default python3 may still be 3.12 and cannot parse current source. If no suitable interpreter is installed, follow CLOUD-DEVELOPMENT/package guidance before proceeding; do not interpret syntax/setup failure as an application bug.

Set these three absolute paths to separate locations outside the clone. They are reviewer-specific inputs, not values to paste from another maintainer's session:

```sh
export DW_HANDOFF_PYTHON=/absolute/path/to/python3.14
export DW_HANDOFF_RUNTIME=/absolute/path/to/fresh-review-runtime
export DW_HANDOFF_ARTIFACTS=/absolute/path/to/synthetic-review-evidence
"$DW_HANDOFF_PYTHON" -c 'import sys; assert sys.version_info[:3] == (3, 14, 10); print(sys.version.split()[0])'
node --version
command -v pdftotext
command -v pandoc
```

Use Node **24.22.3** (CI's pin), and pdftotext for full manual/PDF checks. Pandoc is needed if changing/regenerating the staff manual; no manual change is part of this exercise. Find compliant installed tools or install from the documented trusted package sources. Record actual versions. Do not reuse Python 3.12, silently skip a missing tool, loosen package hashes, disable TLS or alter approved locks/vendor files.

From the clone root:

```sh
mkdir -p "$DW_HANDOFF_RUNTIME" "$DW_HANDOFF_ARTIFACTS"
"$DW_HANDOFF_PYTHON" -m venv "$DW_HANDOFF_RUNTIME/venv"
export PATH="$DW_HANDOFF_RUNTIME/venv/bin:$PATH"
npm ci --cache "$DW_HANDOFF_RUNTIME/npm-cache"
python3 -m pip install --require-hashes -r requirements-bootstrap.txt
python3 -m pip install --require-hashes -r requirements-dev.txt
export PLAYWRIGHT_BROWSERS_PATH="$DW_HANDOFF_RUNTIME/browsers"
npx playwright install chromium
unset DW_BROWSER
export PYTHONPATH="$PWD/helper:$PWD/tools:$PWD/policy:$PWD/tests/unit:$PWD/tests/fixtures:$PWD/build/generated"
export DW_PYTHON="$(command -v python3)"
export PYTHONIOENCODING=utf-8
export PYTHONDONTWRITEBYTECODE=1
export TZ=America/Chicago
node tools/check_browser.cjs
```

A preinstalled compliant interpreter, read-only download cache or Playwright-pinned browser cache may be reused if disclosed. **Still execute npm ci and Python --require-hashes installation into the fresh environments**; no node_modules/venv symlink to the author's environment. For a shared browser cache, set PLAYWRIGHT_BROWSERS_PATH to that cache before the install/check, verify the exact selected browser and disclose reuse. The preferred current pinned Chromium is 156.0.8078.4 through Playwright 1.64.1. If download is denied, record the denial; the documented system DW_BROWSER fallback must be labeled and never substituted silently for pinned CI acceptance. Local loopback tests require a sandbox/network policy permitting loopback sockets; record policy/setup refusals separately from application failures.

Individual Python suites require the PYTHONPATH above. The full runner prepares its own paths, but direct commands do not. PATH must keep the new venv first so Node-spawned python3 also uses 3.14 with the frozen dependencies.

## Production versus fixture builds

First prove the ordinary build. Then keep production output separate before building fixture-only bundles, because some unit suites need test exports while others explicitly inspect production output:

```sh
python3 tools/build.py
mkdir -p "$DW_HANDOFF_ARTIFACTS/production"
cp build/dist/madison-document-writer.html build/dist/madison-reports.html "$DW_HANDOFF_ARTIFACTS/production/"
export DW_PRODUCTION_DIR="$DW_HANDOFF_ARTIFACTS/production"
DW_TEST_BUILD=1 python3 tools/build.py
node tests/unit/audit_module_boundaries.js
node tests/unit/audit_checked_contracts.js
python3 tests/unit/audit_runtime_imports.py
```

Fixture bundles are never deployment artifacts. The complete `python3 tools/verify_release.py` runs its own production/fixture lifecycle and restores production output; local full verification is optional before a development PR, but the full exact-head GitHub gate is mandatory. Do not nest a full runner inside an active gate: use its documented read-only browser precheck. Do not run measured browser suites concurrently.

## A bounded change exercise

Choose a small non-legal rule or presentation change in an affected actual owner. Do not change approved wording, a print style, release identity, issued facts, stored format, dependency lock or frozen reference. Describe intended behavior first, locate its owning function and required tests from the map/inventory, add a focused meaningful probe, and show that it detects the old behavior before changing the owner. Perform this in the review clone only; retain a diff and test evidence. Do not push the exercise or use it to change product policy.

Record the exact files examined/changed, why the owner owns the change, which peers remained untouched, and any deliberately affected behavioral-oracle expectation. A temporary proposed rule change is not an approved product rule: report an expected oracle disagreement rather than editing the old oracle/hash to conceal it. Finish by saving the patch outside the clone and restoring the candidate so the following failure exercises test the documented baseline. Record clean status and source SHA after restoration. Do not use whole-app evaluation when the owner has a direct seam unless the scenario genuinely needs integration state.

## Three refusal/recovery diagnostics and an import/save trace

Start with the representative suites below, inspect their assertions and then execute an isolated reproduction through the actual owner(s). Do not substitute a fabricated error string. For each exercise capture safe error class/code/message, public result, retained state, refused effects and the source/test owners. A mocked peer is appropriate to force a network/storage boundary; disclose it. Native process death, NTFS/SMB, City connectivity and Outlook are separate acceptance work.

| Exercise | Ownership and representative commands | What a complete reproduction must establish |
| --- | --- | --- |
| Unavailable helper | `helper_transport.authFetch`, `helper_requests.createHelperRequests`; `node tests/unit/audit_record_helper_adapters.js` and `node tests/unit/audit_desktop_exit.js` | Force the synthetic fetch peer to reject, or a safe isolated loopback endpoint to be unavailable; record the actual propagated failure and show no false successful save or loss of retained device work. Distinguish transport failure, a session 403 and deliberate stopped state. Never print request headers or bootstrap/session tokens. |
| Rejected source/integrity proof | `record_integrity`, `case_integrity.verify_record`, `integrity_verification`, `case_store`; `python3 tests/unit/audit_r31_integrity.py` and `node tests/unit/audit_record_helper_adapters.js` | Build a synthetic valid case/proof, alter source or proof, observe the real rejection, and verify the original bytes/head remain. Identify the first failing checkpoint, independent helper authority and historical read rules. Do not edit a case/registry/anchor to repair a refusal. |
| Pending/uncertain save or interrupted recovery | `pending_case_saves`, `case_save_workflow`, `draft_persistence`, helper store/receipts; `node tests/unit/audit_storage.js` and `python3 tests/unit/audit_r31_integrity.py` | Force failed/uncertain write or retained recovery intent through the real owner. Show pending work/intent survives and is not called saved; on authorized retry use current work and retained identity. Report completed/held/refused effects separately. A browser queue test is not native interruption evidence. |
| Trace a refused import/save | `accela_import`, `case_save_workflow`, `shared_case_storage`; `node tests/unit/audit_feature_accela_import.js` and `node tests/unit/audit_r50_errors.js` | Follow one concrete refusal from user intent/selection through readiness, helper/source validation or serialization. Record where processing stops and show no write/acknowledgment beyond that barrier. Locate applicable domain rule and regression, not just the message. |

A test suite completing is supporting evidence; the reviewer must explain the specific path, observed state and absent side effects. The import source is fixed SSRS XML, not SQL/XLSX upload. Current case schema 5 requires helper integrity; direct folder fallback cannot be enabled to make the exercise succeed. Workspace backup 2 and draft recovery envelope 1 are different contracts. Mandatory-appearance drafts can retain an empty deposit while issuance stays held.

## Sanitized evidence and independent-review record

Use generated synthetic owner/case/addresses only. Create case/anchor/recovery folders in a fresh temporary directory outside source; do not load installed settings or browse real shared folders. Before retaining logs, inspect them. Keep only this allowlisted evidence: source commit/tree and input digests, actual tool versions, synthetic scenario ID, owner/function, command/exit status, elapsed time, safe expected error, pre/post synthetic state digest/count, asserted refused/retained effects, investigated/changed repository paths and assistance. Replace reviewer-local root paths with `<REVIEW_ROOT>` in portable reports. No environment dumps, authenticated URLs, tokens/headers, user-profile paths, live hosts, connection settings, operational JSON/PDF or real names/addresses.

Record reviewer identity/type, independence from implementation author, candidate commit, working-tree state, start/end/elapsed **active work versus setup/waiting**, cache reuse, commands, expected and unexpected outcomes, incorrect assumptions, every assistance exchange and material runbook defect. Save sanitized diffs/receipts. Material defects require an author correction and an affected exercise repeated on the corrected candidate; label which evidence was repeated versus carried forward. An AI reviewer is independent from the implementation author for this exercise, not a human or City acceptance assessor. If no independent reviewer is available, leave that result pending and do not award maximum handoff/documentation scores.

Before proposing merge: restore the canonical checkout, review diff/status/source inventory, run affected local guards including `audit_development_workflow.py`, `audit_release_inputs.py`, `audit_utf8_io.py`, and require Full gate, PR format, security and Windows recovery on the exact PR head. Source-bound diagnostics and the throwaway exercise never authorize packaging or deployment.
