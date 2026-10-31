# R67 release review

Release 2026-10-31 R67, helper 2026.10.31.68 (build 68), authoring 16; case schema 5, summary 6 and workspace backup 2 unchanged. R67 follows R66 (2026-10-30, helper build 67), which was never published. This review is release evidence, not City acceptance.

## Contents since R66

- **Explanations in the interface** (PR #367): missing Chrome for PDF filing, unavailable Correct, and resuming a reinspection from case details.
- **Violator contact** (PRs #368, #369): `kind: "Violator"` on a Copies entry and the case flag `copyOwner`; `defendantKey` (Writer) and `defendant_key` (helper) price repeat offenses against the Violator; snow cases ignore the Violator. No schema change.
- **Helper and record corrections** (PR #370): case-save logging, legacy case-number migration intents and Reinspection Notice corrections.
- **Integrity anchoring** (PR #371): at most one anchor per City day with complete digests; verification stops at the newest complete receipt.
- **Newest release required** (PR #372): the runtime manifest `helperBuild` is compared with the running helper; an out-of-date helper answers 409 `updateRequired` on case routes and the launcher stops it through the authenticated `/helper/shutdown`.
- **Acceptance record** (PR #373): SVIO-1 approved.
- **Pre-R67 integration** (PR #377, with #374 to #376): approval of 123 bundled order-language entries (seven remain blocked without a section), snow pick undo, 34 trailing periods removed, SVIO-2 to SVIO-4 and OL-1/OL-2 recorded, and the 503 shared-folder-unavailable message. Three test assertions that pinned 130 bundled drafts were updated because the owner changed that rule.

## Identity and publication

- version.json, package.json and package-lock.json carry the R67 identity; tools/version_schema.py validates it (matching release/helper dates, helperBuild 68).
- Publication baseline: R67 is packaged against the retained R66 deployment manifest with `--published-manifest`. R66 was packaged but never published, so a PC is on R64 or R65 at most; R67 (build 68) is a normal upgrade from any of them.

## Rollback

A PC on R67 cannot be rolled back to an earlier release (downgrade protection pins build 68). Install R67 on every PC that shares the case folder and restart Document Writer; a PC left on an older release is blocked from saving to the shared folder and prints a Violator as an ordinary copy.

## Acceptance

R67 adds S67-1. SVIO-2, SVIO-4, OL-1 and OL-2 remain OPEN, as do S65-1 through S65-3, S66-1, S60–S64 and all carried City, native, staff, legal and seasonal items. Automated verification records technical evidence only.
