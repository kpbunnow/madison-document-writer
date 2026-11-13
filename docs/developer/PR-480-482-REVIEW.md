# Review of PRs 480–482 — November 13, 2026

Reviewed current R80 main `b63195e75cc0f2b8421ea07a211ceaefbc67e3a8`: PR 480 (item defaults, next-bubble focus, shortcuts), PR 481 (screen-reference/test cleanup), and PR 482 (remembered inspector, Workspace case finder, batch findings). Also checked their interaction with the prior Workspace/handoff changes. This is a scoped review of recent development, not a new whole-codebase audit.

## Confirmed findings and corrections

| Finding | Priority | Trigger / original behavior | Correction |
| --- | --- | --- | --- |
| LPR-001 | P1 | Mark the rest, add notes/date/due details, then Undo. `reinspection_batch.js` deleted the complete result when its outcome matched, including pre-existing observations and later edits. | Snapshot before/after results. Restore untouched batch-written fields to their original values; retain later edits. Refuse stale sources, carried findings, issued/follow-up worksheets and later manually replaced results. Normal single-item recording and issuance authority stay unchanged. |
| LPR-002 | P2 | Choose Favorites or Recently used while Language status is Selected. The shortcut appeared active but `languagePicker` rendered all selected items, including non-favorites. | Intersect the shortcut keys with the selected/status visibility predicate, so the displayed list matches the active shortcut and its count. |
| LPR-003 | P3 | Click All violation categories. Both shortcut and ordinary language listeners repainted the picker (two replacements for one click). | Keep this action in `language_actions.js`, clear its shortcut state there, and remove duplicate shortcut-listener ownership. Search focus still returns through the existing route. |
| LPR-004 | P2 | A fill-in dialog's queued close event arrives after navigation/replacement. The next-bubble callback searched disconnected-field document order and could focus another document's blank. | Require the original field to remain connected in the same active editor/document before finding the next bubble. Normal immediate/deferred next-bubble focus remains. |

All four are reproduced in `tests/unit/audit_recent_workflow_regressions.js`: each failed on the reviewed main and passes with these corrections. The Undo regression calls the actual ordinary recorder and checks original notes/manual dates/deadlines, later edits, carried results, later manual outcomes and changed sources. The All-category regression registers both actual listeners in production order and asserts one repaint. The focus regression controls delayed close delivery after a real DOM replacement. Existing feature tests and frozen behavioral/print/legal references remain. The retained action comparison adapts only the deliberate picker-shortcut clearing assignment in memory; every original action, callback-order and failure scenario remains. Production Chromium also confirms the Selected/Favorites intersection, one All-category replacement, restored selected list and search focus using a synthetic retained draft.

## Other reviewed changes

Checked remembered-inspector storage failure and stale-result handling, Workspace matching/Enter focus without hiding rows, item heading inheritance with blank new deadlines/restored private values, and the screen-test retirement's retained scenarios/escaping/interruption invariants. No additional confirmed defect in these changes was identified. Do not interpret the completed automated gate as City/Windows printing, Outlook, staff, legal or manual accessibility acceptance.

## Verification and scope

Before/after logs are retained at `/workspace/scratch/work/latest-pr-review-2026-11-13/`. Targeted commands include the new regression, `audit_reinspection_batch.js`, `audit_language_shortcuts.js`, `audit_document_sources.js`, module boundaries, complexity and the related presentation/registration/report-facts checks. Actual final results and exact reviewed head belong in the corrective PR; a full exact-head GitHub gate and PR format are required before merge.

R80, helper 2026.11.13.81/build 81, authoring 16, schema 5, summary 6 and backup 2 are retained. No dependency locks, CSS references, issued records, approved wording or historical output fixtures change. No packaging or deployment is requested.
