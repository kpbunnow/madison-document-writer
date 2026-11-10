# R76 release review

Release 2026-11-10 R76, helper 2026.11.10.77 (build 77), authoring 16; case schema 5, summary 6 and workspace backup 2 unchanged. R76 follows R75 (2026-11-06, helper build 76). This review is release evidence, not City acceptance.

## Contents since R75

- **Live import from the SSRS reports** (PR #461, `feat(import): read live Accela data from the division's SSRS reports`): the helper renders DocumenGeneratorImport and OpenEnforcementCases_BI as XML through Windows PowerShell with the signed-in user's Windows sign-in; the SQL lookup, its queries, the SQL allowlist entry and the certificate workaround are removed. `trusted-connections.json` lists `ssrsHosts` (entreports.cityofmadison.com).
- **Owner's review fixes** (PR #462): only valid UTF-8 XML without NUL reaches the parser, closing an alternate-encoding path around the DTD refusal; a renamed or foreign data row is refused (`SSRS_LAYOUT`) instead of giving an empty or partial list.
- **Final sweep** (PR #463): the report body no longer passes through Windows PowerShell 5.1's length-limited JSON serializer; any 3xx answer is refused; a case row without a case number is refused as the wrong case; the setup rows no longer say SQL.
- **Program review** (PR #460): the deposit schedule's default date follows the current day.
- **Desktop icon** (PR #459).

## Identity and publication

- version.json, package.json and package-lock.json carry the R76 identity; tools/version_schema.py validates it (matching dates, helperBuild 77).
- Publication baseline: R76 is packaged against the retained R75 deployment manifest with `--published-manifest`. `case_lookup.ps1`, `case_lookup.sql`, `inspector_cases.sql`, `inspector_list.sql` and `inspector_names.sql` leave the runtime manifest; `ssrs_reports.py` and `ssrs_fetch.ps1` join it.

## Rollback

A PC on R76 cannot be rolled back (downgrade protection pins build 77). Install R76 on every PC that shares the case folder and restart Document Writer once; a PC left on R75 is told to restart and cannot save to the shared folder. If the report server cannot be reached, cases cannot be imported until it is; existing work, drafts and issued records are unaffected.

## Acceptance

R76 adds S76-1 and the live-report items SSRS-1 to SSRS-7, which supersede SQL-2, S50D, SQL-R53 and the SQL parts of I1, OCL-1 and OCL-6. All other carried City, native, staff, legal and seasonal items remain OPEN. Automated verification records technical evidence only.
