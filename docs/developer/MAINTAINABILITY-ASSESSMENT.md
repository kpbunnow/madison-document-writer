# Remaining maintainability assessment

Snapshot: the PDF-artifact increment based on merged PR #61, main `ff8d8bc0d5f37cbd3c94f70bf158e878801c3a96`. This is a maintenance assessment, not a claim that all bugs are absent or a release approval. Counts describe this reviewed source layout; they are not quality/performance thresholds.

## What this increment completes

Outbox presentation/selection/retained-byte printing and artifact-location refresh now have a five-dependency service owner, with direct status/independence queries. Six original bodies are preserved apart from dependency access, including synchronous popups, captured name/hash selections, utility/refresh sequencing, identity checks, partial-failure behavior and existing timer lifetimes. Transfer events, helper validation and publication authority stay in their established owners. case_timeline shrinks from 1,360 to 1,178 lines and workspace_shell loses its timeline import, but the eight-module cyclic component remains. Earlier boundaries remain independent, Reports stays acyclic, and technical PNG/native acceptance status is unchanged (SCREEN-VISUAL-REVIEW.md).

## Main unfinished work: Writer dependency ownership

The graph still contains one eight-module Writer component. These are eight coupled owners, not eight identified bugs or a promise of eight more PRs. The modules have different responsibilities and should not simply be wrapped into ever-larger dependency objects.

| Owner | Source lines | Graph module dependencies | Dependencies inside this cycle | Main remaining concern |
| --- | ---: | ---: | ---: | --- |
| `app_core.js` | 1774 | 53 | 7 | Composition, state/bootstrap and feature dispatch remain centralized |
| `app_screens.js` | 1237 | 19 | 7 | Routing, shared dialogs/overlays and case-list rendering still depend on peers |
| `case_files.js` | 1047 | 18 | 7 | Draft persistence, restoration and case-file/workspace actions remain coupled |
| `case_timeline.js` | 1178 | 16 | 5 | Handoff, workspace tasks, due dates and citation editing still share one owner; PDF artifacts, reminders/timeline and inspection facts have separate owners |
| `court_and_deposits.js` | 1092 | 18 | 7 | Money/charge checks, notifications, rendering and PDF/Outlook delivery share one owner; date/time parsing and inspection facts are independent |
| `draft_recovery.js` | 1213 | 16 | 7 | Recovery, publication continuation and workspace UI depend on one another |
| `issuance_and_corrections.js` | 1403 | 18 | 7 | Issuance/correction orchestration, history and UI presentation remain intertwined |
| `workspace_shell.js` | 728 | 17 | 4 | Workspace mutation/merge, storage adapters, helper requests and shell/print integration remain coupled |

Counts come from `node tools/module_graph.cjs` and maintained source line counts, including comments/blank lines. Generated/vendor modules are outside that graph. Module size alone is not a defect; responsibility mixing and dependency direction determine the next boundary.

## Recommended priority and scope

1. **Continue with bounded remaining timeline actions.** Shared inspection facts, reminder/timeline presentation and PDF artifacts are now separated. Next inspect Writer/Reports handoff and readiness as a cohesive boundary, then bulk/selected due dates, workspace tasks and citation editing still in case_timeline. Choose by actual callers rather than wrapping the entire module. Preserve single-tab/startup restoration, stale handoff/navigation guards, current edits and save-before-navigation ordering.
2. **Separate publication/correction/recovery orchestration.** Define explicit request/confirmation/retained-result operations between issuance_and_corrections and draft_recovery. Keep helper validation and immutable PDF receipt authority unchanged. Test lost acknowledgements, pending publication, correction lineage, failed saves and recovery before removing the relevant cycle edges.
3. **Separate persistence adapters from workspace coordination.** case_files and workspace_shell should expose bounded persistence/merge/restore capabilities rather than UI callbacks everywhere. Preserve startup restoration barriers, save-chain ordering, rollback, folder permissions, integrity verification and the frontend/helper projection contract. Keep native platform calls behind their established adapters.
4. **Finish core/screen direction after the service boundaries are clearer.** Keep core as an explicit composition root, startup and registration coordinator. Screen renderers should consume scoped facts and actions. Avoid moving all coupling into another universal context or re-export module. Split bootstrap/composition only if it can preserve the established initialization/listener order.

These priorities may need several focused PRs. A graph reduction is useful, but it is not sufficient if callers still receive a broad undifferentiated interface.

## Improvements beyond the cycle count

### Keep dependency interfaces bounded

Core currently has 53 maintained-module dependencies in this graph and 35 named factory calls with object interfaces. The largest reviewed interfaces are:

| Factory | Named input fields |
| --- | ---: |
| `createEditorEvents` | 38 |
| `createWorkspaceEvents` | 36 |
| `createEditorScreens` | 32 |
| `createReinspection` | 30 |
| `createRecoveryEvents` | 30 |
| `createAccelaImport` | 21 |

These are indicators for review, not automatic failures. Narrow an interface when its fields reveal separate responsibilities; retain call-time getters where restoration replaces state. Do not introduce a universal registry, spread the entire core/state into constructors, or trade a visible import cycle for an opaque callback container.

### Continue extracting true record calculations

Pure migration, projection, formatting and record-source owners already exist. Shared inspection/date facts are now independent as well; live queries remain explicitly distinguished from pure calculations. Further extract charge-readiness calculations only when their inputs and authority are explicit. Keep UI prompts, file/network I/O, current workspace state and publication decisions in adapters/orchestrators. Preserve historical authoring cutoffs. The independent JavaScript/Python projection mirror is intentional and has parity tests; it is not redundant code to delete casually.

### Improve tests alongside each boundary

Independent service construction and focused behavioral tests should become the easiest way to test new work. Keep existing bundle-eval diagnostics, browser workflows and historical output assertions while that transition occurs. Migrate private test access deliberately; do not delete coverage or widen production APIs solely for tests. Add lightweight JSDoc/checked interfaces when they prevent actual wiring/data-shape mistakes; a wholesale TypeScript conversion or broad test renaming is not required by this roadmap.

### Keep regression/review evidence usable

Retain the current source inventory, ownership map, test index, exact-source full gate, serial measured browser work and PR/release naming standard. Keep visual comparison artifacts separate by media mode and disclose capture variability. No new packaging framework, dependency replacement or automated deployment is needed for this cleanup.

## Stopping criteria

The planned architecture cleanup is complete when the Writer module graph has no cyclic component, Reports stays acyclic, major features load independently, and ownership remains explicit without a replacement registry/barrel. Review interface breadth and core startup clarity as well as the graph. Preserve all historical output, trust boundaries, stored/installed names, live-state and failure-ordering contracts, with the full gate passing on final reviewed source.

After that, continue maintainability changes only where a concrete defect, feature, platform requirement or recurring development difficulty justifies them. Zero cycles does not require rewriting all 74 maintained modules or eliminating every legitimate cross-feature action.

## Outside this development work

City Windows/network-drive/Outlook/native-print, manual accessibility, staff and legal acceptance require their actual owners' evidence and confirmation. They may uncover fixes for development, but cannot be closed by these refactors or automated gates. Preparing a later release package is a separately authorized publication task.
