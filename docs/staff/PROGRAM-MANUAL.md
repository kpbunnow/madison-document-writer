# Program instruction manual

Madison Building Inspection Document Writer

Release 2026-10-31 R67 · Helper 2026.10.31.68 · 31 October 2026

This manual explains how inspectors prepare documents, preserve case history, recover unfinished work and use Reports. It also gives administrators the installation and maintenance procedures needed to support the program. Follow the division's actual authority, court instructions and records policy when using these features.

R67 is a release candidate for City acceptance. Its security checks require the same ordinary document, history and recovery procedures described below. Automated verification does not replace the outstanding City Windows and network tests, staff and assistive technology acceptance, or legal and seasonal policy decisions listed in the carried-forward City acceptance record. New mandatory-appearance citations remain blocked until approved defendant instructions are supplied and integrated. Historical frozen reprints remain available. No live deployment is included in this release.

## 1 Start here and daily routine

When Writer opens, wait for **Restoring saved workspace** to finish. If **Saved workspace could not be restored** appears, editing is paused to protect saved work. Choose **Reload and retry**; if the problem continues, ask IT to check this browser profile and preserve its saved work. Do not clear browser site data to bypass the message.

Document Writer prepares Official Notices, Extensions, Citations, Referrals for Prosecution, Compliance Letters, Summary Abatement Orders, Non-Summary Abatement Orders, No Occupancy documents, Best Interest Extensions and Vacancy Extensions. It retains linked corrections, physical inspection history, private drafts, original PDF receipts and reporting summaries. Referral updates and occupancy releases are modes within their families.

**Before using operational cases.** Have IT install the complete deployment, link the approved shared folders and confirm the independent integrity anchor. Have the division complete the acceptance record and authorize the workflows staff will use. The program's entry of a reviewer name is a retained statement, not authentication of a role or proof of legal approval.

**Start a working day.** Double-click the Document Writer icon on the desktop. It starts the program without a command window and opens Writer in its own Chrome or Edge window; if Document Writer is already running, the icon opens Writer again, or first installs a newer release when one has been deployed. Keep one Writer window open in the same browser profile. Confirm Build 2026-10-24 R63 and helper 2026.10.24.64. Open Workspace and resolve any save confirmation, shared-history or PDF-filing exceptions before creating replacement work. Check pending deadlines and reminders.

**Prepare work.** Use Import inspection for a new case or unused completed inspection. Use Workspace to continue a retained document or worksheet. Add the appropriate language, fill all case-specific details and assign required deadlines deliberately. Use the readiness summary at the top of a document (Go to first required field; Review or Open full checklist opens the Review dialog) or a worksheet's Inspection checks to find incomplete fields. Saving an unfinished draft is permitted even when issuance checks are unresolved.

**Finish an action.** Review the complete document, citation copies where applicable, dates and recipients. Use Issue only when the facts and required approvals are complete. Wait for confirmation of the shared save; Writer then returns to Workspace with the issued case highlighted. Then verify original PDF filing, printing, actual mailing or email sending, and the division's court or Accela recording separately.

**End a working day.** Use Save draft & return to Workspace and verify device saving. Resolve or preserve queued work through Saved work & connection. Download a workspace backup when moving profiles or when recovery is needed. To stop the program at the end of the day or when IT asks for an update, open Tools & settings and choose Exit Document Writer under Saved work & connection (see Stop Document Writer below). Closing a Writer or Reports window does not stop the program. Do not clear browser site data while unfinished work exists.

**Stop Document Writer.** Exit Document Writer first saves your drafts on this device and lists anything unfinished. It refuses while a document is being issued, a PDF is being filed, an email is being prepared or device saving has failed; wait or follow the guidance shown, then choose Exit again. Queued shared saves and PDFs waiting in the local outbox are listed with what happens to them: they stay queued on this device and are retried when the program starts again, and they are not in the shared folder until then. Confirm that you understand, then choose Exit Document Writer. Every open Writer and Reports window then shows Document Writer has stopped and loses its connection. Drafts saved on this device stay. To start again, double-click Document Writer on the desktop.

The four Writer destinations are Workspace, Order language, Reports, and Tools & settings. Writer normally opens in Workspace. Its Start or find case work area contains Import inspection for unused Accela inspections and Search shared case records for existing work. Open Reports ↗ opens Reports in a new tab. Editing a case remains within Workspace. When Open case in Writer brings a case from Reports, the Writer rail shows Back to Reports instead, which returns to the same report.

**Warnings and errors.** Warning and error messages at the top of the page clear after 15 seconds each time they are shown (hovering or focusing a message restarts the timer), in Writer and in Reports. Cleared messages remain in Message history. Checks that block issuance stay in the Review dialog until resolved, and ongoing conditions stay visible in their own indicator until resolved.


## 2 Install update and verify the workstation

**Administrator procedure.** Use the deploy folder from the current release package. Do not install individual files from source. Inspectors do not need Node.js or npm. The supported environment is 64-bit Windows with Chrome or Edge and a compatible Python version listed in the generated deployment guide. Classic Outlook is the supported draft handoff target; New Outlook has not been accepted.

1. Back up the existing program, case folder, PDF folder, GIS folder, configuration and integrity evidence. Ask every user to save and sync work, then stop the program with Exit Document Writer in Tools & settings. An older version without Exit Document Writer in Tools & settings stops another way: close its command window if it was started with Start Document Writer.bat, otherwise sign out of Windows and back in.
2. Before extraction, compare the package SHA-256 with the digest obtained independently from the release owner. Use Get-FileHash -Algorithm SHA256 in PowerShell. Keep verified prior packages separately for deliberate IT rollback and test acceptance in isolation.
3. Place all deploy files and the vendor folder in a division-owned program folder. Preserve operational folders and settings. Grant inspectors read-only program access and grant write access to the release owner only; grant case, PDF and GIS write access as required. Keep these permissions distinct. Restrict administration and independent anchor permissions through IT.
4. Have IT check the deploy ZIP’s SHA-256 against the value the release owner publishes separately, then run Start Document Writer.bat (the diagnostic launcher) once on each PC from that checked deployment. It installs the local runtime and creates or updates the Document Writer desktop icon; an existing Document Writer shortcut is changed to start without a command window.
5. Confirm the build and helper versions shown in the install guide. If a message says an older version is still running, stop it as the message explains (Exit Document Writer when it offers one; otherwise close its command window or sign out of Windows), then double-click the Document Writer icon again.
6. Open Tools & settings → Saved work & connection. Expand Connection checks and technical details, then open connection checks and Storage diagnostics. Confirm the intended shared paths, helper health and permissions. Use Rebuild reporting index in Storage diagnostics when an administrator has confirmed a rebuild is appropriate.
7. Open Reports → Data and definitions. Review coverage and excluded records. Test an approved synthetic case through save, exact PDF retrieval and recovery before operational use.

**Compatibility.** This release uses case schema 5, summary version 6, workspace backup version 2 and current authoring version 16. Every issued document keeps the authoring version it was issued with, and its reprints and corrections keep that format; chapter 22 lists the earlier document formats. Earlier releases predating schema 5 cannot read schema-5 case files. An earlier release does not know a newer authoring layout: before rollback, finish or discard unfinished drafts and corrections, and afterwards rely on the retained original PDFs for documents issued under the newer release. A runtime rollback changes installed files; it does not reverse issued records or restore workspace data. IT must assess data compatibility and retained requests before rollback. Never replace current operational records with an old backup without an approved recovery plan.

**Checked updates.** After the first installation, launch from the installed desktop shortcut. Before replacing program files, the launcher checks the shared deployment against runtime-manifest.json: exactly the listed files, each with its listed size and SHA-256, and no older release than the one installed. Missing, extra, changed, partial or older copies are refused and the PC keeps its current version, with saving to the shared folder paused until IT fixes the deployment folder. This catches mistakes and damaged copies; protection against deliberate tampering comes from the deployment folder being writable only by the release owner.

**Newest release required.** Opening Document Writer always installs the newest release from the deployment folder. If an older copy is still running, the icon stops it first (it waits if that copy is saving or filing, and says so). A copy left open when a new release is deployed stops saving to the shared folder and asks you to exit and open Document Writer again; your work stays on this computer. Without the shared folder (for example off the network), Document Writer starts the installed copy and saves wait until the folder is reachable.

**Browser session.** The installed shortcut connects this browser to the current helper session. A fresh unauthenticated browser page asks you to open that shortcut. The shortcut supplies the temporary connection secret and the page immediately removes it from the address bar. Never copy a shortcut session URL into a message or another user's profile. Requests to case, PDF, email and administrative services require the current session. The public readiness probe exposes only version and readiness.

