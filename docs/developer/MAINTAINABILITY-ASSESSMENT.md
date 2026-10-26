# Remaining maintainability assessment

Snapshot: recovery presentation/work-control and document-history separation based on merged PR #76, main `bfa31701115c65d02ae59c46a4c4d4dcd93edbc4`. This is a maintenance assessment, not a claim that all bugs are absent or release approval. Counts describe this reviewed source layout, not quality/performance thresholds.

## What this increment completes

Recovery presentation/work controls now have an 11-input owner; catalog forms/keys and read-only document revision/history/print notes have their own bounded owners. All ten moved functions retain logic, markup and dispatch/error order. Constructors perform no work. The former draft_recovery module is retired without forwarding exports. Issuance is 120 lines smaller. Writer narrows to six cyclic modules; Reports remains acyclic. Record actions, correction UI and inspection-history calculations remain separate future work. Print/native/PNG acceptance status is unchanged (SCREEN-VISUAL-REVIEW.md).

## Main unfinished work: Writer dependency ownership

The graph still contains one six-module Writer component. These are six coupled owners, not six identified bugs or a promise of six more PRs. The modules have different responsibilities and should not simply be wrapped into ever-larger dependency objects.

| Owner | Source lines | Graph module dependencies | Dependencies inside this cycle | Main remaining concern |
| --- | ---: | ---: | ---: | --- |
| `app_core.js` | 2125 | 75 | 5 | Composition, state/bootstrap and feature dispatch remain centralized |
| `app_screens.js` | 1242 | 18 | 5 | Routing, shared dialogs/overlays and case-list rendering still depend on peers |
| `case_files.js` | 647 | 14 | 4 | Summaries, folder/address/workspace UI and startup sequencing remain coupled |
| `court_and_deposits.js` | 1096 | 16 | 4 | Money/charge checks, notifications, rendering and PDF/Outlook delivery share one owner; date/time parsing and inspection facts are independent |
| `issuance_and_corrections.js` | 796 | 15 | 4 | Record actions/history, citation creation and saved-work UI remain coupled |
| `workspace_shell.js` | 469 | 13 | 3 | Shell/print/storage UI, folder connections, event append and helper transport remain coupled |

Counts come from `node tools/module_graph.cjs` and maintained source line counts, including comments/blank lines. Generated/vendor modules are outside that graph. Module size alone is not a defect; responsibility mixing and dependency direction determine the next boundary.

## Recommended priority and scope

1. **Finish remaining record/history boundaries.** Device/local-draft/shared/case persistence, recovery backups/restoration/presentation, worksheet transitions and read-only document history now have independent owners. Next inspect record actions, correction UI and item/inspection-history calculations for distinct responsibilities. Preserve retained attempts, correction/inspection lineage, historical rendering and failure order; do not replace explicit dependencies with a broad callback registry.
2. **Review remaining court/deposit/delivery and core/screen direction.** Shared confirmation, publication preparation/continuation and correction preparation/issuance are now independently composed. Keep core as an explicit composition root, startup and registration coordinator. Screen renderers should consume scoped facts and actions. Avoid moving all coupling into another universal context or re-export module. Split bootstrap/composition only if it can preserve the established initialization/listener order.

These priorities may need several focused PRs. A graph reduction is useful, but it is not sufficient if callers still receive a broad undifferentiated interface.

## Improvements beyond the cycle count

### Keep dependency interfaces bounded

Core currently has 75 maintained-module dependencies in this graph and 49 create-prefixed factory calls with object interfaces (excluding init-prefixed constructors). The largest reviewed interfaces are:

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

After that, continue maintainability changes only where a concrete defect, feature, platform requirement or recurring development difficulty justifies them. Zero cycles does not require rewriting all 90 maintained modules or eliminating every legitimate cross-feature action.

## Outside this development work

City Windows/network-drive/Outlook/native-print, manual accessibility, staff and legal acceptance require their actual owners' evidence and confirmation. They may uncover fixes for development, but cannot be closed by these refactors or automated gates. Preparing a later release package is a separately authorized publication task.
