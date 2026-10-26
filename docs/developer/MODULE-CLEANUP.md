# Broader module cleanup

Owner authorization: October 24, 2026, after PRs #43 and #44. This is a behavior-preserving module cleanup, separate from the screen-shell/CSS work in consolidation Phase 8, subsequently authorized on October 25, 2026 (see SCREEN-SHELL.md). Current release and format identities stay unchanged until separately assigned.

## First increment: shared foundations (merged in PR #46)

The first increment extracts shared declarations from app_core and the non-UI rules from new_documents. Callers import the actual owner directly; no compatibility barrel, universal registry, global getter table or duplicate rule implementation is introduced.

| Owner | Responsibility | Dependency direction |
| --- | --- | --- |
| document_types.js | Stable document/event IDs, metadata and approved wording references | Generated approved language and citation policy |
| document_rules.js | Explicit document/authoring predicates, item/date selection, restriction logic | Document metadata only |
| writer_queries.js | Current workspace lookups, frozen/correction source precedence, record-head queries | state, inspector data and document rules |
| presentation_format.js | HTML/selector escaping, fill-in markup and monetary text | No imports |
| record_values.js | Existing JSON snapshot copying and stable event ordering | No imports |
| calendar.js | Existing day arithmetic and time formatting helpers | Shared recordDay only |
| mailing_rules.js | Mailing facts, organization classification and state codes | No imports |

ESLint disallows direct DOM, browser-storage and network globals in these seven modules. These modules do not register listeners, initialize/restore workspace state, call the helper or render screens. Queries read WriterState at call time, so replacing arrays during restoration remains visible. eventsFor retains its established lazy per-case array creation; clearProhibitedCitations deliberately mutates only an eligible argument. They are not represented as immutable operations.

app_core retains service composition, state initialization and global listener/startup order. The schema consumer check now reads document_types, its new source owner, and still compares the same schema value against version.json. new_documents retains editing, authorization, context validation and UI actions.

The static module graph counts maintained top-level JavaScript imports/re-exports and literal dynamic imports, including the conditional test-fixture module; generated data/vendor modules are outside this graph. At the start there were 45 modules with cyclic components of 26 (Writer) and 5 (Reports). This increment has 52 modules, with components of 25 and 5: reviewed_library no longer depends on startup. More modules here means explicit ownership, not more runtime features.

`node tools/module_graph.cjs` prints the dependency inventory without evaluating the application. audit_module_boundaries checks the foundation import layers, keeps those layers outside UI cycles, caps the two retained cycles, exercises re-export/dynamic/self-cycle detection and loads the extracted public APIs without a DOM. It also checks live workspace replacement, frozen/correction precedence, referral identity and historical authoring cutoffs. Existing functional and print assertions remain authoritative.

## Second increment: feature-owned event handlers (merged in PR #47)

All 60 former core document/window listeners now have explicit feature registration methods. app_core keeps the calls at their original startup positions, including capture phases, state initialization, restoration and initial rendering. Its size falls from 3,049 to 1,249 lines. The maintained graph has 67 modules; Writer and Reports retain their 25- and 5-module cycle caps. New event owners stay outside those cycles.

| Event owner | Responsibility |
| --- | --- |
| workspace_events | Ordered workspace click routing, folders, case lists and Reports return |
| editor_events | Document fields/items, pointer/keyboard reordering, picker focus and editor commands |
| reinspection_events | Worksheet actions, item outcomes, walkthrough and visit fields |
| citation_events / due_date_events | Citation review fields and selected-item deadline assignment |
| import_events | Lookup confirmation/cancellation, inspection selection and workbook drops |
| catalog_events | Language review, searches, picker selection and catalog actions |
| correction_events / contact_events | Correction/record-action forms and recipient editing/sending |
| recovery_events | Working-form capture, backups, restoration, retries and unload saving |
| safety_events / workflow_events | Safety/lock tools and search/reminder/timeline/outbox tools |
| utility_events / special_document_events | Accessible utility/check links, focus/shortcuts and special-document delegates |

