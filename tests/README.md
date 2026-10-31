# Test index

`tools/run_tests.py` runs every `tests/unit/audit_*.js`, `audit_*.py` and
`tests/fixtures/tagcheck.js`; `tests/browser/audit_browser.js` runs the production
Chromium workflow and the browser suites listed in its `browserSuites` table. See
`docs/developer/05-TESTING.md` for the gate.

Suites are listed by the feature they cover. Most are named after the release that
introduced them. `audit_feature_*.js` suites group scenarios by feature: each scenario
runs in its own process with a fresh bundle, DOM, state, storage and mocks
(`tests/fixtures/scenarios.cjs`), and its label names the suite it came from (see
"Former suite names"). A suite that spans several features and has not been split
appears under "Release-wide regressions". Add a new scenario to the feature suite it
covers, or a new suite under its feature.

## Maintainability

| Suite | Covers |
| --- | --- |
| `audit_citation_review_templates.js` | 4,096 complete retained citation review cards with exact state, peer reads, ordered effects and interruptions |
| `audit_deposit_form_templates.js` | 4,096 complete retained deposit form HTML, state and callback/error comparisons |
| `audit_recipient_lines.js` | 8,192 retained recipient-line output, access-order and error comparisons; public address formatter ownership |
| `audit_writer_followup_templates.js` | Compares 2,048 retained/current chooser outputs, state changes and worksheet-fault callbacks, including status rules, saved choices, refusal and interrupted effects. |
| `audit_writer_frame_templates.js` | Compares 512 complete frame outputs and ordered lazy adapter calls/failures against the retained frame owner, including hostile scalars, missing body, storage warnings and owned fragments. |
| `audit_writer_details_templates.js` | Compares 4,096 complete retained/current special-document forms across historical authoring versions, correction/lock states, nuisance variants, occupancy release, imported/administrative choices, affected items and interrupted adapter calls. |
| `audit_writer_overlay_templates.js` | Compares 3,072 complete overlays, live state and ordered adapter failures against the retained owner, including recipients, send, removal, storage, folder, final/correction and delegated modal priority. |
| `audit_document_action_templates.js` | 1,536 retained case/action/service comparisons with branch non-vacuity guards |
| `audit_report_presentation_templates.js` | 2,048 retained shared-presentation comparisons and defensive attribute encoding |
| `audit_report_workbook_definitions.js` | Exact CRC/style definitions and 12,072 retained scalar/date comparisons |
| `audit_report_filter_events.js` | 1,680 retained filter changes, listener checkpoint and lazy input guards |
| `audit_accessibility_enhance_rules.js` | 172 retained native DOM comparisons plus complete accessibility and Reports workflows |
| `audit_language_presentation_rules.js` | 1,596 retained full-screen comparisons plus existing focus and catalog workflows |
| `audit_saved_work_focus_rules.js` | 364 retained asynchronous DOM cases plus existing saved-work and preflight regressions |
| `audit_snow_prepare_rules.js` | 1,824 retained preparations plus existing listener, snow and SQL import regressions |
| `audit_check_focus_rules.js` | 700 retained DOM/state/timer comparisons plus existing worksheet and outcome checks |
| `audit_reinspection_outcome_rules.js` | 4,032 retained outcome/undo comparisons with real live records, focus and interrupted effects |
| `audit_check_target_rules.js` | 4,075 retained target comparisons plus existing public owner and frozen screen checks |
| `report_output.cjs` | Exact complete output parity across eleven reports; five metadata and thirteen projection Python checks |
| `audit_report_navigation.js` | 5,100 retained click comparisons and unchanged complete Reports, R48 and mismatch suites |
| `audit_report_facts.js` | Source-body parity, scoped live filters, date and number facts, metadata and typed cells. |
| `audit_report_return.js` | 389 original-return comparisons, 13 unchanged calculation ASTs and 2,750 real-model catalog comparisons |
| `audit_report_catalog.js` | 11 inert definitions and 2,750 original-catalog comparisons using actual model/history services |
| `audit_shared_preflight_rules.js` | 168 asynchronous retained-source scenarios for preflight and shared replacement |
| `audit_shared_comparison_rules.js` | 5,000 retained-source field/history/checkpoint comparisons |
| `audit_shared_comparison_parity.js` | Unchanged catalog public-owner comparisons against original and maintained source |
| `audit_integrity_classification_rules.js` | 238 downgrade and real-chain comparisons plus unchanged RFC8785/WebCrypto assertions |
| `audit_recovery_validation_parity.js` | Unchanged recovery public-owner assertions against original and maintained owners |
| `audit_recipient_validation_parity.js` | Unchanged public-owner assertions against maintained and retained recipient owners |
| `audit_citation_check_rules.js` | 6,000 seeded scenarios compare the citation authoring checks with the retained module: ordered messages and targets, every peer read and call in order (including repeated fault reads), and refusal at each interrupted read. |
| `audit_citation_edit_rules.js` | 5,306 retained-source field edits with real fees and interruption ordering |
| `audit_deposit_completion_rules.js` | 3,036 retained-policy completion comparisons, mutations and service failures |
| `audit_citation_charges_parity.js` | Existing charge/correction/amount assertions unchanged through retained public-owner parity |
| `audit_shared_case_storage_parity.js` | Existing storage public-owner suite unchanged through retained-module parity |
| `audit_case_save_workflow_parity.js` | Existing storage public-owner suite unchanged through retained-module parity |
| `audit_draft_persistence_parity.js` | Existing storage public-owner suite unchanged through retained-module parity |
| `audit_backup_integrity_records.js` | A workspace backup with malformed integrity records is refused before any write; well-formed records restore as before. |
| `audit_workspace_backup_parity.js` | Unchanged public-owner validation, identity, write, integrity and replacement assertions against retained module |
| `audit_workspace_tasks_parity.js` | Unchanged public-owner task suite against maintained and retained module implementations |
| `audit_workspace_queue_rules.js` | Queue action priority, derived flags, aliases, task association, ordering and interrupted context services |
| `audit_report_owner_phases.js` | Exact Reports exports/workbook/section output and lazy service order through phased owner extraction |
| `audit_saved_work_html.js` | Exact saved-work output, case priority/limits, queues, health and ordered escape/renderer calls |
| `audit_saved_case_state_rules.js` | Saved-case status priority, queue/PDF/connection states and lazy context/service reads |
| `audit_report_sheet_xml.js` | Composed/standalone sheet XML, column names, widths, styles and lazy service receiver/read order |
| `audit_citation_prior_history.js` | Prior offense shared/local ordering, matching, windows, duplicate numbers and lookup interruptions |
| `audit_worksheet_check_html.js` | Independent retained check-row/panel oracle for severity, targets and worksheet flags |
| `audit_message_paint_rules.js` | Retained message markup, focus, dialog scope and timer/event ordering |
| `audit_correction_change_rules.js` | Correction change parity across historical cutoffs, fields and lazy reads |
| `audit_case_load_message.js` | Load notification parity through real projection and interrupted UI/save dispatch |
| `audit_storage_status_rules.js` | Exact storage diagnostic HTML and lazy state/service read order |
| `audit_language_action_rules.js` | Language action equivalence: refusal order, service reads, focus and refresh |
| `audit_walk_shortcut_rules.js` | Frozen keyboard comparisons for listener ownership, interactive targets, context mutation, undo/outcomes and ordered effects. |
| `audit_report_filter_rules.js` | Frozen Reports filter comparisons for notice/current-as-of status, historical violations and lazy input/service reads. |
| `audit_report_model_rules.js` | Frozen Reports model comparisons for stale exclusions, parcel history, geography, object links and service effects. |
| `audit_reinspection_entry_rules.js` | Frozen worksheet-entry comparisons for priority guards, imported visits, carried outcomes, state aliases and service effects. |
| `audit_followup_draft_rules.js` | Frozen drafting comparisons over guard precedence, partial failures, document registration and lazy service order. |
| `audit_admin_override_rules.js` | Frozen override comparison for authorization, case/citation binding, history, input-read order and exceptions. |
| `audit_scoped_edit_rules.js` | Frozen scoped-edit comparison for dispatch precedence, family caches, state mutation, DOM effects and lazy services. |
| `audit_citation_resolution_rules.js` | Policy rows, measurement boundaries, invalid dates and observable input reads against frozen resolution. |
| `audit_inspection_history_rules.js` | Frozen-owner comparison for lineage termination, cycles, visit observations and citation annotation precedence. |
| `audit_case_file_fault_rules.js` | Frozen-validator comparison of refusal precedence, observable input reads, exceptions and mutation. |
| `audit_editor_input_rules.js` | 12,000 seeded scenarios compare the editor's document input and change listeners with the frozen originals: service reads and calls in order, model mutation, DOM effects and thrown errors. |
| `audit_case_status_rules.js` | Frozen-owner comparison for status precedence, dates, pending records, artifact state and retained aliases. |
| `audit_citation_refresh_rules.js` | 4,692 policy/generated owner scenarios pin mutation, aliases, exceptions, lazy service order and live shared-history cache invalidation/reloads. |
| `audit_snow_snapshot_rules.py` | 3,000 snow snapshots preserve exact item/evidence/noon/letter refusals, date/comment queries and unchanged inputs. |
| `audit_address_parser_rules.py` | Real parser corpus and 3,000 tagged-part scenarios preserve raw/result data, fallback, errors and normalization/owner-key call order. |
| `audit_catalog_review_rules.py` | 3,000 catalog review contexts preserve exact request refusals, lock/write order, concurrent versions, cycles and partial list effects. |
| `audit_health_rules.py` | 3,000 status/probe contexts preserve exact diagnostics, caught/uncaught errors, native effect order and live reads; native cleanup retained. |
| `audit_policy_compilation_rules.py` | 128 varied compilation contexts preserve build-formatted policy bytes, refusals, reads, interpretation and temporary-policy cleanup. |
| `audit_retained_source_rules.py` | 3,000 retained-source scenarios preserve exact refusals, UTF-8 read order, source bytes and complete compiled policy bytes. |
| `audit_policy_version_rules.py` | Every retained policy row plus 3,000 malformed version scenarios preserves exact refusals, date-call order, input data and compiled bytes. |
| `audit_workflow_search_rules.py` | 3,000 search scenarios preserve exact output, errors, read/validation order, inputs and 5,000-file/100-result limits. |
| `audit_open_cases.py` | Open cases by inspector: the Reports open rule (Closed/Withdrawn and filed snow cases are closed), assignment and the Unassigned choice, next-due ordering, incompleteness counts, limits, damaged summaries and the guarded read-only `/cases/by-inspector` route with plain refusals. |
| `audit_violator_pricing.py` | Violator contact in the helper: the pricing respondent is the Violator's mailing address on a non-snow case (shared cases with the Writer), prior offenses follow the Violator and not the owner, snow cases ignore the Violator. |
| `audit_citation_history_rules.py` | 3,000 synthetic scan traces preserve reads, guard order, exclusions and projection; unchanged real-store integrity tests remain. |
| `audit_issuance_group_rules.py` | 3,000 atomic-group contexts and explicit reversed-event precedence preserve exact results, errors and inputs. |
| `audit_visit_validation_rules.py` | 3,000 physical/release inspection contexts preserve exact refusals, dependency traces, dates and inputs. |
| `audit_citation_pricing_rules.py` | All policy snapshots plus 3,000 generated contexts preserve exact pricing refusals, dependency traces, staging and inputs. |
| `audit_citation_base_rules.py` | All policy rows and 3,000 generated measurements preserve amounts, errors, lookup order and inputs against the original. |
| `audit_catalog_publication_rules.py` | 3,000 catalog publication contexts preserve exact refusals, file-read order, unchanged inputs and read-only files. |
| `audit_special_publication_rules.py` | 3,000 scoped-action contexts preserve exact refusals, query order and mutation against the frozen original. |
| `audit_editor_html.js` | Exact editor HTML, state mutations and service access order |
| `audit_screen_html.js` | Default screen escaping, explicit trusted fragments and print-path exclusion |
| `audit_deferred_services.js` | Inert declared services, live callbacks/values and descriptor parity |
| `audit_scoped_architecture.js` | Root-state ownership, zero cycles and static injection widths |
| `audit_recovery_event_export.js` | Synchronous recovery export names, bytes and identity |
| `audit_scoped_services.js` | Exact scoped dependencies, lazy leaves, static access, no spreads and per-interface width |
| `audit_editor_state.js` | Live editor state and retained captured-view pointers |
| `audit_recovery_state.js` | Live recovery queue, progress and selection state |
| `audit_imports_state.js` | Live Accela selection and request coordination state |
| `audit_startup_state.js` | Live startup promise, lock and readiness state without initialization |
| `audit_catalog_state.js` | Live six-field catalog authority boundary |
| `audit_workspace_state.js` | Live workspace state boundary without initialization or captured references |
| `audit_test_seams.js` | Read-only per-file seam/hook inventory; reject new application-bundle evaluation and lower migrated baselines |
| `audit_safety_pending.js` | Independent pending-action seam: document focus, synchronous live amendment holder dispatch and absent holder |
| `audit_report_loading.js` | Independent authenticated loading: 500/1 parcel chunks, partial lookup and superseded-response protection |
| `audit_language_focus.js` | Independent focus/caret/field/disclosure restoration across every supported catalog control |
| `audit_repaint_keepers.js` | Real Chromium independent screen-owner seam: live contenteditable node/caret, action focus, and route changes before/after markup |
| `audit_complexity.js` | Reproducible JS/Python complexity debt and refusal of new or worsened violations; requires lowering improved baselines |

