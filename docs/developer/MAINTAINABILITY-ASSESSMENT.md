# Architecture cleanup completion audit

Snapshot: screen dependency direction following PR #92 and the verification-policy update. This records the planned cleanup's stopping criteria; it is not release, native acceptance or a claim that every bug is absent. The final screen-dependency PR's current-head GitHub Full gate supplies final verification evidence.

## Dependency direction and ownership

The maintained browser graph contains 129 modules and no cyclic component in either Writer or Reports. `audit_module_boundaries.js` now rejects every cycle and restricts imports for 16 foundation modules and 83 scoped owners. Generated/vendor modules are outside this graph. Source inventory, code map and test index retain ordinary direct imports; there is no replacement universal registry or forwarding barrel.

Core remains the explicit composition/state/startup/registration root. The screen split removes its final import cycle: app_screens receives only readiness, routing, native focus and enhancement operations; Workspace presentation, live case status, citation history, language adapters and overlays have separate owners. Domain services, helper validation, record integrity, persistence and publication keep authority. Pure facts and live state operations remain explicitly distinguished.

| Owner | Source lines | Direct graph imports | Responsibility retained |
| --- | ---: | ---: | --- |
| app_core.js | 2581 | 112 | Explicit composition, state/bootstrap and registration order |
| app_screens.js | 244 | 5 | Startup/refusal barriers and ordered repaint/focus restoration |
| workspace_screen.js | 376 | 10 | Workspace list, issuance reveal/filter relaxation and row focus |
| screen_overlays.js | 458 | 7 | Shared modal/picker dispatch and presentation |
| workspace_shell.js | 44 | 3 | Screen frame and connection banner |

Counts include comments/blank lines and describe the audited layout, not quality thresholds. Reproduce the dependency graph with `node tools/module_graph.cjs`.

## Interface breadth review

Core has 92 imported constructor calls with explicit object inputs (82 create-prefixed and 10 init-prefixed, including conditional test fixtures). No constructor input spreads the entire core or state. The largest interfaces were reviewed by responsibility and actual property use:

| Constructor | Named inputs | Review decision |
| --- | ---: | --- |
| createEditorEvents | 38 | Retain ordered editor field/item/picker/command routing; independent event tests cover first-match and synchronous dispatch |
| createWorkspaceEvents | 36 | Retain ordered workspace/folder/Reports actions; cross-feature actions delegate to their owners |
| createEditorScreens | 32 | Retain coherent document readiness/render/refresh actions and original listener position |
| createReinspection / createRecoveryEvents | 30 each | Retain worksheet/walkthrough coordination and recovery event routing; effects remain delegated |
| createLanguageCatalog | 25 | Retain review/preflight and guarded tools; helper/storage/integrity authority stays supplied |
| createAppScreens | 24 | Retain one repaint transaction: route, native focus/disclosures, readiness and ordered enhancements |
| createDocumentRenderer / createReinspectionEvents | 23 each | Retain frozen render facts and feature-specific dispatch |
| createSafetyEvents | 22 | Retain feature-specific safety/lock routing through explicit adapters |
| initNewDocuments / createAccelaImport / createWorkflowEvents | 21 each | Retain feature ownership and established creation/import/workflow ordering |
| createDocumentDelivery | 20 | Retain archive/email/filing coordination through existing receipt/helper/native owners |

All named inputs in these reviewed interfaces are consumed. Field count alone does not justify splitting a coherent transaction or hiding names inside a broad callback bag. Keep call-time getters where initialization or restoration replaces values. Future narrowing should address an identified responsibility, defect or recurring development difficulty, with targeted behavior evidence.

The new case-status/citation-history/Workspace/language/overlay/repaint factories use 3/1/9/1/16/24 inputs. Independent construction tests verify no reads, I/O or registration at construction; focused tests exercise live replacements and operation order. The proof service retains its existing explicit store adapter; test-only reference hooks are not runtime service registries.

## Startup and failure-order review

Core still constructs the original editor and feature listeners at their documented positions, initializes state explicitly, constructs/invokes writer_startup at the original checkpoint and registers the remaining listeners in their original order. `audit_event_registration.js` verifies all 60 feature registrations and capture phases; `audit_writer_startup.js` verifies lock lifetime, restoration/readiness and failure sequencing. The screen split preserves all twelve original function bodies apart from scoped access, including stopped/locked/restoring/failed barriers, current workspace/day reads, modal priority, paint/enhancement order and focus/caret/disclosure/scroll restoration.

A separate bootstrap rewrite is not required to finish this roadmap: startup already has an independent owner, its wiring is explicit and tested, and further movement without a concrete problem would add review risk. Keep existing helper, permission, durable-write, held-publication and immutable-PDF authority unchanged.

## Completion and validation

The planned architecture refactor is complete once the current-head GitHub Full gate passes for the final screen-dependency PR. Writer/Reports are acyclic, major feature owners have independent scoped construction tests, broad interfaces and startup clarity have been reviewed, and current ownership/roadmap/testing guidance is reconciled. Historical intermediate descriptions in architecture and cleanup records remain provenance; the latest ownership sections and code map describe the completed layout.

Use targeted local checks before development PR submission and require GitHub Full gate and PR format on the current head before merge. Automatic main verification may continue asynchronously; report pending status/run links and investigate failures when reported. Preserve historical assertions, frozen print/screen references, source inventory and source-bound evidence. Packaging still requires an assigned release and exact-source full-gate evidence.

After this stopping point, make further maintainability changes only for a concrete defect, feature, platform requirement or recurring development difficulty. Zero cycles does not require decomposing every large module or eliminating legitimate cross-feature actions.

## Outside this refactor

R63/helper build 64 and independently versioned formats stay unchanged. City Windows/network-drive/Outlook/native printing, manual accessibility, staff/legal and exact PNG-parity acceptance retain their existing holds and need their actual owners' evidence. No release assignment, packaging, deployment or acceptance approval is part of this development work.
