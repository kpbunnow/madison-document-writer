# R84 release review

Release 2026-11-16 R84, helper 2026.11.16.85 (build 85), authoring 16; case schema 5, summary 6 and workspace backup 2 unchanged. R84 follows R83 (2026-11-15, helper build 84). This review is release evidence, not City acceptance.

## Contents since R83

- **Citation-only closure and three-copy packets** (PR #534, owner request and the owner's November 16 clarification):
  - **Copies:** new packets freeze Court, Agency and Defendant copies. Retained four-copy packets and corrections keep their source copy set, which is cloned before issued fields are cleared.
  - **Disposition:** the per-item disposition `dueExempt: "initial-citation-only"` is validated independently by `app/modules/citation_disposition.js` and `helper/citation_disposition.py`.
  - **Closure:** full closure at initial issuance is refused while an occupancy restriction is active.
  - **Carry-forward:** later worksheets carry citation-only items as `oc: "none", carried: true`, with no date, deadline, citation or note.
  - **Refusals:** follow-ups and corrections cannot change a disposition, and a closed item cannot be inspected or cited again.

## Review before packaging

- **Helper:** the new `citation_disposition.py` is declared in both runtime-manifest sections, and every helper module is declared.
- **Positional pairing:** each positional source/follow-up pairing (`validate_carried_citation_only`, the correction disposition check) comes after the existing checks that item identity, numbering and order are unchanged.
- **Parity:** the browser's carried worksheet results match the helper's `validate_citation_only_result`. Open-item, worksheet-check, compliance and Reports counts exclude citation-only items consistently, and Reports keep each item's closure date by version.
- **Result:** no defect was found.

## Identity and publication

- `version.json`, `package.json` and `package-lock.json` carry the R84 identity. `tools/version_schema.py` validates it (matching dates, helperBuild 85).
- Policy compatibility: `tools/policy-compatibility.json` was reviewed for the identity change.
  - Only the release and helper identity advance. Authoring, case schema, summary and backup formats are unchanged.
  - The citation-only disposition is an optional item fact within authoring 16, mirrored and inventoried by PR #534.
  - The recorded identity is updated to R84.
- Publication baseline: R84 is packaged against the retained R83 deployment manifest with `--published-manifest`.

## Rollback

A PC on R84 cannot be rolled back, because downgrade protection pins build 85. Install R84 on every PC that shares the case folder and restart Document Writer once. A PC left on R83 is told to restart and cannot save to the shared folder.

## Acceptance

R84 adds S84-1 and S84-2. The three-copy MC-2000 print on the City printer, external Accela closing, and the existing legal and mandatory-appearance holds stay with City acceptance. All other carried City, native, staff, legal and seasonal items remain OPEN. Automated verification records technical evidence only.
