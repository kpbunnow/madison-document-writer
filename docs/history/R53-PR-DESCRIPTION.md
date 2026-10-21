# Establish R53 development baseline

The repository previously contained an R53 release ZIP and an R54 development
prompt without editable application source. This imports the complete R53
maintained source at the repository root so development and verification can
run directly from the checkout. R54 is not implemented.

## Import inventory

- Imported all 430 `source/` files, including 223 test/fixture files, all 77
  fixtures and all 12 vendored files, with per-file size and SHA-256 inventory
  in `docs/import/R53-INVENTORY.json`.
- Preserved R53 application behavior, release identity, dependency pins,
  synthetic/frozen fixtures, documentation and release trust. Both rebuilt
  production HTML files match the archived R53 deployment byte for byte.
- Moved the R54 markdown unchanged into `docs/development-prompts/` and removed
  the ZIP after checking completeness. Generated `deploy/` was not imported
  as source; the original ZIP remains available in Git history.
- Retained the source `.gitignore` rules and developer instructions, added
  operational-data/secret/cache exclusions, and added `AGENTS.md` and cloud
  setup, checkpointing and packaging guidance. No existing AGENTS file was
  present. All inventoried files remain tracked.

## Verification

- Passed: frozen npm install, hash-checked Python dependency installation,
  production build, formatting/static checks and all 128 regression suites.
- Failed: production-browser axe audit at `reinspection-compact-dark`, with
  three color-contrast nodes (1.09:1, 2.32:1, 1.09:1 against 4.5:1). It executed
  48 axe screens, 47 passing. Later browser/print checks were not reached;
  the complete gate exited 1. This also occurred in the temporary R53 copy.
- Pinned Playwright Chromium 145 download was denied by network policy at
  `cdn.playwright.dev`. The documented system Chromium 154 fallback was used;
  browser compatibility remains to be checked against the pinned version.
- No tests, assertions, deadlines, checksums or security controls were relaxed.
  No release packaging, deployment, City acceptance or R54 changes are claimed.

Details and machine-readable evidence are in `docs/import/R53-BASELINE.md` and
`docs/import/R53-VERIFICATION.json`. Re-run source-bound release evidence after
final source changes; these import reports are not passing release evidence.

## Remaining setup requirements

- Apply the saved browser-domain network setting, install pinned Chromium and
  rerun the unchanged full gate; investigate any persistent contrast failure
  in a separate coding task.
- Git operations and branch push work, but GitHub API access returns Forbidden.
  API access must work to create this PR automatically.
- Review/save the updated environment install/start draft against the imported
  root and publish when appropriate. It includes `api.github.com` alongside
  the existing browser download domain. Draft saving alone does not activate
  network access or publish the environment.
- Windows, City SMB/SQL/SSRS, Outlook, native printing and legal/City acceptance
  remain external checks. Do not package until current complete verification
  passes. Keep R53 manifest verification and deployment trust unchanged.

Do not merge automatically.
