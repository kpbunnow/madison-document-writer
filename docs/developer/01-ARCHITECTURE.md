# R63 current architecture

This describes the program as it stands. Release-by-release history is in CHANGELOG.md, the current and recent release reviews ([R62](R62-REVIEW.md), [R61](R61-REVIEW.md), [R60](R60-REVIEW.md) and [R59](R59-REVIEW.md) here, older ones in docs/history/) and docs/history/DOCUMENTATION-RELEASE-NARRATIVE.md.

## Runtime overview

Writer and Reports are browser applications served by a helper bound to 127.0.0.1. IndexedDB retains private drafts and pending operations; integrity-protected JSON and immutable PDF receipts live in configured operational folders. Reports is read-only against case history. The Reporting Index is a cache: the helper serves a summary only when it equals its projection of the verified case, and writes only summaries that do. No central service is introduced.

## Browser modules

Browser startup entries import their core wiring. Descriptively named modules export their real functions directly. state.js owns shared mutable Writer and Reports stores. Cohesive domain services keep private state; pure presentation functions receive explicit, scoped contexts. There is no bridge registry or universal runtime getter table. The proof service retains a small explicit dependency interface for isolated integrity tests.

Writer modules are organized by feature: accela_import.js holds the whole Accela import path, reinspection.js the worksheet and walkthrough, editor_screens.js the document editor, app_screens.js the screen dispatcher, shared modals and case list, and app_core.js service composition, state initialization and explicit feature-event registration. The *_events modules own listener bodies and cross-feature branch actions through scoped, lazy interfaces; event_registration prevents duplicate registration per target/key. Shared metadata/rules, live workspace queries, formatting, calendar and mailing facts have independent owners described in MODULE-CLEANUP.md. docs/developer/02-CODE-MAP.md lists every module's ownership.

Workspace owns the prominent import/shared-search entry area; import stays a guarded internal route. Reinspection deadline assignment reuses duePanel/assignDue and the existing draft result store, outside collapsed Inspection checks. Corrective-action placeholders use the shared accessible utility dialog with context validation. Citation editors can expand all four copies; final printJob remains a separate complete packet. A screen-only rule flows the editor's mailing address below an expanding header; printableHTML keeps the approved fixed envelope positioning.

Nine feature services (navigation, language actions, citation pricing, deposit completion, initial citations, snow cases, administrator tools, address parsing and new-document actions) receive their UI/peer dependencies from core through named lazy interfaces. They import no UI orchestration modules. Existing initialization/listener order and readiness/save guards remain; construction still registers the original snow/pricing/deposit listeners. The Writer cycle is capped at 8 modules and Reports has no module cycle; this is an incremental boundary reduction, not cycle elimination.

The test-only fixture factory uses explicit callbacks under its existing build flag. The renderer obtains the historical affected-item predicate through the composed new-document service; stored authoring cutoffs and selection rules are unchanged. Administrator/address constructors retain their original click listeners.

The document renderer is also composed through named lazy dependencies. document_render exports its constructor, and core exports the actual documentHTML/citationFaces instance functions. The renderer imports no UI orchestration or live workspace queries; source/history adapters and fallback semantics are unchanged. Fixed printable HTML, pagination and publication remain in their existing owners.

The three Writer view-context builders are independently constructed with per-view lazy UI dependencies. Each call reads current workspace references and preserves callback identities; existing contexts retain their reference snapshots. Core exports the actual instance builders, while saved-work, queue and language presentation retain their own behavior.

Physical pagination is independently composed through its page-size, snow and history services. Reinspection follow-up creation belongs to reinspection; sheet/overlay/dialog refresh belongs to editor_screens. Their existing operation order and the pagination algorithms remain unchanged.

The document editor is composed first through named lazy UI/peer services. Its original copy-click listener still registers before other feature-service listeners. Core exports the actual editor functions; editor_screens keeps readiness, rendering, refresh, focus and item/new-document actions together without importing UI orchestration.

The complete Accela import workflow is also composed through named lazy dependencies. Its constructor reads no UI/state/services and registers no listeners. Core constructs it after address parsing and before document rendering; callers use its actual instance functions. Parsing, eligibility, cancellation, shared-record merging and confirmation remain in accela_import, while helper/file/persistence authority remains in the supplied adapters.

## Inspection import

