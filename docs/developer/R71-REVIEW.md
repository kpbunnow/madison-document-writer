# R71 release review

Release 2026-11-03 R71, helper 2026.11.03.72 (build 72), authoring 16; case schema 5, summary 6 and workspace backup 2 unchanged. R71 follows R70 (2026-11-03, helper build 71). This review is release evidence, not City acceptance.

## Contents since R70

- **Unreachable shared-record search removed** (PR #406): the dialog, handlers and service, the helper's `GET /cases/search` and `GET /cases/by-inspector` routes, `helper/open_cases.py` (no longer in the runtime manifest) and `workflow_helper.search_cases`, with their tests and retained references; nothing visible to staff changes.
- **Deleted case file restarts its history** (PR #407, owner-directed): `case_integrity.automatic_restart`; the new genesis carries `administrativeRecovery` with `automatic`, `missingCaseFile`, the prior anchored commit hash and the prior genesis hashes; the registry entry is flagged; verification reports `historyRestarted` and the label says so. This moves a tamper-blocking rule (a deleted case file could never be recreated) to a tamper-evident one, as the owner decided; a link or reparse point for the number and a pending transaction still refuse the save.
- **Sort by due date** (PR #408): `orderByDue`, the button beside Apply date, handler with Undo, tests and documents.

## Identity and publication

- version.json, package.json and package-lock.json carry the R71 identity; tools/version_schema.py validates it (matching dates, helperBuild 72).
- Publication baseline: R71 is packaged against the retained R70 deployment manifest with `--published-manifest`. R70 is installed, so build 72 is a normal upgrade from it. `open_cases.py` leaves the manifest; the publication check only requires the release and helper build to advance.

## Rollback

A PC on R71 cannot be rolled back (downgrade protection pins build 72). Install R71 on every PC that shares the case folder and restart Document Writer once; a PC left on R70 is told to restart and cannot save to the shared folder.

## Acceptance

R71 adds S71-1 and RESTART-1; SORT-1 ships with it. OCL-1 to OCL-14, S69-2, SVIO-2 (real data), OL-2, S65-1 through S65-3, S60–S64 and all carried City, native, staff, legal and seasonal items remain OPEN. Automated verification records technical evidence only.