**After a helper restart.** A previous session cannot submit another request. After Exit Document Writer, double-click Document Writer on the desktop to start again. Reload the page in the same browser profile to reconnect. Private work remains in the original profile. If the page asks you to use the installed desktop shortcut, use it. Review any retained save confirmation or pending request before retrying; a refusal does not prove whether an earlier request completed. Do not clear site data or create a replacement issued action.

**Deliberate rollback.** IT first preserves the complete current installation, device profile and backup, operational records, PDF receipts, configuration and independent anchor evidence, then stops the program (Exit Document Writer, or sign-out for a helper without it) and closes its windows. Restore the separately retained trusted earlier installer using the documented rollback procedure. The shared folder never downgrades a PC automatically. Runtime rollback never rewinds issued records or replaces current case data.

The generated Start Document Writer - READ ME.md is the file-level installation reference. The City acceptance record (Rnn-ACCEPTANCE-RECORD.md at the top of the release package) provides the required test and signoff form.

## 3 Use Workspace and case history

Workspace is the queue for cases loaded on this device. It starts in Needs attention. The quick views Needs attention, Continue work, Deadlines, Needs resolution and All cases are the main filter; More views adds Due within 7 days, Past due, Open and Closed. Counts represent cases rather than individual tasks within a view; a case may appear in more than one view. Quick views and More views keep the workspace search and inspector filter, so the rows shown match all three; only Clear search and inspector removes them. Returning More views to More views… shows Needs attention again. Needs resolution lists cases with unconfirmed or queued saves, PDF filing and transfers, record problems and other blockers; device save and connection problems appear in the Saved work & connection banner. Check All cases and More views when the expected case is not visible.

**Find and continue a case.** Search this workspace by address, case number, owner or parcel. Apply the inspector filter if useful. When a workspace search finds nothing, Search shared case records for “…” opens the shared search with the same text; it searches only when you submit it. Use the main action beside the case to continue its next task. It may say Continue import, Continue document, Continue reinspection, Complete recorded visit, Reinspect or View case. An uncertain shared save takes priority over starting another draft. A record verification problem takes priority over editing.

Open Case details and history for secondary actions, the document list, timeline, case export and Remove from this workspace. Removing a case from this workspace takes it off this device's queue after the relevant safeguards; the shared case record is not deleted. A case with unsaved or unconfirmed work is refused or asks before that work is lost. Remove cases from this workspace, below the list, removes several cases and separates those that are safe to remove. Use Search shared case records (Workspace toolbar or Tools & settings) to locate records outside the current device workspace. Open saved case can load an exported case record, subject to the program's shared-history checks.

**Understand the record.** A case retains the original numbered items and the issued event history. A new visit records what happened on a genuinely completed inspection. A correction amends a recording error in an existing action. A record note adds an explanation without rewriting the earlier document. A withdrawn item keeps its identity and reason and is not credited as corrected.

Issued documents use frozen source facts. Changes to current owner details, catalog wording or policy do not rewrite an old issued PDF. Review current case facts for future documents and use the correction process when issued evidence contains an error.

**Resolve attention states.** Open the named case action rather than making a replacement case. Confirm save uses the retained original request. Review shared changes compares the current shared record. Save case to shared folder saves a queued case file after shared history is checked; it is also among an issued document's actions while the shared folder is connected. Without a connection that action reads Download workspace backup: it downloads a backup and does not save the shared case record. Connect shared folder beside it opens the connection settings. File issued PDF completes original filing after issuance. Saved work & connection explains whether the remaining work concerns this device, shared cases or PDFs.

Navigation first saves device work. If that save fails, Writer keeps the current screen and offers a workspace backup. Keep the tab open and preserve that backup before restarting or clearing anything.

## 4 Import a case or later inspection

**Open cases by inspector.** Import inspection opens with an Open cases by inspector card above the case-number lookup. Choose an inspector, then Show open cases. The list shows each open enforcement case with its case number, address, description and the latest inspection's type, status and date; type in the search box to narrow it by case number, address or description, and use Refresh to load it again (the time it was loaded is shown). Choose Import on a case: Document Writer puts that case number in the lookup box and runs Find Case Inspections for it, so everything after that works exactly as for a typed case number. Import is unavailable while a lookup is running or while another import is waiting for review below (finish or cancel it first). If the list cannot load, a plain message says why (for example your Windows account cannot read the case database, or the City network timed out) with Try again. The list is not saved and is loaded fresh each time you open the program. The case-number lookup below the list remains for any case that is not on it.

**Direct lookup.** In Workspace choose Import inspection, enter the complete case number and choose Find Case Inspections or press Enter. The Windows helper runs the supplied read-only SQL query with the signed-in Windows account. Inspectors do not enter SQL, passwords or server settings. The initial default server is sqlelam; IT can set the approved database and server in shared Case Lookup/settings.json.

Select an eligible unused inspection with an actual date and supported type. If several results qualify, choose explicitly: each result shows its Inspection type, Date (with time), Inspector and Status, and the one you choose is highlighted. Scheduled, Pending, Completed, Inspection and No Violation results, Reinspection and No Fee Reinspection results on any inspection type other than a Reinspection, Initial Inspection results with No Entry, Assist inspections, undated rows and inspections already used on the case are not listed. An inspection already recorded on any document or visit of the case, including drafts, withdrawn and corrected documents, counts as used; re-importing the inspection of an unfinished draft or worksheet still refreshes it. Any other type and status combination is listed under Not available for import, greyed with its reason, and cannot be selected. When nothing can be listed, the review explains which kinds of rows the report returned. A result status is not proof that this program issued a document; shared records independently prevent inspection reuse.

The imported inspection's **Inspection Type** and **Inspection Status** decide the document; there is no “Choose next action” step.

- **Initial Inspection** starts a new case only (a case that already exists, including a snow case, is refused). Official Notice → Official Notice; Citation → Citation (at least one item marked for citation); No Occupancy → No Occupancy; Abatement Summary → Summary Abatement; Abatement Non-Summary → Non-Summary Abatement.
- **Reinspection** needs an existing case. CA Referral or City Attorney Referral → Referral for Prosecution (the case’s first referral); Compliance → Compliance Letter (every item Corrected); Citation → Citation (at least one item cited); Extension Processing or No Fee Extension Processing → choose Extension, Best Interest Extension or Vacancy Extension; No Occupancy or No Fee No Occupancy → No Occupancy; Reinspection or No Fee Reinspection → Reinspection Notice (the item list is updated and every due date stays as assigned). On a snow case, Citation records the next snow event.
- **CA Reinspection** needs an existing case that has been referred. Compliance → Compliance Letter; Non Compliance → Update for Case Referral.
- Any other combination cannot be imported: set the specific result in Accela and retrieve it again.
- On a case already referred to the City Attorney, only results that lead to an Update for Case Referral or a Compliance Letter can be imported.
- If recorded results contradict the status (for example Compliance with an item not Corrected), the document cannot be issued. Correct the results, or correct the status in Accela and import the same inspection again; the open draft or worksheet is updated without losing your work.

**Review an existing case.** Check the case number, address, selected inspection and proposed property or owner changes. Expand source details if needed. Choose Continue existing case to open its retained draft, worksheet or latest effective issued source without importing the proposed changes. Choose Import inspection only for an eligible unused physical inspection after the shared preflight succeeds. Existing unfinished work and reused observations must be resolved first.

**Excel alternative.** Open the SSRS Excel alternative and select the division's exported inspection report. Review the same identity and completed-inspection facts and confirm explicitly. CSV paste and manual case creation are not provided. Use the actual Inspection Time column; a missing time stays blank and a scheduled date does not substitute for an actual inspection date.

Record Category Snow Removal selects the snow workflow and preloads its 10.28 item. The new-case workflow selector is an additional deliberate choice, not a way to bypass missing or reused inspection facts. Existing case and file identities remain stable.

**Pause or retry.** Save draft & return to Workspace retains the lookup or review on this device. A retained review is a snapshot with its retrieval time; use Find Case Inspections again for fresh information. Cancel lookup suppresses its result. A failed or empty lookup preserves prior work. If the shared case changed, review the refreshed comparison and confirm again. A delayed earlier result must not replace the current case or reopen Import after navigation.

The source query has no permanent inspection ID. Matching uses case, type, actual date and normalized time, with conservative handling of missing historical time. Do not alter time to bypass a reuse warning. See CASE-LOOKUP-GUIDE.md for SQL setup and diagnostic codes.

## 5 Prepare an Official Notice