Feature factories import foundations, receive only their explicit service/peer interfaces, and do not read services or register listeners during construction. Core's forwarding functions and data getters defer lookup until use; later declarations are not captured before initialization. There is no exported universal service registry. The large click/input/change delegates keep their original condition order and local document snapshots, with cross-feature branch bodies delegated to their owners. Dispatch adds no await before file-permission or other synchronous user actions.

`event_registration.registerEventOnce` registers a stable feature key once per target. Repeat construction/registration does not replace an existing listener or duplicate it; a failed native registration can be retried. Feature registration remains explicit instead of being collected through a reflective startup loop.

`audit_event_registration` checks the baseline registration order, capture phases and state/startup checkpoints in feature_event_order.json. Callback bodies are not frozen. It also verifies inert/lazy construction, no imports back into UI/persistence adapters, duplicate/refused registration, first-match exclusivity, synchronous permission calls, capture confirmation stopping later bubble handlers, retained input focus/caret and default-prevented keyboard behavior. The existing full functional/browser/print checks remain authoritative.

## Third increment: record rules separated from UI/storage (merged in PR #48)

Four additional owners isolate record calculations:

| Owner | Responsibility |
| --- | --- |
| case_migrations.js | Existing deterministic legacy IDs and schema 1–4 migration |
| case_file_rules.js | Record shape/ID/correction-history checks, three-way case comparisons and filenames |
| case_projection.js | Event replay, continued-item facts, classification and summary derivation |
| record_sources.js | Frozen/correction case precedence and explicit snow-case fallback facts |

record_values additionally owns caseDetails/stableJSON; document_rules shares record-only correction eligibility and snow-case classification. The original classifier's one-argument API still uses the static bundled catalog; summaries supply the library explicitly. No compatibility barrel or copied rule implementations are added.

workspace_shell retains case/workspace mutation, restore/rollback, inspector adoption, verified loading, file/IndexedDB/helper I/O and the summarize adapter. summarize supplies roster/library/case data, build, cache time and integrity status to the pure calculation. Event and inspection dates remain record-derived. record_sources makes the same frozen/correction/live-fallback precedence explicit, and the continuingItems adapter keeps the existing live-visit default. Live referral restrictions remain in the correction adapter and still exclude its own source.

The browser migration stops at legacy schema 4 and returns schema-5 records unchanged; it never creates integrity, migration-registry or anchor evidence. Shape/history validation and projection are not trust decisions. The helper's independent projection and all verified loading/publication boundaries remain authoritative.

The graph now has 71 modules, with unchanged Writer/Reports cycle caps of 25 and 5. Import-layer tests and lint rules keep the new modules free of UI/storage/workspace imports and direct clock/randomness access. audit_record_rules checks standalone loading, repeatable migration IDs, unmodified inputs, frozen authoring data, corrected visits, continued items, typed comparisons and merge/history refusals. Existing generated/captured projection parity and all historical assertions remain in place.

## Fourth increment: scoped Writer service dependencies (merged in PR #49)

Six existing feature owners now import only foundations, static data and their retained transport where needed. app_core supplies their named UI/peer operations through lazy forwarding functions and service getters; no universal registry or compatibility barrel is introduced.

| Owner | Supplied operations |
| --- | --- |
| navigation | Saved navigation, capture, lookup cancellation, rendering and the later readiness promise |
| language_actions | Catalog actions, guarded navigation, rendering and overlay updates |
| citation_pricing | Inspection/pricing context, locks, reviewed language, snow preparation and notifications |
| deposit_step | Charge editing, deposit validation, saves, continuation and rendering |
| initial_citations | Initial citation preparation, review, pricing, frozen sources and editor refresh |
| snow_cases | Citation/date services, saves, helper requests, rendering and peer refresh |

The six factories stay at their original composition positions; languageClick is constructed immediately after navigation and remains registered at its original catalog-event checkpoint. Factories do not read supplied services during construction. Snow, pricing and deposit factories still register their existing nine listeners at initialization, in their original order and phases; this increment does not make their construction side-effect free or add repeat-registration guarantees. No await is added to synchronous dispatch.

