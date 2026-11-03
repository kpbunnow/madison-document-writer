# R70 release review

Release 2026-11-03 R70, helper 2026.11.03.71 (build 71), authoring 16; case schema 5, summary 6 and workspace backup 2 unchanged. R70 follows R69 (2026-11-03, helper build 70), whose first City test produced the requests below. This review is release evidence, not City acceptance.

## Contents since R69

- **Import list polish** (PR #403): full inspector names through a second background query (`inspector_names.sql`, route `POST /inspector-cases/names`); the case number as the import control with no-wrap case number and address; the Search shared case records entries removed; documents opened from Import start at their top. The shared-search dialog code remains unreachable until a reviewed cleanup.

## Identity and publication

- version.json, package.json and package-lock.json carry the R70 identity; tools/version_schema.py validates it (matching dates, helperBuild 71).
- Publication baseline: R70 is packaged against the retained R69 deployment manifest with `--published-manifest`. R69 is installed, so build 71 is a normal upgrade from it.

## Rollback

A PC on R70 cannot be rolled back (downgrade protection pins build 71). Install R70 on every PC that shares the case folder and restart Document Writer once; a PC left on R69 is told to restart and cannot save to the shared folder.

## Acceptance

R70 adds S70-1 and OCL-11 to OCL-14. OCL-1 to OCL-10, S69-2, SVIO-2 (real data), OL-2, S65-1 through S65-3, S60–S64 and all carried City, native, staff, legal and seasonal items remain OPEN. Automated verification records technical evidence only.
