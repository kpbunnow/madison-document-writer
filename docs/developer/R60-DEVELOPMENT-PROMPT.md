# Document Writer — next development prompt

Status: planning draft updated with product-owner clarification; remaining questions are listed below.
Source: Document Writer Development 1.docx supplied by the product owner.
Baseline: merged PR #30 (R59), merge commit 3983571215519a1de755e955f64fe8645b5a9f5b.
Code inspection: reviewed PR #30 head 59adeb1fb6e326fdee059ddbd8bdde0f8c106dca. Before implementation fetch current main and compare the merge result and subsequent changes. This planning review did not run the program or reproduce the reported output defects.

## Objective

Make Workspace the clear starting point for all case work, improve corrective-action entry and reinspection deadline assignment, and correct citation and referral presentation. Implement only these requirements and approved clarification decisions. Do not treat this document as authorization to merge, publish a release, or deploy.

## Confirmed product-owner decisions

1. **Batch deadlines:** Select items within one reinspection only. Cross-case batch changes are outside this enhancement.
2. **Days Outstanding:** Stop counting at the item's correction date. For an outstanding item, use its most recent recorded inspection as the end date, consistent with the original request. Later inspections must not increase the duration for a corrected item.
3. **Item history and start date:** Include only inspections that actually observed the item. Start Days Outstanding at its first recorded observation, including items discovered after the case’s initial inspection.
4. **Citation packet:** Every newly created citation must include Defendant Copy, Court Copy, Agency Copy and Inspector Copy, preserving each copy's approved content.

## Remaining clarification questions

1. **Envelope positioning:** Supply or confirm the City-approved left-window envelope/template measurements before changing printed geometry. The reported editor overlap can be investigated immediately without changing accepted print positioning.

The envelope measurement question must not block independent confirmed work. Preserve existing approved print geometry while investigating the editor-only overlap.

## What the code already does

- Writer initializes `screen: "cases"` in `app/modules/app_core.js`: Workspace is already the normal landing page. Test launch, reload and recovery entry paths before deciding any startup change is required.
- `app/modules/navigation.js` renders a separate Import inspection rail entry. Workspace already renders Search shared case records and Import inspection in its header in `reinspection_walkthrough.js`. The requested improvement is relocation and hierarchy, not a second import implementation.
- `court_and_deposits.js`, `fillBlank()`, uses native `prompt()` for missing corrective-action details. That explains the browser's origin heading.
- `case_timeline.js` has batch deadline planning for editable notice drafts. Reinspection has its own result/deadline state and must be integrated deliberately.
- `document_render.js` renders citation faces by iterating cited items and the configured citation copies. The missing-page report is not yet reproduced; trace preview, pagination, PDF generation and delivery before changing this renderer.
- Referral/history rendering explicitly substitutes a corrected date for the history when an item is done. This matches the reported limitation in the code. The full scope of usable item history still needs inspection.
- Owner mailing-address markup is shared in `document_render.js`. Editor layout, interactive control heights and pagination may differ from issued output; the cause of the reported overlap is unconfirmed.

## Work package 1 — Workspace entry and navigation

### Required behavior

- Remove Import inspection as a standalone left-rail destination.
- Retain its internal workflow/route and import safeguards; enter it from Workspace.
- Keep Workspace as the default ordinary launch destination.
- Put prominent, clearly labeled Import inspection and Search shared case records actions inside Workspace, near the beginning of the main content. Explain briefly when each is used.
- Preserve resuming unfinished work, case search results, pending operations, imported-report recovery and returning from Reports. Do not force an active document or recovery flow back to Workspace on every render.
- Keep a clear path back to Workspace from import. Route through existing save/navigation protections.

### Recommended layout

Use one compact “Start or find case work” area above the existing queue, with two distinct actions and brief help. Retain one primary action per case row. Avoid introducing a wizard or duplicating header buttons alongside identical main-content buttons. Preserve specialist search entry points where they serve a different context.

### Acceptance

- Normal desktop launch opens Workspace; both actions are visible without hunting through Tools.
- Import still supports candidate selection, supported statuses, duplicate inspection-use protection and existing unfinished drafts.
- No Import inspection rail button remains. Keyboard and narrow-screen navigation remain usable; focus reaches the new main-content actions in a logical order.
- Search/import cancellation returns predictably without losing draft changes or pending operations.
- Update current navigation documentation and tests that intentionally asserted the old rail. Record the deliberate removal of the obsolete “five destinations/import first” requirement in maintained developer guidance; the owner's new request supersedes it.