The static Writer cycle drops from 25 to 19 modules; Reports remains 5. The guard is narrowed to 19/5 and explicitly restricts the six owners' imports. audit_writer_services loads all six without starting Writer, checks exact named lazy interfaces and initialization order, verifies the retained nine listener registrations, and exercises readiness, failed saves, stale navigation, edits during saving, language navigation and citation guards. The existing 60-listener registration test, historical print references and functional/browser assertions remain unchanged.

## Fifth increment: remaining feature-factory boundaries (merged in PR #50)

Administrator tools, address preview/acceptance and new-document actions now receive their UI/peer operations through explicit lazy interfaces composed by app_core. Their existing factories remain at the original initialization positions. Administrator and address factories retain their two original click listeners and do not read supplied services during construction.

The historical affected-item selection predicate moves inside the new-document factory, which supplies it to the existing renderer as newDocuments.rowAffectedSelection. Its condition/order is unchanged: authoring-13–15 dated extensions, excluding all-item formats, locked documents and corrections. The renderer no longer imports the feature module directly. Other new-document rules, status eligibility, scoped action wording, dates and publication orchestration remain unchanged.

The test-only fixture factory also receives explicit callbacks while staying behind __TEST_BUILD__. The browser layout harness supplies the same named callbacks to its privately injected fixture instance. It does not gain a production entry point. Browser storage, helper authorization, integrity decisions and publication remain in their established owners; the browser's administrator receipt checks do not independently authorize an override.

The Writer cycle drops from 19 to 15 modules; Reports stays 5. The import allowlists now cover nine production feature services and the test-only factory, and the cycle guard is narrowed to 15/5. audit_writer_feature_boundaries checks independent loading, exact lazy interfaces and composition order, test-only gating, retained click registrations, stale address previews, explicit acceptance, changed-receipt refusal, historical selection and live visit replacement. Existing service/registration tests and historical print assertions remain authoritative.

## Sixth increment: document renderer boundary (merged in PR #51)

createDocumentRenderer in document_render now receives named formatting, source/history, lock/editability, mailing and feature services from app_core. It imports only metadata, static data, formatting, mailing facts and citation policy; it has no UI orchestration, live query, DOM, storage or transport imports. Construction is inert and does not read supplied dependencies. Rendering still calls the same source/history/query adapters at render time; this refactor does not redefine their legacy fallback behavior or make every supplied adapter immutable.

Core composes the renderer after the existing feature-service initialization and before startup/event use. It exports the actual documentHTML/citationFaces instance functions, which their existing consumers now import from the composition owner. No forwarding barrel or universal registry is introduced. Three private diagnostic bindings (noticeHTML, citAmount and referralHistoryHTML) remain available to unchanged bundle-eval tests through the existing test-only __DW_TEST_REFERENCES hook; no new global hook or production fixture is added.

The seven renderer function bodies and authored markup are unchanged apart from dependency access. Historical formats, item histories, snow covers, retained deposits, all four distinct court copies, mandatory-appearance hold, fixed print construction and publication ownership remain intact. document_pagination still owns pagination and court_and_deposits still owns print-job orchestration.

The Writer cycle drops from 15 to 14 modules; Reports remains 5. Import/global guards keep the renderer outside the UI cycle and block direct browser storage/network/DOM and ambient clock/randomness access. audit_document_renderer checks independent loading and lazy composition, frozen input rendering, four distinct locked copies, deposit/mandatory-appearance refusals, draft service refresh and correction-day calculations. Existing property, source/history, functional, exact-print and browser checks remain authoritative.

## Seventh increment: scoped Writer view contexts (merged in PR #52)

app_view_contexts now exports three independent constructors: createSavedWorkContext, createWorkspaceQueueContext and createLanguageDiscoveryContext. Each receives only the UI operations/service values its view requires. Core composes the three builders after feature/renderer composition and before startup use, and exports their actual app_*Context instance functions. Consumers import those instances from core; no forwarding barrel or universal registry is added.

Factory construction is inert: it reads neither service getters nor workspace state, renders nothing and registers no listeners. Lazy getters preserve the actual callback/service identities. Each context call retains its existing field names/order, reads current WriterState references, and reads only that view's supplied dependencies. Previously created contexts retain their original reference values; callback queries still resolve current live arrays. This is the existing reference-snapshot behavior, not a new deep-copy contract.

