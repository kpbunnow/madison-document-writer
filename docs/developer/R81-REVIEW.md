# R81 release review

Release 2026-11-13 R81, helper 2026.11.13.82 (build 82), authoring 16; case schema 5, summary 6 and workspace backup 2 unchanged. R81 follows R80 (2026-11-13, helper build 81). This review is release evidence, not City acceptance.

## Contents since R80

- **Improvement plan — ease of use:** item defaults, next-blank focus and picker Favorites/Recently used (PR #480); remembered inspector, Find a case and Mark the rest (PR #482); review fixes for worksheet edits and picker state (PR #483); remembered inspector's open cases on Workspace (PR #484); Fix next issue (PR #485).
- **Improvement plan — performance:** Workspace row reuse with current verification (PR #487); once-per-render picker and Reports calculations (PR #490, delivered through integration PR #494).
- **Improvement plan — maintainability:** retired frozen screen copies and Keep adding (PR #481); retired Workspace filter/startup wiring (PR #486); notice section split (PR #488); behavior contracts for Writer screens (PR #489, via #494); generated staff guides, retired Workspace CSS and CI upload resilience (PRs #491–#493, via #495); Reports services and new-document splits (PRs #496, #497).
- Deadlines are never inherited from the previous item (owner decision); see 03-DOMAIN-RULES.md.

PR #496's first gate found that a moved module-level `render(services)` became the Reports page global `render` (the bundle runs as a classic script); it was renamed before merge and both splits use distinct module names.

## Identity and publication

- version.json, package.json and package-lock.json carry the R81 identity; tools/version_schema.py validates it (matching dates, helperBuild 82).
- Publication baseline: R81 is packaged against the retained R80 deployment manifest with `--published-manifest`.

## Rollback

A PC on R81 cannot be rolled back (downgrade protection pins build 82). Install R81 on every PC that shares the case folder and restart Document Writer once; a PC left on R80 is told to restart and cannot save to the shared folder.

## Acceptance

R81 adds S81-1 and S81-2. All other carried City, native, staff, legal and seasonal items remain OPEN. Automated verification records technical evidence only.