Start from the imported initial inspection. Verify owner, property, parcel, inspector, inspection date and any supplied time. When a check identifies a missing field, use Go to first required field or the check's link to reach it on the working document. The Inspection section appears only when there is something to act on there, such as special-document details, snow facts or a correction. The parcel comes only from the Accela import: if it is missing or not 12 digits, correct it in Accela and import the inspection again; a notice cannot be issued without it. Review the mailing block rather than relying on an address parser to establish ownership or service.

1. Choose Violation Items at the top of the document. In the Select for this notice picker, find the appropriate selectable order language and select it once. A checkmark means it is already on this notice. Select it again to remove it from the unissued draft. The same library entry cannot be added twice.
2. Choose Done adding. Review each item's ordinance, corrective action, location and case-specific details. Outlined fill-in bubbles identify missing details. Click a bubble or focus it and press Enter, enter the factual detail, and review the sentence afterward.
3. Tick the checkbox beside each due date that shares a deadline (Select item N for a shared due date). In Assign due dates below the document, which counts the selected items, enter the date and choose Apply date to selected items. Use Select all or Clear when appropriate. Repeat for other groups. New items begin without an automatic deadline.
4. Keep no more than three distinct outstanding-item deadlines under the existing notice rules. A batch that would create a fourth is rejected without changing the items. An invalid individual edit may be saved as work in progress but blocks issuance.
5. Review the whole document, not only the edited sentence. Check recipients (the Recipients button opens copies, email and registered agent; Done closes it once the entries are valid), contact details, the mailing date, the item order and all warnings. The readiness summary at the top counts required fixes and advisories; Go to first required field jumps to the affected field, and Review (or Open full checklist) opens the Review dialog: checks that must be fixed before issuing, then advisories, or a statement that there are no concerns. Each check links to its field; closing the dialog returns you to where you were. A copy can be changed to the type Violator when the person who is responsible for the violation is not the property owner: that person replaces the owner as the main contact in the mailing address block and as the defendant on any citation, and repeat offenses are counted against that person's address, except for charges counted by property, such as erosion control under MGO chapter 37, where the repeat count still follows the property. The owner is still copied under CC unless you clear Also copy the property owner (this choice is kept for the case). A case has one Violator, and a snow removal case always uses the owner. A Violator row left completely empty is dropped when you close Recipients and the owner is the main contact again; one with only part of the name and address filled in must be completed first. The mailing block is read-only while a Violator is set; change it in Recipients. Install the release that includes this feature on every PC before using it, because earlier releases print the Violator as an ordinary copy.
6. Choose Save draft & return to Workspace to retain unfinished work, or Issue when ready. After a confirmed shared save, Writer returns to Workspace with the issued case highlighted; if the save is refused or not confirmed, the document stays open. Verify the resulting save state.

**Fill-in details.** To fill a missing corrective-action detail, activate its fill-in bubble, enter text in Add corrective-action detail and choose Save. Cancel or Escape leaves the bubble unchanged. The dialog returns focus to the item and uses the ordinary draft-saving process.

Private wording edits belong to the retained draft. Removing and reselecting the same source in that draft restores its identity, edited text, ordinances, due date, location and notes. A newer catalog version requires explicit review and adoption; it does not silently replace private wording.

**Initial citations.** The Cite option appears only when the imported Accela inspection status is Citation. Select Cite only for the items actually being charged. Complete Initial-inspection citations before using Issue notice and citations together. The deadline record and citation save atomically; the initial-citation letter carries the notice content. The notice is retained as Delivered within the citation rather than producing an extra owner notice. Each charge has four court copies. No reinspection is invented.

Use a correction after issuance. Do not renumber or delete historical items to hide an error. The program's checks support the division's process; a green check is not a legal determination about the selected ordinance or deadline.

## 6 Find select and review order language

Order language (Browse language) and the Select for this notice picker use Approved and standard by default (owner decision 2026-11-01), so bundled language that the owner approved for selection but the division has not yet reviewed is listed. Search ordinary words, a title, an ordinance or a catalog identifier across checklists. Multiple terms narrow the results. Trash, garbage, rubbish and refuse are related search terms; handrail, railing and banister are also related.

Each result shows an ordinance and a short corrective-action preview. Open Full wording and guidance for complete text, fill-ins, retained draft wording and review provenance. Check the status before selecting. “Review status from cache · refreshing” identifies retained browser review information while the helper checks it. “Review status from cache · refresh unavailable” means that check could not finish. A cached label does not grant approval or bypass the helper's publication checks; reconnect and refresh when current review confirmation is needed.

| Scope or status | Meaning for use |
| --- | --- |
| Approved language | Entries with a formally recorded approved review; a narrower scope |
| Approved and standard | The default discovery scope: approved entries plus standard entries, which keep selection eligibility but have no recorded formal review |
| Needs review | Proposed or incomplete entries for review; not a shortcut to selection |
| Standard and retired | Reference scope including replaced or retired sources |
| Selected on this notice | Sources already selected, even if their later status changes |

Order language shows section references without a trailing period, for example 27.05(2)(g)1 and 27.05(2)(h)3; this does not change the charge identity or pricing.

All bundled order language can be selected except seven entries that still have no confirmed ordinance section (both carbon monoxide alarm entries, Occupancy Exceeds Permitted Use, Required permit inspections, Historic exterior work approval, Sleeping room without required egress and Unapproved room use). The owner approved the other formerly draft entries for selection on 2026-10-31, so they appear under Approved and standard, not under the default Approved language scope, which lists only entries with a recorded review. The seven are greyed out with their status until the division gives each its section and records an approved review under Order language → Review catalog. Picking the snow removal item on a new notice turns the draft into a snow removal citation (MGO 10.28); the picker stays open, and picking the snow item again restores the notice so other language can be added.

Unreviewed proposed, incomplete, replaced, retired and unavailable sources cannot be newly selected. Find approved replacement locates an alternative; it does not change the draft. Review and use v… opens a comparison before adopting a new source version. Issued documents remain frozen.

**Review catalog.** An authorized reviewer opens Review catalog within Order language, or Tools & settings → Administrator tools → Review catalog; Browse language returns to search. Select the entry, compare bundled/current/unsubmitted wording, and supply the actual reviewer, corrective action, ordinance references and source or authority. Identify a replaced entry where applicable. Confirm the intended review explicitly.

Recording creates an immutable shared version. If another operator has submitted a newer version, compare it and choose Use current v… as review basis before retrying. The app preserves unsubmitted forms on this device, including later edits made while a save was pending.

Review save was not confirmed may indicate a lost acknowledgement after a successful shared write. Refresh and compare recorded status before retrying. A later browser-cache failure does not undo an acknowledged shared review. During an outage, cached status is last-known information and cannot authorize proposed wording. New issuance still requires the normal successful shared review check.

Named reviewers are operator-supplied. IT permissions and division authority govern who may record decisions. Favorites and role-based logins are not configured by this release.

## 7 Prepare and complete citations

Open the charge card for each selected item. Its summary shows the charged ordinance, citation number, dates and amount status. Edit charge and dates exposes the editable facts; Pricing details and authorization shows the schedule resolution, assessments, counted history and approved basis. The court faces are previews of the same retained charge.

1. Select one actual charged ordinance for each item. An item with several listed sections shows a Charged ordinance select with exactly those sections and nothing chosen; choose the section actually charged (saved drafts show the select unchosen and cannot be issued until a section is chosen). The deposit fields then fill from the configured schedule for the pricing date; changing the choice clears the previous charge's values and prices the new one. If no single schedule entry applies, a blocking concern explains it rather than guessing an amount. Charging a section that is not listed on the item is a different charge and needs an approved source. Multiple offenses under one ordinance require the appropriate offense selection.
2. Verify the description, citation number, officer or department identifier, issue date, violation date and time, court date and session. Court suggestions are not reservations; use the division's current court and numbering instructions.
3. Complete any required measurements in that charge card. Conditional or unmapped entries require review; the program must not borrow an unrelated amount.
4. Complete the deposit method and its source. Choose Complete charge after the required fields are valid. Other unfinished charge cards remain unfinished.
5. Review all four court copies for every charge and the complete letter before issuance. Confirm shared pricing/history checks. Changed history or a changed charge may require another deliberate pricing review.

**Citation copies.** Citation editors initially show all four distinct Court, Agency, Inspector and Defendant copies per charge. Show representative court copies optionally switches to a compact preview; Show all four citation copies restores the complete preview. Every final citation packet contains all four distinct approved copies for each charge; longer packets may contain additional letter or continuation pages. Verify the issued PDF, not only the compact editor view. Incomplete new citation packets are refused instead of silently filed. Existing single-page and continuation footer conventions and approved citation forms are retained; verify the actual PDF and City print settings.

