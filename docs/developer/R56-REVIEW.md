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
