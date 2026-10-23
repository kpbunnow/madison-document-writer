# R62 Development 3 review

Source: the owner's `Document_Writer_Development_3.docx` and the clarification answers recorded in
`R62-DEVELOPMENT-PROMPT.md`. Release 2026-10-23 R62, helper 2026.10.23.63 (build 63), authoring 16; case schema
5, summary 6 and workspace backup 2 unchanged. This review is development evidence, not City acceptance.

## Implemented

- **Import rules.** Reinspection No Fee Extension Processing (extension chooser) and No Fee No Occupancy (No
  Occupancy) are added. Scheduled, Pending, Completed, Inspection, No Violation, Reinspection and No Fee
  Reinspection statuses (any type), Initial Inspection No Entry, Assist and undated rows are hidden when the report
  is read and are not kept in the case's import reference. Inspections already used on the case are hidden when the
  plan is built, after the shared record is merged; the R53 refresh of an unissued draft's or worksheet's own
  inspection stays visible. A selection that becomes hidden is cleared, and a single remaining eligible result is
  selected. Other pairs are listed under Not available for import, greyed (`aria-disabled`, not focusable) with
  their reason. When nothing can be listed the review names each hidden category returned.
- **Best Interest Extension (authoring 16).** Every uncorrected item is covered (`special.affected` derived);
  no affected checkboxes or safety confirmation; the worksheet shows and requires Next due date and the document
  takes those dates, editable in Violation items; the normal Extension rules apply (future date, at most three
  dates, seven days apart). Wording: "Additional time is granted for the uncorrected items for the following
  reasons: …". Adoption of an older draft moves to authoring 16.
- **Vacancy Extension (authoring 16).** Every uncorrected item is covered with no due date; corrected items keep
  their dates and source deadlines stay in `originalDues`. Only Scope (and unit identifier) and the next review
  inspection remain; the review date must be at least seven days after mailing. The listed fields, the Authority,
  wording and signer review, sale/transfer wording, short-notice procedure, closing "Security, urgent safety
  obligations…" sentence and signer block are removed; no signer or division review is frozen. Wording: "While the
  apartment / unit (building) remains vacant and the conditions below are met, we grant an extension for the
  uncorrected item(s)."
- **History notes (authoring 16).** Referral, referral-update and compliance documents print every observation
  note under the violation, oldest first, including corrected items (the approved print style hides `it-note` on
  corrected rows, so these notes carry an explicit display); the history column keeps dates, outcomes, citations
  and Days Outstanding. Pagination continues later notes and splits one long note at a word boundary.
- **Referred cases.** The follow-up chooser, eligibility, case actions screen, import review and helper allow only
  Update for Case Referral and Compliance Letter. The emergency / occupancy exception and its fields are removed.
  Corrections of documents issued before the referral remain possible.
- **Helper parity.** `validate_special_fields` mirrors the authoring-16 rules; `validate_best_interest_correction`
  ties a Best Interest or Vacancy correction to its original's format (R61 15, R62 16, earlier).

## Changed existing tests (behaviour the owner replaced)

- R50/R53/R59/R13/R45/R5 import suites: Completed and Pending rows are now hidden rather than listed and refused;
  used inspections are hidden rather than selectable with an explanation. The R59 selection and race checks now run
  on the listed candidates.
- R26 browser/unit, R61 browser: their authoring-13/15 scenarios are pinned to those versions, because new drafts
  are authoring 16; R26 helper: the emergency exception now fails.
- Current-authoring assertions in R59 charge select, R60 and R61 development move from 15 to 16, as R61 moved them
  from 14 to 15. R61 helper: a 15→16 correction is now a format change and is refused.
- Layout audit: a reviewed R62 screen block (greyed import results) is appended after the R60 block.

## Open

S62-1 to S62-5 in the acceptance record remain OPEN, together with every carried City, native, legal and
accessibility item. Wording of the new Best Interest and Vacancy letters needs division review.

## PR 34 review corrections

- Existing trusted pre-R62 emergency orders on referred cases retain their earlier approval rule during history validation. Previously, applying the new no-exception rule to every historical event prevented subsequent saves of a previously valid case. Newly submitted orders are still refused, including requests claiming an older authoring version; historical status comes from the store's known event IDs, not from the client version.
- The new authoring-16 Vacancy body no longer retains the sale/transfer sentence the owner explicitly removed. Earlier formats are unchanged.
- Import refresh uses one shared eligibility predicate for the candidate list and import plan. Correction drafts and pending publication attempts do not exempt an already-used inspection from hiding or authorize refreshing that draft; ordinary unissued draft/worksheet refresh remains available.
- New extension correction forms no longer offer a document-family switch. Browser correction readiness mirrors the helper's existing protected scope, affected-item and review-date checks, so changing those facts is explained before a rejected shared save. The helper's rule is unchanged.
- New administrative drafts seed current per-family authoring defaults. A newly created scoped order still uses its unchanged authoring-13 layout, but switching it to Best Interest or Vacancy now selects authoring 16. Previously the scoped order's version was mistaken for an older draft and selected the older extension format. Existing older drafts retain their cached formats and adoption behavior.
- The R26 legacy family-switch fixture removes current-release defaults when explicitly modeling authoring 13; its existing date-preservation assertions remain. The R54 newly-created administrative-family assertions now require authoring 16 for either extension, while explicit authoring-13 and retained R61 family-switch tests continue to cover the older models.
- A full browser run observed the manual URL before its Chapter 4 navigation completed. The retained keyboard test now foregrounds the manual and waits at most five seconds for that exact navigation before keeping the original URL assertion. Twenty-five isolated keyboard runs all navigated successfully; the load-dependent failure did not reproduce in isolation. Manual content and the surrounding suite deadline are unchanged.
- Regression coverage reproduces the historical-event refusal, incorrect correction-draft import visibility, retained transfer wording and correction controls. Full-gate results and the exact verified commit are recorded on PR 34. City/native and division wording acceptance remain open.