| Deposit method | What the inspector supplies |
| --- | --- |
| Schedule | The applicable unambiguous verified entry, offense and required measurements; review the computed tier and history |
| Approved base + assessments | The actual approved base, required court-cost facts and an approved source or reason; the program calculates the total |
| Approved total (assessments included) | The actual approved final total and authority; the program does not add assessments again |

A recorded source documents the operator's basis; it does not create court approval. A determined amount remains read-only unless the separate authorized administrative exception process is used. Blank differs from an explicitly approved zero base. Total cash deposits must be valid positive currency where required. Consult the current schedule and division policy rather than using an old example amount from a guide.

Equivalent ordinance formatting retains the approved basis. A different ordinance or offense requires the appropriate new review. Unchanged-charge corrections retain historical pricing and court costs. Citation issue date and a corrected document's mailing date are separate facts.

**Mandatory appearance.** New mandatory-appearance issuance is held in both Writer and the helper until approved distinct defendant instructions are integrated. Keep the draft and contact the division policy owner. Do not enter a deposit or switch the charge merely to bypass the hold. Historical frozen reprints are not rewritten.

## 8 Prepare snow removal citations

Snow is a dedicated MGO 10.28 workflow. Record Category Snow Removal selects it automatically; an eligible unissued new case can also select the snow workflow deliberately. It uses the one snow item without an Official Notice, ordinary deadline or fabricated reinspection event. Other violations require a separate case.

1. Import the actual completed snow inspection. Verify parcel/site, respondent, mailing address, inspector, date and time.
2. Enter the accumulation date, a positive decimal depth in inches and the observed condition: snow covered, ice covered, or snow and ice covered. Confirm photographs and select the corner-lot/curb-ramp option when factually applicable.
3. Check the timing message. The supplied rule allows until noon City time on the day after accumulation. An observation before that point is blocked. Use actual facts; never adjust the date or time to pass a check.
4. Review ordinance 10.28, number, description, comment, counted property history, deposit and court session. Refresh citation history if prompted. Missing parcels use the existing normalized address fallback, which requires particular attention to source identity.
5. Review seasonal letter content. After an authorized administrator changes it, choose Refresh seasonal letter and review the new content. Stale shared content prevents issuance until reconciled.
6. Issue, confirm the shared save (Writer returns to Workspace with the case highlighted) and verify the original PDF. The standard authoring-11 packet includes the snow cover and retained language-access continuation plus four MC-2000 copies; a cover may continue onto another page. Do not force a five-page total or remove language to shorten the packet.

The snow item has no due date. Ordinary deadline assignment, reminders, overdue calculations and Days to compliance do not invent a deadline for it. The default closes the snow case when its PDF is filed; that status does not confirm mailing, payment, court disposition or Accela recording. A later unused snow inspection can still create its next citation within the same case. The same property/date/time observation cannot be cited again.

**Division policy decisions.** The packaged defaults use a July 1 season boundary, count prior different owners at the same property and close on PDF filing. These defaults, the description, labels, contacts and seasonal content need actual division confirmation. The bundled sand-site list is the supplied 2025–26 material with no named current seasonal review. A warning does not certify the list for 2026–27.

Tools & settings → Review snow-letter content records the administrator, reason, source and confirmation. New snapshots freeze the content actually used. Old reprints do not automatically adopt a later season or price.

## 9 Record a reinspection

**Group due dates on reinspection.** On an open reinspection worksheet with an extension or citation intent (or before choosing an intent), Assign due dates appears beside item review, outside collapsed Inspection checks. It lists the items still outstanding; select items, choose a date and Apply date to selected items. The selected-item count shows the scope within this reinspection only. Corrected, withdrawn and carried results are excluded. Undo restores the previous dates while the worksheet remains editable. The three-date limit and seven-day spacing apply.

Open Reinspect from the case or import an eligible unused completed reinspection. To return to an unfinished worksheet, use Continue reinspection in the case details (beside Discard reinspection draft) or the case's main action in Workspace. Enter the actual physical inspection date and time and the responsible inspector. Review all items, which shows every item, is the entry view. Carried compliance and withdrawn items remain visible and cannot be casually reset. Progress covers active items; withdrawn items are listed separately.

**One item at a time.** Choose One item at a time to bring the next unanswered item into focus; Review all items returns to the complete worksheet at any time. Four steps show progress: record the outcome, complete required details, continue to the next item, then review the inspection and permitted follow-up. The current item shows its original number, wording and original deadline. Choose 1 Corrected, 2 Progress made, 3 No change or 4 No access. Under After an outcome, Go to next unanswered item moves on at once; Complete details first keeps the item open for its date, notes and any new due date. Previous item goes back. Skip for now leaves details unfinished; Return to unfinished details finds them again. Keyboard shortcuts and tips, collapsed below, lists the keys. Nothing is recorded until you choose an outcome.

| Date field | What it records |
| --- | --- |
| Actual inspection date and time | When the physical visit occurred |
| Result date | When that item's observed finding occurred; within the initial-inspection-to-visit interval |
| Next due date | A future repair deadline where the selected extension or citation requires one |

Previously confirmed compliance retains its historical result date. No access is not compliance; record the factual access attempt in notes. Changing the visit date moves only implicit result dates; explicitly entered dates remain and are checked. References to original deadlines remain distinguishable from new deadlines.

Use Undo last result or U to reverse the last worksheet result within its context. Shortcuts are ignored in editable fields and for held keys. Moving to another case clears the current focus and Undo context. There is no bulk automatic completion of item outcomes.

Open Inspection checks for missing or inconsistent facts. A check reveals all rows and focuses the exact affected field. Completing outcomes also exposes all items for final review. Select the required action group and an available document only after reviewing the facts. Nothing is automatically chosen as the legal action.

Save draft & return to Workspace retains incomplete or invalid work only after device saving succeeds. A draft's Review inspection action returns to the worksheet and retains its previous draft. Restore previous draft and inspection recovers that exact paired state, including private wording. A pending issuance must be confirmed through its retained attempt before changing the worksheet.

One physical visit may support a primary follow-up and compatible scoped documents. Issuing another compatible document does not create another inspection. See the next two chapters for eligibility and authority requirements.

## 10 Choose follow ups and document families

In the reinspection chooser, select Give more time, Take enforcement action, Restrict occupancy or Confirm compliance. Then choose a document and Create draft. Choices are labeled primary follow-ups or additional scoped documents. Open All document types (10 families) / why unavailable for the complete list and reasons. The program explains eligibility; it does not recommend a legal action.

| Family | Usual purpose and entry |
| --- | --- |
| Official Notice | Initial numbered correction requirements from the imported initial inspection |
| Extension | Additional time for selected outstanding items after a recorded visit |
| Citation | Selected actual charges from an initial inspection or eligible follow-up |
| Referral for Prosecution | Refer outstanding violations; includes Update for Case Referral after referral |
| Compliance Letter | Confirm verified correction of all active items through the applicable completed visit |
| Summary Abatement | Reviewed immediate nuisance action with its own authority and facts |
| Non-Summary Abatement | Reviewed nuisance order with compliance, service and court facts |
| No Occupancy | A continuing scoped occupancy restriction, or its expressly reviewed release |
| Best Interest Extension | Additional time for every uncorrected item, with recorded reasons and new due dates |
| Vacancy Extension | Time for every uncorrected item while the building or unit remains vacant, with a review inspection |
| Reinspection Notice | An updated item list after a Reinspection or No Fee Reinspection result, with every due date unchanged |

An extension changes selected deadlines, not the historical original deadlines. A citation charges selected outstanding items; all carried items remain accounted for. A referral does not invent a new repair deadline. After City Attorney referral, the only documents offered or allowed are Update for Case Referral and Compliance Letter; extensions, citations and scoped orders are unavailable. A referral update or applicable compliance action preserves the referral history. Corrections of documents issued before the referral remain available.

**Referral and compliance histories.** New City Attorney referrals, Updates for Case Referral and Compliance Letters show each item's recorded inspection observations, including corrected items. A corrected observation displays its date once, with CORRECTED beneath it. Days Outstanding starts at that item's first observation and stops at correction; an outstanding item uses its latest recorded observation. Later inspections do not increase a corrected item's duration. Unrelated visits and carried findings are excluded. Missing or inconsistent dates display Unavailable; investigate the source record rather than assuming zero days. Each inspector note prints under the violation in Corrections Required, as on an Extension, oldest first and with its date, including notes on corrected items. The Inspection History column keeps dates, outcomes, CORRECTED, citations and Days Outstanding, without notes. Long notes continue on the next page; every word prints once. Compliance letters retain Abate Yes/No; missing legacy information is labeled Unavailable rather than invented. Issued histories remain frozen, and previously issued referrals and compliance letters keep their historical format (chapter 22).

