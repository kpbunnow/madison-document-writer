# Remaining maintainability assessment

Snapshot: Writer utility separation based on merged PR #83, main `de5cbad9328c584ce3987560c79f4b219381b5d9`. This is a maintenance assessment, not a claim that all bugs are absent or release approval. Counts describe this reviewed source layout, not quality/performance thresholds.

## What this increment completes

The remaining six court/deposit utilities now have defining owners: date/time display in presentation_format, owner parsing in mailing_rules, rnd12 in record_ids and allItems in catalog_queries. All six function bodies remain unchanged. The emptied court_and_deposits module is removed; no forwarding barrel or factory was introduced. Existing random/fallback/error and catalog shallow-copy semantics remain. Writer still has four cyclic modules and Reports is acyclic. Print/native/PNG acceptance remains unchanged (SCREEN-VISUAL-REVIEW.md).

## Main unfinished work: Writer dependency ownership

The graph still contains one four-module Writer component. These are four coupled owners, not four identified bugs or a promise of four more PRs. The modules have different responsibilities and should not simply be wrapped into ever-larger dependency objects.

| Owner | Source lines | Graph module dependencies | Dependencies inside this cycle | Main remaining concern |
| --- | ---: | ---: | ---: | --- |
| `app_core.js` | 2296 | 90 | 3 | Composition, state/bootstrap and feature dispatch remain centralized |
| `app_screens.js` | 1245 | 17 | 3 | Routing, shared dialogs/overlays and case-list rendering still depend on peers |
| `case_files.js` | 648 | 13 | 3 | Summaries, folder/address/workspace UI and startup sequencing remain coupled |
| `workspace_shell.js` | 470 | 12 | 2 | Shell/print/storage UI, folder connections, event append and helper transport remain coupled |

Counts come from `node tools/module_graph.cjs` and maintained source line counts, including comments/blank lines. Generated/vendor modules are outside that graph. Module size alone is not a defect; responsibility mixing and dependency direction determine the next boundary.

## Recommended priority and scope

1. **Separate shell and case-file responsibilities.** Inspect folder/permission, address/recipient and save-status UI before startup coordination. Preserve permission prompts, guard timing, save behavior and live workspace lookups. Existing loading/storage/projection/helper owners keep authority.
2. **Review core/screen direction.** Screen routing, shared dialogs/overlays and case-list rendering still couple peers. Keep core as explicit composition/startup/registration coordinator, use scoped facts/actions and preserve initialization/listener order. Avoid universal contexts or forwarding barrels; split bootstrap only when behavior can be verified.

The 14-input readiness and 20-input delivery interfaces remain explicit; split only if responsibilities and evidence warrant another cohesive boundary.

These priorities may need several focused PRs. A graph reduction is useful, but it is not sufficient if callers still receive a broad undifferentiated interface.

## Improvements beyond the cycle count

### Keep dependency interfaces bounded

Core currently has 90 maintained-module dependencies in this graph and 62 create-prefixed factory calls with object interfaces (excluding init-prefixed constructors). The largest reviewed interfaces are:

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