Shared date/time parsing belongs to calendar; inspection_facts owns inspection identity, document inspection-date selection and call-time reuse queries. It loads without Writer startup or UI dependencies, reads current workspace arrays through writer_queries and preserves the existing frozen/correction source precedence. It does not decide import eligibility or publication authority. Accela import consumes these facts directly, narrowing its lazy interface from 28 to 21 UI/peer adapters; the other service interfaces remain unchanged.

Import candidates come from the fixed SQL query or the division's SSRS workbook and pass through one type/status table (accela_import.js; rules in 03-DOMAIN-RULES.md). Status/type categories that are never importable are hidden at parse time; inspections already used on the case are hidden at plan time, after the shared record is merged, and the plan clears a selection that becomes hidden. Rule tables and case grouping read only their own entries.

## Documents and authoring versions

Every document records the authoring version it was written in, and publication and correction snapshots retain it, so reprints and corrections render the issued format. New documents use authoring 16 (version.json); new scoped orders keep authoring 13 because their layout is unchanged. Renderers for earlier versions remain and are selected by the stored version.

Best Interest and Vacancy Extensions share the regular Extension's layout and item table. At authoring 16 they derive special.affected from every uncorrected item (syncAffected) instead of a selection; Best Interest takes the worksheet's Next due date like a normal Extension, and Vacancy prints no due date for uncorrected items, keeping source deadlines in originalDues. Neither has a signer block.

Referrals, referral updates and compliance letters retain item-specific inspection observations in each item's hist field. Lineage follows source-document/item IDs, excludes carried findings and unrelated visits, and includes the current worksheet. The display computes civil calendar days from first observation to correction, or to the latest recorded observation while outstanding; missing or inconsistent dates display Unavailable. Long histories paginate into labeled continuation rows with each observation and note retained. Corrections patch retained visit observations, and issued reprints never query later live case history. Compliance history is a presentation capability, not referral status. At authoring 16 notes render under the violation (historyNotesHTML) and pagination continues them like history rows.

The helper mirrors the extension rules (extension_format) and, on a referred case, refuses new documents other than Update for Case Referral and Compliance Letter; corrections of earlier documents remain possible. The Writer applies the same rule through isReferredCase. Case schema 5, summary 6 and backup 2 are current.

### Historical formats

| Authoring version | Renderer kept for |
| --- | --- |
| 11 and earlier | Narrative Best Interest and Vacancy Extensions and their corrections |
| 12 | Best Interest and Vacancy on the regular Extension layout; conditional Vacancy labels are presentation only and never replace stored repair dates |
| 13 | Dated Best Interest and Vacancy (every affected item has a later due date); current for new scoped orders |
| 14 | Referrals with item-specific history and Days Outstanding |
| 15 | Referral/compliance history with notes in the history column; Best Interest with Reasons, explicit safety confirmation and no signer |

The regular Extension output is unchanged at every authoring version.

## Startup and workspace restoration

Workspace lock ownership is separate from restoration readiness. While persistent workspace data is being restored, Writer shows a startup screen and does not expose editable routes. saveDrafts refuses storage replacement until retained drafts are read; internal held-write recovery can save only after that read. A failed required storage read shows a reload/retry screen and leaves user saves blocked. Reports handoffs and queued navigation stop on failure. No private draft is treated as absent merely because its IndexedDB read failed.

writer_handoff owns the ready/failed markers and Reports case-opening/channel/URL operations through six lazy inputs: render, preflightCase, helperJSON, loadCaseFile, WRITER_READY_WAIT and HANDOFF_CHANNEL. Core composes it after PDF artifacts and before document rendering, exporting the actual mutable operations. Construction reads no services/state/browser objects and opens no channel. case_files retains workspace locking, restoration and the original init/settle order; core retains readiness-promise and channel-name initialization. Local preflight/reconciliation, latest shared request checks, file-shape/number refusal and channel reply ownership remain unchanged. Helper validation and file loading keep their existing authority.

## Record rules and adapters

case_migrations, case_file_rules, case_projection and record_sources contain record calculations without UI, storage, live workspace or clock dependencies. They retain deterministic legacy event identities, schema-4 browser migration, correction-history checks, frozen/correction source precedence, replay ordering and item carry-forward. Browser legacy migration does not create schema-5 integrity evidence; the helper retains that authority.

workspace_shell keeps live-state mutation, load/rollback orchestration, integrity verification, helper/file/IndexedDB access and the summarize adapter. The adapter supplies current inspector/library/case facts, build, cache write time and integrity status explicitly to summarizeRecord. Summary data shape and the independent helper projection remain unchanged. Classification keeps its existing bundled-catalog default for direct callers; the summary calculation supplies its catalog explicitly. new_documents retains the live reinspection default through a thin continuingItems adapter. Pure correction type eligibility is shared with history validation; live correction restrictions still exclude the source document when checking earlier referrals.