On an issued action, Add another document for this inspection offers compatible choices for that verified visit. An unfinished action resumes first. A conflicting primary action or already issued family is unavailable. Retry a retained uncertain request instead of creating another action.

Create a scoped order / administrative letter from current case facts requires an explicit selection. It uses the factual existing inspection and adds no new visit. New observations need an actual new inspection. An initial emergency order can start from the imported initial inspection through Initial inspection action without inventing an earlier notice. An initial Official Notice can later use those same retained inspection facts.

Compliance closes the applicable violation case only after confirmed shared publication. Withdrawal is not compliance. Continuing occupancy restrictions remain separate even when violations are corrected or the building becomes vacant. A physical No Occupancy placard is not generated by this release.

## 11 Complete scoped orders and authority review

Scoped orders and administrative families begin without legal approval. New Best Interest and Vacancy Extensions (authoring 16) use the simplified entry described below; other scoped families and historical extension formats retain their review requirements. Drafting is possible while review is incomplete. Where Authority, wording and signer review is required, supply the actual division reviewer, current-code source, revision or effective date, amendment review, current-code review date, approved authority/wording/procedure reference, signer and delegation. Assigned inspector, authorized signer and issuing operator are separate retained facts.

**Summary Abatement.** Identify the nuisance condition and location, required work, immediate-action basis, applicable approved preset or custom condition and signer. Tree orders need the required assessment reference. Removal/disposal wording applies only when removal is selected. Building securing must state actual openings, materials and animal conditions; boarding requires its prior written approval reference. No universal sidewalk clearance is assumed.

**Non-Summary Abatement.** Record findings and required work, the approved order compliance date, service/publication plan, reviewed Circuit Court remedy and signer. Service dates, compliance dates and court facts are distinct. Issuing a document does not prove completed service or trigger actual abatement. After actual service, record Service and court evidence with method, date and evidence reference. Later or corrected evidence retains earlier events.

**No Occupancy.** Specify the actual building or unit scope, findings, truthful posting status, effective date, release conditions and signer. A restriction does not end automatically through compliance, vacancy, ownership change or an unrelated expiry date. Written release is a mode within this family: select the exact active restriction and document verified corrections, the real release inspection, actual placard removal and the approved release form. Reference an existing recorded physical visit, or record a genuinely completed external release inspection with its inspector, date and external reference. The program does not fabricate violation results for it.

**Best Interest Extension.** New authoring-16 documents extend every uncorrected item and use Reasons for Additional Time without a signer block. There are no affected-item checkboxes and no safety confirmation. Due dates work as on a normal Extension: on the reinspection worksheet, enter each outstanding item's Next due date; the document takes those dates, and you can change them in Violation items. Use a future date for each uncorrected item, at most three distinct dates, at least seven days apart. Corrected items keep their dates. The letter reads “Additional time is granted for the uncorrected items for the following reasons: …”. Older unissued drafts keep their earlier format unless Use simplified Reasons-only format is chosen, which moves them to this format and retains their earlier review data. Authoring-15 drafts keep their format with its safety checkbox. Issued historical formats and their corrections remain unchanged. This extension is not a City Attorney referral.

**Vacancy Extension.** New authoring-16 documents extend every uncorrected item while the building or apartment / unit remains vacant. Enter only Scope (and the apartment / unit identifier) and the Next scheduled review inspection, which must be at least seven days after the mailing date; contact-by is calculated seven calendar days before it. Uncorrected items print no due date; corrected items keep their dates. The letter reads “While the apartment / unit remains vacant and the conditions below are met, we grant an extension for the uncorrected item(s).” (or “the building”). The affected-item checkboxes, safety confirmation and basis, extension request reference, verified vacancy basis, approved continuing conditions, expiration / review model, sale / transfer wording, short-notice procedure and the Authority, wording and signer review are removed, as is the signer block. Renewal requires a new action. Apartment scope preserves common-area duties. Earlier Vacancy Extensions reprint unchanged.

**Reinspection Notice.** Import an eligible unused inspection of type Reinspection whose result is Reinspection or No Fee Reinspection. The worksheet records the item results as usual, and the document created from the Accela status is the Reinspection Notice, headed "REINSPECTION - Building Inspection Official Notice". Its wording is the same for both results. Items you marked Corrected print ruled through with the date you confirmed them, and the rest are listed as outstanding. The Reinspection Notice never changes a due date: every item prints the due date it already had, the dates cannot be edited on it, and a date that has already passed prints as assigned. It needs at least one outstanding item (a Compliance Letter closes a case with none) and cannot be written on a case that is with the City Attorney. The case status becomes Reinspection while the case stays open, in Workspace and in Reports.

**Extension layout.** Best Interest and Vacancy Extensions use the regular Extension's header, recipient block, items table, continuation headers, footer and copy handling. All items are listed, including corrected items ruled through with the confirmed date. New Best Interest and Vacancy Extensions have no signer block, so they show no signer fill-in bubbles; footers are unchanged. The regular Extension is unchanged. Earlier drafts and issued documents keep their own format; chapter 22 describes the earlier Best Interest and Vacancy formats.

A referred case allows only an Update for Case Referral or a Compliance Letter; the former reviewed emergency / occupancy exception is removed. Draft wording, supplied templates and synthetic test approvals are not proof of current law. Use the division's actual review; current-code and procedure approval remain documented acceptance items.

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

In the editor, mailing addresses flow below the header to prevent overlap when interactive fields expand. Issued PDFs retain their existing approved left-window positioning. Native envelope and printer acceptance remains required.

**Email.** Select and verify the recipients in the issuance review. Outlook handoff opens a draft; inspect its subject, addresses, body and attachments and send under the division's procedure. Opening Outlook or successfully preparing the draft does not prove sending, receipt or service.

**Outside records.** Complete actual mailing, court filing, approved abatement steps and Accela recording separately. Document Writer is not an Accela write integration or an automatic dispatch service. Use retained record notes for relevant factual references; do not describe a filing attempt as completed delivery.

## 13 Correct documents and preserve history

Choose the action that reflects what actually happened. Edit an unissued draft directly. Use Correct document for a recording error in an issued action. Use a new physical inspection for later observations. Use a record note when an earlier action has dependent work or when an explanation should be retained without altering the frozen source.

1. Open the issued document from case history and choose Correct document.
2. State the recording error and reason. For a citation or referral, record the actual receiving court or City Attorney amendment instructions/reference where required. The program does not issue those instructions for you.
3. Make the permitted correction. Review the before/after comparison, affected case facts and linked worksheet facts. Keep the original document, item, root, visit and citation identities.
4. Review and issue the linked revision. Until its shared save is confirmed, the earlier issued version remains effective in the program.
5. Confirm the correction's original PDF and complete outside amendment, mailing and recording steps under the actual procedure.

**Withdraw an item.** Within correction, select withdrawal for an item entered in error and record a specific reason. Its original number remains. It is excluded from compliance credit. Do not delete it or label it corrected to remove it from the count.

**When Correct and Withdraw are missing.** Open Document actions on the issued document. If Correct document and Withdraw are not offered, the same place states why (for example, an unfinished worksheet or document draft must be finished or discarded first, or a later document depends on this one). Resolve what it names and the buttons return.

**Correct a visit.** Correct the recorded visit or follow-up type amends that same visit under the existing transition rules. It does not add another visit. If later dependent work makes an earlier direct correction unavailable, retain a record note and correct the current action as permitted.

**Citation prices and dates.** An unchanged charge retains its original amount, basis and historical court costs. A changed charge needs its own current authorized pricing review. Citation numbers do not change as a substitute for the court's amendment process. The corrected mailing date is separate from the original action's issue date. Reports count the effective citation once while preserving the original and correction history. Correction review displays dollars and cents consistently, including assessment components stored as integer cents; it does not recalculate the recorded correction values.

**Restrictions and release.** A wording correction cannot change No Occupancy scope into a permission to occupy, or silently alter substantive release/expiration conditions. Those changes need a newly reviewed action. Withdrawal of a scoped order needs its reason and division instructions/reference. An ordinary compliance letter is not an occupancy release.

Starting or abandoning a correction does not withdraw the original. Current case-detail corrections may inform future documents and reports; the earlier frozen body and PDF remain evidence of what was issued.

## 14 Understand saved work and connection

Open Saved work & connection from Tools & settings, below Workspace, or from the case's recovery link. Its three sections describe separate facts. Read the section that matches the problem before retrying.

| Section | What a successful state means |
| --- | --- |
| This device | The browser has retained unfinished work in this profile; it is not an issued shared document |
| Shared cases | A request was confirmed against the shared case; Shared copy current describes that last confirmation |
| PDF filing | The exact original PDF's filing or pending work; actual mailing and outside recording remain separate |

