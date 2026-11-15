# R83 release review

Release 2026-11-15 R83, helper 2026.11.15.84 (build 84), authoring 16; case schema 5, summary 6 and workspace backup 2 unchanged. R83 follows R82 (2026-11-13, helper build 83). This review is release evidence, not City acceptance.

## Contents since R82

- **Fill-in bubbles take typing directly** (PRs #508, #510, owner request after R82): selecting a bubble focuses it; the first printable key replaces it through a native editing transaction so Undo restores it; Tab and Shift+Tab move between bubbles; plain-text paste fills it. The R82 in-place text box is gone. See 03-DOMAIN-RULES.md.
- **Repeated owner mailing lines** (PRs #507, #510): `cleanOwnerAddress` prints a repeated street or PO Box line once, and keeps numbered floor and unit lines. Newly issued documents freeze `ownerMailingLines` only when it differs from the raw lines, and the helper accepts only that projection or the exact legacy one. Raw case facts and earlier snapshots are unchanged.
- **Stale continuations** (PR #521): a lookup or import confirmation that is no longer active, and a superseded Reports load, stop before applying results.
- **Reorder gestures** (PR #529): a drag whose document or table was replaced is abandoned.
- **Cross-runtime rule parity** (PR #525): the helper's parcel, mailing-line and street-key normalization uses the browser's whitespace and ASCII-digit rules. Ordinary data is unaffected.
- **Maintainability phases 0 to 7** (PRs #511 to #532): refactors with retained-original differential evidence, checked save and acknowledgment contracts, owner-level test migrations, policy inventories, runbooks and the final assessment. Records: MAINTAINABILITY-*.md.

## Review before packaging

The runtime changes since R82 were reviewed for this release:
- **#521, #525, #528, #529:** reviewed line by line.
- **Helper moves in #528:** compared function by function by AST. Seven functions moved to `publication_validation.py` unchanged apart from dependencies passed in explicitly, and the orchestration in `validate_publication` is identical.
- **Runtime manifest:** every helper module, including the seven new since R82, is declared.
- **Result:** no defect was found.

## Identity and publication

- Policy compatibility: `tools/policy-compatibility.json` was reviewed for the identity change. Only the release and helper identity advance. Authoring 16, case schema 5, summary 6 and backup 2 are unchanged, and no rule family, owner, consumer or historical variant changes in R83. Its recorded identity is updated to R83.
- `version.json`, `package.json` and `package-lock.json` carry the R83 identity. `tools/version_schema.py` validates it (matching dates, helperBuild 84).
- Publication baseline: R83 is packaged against the R82 deployment manifest with `--published-manifest`. For a new release number, the publication check reads only the baseline's release and helper identity. Where the retained R82 manifest was not available in the packaging environment, the baseline was reconstructed from the R82 source commit (`6604c42`). This is recorded with the package.

## Rollback

A PC on R83 cannot be rolled back, because downgrade protection pins build 84. Install R83 on every PC that shares the case folder and restart Document Writer once. A PC left on R82 is told to restart and cannot save to the shared folder.

## Acceptance

R83 adds S83-1 and S83-2. S83-2 supersedes S82-2, which checked the in-place text box this release removes. All other carried City, native, staff, legal and seasonal items remain OPEN. Automated verification records technical evidence only.
