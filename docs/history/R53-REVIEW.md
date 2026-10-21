# R53 implementation review

Release **2026-10-19 R53** from verified R52. Helper 2026.10.19.54 (helperBuild 54); authoring 11, case schema 5, summary 6, backup 2 unchanged.

## WP0 Update recovery
Diagnosis: the City PC error `('rc != 0', False)` came from the R50/R51 signature library (pure25519 `ValueError("rc != 0", rc)`): an unretired R50/R51 installation verified the R52 share, which still held a stale `runtime-manifest.sig`. Changes: the share launcher detects a signing-era installation (release_trust.py present, or helperBuild missing or below 53) and prints retirement steps without running anything; stale signed-release files are named in the refusal; `prepare_deployment.py` applies a release (retire unlisted items beside the folder, copy, verify); refusals report exception type, operation and relative path and write `update-diagnostic.txt`; link and reparse checks cover only paths inside the deployment folder. Tests: audit_r53_update_recovery.py.

## WP1 Status-driven documents
`statusRule(type, status)` in app_core.js holds the division table (decisions 2026-10-19). Rows carry their rule; unlisted results (including Completed) are not importable. The import plan enforces: Initial Inspection never imports into an existing case (snow included); Reinspection and CA Reinspection need a case; CA Reinspection needs a prior referral; Reinspection/CA Referral is the first referral only; snow inspections use status Citation. Initial No Occupancy and Abatement statuses use the established initial-action document with the selector locked. Reinspection worksheets show “Document from the Accela status” instead of Choose next action; Extension Processing offers Extension, Best Interest Extension and Vacancy Extension. Issuance checks block contradictions with specific messages; there is no override. Re-importing the same inspection while its draft or worksheet is unissued refreshes the stored status. Worksheets created before R53 keep the previous chooser. Tests: audit_r53_status_rules.js; import fixtures updated from Completed to the specific statuses (assertions unchanged except the new no-case message).

## WP2 Group due dates on reinspection
The existing Assign due dates panel and assignment (which already had a worksheet mode) are enabled on open reinspection worksheets, listing only outstanding items; Undo added for both notice and worksheet. Tests: audit_r53_workflow.js.

## WP3 Warnings
Top-of-page banners (outside cards, documents and dialogs) clear 15 seconds after first appearing; hover or focus restarts the timer; cleared warnings go to Message history; a warning that disappears and recurs shows again. Ongoing conditions remain in their indicators (save status, read-only case, held issuance). Tests: audit_r53_workflow.js.

## Assumption to confirm
Follow-up snow events arrive as Reinspection with status Citation (acceptance item N53).
