# Broader module cleanup

Owner authorization: October 24, 2026, after PRs #43 and #44. This is a behavior-preserving module cleanup, separate from the still-deferred screen-shell/CSS baseline work in consolidation Phase 8. Current release and format identities stay unchanged until separately assigned.

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

## Fourth increment: scoped Writer service dependencies

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

## Following increments

Continue through focused, separately reviewable changes:

1. Continue reducing the remaining 19-module Writer cycle through scoped service dependencies and lazy callbacks only where needed. Keep service composition explicit; never turn the former shared core into a new universal registry.
2. Address the Reports cycle independently, preserving verified projection inputs and table/export/print ordering. Remove proven-dead names only after checking test-build eval access and public exports.

Each increment updates the code map, source inventory, test index and this status. Narrow the graph guard as cycles are eliminated; never raise the cycle cap to accommodate accidental coupling. Existing filenames, stored keys/IDs, installed names and history remain compatibility contracts.

## Verification and merge

Run the complete gate on the final committed source and report actual regression/accessibility/print counts plus source/toolchain evidence in the PR. Preserve every historical assertion, frozen print reference, screen style and deadline. Keep measured browser work serial. Follow DEVELOPMENT-STANDARD.md's owner-approved free-plan merge policy; no automatic merge, release assignment, packaging or deployment is part of this increment. City/native/legal acceptance remains separate.
