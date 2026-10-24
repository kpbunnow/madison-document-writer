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
| `audit_r54_extensions.js` | Authoring-12 shared extension layout against the R53 renderer; authoring-13 dated Best Interest and Vacancy Extensions (due dates in Violation items, no conditional model) |
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
| `audit_r59_charge_select.js` | Several item sections: explicit charged-ordinance select, pricing from the configured schedule, changed choice clears the previous charge's values, unscheduled and multi-row ordinances, different-charge path, save/reopen |

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
| `audit_status_own_property.js` | Reject inherited-property status names (`constructor`, `__proto__`) across supported inspection types on uploaded-report and SQL paths; group inherited-property case numbers safely and preserve report order |
| `audit_referred_case.js` | One live referred-case predicate: effective referral or referral update only (drafts, voided, superseded, other types and other cases excluded); equal to the three spellings it replaced; correction checks keep the source-document exclusion |
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
| `audit_case_projection.py` | The helper's reporting projection (`helper/case_projection.py`) equals the real `summarize()` over 6,000 generated cases and every summary written by seven Writer flow suites (`fixtures/projection_corpus.cjs`, `fixtures/projection_capture.cjs`); comparisons are canonical JSON (RFC 8785), so booleans never equal numbers |
| `audit_gate_lifecycle.py` | Failed preflight invalidates earlier evidence; read-only diagnostics preserve it; timer teardown preserves completion, callback receiver, cancellation and asynchronous failures |
| `audit_projection_capture.py` | Gate-reused projection captures are accepted only when complete and bound to the current run, suite and source from a passing flow; the capture fixture publishes atomically and records failure |
| `audit_report_projection.py` | Summary-only changes (owner, status, notice/closure dates, documents, violations, citations) and boolean/number substitutions at any depth (`false`/`0`, `true`/`1`) with `sourceRevision` unchanged are excluded as not matching the verified case, anchored or not; the helper refuses to write them; equivalent numbers and key order still match; the withdrawn-notice report result (`noticeActive` `false` vs `0`) is preserved through the real Reports bundle (`fixtures/report_output.cjs`); rebuild restores; existing exclusions and serial/parallel equivalence hold |
| `audit_report_metadata.py` | Over real HTTP with one and four readers: a non-text `sourceFile` or a case file that is not a case record excludes only that summary (unreadable coverage) while healthy summaries stay available; reading writes nothing; filename, letter-case, absent/empty/null and earlier-format rules and other exclusions unchanged |
| `audit_report_mismatch.js` | Reports explains summaries not matching their case and keeps them out of totals, tables, CSV, workbook and print |
| `audit_report_export_scope.js` | Reports workbook sheet scope: unchanged record-sheet selections (violation type not applied to Citations, Corrections by recorded date, Visits outside the period), the About sheet's per-sheet date basis and filter exceptions, and the export note |

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
| `browser_desktop_exit.js` | Last: Exit Document Writer against a separate real `server.py` process with Writer and Reports open; refusal during publication, the process exits, the port closes and both pages show the stopped state |

## Release input security

| Suite | Covers |
| --- | --- |
| `audit_r55_documentation.py` | Manual identity, type/status guidance, retained chapter anchors, current security/acceptance wording; every edition (PDF inspection required) carries the current source digest |
| `audit_manual_publication.py` | Manual editions are staged, validated and replaced together; failures and interruptions leave the previous set; stale editions are detected |
| `audit_release_inputs.py` | Real synthetic packaging, generated input drift, local-data exclusion, source ownership and linked/staged input refusal |


## R60 Workspace and referrals

| Suite | Covers |
| --- | --- |
| `audit_r60_development.js` | Workspace entry, safe text-dialog changes, reinspection deadline scope, item lineage, retained referral history and calendar-day calculations |
| `audit_r60_review_fixes.js` | PR 31 review corrections: batch dates with an undecided follow-up, stale hidden selections, dialog focus after an asynchronous close, initial citation numbers in item history, Workspace current while importing |
| `audit_r61_best_interest.py` | Helper enforcement of Reasons plus explicit safety confirmation, retained deadlines/older-family review requirements and legacy classification aliases |
| `audit_r61_development.js` | Authoring-15 history/compliance, Abate values, currency units, packet completeness and normalized catalog references |
| `audit_r61_review_fixes.js` | PR 33 review corrections: administrative family switch keeps each family's authoring version, packet check uses frozen copy labels, refused retry filing explains itself |
| `audit_r62_import_rules.js` | R62 import table with No Fee statuses, hidden status/type/undated rows and messages, greyed unavailable pairs, single remaining result after used rows are hidden |
| `audit_r62_extensions.js` | Authoring-16 Best Interest (worksheet Next due dates, no selection or safety) and Vacancy (no due dates, Scope and review date only) Extensions, family switching, historical formats |
| `audit_r62_extensions_helper.py` | Helper enforcement of the authoring-16 extension rules and earlier-format requirements |
| `audit_r62_history_notes.js` | Authoring-16 history notes under the violation on every item, and referred cases limited to Update for Case Referral or Compliance |
| `audit_r61_reports_ordinance.js` | Reports lists, filters and counts 27.05(2)(g)2 and 27.05(2)(g)2. as one ordinance without changing stored summaries |
| `browser_r61.js` | Real compliance PDFs, long-note preservation and signer-free Best Interest output |
| `browser_r62.js` | Greyed unavailable import results, authoring-16 notes under the violation with long-note pagination, authoring-16 Vacancy editor and print |
| `browser_r60.js` | Production keyboard dialog, address geometry at zoom, long referral pagination and distinct four-copy initial/reinspection PDFs |
