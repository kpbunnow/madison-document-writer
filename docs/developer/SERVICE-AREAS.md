# Writer service areas

`app/modules/app_core.js` is the Writer's single composition root. Its 98 service owners are grouped into labelled sections (`/* ===== Service area: … ===== */`) in their original construction order, and the small base helpers that every area uses live in `app/modules/app_base.js`.

## Why one composition root

Maintainability item 2 measured the owners' lazy dependencies before choosing a layout. Every area reaches into four to seven others, in both directions. The heaviest pairs are Event owners → Case work (98) and Feature owners → Documents and history (31). Many of these references point at owners that are constructed later. `audit_scoped_architecture.js` forbids module cycles. Moving each area into its own module would therefore require an injected interface for every area. That would re-declare roughly 600 dependencies a second time and change the structural contract that about 45 suites check. On the owner's decision of 2026-11-13, the areas stay in one root, grouped and measured instead of physically split.

## Areas

| Area | Owners | Examples | Outgoing cross-area references | Incoming |
| --- | --- | --- | --- | --- |
| Feature owners | 12 | `editorScreens`, `snow`, `administration`, `libraryReview`, … | 96 | 90 |
| Screens and shell | 15 | `helperRequests`, `caseSummaryAdapter`, `workspaceShell`, `browserPrinting`, … | 55 | 91 |
| Case work | 17 | `folderConnections`, `caseFolderWorkflow`, `localCaseFiles`, `draftSaveControls`, … | 115 | 171 |
| Records, publication and correction | 5 | `recordCommit`, `publicationPreparation`, `publicationWorkflow`, `correctionPreparation`, … | 32 | 19 |
| Storage and recovery | 10 | `workspaceDatabase`, `draftPersistence`, `sharedCaseStorage`, `pendingCaseSaves`, … | 50 | 76 |
| Documents and history | 21 | `recoveryUI`, `catalogForms`, `recordHistory`, `inspectionHistory`, … | 79 | 118 |
| Event owners | 16 | `utilityEvents`, `recoveryEvents`, `catalogEvents`, `safetyEvents`, … | 232 | 2 |
| Core wiring and startup | 2 | `A11Y`, `writerStartup` | 12 | 69 |
| base (`app_base.js`) | — | `uid`, `MINDUE`, `FS_OK`, `IDB_OK`, `CASEDIR_EXPECT`, `storageMode`, `COMMITTED` | 0 | 35 |


The Core wiring and startup section also holds the listener registrations, test seams and startup that run after every owner exists.

## Rules

- **New owners.** Construct a new owner inside the section for its area, after that area's existing owners. Construction order is behavior: listeners register in this order.
- **New dependencies.** Prefer a dependency on an owner in the same area, a shared module, or `app_base.js`. A base helper may import shared modules and state boundaries only. It never calls a service owner.
- **Coupling ratchet.** `tests/unit/audit_service_areas.js` recomputes the cross-area reference counts with `tools/service_areas.cjs`.
  - It fails when any area pair grows, when a new pair appears, or when an owner sits outside a section.
  - It also fails when an improvement is not recorded. In that case, lower `tools/service-areas.json` to the measured value (`node tools/service_areas.cjs` prints it).
- **Changing the map.** Adding, renaming or reordering an area needs review: update the section header and the baseline together.