| `audit_pagination_equivalence.js` | Native Chromium old/new pagination parity: exact pages/measurements and Unicode note retention, snow/mobile/historical formats |
| `audit_reinspection_html.js` | Exact pre-refactor worksheet snapshots over 1,026 outcome/walk/filter/retained/closed/missing-source states; service order |
| `audit_overlay_html.js` | Exact pre-refactor modal HTML snapshots over 1,026 recipient, storage, finalization and correction states; lazy service order |
| `audit_workspace_html.js` | Exact pre-refactor Workspace HTML snapshots over 1,033 empty/queue/filter/proof/draft/deadline states, plus state/effect order |
| `audit_workspace_dispatch.js` | Differential first-match actions, exact synchronous permission/effect ordering, outcomes and state across overlapping attributes |
| `audit_case_save_phases.py` | Real-filesystem old/new save parity: merge/retry refusals, lock/write order, exact recovery and case bytes with controlled anchor clock |
| `audit_history_rules.py` | Differential history replay: linked corrections/visits, exact refusals, delegate order and partial mutations |
| `audit_publication_rules.py` | Differential publication identity, source and recorded-visit refusals over workflow fixtures and generated inputs |
| `audit_authoring_rules.py` | Historical citation authoring: generated refusal, calendar-query and mutation equivalence |
| `audit_special_field_rules.py` | Historical/helper special facts: seeded exact refusal, date-query and mutation equivalence |
| `audit_import_plan_rules.js` | Differential Accela plans, selection mutations/serial and exact service-call ordering across generated reports |
| `audit_special_rules.js` | Differential special-format checks, affected-item mutations, targets, refusal/exception and service-call precedence |
| `audit_readiness_rules.js` | Differential readiness rows, actionable targets and exact lazy-getter/effect order across seeded document states |
| `audit_deposit_rules.js` | Differential ordered-deposit rules over generated policy rows and malformed combinations, preserving refusal text and service call order |