**Device save failure.** Keep the tab open. Download a workspace backup directly from the error or recovery area. Retry device saving after addressing the browser storage or profile problem. Do not navigate away, clear site data or assume an unsaved field reached the helper.

**Uncertain shared save.** Use Confirm save for the retained attempt. A missing response does not prove no write occurred. The helper's retry protocol checks the original request identity. Creating a new citation or event risks duplication and is the wrong recovery step.

**Shared changes.** Use Check shared record when you need a fresh comparison. Another PC may have changed the case since the last confirmed save. Review the differences; do not overwrite a newer shared history with an older local copy. Conflicting, unreadable or outside-edited records require the named resolution path.

**PDF exceptions.** Open the issued document and verify or complete its original filing. Review PDF outbox lists retained local PDFs waiting for transfer. Select only the intended files. Printing from the outbox uses retained bytes; successful transfer does not establish mailing. If a same-name target has different bytes, preserve both evidence sources and ask the administrator to resolve the conflict.

Repeated unresolved messages appear once. Dismissing an alert does not clear its underlying case state. Message history in Tools retains dismissed messages. Case-specific integrity evidence is read-only for inspectors.

Expand Backups and recovery. Recovery on this device holds Recover an unfinished case and Create recovery copy on this device; Download or restore a workspace holds Download workspace backup and Restore workspace backup (into an empty workspace). Expand Connection checks and technical details for helper/share/SQL information, Storage diagnostics, Inspect a case lock and catalog checks. These are diagnostic actions, not permission to force an uncertain save or remove a remote lock.

## 15 Back up restore and recover safely

Workspace backup, a case-record export, an unfinished-case recovery copy and a program rollback solve different problems. Select the one that matches the loss. Keep backups in the division's approved location and follow its retention policy.

| Operation | What it preserves or restores |
| --- | --- |
| Download workspace backup | Device drafts, worksheets, unfinished forms, retained case facts, save checkpoints and pending requests together |
| Download case record | Case metadata and issued history; not the complete private workspace |
| Create recovery copy on this device | A fresh helper recovery copy of unfinished work |
| Recover an unfinished case | One case after a shared-change comparison and deliberate replacement safeguards |
| Restore workspace backup | A complete workspace into an empty workspace |
| Program update rollback | Installed program files; not an automatic reversal of issued records or device data |

**Recover one case.** Open Saved work & connection → Backups and recovery → Recovery on this device → Recover an unfinished case. Select the intended recovery copy and check the case and capture time. Compare the current shared record. Preserve any differing local work before explicitly replacing it. Resume the recovered draft and confirm device saving; resolve retained pending requests through their original confirmation actions.

**Restore a workspace.** Preserve the current profile first. Use an empty workspace and the same approved program release or a verified compatible version. Choose Restore workspace backup, select the intended file and review its identity. Do not use restore to merge two independently edited active workspaces. Recheck shared state and PDF filing after recovery before issuing.

**Change PCs or browser profiles.** A private draft does not automatically follow the Windows account. Export it through the workspace/recovery procedure and confirm it opens in the intended profile. A different local URL or profile may have different browser storage. Keep the source profile until the restored work is verified.

**After an update interruption.** IT checks the installer's retained release state and logs before retry or rollback. Keep operational data, integrity registry, anchors, PDF receipts and device backup intact. Restoring a stale whole-share backup can discard later confirmed work from other clients and must be coordinated as an incident recovery.

**Test recovery.** Use isolated synthetic cases for restore drills. Verify private wording, partial citation values, worksheet outcomes, pending original identities and exact original PDF retrieval. A successful program launch alone does not prove that the data and recovery paths work.

## 16 Run reports and interpret their dates

Open Reports from Writer. The common choices are visible in its rail; More reports lists the remaining reports. Every report describes its population and date basis. Filters act on retained verified summaries; drafts do not become issued report actions.

| Report | Principal date and counting basis |
| --- | --- |
| Open cases by area | Open on the selected as-of date after an issued notice or snow citation |
| Cases by inspector | Cases opened in the period, by case inspector and area |
| Open violations by area | Items still open on the as-of date after notice issuance |
| All cases | Cases opened by initial inspection date in the period, with current status |
| All violations | Non-withdrawn items on cases opened in the period |
| Days to compliance | Initial inspection to item correction; excludes snow cases |
| Repeat cases by owner | Two or more opened cases, grouped by usable owner mailing address |
| Citations by ordinance | Effective non-void citations issued in the period |
| Overridden deposits | Authorized exceptional determined deposits issued in the period |
| Referrals for prosecution | Referrals issued in the period, with owner facts as referred |
| Document actions | Effective issued actions in the period; includes scoped actions before a notice |

Use From/To for period reports and As of for historical open-state reports. Date shortcuts set the corresponding range. Open More filters for additional scope such as status, owner, violation type or ordinance. Applied-filter chips reveal active scope even when its control is collapsed. Reset filters returns to the current year, current district boundaries and unfiltered optional fields, and clears sorting.

Click a sortable column heading to set its order. The active screen, CSV, matching workbook report sheet and print use the same stable row order. Other named workbook sheets retain their own definitions; do not assume every sheet uses a citation issue date merely because the active report does.

Saved local views retain their report, dates, filters, map choice and sort. Relative local date choices recalculate on use. Shared views retain their established filter/date/map format without shared sort. Manual report switching clears the saved-view selection and old return notice while retaining the working filters and sort context.

Owner grouping by mailing address can combine owners represented by the same manager; names are shown for interpretation. Citation tiers count effective issued history, not an external conviction feed. Document action counts can exceed visit counts because compatible actions can share one physical visit.

## 17 Verify report coverage maps and exports

**Check coverage first.** Open Data and definitions. Review the read time, included case files and excluded summaries. Missing summaries, exact source-revision mismatches, earlier-format summaries, summaries not matching their verified case and unreadable or duplicate entries are explained separately. Categories can overlap; an unreadable-entry count is not a unique-case count. Do not add them together as a case total.

Each included current summary must match the independently read case bytes and integrity proof, and its reported facts must equal what the verified case itself shows. A summary that names the current case revision but reports different facts (for example an owner, status, date, document, violation or citation) is excluded as not matching its case. A rebuild regenerates summaries from the verified cases; it does not repair altered case history or grant legal approval. An administrator should first resolve the underlying record issue, then use Tools & settings → Saved work & connection → Connection checks and technical details → Storage diagnostics → Rebuild reporting index. Refresh Reports and recheck the exclusions before relying on totals.

**Maps.** Switch between table and map when the report supports a map. Select area/boundary and basemap choices deliberately. GIS enrichment depends on access to City services; records without a usable location remain disclosed. Use the map's table alternative for the same report population and review unlocated records. A missing point is not evidence that a case was excluded from the report count.

**Drill into data.** Open a count or case link to inspect its underlying cases. Open case in Writer continues its existing work in Writer. Back to Reports in the Writer rail returns to the open Reports tab, or opens Reports in this tab when none answers, and restores the report, filters, view, date mode and sort retained when the case was opened; relative date choices recalculate for today. Check dates and filters after a return or data refresh, especially when a source record has changed.

**Export.** Expand the export controls. Current report — CSV contains exactly the rows and columns of this table, with its filters, dates and sort. Reports workbook — Excel contains an About sheet, record sheets (Cases, Violations, Visits, Citations, Referrals, Corrections) and a sheet for every named report, with numeric/date values where appropriate. Sheets do not all apply the filters the same way; the About sheet's Sheet scope lists each one. Cases, Violations and Visits contain cases opened in the period; Visits lists every visit on those cases, so a visit date can fall outside the period. Citations and Referrals use the date issued on any counted case, and the inspector filter means the issuing or referring inspector; Citations does not apply the violation type filter. Corrections uses the date each correction was recorded, so it can list cases opened before the period. Violations applies violation type and ordinance to each item; other sheets apply them to the case (any matching item), except Citations, which applies the ordinance to the citation. Area, owner and status always apply to the case, and status is its current status. Numbered report sheets match each report on screen: reports 1 and 3 use the As of date, reports 2 and 4–7 the case opening date, and reports 8–11 the date issued. This report's sheet keeps the table sort and other report sheets use their default order. Print uses the active report presentation. Check the title, date range, applied filters, row order and coverage statement before distributing an export. An invalid date range clears stale report results so an earlier table is not exported as the new request.

**Deposit schedule.** The deposit explorer presents searchable human-readable rules, conditions, effective dates and source details. Pagination limits screen volume; it does not omit the retained schedule. A displayed row may be conditional or require an authorized manual amount. The explorer is not a new court policy. If a sort fails, the report displays its default order and a notice; review the active order again before distributing an export. A malformed helper response reports its HTTP status and asks you to refresh or contact IT rather than showing an unreadable response as current report data.

