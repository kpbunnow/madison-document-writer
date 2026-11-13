# R80 release review

Release 2026-11-13 R80, helper 2026.11.13.81 (build 81), authoring 16; case schema 5, summary 6 and workspace backup 2 unchanged. R80 follows R79 (2026-11-12, helper build 80). This review is release evidence, not City acceptance.

## Contents since R79

- **Streamlined case work** (PR #477, `feat(writer)`): case-number lookup on Workspace; a continuation-only import panel when every returned inspection is used; grouped routine success messages with Details → Message history; screen-only preview pagination reuse; once-per-operation PDF-state reads; retired Workspace filter/search handlers.
- **Review fixes** (PR #478):
  - `fix(workspace)`: a Reports handoff now marks the case row (`issuedCase`) and brings it into view with focus, and Continue existing case for a case with nothing to open marks the row; the former search-filter assignments had no effect after the filters were retired.
  - `docs(staff)`: CASE-LOOKUP-GUIDE (Direct lookup, Review an existing case) and CASE-WORKFLOW-GUIDE (Writer destinations) now match the manual.

Review of PR #477 found no other defects. Two harmless input/change hooks that save the retired filter preferences remain because frozen registration references pin them.

## Identity and publication

- version.json, package.json and package-lock.json carry the R80 identity; tools/version_schema.py validates it (matching dates, helperBuild 81).
- Publication baseline: R80 is packaged against the retained R79 deployment manifest with `--published-manifest`. `preview_refresh.js` joins the runtime through the bundled Writer.

## Rollback

A PC on R80 cannot be rolled back (downgrade protection pins build 81). Install R80 on every PC that shares the case folder and restart Document Writer once; a PC left on R79 is told to restart and cannot save to the shared folder.

## Acceptance

R80 adds S80-1 and S80-2. All other carried City, native, staff, legal and seasonal items remain OPEN. Automated verification records technical evidence only.
