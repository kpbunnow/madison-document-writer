# R65 release review

Release 2026-10-30 R65, helper 2026.10.30.66 (build 66), authoring 16; case schema 5, summary 6 and workspace backup 2 unchanged. R65 follows R64 (2026-10-30, helper build 65). This review is release evidence, not City acceptance.

## Contents since R64

- **Repository hygiene** (PR #353): GPL-3.0 license, SECURITY.md, CODEOWNERS and Dependabot configuration; version notes moved under docs/developer.
- **Development tool updates** (PRs #354, #356, #358, #359): typing-extensions, axe-core, prettier and exceptiongroup; the esbuild, ruff and jsdom updates (#355, #357, #360) were closed for separate review. None ships in the runtime.
- **Agent guide and queue label** (PR #361): docs/agents/README.md; the Workspace queue's filing button reads Open document to file PDF.
- **Open cases by inspector** (PR #362): `GET /cases/by-inspector`, the picker in Search shared case records and the import prompt.
- **Reinspection Notice** (PR #363): importable Reinspection and No Fee Reinspection results, the new document type with fixed due dates, helper validation and the Reinspection status.

## Identity and publication

- version.json, package.json and package-lock.json carry the R65 identity; tools/version_schema.py validates it (matching release/helper dates, helperBuild 66).
- Publication baseline: the owner chose the R64 package as the published baseline; R65 is packaged against the retained R64 deployment manifest with `--published-manifest`.
- The owner chose to keep authoring at 16: the Reinspection Notice is a new document type that does not change how any existing document is written or printed, the authored-print baseline matches byte for byte for all 69 retained variants, and nothing in the program reads the authoring number to protect an older installation (the case schema does that).

## Compatibility and rollback

- A Reinspection Notice is a document type R64 does not know. Install R65 on every PC that uses the shared case folder before issuing one. Rolling back to R64 after a Reinspection Notice has been issued would leave that document unreadable to the older helper; retain its original PDF and do not roll back without administrator review. Cases without a Reinspection Notice are unaffected, and rolling back to R64 otherwise needs no data migration.

## Acceptance

R65 adds S65-1 through S65-3 (ACCEPTANCE-RECORD.md): open cases by inspector on a City case-folder copy, Reinspection Notice creation with wording approval, and printing, mailing and filing of a notice written after the due dates have passed. S60–S64 and all carried City, native, staff, legal and seasonal items remain OPEN. Automated verification records technical evidence only.
