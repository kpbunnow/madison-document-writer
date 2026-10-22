# R60 Workspace and referral development review

Baseline: merged PR #30, main 3983571215519a1de755e955f64fe8645b5a9f5b.
Identity: 2026-10-22 R60; helper 2026.10.22.61/build 61; current authoring 14; case schema 5, summary 6 and backup 2 unchanged.

The owner's confirmed prompt is retained in R60-DEVELOPMENT-PROMPT.md. Batch dates are scoped to one reinspection. Referral histories are item-specific, start at first observation and stop Days Outstanding at correction (latest observation for outstanding items). Four required copies are Court, Agency, Inspector and Defendant.

## Implementation

1. Workspace already initialized as the normal landing screen. Move its import/shared search actions from header buttons into one prominent explained start/find area; remove only the import rail destination. Existing import routes, recovery and navigation protection remain.
2. Replace the corrective-action native prompt with the shared accessible dialog. Validate document/item identity and editability before applying escaped text through the existing input/save path; cancellation changes nothing.
3. The existing reinspection batch-date panel was inside collapsed Inspection checks. Move it beside item review, display selected counts, reject stale/ineligible mixed selections before mutation, and preserve the separate cross-draft facility and date rules.
4. The editor intentionally hid three copies per charge. Add a deliberate all-four-copies toggle and identify the complete issued packet. Final generation is tested independently in real Chromium/PDF; no duplicate form renderer or historical PDF rewrite is introduced.
5. Accessibility minimum-height controls and the unbounded screen header can expand into the fixed mailing block. Flow the editor address below its header on desktop, preserving narrow-screen behavior and the fixed approved print geometry. No printed envelope measurement is changed.
6. New referrals use authoring 14 and retain observations in the existing item hist array. Follow source item/document IDs, exclude unrelated/carried observations, include the current worksheet, and retain corrected history. Calculate civil dates using UTC-midnight arithmetic. Missing/contradictory dates show Unavailable. Authoring-13 and earlier referrals retain their renderer, including corrections. Current ordinary drafts use authoring 14; unchanged special-document families retain 13.

## Verification record

Focused unit tests passed for Workspace entry, safe text entry/stale context, batch-date validation, item lineage, retained historical rendering and civil-day arithmetic. Focused production Chromium checks passed for keyboard Save/Cancel/Escape, address clearance at 100/125/150/200 percent zoom, 12-item referral pagination, and real PDFs with four/eight distinct copies for one/two charges on initial/reinspection paths. The reported missing final citation pages were not reproduced: all four copies were already generated; the compact editor hid the other three. The new expansion control exposes them. The complete gate must pass on final source; its actual outcome and exact reviewed commit are recorded in the PR, not inferred from these focused checks. No deployment, packaging, merge or City/native acceptance is supplied by this change. S60-1 through S60-6 and all carried-forward open items remain open.
