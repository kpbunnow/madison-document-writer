# R75 release review

Release 2026-11-06 R75, helper 2026.11.06.76 (build 76), authoring 16; case schema 5, summary 6 and workspace backup 2 unchanged. R75 follows R74 (2026-11-05, helper build 75). This review is release evidence, not City acceptance.

## Contents since R74

- **Python 3.14 minimum** (`chore(runtime): require Python 3.14 and ship only its parser wheel` and its Windows tests): launchers, installer and CI require 3.14; only the cp314 parser wheel ships.
- **Configured database for every query** (`fix(lookup): bind every query and cached result to configured database`): the three inspector queries drop the hard-coded database; the default is `AccelaReporting`; caches are keyed by the validated configuration.
- **Tool upgrades** (PRs #446-#449 and the earlier ones in the same series): ESLint, Hypothesis/attrs, fast-check, esbuild, ruff, globals, jsdom, Playwright, TypeScript, artifact actions, each through the full gate.
- **Review fixes** (PR #455 and the owner's earlier fixes): clearing a past session cannot block startup; full-name exclusions apply to case requests on a cold list; Exit wording, PDF hand-off cleanup, recipient input retention, shared document grouping and bounded summary reads.

## Identity and publication

- version.json, package.json and package-lock.json carry the R75 identity; tools/version_schema.py validates it (matching dates, helperBuild 76).
- Publication baseline: R75 is packaged against the retained R74 deployment manifest with `--published-manifest`. Four of the five parser wheels leave the runtime manifest.

## Rollback

A PC on R75 cannot be rolled back (downgrade protection pins build 76). **Install Python 3.14 first**: a PC on an earlier Python is told so and cannot start R75. Install R75 on every PC that shares the case folder and restart Document Writer once; a PC left on R74 is told to restart and cannot save to the shared folder.

## Acceptance

R75 adds S75-1, PY-1 and SQL-2. All earlier carried City, native, staff, legal and seasonal items remain OPEN. Automated verification records technical evidence only.
