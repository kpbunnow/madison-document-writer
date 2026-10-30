# R66 release review

Release 2026-10-30 R66, helper 2026.10.30.67 (build 67), authoring 16; case schema 5, summary 6 and workspace backup 2 unchanged. R66 corrects R65 (2026-10-30, helper build 66). This review is release evidence, not City acceptance.

## What went wrong in R65

R65 added open cases by inspector, which made `helper/server.py` import `open_cases`. `tools/runtime-manifest.template.json` did not list `open_cases.py`, so the deploy folder lacked it and the installed helper exited at start (launcher log: "Helper start: exited", then "local helper did not start"). Every automated check ran from the source tree, where the module exists. The packaged R65 deploy folder reproduces the failure (`ModuleNotFoundError: No module named 'open_cases'`) and a scan of every deployed Python file's imports found no other missing module.

## Contents since R65

- **Runtime manifest** (PR #365): `open_cases.py` added to the required list and the deployment map.
- **New guards** (PR #365): `audit_runtime_imports.py` fails if any helper module imported by a deployed file is not deployed, and starts the server module from the deployed files alone. For this release the packaged deploy folder was additionally started and `/dw-status` read before delivery.
- Nothing else changed since R65.

## Identity and publication

- version.json, package.json and package-lock.json carry the R66 identity; tools/version_schema.py validates it (matching dates, helperBuild 67).
- Publication baseline: R66 is packaged against the retained R65 deployment manifest with `--published-manifest`. R65 was installed on at least one PC and cannot start, so its installed pin is build 66; R66 (build 67) is a normal upgrade from it.

## Rollback

Do not roll back to R65. A PC that installed R65 upgrades to R66 from the shared release folder; a PC still on R64 can upgrade directly. Rolling back to R64 after R65 was installed is refused by the downgrade protection (build 66 pinned), and no Reinspection Notice can have been issued on a PC that could not start. Install R66 on every PC that shares the case folder before anyone issues a Reinspection Notice.

## Acceptance

R66 adds S66-1 (installed start on a City PC). S65-1 through S65-3, S60–S64 and all carried City, native, staff, legal and seasonal items remain OPEN. Automated verification records technical evidence only.