The Writer cycle drops from 14 to 13 modules; Reports stays 5. The view-context owner imports only foundations/static library/state and remains outside UI cycles, with no direct DOM/storage/network access. audit_writer_view_contexts checks independent loading, exact per-view lazy composition, callback identities, retained field order, replaced workspace/cache/state/service references, saved-work text and integrity/shared-conflict queue priority. Existing saved-work, exit, language discovery, service, event, print and browser tests remain authoritative. Storage readiness, exit authorization and catalog decisions remain in their established owners.

## Eighth increment: pagination and feature ownership (merged in PR #53)

Physical layout is now isolated in createDocumentPagination in document_pagination. Its supplied interface contains only PAGE_PX, snow and hasItemInspectionHistory; foundations retain call-time document lookup and frozen case resolution. Construction is inert and reads no DOM, state or service values. Core composes the instance after other services/context builders and exports its actual paginate function. The original mutable function binding is retained for the unchanged disclosure audit. The existing private contHead diagnostic stays in the existing test-only reference hook; no new global hook is introduced.

The module no longer creates follow-up documents or manages editor/dialog UI. docFromReinspection belongs directly to reinspection, and refreshSheet/syncChip/refreshOverlay/enhanceDialog belong directly to editor_screens. Callers import the defining owner. The nine original function bodies are unchanged except for supplied layout dependencies, retaining synchronous actions, save ordering, focus restoration, inspection eligibility, history, page order, snow/table continuation and authoring-10 print allowance.

The Writer cycle drops from 13 to 12 modules; Reports remains 5. Import guards keep pagination outside the cycle and lint disallows direct storage/network and clock/randomness use. audit_document_pagination checks independent lazy construction, historical page limits, retained continuation order/footers, snow covers, mobile flow and default document lookup with a controlled height model. Real geometry, clipping, history continuations and court-copy content remain covered by the full Chromium/print suites; the model does not claim native layout acceptance.

## Ninth increment: document editor service (merged in PR #54)

editor_screens now exports createEditorScreens and imports only foundations, state, saved-work presentation and language-focus utilities. Core supplies named lazy UI/peer operations and exports the actual editor instance functions. Public bindings keep their existing mutability for the disclosure audit; no forwarding barrel or universal registry is added.

The editor is the first service constructed in core. Its one existing copy-click listener is still registered synchronously before the other feature-service listeners, with the same bubble phase. Construction reads no supplied service/state values, but requires a DOM registration target; it is not side-effect free and does not introduce idempotent construction. All original functions/listener bodies, markup, readiness ordering, move/new-document guards, sheet/overlay focus behavior and save scheduling are unchanged apart from dependency access.

Private readiness diagnostic bindings remain in the existing test-only reference hook. The production browser R42 harness reads editorScreens.editorReadiness through the composed service rather than relying on a former top-level private function; its assertions are unchanged. No new global hook or production fixture is introduced.

The Writer cycle drops from 12 to 11 modules; Reports stays 5. Import guards keep editor_screens outside the cycle and lint rejects direct storage/network access. audit_editor_service checks independent loading, exact lazy composition, first-service/one-listener registration, readiness ordering, synchronous four-copy toggles, focus retention, refresh/layout/check/save ordering, item movement and integrity/dialog guards. Existing editor flow, disclosure, event, historical print and browser tests remain authoritative.

## Tenth increment: Writer import-service boundary (merged in PR #56)

accela_import now exports createAccelaImport and imports only foundations, live queries/state, static inspector data and its existing authenticated transport. Core supplies the 28 named UI/peer operations and service/cache getters lazily. It constructs the import instance after address parsing and before document rendering, without moving any existing listener registration or startup/state checkpoint. Construction reads no supplied service or live state and registers no listeners.

The entire parser, eligibility table, review/acceptance and SQL/workbook paths remain together. All original declarations and function bodies retain their order and content apart from explicit dependency access. Stale selection/read guards, cancellation, duplicate/merge refusals, shared confirmation, save ordering, retained UI/dirty state, SQL query and stored identities are unchanged. Helper and persistence adapters retain validation and storage authority.

