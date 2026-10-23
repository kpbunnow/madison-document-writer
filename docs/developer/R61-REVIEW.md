# R61 Development 2 review

Baseline: merged main d19d81a (PR 32), including the R60 corrections. Development follows the owner-confirmed R61-DEVELOPMENT-PROMPT.md. This branch is development work; no merge, packaging or deployment is authorized by this record.

Identity: 2026-10-23 R61, helper 2026.10.23.62/build 62, current authoring 15. Case schema 5, summary 6 and backup 2 remain unchanged.

## Scope and compatibility

- Import inspection replaces Import later inspection without changing import eligibility.
- New authoring-15 referrals show corrected observations once, with CORRECTED below the date. Authoring-14 history remains unchanged.
- New compliance letters snapshot ID-based item histories and show Abate Yes/No (Unavailable for missing legacy data). A presentation predicate is separate from referral classification. Case closure and publication rules remain unchanged.
- Citation previews default to all four copies; compact preview is optional. Printable HTML removes editor-only copy filtering, and new citation packet generation refuses incomplete/misidentified forms. Existing issued originals remain immutable. The reported final-PDF omission has not yet been reproduced on this baseline; tests inspect both generated PDFs and actual HTTP receipt-backed original packets, including snow and corrections. The standard browser delivery route remains mocked; R61 explicitly bypasses it for these receipt checks, using actual Chromium bytes in the documented test-only helper renderer. Native Windows rendering/Outlook remains untested. Do not attribute the report to caching without evidence.
- Citation correction values are formatted by field and stored units: base/amount/court costs are dollars, assessment and approved-basis components are cents. Raw changes and prices remain unchanged.
- Nineteen current catalog entries omit terminal punctuation in 27.05(2)(g)2. Canonical pricing and charge identities retain their existing subdivision punctuation. Retained ordinance exports and audit provenance are unchanged. Browser/helper reporting signatures accept the single known display-punctuation alias so older items without library IDs retain their classifications.
- New Best Interest Extensions use authoring 15; scoped-action creation retains authoring 13 for Vacancy and other special families. Initial-import drafts use the current authoring version, with the existing requirements for those other families unchanged. Best Interest Reasons-only inputs and signer-free output are implemented, with explicit adoption for older unissued drafts. Earlier issued/correction formats retain their renderer. Older review data is retained without being asserted as new authorization.
- The two bottom-of-document bubbles are produced by missing signer placeholders, separate from the actual footer. New Best Interest output removes its signer block. Existing single-page/no-footer and multi-page/footer conventions are retained. Case-number edits target the case-number span, not the last page-number span.

## Confirmed Best Interest safety decision

The owner explicitly chose to keep the existing safety confirmation. New Best Interest forms retain the noSafety checkbox alongside Reasons for Additional Time; the separate safetyBasis field and requirement are removed for this version/family only. Both browser and helper require the explicit checkbox, valid affected items and valid later deadlines. Changes to affected items, item facts or deadlines clear the new-format safety confirmation so it is renewed for the final scope. No automatic safety classification, fabricated review or signer is introduced. Older formats and other special families retain their existing safety-basis requirements.

## Verification

Focused history/currency/copy/catalog tests and retained R60, R59 charge-selection, R42 editor and R26 historical special-document checks have passed on development source. Final full-gate results and exact commit will be recorded in the PR. No automated check closes City/native, legal, staff or assistive-technology acceptance.

## PR 33 review corrections

- Reports normalizes ordinance values to one key in its model (R61 prints 27.05(2)(g)2 while citation charges keep 27.05(2)(g)2.), so the Ordinance list, filters and counts no longer split one ordinance. Stored summaries and the summarize()/case_projection mirror are unchanged.
- Switching an administrative extension's family keeps each family's authoring version; only a draft created at 15 receives the R61 defaults. An older Best Interest draft no longer silently adopts the signer-free format; adoption stays explicit.
- The helper refuses a new Best Interest correction whose format (authoring 15 or later versus earlier) differs from its original's; the browser already kept the original's version.
- The incomplete-packet check compares the document's own frozen copy labels, states accurately that nothing was filed after issuance, and a refused retry filing shows the reason instead of leaving the button disabled.
- CASE-LOOKUP-GUIDE uses Import inspection.
- Not changed (owner decision): policy/metadata.json still carries the dotted 27.05(2)(g)2. display reference and correction text for the ENF_HSE structural mapping; changing approved policy data is outside this review. A legacy compliance item without a boolean Abate value prints Unavailable and cannot be resolved in the compliance table before issuance.