## Work package 2 — Corrective-action text dialog

### Required behavior

Replace the native prompt for adding missing item-order text with an application dialog displaying a useful title, entry field, Save and Cancel. An application cannot customize the browser-owned origin heading in native `prompt()`.

- Reuse the existing accessible modal infrastructure.
- Preserve the existing insertion behavior and normalization unless separately approved.
- Cancel/Escape leaves the item unchanged; blank input cannot silently erase the placeholder.
- Save updates only the intended editable item and uses the existing dirty/save path.
- Focus enters the field, remains inside the modal and returns to the initiating item control.
- Capture document/item identity and revalidate editability before applying: navigation, locking, publication or item removal while a dialog is open must not write to another document.
- Insert entered text as text, not executable HTML.

### Acceptance

Test save, cancel, Escape, blank/whitespace, multiline and special characters, keyboard-only use, and a stale/locked document. No browser-origin prompt heading appears for this action. Other native prompts are outside this scope unless separately requested.

## Work package 3 — Batch reinspection due dates

### Required behavior

Within one reinspection, offer selection of eligible outstanding items, an explicit date and an Apply action. Explain what will change before applying. Do not add cross-case selection.

- Use existing reinspection draft/result state and date-validation services. Do not update a rendered field without updating the persisted result used to create the follow-up document.
- Exclude corrected, withdrawn, ineligible, locked and already issued items as appropriate to the existing domain rules.
- Require explicit selection and date; do not add automatic deadlines.
- Validate all selected changes before mutating state. Preserve the existing distinct-deadline, spacing, date and document-specific constraints where applicable; identify any reinspection-specific exception before coding it.
- Do not rewrite issued notices, prior inspection results or existing legal deadlines retroactively.
- Preserve individual item edits and make selected counts and errors clear. Reusing an existing in-document selection pattern is preferable to introducing a competing interaction.
- Keep this action scoped to the currently open reinspection. Preserve the existing separate cross-draft facility without expanding its scope.

### Acceptance

Test mixed outcomes, excluded items, empty selection, invalid dates, deadline conflicts, reload persistence, generation of the subsequent document, and storage failure. Failed validation leaves all selected draft values unchanged. Existing original-notice batch assignment continues to work.

## Work package 4 — Complete citation packet

### Investigation first

Reproduce the reported reinspection citation using synthetic data. Compare screen/editor preview, Review dialog, newly generated original PDF, filed copy, downloaded/printed copy and email attachment. Identify whether the missing pages occur in preview only or in the issued artifact.

The code intentionally describes some previews as one representative court copy per charge. A representative preview alone does not establish that the final packet is incomplete. Preserve efficient editor behavior if the issued packet is complete, and clarify the preview label where necessary.

### Required behavior

Every newly created citation must produce Defendant Copy, Court Copy, Agency Copy and Inspector Copy for each charge in its final citation packet. Use the approved copy-specific content in the existing initial-citation packet as the reference. Additional authorized continuation pages do not reduce the required four copy types.

- Cover initial and reinspection citations and other supported citation creation paths.
- Preserve copy-specific narrative, instructions, disposition sections, numbering and charge data.
- Follow the copy list through frozen render sources, pagination, PDF creation, filing and email; repair the actual failing stage.
- Do not regenerate or overwrite historical issued PDFs to repair a new-document defect. Handle historical correction through existing authorized workflows only.

### Acceptance

For one and multiple charges, assert all required copy identities and meaningful copy-specific content in the final PDF, not merely DOM page counts. Verify final filing/email/download use the same complete original bytes. Include long text and page-break cases. Keep existing historical golden outputs unchanged.

## Work package 5 — Mailing-address editor positioning

### Required behavior

Reproduce the Update for Case Referral editor overlap between mailing address and header separator. Align the editable mailing block with the intended document layout, preserving already-correct finalized output.

- Compare editable, locked/read-only, paginated and issued views.
- Review shared mailing-address layout across document types that actually contain an envelope-address block. Citation forms may have a distinct approved form geometry; do not impose notice geometry on them.
- Test short and long owner names, multiline addresses, long inspector details, font loading and zoom.
- Prefer a shared screen-layout fix where the defect is common. Avoid one-off offsets that conceal overflow or alter print dimensions.
- Keep address text selectable/editable and avoid clipped input controls or overlap with letter content.

