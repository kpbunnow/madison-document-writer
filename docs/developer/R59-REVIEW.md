# R59 Writer workflow and screen consistency

Development baseline: main `282e342` (R58). Developed on `develop/r59` in three stages: A `ae83833`
(inspection selection, charged ordinance, helper reuse rule), B `bb0058f` (CA Reinspection identity,
15-second messages, Violation Items, Review dialog, Issue and return to Workspace) and C (remove and
due-date controls, screen typography and highlights, identity and documentation). Identity:
2026-10-22 R59, helper 2026.10.22.60, helperBuild 60, authorized by the requester ("Implement R59").
Authoring 13, case schema 5, summary 6 and workspace backup 2 are unchanged: no stored format changed.
Approved language, the approved print stylesheet, frozen fixtures, the 69 authored print variants,
court copies, report calculations and operational storage paths are unchanged.

## Decisions

| Question | Decision |
| --- | --- |
| Q1 What makes an inspection already used? | The same case, recorded on any document or visit, including drafts, withdrawn and corrected documents. The R53 refresh of the same visit stays exempt. The helper now enforces it for newly issued documents, under the existing case lock. |
| Q2 Import status matrix | Unchanged. |
| Q3 Which messages time out? | Warnings and errors clear after 15 seconds in Writer and Reports, paused on hover or focus, and stay in Message history. Blocking checks remain in Review and still prevent issuance. |
| Q4 Where does Issue return? | Workspace, with the issued case row highlighted and focused. |
| Q5 Which citation fields fill from the schedule? | The fields returned by resolveCitationAmount. |
| Q6 Which schedule applies? | The effective-dated policyAt for the pricing date (issue-date basis). |
| Q7 Deposit override | The existing administrator deposit override is unchanged. |
| Q8 Saved multi-ordinance drafts | They show the ordinance select with nothing chosen and are blocked until a section is chosen. |
| Q9 Typography scope | All Writer screens and the Reports chrome. Generated and printed documents are unchanged. |

## Changes

1. Inspection import selection. Each candidate shows inspection type, date (with time), inspector
   and status; the "Select inspection"/"Selected" words are gone. The chosen candidate is highlighted
   (border, inset bar and tint; an outline in forced colors) and has aria-pressed. A previously used
   candidate can be selected and then explains why it cannot be imported. A selection token makes a
   stale shared-record check for an earlier selection harmless.
2. Remove item and due date. Above 860px the date field fitted its cell only by overflowing it by
   about 24px, and the remove button (positioned just outside the cell) covered the date field's
   calendar button: at 1366, 1024 and 900px and at 125% and 150% zoom the calendar area hit-tested to
   the remove button. The date field now fits inside its cell beside the selection box, so the 24px
   remove button sits 14px clear of it. The button keeps its "Remove item N" label, shows while its
   row has keyboard focus and is fully visible with a focus outline. At 860px and below the existing
   wrapped card layout is unchanged. Markup and print output are unchanged.
3. Messages. Warnings and errors clear after 15 seconds each time they are shown (Q3).
4. Violation Items. The button opens the violation list for the record instead of scrolling; the
   duplicate "+ Select violations" entry is gone. The empty item table now reads "No items yet — use
   Violation Items to add violations." (screen only; all print goldens still match byte for byte).
5. Review dialog. Review opens a dialog with blocking concerns, advisories or an explicit no-concerns
   state, replacing the bottom checklist section. Check links focus the field; focus returns on close.
   Its sections have their own heading size and spacing.
6. Issue. Print preview is removed from the editor and "Review & issue" reads Issue. Issue re-runs
   the same blockers, refuses duplicate submissions and, once the shared save is confirmed and filing
   attempted, returns to Workspace with the issued case highlighted and focused (Q4). Refused or
   unconfirmed saves stay on the document.
7. Typography (Q9). Type tokens on :root: title 24px (20px at 760px and below), section and dialog
   headings 18px, card and dialog subsection headings 15px, body 14px, labels 12px, table text 14px
   (numbers 13.5px), table headings 12px, buttons 13px and 12px, hints and inline errors 13px, small
   text 12px, badges 11.5px, chips 12px. They apply to page titles, section headings, labels, hints,
   tables, buttons, pills and chips on every Writer screen and the Reports chrome. The document sheet,
   n-* classes and print are excluded. Labels, table headings and the breadcrumb were 10-11.5px and
   are now 12px; hints 12.5px are now 13px; titles were 22-26px.
8. Charged ordinance. An item with several sections offers a select of exactly those sections, with
   no default; the different-charge path stays secondary and needs an approved source. A change
   clears all values derived from the previous charge and reprices from the configured schedule for
   the pricing date (Q5, Q6). A missing choice, several schedule rows or a lookup failure is a clear
   blocking concern, never a guessed amount.

CA Reinspection identity: a visit imported from a CA Reinspection is accepted by the helper (it was
refused as an invalid identity since R53); reuse is still refused across reinspection and CA
reinspection records.

## Reviewed screen CSS exception

Items 2 and 7, the selected inspection, the issued case row and the Review dialog spacing are one
contiguous screen-only block appended after the R56 phase 3 block of app/assets/ui-refresh.css,
beginning `/* R59 screen styles (screen only):`. audit_r51_layout pins its size and SHA-256, requires
it (and the phase 3 block) exactly once in each built shell and removes both before comparing with
the unchanged historical shell hash. The approved print stylesheet is not changed.

## Tests

browser_r42 measures the selection box, date field, calendar area and remove button at 1366, 1024,
900, 1093 and 911px (1366px at 125% and 150% zoom): no intersections, each control hit-tests to
itself, the calendar area removes nothing, the remove button removes only its own item, keyboard
focus shows it, and it is not printed. browser_r59 checks the token values in Writer and Reports,
that equivalent elements use the same token on Workspace, editor, Review, tools, language, import and
two Reports screens, no overflow or clipping at 1366, 760, 390, 320px and 200% zoom, and the
selected candidate and issued row in light, dark, high-contrast and forced-colors modes with axe.
Stage A/B suites: audit_r59_import_selection, audit_r59_charge_select, audit_r59_import_reuse,
audit_r59_editor_flow.

## Known limitations

Screen typography was checked in Chromium with the Linux fallback fonts; Segoe UI metrics at City
display scaling need the native review in S59-5. The remove/date separation needs S59-6 at City zoom.
The charged-ordinance select needs real multi-ordinance items and the deposit schedule reviewed by the
division (S59-3). Automated checks do not establish City, native or staff acceptance.

## Acceptance

S59-1 to S59-6 in ACCEPTANCE-RECORD.md are OPEN, together with the existing City, legal, native and
mandatory-appearance items. Packaging produces a verified package; it is not a live rollout.
