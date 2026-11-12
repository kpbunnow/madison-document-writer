# R79 release review

Release 2026-11-12 R79, helper 2026.11.12.80 (build 80), authoring 16; case schema 5, summary 6 and workspace backup 2 unchanged. R79 follows R78 (2026-11-11, helper build 79). This review is release evidence, not City acceptance.

## Contents since R78

- **Issued-document links and import review** (PR #474, `feat(writer)`): every issued document listed inline in Workspace as a type link with its City issue date, newest first; drafts under Case options; the separate PDF/Open record/All documents controls and the import Source and import details disclosure removed.
- **Review fix** (PR #475, `fix(workspace)`): a document's date and status wrap together, so a status such as Withdrawn no longer sits on a line of its own.

Review of PR #474 found no other defects. The removed import disclosure was the only place import notes appeared; the "several inspections" note is covered by the picker's own message and live lookups map every report column, so no staff-facing information is lost.

## Identity and publication

- version.json, package.json and package-lock.json carry the R79 identity; tools/version_schema.py validates it (matching dates, helperBuild 80).
- Publication baseline: R79 is packaged against the retained R78 deployment manifest with `--published-manifest`.

## Rollback

A PC on R79 cannot be rolled back (downgrade protection pins build 80). Install R79 on every PC that shares the case folder and restart Document Writer once; a PC left on R78 is told to restart and cannot save to the shared folder.

## Acceptance

R79 adds S79-1 and S79-2. All other carried City, native, staff, legal and seasonal items remain OPEN. Automated verification records technical evidence only.