## Inspection import and case lookup

| Suite | Covers |
| --- | --- |
| `audit_feature_accela_import.js` | Feature suite: workbook parsing and columns, type/status routing and case rules, candidate selection, stale state and repaint (former `audit_import`, `audit_r45_import`, `audit_r50_import`, `audit_r50_import_repaint`, `audit_r53_status_rules`, `audit_r62_import_rules`, `audit_status_own_property`) |
| `audit_import_r13.js`, `audit_import_r13.py` | Case routing, retained inspection identity, reuse refused at the store |
| `audit_inspection_facts.js` | Independent date/time parsing and inspection queries, historical/blank-source precedence, retained reuse evidence, case scoping and live workspace replacement |
| `audit_lookup.js`, `audit_lookup.py` | SQL lookup results into the lifecycle; fixed query, settings and transport errors |
| `audit_r36.js` | Scheduled/Assist results discarded, authoritative inspection time |
| `audit_r37.js`, `audit_r37.py` | Record Category; Snow Removal routes to the 10.28 citation |
| `audit_r38.py`, `audit_r39.py` | Lookup query matches the live report query; error 207 reporting |
| `audit_r56_citation_status.js` | Citation → Official Notice (and reinspection Citation → Compliance) re-import clears stale citation marks and draft citation/deposit data, also after save and reopen; an existing mark stays removable |
| `audit_r59_import_selection.js`, `audit_r59_import_reuse.py` | Four labelled facts per inspection candidate, highlighted pressed selection, a used candidate selectable with its blocker, stale shared checks ignored; the store refuses a new document reusing an imported inspection and accepts a CA Reinspection visit identity |

## Document authoring and language

| Suite | Covers |
| --- | --- |
| `audit_authoring.js`, `audit_authoring.py` | Reversible selection, grouped manual deadlines, write gates through the store |
| `audit_data.js` | Language library integrity: codes, groups, titles, ordinances, provenance |
| `audit_r26.js`, `audit_r26_helper.py` | Scoped new-document actions, restrictions and inspection reuse |
| `audit_r42_editor.js` | Document tasks, readiness, publication routing, print packets |
| `audit_r59_editor_flow.js` | Warning and error messages clear after 15 seconds (history kept, hover/focus pause, re-shown interval, progress persists) without clearing their condition; Violation Items opens the picker without scrolling; one Review dialog (blocking, advisory, no-concerns, check links, focus return); Issue label, no draft Print preview, validation at issuance; return to Workspace with the issued case highlighted and focused; failed and unconfirmed saves stay; one issuance per double click |
| `audit_r47_language.js` | Catalog truth, private draft identity, asynchronous isolation |
| `audit_r50_cached_reviews.js` | Cached catalog review status and refresh outcomes |
| `audit_r50_disclosure.js`, `audit_r50_editor_repaint.js`, `audit_r32_continuity.js` | Disclosure, focus and active edits survive repaints, including correction fields through a held shared-save completion |
| `audit_recipient_flow.js` | Recipient form input, address validation and standardized output |
| `audit_r31_address.js`, `audit_r31_address.py`, `audit_r32_fallback.py` | Address parser corpus, ambiguity and parser-absent fallback |
| `audit_valid.js` | Document blockers and mailing-date limits |
| `audit_feature_editor_screens.js` | Feature suite: Workspace import entry and current destination, the corrective-detail dialog and focus after it closes, case-number edits in page furniture |
| `audit_feature_language_catalog.js` | Feature suite: dotted 27.05(2)(g)2 references normalize to one catalog entry, price and classification |

## Extensions

| Suite | Covers |
| --- | --- |
| `audit_feature_extensions.js` | Feature suite: administrative family switching keeps each family's authoring version; Best Interest checks, correction of an issued Best Interest and explicit adoption |
| `audit_r62_extensions.js` | Authoring-16 Best Interest (worksheet Next due dates, no selection or safety) and Vacancy (no due dates, Scope and review date only) Extensions, family switching, historical formats |
| `audit_r62_extensions_helper.py` | Helper enforcement of the authoring-16 extension rules and earlier-format requirements |
| `audit_reinspection_notice_helper.py` | Reinspection Notice helper rules: accepted with every due date kept, past dates allowed here but not on an Extension, a changed or removed due date refused, an outstanding item required, refused on a referred case, event name matches the type, and the Reinspection status and label. |
| `audit_runtime_imports.py` | The installed helper starts: every helper module a deployed Python file imports is itself in the deployment map (and required), and the server module imports from a folder holding only the deployed files. |
| `audit_r61_best_interest.py` | Helper enforcement of Reasons plus explicit safety confirmation, retained deadlines/older-family review requirements and legacy classification aliases |
| `audit_r54_extensions.js` | Authoring-12 shared extension layout against the R53 renderer; authoring-13 dated Best Interest and Vacancy Extensions (due dates in Violation items, no conditional model) |

## Histories and referrals

| Suite | Covers |
| --- | --- |
| `audit_feature_history_referrals.js` | Feature suite: item-specific observation history and lineage, frozen history, correction endpoints, compliance history, initial citation numbers, authoring-16 notes, the live referred-case predicate, and the dependent lineage → scoped batch deadlines → generated referral scenario |

## Citations, pricing and deposits

