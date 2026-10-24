# Domain rules

These are the rules the program enforces now, grouped by feature. Rules confirmed by the product owner are marked as such; release-by-release history is in CHANGELOG.md and docs/history/.

## Authority and approved wording

Legal wording, ordinance interpretation, court schedules, numbering, authority, seasonal policy and language approval belong to the division. The mandatory-appearance hold remains enforced in Writer and helper until approved distinct defendant instructions are supplied. Historical frozen reprints remain unchanged. Current approved document and court wording (notice blocks, document bodies, court details, copies, instructions and contact) is data in app/assets/approved_language.json; change it only with the division's language approval (L5). Issued documents keep their frozen copies.

## Issued records and identities

Preserve issued snapshots, event/item/root/visit identities, action chronology, correction lineage, withdrawals versus compliance, deadline limits, initial notice/citation atomic publication and legacy readers. Device saving is not issuance; a filed marker is not PDF proof; an Outlook draft is not delivery. A pending publication confirms its retained request before another action. Every document keeps the authoring version it was issued with; earlier versions are unchanged and corrections render in the source's format.

## Inspection import

Inspection imports use the unchanged fixed read-only SQL query or division SSRS Excel. Both paths use the inspection-type/status matrix in accela_import.js:

| Inspection type | Statuses that decide a document |
| --- | --- |
| Initial Inspection | Official Notice, Citation, No Occupancy, Abatement Summary, Abatement Non-Summary |
| Reinspection | CA Referral / City Attorney Referral, Compliance, Citation, Extension Processing, No Fee Extension Processing, No Occupancy, No Fee No Occupancy |
| CA Reinspection | Compliance, Non Compliance |

Completed and all unlisted results are refused. Never listed (owner rule): Scheduled, Pending, Completed, Inspection, No Violation, Reinspection and No Fee Reinspection results for every type, Initial Inspection No Entry, Assist inspections, undated rows and inspections already used on the case. The refresh of an unissued draft's or worksheet's own inspection is not a use. Other type/status pairs are listed, greyed and not selectable, with their reason. Unknown statuses, unsupported types, missing actual dates and future dates cannot authorize an import. Blank times remain blank. A result status is not evidence that Document Writer issued a document; shared record identities independently prevent reuse. Existing unfinished work opens through Continue existing case. Several eligible results require an explicit choice. Snow Removal record category retains the MGO 10.28 route.

## Notices, items and deadlines

New notices begin with no automatic item deadline. At most three distinct outstanding-item dates are permitted by the existing rules. Physical visits and their item findings are distinct from document actions. No-access findings are not compliance. Withdrawn items retain their reason and identity. Private language edits survive removal/reselection; reviewed-version adoption is explicit; issued wording stays frozen.

## Extensions

Owner rules: new Best Interest and Vacancy Extensions cover every uncorrected item with no selection, no safety confirmation and no signer block. Best Interest due dates follow the normal Extension rules (the worksheet's Next due date, editable in Violation items). Vacancy prints no due date for uncorrected items and needs a review inspection at least seven days after mailing. Drafts in earlier formats keep them; only explicit adoption moves an unissued Best Interest draft to the current format. The existing Best Interest safety-exclusion checkbox remains for authoring-15 drafts, which need that explicit confirmation but no separate safety-basis narrative. Older formats and other families retain their requirements.

## Histories and referrals

Owner rules: show the inspections that actually observed each item, beginning at that item's first observation, including later-added items. Days Outstanding stops at correction; outstanding items end at their latest recorded observation. Carried compliance is not a new observation. No date is inferred from mailing/issuance or unrelated case visits. New referral, referral-update and compliance documents print every note under the violation, corrected items included. Compliance letters retain item-specific observation histories and explicit Abate values. A referred case allows only Update for Case Referral or Compliance Letter; corrections of earlier documents remain possible.

## Citations and pricing

Required citation copies remain Court, Agency, Inspector and Defendant, with approved distinct content; previews and PDFs must contain all four distinct copies per charge (owner rule). Pricing preserves determined locks, counted history, approved basis provenance, required measurements and unchanged-correction prices. Correction money formatting never changes stored units or pricing. Manual authority is separate from the mandatory wording hold. Snow uses its existing site/season rules and no ordinary repair deadline. Do not change policy to bypass a readiness check.

## Reports

Reports accepts only verified case bytes matching summary sourceRevision, and only a summary whose reportable fields equal the helper's projection of that verified case (helper/case_projection.py, the exact mirror of summarize()); legacy, stale, duplicate, unreadable, unproven or non-matching projections remain visible as excluded coverage. The case file is the authority: a rebuild rewrites summaries, never cases or integrity history. Current table, CSV, workbook and report print use the same row ordering. Cached review metadata is labeled and cannot bypass publication validation.
