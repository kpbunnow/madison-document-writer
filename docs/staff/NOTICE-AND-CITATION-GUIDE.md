# Notice and citation guide

Applies to the current release. The Writer shows its build and helper version; the install guide states the expected values.

Current instructions are consolidated in PROGRAM-MANUAL.html and Program_Instruction_Manual.pdf. This quick guide reproduces the relevant current procedures. Use the City acceptance record (Rnn-ACCEPTANCE-RECORD.md at the top of the release package) for outstanding City acceptance and legal/policy approvals.

## 5 Prepare an Official Notice

Start from the imported initial inspection. Verify owner, property, parcel, inspector, inspection date and any supplied time. When a check identifies a missing field, use Go to first required field or the check's link to reach it on the working document. The Inspection section appears only when there is something to act on there, such as special-document details, snow facts or a correction. The parcel comes only from the Accela import: if it is missing or not 12 digits, correct it in Accela and import the inspection again; a notice cannot be issued without it. Review the mailing block rather than relying on an address parser to establish ownership or service.

1. Choose Violation Items at the top of the document. In the Select for this notice picker, find the appropriate selectable order language and select it once. A checkmark means it is already on this notice. Select it again to remove it from the unissued draft. The same library entry cannot be added twice.
2. Choose Done adding. Review each item's ordinance, corrective action, location and case-specific details. Outlined fill-in bubbles identify missing details. Click a bubble or focus it and press Enter, enter the factual detail, and review the sentence afterward.
3. Tick the checkbox beside each due date that shares a deadline (Select item N for a shared due date). In Assign due dates below the document, which counts the selected items, enter the date and choose Apply date to selected items. Use Select all or Clear when appropriate. Repeat for other groups. New items begin without an automatic deadline.
4. Keep no more than three distinct outstanding-item deadlines under the existing notice rules. A batch that would create a fourth is rejected without changing the items. An invalid individual edit may be saved as work in progress but blocks issuance.
5. Review the whole document, not only the edited sentence. Check recipients (the Recipients button opens copies, email and registered agent; Done closes it once the entries are valid), contact details, the mailing date, the item order and all warnings. The readiness summary at the top counts required fixes and advisories; Go to first required field jumps to the affected field, and Review (or Open full checklist) opens the Review dialog: checks that must be fixed before issuing, then advisories, or a statement that there are no concerns. Each check links to its field; closing the dialog returns you to where you were. A copy can be changed to the type Violator when the person who is responsible for the violation is not the property owner: that person replaces the owner as the main contact in the mailing address block and as the defendant on any citation, and repeat offenses are counted against that person's address. The owner is still copied under CC unless you clear Also copy the property owner (this choice is kept for the case). A case has one Violator, and a snow removal case always uses the owner. A Violator row left completely empty is dropped when you close Recipients and the owner is the main contact again; one with only part of the name and address filled in must be completed first. The mailing block is read-only while a Violator is set; change it in Recipients. Install the release that includes this feature on every PC before using it, because earlier releases print the Violator as an ordinary copy.
6. Choose Save draft & return to Workspace to retain unfinished work, or Issue when ready. After a confirmed shared save, Writer returns to Workspace with the issued case highlighted; if the save is refused or not confirmed, the document stays open. Verify the resulting save state.

Private wording edits belong to the retained draft. Removing and reselecting the same source in that draft restores its identity, edited text, ordinances, due date, location and notes. A newer catalog version requires explicit review and adoption; it does not silently replace private wording.

**Initial citations.** The Cite option appears only when the imported Accela inspection status is Citation. Select Cite only for the items actually being charged. Complete Initial-inspection citations before using Issue notice and citations together. The deadline record and citation save atomically; the initial-citation letter carries the notice content. The notice is retained as Delivered within the citation rather than producing an extra owner notice. Each charge has four court copies. No reinspection is invented.

Use a correction after issuance. Do not renumber or delete historical items to hide an error. The program's checks support the division's process; a green check is not a legal determination about the selected ordinance or deadline.


## 7 Prepare and complete citations

Open the charge card for each selected item. Its summary shows the charged ordinance, citation number, dates and amount status. Edit charge and dates exposes the editable facts; Pricing details and authorization shows the schedule resolution, assessments, counted history and approved basis. The court faces are previews of the same retained charge.