### Acceptance

No mailing/header overlap in the affected editor at normal and enlarged zoom. Applicable document types align consistently with their approved address window. Existing correct PDF placement is unchanged; City envelope/physical-print acceptance remains a separate manual requirement.

## Work package 6 — Referral history and Days Outstanding

### Required behavior

Apply to City Attorney Referral / Referral for Prosecution and Update for Case Referral; verify the exact document type mapping before implementation.

- Show the full relevant inspection-date history for each item, including corrected items. Retain its corrected status/date as useful context rather than replacing history with it.
- In the existing inspection-history column, place `Days Outstanding: N` below that item's inspection dates.
- Calculate Days Outstanding as a calendar-day difference: start at the item's first recorded observation, including later-added items; end at the recorded correction date for corrected items, or the most recent recorded item inspection for outstanding items. Later case or item inspections must not increase a corrected item's duration. A corrected item with no valid correction date must show an unavailable duration rather than silently using a later inspection date.
- Use civil dates, not elapsed milliseconds in the local browser timezone, so daylight-saving changes cannot create off-by-one results. Same-day endpoints yield zero.
- Display only inspections that actually observed the item, including relevant observations after correction without extending its Days Outstanding. Use recorded item observations and stable identity across carried-forward items/corrections. Do not infer observations from unrelated case visits, notices, mailing dates or document issue dates.
- Sort history chronologically. Define handling of same-day distinct inspections without discarding real observations. Missing, contradictory or invalid dates must not produce invented dates, a negative count or `NaN`; show a clear unavailable state and actionable validation where appropriate.
- Do not use today's date unless the owner expressly changes the requested formula.
- Retain the history and computed values in the appropriate frozen new-document representation so later case visits do not alter a reprint. Determine whether an authoring-version change is required; do not globally rewrite legacy rendering.
- Keep withdrawn/entered-in-error semantics explicit; do not present these as compliance findings.

### Acceptance

Cover outstanding, corrected and later-added items; correction followed by later inspections; corrected items with missing correction dates; same-day visits; missing initial/latest dates; out-of-order import data; leap year and daylight-saving boundaries; unrelated case inspections; long histories and multi-page tables. Confirm draft, original PDF and reprint agree, and a later inspection leaves previously issued output unchanged.

## Suggested implementation sequence

1. Fetch merged main, read AGENTS.md and maintained architecture/domain/testing guidance; reproduce reported citation and address defects. Record clarification decisions and synthetic reproductions.
2. Implement Workspace placement and the text-entry modal as a small reviewable change.
3. Implement confirmed reinspection batch selection/date behavior with persistence tests.
4. Fix any reproduced final citation packet defect and the editor-address defect with focused regressions.
5. Implement referral history/elapsed-day rules, frozen rendering compatibility and long-history pagination.
6. Update staff/developer documentation, source inventory and acceptance records as required. Run the established complete gate on the final exact source before proposing a release.

## Boundaries and verification

- Preserve loopback authentication, Host/Origin checks, text escaping, offline operation, private draft isolation, shared-case locking, duplicate-inspection protection, pricing/charge approvals, pending-operation recovery and immutable issued artifacts.
- Reuse existing modules and direct imports; do not introduce a second case store, import flow or rendering pipeline.
- Preserve historical rendering and approved fixtures. Never weaken assertions or replace approved hashes merely to pass verification.
- Follow version.json identity rules only when the actual implementation requires a version change; a planning document does not assign a release number.
- Use synthetic records only. Do not commit live case data, credentials, generated caches or release packages.
- Add focused tests for new behavior and confirmed defects. Run the established full regression, production-browser, accessibility and authored-print gate for the final source. Record actual results and remaining limitations.
- Automated checks do not close City Windows/SMB, native printing, envelope alignment, staff or legal acceptance. Carry forward all existing open acceptance items.

## Required developer handoff

Provide a change summary mapped to these six work packages, decisions made, reproduced defects and their causes, test evidence, historical-output compatibility, updated staff instructions and remaining City acceptance tasks. State merge readiness separately from deployment readiness. Do not merge or deploy without authorization.
