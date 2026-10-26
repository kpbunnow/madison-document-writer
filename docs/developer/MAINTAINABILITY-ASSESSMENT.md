# Remaining maintainability assessment

Snapshot: the device database/local-draft increment based on merged PR #69, main `f5fa0e407b0b467503864d74fca9b4b5376850e2`. This is a maintenance assessment, not a claim that all bugs are absent or a release approval. Counts describe this reviewed source layout; they are not quality/performance thresholds.

## What this increment completes

Device database connection/read/write access now has a two-input owner; draft snapshot/save/debounce/restore coordination has a ten-input owner. All seven original bodies retain their logic apart from dependency access, including required reads, transaction completion, isolated queued snapshots, stale/latest save decisions, backup timing and retained integrity/history restoration. Constructors are inert. Startup locks/readiness/sequencing, status UI, folder/shared-file writes, helper authority and recovery transactions stay in existing owners. case_files loses its direct issuance/history dependency. Writer still has a seven-module cycle and Reports remains acyclic. PNG/native acceptance status is unchanged (SCREEN-VISUAL-REVIEW.md).

## Main unfinished work: Writer dependency ownership

The graph still contains one seven-module Writer component. These are seven coupled owners, not seven identified bugs or a promise of seven more PRs. The modules have different responsibilities and should not simply be wrapped into ever-larger dependency objects.

| Owner | Source lines | Graph module dependencies | Dependencies inside this cycle | Main remaining concern |
| --- | ---: | ---: | ---: | --- |
| `app_core.js` | 1977 | 64 | 6 | Composition, state/bootstrap and feature dispatch remain centralized |
| `app_screens.js` | 1239 | 18 | 6 | Routing, shared dialogs/overlays and case-list rendering still depend on peers |
| `case_files.js` | 948 | 15 | 5 | Shared/pending case-file writes, startup sequencing and workspace actions remain coupled |
| `court_and_deposits.js` | 1094 | 15 | 4 | Money/charge checks, notifications, rendering and PDF/Outlook delivery share one owner; date/time parsing and inspection facts are independent |
| `draft_recovery.js` | 919 | 16 | 6 | Backup/restore UI, worksheet operations and workspace coordination remain coupled |
| `issuance_and_corrections.js` | 914 | 14 | 5 | Record actions/history, citation creation and saved-work UI remain coupled |
| `workspace_shell.js` | 666 | 17 | 4 | Workspace mutation/merge, storage adapters, helper requests and shell/print integration remain coupled |

Counts come from `node tools/module_graph.cjs` and maintained source line counts, including comments/blank lines. Generated/vendor modules are outside that graph. Module size alone is not a defect; responsibility mixing and dependency direction determine the next boundary.

## Recommended priority and scope

1. **Continue shared persistence and workspace separation.** Device IndexedDB and local draft persistence are now independent. Next inspect shared-folder/helper writes and pending-save coordination, then case merge/load/rollback capabilities rather than UI callbacks everywhere. Preserve startup restoration barriers, save-chain ordering, rollback, folder permissions, integrity verification and the frontend/helper projection contract. Keep native platform calls behind their established adapters.
2. **Review remaining record/history presentation and core/screen direction.** Shared confirmation, publication preparation/continuation and correction preparation/issuance are now independently composed. Keep core as an explicit composition root, startup and registration coordinator. Screen renderers should consume scoped facts and actions. Avoid moving all coupling into another universal context or re-export module. Split bootstrap/composition only if it can preserve the established initialization/listener order.

These priorities may need several focused PRs. A graph reduction is useful, but it is not sufficient if callers still receive a broad undifferentiated interface.

## Improvements beyond the cycle count

### Keep dependency interfaces bounded

Core currently has 64 maintained-module dependencies in this graph and 47 named factory calls with object interfaces. The largest reviewed interfaces are:

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

After that, continue maintainability changes only where a concrete defect, feature, platform requirement or recurring development difficulty justifies them. Zero cycles does not require rewriting all 85 maintained modules or eliminating every legitimate cross-feature action.

## Outside this development work

City Windows/network-drive/Outlook/native-print, manual accessibility, staff and legal acceptance require their actual owners' evidence and confirmation. They may uncover fixes for development, but cannot be closed by these refactors or automated gates. Preparing a later release package is a separately authorized publication task.