| Suite | Covers |
| --- | --- |
| `audit_r28.js`, `audit_r28_helper.py` | Initial citation bundle, retry and atomic pairs |
| `audit_r30.js`, `audit_r30_helper.py` | Monetary and charge vectors, shared golden values, tamper checks |
| `audit_r31_deposit.js` | Required deposits, edits, renderer and print guard |
| `audit_r31_policy.py` | Policy data changes need no runtime edits; invalid trees fail closed |
| `audit_r31_mutations.js` | The property tests kill three historically missed regressions |
| `audit_r32_pricing.js`, `audit_r32_pricing.py`, `audit_r32_minor.py` | Compiled schedule rows, measurements, zero-base defaults |
| `audit_r33_admin.py` | Administrator authorization for exceptional deposits |
| `audit_r33_core.js`, `audit_r33_core.py` | Immutable citation faces, court fields, library identity |
| `audit_r35.js` | Initial-inspection citation replaces the Official Notice |
| `audit_properties.js`, `audit_properties_helper.py` | Property-based pricing and storage checks with replayed seeds |
| `audit_r59_charge_select.js` | Several item sections: explicit charged-ordinance select, pricing from the configured schedule, changed choice clears the previous charge's values, unscheduled and multi-row ordinances, different-charge path, save/reopen |
| `audit_feature_citation_packets.js` | Feature suite: frozen copy labels and complete four-copy packets, compact editor preview, a refused retry filing explains itself |

## Snow citations

| Suite | Covers |
| --- | --- |
| `audit_r33_snow.js`, `audit_r33_snow.py` | Snow timing, required facts, seasonal pricing, letter content |
| `audit_r34.js`, `audit_r34.py` | Cover format 10, January pricing, one case per season, install guide checks |
| `audit_snow_repaint.js` | Snow fields keep focus and typed input through background repaints |

## Issuance, corrections, reinspection and case lifecycle

| Suite | Covers |
| --- | --- |
| `audit_e2e.js`, `audit_lifecycle.js` | Full case paths, two visits, interrupted working papers |
| `audit_events.js` | Event history: drafts, issuance appends one event |
| `audit_corrections.js` | Correction lifecycle |
| `audit_r20.js` | State names, freezing and archived copies |
| `audit_r40.js` | Semantic tasks, policy hold, legacy reprints, idempotent filing |
| `audit_r46_reinspection.js`, `audit_walkthrough.js` | Reinspection outcomes, worksheet visibility, walk-through |
| `audit_r53_workflow.js` | Grouped reinspection due dates; top-of-page warnings clear after 15 seconds |
| `audit_resume.js` | Resuming unfinished work |
| `audit_workflow.py` | Lifecycle gates against the file store, racing atomic batches |
| `audit_feature_corrections.js` | Feature suite: correction change values for money, assessments, overrides and ordinances |
| `audit_feature_worksheet_dates.js` | Feature suite: worksheet batch due dates with an undecided follow-up; Apply uses the visible selection |

## Saved work, recovery and browser storage

| Suite | Covers |
| --- | --- |
| `audit_storage.js` | IndexedDB drafts and case-folder writes |
| `audit_r44_saved_work.js` | Saved-work states and actions |
| `audit_r25.js`, `audit_r25_helper.py` | Legacy workspace, queued IDs, strict saves, retention, PDF filing |
| `audit_perm.js` | Folder permission requests |
| `audit_r50_errors.js` | Serialization failures leave no false saved state |

## Shared records, integrity and locking (helper)

| Suite | Covers |
| --- | --- |
| `audit_helper.py` | Real filesystem and HTTP store regressions |
| `audit_contracts.js` | Exact event and store contracts |
| `audit_r31_integrity.js`, `audit_r31_integrity.py`, `audit_r32_integrity.py` | Canonical hashing, tamper detection, migration, anchors, downgrade refusal |
| `audit_r40_cache.js`, `audit_r40_storage.py` | Proof cache eviction, durable failures, lock recovery |
| `audit_utf8_io.py` | Case, integrity, tool and policy text is UTF-8 under a simulated Windows CP1252 default (including the deposit provenance check); no implicit encodings in helper/, tools/ or policy/ |
| `audit_pdf_publication.py` | Outbox transfer and direct filing share one per-name lock, never replace different bytes, keep the outbox copy on conflict |
| `audit_shell_escaping.js` | Screen titles and breadcrumbs escape imported text exactly once (case actions in normal and referred branches, editor) |
| `audit_safety.js`, `audit_safety.py` | Lock assistance, ownership, diagnostics privacy |
| `audit_archive.py` | Byte-level archive and local HTTP |
| `audit_review_r12.py` | R12 source-review regressions |

## PDFs, printing and pagination

| Suite | Covers |
| --- | --- |
| `audit_final.js` | Every screen and document renders cleanly |
| `audit_r40_pdf.py` | Lost-response PDF protocol with changing renderer bytes |
| `audit_r50_documents.js` | Authored content and pagination against verified R49 (Chromium) |
| `audit_r54_extension_print.js` | R54 extension layouts and PDF geometry (Chromium) |

## Reports and summaries

