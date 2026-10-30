# R64 release review

Release 2026-10-30 R64, helper 2026.10.30.65 (build 65), authoring 16; case schema 5, summary 6 and workspace backup 2 unchanged. R64 follows R63 (2026-10-24, helper build 64). This review is release evidence, not City acceptance.

## Contents since R63

- **Maintainability plan, batches B1–B13** (PRs #330–#342): behavior-preserving splits of the largest functions and factories behind retained-original comparisons, a split-literal ratchet (screen modules at zero), a classified evaluator baseline, an exception register and a maintainability contract (MAINTAINABILITY-ASSESSMENT.md). Rendered documents, stored formats and print references are unchanged.
- **Bug-scan repairs** (PRs #343 and #350): backup restore validates integrity records before writing; case-folder entries must be plain files; file names reject control and bidirectional characters; malformed records and requests are refused with plain 400 answers; malformed integrity metadata invalidates one case instead of the Reports index; helper responses use plain sentences; Reports reads the current day.
- **Interface clarifications** (PR #351): the import Start button is tied to its blocker message, Apply date waits for a selected item, and restoring a withdrawn document states that it must change something.

## Identity and publication

- version.json, package.json and package-lock.json carry the R64 identity; tools/version_schema.py validates it (matching release/helper dates, helperBuild 65).
- Publication baseline: the owner, as release owner, declared this package a first publication and asked for it to be packaged with `--first-publication`. The repository's earlier records (R61 published, R63 packaged against the R61 manifest) were noted to the owner before packaging; the declaration is the owner's. Because of it, packaging did not check that R64 advances a retained manifest. Retain this package's runtime-manifest.json as the baseline for the next publication.
- Authoring, case schema, summary and backup versions are unchanged, so no data migration is needed. Documents issued under R63 keep their formats.

## Rollback

Retain the complete R63 package. R64 changes no stored format, so rolling back does not strand data. Documents issued under R64 remain valid records; rely on retained original PDFs for any reprint question. A runtime rollback does not reverse issued records.

## Acceptance

R64 adds S64-1 through S64-4 (ACCEPTANCE-RECORD.md). S60–S63 and all carried City, native, staff, legal and seasonal items remain OPEN. Automated verification records technical evidence only.
