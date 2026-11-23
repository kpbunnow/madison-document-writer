# R86 release review

Release 2026-11-23 R86, helper 2026.11.23.87 (build 87), authoring 16; case schema 5, summary 6 and workspace backup 2 unchanged. R86 follows R85 (2026-11-16, helper build 86). This review is release evidence, not City acceptance.

## Contents since R85

PRs #538 to #560. CHANGELOG.md lists the user-visible changes.

- **Dependencies** (#538–#540, #542): Node 24.22.3; Playwright 1.65.1 with Chromium 159; hash-pinned pip 26.3; a pinned `actions/cache`; weekly advisory monitoring and the Python qualification record.
- **Screens and manual** (#541, #543–#545, #552, #559):
  - Workspace, editor and Reports controls are consolidated.
  - The program manual is searchable and cross-linked, with Dark-theme media and captioned videos.
  - Dark-theme contrast is fixed for the correction eyebrow, links on the document paper and the map attribution.
- **Rules** (#546, #555): browser and helper parse ordinances, tiers and money identically. Schedule boundaries are pinned.
- **Helper input and shared folder** (#547, #551, #555, #556, #560):
  - Wrongly typed request parts and damaged shared files are refused clearly.
  - Citation-history refusals name the case file to review.
  - Byte-order marks are read consistently. NaN and numeric overflow are refused in requests and stored files.
  - Ordinary saves and opens no longer read the whole share.
- **Citations** (#557, #560): a citation number already in use on another shared case is refused.
- **Corrections and recovery** (#548, #549, #555):
  - No false "Email recipients" change is recorded.
  - The chosen recovery copy is marked and keeps focus.
  - Stale recovery reads cannot replace a current choice.
- **Reports** (#553, #555): parcel lookups stop after two unreachable batches. The refresh-failure message describes the retained cached locations.
- **Tests and records** (#550, #554, #558):
  - Timing races are removed and report fixtures are year-independent.
  - Load-test results are recorded in `LOAD-TEST-REVIEW.md`.
  - Stress, damage, concurrency, clock and accessibility reviews are recorded in `HELPER-STRESS-REVIEW.md`, `SCREEN-VISUAL-REVIEW.md` and the PR records.

## Review before packaging

- **Runtime modules:**
  - One helper module is new since R85: `json_numbers.py` (#555).
  - It is declared in `tools/runtime-manifest.template.json`, both in the deploy list and in the source map, and in the source inventory.
  - Every other helper module is unchanged in name. This is the R65 failure mode (a module missing from the runtime manifest), and it does not apply.
- **Stored formats:**
  - No stored format changes.
  - Reading is stricter only for records that the browser could not already read: NaN, overflow, and deep nesting.
  - Citation-number uniqueness applies only to new citations. Issued records are never rewritten.
- **Screen styles:** each screen change is an append-only, reviewed block with recorded shell and CSS references. Approved print is unchanged.
- **Result:** no defect was found.

## Identity and publication

- `version.json`, `package.json` and `package-lock.json` carry the R86 identity. `tools/version_schema.py` validates it: matching dates and helperBuild 87.
- **Policy compatibility:** `tools/policy-compatibility.json` was reviewed for the identity change. Only the release and helper identity advance. Authoring, case schema, summary and backup formats are unchanged. The recorded identity is updated to R86.
- **Publication baseline:** R86 is packaged against the retained R85 deployment manifest with `--published-manifest`.

## Rollback

A PC on R86 cannot be rolled back, because downgrade protection pins build 87. Install R86 on every PC that shares the case folder and restart Document Writer once. A PC left on R85 is told to restart and cannot save to the shared folder.

## Acceptance

R86 adds S86-1 to S86-4. The three-copy MC-2000 print, external Accela closing, and the existing legal and mandatory-appearance holds stay with City acceptance. All other carried items remain OPEN. Automated verification records technical evidence only.