| Suite | Covers |
| --- | --- |
| `audit_reports.js`, `audit_summary.js` | Reports side and Writer side of summaries (uses `fixtures/mk_summaries.js`) |
| `audit_r21_reports.js` | Saved date semantics, read-only Reports-to-Writer transport |
| `audit_r48_reports.js`, `audit_r49_ui.js`, `audit_r50_report_errors.js` | Filters, ordering, coverage wording, report errors |
| `audit_server_reporting.py` | Reporting endpoints over real HTTP |
| `audit_publication_lifecycle_rules.js` | 8,000 seeded case records of every document type compare the publication lifecycle checks with the retained module: ordered messages, every peer read and call in order, refusal at each interrupted read and untouched inputs. |
| `audit_record_commit_rules.js` | 6,000 seeded amendment saves compare the commit with the retained module: result, ordered peer reads and calls, candidate, case, draft and editor effects, definitive and indefinite failures and refusal at each interrupted read or call. |
| `audit_print_job_rules.js` | 8,000 seeded documents compare print job assembly with the retained module over a scripted print frame: refusals, frame and document writes in order, citation packet completeness, snow and standard pagination, the returned job and refusal at each interrupted read or call. |
| `audit_pdf_filing_rules.js` | 6,000 seeded issued documents compare original PDF filing with the retained module: guards, the request, every helper reply outcome, the filed-event decision, the busy counter and refusal at each interrupted read or call. |
| `audit_pdf_filing_explanation.js` | File issued PDF explains a missing Chrome or Edge once when asked, adds no second message when filing happens automatically at issue, and makes no helper request without a browser. |
| `audit_publication_flow_rules.js` | 5,000 seeded scenarios compare the issuance flow with the retained module: result, errors, ordered peer reads and calls with the editor state at each call, draft effects and refusal at every interrupted read or call. |
| `audit_import_panel_rules.js` | 6,000 seeded reports, cases, drafts and lookup states compare the import review panel with the retained module: exact markup, every peer read and call in order, untouched state and refusal at each interrupted read. |
| `audit_import_accept_rules.js` | 8,000 seeded reports, cases and drafts compare import acceptance with the retained module: the case, document and worksheet it creates or updates, every peer read and call in order with the state they see, and refusal at each interrupted read or call. |
| `audit_import_lookup_rules.js` | 6,000 seeded direct case lookups compare validation, the request, stale-result guards, the shared-record check, acceptance or review, failure messages, busy cleanup and every peer call in order with the retained module, including refusal at each interrupted call. |
| `audit_import_report_rules.js` | Over 10,000 seeded comparisons the Accela report reading (columns, type and status rules, value readers, report-table parsing and workbook zip/XML reading, including damaged and oversized files) matches the retained module. |
| `audit_deposit_interpreter_rules.py` | 6,000 seeded schedule entries compare the build-time deposit reading (every ordinance family, quantity row, tier list, stale notice and refusal) with the retained module, including untouched inputs. |
| `audit_backup_write_rules.py` | Real folders compare draft backup writes with the retained function: request validation order, the written snapshot, daily, weekly and replacement retention, unreadable and undeletable files and the audit records. |
| `audit_shared_records_route_rules.py` | 3,000 seeded shared-record POST requests compare request-size and body checks, each route's call and arguments, the probe file and the status and message of every failure with the retained handler. |
| `audit_pdf_post_rules.py` | 3,000 seeded PDF filing and email posts compare length and body checks, the operation, verified and reused archives, rendering, outbox fallback, the Outlook draft and every failure status and message with the retained handler. |
| `audit_artifact_operation_rules.py` | 700 seeded sequences of durable PDF operations on real folders compare validation, first filing, replay from the shared receipt, cached retry without the share, tampered or conflicting files and the exact files and messages each leaves with the retained module. |
| `audit_record_history_markup_rules.js` | 6,000 seeded documents compare the document record panel markup (revision chain, withdrawal and follow-through, pending attempts, record notes, save-in-progress, escaping) and every peer read with the retained module. |
| `audit_recovery_modal_markup_rules.js` | 6,000 seeded states compare the recovery dialog markup (backup list, selection, errors, local and shared comparison, escaping) and every peer read with the retained module. |
| `audit_correction_panel_markup_rules.js` | 6,000 seeded corrections compare the correction panel markup (locked and unlocked drafts, every document family, the recorded-visit editor, the change table, errors, escaping) and every peer read and call with the retained module. |
| `lifted_splice.cjs` | Fixture helper: runs a retained original function beside the module-level functions lifted out of a factory. |
| `audit_filename_policy.py` | File names from case data drop or refuse control and bidirectional characters; ordinary names are unchanged. |
| `audit_case_containment.py` | Linked or non-regular entries in the case folder are never read, listed, resolved, indexed or written through; ordinary case files work as before. |
| `audit_malformed_input_rules.py` | Wrong-shaped case records, unreadable case files and bad parcel requests are answered as plain 400s; refused records write nothing. |
| `audit_integrity_shape_rules.py` | Wrong-shaped integrity metadata is an invalid verdict, and one unprocessable case file never fails the whole Reports index. |
| `retained_wording.py` | Fixture helper: retained-handler comparisons stay exact except the two sentences that deliberately changed (plain error wording). |
| `audit_public_errors_rules.py` | People see messages the program wrote, never parser or Python wording or file paths; the migration conflict explains itself. |
| `audit_reports_clock_wiring.js` | Every Reports service getter named TODAY reads the current day through `currentDay()` when asked, not the page-load day. |
| `audit_markup_inventory.js` | Split-literal ratchet: screen modules may not gain adjacent string pieces joined with +; print/issued and approved-wording modules are classified, not ratcheted. |
| `audit_tool_form_submit_rules.js` | Tool form submits in real forms: search markup, reminder preferences, batch deadlines, outbox sync and failure handling against the retained module. |
| `audit_inspector_cases.js` | The inspector picker in Search shared case records, its open-case list and incompleteness notes, escaping, the import prompt, Import inspection opening with the case number ready, continuing an import already awaiting review and refusing to replace one for another case. |
| `audit_violator_contact.js` | Violator contact rules in the Writer: the Copies type, one Violator per case, snow exclusion, defendant lines, owner copy choice, company rule and pricing respondent from the shared cases. |
| `audit_start_correction_rules.js` | Opening a correction: existing-draft shortcut, refusals, dropped fields, recipient merge and stored record against the retained module. |
| `audit_snow_letter_review_rules.js` | Seasonal letter review form, submit rewriting and failure display against the retained module. |
| `audit_printable_html_rules.js` | Printable HTML document, control substitution and missing-sheet notice against the retained module. |
| `audit_deposit_schedule_markup_rules.js` | Deposit schedule explorer markup after date, search and page actions against the retained module. |
| `audit_catalog_review_panel_markup_rules.js` | Catalog review panel markup, notices, replacement search and peer-call order against the retained module. |
| `audit_tools_screen_markup_rules.js` | Every colour-theme state compares the Tools & settings screen markup and its shell and icon peer calls with the retained module. |
| `audit_verified_update_rules.py` | 1,500 seeded shared deployments on real folders compare verified update staging (manifest limits, version and build pins, downgrade refusal, path rules, links and stray files, size and checksum recheck, staged files and pin, failure diagnostics) with the retained module. |
| `audit_lookup_query_rules.py` | 6,000 scripted PowerShell answers compare the Windows case-lookup query (refusals before the call, each failure category and number, the allowlisted diagnostic code, appended operation and argument text and the exact request sent) with the retained function. |
| `audit_lookup_settings_rules.py` | 1,500 seeded shared and per-user settings folders compare the case-lookup configuration (shared folder and file, allowed keys and values, approved server, certificate setting and disabled switch) with the retained function. |
| `audit_new_document_click_rules.js` | 8,000 seeded click events compare scoped new-document actions with the retained module: attribute priority, the draft, worksheet and case effects of each action, every peer read and call in order and refusal at each interrupted call. |
| `audit_recovery_event_rules.js` | 10,000 seeded working-draft recovery clicks compare id and attribute priority, every action's peer calls in order with the state they see, filing retries and refusal at each interrupted call with the retained module. |
| `audit_catalog_review_action_rules.js` | 10,000 seeded catalog review clicks compare the basis confirmation, field validation order, the recorded review and its cache, retained-edit detection, failures and refusal at each interrupted call with the retained module. |
| `audit_exit_request_rules.js` | 3,000 seeded exit requests in a real dialog compare draft saving, the review re-check before and after the recovery copy, acknowledgment, supersession, the shutdown request and its refusal, failure and success paths with the retained module, with every peer call in order and the state left behind. |
| `audit_record_integrity_rules.js` | 6,000 genuine record chains of every shape, with tampering at every link and malformed or legacy input, compare the exact verification verdict (event, expected, actual, last good commit) with the retained module. |
| `audit_record_action_modal_rules.js` | 6,000 seeded states compare the record-action dialog markup (every mode, held attempt, saved form and error, with escaping) with the retained module. |
| `audit_exit_review_rules.js` | 12,000 seeded case, queue and outbox states compare the Exit Document Writer review with the retained function: blocking and unresolved items, their order and wording, and every read of the supplied context in order. |
| `audit_safety_event_rules.js` | 10,000 seeded safety click events compare attribute priority, every action's peer calls in order with the state they see, failure toasts and refusal at each interrupted call with the retained module. |
| `audit_new_document_rules.js` | 16,000 seeded documents of every special type and authoring version compare the new-document printed wording, details form, lifecycle checks and readiness checks with the retained module: every peer read and call in order, document mutation and refusal at each interrupted read or call. |
| `audit_summary_projection_rules.js` | 4,500 synthetic corpus cases compare the browser summary projection and event replay with the retained module: summaries, refusals, untouched inputs and both case-list modes. |
| `audit_case_projection_phases.py` | 3,000 synthetic corpus cases compare the helper replay and projection with the retained functions for both workspace modes: results, workspace consultation, refusals and untouched inputs. |
| `audit_case_projection.py` | The helper's reporting projection (`helper/case_projection.py`) equals the real `summarize()` over 6,000 generated cases and every summary written by seven Writer flow suites (`fixtures/projection_corpus.cjs`, `fixtures/projection_capture.cjs`); comparisons are canonical JSON (RFC 8785), so booleans never equal numbers |
| `audit_gate_lifecycle.py` | Failed preflight invalidates earlier evidence; read-only diagnostics preserve it; timer teardown preserves completion, callback receiver, cancellation and asynchronous failures |
| `audit_projection_capture.py` | Gate-reused projection captures are accepted only when complete and bound to the current run, suite and source from a passing flow; the capture fixture publishes atomically and records failure |
| `audit_report_projection.py` | Summary-only changes (owner, status, notice/closure dates, documents, violations, citations) and boolean/number substitutions at any depth (`false`/`0`, `true`/`1`) with `sourceRevision` unchanged are excluded as not matching the verified case, anchored or not; the helper refuses to write them; equivalent numbers and key order still match; the withdrawn-notice report result (`noticeActive` `false` vs `0`) is preserved through the real Reports bundle (`fixtures/report_output.cjs`); rebuild restores; existing exclusions and serial/parallel equivalence hold |
| `audit_report_metadata.py` | Over real HTTP with one and four readers: a non-text `sourceFile` or a case file that is not a case record excludes only that summary (unreadable coverage) while healthy summaries stay available; reading writes nothing; filename, letter-case, absent/empty/null and earlier-format rules and other exclusions unchanged |
| `audit_report_mismatch.js` | Reports explains summaries not matching their case and keeps them out of totals, tables, CSV, workbook and print |
| `audit_report_export_scope.js` | Reports workbook sheet scope: unchanged record-sheet selections (violation type not applied to Citations, Corrections by recorded date, Visits outside the period), the About sheet's per-sheet date basis and filter exceptions, and the export note |
| `audit_r61_reports_ordinance.js` | Reports lists, filters and counts 27.05(2)(g)2 and 27.05(2)(g)2. as one ordinance without changing stored summaries |

