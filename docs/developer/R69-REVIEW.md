# R69 release review

Release 2026-11-03 R69, helper 2026.11.03.70 (build 70), authoring 16; case schema 5, summary 6 and workspace backup 2 unchanged. R69 follows R68 (2026-11-02, helper build 69), whose first City test produced the requests below. This review is release evidence, not City acceptance.

## Contents since R68

- **Inspector list speed** (PR #397): names from the workflow tables only, 30-minute helper cache, longer wait with an honest loading message.
- **Open-case display and refresh** (PR #398): Case number, Address and Description table with consistent formatting; the latest-inspection details are removed from the display and the query; Refresh inspector list and Refresh open cases.
- **Start on Import inspection** (PR #399): a City PC opens on Import and begins loading the list unless a draft, worksheet, pending item or typed case number needs attention.
- **Review recovery and request races** (PR #400, owner): overlapping request generations, pending actions kept visible at startup, backup integrity validated before persistence, definite validation failures, anchoring after commit, verified-handle case reads, minimatch 11.0.1.
- **Excel import removed** (PR #401): the file card, drag and drop and spreadsheet reader are gone; retained references and the pinned tests were updated and disclosed in that PR.

## Identity and publication

- version.json, package.json and package-lock.json carry the R69 identity; tools/version_schema.py validates it (matching dates, helperBuild 70).
- Publication baseline: R69 is packaged against the retained R68 deployment manifest with `--published-manifest`. R68 is installed, so build 70 is a normal upgrade from it.

## Rollback

A PC on R69 cannot be rolled back (downgrade protection pins build 70). Install R69 on every PC that shares the case folder and restart Document Writer once; a PC left on R68 is told to restart and cannot save to the shared folder. Because the Excel import is removed, a City PC without database access cannot import cases until access is restored.

## Acceptance

R69 adds S69-1 and S69-2. The open-case list items OCL-1 to OCL-10 need a City PC and the real server; SVIO-2 (real data), OL-2, S65-1 through S65-3, S60–S64 and all carried City, native, staff, legal and seasonal items remain OPEN. Automated verification records technical evidence only.
