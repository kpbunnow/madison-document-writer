# R77 release review

Release 2026-11-10 R77, helper 2026.11.10.78 (build 78), authoring 16; case schema 5, summary 6 and workspace backup 2 unchanged. R77 follows R76 (2026-11-10, helper build 77). This review is release evidence, not City acceptance.

## Contents since R76

- **Order-language search and grouping** (PR #466, `feat(language)`): ordinance-aware search with a folded related-sections list, ranked word search, checklist and group headings with Consolidated Order Language first, status badges only on Review catalog. See ORDER-LANGUAGE-PICKER.md.
- **Repeated order-language entries** (PR #467, `feat(language)`): Add again, a word-for-word warning that does not block, and removal of the helper's duplicate-library-item refusal; citations and extensions carry each copy. Retained references for authoring and citation workflow record the owner's changed rule.
- **Undo of a repeated entry** (PR #468, `fix(editor)`): undoing a removal now checks the item's own id, so a copy is restored even when another copy of the same entry remains.

## Identity and publication

- version.json, package.json and package-lock.json carry the R77 identity; tools/version_schema.py validates it (matching dates, helperBuild 78).
- Publication baseline: R77 is packaged against the retained R76 deployment manifest with `--published-manifest`. The runtime file list is unchanged.

## Rollback

A PC on R77 cannot be rolled back (downgrade protection pins build 78). Install R77 on every PC that shares the case folder and restart Document Writer once; a PC left on R76 is told to restart and cannot save to the shared folder.

## Acceptance

R77 adds S77-1 and S77-2. All other carried City, native, staff, legal and seasonal items remain OPEN. Automated verification records technical evidence only.