**Refresh speed.** The helper overlaps a maximum of four read-only file operations per request while retaining independent revision and integrity checks. Allow a shared read to finish before treating its coverage as current. Actual City cold/warm performance, history volume, simultaneous users and budget approval still require measurement.

## 18 Use planning tools and display controls

Tools & settings groups actions by purpose. Cases & planning contains Search shared case records, Reminders and Batch draft due dates. Saved work & connection and Open saved case handle persistence; Exit Document Writer, in the same group, stops the program on this computer (see chapter 1). Program instructions opens this manual and its printable PDF. Display & help contains theme, message history and keyboard shortcuts. Administrator tools, collapsed at the end, contains Review catalog, Administrator deposit override and Review snow-letter content; each keeps its own administrator checks, and the grouping grants no authorization.

**Search shared case records.** Use the shared search, also in Workspace’s Start or find case work area, when a case is not loaded in Workspace. Review identity and open it through the existing shared-history checks. A search result does not override a conflict, active draft or unreadable record.

**Open cases by inspector.** In the same Search shared case records window, choose an inspector under Open cases by inspector and select Show open cases. The list shows that inspector's cases that are not closed or withdrawn, soonest deadline first, using the same rule as the Open cases report. A case belongs to the inspector assigned on the case; Unassigned or former inspector lists cases with no assigned inspector or one who is not on the division's list. If some case files were left out because their summary is missing, out of date or unreadable, the list says how many and may be incomplete. Select Continue case beside a case: Writer asks you to import a new inspection result to continue it. Import inspection opens with that case number ready; select Find Case Inspections to look it up. If an inspection for that case is already imported and waiting, you can continue with it instead. If an import for a different case is waiting, finish or cancel it first. Open case without importing opens the case as before. Nothing is imported, issued or changed until you complete the import steps yourself.

**Reminders.** Configure the intended reminder period and enabled state. Workspace exposes applicable reminder actions. Draft a reminder, inspect the recipient and wording, and complete the Outlook sending step separately. Reminders do not change a due date, prove service or create a new inspection. Snow items have no ordinary deadline reminder.

**Batch draft due dates.** Select eligible unissued notice drafts and the required deadline, then apply it deliberately. Review each resulting draft. This updates private draft deadlines; it does not amend an issued notice. Ordinary outstanding-item date limits and snow exclusions remain enforced. Use the correction workflow for issued deadlines.

**Open saved case.** Select a case-record export when appropriate. It is different from a workspace backup and does not contain every private form or worksheet. Opening it still respects current shared state and identity safeguards.

**Display.** Choose Light, Dark, High contrast or System. System follows the browser or operating system setting. Reduced-motion preferences remove nonessential transitions. Theme changes affect the screen; issued document print bodies retain their established appearance.

**Messages.** Warning and error messages clear after 15 seconds; read them before they clear, or open Message history, which keeps cleared and dismissed messages for review. A dismissed notification does not mean a pending save or PDF job has completed. Keyboard help is available here and through ? outside an editable field.

**Administrative deposit exceptions.** Only an operator acting under actual division authority should use Administrator deposit override. Open it from Tools & settings → Administrator tools. Supply the actual named administrator, reason, source and required confirmation. The helper records authorization and Reports exposes overridden deposits. This does not change the master schedule, establish court authority or approve unrelated citations.

Keep technical diagnostics with the administrator. Avoid putting passwords, operational personal data or whole case folders in casual support messages. Provide the specific safe error code, time and approved log excerpt needed to investigate.

## 19 Administer configuration integrity and maintenance

Use the division's IT and policy owners for changes. Deploy configuration as a coordinated release or through the program's explicit shared administration workflows. Do not edit live JSON histories or generated HTML to work around a check.

**Shared folders.** Program files are read-only for inspectors. Case JSON Files, Documents To Be Mailed And Recorded and Reporting GIS need the intended helper read/write access. Restrict Case JSON Files\_administration to authorized administrators while allowing the reads required by inspectors. Keep integrity settings and the independent anchor under IT control.

**Protected anchor.** The anchor is outside the case folder and reachable by every inspector PC. IT supplies integrity-settings.json locally on each PC and protects the configuration through its approved administration procedure; the launcher never copies that file from the share, including when no local file exists. IT configures append/create-only anchor access without modify/delete and verifies the actual NTFS/share behavior. The case-folder registry alone provides only partial tamper protection. Keep anchor backups and permissions with the records recovery plan.

**Record holds.** A damaged migration registry or outside-edited case is an incident, not a reason to run an index rebuild repeatedly. Preserve the file, registry, retained PDFs and independent evidence. Inspectors use read-only review. Administrators use the documented offline integrity tooling only after establishing the trusted source and approved recovery plan.

**Locks.** Inspect a case lock shows diagnostic information. Age alone never establishes abandonment, particularly on a remote PC. Do not delete lock files manually. Coordinate the owning client, confirm its state and use the token-bound recovery procedure only when the required evidence permits it.

**Approved connections.** The release contains trusted-connections.json. GIS URLs must use HTTPS on an approved host; the defaults are maps.cityofmadison.com and opendata.arcgis.com. Credentials, HTTP/file URLs, unapproved ports and responses above 20 MB are refused, and redirects must stay on the approved host. The SQL server in Case Lookup/settings.json must exactly match an allowlist entry (shipped: sqlelam). Allowlist changes are made by the release owner in a new release, not through share settings.

**SQL.** The shipped query uses typed case-number parameters and read-only Windows integrated authentication. Shared Case Lookup/settings.json accepts server, database and enabled. Choose a trusted certificate chain and matching server name. The SQL server must also appear in the release allowlist (trusted-connections.json), whose initial approved entry is sqlelam. A per-user certificate-validation workaround cannot authorize an off-list server. The existing per-profile certificate-validation bypass is an exceptional IT decision documented in CASE-LOOKUP-GUIDE.md; do not copy it into shared settings or make it the normal deployment default.

**Policy and catalog.** Record actual authority for language approval, new scoped documents, pricing exceptions and seasonal content. Mandatory defendant instructions need a separately approved source and release integration. Existing supplied pricing-date and snow-default questions remain policy decisions, not automatically approved by this release.

**Retention.** Retain case events, migration evidence, anchor receipts and exact original PDF operation receipts according to approved records policy. The program does not compact or delete them. Future compaction requires records approval and proof of archived-byte retrieval and interruption recovery before implementation.

**Release ownership.** Only the release owner writes to the deployment folder’s program files; inspectors have read-only access there. The release owner builds each release with the complete gate (tools/verify_release.py, then tools/package_release.py), publishes the deploy ZIP’s SHA-256 through a separate trusted channel, and keeps the previous complete release for deliberate rollback. IT records the folder permissions in the acceptance record.

## 20 Use keyboard touch and accessible views

Use Tab and Shift+Tab to move through controls. Enter or Space activates the focused button or disclosure where appropriate. Visible focus identifies the active control. Click a validation link to open its section and move to the specific field; after correcting it, verify that the error state clears.

| Shortcut | Scope and result |
| --- | --- |
| ? | Outside an editable field, opens keyboard help |
| Ctrl+S or Cmd+S | In Writer, requests device saving; verify its resulting status |
| Escape | Closes supported dialogs when no protected save is pending |
| 1, 2, 3, 4 | In One item at a time, outside fields, selects Corrected, Progress made, No change or No access |
| U | Undoes the last result within the current worksheet context |

Held keys do not repeatedly result items. Typing a digit or U into an editable field remains ordinary text entry. Use the visible outcome controls for the same actions on touch devices.

**Read the whole task.** Review all items provides an alternative to One item at a time. Reports provides tables alongside supported maps. Expand Full wording and guidance for complete language rather than depending on a truncated preview. Program instructions provides an accessible HTML manual as well as the printable copy.

**Small screens and zoom.** The four Writer destinations remain available; open Import inspection from Workspace. On a narrow screen (760 CSS pixels or less) the document editor uses a compact header and one task bar at the bottom with the save state, Next required field, Review and the primary action; Review opens the Review dialog; the bar hides while you type in a field or a dialog is open and is never printed. Use vertical scrolling and the applicable table's own scroll area when a wide data table needs it. At high zoom, inspect the actual field labels and current action rather than relying on desktop positions. The HTML manual reflows at 320 CSS pixels and supports browser zoom and find.

**Display preferences.** Select High contrast when useful, or use System with the operating system preference. Reduced motion follows the browser setting. Printed issued documents have their own fixed layout; a screen theme does not change the historical body.

