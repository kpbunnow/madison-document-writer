# R72 release review

Release 2026-11-03 R72, helper 2026.11.03.73 (build 73), authoring 16; case schema 5, summary 6 and workspace backup 2 unchanged. R72 follows R71 (2026-11-03, helper build 72). This review is release evidence, not City acceptance.

## Contents since R71

- **Import maintenance** (owner PRs #410, #411, #415): shared cache and report-grid code, retired shared-search test scaffolding, and open-case table styles moved into the reviewed screen CSS.
- **Case bubbles and compact inspection facts** (PR #416): each selection clears the earlier case and runs the lookup.
- **Excluded staff** (PR #417): `DEFAULT_EXCLUDED` in `helper/inspector_cases.py`, matched on user ID or full name.
- **Due date column** (PR #418): `inspector_cases.due_dates`/`next_due`, blank-first ordering, `.open-case-due` CSS reviewed in SCREEN-VISUAL-REVIEW.md.

## Identity and publication

- version.json, package.json and package-lock.json carry the R72 identity; tools/version_schema.py validates it (matching dates, helperBuild 73).
- Publication baseline: R72 is packaged against the retained R71 deployment manifest with `--published-manifest`; the runtime file set is unchanged, so build 73 is a normal upgrade.

## Rollback

A PC on R72 cannot be rolled back (downgrade protection pins build 73). Install R72 on every PC that shares the case folder and restart Document Writer once; a PC left on R71 is told to restart and cannot save to the shared folder.

## Acceptance

R72 adds S72-1; OCL-15 to OCL-17 ship with it. All earlier carried City, native, staff, legal and seasonal items remain OPEN. Automated verification records technical evidence only.
