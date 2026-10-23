# Document Writer — Development 3 implementation prompt

Prepared October 23, 2026. Source: the owner's `Document_Writer_Development_3.docx`, with the owner's clarification answers recorded below.

Status: development prompt. This document authorizes neither merging nor deployment. City, staff and native acceptance remain open until recorded on City equipment.

## Assignment

Develop the next version of Madison Building Inspection Document Writer around the six requirements below. Begin from current `main` (`7927d7c`, PR #33 merged, R61), follow `AGENTS.md` and the developer guides, implement the confirmed requirements, run the full gate, and open a development PR for review. Do not merge or deploy automatically.

Release identity (owner-authorized): **2026-10-23 R62**, helper **2026.10.23.63**, helper build **63**, new-document authoring **16**. Case schema 5, summary 6 and workspace backup 2 stay unchanged unless the work proves otherwise; record any such change.

Every document-format change in this prompt applies only to new authoring-16 documents. Issued documents, their reprints, and corrections of earlier documents keep their recorded authoring version and render exactly as before. Drafts created before R62 keep their authoring version unless the existing explicit adoption path applies.

## Confirmed owner clarifications

1. **An already-used inspection is hidden.** It no longer appears in the import list. The helper's R59 refusal stays as the authoritative check.
2. **Best Interest due dates work exactly like a normal Extension.** No affected-item checkboxes. Every outstanding item takes its Next due date from the reinspection worksheet; dates stay editable in Violation items. Reasons remain.
3. **Vacancy Extensions keep only Scope and the Next review inspection date** from their current details. Sale/transfer wording, the short-notice procedure and the closing "Security, urgent safety obligations and unlisted items are not extended…" sentence are removed with the listed fields.
4. **A referred case allows only Update for Case Referral and Compliance Letter.** The approved emergency / occupancy exception (No Occupancy, Summary and Non-Summary Abatement on a referred case) and its fields are removed.
5. **Notes move under the violation on all history documents:** Referral for Prosecution, Update for Case Referral and Compliance Letter.
6. **Vacancy covers every uncorrected item automatically**, with no affected-item checkboxes.
7. **The Vacancy review date must be at least 7 days after the mailing date**, so the printed "contact by" date is never before mailing.
8. **New Best Interest wording:** "Additional time is granted for the uncorrected items for the following reasons: …".

## 1. Inspection import rules

Rules live in `app/modules/app_core.js` (`ACC_STATUS`, `STATUS_RULES`, `statusRule`) and the candidate list in `app/modules/reinspection_walkthrough.js` (`accelaTable`, import plan). The SQL lookup and the uploaded report share these paths.

**Allowed (type → status → document):**

| Inspection type    | Inspection status                        | Document it starts                                              |
| ------------------ | ---------------------------------------- | --------------------------------------------------------------- |
| Initial Inspection | Official Notice                          | Official Notice                                                 |
| Initial Inspection | Citation                                 | Official Notice with citation                                   |
| Initial Inspection | No Occupancy                             | No Occupancy                                                    |
| Initial Inspection | Abatement Summary                        | Summary Abatement                                               |
| Initial Inspection | Abatement Non-Summary (or "Non Summary") | Non-Summary Abatement                                           |
| Reinspection       | CA Referral, or City Attorney Referral   | Referral for Prosecution (first referral)                       |
| Reinspection       | Compliance                               | Compliance Letter (all items corrected)                         |
| Reinspection       | Citation                                 | Citation                                                        |
| Reinspection       | Extension Processing                     | Choose: Extension, Best Interest Extension or Vacancy Extension |
| Reinspection       | **No Fee Extension Processing** (new)    | Choose: Extension, Best Interest Extension or Vacancy Extension |
| Reinspection       | No Occupancy                             | No Occupancy                                                    |
| Reinspection       | **No Fee No Occupancy** (new)            | No Occupancy                                                    |
| CA Reinspection    | Compliance                               | Compliance Letter (needs an existing referral)                  |
| CA Reinspection    | Non Compliance, or Non-Compliance        | Update for Case Referral (needs an existing referral)           |

The existing matching normalization (case, spacing, hyphen/dash, "Re-inspection") applies to the new statuses.

**Hidden: these rows never appear in the list:**

- Status Scheduled, Pending, Completed, Inspection, No Violation, Reinspection, No Fee Reinspection (any inspection type).
- Initial Inspection with status No Entry. Other types with No Entry are not hidden; they fall under "listed but not selectable".
- Type Assist (any status).
- A row with no inspection date.
- An inspection already used on the case (R59 `inspectionUsed`). Exception: the R53 Refresh-from-Accela row, which re-imports the inspection of an unissued draft or worksheet, is not "used" and stays visible. Hiding depends on the merged shared record; when that record arrives later and hides the selected row, clear the selection and bump the selection token.

**Listed but not selectable:** any other type/status pair, greyed out with the existing "has no document rule" reason.

When every returned row is hidden, explain why using the existing summary message pattern. Name each hidden category that occurred (for example "only Scheduled rows were returned", "every returned inspection has already been used; choose Continue existing case"). Nothing is imported.

Acceptance: each table row imports to its document; each hidden status/type is absent from the list for both report upload and SQL lookup; unknown pairs are greyed with a reason; Reinspection/No Entry is greyed, not hidden; used inspections are absent while Refresh rows stay; the helper still refuses a reused inspection.

## 2. Best Interest Extension (authoring 16)

- Remove the "Affected items exclude safety, security and urgent obligations" checkbox and its requirement (Writer `checks`, helper `validate_special_fields`).
- Remove the affected-item checkboxes. Every outstanding (not corrected, not withdrawn) item is extended.
- Next due date works exactly as on a normal Extension. The reinspection worksheet shows **Next due date** for each open item when Best Interest is the chosen follow-up, the created document takes those dates, and they stay editable in Violation items. Apply the same due-date rules as the normal Extension: future date, at most three distinct outstanding dates, seven days apart. Do not add rules the normal Extension lacks.
- Wording: "Additional time is granted for the uncorrected items for the following reasons: <Reasons>."
- Keep Reasons (required) and the R61 no-signer layout.
- Mirror in the helper: for authoring 16, `affected` must equal all outstanding item numbers, there is no `noSafety` requirement, and the R61 correction-format rule extends so a correction keeps its original's format (15 vs 16 vs earlier).

## 3. Vacancy Extension (authoring 16)

Remove these fields, their checks, their helper requirements and their printed text:

- "Affected items exclude safety, security and urgent obligations" and the affected-item checkboxes.
- Reviewed factual basis for excluding safety items.
- Extension request reference.
- Verified vacancy basis.
- Approved continuing conditions (and the "Approved conditions:" paragraph).
- Expiration / review model, the separate expiration date and the approved expiration / review policy (and the expiry sentence).
- Authority, wording and signer review and all its fields (authority, code source/revision, reviewer, review date, reference, signer name/title, delegation, the division-review checkbox), and any signer block they print.
- Sale / transfer wording and the short-notice procedure (clarification 3), and the closing "Security, urgent safety obligations…" sentence.

Keep **Scope** and **Next review inspection** date. The review date must be at least 7 days after the mailing date (Writer check and helper).

Items: every uncorrected item is covered. Corrected items keep their correction dates. Uncorrected items print **no due date** (blank Due Date cell); their stored source deadline is retained in `originalDues`, not printed. This is the authoring-16 presentation; never create an authoring-13 conditional Vacancy Extension (`04-PITFALLS.md`).

Change "…remains vacant and the conditions below are met, we grant an extension for Item(s) <refs>." to "While the apartment / unit remains vacant and the conditions below are met, we grant an extension for the uncorrected item(s)." Use "building" in place of "apartment / unit" when Scope is the entire building, as today.

## 4. Inspection notes under the violation (authoring 16)

For new Referral for Prosecution, Update for Case Referral and Compliance Letter documents, show each observation's note under the violation text in the corrections-required cell, using the existing `it-note` presentation ("Inspector's note · <date>") that Extensions use, oldest first. Remove notes from the Inspection History column. Dates, CORRECTED labels, citations, Abate values and Days Outstanding stay in the history column. Long notes must still paginate without clipping; every word prints once. Authoring 14/15 documents keep notes in the history column.

## 5. Referred cases: only Update for Case Referral or Compliance

When a case has an effective Referral for Prosecution or Update for Case Referral:

- The follow-up chooser shows only Update for Case Referral and Compliance Letter. Other document types are not displayed, and the Writer refuses them.
- Remove the emergency / occupancy exception checkbox and its City Attorney coordination field.
- An import whose status calls for any other document is refused at review with the reason (case is with the City Attorney).
- The helper refuses every other new document type on a referred case. Corrections of documents issued before referral are unaffected.

## 6. Release identity, documentation and tests

- Apply R62 identity and authoring 16 through the existing identity sources and build.
- Update `CHANGELOG.md`, `docs/developer/01-ARCHITECTURE.md`, `03-DOMAIN-RULES.md`, `04-PITFALLS.md`, a new `R62-REVIEW.md`, the staff guides and the program manual where they describe import statuses, Best Interest/Vacancy fields, referral notes or referred-case options. Regenerate manual editions with the existing tooling.
- Add `S62-*` open acceptance items to `ACCEPTANCE-RECORD.md` and note them in `PRODUCTION-READINESS.md`.
- Add regression suites (register them in `tests/README.md` and the source inventory) covering: every import table row, every hidden category, greyed pairs, used/refresh rows; authoring-16 Best Interest and Vacancy fields, wording, due dates and helper parity; referral/update/compliance note placement and pagination; referred-case options and helper refusal; authoring 13–15 output unchanged.
- Never edit existing assertions, goldens or expected hashes merely to pass. Where an existing test asserts a behaviour this prompt changes for new documents only, keep it for the older authoring version and add the authoring-16 case.

Run the full gate serially, record actual results in the PR, and open the PR for review. Do not merge.
