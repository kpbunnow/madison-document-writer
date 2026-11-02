# R68 release review

Release 2026-11-02 R68, helper 2026.11.02.69 (build 69), authoring 16; case schema 5, summary 6 and workspace backup 2 unchanged. R68 follows R67 (2026-10-31, helper build 68), which the owner confirmed installs and updates correctly. This review is release evidence, not City acceptance.

## Contents since R67

- **Reviewed corrections and acceptance record** (PRs #379, #381): charges counted by property still count repeats by property (staff guide, manual, domain rules, SVIO-2); the independent test evidence.
- **Blank Violator row** (PR #380): a completely blank Violator row is dropped when Recipients is closed; a partly filled one is still refused.
- **Anchor receipts and default language scope** (integration PR #384 with #382 and #383): `create_only_write` for the external receipt so a create-only anchor folder works; Browse language and the picker open on Approved and standard; three test inputs changed and disclosed in that PR.
- **Development tools** (integration PR #391): hypothesis, PyYAML, vulture, eslint; playwright and typescript 7 were not taken.
- **Open cases by inspector** (PRs #392, #393, #394): the helper's two fixed queries and routes, the Import inspection card and its tests, the Find Case Inspections label, staff text and acceptance items OCL-1 to OCL-7.
- **Stranded import case** (PR #395): a case with no document, draft or event starts its notice again from its Initial Inspection; OCL-8 added.

## Identity and publication

- version.json, package.json and package-lock.json carry the R68 identity; tools/version_schema.py validates it (matching dates, helperBuild 69).
- Publication baseline: R68 is packaged against the retained R67 deployment manifest with `--published-manifest`. R67 is installed, so build 69 is a normal upgrade from it.

## Rollback

A PC on R68 cannot be rolled back (downgrade protection pins build 69). Install R68 on every PC that shares the case folder and restart Document Writer once; a PC left on R67 is told to restart and cannot save to the shared folder. The Excel/CSV import is unchanged, so a failure of the new list never blocks importing.

## Acceptance

R68 adds S68-1. The open-case list items OCL-1 to OCL-8 need a City PC and the real server (the SQL cannot run in the development environment); SVIO-2 (real data), OL-2, S65-1 through S65-3, S60–S64 and all carried City, native, staff, legal and seasonal items remain OPEN. OL-1, S67-1, S66-1 and SVIO-4 are CONFIRMED by the owner. Automated verification records technical evidence only.