## Security, sessions and connections

| Suite | Covers |
| --- | --- |
| `audit_r50_session.py`, `audit_r50_session_browser.js` | Session token, bootstrap and helper restart |
| `audit_r50_connections.py` | GIS/SQL allowlists, redirects, anchor settings |
| `audit_r50_low_security.py`, `audit_r50_renderer.py` | Renderer containment, embedded-only resources, planted paths |
| `audit_func.js` | Output escaping and injection |
| `audit_logging.py` | Logs exclude case data and rotate |

## Install, update and release packaging

| Suite | Covers |
| --- | --- |
| `audit_r31_install.py`, `audit_r40_install.py` | Offline wheels and hashes; interrupted update rollback |
| `audit_r50_updates.py`, `audit_r51_updates.py`, `audit_r52_manifest.py` | Manifest-checked updates, tamper classes, downgrade protection |
| `audit_release_identity.py` | Calendar/release/schema validation, sync refusal before consumer writes, immutable publication and monotonic release/build rules |
| `audit_r51_bootstrap.py`, `audit_r53_update_recovery.py` | Launcher hand-off, signing-era retirement, deployment cleaner |
| `audit_desktop_launch.py` | Desktop launch with simulated Windows calls: shortcut fields and quoting (spaces, apostrophes, UNC), pythonw discovery and batch fallback, no console window for every helper child process, hidden helper start and readiness, running-helper reuse and refusal dialogs, rejected and offline updates, Chrome/Edge app window without a new profile, launcher log without tokens, favicon route and icon sizes/source digest |
| `audit_desktop_exit.py`, `audit_desktop_exit.js` | Exit Document Writer: `/helper/shutdown` only as a guarded POST route (token, Host, Origin, fetch-site, JSON), refused with reasons for an in-flight request, held lock or install transaction (force never bypasses), idle stop of serve_forever, launcher never stops a helper; Writer saves drafts before the review and the request, lists queued and unconfirmed work without calling it saved, refuses during publication/filing/device-save failure, shows helper refusals and the stopped state; Reports and other windows show the stopped state; no request on window close |

## Workspace, navigation, calendar and accessibility

