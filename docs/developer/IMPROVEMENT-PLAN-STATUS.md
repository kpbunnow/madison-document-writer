# Document Writer improvement plan delivery

Owner request: complete the remaining work in Document Writer Improvement Plan.md (November 13, 2026), after PR 483. Baseline main is `648c87ad0127e7ff14a9dffb1269a047a3db5407`; its Full gate, security and Windows recovery checks passed. Preserve current release/format identities, issued history, print/legal output, trust and explicit Issue/import confirmation. No release packaging or deployment.

## Delivery checklist

| Plan item | Current status / evidence |
| --- | --- |
| Ease 1 — inspector cases on Workspace | Merged in PR 484 at 83ad87bf054889bf6dfda7ce46d3a43fc0d9b261. Exact reviewed head b3c0a84f9d61300bc705ae8df64ff0f34888f819 passed Full run 43367671008, Windows run 43367670974, PR format/security and independent artifact verification: 404 suites / 306 axe / 69 historical prints / 17 report expressions / 20 Windows scenarios. City-capable Workspace starts the existing inspector list, reuses the remembered selection, and one case click enters the existing review. Retained local work stays above the list. Background answers replace only the list card. |
| Ease 2 — PDF filing during Issue | Already implemented: publication_workflow.fileIssued files every confirmed issued snapshot automatically; failure retains the separate retry. The correction workflow has the same original-retention path. Existing publication/filing/helper/browser regressions protect this; do not introduce a second filing transaction. |
| Ease 3 — batch outcomes | Completed by PR 482; PR 483 corrected Undo field preservation, stale sources and later edits. |
| Ease 4 — Recent/Favorites | Completed by PR 480; PR 483 corrected Selected/shortcut scope and duplicate All-category repaint. |
| Ease 5 — item defaults / next bubble | Heading inheritance and next-bubble focus completed by PR 480; PR 483 protects queued focus after navigation. Due-date inheritance was explicitly withdrawn in the later R80 owner correction: new deadlines remain blank unless the owner changes that decision. |
| Ease 6 — case finder | Completed by PR 482: highlights/scrolls, never hides cases. |
| Ease 7 — Fix next issue | Implemented in PR 485; exact-head verification/merge pending. One counted control cycles current required fields and opens Review for targetless concerns; the separate count/first-field/full-checklist controls are consolidated. Desktop/mobile share the same navigation owner; issuance checks and Review remain independent. |
| Performance — changed rows/panels/results | Initial 50/200/500-case production baseline captured; next measure matched before/after row/panel/results reuse with current readiness/verification and complete invalidation. The first batch already isolates server-list refreshes. |
| Maintainability 1 — screen references | PR 481 retired the first vacuous copies. Remaining screen-reference inventory and meaningful behavior-contract replacements pending. Preserve legal/print/history/model references. |
| Maintainability 2 — services by area | Pending cohesive area composition with explicit scoped interfaces, original initialization order and no universal mutable registry. |
| Maintainability 3 — screen CSS | Pending audited dead-rule cleanup and ordinary-edit/visual-review guidance; approved print stays frozen. |
| Maintainability 4 — leftovers | Keep adding and retired event routes were removed in PRs 477/481. The cleanup batch removes retired filter defaults, handoff/import assignments and preference reads/writes, and the obsolete startup redirect owner/port. Active reminders and remembered server-list inspector remain. Actual startup retains every original retained-work scenario; targeted preference/handoff/startup checks pass. Exact-head gate/merge pending. Remaining presentation-only compatibility helper inventory belongs with the screen-reference migration. |
| Maintainability 5 — generated guides | Pending tagged manual sections, reproducible guide generation and build-time drift checks, preserving guide-specific content and all manual editions. |
| Maintainability 6 — large functions | Pending notice-renderer section extraction and lowered actual complexity/size baselines; retain exact historical outputs. |
| Maintainability 7 — CI artifact resilience | Pending bounded upload retries and safe gate-only rerun using complete successful producer evidence from the same source/run; never accept missing, skipped or mixed evidence. |

## Measurement and verification

The initial clean-main diagnostic used Node 24.19.0, Python 3.14.10 and pinned Playwright 1.64.1/Chromium 156.0.8078.4, serially, with 50/200/500 synthetic cases and three trials each. All durable fixture hashes, loaded records and row counts passed. Raw source/runtime/harness hashes and timings are under `/workspace/scratch/work/improvement-plan-2026-11-13/baseline/initial.json`. These are initial observations, not claimed gains or City/SMB/native acceptance. Later performance delivery must use matched alternating comparisons and retain every workload/result check.

Each focused delivery runs targeted local checks and requires Full gate, PR format, security and Windows recovery on the exact delivered head. Record PR/run links and final outcomes here as batches complete. Main's automatic post-merge gate may be monitored asynchronously under the development standard; investigate failures and fix forward.
