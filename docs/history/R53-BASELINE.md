# R53 development baseline import

The authoritative input was `Madison-Building-Inspection-2026-10-19-R53.zip`,
SHA-256 `2d86f9276d5042782122975388a5d4547eaf25570f291caa7f8e05cb080513e4`.
Workspace shell commands and connected Git read/write operations succeeded.
Both that ZIP and the supplied R54 markdown were present before import.

## Inventory and preservation

Imported all 430 files (26,592,459 bytes) under the archive's `source/` directly
at repository root. `R53-INVENTORY.json` records every original path, size and
SHA-256. Extraction rejected escaping paths, symlinks and duplicate source paths.
All imported files were checked byte for byte before the ZIP was removed.
The archive remains backed up outside the checkout on this machine; the original
upload also remains in Git history. The ZIP is absent from the resulting tree.

| Maintained directory | Files |
| --- | ---: |
| app | 64 |
| helper | 44 |
| policy | 36 |
| tests | 223 |
| tools | 16 |
| docs | 34 |
| Root manifests, configuration and documentation | 13 |

The import includes all 77 fixture files, frozen reference data and runtimes,
all 12 vendored dependency/license files (including Windows wheels), staff
manuals and developer guides. The archive's `deploy/` is generated deployment
output, so it was not imported as a second source tree.

The original repository had no `.gitignore` or `AGENTS.md`. The source archive's
`.gitignore` was preserved and extended; original developer instructions remain
verbatim and are referenced by the new `AGENTS.md`. The uploaded root README
was replaced with the authoritative source README, preserving even its older
R51 heading. `CLOUD-DEVELOPMENT.md` explains legacy documentation discrepancies
without rewriting R53. The original `SHA256SUMS.txt` remains provenance for
the archived source; its `.gitignore` entry intentionally differs after the
documented additive exclusions. It is not a checksum of this expanded Git tree.

The R54 markdown moved without content changes to `docs/development-prompts/`.
No R54 work was implemented. Application source, tests, fixtures, vendored files,
dependency pins, policy, release identity and trust configuration remain unchanged.
Release is `2026-10-19 R53`, helper `2026.10.19.54` / build 54, authoring 11,
case schema 5, summary 6 and backup 2.

Operational records, secrets, private keys, caches and reproducible dependency
installations are excluded. No imported fixtures or vendor files were dropped
by the ignore rules. Existing inherited whitespace and line endings were kept;
Git whitespace diagnostics on imported files were not fixed by changing bytes.

## Actual baseline verification

From the imported repository, installed with `npm ci` and Python
`pip install --require-hashes -r requirements-dev.txt`, then ran
`python3 tools/build.py` and `python3 tools/verify_release.py` with the external
virtual environment active and `DW_BROWSER=/usr/bin/chromium`.

- Build passed. Both production HTML outputs are byte-identical to the ZIP's
  R53 deployment outputs.
- Formatting, ESLint, TypeScript contracts, pyflakes and Vulture passed.
- All 128 existing regression suites passed, with their existing deadlines.
- The production browser audit executed 48 axe screens: 47 passed, then
  `reinspection-compact-dark` failed on three `color-contrast` nodes.
  `#btn-savework` and `#btn-risave` measured 1.09:1;
  `button[data-riwalk="on"]` measured 2.32:1, below 4.5:1.
- The full verification command exited 1. Later production-browser, layout
  and print checks after that assertion were not reached. No release package
  was produced, and no passing release evidence is claimed.

See `R53-VERIFICATION.json` for machine-readable results and runtime hashes.
Full local logs remain in ignored `build/verification/latest/` and
`build/test-results/`. Results describe the imported code and setup-guide
checkpoint; the final changes add this report and local-data ignore entries.
Source-bound evidence must be regenerated for any future release package.
No test assertions, deadlines, expected bytes, checksums or security controls
were weakened to produce these results.

## Remaining setup and acceptance requirements

1. Pinned Playwright Chromium 145 could not download: `cdn.playwright.dev`
   returned HTTP 403 `Domain forbidden`. System Chromium 154 is the documented
   fallback used above. Apply the saved network settings and retry the pinned
   browser and unchanged gate using `CLOUD-DEVELOPMENT.md`. Browser-version
   contribution to the contrast failure remains unconfirmed; do not infer that
   the import introduced it (the temporary R53 copy failed identically).
2. GitHub Git access and branch pushing work, but GitHub API requests return
   `Forbidden`. PR creation requires usable API access. The requested title and
   full PR description are prepared in `R53-PR-DESCRIPTION.md`.
3. Environment install/start instructions were saved against the imported
   repository root, replacing the old temporary-ZIP workflow. The draft also
   preserves `cdn.playwright.dev` and adds `api.github.com`. Saving a draft does
   not apply runtime access or publish it. Review/save settings and publish when
   appropriate; the import branch must be available before running its setup.
4. Windows installation, deployment permissions, SMB/SQL/SSRS, Outlook, native
   printing, legal holds and City acceptance still need their actual systems
   and authorized reviewers. Synthetic tests do not provide that acceptance.

Do not package until the unchanged complete gate passes for the exact final
source. Preserve R53's manifest model and installed verification boundaries.
