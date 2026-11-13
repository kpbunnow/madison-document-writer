# R82 release review

Release 2026-11-13 R82, helper 2026.11.13.83 (build 83), authoring 16; case schema 5, summary 6 and workspace backup 2 unchanged. R82 follows R81 (2026-11-13, helper build 82). This review is release evidence, not City acceptance.

## Contents since R81

- **Inline fill-in and Workspace order** (PR #500, owner request): fill-in bubbles become an inline text box in place; the corrective-action dialog is removed with every prior refusal guard retained; the item field's editing attributes are set aside while the box is open so axe target-size and ARIA rules pass; Open cases by inspector leads Workspace. See 03-DOMAIN-RULES.md.
- **Services by area** (PR #499, Maintainability 2, owner decision "organize and ratchet"): eight labelled service-area sections in unchanged construction order, base helpers in app_base.js, and audit_service_areas.js ratcheting cross-area coupling. See SERVICE-AREAS.md.

## Identity and publication

- version.json, package.json and package-lock.json carry the R82 identity; tools/version_schema.py validates it (matching dates, helperBuild 83).
- Publication baseline: R82 is packaged against the retained R81 deployment manifest with `--published-manifest`. `app_base.js` joins the runtime through the bundled Writer.

## Rollback

A PC on R82 cannot be rolled back (downgrade protection pins build 83). Install R82 on every PC that shares the case folder and restart Document Writer once; a PC left on R81 is told to restart and cannot save to the shared folder.

## Acceptance

R82 adds S82-1 and S82-2. All other carried City, native, staff, legal and seasonal items remain OPEN. Automated verification records technical evidence only.
