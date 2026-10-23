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
6. New referrals use authoring 14 and retain observations in the existing item hist array. Follow source item/document IDs, exclude unrelated/carried observations, include the current worksheet, and retain corrected history. Calculate civil dates using UTC-midnight arithmetic. Missing or invalid dates, and a corrected item without a matching correction date, show Unavailable. Long single-item histories split into labeled continuation rows during authoring-14 pagination; observation notes travel with their dates. Authoring-13 and earlier referrals retain their renderer, including corrections. Drafts created with newDoc use authoring 14, and documents written from a reinspection carry 14 only for the referral history types; other follow-ups keep their existing version (citations at least 11). Unchanged special-document families retain 13.

## Verification record

Focused unit tests passed for Workspace entry, safe text entry/stale context, batch-date validation, item lineage, retained historical rendering and civil-day arithmetic. Focused production Chromium checks passed for keyboard Save/Cancel/Escape, address clearance at 100/125/150/200 percent zoom, 12-item referral pagination, and real PDFs with four/eight distinct copies for one/two charges on initial/reinspection paths. The reported missing final citation pages were not reproduced: all four copies were already generated; the compact editor hid the other three. The new expansion control exposes them. The complete gate must pass on final source; its actual outcome and exact reviewed commit are recorded in the PR, not inferred from these focused checks. No deployment, packaging, merge or City/native acceptance is supplied by this change. S60-1 through S60-6 and all carried-forward open items remain open.

Preliminary gate: formatting passed; the run was stopped after two navigation tests still expected the intentionally removed fifth destination. Those expectations now require four destinations; other assertions remain. A new long single-item history regression was added before repeating the gate. No reference print hashes or existing thresholds were relaxed.

The complete browser preflight caught the new Workspace panel pushing the first recommended action below the 1366×768 fold. Compact panel spacing fixes that regression; the original visibility assertion remains. Narrow-screen navigation now fits four destinations in two rows. The same preflight also required the retained native-prompt test to use the new application dialog while keeping its original text-preservation assertion.

The all-status review retains earlier inspection dates for withdrawn authoring-14 referral items while preserving Entered in error and an unavailable violation duration. It does not give compliance credit. The later Excel-import browser workflow now returns through Workspace before reopening Import inspection.

## PR 31 review corrections

- Batch due dates on a reinspection worksheet now apply when the follow-up is still undecided as an empty or missing value (an import rule that asks for a choice sets ""); the panel was shown but Apply refused.
- Apply drops selected items that have since become ineligible (corrected, withdrawn or carried) and therefore have no checkbox, instead of refusing a selection the inspector cannot see.
- The corrective-action dialog returns focus to the item text after Chromium's asynchronous close event; focus previously fell to the main content.
- Workspace stays the current rail destination on the Import inspection screen.
- Authoring-14 item history keeps the number of a citation issued with (or in place of) the original notice on the first observation row; it was dropped although earlier formats retain it. No observation or date is created from the citation.
- CASE-WORKFLOW-GUIDE describes the four Writer destinations.
- Open for the owner: a corrected result whose manual date is backdated before an earlier visit's no-change finding still counts; deciding whether the worksheet should refuse such a date is a rule change. Continuation rows of long histories repeat the Sections and Abate cells, and the editor's on-screen page breaks can differ from the filed PDF where the desktop address flow applies (filed PDFs are unaffected).


## PR 31 second review correction

A long inspection note in an authoring-14 referral inherited the date column’s no-wrap rule and could overflow horizontally; one observation could also exceed a whole page vertically. The new history renderer explicitly wraps its contents, and pagination splits a lengthy observation note across continuation rows while retaining its date/outcome and every character. This is scoped to authoring-14 referral histories; the approved stylesheet and historical renderers remain unchanged. The production browser regression checks a 450-word single-observation note for exact word preservation and page bounds, alongside the existing 45-observation case. The Escape-dialog test waits for the browser’s asynchronous close event before checking restored focus.