## Helper storage, integrity and recovery

The helper owns case merge/validate/write under per-case locks and conservative pricing serialization. Migration publishes durable intent before a case and registry replacement. Recovery completes only a matching prior/planned revision and retains quarantined bytes. A request-scoped verification context checks event/record chains, migration evidence and protected anchors; it is never a cross-request trust cache. Read-only Reports overlaps at most four file reads in batches of sixteen, with trust decisions on the consuming thread.

## PDF receipts and filing

PDF receipts bind case/document/frozen-version identity, print-source hash and exact original bytes. Shared coordination precedes producing a new original. Retried filing retrieves the retained bytes; filenames alone do not establish identity. Outbox transfers verify exact bytes and refuse conflicts. Transfer, direct filing and rendering reach a filing folder only through one per-name lock and a publication that never replaces an existing name.

pdf_artifacts owns outbox presentation/selection, opening retained original bytes for printing, artifact-location refresh and the direct status/independence queries. Its factory has five lazy UI/helper dependencies and reads no state/services or browser objects during construction. Core composes it after case activity and before document rendering and exports actual mutable operation bindings. Popup creation still precedes the first await; retained name/hash selections, utility context, refresh sequence, current artifact identity and partial-failure guards are unchanged. workflow_events retains transfer actions; the helper retains original-byte validation and file authority. This bounded extraction leaves the eight-module Writer component in place.

## Sessions, routes and content security

Every non-static helper request requires a random per-start token, with constant-time comparison and existing Host, Origin, fetch-site and JSON guards. helper/server.py lists every API route in GET_ROUTES and POST_ROUTES; do_GET and do_POST apply the token, Host, Origin and fetch-site checks, and for every POST the JSON check, before calling a route's handler, and the session test iterates both tables. A private user-profile bootstrap hands the token to the browser through a fragment that is removed immediately. Public pages disclose no secret. A browser-profile bootstrap credential scoped to the loopback origin and port permits authorized reload after helper restart. Public readiness reveals version and readiness only.

Application CSP authenticates the inline bootstrap and bundle by SHA-256, restricts connections to self and the Reports City GIS origin, and forbids objects, framing by other pages and base overrides. Rendering validates embedded-only resources, inserts a restrictive first-head policy and blocks network resolution in a fresh per-render profile.

## Installation, launch and shutdown

The installed layout stays flat under LOCALAPPDATA/MadisonDocWriter. Integrity has no signing key: the installed launcher checks the share against runtime-manifest.json, staging every listed file and rechecking its size and SHA-256; it rejects additions, omissions, symlinks, changes and downgrades (helperBuild and helper version). Run from the share, launch.py first removes its own folder from the import path and hands off to the installed launcher. Deliberate tampering is guarded by NTFS permissions on the deployment folder (release owner write, inspectors read), which IT verifies before rollout.

The desktop icon runs the installed launch.py with the same installation's pythonw.exe: it applies an approved update, starts server.py hidden and detached (or reuses a running helper of the same version), waits for /dw-status, opens Writer in a Chrome/Edge app window in the existing profile and exits; failures are shown in a Windows dialog and logged to logs/launcher.log. Start Document Writer.bat remains the console diagnostic launcher, where the helper runs in the console.

Exit Document Writer (Tools & settings) is the only stop path: an authenticated POST /helper/shutdown in POST_ROUTES that refuses with readable reasons (409) while the helper runs another POST, holds a file_lock or finds install-transaction.json, otherwise answers and ends serve_forever so the process exits; a client force flag never bypasses it. The launcher never stops a running helper, closing a window never stops it, and open Writer and Reports windows learn of the stop through a BroadcastChannel. DESKTOP-LAUNCH.md describes the process model, logging and shutdown.

## Source layout and build

The maintained layout is the only source tree. Tools resolve source assets directly and generate derived modules and identity under build/. The deploy manifest resolves maintained paths to stable installed filenames. The trusted installed launcher authenticates the candidate share using installed verification code and the candidate file manifest, with deployment-folder permissions protecting against deliberate replacement; the shared bootstrap performs only a standard-library handoff when a verified installation exists.

## Current screen-shell reference

