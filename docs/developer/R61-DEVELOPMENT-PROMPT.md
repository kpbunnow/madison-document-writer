# Document Writer — Development 2 implementation prompt

Prepared October 23, 2026. Source: the owner's `Document Writer Development 2.docx`, including its citation-correction screenshot.

Status: development prompt updated with the owner’s clarification answers. This document authorizes neither merging nor deployment. The attachment is a requirements source, not an instruction to execute development during this planning review.

## Assignment

Develop the next version of Madison Building Inspection Document Writer around the eight requirements below. Begin from current `main`, inspect repository instructions, implement the confirmed requirements, validate the resulting program, and open a development PR for review. Do not merge or deploy automatically. Report any genuinely new unresolved decisions accurately and continue independent work that does not depend on them.

Review baseline: `origin/main` at `d19d81a` (PR #32 merged), following R60/PR #31. The inspected application source matches PR #31 correction `a5350bb`; the additional main-branch change is the bounded desktop-exit test wait. Recheck the baseline before implementation. R61 is a proposed next release label, not an instruction to change release identity prematurely.

This review inspected source and the supplied screenshot. It did not reproduce the reported citation or footer problems in a running installation. Prior R60 verification established complete regular citation packets for its tested paths; it does not prove that the owner's installed build, snow workflow, browser preview, or every delivery path behaves correctly.

## Confirmed owner clarifications

1. **Citation defect affects both preview and PDF.** Treat this as a final-packet defect report as well as a preview problem. Reproduce both regular and snow citation paths; do not resolve it solely by exposing the existing preview toggle.
2. **Best Interest Extensions have no signer block.** Remove the block from their new output, together with the signer inputs and associated validation. Do not substitute the case inspector or invent a supervisory signer. Other document families retain their existing signer rules.
3. **The two circles appear to be empty Authorized signer name/title placeholders.** Source inspection supports this: `new_documents.js` appends both signer fields, `val()` returns `◯` when either is empty, and paragraph rendering converts that marker into a fill-in bubble. Remove the Best Interest signer paragraph itself, not merely its inputs. Verify whether this resolves the reported bottom-of-document defect before changing the actual footer.

4. **Best Interest safety confirmation remains.** The owner confirmed during implementation that the existing safety confirmation should remain. Retain the checkbox excluding safety, security and urgent obligations alongside Reasons. Remove the separate factual-basis narrative input and its requirement only for new authoring-15 Best Interest Extensions. Mirror this in helper validation; older formats and other families retain their existing rules.

No clarification question from this review remains unanswered. Preserve existing footer wording and geometry while distinguishing signer placeholders from genuine footer defects. Do not add new footer text or require `Page 1 of 1` solely on the basis of this report. Investigate any remaining inconsistency across document families and document the result.

## 1. Rename Import later inspection

Change visible `Import later inspection` labels and headings to **Import inspection**, matching the requested wording. Current occurrences are in `app/modules/reinspection_walkthrough.js`.

- Update affected help/manual references and accessibility labels where needed.
- Preserve initial-versus-reinspection routing, SQL/SSRS eligibility, duplicate-import protection, and Continue existing case.
- Do not create a new import route or change which inspection statuses are accepted.

Acceptance: the old label is absent from current operational screens; importing an initial inspection, importing a later inspection, and continuing unfinished work retain their existing behavior.

## 2. Show compliance dates once in referral history

Applies to new City Attorney Referrals and Update for Case Referral documents.

Current `referralHistoryHTML()` renders each corrected observation using its outcome label, then appends another Corrected block containing the same completion date. This accounts for the duplicate described by the owner.

- Keep the corrected observation's date once and put **CORRECTED** directly below that date.
- Remove its `Completed` outcome caption and the redundant correction-date summary block for that same event.
- Preserve every other genuine observation, its notes, associated citation information, chronological order, and item identity.
- Do not deduplicate observations merely because they share a calendar date. Distinct observations on the same day remain distinct events.
- Retain Days Outstanding: first observation through correction; outstanding items end at their latest actual observation. Later unrelated inspections do not extend the duration.
- Preserve withdrawn-item status, Entered in error, and unavailable duration; withdrawal is not compliance.
- Missing or contradictory correction metadata must be handled explicitly rather than supplied with invented dates. If a valid correction date lacks an observation row, present it once with an honest history-availability indication; preserve existing unavailable-duration semantics until the history is valid.

Acceptance: an item observed three times and corrected on the third visit shows all three observations, its final date once, CORRECTED beneath that date, all notes, and the correct duration. Include same-day distinct observations, carried findings, withdrawals, and missing-date cases.

## 3. Add item inspection history to compliance letters

The owner wants recipients to see the inspection dates and notes already available in the referral presentation. Interpret this as complete **item-specific** history, not unrelated visits or private internal records.

Current compliance rendering shows only `doneOn` or a due-date fallback. Its creation path does not retain the authoring-14 item histories used by referrals.

- Snapshot each item's actual observation history when preparing the compliance letter, including first observation, later findings, notes, and correction.
- Reuse the corrected history presentation from requirement 2, including date ordering, correction labeling and the existing duration presentation unless the owner directs otherwise.
- Carry over the item's **Abate Yes/No** value accurately. Preserve explicit No; do not turn absent legacy information into a factual No. Resolve missing information using the existing editable-data conventions.
- Cover every item included by the existing compliance workflow, including later-added items and items already corrected before the final visit. Carried compliance must not become a new observation.
- Display withdrawn items according to their existing inclusion rules and status; do not describe them as corrected.
- Reuse the existing ID-based lineage logic. Do not match history using item numbers alone.
- Keep compliance issuance and case closure rules unchanged: outstanding findings still prevent a compliance letter, and case closure follows confirmed issuance/save.
- **Do not simply set the compliance type's referral `history` flag or broaden `isHistoryDoc()`.** Those concepts also participate in referred-case eligibility and restrictions. Introduce a narrowly scoped history-presentation/snapshot capability where necessary, separate from referral status.
- Issued letters must retain their saved histories when later case data changes. Preserve old letters' historical rendering.

Acceptance: initial notice → extension/referral → multiple visits → compliance retains item dates/notes and Abate values, with a single correction date per event. Also cover compliance without an earlier referral, later-added items, prior corrected items, long notes, multi-page output, reload, correction, reprint, and case closure/reporting.

## 4. Guarantee all four citation copies

Every newly generated citation must produce **Court, Agency, Inspector, and Defendant** copies for each cited item/charge, with each copy's approved distinct content.

R60 already added an all-four-copies editor toggle and verified regular initial/reinspection final packets for one and two charges. The owner's repeat report must be investigated, not dismissed or labeled fixed from those old results.

Investigation:

1. Identify the installed application/helper version and whether the report concerns editor preview, browser print, downloaded PDF, shared filed PDF, or an email attachment. Check cached/stale launch output if relevant; do not assume it is the cause.
2. Reproduce regular initial citations, notice-linked citations, later/reinspection citations, snow citations and citation corrections.
3. Trace `document_render.js`, editor copy visibility, `printJob()`/printable HTML, helper PDF rendering, receipt retrieval, filing and attachment selection. Verify screen-only copy filtering never leaks into printable HTML.
4. Compare current generation with reused issued PDF bytes. Do not overwrite an issued original or fabricate a corrected historical packet.

Implementation:

- Fix the demonstrated failing path through the existing renderer/publication pipeline; do not create a parallel packet generator.
- Show all four copies in the new citation preview by default. Keep any compact-view control explicit and optional, scoped to citation editing. This preview change alone does not resolve the owner-confirmed PDF defect; verify and fix the final packet path as well.
- Preserve the four distinct labels, approved instructions, charge identity, citation number, mandatory-appearance hold, snow rules, publication integrity, and immutable issued receipts.
- Required count is four **copy forms** per charge, not necessarily four total PDF pages: cover letters and long form continuations may add pages.

Acceptance: real PDF text extraction verifies each distinct copy exactly once per charge for regular and snow cases, one and multiple charges, initial/later paths where supported, new issuance and correction. Cover snow documents with their cover letter, editor preview, downloaded/filed output, and receipt-backed repeat distribution. Unsupported workflow combinations must remain unavailable rather than being invented for a test.

If an existing issued packet is incomplete, record an explicit remediation recommendation through the correction/recovery workflow; never silently replace it.

## 5. Format citation correction money consistently

The screenshot shows `base` as `100`/`200`, `amount` as `197.00`/`323.00`, and assessment components as raw cents (`10000`, `2600`, etc.). This is a presentation problem visible in the generic correction-change table, not evidence that the stored pricing arithmetic is wrong.

- Use field/path-aware formatting in the correction review; `correctionChanges()` already supplies paths and `correctionDiffHTML()` currently passes values to generic `changeText()`.
- Display every monetary value as currency with two decimals, for example `$100.00`, `$197.00`, `$26.00`, and `$1,234.50`.
- Convert assessment integer cents exactly once. Distinguish them from dollar-valued base/amount fields according to their actual schemas.
- Present readable assessment labels (Base, Penalty assessment, Jail assessment, Crime lab, Court costs, Total) instead of exposing internal object keys and raw cent values.
- Format both Previously issued and Correction draft consistently, including regular and snow citation corrections and any supported manual total/base modes.
- Preserve null/missing as unavailable, and preserve actual zero as `$0.00`. Never coerce invalid input into zero.
- Do not format ordinance numbers, dates, identifiers, percentages, counters, or nonmonetary metadata as currency.
- Keep raw change values, events, saved pricing, authority/provenance and calculations unchanged. Reuse existing currency helpers where their input units match.

Acceptance: the screenshot's example displays base `$100.00` → `$200.00`, amount `$197.00` → `$323.00`, and correctly converted assessment amounts. Include zero, missing values, grouping separators, cent precision, nested components and unchanged stored/event values.

## 6. Normalize the order-language reference

For current order language, display/use **`27.05(2)(g)2`** instead of `27.05(2)(g)2.`.

- Locate the authoritative catalog entries and their printed-reference/mapping metadata. The punctuated form occurs in generated catalog assets and manifest data; do not patch generated output alone.
- Determine which occurrences are current display references and which are immutable source quotations/provenance. Do not globally replace ordinance source documents, audit history, or approved fixtures.
- Keep canonical ordinance resolution, deposit schedules and citation mappings equivalent. Do not change a charge or price through punctuation normalization.
- Preserve catalog IDs, stable library keys and private language overrides. Follow the existing explicit reviewed-language adoption process for stored drafts; do not rewrite issued wording.

Acceptance: affected current library entries and newly adopted language show the normalized reference; canonical lookup/pricing still resolves; unrelated sections and historical issued documents remain unchanged.

## 7. Simplify Best Interest Extension entry

The attachment says “Best Interest Inspection”; the matching program family is **Best Interest Extension**. The owner confirmed that its output should have no signer block. Scope these changes to that family, not ordinary extensions or Vacancy Extensions.

Within its special-details section, retain only **Reasons for Additional Time** as the manual narrative input. Remove the owner's listed entries:

- Scope (and its dependent unit input in this section).
- Reviewed factual basis for excluding safety items.
- Prior Official Notice reference.
- Supervisory reviewer.
- Owner's intended corrective work.
- Actual internal review stage and its dependent prosecution-choice input.
- The entire Authority, wording and signer review section.

Retain the existing safety-exclusion confirmation checkbox as explicitly clarified by the owner; remove other redundant manual review checkboxes in this Best Interest section. Retain ordinary case/recipient details, item selection and per-item extended deadlines elsewhere in the document; “only Reasons” does not remove these operational requirements.

- Update special-details rendering, initialization, validation, correction handling, readiness messages and generated narrative together. Hidden fields must not remain mandatory or prevent issuance.
- Do not populate removed fields with fabricated approvals or default `reviewed: true` values.
- Preserve genuine item/deadline rules: at least one eligible affected item, later valid dates for selected items, original dates for unselected items, no unintended compliance/case-closure changes, and existing substantive safety restrictions.
- If removing manual safety/review entries leaves no reliable way to establish an existing safety restriction, document the gap and obtain the owner's rule decision rather than adding a concealed bypass or silently retaining an impossible requirement.
- Remove the generated sentence beginning **“The compliance dates for Item(s) … are extended as shown below. Unlisted items retain their existing deadlines.”** Account for its dynamic item list; do not rely on matching a single static string.
- Retain the affected-item table and its actual extended dates. Do not remove deadline data just because the explanatory sentence is removed.
- Generated wording must not assert a specific supervisory referral, owner statement, verified safety finding or authorization solely from a removed field. Resolve obsolete conditional wording alongside the simplified input model.
- Remove the Best Interest signer block entirely, as confirmed by the owner. Remove its narrative paragraph and any separate aligned-layout signer output so blank bubbles do not remain. Do not change signer rules for other document families.
- Old issued Best Interest Extensions and their historical correction renderers must retain their frozen wording and metadata. Define how existing unissued drafts are adopted/migrated without destroying their retained review data.

Acceptance: an eligible new Best Interest Extension can proceed through review and issuance using Reasons plus ordinary case/item/deadline data, without entering removed fields. Missing reasons and invalid dates still block issuance. Test cancel/reload, old drafts, corrections, unselected items, and unchanged Vacancy/ordinary Extension workflows.

## 8. Remove bottom-of-document signer bubbles; verify real footers

The owner identifies the two circles as likely corresponding to Authorized signer name and Authorized signer title. The source explicitly emits a `◯` placeholder for each missing signer value and renders these as fill-in bubbles. This is a supported source-level explanation, not a completed runtime reproduction.

- First implement the confirmed Best Interest change: omit its signer paragraph/block from new output, remove the inputs and their validation, and verify the two circles disappear in both preview and final PDF.
- Distinguish the signer content from `.n-foot`. Removing inputs without removing their generated paragraph will leave the circles behind.
- Inspect the other reported document families for the same placeholder pattern. Do not remove required signers from unrelated families without an explicit requirement. Where signing remains required, preserve a clear readiness error for missing information and do not issue blank placeholders.
- Inventory actual footers across Best Interest and Vacancy Extensions, referrals/updates, compliance, occupancy/abatement documents, ordinary notices/extensions, snow cover letters and the separate citation forms.
- Current notice pagination explicitly omits the footer on single-page documents and appends page numbering on multi-page output. Preserve that existing convention unless it causes a separately demonstrated defect or the owner requests a new design. Do not replace it with an invented all-page footer contract.
- Repair demonstrated inconsistencies within the existing footer design: missing case identity or page counts where expected, unresolved placeholders, stray glyphs, clipping, stale values and inconsistent continuation handling. Share footer construction where appropriate rather than patching families independently.
- Check case-number edits update the case-number element, not whichever span happens to be last after pagination.
- Preserve approved citation-form geometry, distinct copy labels, envelope position and body content. Do not insert a generic notice footer into citation forms.
- Keep old issued reprints reproducible. Scope changed new-document presentation through the chosen authoring-version boundary; do not update frozen references to conceal differences.

Acceptance: new Best Interest preview/PDF contains no signer block or signer bubbles. Other document families keep required signers and the correct existing footer behavior; no unexplained circles, missing expected metadata, clipping or overlap remain. Verify single-page and continuation output, long item histories/notes, long addresses and snow covers. Record whether the original report was entirely a signer-placeholder issue or also exposed a true footer defect.

## Technical starting points

| Area | Starting files/functions |
| --- | --- |
| Import labels | `app/modules/reinspection_walkthrough.js` |
| Item history and correction review | `app/modules/issuance_and_corrections.js`: `itemInspectionHistory`, `documentItemHistory`, `correctionChanges`, `changeText`, `correctionDiffHTML` |
| Referral/compliance layout and citation forms | `app/modules/document_render.js`: `referralHistoryHTML`, `noticeHTML`, citation renderers |
| Follow-up snapshots and pagination | `app/modules/document_pagination.js`: `docFromReinspection`, `paginate` |
| Best Interest input, validation and wording | `app/modules/new_documents.js`; inspect relevant approved language data |
| Preview and final packet construction | `app/modules/inspection_import.js`, `court_and_deposits.js`, `workspace_shell.js`; locate actual snow workflow and helper renderer |
| Currency and charge identity | `citation_policy.js`, `citation_pricing.js`, correction field schemas |
| Catalog normalization | authoritative catalog source/build tooling, `app/assets/catalog_manifest.json`, generated library assets |
| Regression coverage | `tests/unit/audit_r60_development.js`, `audit_r60_review_fixes.js`, `tests/browser/browser_r60.js`, retained snow/citation/correction/extension suites |

These are navigation pointers, not a requirement to add exports or create replacement modules.

## Compatibility and security boundaries

- Follow current `AGENTS.md` and developer/domain/testing documentation. User-confirmed changes supersede superseded workflow requirements; reflect those changes in documentation and validators explicitly.
- Preserve frozen issued snapshots, original PDF receipts, record integrity, item/visit/document identities, correction lineage, idempotent publication, and deadline rules.
- Use a deliberate authoring-version boundary for changed legal/document presentation. Current authoring is 14; evaluate a new version for the combined new output. Do not blindly upgrade every document family or alter historical correction rendering.
- Avoid schema increments unless new persisted data actually requires one; reuse existing history and Abate fields where appropriate. Explain any necessary migration.
- Escape user notes, reasons and history output. Preserve accessible labels, keyboard focus, dialog deadlines, and narrow-screen usability.
- Do not remove legal holds, price authority checks, or authentication merely to make a workflow pass. Do not treat operator-entered review metadata as authenticated authorization.
- Never expose internal/private notes as recipient history without confirming they are the item observation notes intended by the existing workflow. Preserve existing recipient and delivery boundaries.

## Recommended implementation sequence

1. Reproduce and document citation output and signer-placeholder/footer reports using the owner’s confirmed answers. Independently complete the label and currency presentation changes.
2. Correct/refactor item history presentation; add immutable compliance histories without changing referral classification or case-closure semantics.
3. Fix the demonstrated citation packet/preview issue, with snow coverage and real PDF inspection.
4. Simplify Best Interest input/validation/narrative together and remove its signer block.
5. Normalize the catalog reference through its authoritative source and repair any demonstrated footer defects while preserving existing conventions.
6. Update staff/developer guidance and run focused checks followed by the complete gate on the final source.

Keep each checkpoint reviewable. Avoid unrelated repository cleanup or infrastructure changes.

## Validation and handoff

- Add focused regressions for actual changed behavior; preserve existing assertions, thresholds and historical reference hashes.
- Use real Chromium/PDF checks for copy completeness, note preservation, pagination and footer geometry. Keep measured browser checks serial.
- Run the full `tools/verify_release.py` gate with the pinned Python/browser environment. Record exact commit, exit status and actual counts; the baseline contains 155 regression suites, 281 axe screens and 69 historical authored-print variants, but future totals must come from the run.
- Retain the PR #32 bounded activity-counter wait. Do not use a fixed sleep to conceal races.
- Update current staff Markdown and regenerate HTML/Word/PDF together with the supported manual builder when staff guidance changes. Update source inventory for additions/deletions through the supported process.
- In the development PR, list each requirement, its implementation, reproduced versus unconfirmed causes, screenshots/PDF evidence using synthetic data, compatibility decisions, actual test results and any new unresolved questions.
- State merge readiness separately from City Windows/network, Outlook, physical print/envelope, staff, assistive-technology and legal acceptance. Do not claim those acceptances from an automated gate.
- Do not merge, package or deploy unless subsequently requested.

## Completion checklist

- [ ] Import inspection wording is consistent without routing changes.
- [ ] Referral correction dates appear once per actual event, with CORRECTED beneath the date.
- [ ] New compliance letters retain item histories, notes and correct Abate values.
- [ ] Every supported regular/snow citation issuance/correction path produces four distinct approved copies per charge.
- [ ] Correction money displays consistent dollars/cents without changing stored prices.
- [ ] Current order-language reference reads `27.05(2)(g)2` without pricing or historical changes.
- [ ] Best Interest special entry contains only the requested Reasons input; validators and narrative follow the confirmed workflow, with no signer block.
- [ ] Best Interest signer bubbles are removed; remaining footers are checked and genuine defects corrected without imposing new wording.
- [ ] Historical compatibility, complete verification, documentation and review PR are complete.
