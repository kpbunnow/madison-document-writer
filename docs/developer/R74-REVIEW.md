# R74 release review

Release 2026-11-05 R74, helper 2026.11.05.75 (build 75), authoring 16; case schema 5, summary 6 and workspace backup 2 unchanged. R74 follows R73 (2026-11-04, helper build 74). This review is release evidence, not City acceptance.

## Contents since R73

- **Code-review corrections** (PRs #423, #424, #425; follow-ups #428, #430, #431): MCR-001 to MCR-013 as recorded in MAINTENANCE-REVIEW-2026-11-05.md, including the Reinspection Notice past-due readiness (MCR-009), verified open-case due dates (MCR-002), store date rules (MCR-006, MCR-008), mandatory-appearance draft backups (MCR-007), workspace/recovery isolation (MCR-001, 004, 005), snow Reports and timeline (MCR-010 to 012) and deployment preparation (MCR-013, with linked-root refusal).
- **Import window** (PR #426): lookups open in an overlay dialog; nothing imports until confirmed.
- **Workspace cleared on close** (PR #427; serialization and failure handling in #430): Exit and next start after an unclean close, owner choices "clear all, warn first" and "Exit and next start".
- **Gate** (PRs #429, #432): pooled scheduling, cached pinned browsers, isolated CI stages with sealed provenance; the local sequential gate is unchanged.

## Identity and publication

- version.json, package.json and package-lock.json carry the R74 identity; tools/version_schema.py validates it (matching dates, helperBuild 75).
- Publication baseline: R74 is packaged against the retained R73 deployment manifest with `--published-manifest`.

## Rollback

A PC on R74 cannot be rolled back (downgrade protection pins build 75). Install R74 on every PC that shares the case folder and restart Document Writer once; a PC left on R73 is told to restart and cannot save to the shared folder. The first Exit after installing clears that PC's workspace (with a warning for unfinished work).

## Acceptance

R74 adds S74-1; OCL-18, CLR-1 and CLR-2 ship with it. All earlier carried City, native, staff, legal and seasonal items remain OPEN. Automated verification records technical evidence only.