Core exports actual instance functions; there is no forwarding barrel or universal registry. Existing bundle-eval diagnostics retain their original bindings through the existing test-build reference hook. Four production browser suites read private import diagnostics through the composed service, without changing assertions or adding a production global hook.

The Writer cycle drops from 11 to 10 modules; Reports stays 5. The import allowlist keeps accela_import outside UI cycles and lint forbids direct browser storage/network globals; authenticated transport stays explicit. audit_import_service checks independent inert construction, exact lazy composition, live committed-cache replacement, stale/duplicate/refused shared reads, retained state, cancellation and SQL confirmation refusal. Existing full import, event, historical screen/print and production browser assertions remain authoritative.

## Eleventh increment: Reports dependency boundaries and visual review (merged in PR #57)

Reports services, screens and the presentation-context builder now have named lazy factory interfaces composed by reports_core. Construction performs no live-state/service reads and installs no listeners. Core retains the original Leaflet installation, initial report-action listener, accessibility initialization, deposit initialization and subsequent listener/startup order. Deposit schedule retains its three listeners and date/search/page state, receiving only render/escape operations.

The five-module Reports cycle is eliminated. Writer remains capped at ten modules; any Reports or unrelated cycle now fails the boundary guard. Original function bodies, report definitions, verified-summary handling, cancellation, maps, handoff, saved views and table/CSV/workbook/print order remain. Core exports actual mutable instance bindings; the render delegate retains existing test overrides. Private eval diagnostics use a scoped test loader, and the stale-load test mocks the transport instead of a copied closure-local function. Assertions, deadlines and frozen references remain unchanged.

The independent Reports suite checks inert construction, scoped interfaces, context identity/live references and deposit listener ordering. SCREEN-VISUAL-REVIEW.md records the technical PNG review; it does not supply City/native/staff acceptance or claim exact pixel parity.

## Twelfth increment: catalog and shared-case preflight boundary (merged in PR #58)

language_catalog now exports createLanguageCatalog and imports only foundation rules/values, live queries/state, build identity and saved-work presentation. Core supplies 25 named lazy adapters/getters and constructs the owner after address parsing and before the import service. No existing listener, service, restoration or startup checkpoint moves; construction reads neither supplied services nor live state and registers no listeners.

The original declarations and function bodies/order are unchanged apart from dependency access. Catalog read sequencing and acknowledgement guards, explicit wording adoption, frozen issued wording, shared-case comparisons, preflight continuation/context guards, conflict resolution, serialized workspace patches, durable-write-before-commit and failure cleanup remain. Helper/integrity/storage authority stays in existing adapters; browser preflight still defers final authority to publication.

Core exports actual mutable instance functions. Consumers use those instances; no forwarding barrel or universal registry is introduced. Existing private diagnostics stay in the existing test-build reference hook. The Writer cycle drops from ten to nine modules and its guard is narrowed; Reports remains acyclic. audit_catalog_service checks independent lazy construction, exact interface/composition order, stale/malformed refreshes, acknowledgement retention, durable patch serialization/failure cleanup, integrity refusal and offline preflight. Existing language/reconciliation, functional, event, security and historical output assertions remain authoritative.

## Thirteenth increment: reinspection service boundary (merged in PR #59)

reinspection now exports createReinspection and imports only foundations, live queries/state, static inspector data and citation policy. Core supplies 30 named lazy UI/peer operations, constructing it after address parsing and before catalog/import composition. Construction reads no live state or service values and registers no listeners; existing service, listener and startup checkpoints remain.

All original declarations and function bodies/order remain apart from dependency access. The owner retains live worksheet/walkthrough identity, carried/withdrawn-item refusals, outcome and later-edit-preserving undo, focus/save ordering, deadline/readiness checks, historical item observations and follow-up creation. Storage, pricing and publication authority remain with their existing owners. Core exports actual mutable instance functions; existing private diagnostics remain in the existing test-build reference hook.

