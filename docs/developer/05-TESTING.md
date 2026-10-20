# R51 verification and release process

From a fresh source copy, run:

    npm ci
    python3 -m pip install --require-hashes -r requirements-dev.txt
    npx playwright install chromium
    python3 tools/build.py
    python3 tools/verify_release.py

Playwright is pinned in package-lock.json. On an offline development machine, set `DW_BROWSER` to an independently installed compatible Chromium executable instead of downloading a browser. The runner launches the selected browser before any suite. A missing or unusable browser produces one message naming both setup options. A browser download failure is not a passing check; use the documented alternative only if a usable browser is actually available.

Build and test commands read app/, helper/, policy/, tests/, tools/ and docs/ directly. There is no flat copy of source and no source-map registration. Generated modules, runtime_identity.py, compiled policy, bundles, evidence and caches live under build/. Imports into helper and policy modules are resolved by the test runner's explicit PYTHONPATH. Test discovery reads tests/unit/ in place; production workflow suites remain in tests/browser/ and are invoked by the complete Chromium audit. Add files through normal imports, test discovery and the deployment manifest as appropriate.

The gate includes ESLint, TypeScript contracts, pyflakes, Vulture at 60 percent confidence with individually justified framework whitelist entries, formatting, all retained suites plus R51 regressions, and fresh production Chromium, axe and PDF checks. Each regression suite has a 150-second deadline. Browser workflow suites retain all assertions and have explicit individual deadlines. Do not relax deadlines or remove assertions to obtain a passing release.

Print checks compare 69 authored document variants, the frozen stylesheet and all four court copies exactly against the retained verified R49 runtime. Pagination checks require page bounds, no overflow or clipped content, complete continuation headers and preserved authored content. Authoring-9 snow covers are tested with controlled font metrics producing one and two cover pages; their rendering is unchanged. Native City printing including an R33-era snow citation remains an open acceptance item.

The R51 shell parity test follows the explicitly listed substitution model described in `R51-REVIEW.md`. For an intentional screen CSS correction, document the exact difference and require that exact replacement once in each affected shell before reversing it for comparison with the unchanged historical hash. Do not regenerate the reference hash or strip arbitrary CSS. The current reviewed exception removes only the shared button background transition so text and background switch themes together; the border transition remains. Missing or altered correction bytes and unrelated shell changes still fail. The approved print stylesheet and historical PDF fixtures remain frozen and are checked separately by the production browser audit.

Browser audits bring the page being inspected to the foreground. On system Chromium 154, a ten-click/fill diagnostic took about 15.2 seconds after another tab opened, versus 0.36 seconds after `bringToFront()`. Foreground the Writer again after Reports and restoration-profile work; keep measured browser suites serial and retain their existing deadlines.

Fingerprints bind evidence to maintained source and production output before and after verification. Archive material, dependencies, generated evidence and caches are excluded from maintained source. Packaging refuses a changed tree, missing suites, changed browser hashes or an invalid signature. Use the release owner's existing private key outside source; do not substitute a new key to bypass an installed trust pin.

After a passing gate:

    python3 tools/package_release.py --output ../release --key /private/owner.pem

Release packaging (no signing key): tools/package_release.py writes runtime-manifest.json for every deployed file through tools/deploy_manifest.py, then rechecks the finished deploy folder with helper/verified_update.py. audit_r50_updates.py, audit_r51_updates.py, audit_r51_bootstrap.py, audit_r50_connections.py and audit_r52_manifest.py cover the manifest, tamper classes, downgrade protection and the launcher hand-off.

Automated axe does not establish WCAG conformance. City Windows, ACL/SMB/SQL, Outlook, native printing, staff tasks, legal and seasonal decisions remain in R51-ACCEPTANCE-RECORD.md. Never mark those items accepted from automated checks.
