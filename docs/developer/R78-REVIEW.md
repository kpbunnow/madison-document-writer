# R78 release review

Release 2026-11-11 R78, helper 2026.11.11.79 (build 79), authoring 16; case schema 5, summary 6 and workspace backup 2 unchanged. R78 follows R77 (2026-11-10, helper build 78). This review is release evidence, not City acceptance.

## Contents since R77

- **Recipients and search** (PR #470, `feat(writer)`): inspector badge 5603 for Stephen Sundstrom; Wisconsin DFI registered-agent link in Recipients; new owner CCs beside a Violator drop consecutive duplicate address lines (issued snapshots record `frozen.ownerCopyLines`, validated by the helper; older issued documents reprint unchanged); screen search results highlight matching text.
- **Document-first Workspace** (PR #471, `feat(workspace)`): five-column case table with direct issued-document access and an All documents side panel; Workspace search, More views, All inspectors and counters removed.
- **Violation Categories picker and compact editor header** (PR #472, `feat(writer)`): the consolidated catalog shown as Violation Categories with title-case names, only categories in the picker list, searches still reaching earlier checklists, no Keep adding or Save draft in the picker; the document state in the header line and one task bar above the working document; the singular "1 other task" in Workspace.

## Identity and publication

- version.json, package.json and package-lock.json carry the R78 identity; tools/version_schema.py validates it (matching dates, helperBuild 79).
- Publication baseline: R78 is packaged against the retained R77 deployment manifest with `--published-manifest`.

## Rollback

A PC on R78 cannot be rolled back (downgrade protection pins build 79). Install R78 on every PC that shares the case folder and restart Document Writer once; a PC left on R77 is told to restart and cannot save to the shared folder.

## Acceptance

R78 adds S78-1 to S78-3. All other carried City, native, staff, legal and seasonal items remain OPEN. Automated verification records technical evidence only.