| Suite | Covers |
| --- | --- |
| `audit_accessibility.js` | Alerts, message history, labels, landmarks |
| `audit_workspace_queue.js`, `audit_r41_queue.js` | Workspace queue, filters, recovery actions |
| `audit_usability_phase1.js` | R56 usability: Inspection section only when actionable, special check links, save/removal wording, quick views and More views that keep search and inspector until Clear search and inspector, issued-document Save case to shared folder when connected or Download workspace backup with Connect shared folder when not, Done-only Recipients, recovery groups, report export labels |
| `audit_usability_phase2.js` | R56 usability: one editor readiness summary with Go to first required field, a single Review checklist, a decision-focused issuance dialog that still validates at issuance, row selection with Apply date to selected items, unchanged worksheet and batch due dates, authoring-13 Affected selection beside due dates (authoring 12 unchanged) |
| `audit_usability_phase3.js` | R56 usability: named search scopes with a shared-search offer that keeps the workspace query, Open case in Writer and Back to Reports/Open Reports labels with restored report filters, date mode and sort through the existing-tab return message and the page-load return, Review all items and One item at a time modes with a step indicator and collapsed tips, shortcut sheet labels matching OUTCOMES, narrow-screen editor task bar structure, Browse language/Review catalog/Select for this notice, collapsed Administrator tools |
| `audit_r29.js` | Navigation and continuity |
| `audit_event_registration.js` | Original feature-registration order/capture/checkpoints, inert lazy interfaces, per-target idempotence, synchronous routing and captured confirmation/input/keyboard behavior |
| `audit_record_rules.js` | Standalone deterministic migration, immutable replay/carry-forward, explicit summary facts, source precedence and record/history/merge refusals |
| `audit_writer_feature_boundaries.js` | Scoped administrator/address/new-document/test-only factories; lazy composition, explicit acceptance, receipt binding, historical selection and live visits |
| `audit_document_pagination.js` | Independent lazy pagination, historical limits, retained page/row/footer ordering, snow/mobile handling and call-time document lookup |
| `audit_editor_service.js` | Independent lazy editor, listener order, synchronous copy toggles, readiness/focus, refresh/save sequencing and item/record/dialog guards |
| `audit_import_service.js` | Independent import-service loading, lazy composition, shared-read/cancellation/confirmation guards and retained live state |
| `audit_catalog_service.js` | Independent catalog/preflight composition, stale review retention, durable patch serialization/failure cleanup and authority guards |
| `audit_reinspection_service.js` | Independent worksheet/walkthrough composition, live state, outcome/undo guards and save/render/focus order |
| `audit_case_activity.js` | Six-input reminder/timeline service, live date/state, scope/escaping and read-only event ordering |
| `audit_pdf_artifacts.js` | Five-input retained PDF owner, stale/context/identity guards, partial failures, synchronous popup timing, authenticated captured original-byte reads and download fallback |
| `audit_writer_handoff.js` | Six-input readiness/Reports handoff owner, restoration waits/failures, restored local work, stale shared requests, file validation and channel/URL behavior |
| `audit_deadline_assignment.js` | Seven-input deadline owner, atomic batch/assignment refusals, spacing/count and live selection/worksheet guards, escaped presentation and indicators |
| `audit_workspace_tasks.js` | Three-input read-only task owner, group/count agreement, delegated policy, artifact truth, action escaping, frozen inputs and live workspace replacement |
| `audit_screen_dependencies.js` | Independent scoped screen/fact owners, live case/citation dates, Workspace reveal/escaping, overlay priority, startup barriers and repaint/focus/caret/save/scroll order |
| `audit_shell_boundaries.js` | Independent lazy screen frame, print cloning/field conversion/popup/download/timers, live escaped diagnostics/rebuild status and write-probe permission/helper/native error ordering |
| `audit_record_helper_adapters.js` | Independent authenticated JSON/summary adapters, verification/errors/projection parity and direct event/source-query ordering |
| `audit_folder_connections.js` | Independent folder linking/restoration/grants; synchronous picker, helper priority, persistence/flush order, quiet permission and partial failures |
| `audit_writer_startup.js` | Independent startup owner; original invocation, lock lifetime/refusal UI, restore/readiness barriers, helper branches and every-stage failure order |
| `audit_case_work_actions.js` | Independent case/draft actions and reinspection entry; pending/risk/save order, workspace removal, routing and imported/carried date/source identity |
| `audit_local_work_controls.js` | Independent local JSON and draft-save controls; debounce/status/counter paths, file picker failures and download/URL cleanup ordering |
| `audit_case_folder_workflow.js` | Independent folder/index owner; permission/partial listings, verify-before-load dispatch, summary input/failure status and rebuild refusal/write counts |
| `audit_recipient_workflow.js` | Independent postal formatting and two-input recipient workflow; validation-before-normalization, accepted lines, parser replacement and correction/live-case copy/email edits |
| `audit_writer_utilities.js` | Independent defining utility imports/loading, date/time/owner formatting, native and fallback random bytes/errors, catalog traversal/metadata and shallow-copy semantics |
| `audit_document_readiness.js` | Independently composed readiness; preparation/delegate/target order, live-day/correction exceptions, family filtering, address/inspection/import/citation refusals and mandatory amount exemption |
| `audit_document_sources.js` | Independent notification/undo/placeholder and approved-source owners; stale edit guards, text/event/focus order, source precedence/cloning, approved blocks and historical signer/court defaults |
| `audit_citation_charges.js` | Independent court scheduling/numbering and charge/deposit editing; holiday/day/clock/collision behavior, currency, basis clearing and retained correction metadata |
| `audit_document_delivery.js` | Independent printing/delivery owners; frame/packet guards, archived original and email identity/reuse, snapshot-bound filing, receipts/outbox, fallback and counter failures |
| `audit_working_papers.js` | Independent citation drafts/visit recording/work capture; draft identities and guards, append/projection/save order, typed/cleared/walk/recipient retention and finalization dispatch |
| `audit_record_workflows.js` | Independent inspection history/correction UI/record actions; retained request retries, validation/locking/escaping, item lineage, legacy cutoffs and immutable history overlays |
| `audit_recovery_history.js` | Independent recovery UI/catalog forms/document-history owners; lazy interfaces, control/navigation/picker failures, escaped status/history, catalog persistence and revision-print semantics |
| `audit_worksheet_workflow.js` | Independent eight-input worksheet owner; outcome/date/deadline/carried/withdrawn rules, date/copy cleanup, unissued visits, reversible retained drafts and discard refusals |
| `audit_case_recovery.js` | Independent 18-input case recovery owner; selection/shared/validation refusals, backup-before-confirmation, storage completion/error/abort, fallback rollback and unrelated/import work retention |
| `audit_automatic_recovery.js` | Independent ten-input automatic backup owner; identity/storage failures, scoped case/import snapshots, signatures/retries, debounce and serialized latest queued state |
| `audit_workspace_backup.js` | Independent 11-input whole-workspace backup owner; lazy wiring, capture/export, validation/refusals, awaited storage/integrity/live replacement order, retained work and legacy defaults |
| `audit_case_workspace.js` | Independent live record operations and five-input loader; identity/conflict/checkpoint/history semantics, partial-load rollback, sequence high-water, proof gating and shared merge refusals |
| `audit_shared_case_storage.js` | Six-input write adapter, 12-input held-save owner and 14-input case-save workflow; revision/verification/permission order, current retry, retained failures/new queue work and serialization/save sequencing |
| `audit_workspace_storage.js` | Two-input device database and ten-input draft persistence owners; connection/transaction failures, ordered isolated snapshots, stale/latest status and required restoration barriers |
| `audit_correction_service.js` | Six-input preparation and 18-input correction workflow; eligibility/stale/conflict checks, lineage/formats/visits, recipients, exact pending retry and post-confirmation delivery |
| `audit_publication_service.js` | Nine-input preparation and 17-input continuation owners; lifecycle/snapshots, refusal barriers, exact pending retry, grouped preparation/confirmation/filing, partial failures and navigation/concurrency |
| `audit_record_commit.js` | Eleven-input shared record confirmation owner; durable exact retry, grouped events, definitive/uncertain rejection, save/concurrency refusals, later-edit/pending retention and cleanup ordering |
| `audit_citation_workflow.js` | Independent citation/item-selection owners, 16/two lazy inputs, retained charge phases/prices, approval/wording guards, live dates and private wording/cache/identity |
| `audit_reports_boundaries.js` | Independent Reports factories, exact lazy interfaces, live presentation context and retained deposit listener order |
| `audit_document_renderer.js` | Independent lazy renderer, four distinct locked copies, immutable supplied facts, retained refusals, draft refresh and correction-day calculations |
| `audit_writer_view_contexts.js` | Three independent scoped view contexts; lazy identity-preserving composition, restored references, field order and presentation guards |
| `audit_writer_services.js` | Six independent scoped service owners; lazy exact interfaces, retained initialization/listener order, readiness/save/stale-navigation races and citation guards |
| `audit_module_boundaries.js` | Foundation dependency layers and cycle caps; no-DOM loading, live restored-state queries and historical source/authoring rules |
| `audit_workflow_tools.js`, `audit_workflow_tools.py` | Search, selected PDF filing, shared views, reminders |
| `audit_r50_calendar.js`, `audit_r32_day_boundary.js` | Chicago calendar and midnight boundaries |
| `audit_r43_review.js` | Inline completion, multiple charges, focus |

## Repository, build and evidence contracts