Owner-authorized Phase 8 uses a complete current shell reference instead of reversing historical release-specific CSS additions. Its provenance and CSS decision record are separate from frozen print/document references. Runtime observations and before/after computed-style, geometry and pixel comparison supplement the full browser/print gate; SCREEN-SHELL.md describes the contract. Screen cleanup does not change the remaining module-cleanup roadmap or grant rollout/native acceptance.

## Reports composition

reports_core composes independently loadable Reports service, screen and presentation-context factories through named lazy getters. They import no Reports core or peer UI modules and do not access services/state or register listeners during construction. The original Leaflet installation, initial report-action listener, accessibility initialization and deposit-schedule listener order remain. The deposit explorer receives only render/escape adapters at its original initialization site.

The former five-module Reports cycle is eliminated; the retained Writer cycle is capped at eight modules. Verified summary acceptance, model construction, stale-load cancellation, table/CSV/workbook/print ordering, saved views, mapping and Writer handoff remain unchanged. Core exports actual instance functions with their existing mutable diagnostic behavior. Eval-based test loaders obtain existing private diagnostics from the composed owners; production browser checks read those owners directly.

## Catalog and shared-case preflight composition

language_catalog exports createLanguageCatalog and imports only foundations, live queries/state, build identity and saved-work presentation. Core constructs it after address parsing and before import composition through 25 named lazy adapters/getters. Construction reads no services or state and registers no listeners. Review refresh sequencing, explicit wording adoption, case preflight/comparison, conflict resolution and durable workspace patches retain their original bodies and order. Existing storage/helper/integrity owners retain authority. Core exports actual mutable instance functions and preserves private audit bindings through the existing test-build reference hook. The Writer cycle is now capped at eight modules; Reports remains acyclic.

## Reinspection composition

reinspection exports createReinspection and imports foundations, live queries/state, static inspector metadata and citation policy. Core supplies 30 named lazy UI/peer adapters and composes it after address parsing and before catalog/import services. Construction reads no services/state and installs no listeners. Walkthrough identity, current worksheet lookups, outcome/undo, focus/save order, deadline checks, historical item histories and follow-up creation retain their original bodies. Core exports actual mutable instance functions; private diagnostic bindings remain in the existing test-build hook. Writer is capped at eight cyclic modules; Reports stays acyclic. See MAINTAINABILITY-ASSESSMENT.md for remaining work and stopping criteria.

## Case activity composition

case_activity owns personal reminder rows/panels/draft preparation and the read-only case timeline. createCaseActivity receives only six lazy inputs: current date, case status, source-document lookup, date formatting, navigation and accessibility utilities. It imports only foundations/live queries/state and performs no direct DOM, storage or network access. timelineCategory is a pure direct export. Core composes the owner after import services and before document rendering, exports actual instance functions and preserves the private reminder diagnostic in the existing test-build hook.

All seven moved function bodies remain apart from explicit dependency access; current-date access now uses the supplied getter backed by the existing live global clock. The original workflow handlers still own preference writes, filtered CSV/full JSON exports and opening a requested Outlook draft. No automatic email/send behavior is added. PDF artifacts, Writer handoff, deadline assignment and workspace tasks subsequently gained separate owners; case_timeline retains citation/pricing and item-selection responsibilities. The static Writer cycle remains eight modules; Reports remains acyclic.

## Deadline assignment composition

deadline_assignment directly exports spacing/selected-text helpers and live dueContext/activeDueTarget queries. createDeadlineAssignment owns planBulkDue, showBulkDue, updateDueIndicators, duePanel and assignDue through seven lazy inputs: MINDUE, structEditable, isLocked, fmtDate, navigation, A11Y and snow. Core composes it after Writer handoff and before document rendering, exporting actual mutable operation bindings. Construction reads no services/state/DOM and registers no listeners. Existing notice/worksheet selection, three-date/seven-day limits, all-or-nothing batch clones and markup remain unchanged. due_date_events retains action/undo/save order; workflow_events retains durable patch-before-commit behavior. Helper/publication authority does not move.

## Workspace task composition

workspace_tasks owns read-only task generation through three lazy inputs: fmtDate, hasSetupWork and the unchanged depositComplete calculation from the citation owner. Core composes it after deadline assignment and before document rendering, exporting the actual mutable workspaceTasks function. Construction reads no services/state/DOM and registers no listeners. Task order, counts, escaped action attributes, input-row/status snapshots and call-time document/queue/artifact references retain their original behavior. Case/task actions, deposit/pricing validation, storage and publication remain in their existing owners.
