# R73 release review

Release 2026-11-04 R73, helper 2026.11.04.74 (build 74), authoring 16; case schema 5, summary 6 and workspace backup 2 unchanged. R73 follows R72 (2026-11-03, helper build 73). This review is release evidence, not City acceptance.

## Contents since R72

- **Worksheet reasons and discard** (PR #420): `nothingOutstanding` in `new_documents.js` (the retained reference carries the same owner-directed wording change); `forgetRecipientsOfUnstartedCase` clears `ccList`, `emails` and `copyOwner` when a never-issued, never-saved case's only draft is discarded; OCL-7 and S69-2 wording corrected.
- **PO Box recipients and citation violation levels** (owner PR #421): `address_format.js`, `recipient_workflow.js`, `contact_events.js`, `citation_workflow.js`, `screen_overlays.js`; the overlay comparison tests use explicit reviewed adapters and leave the historical references untouched; the existing `tierOverride` pricing authority is exposed as Automatic/First/Second/Third, with no new stored field and no helper validation change.

## Identity and publication

- version.json, package.json and package-lock.json carry the R73 identity; tools/version_schema.py validates it (matching dates, helperBuild 74).
- Publication baseline: R73 is packaged against the retained R72 deployment manifest with `--published-manifest`; the runtime file set is unchanged, so build 74 is a normal upgrade.

## Rollback

A PC on R73 cannot be rolled back (downgrade protection pins build 74). Install R73 on every PC that shares the case folder and restart Document Writer once; a PC left on R72 is told to restart and cannot save to the shared folder.

## Acceptance

R73 adds S73-1, PO-1, LVL-1 and DISC-1. All earlier carried City, native, staff, legal and seasonal items remain OPEN. Automated verification records technical evidence only.
