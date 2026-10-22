# R56 Writer simplification and dated extensions

Development baseline: main `422a73e` (R55 as packaged).
Identity: 2026-10-21 R56, helper 2026.10.21.57, helperBuild 57.
Authoring 13 (new); case schema 5, summary 6 and workspace backup 2 are unchanged.

## Changes (division requests)

1. The document's "Preview mailing address" button is removed. Copy and registered-agent
   recipients keep their standardized-address preview; the owner's respondent key uses the
   imported address.
2. The notice editor's "Property record details" parcel field and the "Other initial
   inspection actions" panel are removed. A notice still requires a 12-digit parcel (division
   rule 09/18/2026); the check now directs staff to correct it in Accela and import again.
   Initial emergency documents come only from the imported Accela status. The correction
   panel's audited property-record section is unchanged.
3. One "Recipients" button replaces "Inspection & recipients" and "Copies & email…" and opens
   the recipient dialog directly; inspection details remain under an "Inspection" heading.
4. Cite is offered only when the imported Accela inspection status is Citation, on the notice
   editor and the reinspection worksheet; the status-match check remains.
   When a re-import changes the status to one that does not permit citations (for example
   Citation corrected to Official Notice), existing citation marks and their draft citation and
   deposit data are cleared, also for drafts restored from this machine; an existing mark can
   always be removed (review of PR #21). While only such an old mark remains, every item row
   keeps the Cite column, empty where no box is offered, so Due Date stays under its heading
   (follow-up review of PR #21).
5. The "Add violation item" button below the document is removed; "+ Select violations" in
   Items and due dates remains.
6. Authoring 13: new Best Interest and Vacancy Extensions require a later due date for each
   affected item, entered in Items and due dates; Vacancy Extensions are always dated and the
   deadline-model choice is removed; unaffected items keep their dates. The helper refuses an
   authoring-13 conditional Vacancy Extension. Authoring-12 and earlier documents, including
   conditional Vacancy Extensions and their corrections, render and validate unchanged.

## Retained decisions

R54's shared extension layout, supervisory signer, item listing and CC handling remain. The
R54 conditional label remains for authoring-12 reprints only. Approved wording, frozen
fixtures, print goldens, all four court copies, integrity checks and the mandatory-appearance
hold are unchanged.

## Verification and acceptance

Run the complete pinned-browser gate for the final tree; outcomes are recorded in the pull
request and build/verification/latest/. New acceptance item S56 (staff review of the editor
changes) and the extended P7 are open with City Windows, permissions/SMB/SQL, Outlook, native
printing, staff/accessibility, performance and L1–L5. This review does not authorize
packaging, publication, deployment or acceptance signoff.

## Usability follow-up (development; release identity unchanged)

Branch `develop/r56-usability`, commits `68f53d9`, `68c9815` and `13bfdad`. Identity stays
2026-10-21 R56 (helper 2026.10.21.57, helperBuild 57, authoring 13); case schema 5, summary 6,
backup 2, approved language, print stylesheet, frozen fixtures and court copies are unchanged.
Behaviour is covered by tests/unit/audit_usability_phase1.js, phase2.js and phase3.js and the
extended browser suites.

1. Phase 1 (everyday actions). The editor's Inspection section appears only when it has
   something to act on (special-document details, snow facts, a correction or Review
   inspection). Save actions are named by destination: Save draft & return to Workspace, Save
   case to shared folder, File issued PDF, Create recovery copy on this device and Download
   workspace backup. Workspace quick views (Needs attention, Continue work, Deadlines, Needs
   resolution, All cases) are the primary filter, with More views for Due within 7 days, Past
   due, Open and Closed, and a note explaining Needs resolution. The Recipients dialog ends with
   Done only. Backups and recovery is grouped into Recovery on this device and Download or
   restore a workspace. Reports exports read Current report — CSV and Reports workbook — Excel
   with an accurate scope note. Import inspection, Remove from this workspace and Remove cases
   from this workspace replace the earlier labels; removal never deletes the shared record.
2. Phase 2 (readiness and deadlines). One readiness summary at the top of the editor offers Go
   to first required field (or first advisory) and Open full checklist; Review holds the single
   Full checklist (Show/Hide checks remains). The issuance dialog drops the passed-checks list
   and still validates the current document when Issue is pressed. Official Notice drafts select
   items for a shared due date with a checkbox beside each due date; Assign due dates, still
   below the document, is a compact bar with Apply date to selected items and the existing
   three-date and spacing validation. The reinspection worksheet keeps its item list. Editable
   authoring-13 Best Interest and Vacancy drafts select Affected beside each item's due date;
   authoring 12 and earlier keep the Affected outstanding items fieldset unchanged.
3. Phase 3 (search, navigation, reinspection, narrow screens). Three named searches: Search
   this workspace, Search shared case records (a workspace search with no results offers it
   with the query kept, not submitted) and Find Accela inspection. Reports uses Open case in
   Writer; Writer's rail shows Back to Reports with a return context, otherwise Open Reports ↗;
   return-context restoration is the testable restoreReportReturn(). Reinspection offers Review
   all items and One item at a time with a four-step indicator, collapsed Keyboard shortcuts
   and tips, and After an outcome choices Go to next unanswered item and Complete details
   first; the shortcut sheet uses the outcome names. At 760px and below the editor has a
   compact header and one bottom task bar (save state, Next required field, Review, primary
   action) that hides while a field has focus or a dialog is open and never prints. Language
   modes read Browse language, Select for this notice (picker) and Review catalog. Tools moves
   Review catalog, Administrator deposit override and Review snow-letter content into a
   collapsed Administrator tools group, which grants no authorization.

**Reviewed CSS exception.** The new screen CSS is one block appended to
app/assets/ui-refresh.css, beginning `/* R56 usability phase 3 (screen only):`.
audit_r51_layout.py pins its exact size and SHA-256, requires it once in each built shell and
removes it before the unchanged historical shell comparison (05-TESTING.md). No reference hash
was regenerated.

**Deferred.** Writer tab reuse stays with the existing BroadcastChannel handoff; a named-tab
fallback could replace unsaved work in another tab. The Reports rail link "← Document Writer"
is unchanged.

**Additional fixes.** Best Interest/Vacancy readiness checks for affected items pointed at no
element (`[data-special="affected"]`); they now link to the real affected-item checkbox or the
affected item's due-date field. Removing a case, singly or in a batch, no longer shows a
"removed" toast after the removal was refused.

**Acceptance and release.** Staff acceptance item S56B is open; narrow-screen, mobile and
virtual-keyboard behaviour needs real-device review. Automated checks do not supply staff,
accessibility or City acceptance. These changes are development work: a new release identity
(R57) and packaging require the release owner's authorization; this follow-up does not
authorize packaging, publication or deployment.