| Suite | Covers |
| --- | --- |
| `audit_architecture_guards.py` | Removed designs stay removed (copied source, registry, signing) |
| `audit_screen_shell.py` | Strict current screen-shell normalization, verified provenance and frozen print-style boundary |
| `audit_screen_css.js` | Split-literal CSS consumer scan, removed/retained classes and surviving declaration/cascade contracts |
| `audit_r50_repository.py`, `audit_r51_layout.py` | Version consistency, deploy inventory, current screen-shell reference, release documents, staff-doc file names |
| `audit_r40_build.py`, `audit_r45_evidence.py` | Runtime inventory; release evidence detects drift |
| `fixtures/tagcheck.js` | Built pages are well-formed standards-mode HTML |
| `audit_production_build_guard.js` | Production-only suites recognise a test bundle from its content (not the environment) and stop with one clear message; real production and test pages are classified when the runner supplies both |
| `audit_scenario_harness.js` | Feature suites run each scenario in its own process; any throw, rejection, non-zero exit or silent scenario fails the suite |
| `audit_suite_classes.py` | Suites that may launch Chromium are found through the local modules they require, so they stay serial |
| `audit_development_workflow.py` | Read-only pinned CI, PR format and title-as-data safety, clean Git/content provenance and source-ZIP fallback |
| `audit_suite_process.py` | The suite deadline stops scenario descendants as well as the parent; output and failure statuses are preserved |

## Performance (run last, alone)

| Suite | Covers |
| --- | --- |
| `audit_r48_performance.py`, `audit_r49_performance.py` | Index verification latency with unchanged read counts |
| `audit_r49_readiness.py` | Bounded read concurrency and independent proofs |

## Release-wide regressions

| Suite | Covers |
| --- | --- |
| `audit_r21.js`, `audit_r21_helper.py` | R21 cross-workflow model; helper recovery, catalog, artifact locations |
| `audit_r22.js`, `audit_r22_helper.py` | R22 reconciler, catalog, recovery, artifacts |
| `audit_r23.js`, `audit_r23_helper.py` | R23 client boundaries; HTTP, storage, calendar, GIS, PDF defects |
| `audit_review.js`, `audit_release.js` | One check per defect from external reviews |
| `audit_order_improvements.js` | Catalog search, correction withdrawals, email notices, recipients |

## Browser suites (`tests/browser`)

Run in the order of the `browserSuites` table in `audit_browser.js`, after its core
workflow. Each receives the arguments named in its row.

| Suite | Covers |
| --- | --- |
| `browser_startup.js` | Real IndexedDB startup restoration barrier, deferred navigation/early-save refusal, read-failure screen and reload recovery; two startup accessibility screens |
| `audit_browser.js` | Core production workflow (including correction typing across a held shared save), axe screens, PDFs, CSP; runs the suites below |
| `browser_r26.js` | Scoped actions with review evidence |
| `browser_r30.js`, `browser_r31.js`, `browser_r32.js` | Pricing and deposits through the loopback helper |
| `browser_r33.js`, `browser_r33_focus.js`, `browser_r34.js` | Snow citations, covers and PDFs (`r33_focus` is called by `r33`) |
| `browser_r40.js` | R40 production checks |
| `browser_r41.js`, `browser_r44.js` | Busy workspace; saved-work panel |
| `browser_r42.js`, `browser_r43.js` | Task navigation and preview, remove button and due-date separation; charge cards |
| `browser_r45.js`, `browser_r50_import.js` | Import with real workbook bytes |
| `browser_r46.js`, `browser_r47.js` | Reinspection phase; language catalog |
| `browser_r48.js`, `browser_r49.js` | Reports; deployable instructions and helper reads |
| `browser_r54.js` | R54 extension layout and print geometry |
| `browser_r59.js` | R59 type tokens across Writer and Reports, reflow and zoom, selected inspection and issued case highlights |
| `browser_r60.js` | Production keyboard dialog, address geometry at zoom, long referral pagination and distinct four-copy initial/reinspection PDFs |
| `browser_r61.js` | Real compliance PDFs, long-note preservation and signer-free Best Interest output |
| `browser_r62.js` | Greyed unavailable import results, authoring-16 notes under the violation with long-note pagination, authoring-16 Vacancy editor and print |
| `browser_reinspection_notice.js` | Reinspection Notice with the real helper: worksheet from the imported status, header and approved paragraph, ruled-through corrected item, due dates as text and not editable, past dates printed unchanged, helper refusal of a changed date, issue, and the Reinspection status in the summary the helper's own projection accepts. |
| `browser_violator.js` | Violator contact in real Chromium: the Copies type in Recipients, one Violator per case, the mailing block and CC list, the owner-copy checkbox, a blank Violator refused, the citation defendant and snow cases keeping the owner. |
| `browser_desktop_exit.js` | Last: Exit Document Writer against a separate real `server.py` process with Writer and Reports open; refusal during publication, the process exits, the port closes and both pages show the stopped state |

## Release input security

| Suite | Covers |
| --- | --- |
| `audit_r55_documentation.py` | Manual identity, type/status guidance, retained chapter anchors, current security/acceptance wording; every edition (PDF inspection required) carries the current source digest |
| `audit_manual_publication.py` | Manual editions are staged, validated and replaced together; failures and interruptions leave the previous set; stale editions are detected |
| `audit_release_inputs.py` | Real synthetic packaging, generated input drift, local-data exclusion, source ownership and linked/staged input refusal |

## Former suite names

Consolidation Phase 6 moved these suites into feature suites without changing their
code; each scenario label starts with the former name. Release reviews cite them.

| Former suite | Now in | Scenarios |
| --- | --- | --- |
| `audit_import.js`, `audit_r45_import.js`, `audit_r50_import.js`, `audit_r50_import_repaint.js`, `audit_r53_status_rules.js`, `audit_r62_import_rules.js`, `audit_status_own_property.js` | `audit_feature_accela_import.js` | one each, whole suite |
| `audit_r62_history_notes.js`, `audit_referred_case.js` | `audit_feature_history_referrals.js` | one each, whole suite |
| `audit_r60_review_fixes.js` | `audit_feature_editor_screens.js` (Workspace current while importing; dialog focus), `audit_feature_worksheet_dates.js` (batch dates and stale selection), `audit_feature_history_referrals.js` (initial citation numbers in history) | four |
| `audit_r61_review_fixes.js` | `audit_feature_extensions.js` (family switching), `audit_feature_citation_packets.js` (packet labels and retry filing) | two |
| `audit_r61_development.js` | `audit_feature_corrections.js`, `audit_feature_history_referrals.js` (history rendering; compliance generation), `audit_feature_language_catalog.js`, `audit_feature_extensions.js`, `audit_feature_citation_packets.js`, `audit_feature_editor_screens.js` | seven |
| `audit_r60_development.js` | `audit_feature_editor_screens.js` (Workspace entry; corrective-detail dialog), `audit_feature_history_referrals.js` (lineage → deadlines → referral, one dependent chain) | three |


`audit_shell_escaping.js` composes real shell, case-action and editor-screen owners via `writer_shell.cjs`; retained escaping assertions no longer start Writer. Peer renderers outside the title/crumb contract remain controlled adapters.

R31 deposit and R32 pricing regressions compose real pricing, deposit/edit, court, initial-citation, editor and citation-face owners through `citation_deposit_workflow.cjs`; all41 original assertion ASTs remain unchanged, including Python3872-row parity and frozen historical face bytes. Native UI/save and non-snow/ordinary-draft adapters remain controlled.

R33 court/mandatory-appearance/library correction now shares the focused citation composition, with real snapshot ownership and explicit retained standalone-citation body scope; all15 original assertion ASTs remain unchanged.