The Writer cycle drops from nine to eight modules; Reports stays acyclic. The independent suite checks inert construction, exact named interface/order, live array replacement, outcome/undo refusals and save/render/focus sequencing. Existing R46's 256 outcome combinations, reconciliation and disclosure tests retain their assertions. MAINTAINABILITY-ASSESSMENT.md describes the remaining coupling and priorities; removing a graph edge alone does not complete maintainability work.

## Fourteenth increment: cohesive case activity responsibilities (merged in PR #60)

Personal reminders and the read-only event timeline move from case_timeline to case_activity. timelineCategory remains a pure direct export; createCaseActivity supplies the six other functions through six named lazy dependencies: date, case status, source document, formatting, navigation and accessibility. Core composes it after import services and before document rendering. Construction reads no services/state and registers no listeners. No existing startup or listener checkpoint moves.

The seven original function bodies and the remaining timeline declarations/order are unchanged except explicit dependency access. Reminder windows/IDs/dismissal, closed/missing-source exclusions, manual draft preparation, read-only event sorting/filtering, full-log preservation and HTML escaping remain. The current-date getter delegates to the existing live clock. Workflow events retain preference writes, CSV/full JSON exports and the requested email-draft helper call. No publication, outbox, handoff, deadline-editing or pricing authority moves.

case_timeline shrinks from 1,575 to 1,394 lines. The graph has 72 maintained modules, with the same eight-module Writer component and acyclic Reports. This increment improves cohesion/testability rather than pretending to eliminate another cycle member. Independent tests enforce the bounded interface, live date/state, reminder/escaping and read-only ordering contracts; existing workflow, event and historical assertions remain. The assessment now prioritizes shared inspection facts and the remaining timeline subfeatures.

## Fifteenth increment: shared inspection facts (merged in PR #61)

The existing validISO/parseDate/parseTime functions move from court_and_deposits to calendar. inspAt and inspectionIdentity/sameInspection/inspectionUsed move from court/timeline orchestration to inspection_facts. All seven bodies are unchanged. The new owner imports only calendar, document rules and live workspace queries; loading does not initialize Writer or access services/DOM/storage/network. Identity calculations remain pure, while date-source and reuse queries observe current workspace arrays without rewriting them.

Every consumer imports the actual defining owner, without re-exports through the old modules. Accela import directly consumes these seven facts, reducing its scoped UI/peer interface from 28 to 21 fields. Existing service construction, listeners, startup checkpoints and operation bodies remain; other service interfaces do not change. Frozen/correction precedence, explicit blank inspection dates, missing-time matching and reuse evidence after correction/withdrawal remain intact. Import eligibility and helper/publication authority stay in their existing owners.

case_timeline is now 1,360 lines and court_and_deposits 1,091. The graph has 73 maintained modules and the same eight-module Writer component; Reports stays acyclic. Independent behavior tests and restricted imports/globals enforce the facts boundary. This completes the shared-inspection-facts candidate; next inspect the bounded outbox/artifact-location responsibilities before further handoff or publication work.

## Sixteenth increment: retained PDF artifact responsibilities (merged in PR #62)

pdf_artifacts owns the outbox list/selection/retained-byte printing and artifact-location refresh through createPdfArtifacts, plus direct pdfTransferState/independentArtifact queries. Its five named lazy dependencies are navigation, accessibility, helper JSON, notifications and rendering. Core composes it after case activity and before document rendering; construction reads no services/state/browser objects and registers no listeners. Consumers use actual mutable composed operation bindings or direct query exports, without a forwarding barrel.

All six moved bodies and all remaining timeline declarations/order are preserved apart from explicit dependency access. Keep utility context, synchronous popup creation before awaits, captured name/hash selection, authenticated retained-byte reads, load/URL timers, refresh sequence/current identity guards, bounded batches and recursive invalid-identity isolation. Failed refreshes retain last-known locations with their warning status. workflow_events retains transfer/notification ordering; helper/file/publication authority does not move.

