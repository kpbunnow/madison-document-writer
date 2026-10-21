# Cloud development

Run commands from the repository root. Application source is at the root, not in
a nested `source/` directory. `version.json` and the actual scripts are
authoritative for current identity and packaging behavior. Keep virtual
environments, caches, browsers and release output in a runtime folder outside the
checkout; `$RUNTIME` below stands for that folder.

## Setup

Use Node.js, Python 3.12 and Chromium. Dependency versions are pinned by
`package-lock.json` and hash-checked `requirements-dev.txt`. Recorded cloud
environments: the R53 import used Node 24.19.0, Python 3.12.14 and system
Chromium 154.0.8037.57; R54 verification used Node 22.22.0, Python 3.12.3 and
Chromium 141.0.7390.37 through `DW_BROWSER`.

```sh
python3 -m venv "$RUNTIME/venv"
export PATH="$RUNTIME/venv/bin:$PATH"
npm ci --cache "$RUNTIME/npm-cache"
python3 -m pip install --require-hashes -r requirements-dev.txt
```

Prefer the browser selected by the pinned Playwright installation:

```sh
export PLAYWRIGHT_BROWSERS_PATH="$RUNTIME/browsers"
npx playwright install chromium
unset DW_BROWSER
```

That download needs `cdn.playwright.dev` and any redirect destinations actually
reported by the downloader. If blocked, report the denial. The documented fallback
is `DW_BROWSER` set to an installed Chromium executable, for example
`export DW_BROWSER=/usr/bin/chromium`; its results must identify that browser.
Do not disable TLS or artifact verification. No operational credentials are needed
for the synthetic local baseline tests.

## Verification and checkpoints

```sh
node tools/check_browser.cjs
python3 tools/build.py
python3 tools/verify_release.py
```

The gate runs formatting, static checks, regression suites and production Chromium,
axe and print audits. It starts its own local services; no persistent service is
required. Do not run concurrent Chromium jobs during performance measurements.
Read current `build/test-results/results.json` and
`build/verification/latest/` logs; distinguish failed, unrun and passed checks.
Never relax deadlines or assertions. `PRODUCTION-READINESS.md` and
`ACCEPTANCE-RECORD.md` list unresolved requirements. `docs/history/R53-BASELINE.md` records the original import and its
first verification result.

Before each checkpoint, inspect `git status`, review the diff and staged paths,
and keep unrelated work intact. Preserve release identity until separately
authorized release development. Record failures honestly in the PR. Re-run the
gate after source changes; evidence is bound to exact inputs. Keep case records,
generated PDFs, local settings, secrets and private keys outside the checkout.
The committed `tests/fixtures/` and `helper/vendor/` are required source inputs,
not disposable local data or dependency caches.

## Packaging

Only after the unchanged full gate passes for the final tree:

```sh
python3 tools/package_release.py --output "$RUNTIME/releases"
```

Choose a new output directory if a release already exists. The manifest model
uses file sizes and SHA-256 and rechecks the staged deployment with the existing
installer verifier. Do not introduce a key or alter release trust. Development
work does not authorize packaging, deployment or City acceptance. Windows,
NTFS/SMB/SQL, Outlook and native printing still require their real environments.
