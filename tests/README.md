# Test index

`tools/run_tests.py` runs every `tests/unit/audit_*.js`, `audit_*.py` and
`tests/fixtures/tagcheck.js`; `tests/browser/audit_browser.js` runs the production
Chromium workflow and the browser suites listed in its `browserSuites` table. See
`docs/developer/05-TESTING.md` for the gate.

Most suites are named after the release that introduced them. They are listed here
by the feature they cover; a suite that spans several features appears under
"Release-wide regressions". Names are kept because release reviews cite them.
Add a new suite under the feature it covers.

## Inspection import and case lookup

| Suite | Covers |
| --- | --- |
| `audit_import.js` | Accela/SSRS workbook import, routing and draft creation |
| `audit_import_r13.js`, `audit_import_r13.py` | Case routing, retained inspection identity, reuse refused at the store |
| `audit_lookup.js`, `audit_lookup.py` | SQL lookup results into the lifecycle; fixed query, settings and transport errors |
| `audit_r36.js` | Scheduled/Assist results discarded, authoritative inspection time |
| `audit_r37.js`, `audit_r37.py` | Record Category; Snow Removal routes to the 10.28 citation |
| `audit_r38.py`, `audit_r39.py` | Lookup query matches the live report query; error 207 reporting |
| `audit_r45_import.js` | Source-selection parity, interruption and draft continuity |
| `audit_r50_import.js` | Result-status eligibility table (Completed, Official Notice, Citation, Compliance) |
| `audit_r50_import_repaint.js` | Import disclosure, picker focus and navigation across repaints |
| `audit_r53_status_rules.js` | Inspection type and status decide the document |

## Document authoring and language

| Suite | Covers |
| --- | --- |
| `audit_authoring.js`, `audit_authoring.py` | Reversible selection, grouped manual deadlines, write gates through the store |
| `audit_data.js` | Language library integrity: codes, groups, titles, ordinances, provenance |
| `audit_r26.js`, `audit_r26_helper.py` | Scoped new-document actions, restrictions and inspection reuse |
| `audit_r42_editor.js` | Document tasks, readiness, publication routing, print packets |
| `audit_r47_language.js` | Catalog truth, private draft identity, asynchronous isolation |
| `audit_r50_cached_reviews.js` | Cached catalog review status and refresh outcomes |
| `audit_r50_disclosure.js`, `audit_r50_editor_repaint.js`, `audit_r32_continuity.js` | Disclosure, focus and active edits survive repaints |
| `audit_r54_extensions.js` | Authoring-12 shared extension layout against the R53 renderer |
| `audit_recipient_flow.js` | Recipient form input, address validation and standardized output |
| `audit_r31_address.js`, `audit_r31_address.py`, `audit_r32_fallback.py` | Address parser corpus, ambiguity and parser-absent fallback |
| `audit_valid.js` | Document blockers and mailing-date limits |

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
| `audit_r51_bootstrap.py`, `audit_r53_update_recovery.py` | Launcher hand-off, signing-era retirement, deployment cleaner |

## Workspace, navigation, calendar and accessibility

| Suite | Covers |
| --- | --- |
| `audit_accessibility.js` | Alerts, message history, labels, landmarks |
| `audit_workspace_queue.js`, `audit_r41_queue.js` | Workspace queue, filters, recovery actions |
| `audit_r29.js` | Navigation and continuity |
| `audit_workflow_tools.js`, `audit_workflow_tools.py` | Search, selected PDF filing, shared views, reminders |
| `audit_r50_calendar.js`, `audit_r32_day_boundary.js` | Chicago calendar and midnight boundaries |
| `audit_r43_review.js` | Inline completion, multiple charges, focus |

## Repository, build and evidence contracts

| Suite | Covers |
| --- | --- |
| `audit_architecture_guards.py` | Removed designs stay removed (copied source, registry, signing) |
| `audit_r50_repository.py`, `audit_r51_layout.py` | Version consistency, deploy inventory, shell parity, release documents, staff-doc file names |
| `audit_r40_build.py`, `audit_r45_evidence.py` | Runtime inventory; release evidence detects drift |
| `fixtures/tagcheck.js` | Built pages are well-formed standards-mode HTML |

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
| `audit_browser.js` | Core production workflow, axe screens, PDFs, CSP; runs the suites below |
| `browser_r26.js` | Scoped actions with review evidence |
| `browser_r30.js`, `browser_r31.js`, `browser_r32.js` | Pricing and deposits through the loopback helper |
| `browser_r33.js`, `browser_r33_focus.js`, `browser_r34.js` | Snow citations, covers and PDFs (`r33_focus` is called by `r33`) |
| `browser_r40.js` | R40 production checks |
| `browser_r41.js`, `browser_r44.js` | Busy workspace; saved-work panel |
| `browser_r42.js`, `browser_r43.js` | Task navigation and preview; charge cards |
| `browser_r45.js`, `browser_r50_import.js` | Import with real workbook bytes |
| `browser_r46.js`, `browser_r47.js` | Reinspection phase; language catalog |
| `browser_r48.js`, `browser_r49.js` | Reports; deployable instructions and helper reads |
| `browser_r54.js` | R54 extension layout and print geometry |

## Release input security

| Suite | Covers |
| --- | --- |
| `audit_r55_documentation.py` | Manual identity, type/status guidance, retained chapter anchors, current security/acceptance wording; every edition (PDF inspection required) carries the current source digest |
| `audit_manual_publication.py` | Manual editions are staged, validated and replaced together; failures and interruptions leave the previous set; stale editions are detected |
| `audit_release_inputs.py` | Real synthetic packaging, generated input drift, local-data exclusion, source ownership and linked/staged input refusal |