case_timeline shrinks from 1,360 to 1,178 lines. There are 74 maintained modules, the same eight-module Writer component and no Reports cycle; workspace_shell no longer imports case_timeline for artifact refresh. Independent tests cover the bounded interface and failure/race contracts alongside unchanged existing regressions. The assessment next prioritizes Writer/Reports handoff and the remaining deadline/citation actions, with publication/recovery and persistence coordination still separate work.

## Seventeenth increment: Writer handoff and readiness (merged in PR #63)

writer_handoff owns markWriterReady/markWriterFailed/writerOpenReportedCase/initWriterHandoff through createWriterHandoff. Core supplies only render, preflightCase, helperJSON, loadCaseFile, WRITER_READY_WAIT and HANDOFF_CHANNEL through named lazy adapters/getters. Construction reads no state/services/browser objects and opens no channel; core composes it after PDF artifacts and before document rendering and exports the actual mutable functions. There is no forwarding barrel or universal registry.

All four bodies, remaining timeline declarations/order and case_files functions are unchanged apart from explicit dependency access. Workspace Web Lock ownership, restoration order and initWriterHandoff/markWriterReady/markWriterFailed calls stay in case_files. Core retains readiness-promise/channel-name initialization. Preserve local preflight/reconciliation, post-wait restored-state lookup, latest shared-request checks, case-number/shape refusal, storage-versus-missing errors, accepted/result/return-ack messages and inactive/non-owning reply guards. The original initialization does not gain an idempotence promise or new authority over helper/file operations.

case_timeline shrinks from 1,178 to 1,073 lines and loses workspace_shell/app_screens imports; case_files loses its case_timeline import. There are 75 maintained modules and the same eight-module Writer component; Reports stays acyclic. Independent tests exercise readiness, local/shared failures/races and channel/URL behavior, alongside unchanged storage/navigation/startup workflows. Next inspect bulk/selected deadlines and workspace task presentation before the remaining citation and publication/recovery boundaries.

## Eighteenth increment: deadline planning and assignment (merged in PR #64)

deadline_assignment owns planBulkDue/showBulkDue/updateDueIndicators/duePanel/assignDue through createDeadlineAssignment, plus direct dueDateSpacingConflicts/dueSelectedText and live dueContext/activeDueTarget exports. Core supplies seven named lazy dependencies: MINDUE, structEditable, isLocked, fmtDate, navigation, A11Y and snow. Construction reads no services/state/DOM and registers no listeners; core composes it after Writer handoff and before document rendering and exports actual mutable operations. Consumers import direct queries from the defining owner, with no forwarding barrel.

All nine moved bodies and remaining timeline declarations/order are preserved apart from explicit dependency access. Keep current outstanding-item selection, notice/worksheet eligibility, intent/carried guards, minimum-date checks, three-date/seven-day limits, clone-only all-or-nothing batch planning, text/HTML and DOM indicator behavior. due_date_events retains action/undo/save sequencing; workflow_events retains durable patch-before-commit behavior. No new persistence or publication authority is introduced.

case_timeline shrinks from 1,073 to 856 lines and retains workspace tasks and citation/pricing operations. There are 76 maintained modules and the same eight-module Writer component; Reports stays acyclic. Independent tests cover atomicity, live contexts and guards alongside unchanged authoring/workflow/worksheet/usability assertions. Next inspect workspace task presentation, then citation editing/readiness before publication/recovery and persistence coordination.

## Nineteenth increment: workspace task presentation (merged in PR #65)

workspace_tasks owns read-only workspaceTasks through createWorkspaceTasks and three lazy inputs: date formatting, saved-import detection and deposit completion. Core composes it after deadline assignment and before document rendering and exports the actual mutable function; app_screens consumes that instance. Construction reads no services/state/DOM and registers no listeners. depositComplete remains unchanged in the citation owner and is exported for composition, avoiding copied readiness/pricing rules.

The task body and remaining timeline functions/order are unchanged apart from explicit dependency access. Preserve task group/count/list order, input row/status snapshots, live document/attempt/queue/artifact references, citation-included/superseded/void exclusions, stale/conflict warnings, historical label fallback and escaped action attributes. Task actions, record mutation, storage and publication remain in existing owners.

