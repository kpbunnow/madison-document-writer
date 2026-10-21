# Verification and release process

From a fresh source copy, run:

    npm ci
    python3 -m pip install --require-hashes -r requirements-dev.txt
    npx playwright install chromium
    python3 tools/build.py
    python3 tools/verify_release.py

Playwright is pinned in package-lock.json. On an offline development machine, set `DW_BROWSER` to an independently installed compatible Chromium executable instead of downloading a browser. The runner launches the selected browser before any suite. A missing or unusable browser produces one message naming both setup options. A browser download failure is not a passing check; use the documented alternative only if a usable browser is actually available.

Build and test commands read app/, helper/, policy/, tests/, tools/ and docs/ directly. There is no flat copy of source and no source-map registration. Generated modules, runtime_identity.py, compiled policy, bundles, evidence and caches live under build/. Imports into helper and policy modules are resolved by the test runner's explicit PYTHONPATH. Test discovery reads tests/unit/ in place; production workflow suites remain in tests/browser/ and are invoked by the complete Chromium audit. Add files through normal imports, test discovery and the deployment manifest as appropriate. tests/README.md indexes every suite by feature; list a new suite there (a repository test enforces it). Browser workflow suites are added as one row of the browserSuites table in tests/browser/audit_browser.js. JavaScript suites call bundle functions by their top-level names, so a function does not need to be exported for a test; export only what another module imports (the four test-build hooks in app_core.js are the exception). JavaScript suites read the built page and its embedded bundle through tests/fixtures/built_bundle.cjs (builtPage, bundleSource); tests/fixtures/bundle_test.cjs also creates a standard DOM for short suites.

The gate includes ESLint on app/modules and shared.js, TypeScript contracts, Ruff pyflakes rules (F), Vulture at 60 percent confidence with individually justified framework whitelist entries, formatting, all retained suites plus R51 regressions, and fresh production Chromium, axe and PDF checks. Each regression suite has a 150-second deadline. tools/run_tests.py runs most suites in a small worker pool (DW_TEST_WORKERS overrides the default of up to four); suites that launch Chromium run one at a time afterwards, and the measured performance suites run last and alone. Browser workflow suites retain all assertions and have explicit individual deadlines. Do not relax deadlines or remove assertions to obtain a passing release.

Print checks compare 69 authored document variants, the frozen stylesheet and all four court copies exactly against the retained verified R49 runtime. Pagination checks require page bounds, no overflow or clipped content, complete continuation headers and preserved authored content. Authoring-9 snow covers are tested with controlled font metrics producing one and two cover pages; their rendering is unchanged. Native City printing including an R33-era snow citation remains an open acceptance item.

The R51 shell parity test follows the explicitly listed substitution model described in `docs/history/R51-REVIEW.md`. For an intentional screen CSS correction, document the exact difference and require that exact replacement once in each affected shell before reversing it for comparison with the unchanged historical hash. Do not regenerate the reference hash or strip arbitrary CSS. The current reviewed exception removes only the shared button background transition so text and background switch themes together; the border transition remains. Missing or altered correction bytes and unrelated shell changes still fail. The approved print stylesheet and historical PDF fixtures remain frozen and are checked separately by the production browser audit. Application code has no whole-bundle hash to update; code changes are checked through their rendered output, print and court-copy parity and the regression suites.

Browser audits bring the page being inspected to the foreground. On system Chromium 154, a ten-click/fill diagnostic took about 15.2 seconds after another tab opened, versus 0.36 seconds after `bringToFront()`. Foreground the Writer again after Reports and restoration-profile work; keep measured browser suites serial and retain their existing deadlines.

Fingerprints bind evidence to maintained source and production output before and after verification. Archive material, dependencies, generated evidence and caches are excluded from maintained source. Packaging refuses a changed tree, missing suites or changed browser hashes. Releases have no signing key; do not introduce one or alter release trust.

After a passing gate, package to a new folder outside the source tree:

    python3 tools/package_release.py --output ../release

Release packaging: tools/package_release.py writes runtime-manifest.json for every deployed file through tools/deploy_manifest.py, then rechecks the finished deploy folder with helper/verified_update.py. audit_r50_updates.py, audit_r51_updates.py, audit_r51_bootstrap.py, audit_r50_connections.py and audit_r52_manifest.py cover the manifest, tamper classes, downgrade protection and the launcher hand-off.

Automated axe does not establish WCAG conformance. City Windows, ACL/SMB/SQL, Outlook, native printing, staff tasks, legal and seasonal decisions remain in ACCEPTANCE-RECORD.md. Never mark those items accepted from automated checks.

## Source ownership and deployment evidence

`tools/source-inventory.json` lists every maintained source-package file. Review and stage additions/deletions, then run `python3 tools/release_inputs.py --update-source-inventory` and review/stage the inventory diff. Unexpected maintained files refuse packaging; local credentials, environments, operational folders and caches are excluded before reading and cannot be registered. Links/reparse points in owned inputs are refused. This inventory also works in extracted source ZIPs without Git; root SHA256SUMS.txt is generated archive metadata, not maintained input. Uncommitted content changes still require fresh exact-byte verification and reviewed checkpoints.

The gate fingerprints all mapped deployment inputs, vendored runtime bytes and generated release records. Packaging checks them before output, after copy and before archives, retaining the installer manifest verifier. `audit_release_inputs.py` exercises the real packager with isolated synthetic inputs, including altered generated policy/identity/guidance and private files.

The manual Markdown is authoritative. Before verification, run `python3 tools/build_manual.py` with pandoc and the pinned Playwright browser available to regenerate HTML, Word and PDF. The 22 chapter anchors and original screen/print style are retained. Manual editions are committed inputs; the gate never regenerates them.