1. Select one actual charged ordinance for each item. An item with several listed sections shows a Charged ordinance select with exactly those sections and nothing chosen; choose the section actually charged (saved drafts show the select unchosen and cannot be issued until a section is chosen). The deposit fields then fill from the configured schedule for the pricing date; changing the choice clears the previous charge's values and prices the new one. If no single schedule entry applies, a blocking concern explains it rather than guessing an amount. Charging a section that is not listed on the item is a different charge and needs an approved source. Multiple offenses under one ordinance require the appropriate offense selection.
2. Verify the description, citation number, officer or department identifier, issue date, violation date and time, court date and session. Court suggestions are not reservations; use the division's current court and numbering instructions.
3. Complete any required measurements in that charge card. Conditional or unmapped entries require review; the program must not borrow an unrelated amount.
4. Complete the deposit method and its source. Choose Complete charge after the required fields are valid. Other unfinished charge cards remain unfinished.
5. Review all four court copies for every charge and the complete letter before issuance. Confirm shared pricing/history checks. Changed history or a changed charge may require another deliberate pricing review.

| Deposit method | What the inspector supplies |
| --- | --- |
| Schedule | The applicable unambiguous verified entry, offense and required measurements; review the computed tier and history |
| Approved base + assessments | The actual approved base, required court-cost facts and an approved source or reason; the program calculates the total |
| Approved total (assessments included) | The actual approved final total and authority; the program does not add assessments again |

A recorded source documents the operator's basis; it does not create court approval. A determined amount remains read-only unless the separate authorized administrative exception process is used. Blank differs from an explicitly approved zero base. Total cash deposits must be valid positive currency where required. Consult the current schedule and division policy rather than using an old example amount from a guide.

Equivalent ordinance formatting retains the approved basis. A different ordinance or offense requires the appropriate new review. Unchanged-charge corrections retain historical pricing and court costs. Citation issue date and a corrected document's mailing date are separate facts.

**Mandatory appearance.** New mandatory-appearance issuance is held in both Writer and the helper until approved distinct defendant instructions are integrated. Keep the draft and contact the division policy owner. Do not enter a deposit or switch the charge merely to bypass the hold. Historical frozen reprints are not rewritten.


## 12 Review issue file and deliver

Review the complete letter and every associated court copy. Check the case identity, respondent, item scope, factual dates, mailing date, recipients, signature authority, approved pricing and all unresolved checks. Clicking a check reveals the relevant collapsed section and focuses its specific field. Fill-in bubbles, missing dates or sources, shared conflicts and policy holds must be resolved before issuance.

**Issue deliberately.** Use Review first: the Review dialog lists checks that block issuance and advisories, each linked to its field, with passed checks collapsed. Then choose Issue, read the summary and confirm the intended action. Confirming validates the current document again. Writer first retains the exact issue request on this device. The helper validates and publishes the document and any new visit together to the shared record. Initial notice/citation companions use their atomic batch. Only confirmed shared publication establishes issued status.

| State after an attempt | Correct next step |
| --- | --- |
| Save confirmation needed | Confirm the retained original attempt; do not make a duplicate document |
| Shared publication rejected | Read the current conflict, pricing, catalog or integrity check; review and resolve before retry |
| Issued with PDF filing needed | Use Open document to file PDF, then File issued PDF in the document, or review its original filing status |
| Waiting for connection | Keep the retained request/draft and follow Saved work & connection |

**Original PDFs.** The filing process retains the exact prepared original and its receipt. Retry retrieves and files those same bytes when available. A marker that says previously filed is not enough if the actual original cannot be verified. Do not regenerate a different document as a substitute for missing original evidence. A draft PDF is visibly a draft and is not proof of issuance.

**No Chrome or Edge.** PDF production needs Chrome or Microsoft Edge on the computer. If the helper did not find one, File issued PDF says so; ask IT to install it and use File issued PDF again. The issued case record is not affected.

**Print and mail.** Verify every page in the actual viewer. Use the City-approved scaling and envelope/print settings established during acceptance. Inspect all four MC-2000 copies, long letters and snow continuation pages. The authoring-11 initial packet may have six pages. Do not remove a continuation merely to meet an old page-count expectation.

**Email.** Select and verify the recipients in the issuance review. Outlook handoff opens a draft; inspect its subject, addresses, body and attachments and send under the division's procedure. Opening Outlook or successfully preparing the draft does not prove sending, receipt or service.

**Outside records.** Complete actual mailing, court filing, approved abatement steps and Accela recording separately. Document Writer is not an Accela write integration or an automatic dispatch service. Use retained record notes for relevant factual references; do not describe a filing attempt as completed delivery.