Automated accessibility scans, theme checks, focus tests and narrow-width checks are included in the release evidence. They do not certify full WCAG 2.2 AA conformance. The City still needs manual screen-reader, keyboard, touch, zoom and real task testing with staff and its chosen assistive technology. Record the browser, screen reader, task, expected result and actual result in the acceptance record. Report a blocked control with its visible label and current case state, using synthetic records where possible.

## 21 Troubleshoot common problems

Preserve work first. Keep the active tab open when device saving is uncertain, download a workspace backup when offered, and record the exact message and time. The following actions do not require editing operational case files.

| Symptom | Next action |
| --- | --- |
| Shared program files failed verification | Keep the installed verified version; give IT the message and time. Do not remove the pin or copy selected program files |
| Open from the installed desktop shortcut | Use the trusted installed shortcut in the original browser profile; preserve site data and unfinished work |
| Helper session changed or request refused | Reload to reconnect, then inspect the retained save state before retrying the original action |
| GIS URL or SQL server refused | IT checks the named setting against the connection allowlist in trusted-connections.json; do not weaken the check |
| PDF contains an external resource or active element | Preserve the issued original and report the error; use embedded approved document resources rather than external or local file references |
| The case could not be exported | Keep the case open and preserve the workspace backup if available; no empty case file should be written |
| Report could not be sorted | Default order is shown with a notice; review order before export and report the error if it repeats |
| No eligible inspection results | Open Source and import details and read the result status. Eligibility depends on both Inspection Type and Inspection Status. Scheduled, Pending, Completed, Inspection and No Violation results, Reinspection and No Fee Reinspection results on any inspection type other than a Reinspection, Initial Inspection results with No Entry, Assist inspections, undated rows and inspections already used on the case are not listed. Other combinations are listed as not available with their reason; use the type/status rules in section 4. If valid results are absent, use the complete current installation and retrieve the case again. An already used result requires Continue existing case |
| An older version of Document Writer is still running | Save your work and stop it: Exit Document Writer in Tools & settings when it offers one; otherwise close its command window or sign out of Windows and back in. Then double-click the Document Writer icon and confirm both versions match the install guide |
| Exit Document Writer says work is still in progress | Wait for the issuance, filing, email or save named in the message to finish, then choose Exit again; never close windows to force it |
| Document Writer has stopped | The program was stopped with Exit Document Writer. Close the window; double-click Document Writer on the desktop to start again |
| A case is missing from Workspace | Choose Clear search and inspector, inspect All cases and More views, then use Search shared case records for the share |
| Lookup finds only Scheduled or Assist records | Confirm the source inspection was actually completed; use the division's report procedure, not a fabricated date |
| SQL or certificate error | Give IT the safe error code and time; check approved network, account, database and certificate configuration |
| Import says the inspection is already used | Continue its retained case/document or use correction; do not change the time to bypass matching |
| No language results | Clear search; check the status scope. Approved language shows only entries with a recorded formal review, so switch to Approved and standard if you chose the narrower scope |
| An unfilled bubble blocks issue | Open the linked item, enter the actual missing detail and review the completed sentence |
| Too many deadlines | Review outstanding items and reduce to the permitted distinct dates; do not relabel compliance or withdrawal |
| Deposit needs review or history changed | Complete the affected charge and authorized source; refresh shared history and review the tier again |
| Mandatory wording hold | Preserve the draft; the division must supply approved defendant instructions for integration |
| Save confirmation needed | Confirm the original attempt; do not create another action |
| This record was changed outside the program | Stop editing; preserve evidence and refer to the administrator for trusted-source review |
| Migration registry damaged | Preserve the case folder and integrity evidence; IT reviews offline recovery |
| PDF filing needed or filename conflict | Open the issued action or PDF outbox; retain exact bytes and ask IT to resolve conflicting targets |
| Report totals differ from expectation | Check dates, active chips, definitions, read time and excluded summaries before requesting a rebuild |
| Outlook did not send | Inspect the draft and attachments and complete the actual send step; filing is not delivery |

For helper support, the current local structured log is %LOCALAPPDATA%\MadisonDocWriter\logs\helper.jsonl. A failed SQL lookup may also create case-lookup-diagnostic.txt in that program folder. Review logs before providing them to authorized IT; they may contain local paths, server or account details. The next SQL failure can replace its diagnostic file.

If a control still fails after the safe next action, preserve the backup and error evidence. Ask the administrator to reproduce it with a copied or synthetic case. Do not retry by deleting registry, lock, receipt or history files.

## 22 Practice tasks and reference terms

Use an isolated acceptance deployment and unmistakably synthetic records. Each exercise should finish with both the expected document state and the correct explanation of what still needs action. The detailed acceptance record supplies participant fields and signoff criteria.

**Import and notice.** Find a synthetic ordinary case, verify one completed inspection, add two selectable items, fill the bubbles and assign a deadline. Save and reopen. Review and issue after approval, then explain device save, shared confirmation, PDF filing and actual delivery separately.

**Snow.** Import a known test Snow Removal case. Enter actual synthetic accumulation/inspection facts, photographs and condition. Review property history, season content, price and four copies. Check that no ordinary deadline or invented reinspection appears. Complete seasonal/policy review before any operational use.

**Reinspection.** Open a retained notice, use each outcome on a test item in One item at a time, undo one, switch to Review all items and resume unfinished details. Enter distinct physical/result/deadline dates correctly. Choose an eligible document; return to the worksheet and restore its paired previous draft. Confirm only one visit when adding a compatible scoped action.

**Correction and recovery.** Correct a synthetic issued typo, review before/after and verify the original remains. Interrupt a test save response and confirm the retained attempt. Recover one unfinished case, restore a workspace into an empty profile, and verify the exact issued PDF bytes. Test deployment rollback separately.

**Reports and accessibility.** Find a report, apply and reset filters, sort it, export Current report — CSV and Reports workbook — Excel and compare the matching rows. Open case in Writer and return with Back to Reports. Explain exclusions and unlocated map points. Repeat core navigation using keyboard, touch and the approved screen reader; record problems, help requests and actual timings.

| Term | Meaning in this program |
| --- | --- |
| Draft | Unissued private working state; validation may still be incomplete |
| Issued | Action confirmed in the shared case record |
| Frozen source | Retained wording, policy and facts for that issued version |
| Revision | Exact case-file content used to validate a reporting summary |
| Original PDF | Retained prepared bytes and receipt for an issued action |
| Visit | One genuinely completed physical inspection, possibly supporting compatible actions |
| Correction | Linked amendment preserving the original and stable identities |
| Anchor | Independently protected receipt supporting history integrity verification |
| Workspace | The current browser profile's loaded cases and unfinished work |

### Earlier document formats

Each issued document keeps the authoring version it was issued with. Its reprints and corrections use that format, and an unissued draft keeps its format unless an explicit adoption, such as Use simplified Reasons-only format, moves it to the current one. New documents use the current format described in chapters 5 to 13; new scoped orders (abatements, No Occupancy) keep authoring 13 because their layout is unchanged.

| Authoring version | Best Interest and Vacancy Extensions | Referrals and Compliance Letters |
| --- | --- | --- |
| 11 and earlier | Historical narrative layout, also for their corrections | Historical layout; compliance letters list dates only |
| 12 | Regular Extension layout; affected items listed in the details; a Vacancy Extension may be conditional (“Conditional — see conditions above”) and keeps its stored repair dates | Historical layout |
| 13 | Every affected item has a later due date in the items table; Vacancy Extensions are always dated. New Vacancy Extensions kept this format until authoring 16 | Historical layout |
| 14 | New Best Interest and Vacancy Extensions kept authoring 13 | Referrals show item-specific inspection history and Days Outstanding; compliance letters list dates only |
| 15 | Best Interest: Reasons with the explicit safety-exclusion confirmation and no signer | Item history with notes in the history column; compliance letters add item history and Abate Yes/No |
| 16 (current) | Every uncorrected item, no selection or safety confirmation and no signer; Best Interest takes the worksheet's Next due dates; Vacancy prints no due date and needs a review inspection | Notes print under the violation, corrected items included |

In the aligned table layout, authoring-12–15 Vacancy Extensions and authoring-12–14 Best Interest Extensions print their supervisory signer after the table; authoring-11 and earlier use their historical narrative layout. Ordinary Extensions keep their own stored authoring version; the special-extension column above describes only Best Interest and Vacancy Extensions. The authoring-11 initial citation packet may have six pages. Retain the original PDF for any document issued under a format an earlier release cannot render.

The release package records technical verification and remaining City acceptance. Use the City acceptance record (Rnn-ACCEPTANCE-RECORD.md) to record the remaining City tests and approvals. Historical release reviews explain development provenance and do not override this manual.