case_timeline shrinks from 856 to 738 lines and loses its issuance import; app_screens loses its timeline import. There are 77 maintained modules, the same eight-module Writer component and acyclic Reports. Independent tests exercise truthful read-only tasks and replacement state, alongside unchanged queue/usability/citation/browser assertions. Next inspect the remaining citation editing/readiness and item-selection boundary, followed by publication/recovery and persistence coordination.

## Twentieth increment: citation workflow and item-selection boundaries (merged in PR #66)

citation_workflow owns the seven citation/deposit/edit/check/review functions through createCitationWorkflow, with 16 named lazy pricing/authority/format/date inputs. item_selection separately owns toggleLibraryItem through snow and identity inputs. Core constructs both after deadline assignment and before workspace task presentation, exporting actual mutable functions; peer consumers import the composed instances. Construction reads no services/state/DOM and installs no listeners. No forwarding barrel or universal registry is introduced.

All eight original function bodies and the private scheduled-offense predicate retain their content/order within the two owners apart from explicit dependency access; messages and markup are unchanged. Preserve input/commit order, original correction prices, explicit ordinance/row selection, manual/scheduled/mandatory rules, pending/issued caller guards, current-day access, initial-citation behavior and private item wording/cache/IDs. Existing pricing, administration, deposit, event, persistence and publication owners retain authority.

The emptied case_timeline module is removed. There are 78 maintained modules; the Writer cyclic component narrows from eight to seven and the guard is reduced accordingly. Reports stays acyclic. Independent behavior/interface tests and literal-aware source comparison supplement unchanged historical/charge/deposit/browser suites. Next inspect publication/correction/recovery orchestration, then persistence/workspace coordination and remaining core/screen direction.

## Twenty-first increment: record save confirmation

record_commit.createRecordCommit owns the shared commitAmendment request/confirmation operation through 11 named lazy adapters: toast, saveDrafts, caseFile, COMMITTED, helperJSON, mergeCaseEvents, project, rememberSaved, idbSet, writeSummary and render. Core composes it after workspace task presentation and before document rendering, exporting the actual mutable function. Publication/correction/recovery callers use that instance. Construction performs no service/state/DOM reads or I/O and installs no listeners. The original function body is preserved apart from dependency access, including durable pending-save-before-request ordering, exact idempotency/group/correction events, definitive versus uncertain failures, later-edit preservation, projection/summary/pending cleanup and busy-state release. Helper validation, storage, projection, PDF receipts and publication eligibility retain their existing authority. This is an adapter boundary, not a pure calculation or a new transaction guarantee.

There are 79 maintained modules, the same seven-module Writer component and acyclic Reports. The isolated confirmation owner is intentionally a first step, not completion of publication/correction/recovery separation. issuance_and_corrections shrinks from 1,403 to 1,312 lines and loses its case-file-rules import; existing peers still share other responsibilities. Next separate publication preparation/continuation from recovery UI, followed by correction orchestration and persistence/workspace coordination. Preserve immutable receipts, helper validation, lost-response recovery, correction lineage and all existing event/save order before removing further cycle edges.

## Following increments

Continue through focused, separately reviewable changes:

1. Continue reducing the remaining 7-module Writer cycle through scoped service dependencies and lazy callbacks only where needed. Keep service composition explicit; never turn the former shared core into a new universal registry.
2. Keep Reports acyclic. Consider further decomposition or dead-name removal only where it improves ownership, preserving verified projection inputs, export/print ordering, diagnostic access and public exports.

Each increment updates the code map, source inventory, test index and this status. Narrow the graph guard as cycles are eliminated; never raise the cycle cap to accommodate accidental coupling. Existing filenames, stored keys/IDs, installed names and history remain compatibility contracts.

## Verification and merge

Run the complete gate on the final committed source and report actual regression/accessibility/print counts plus source/toolchain evidence in the PR. Preserve every historical assertion, frozen print reference, screen style and deadline. Keep measured browser work serial. Follow DEVELOPMENT-STANDARD.md's owner-approved free-plan merge policy; no automatic merge, release assignment, packaging or deployment is part of this increment. City/native/legal acceptance remains separate.
