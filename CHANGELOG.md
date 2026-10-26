# Release changelog

## Unreleased — Worksheet workflow boundary (development)

- Separate worksheet source/readiness queries and reopen/restore/discard transitions through eight lazy source/date/continuing-item/deadline/save/UI inputs. Define date-change and cleaned-visit operations directly in the same owner. Keep original carried/withdrawn/outcome/date/deadline rules and retained previous-draft semantics.
- Preserve all seven moved and remaining recovery function bodies apart from dependency access, including save/render/message order. This does not change save acknowledgement or publication/helper authority.
- Add independent worksheet/date/clone/transition/refusal tests and guards; update ownership, source/test indexes and roadmap. Recovery is 156 lines smaller; Writer retains its seven-module component and Reports stays acyclic. Retain R63/build 64 and stored formats.

## Unreleased — Individual-case recovery boundary (development)

- Separate backup listing/selection, shared comparison, validation and individual-case/import restoration through 18 lazy UI/shared/storage/recovery inputs. Define the shared-conflict predicate directly for recovery UI. Keep original stale-selection checkpoints, pre-replacement backup/confirmation, storage acknowledgement and restoration order.
- Preserve all seven moved and remaining recovery function bodies apart from dependency access. Retain native single-transaction pending/draft writes and fallback rollback/refusal semantics; no broader asynchronous atomicity or trust guarantee is introduced.
- Add independent validation/conflict/stale-selection/storage/rollback tests and guards; update ownership, source/test indexes and roadmap. Recovery is 277 lines smaller; Writer retains its seven-module component and Reports stays acyclic. Retain R63/build 64 and stored formats.

## Unreleased — Automatic recovery backup boundary (development)

- Separate recovery workspace/case identities, case/import snapshots, helper writes and latest-state backup scheduling through ten lazy storage/identity/snapshot/helper/status/timer inputs. Keep original startup identity initialization, keys, 700 ms debounce, signatures, retry and serialized latest-state behavior.
- Preserve all seven moved and remaining recovery function bodies apart from dependency access. Recovery status/dialogs and individual-case restore remain UI-owned; no new deep-clone, concurrent-direct-call or durable-queue guarantee is introduced.
- Add independent storage/snapshot/retry/scheduling tests and guards; update ownership, source/test indexes and roadmap. Recovery is 168 lines smaller; Writer retains its seven-module component and Reports stays acyclic. Retain R63/build 64 and all stored formats.

## Unreleased — Workspace backup coordination (development)

- Separate whole-workspace backup download/restore through 11 lazy capture, date, integrity, storage and UI inputs. Keep the native file picker in recovery UI and preserve backup versions 1/2, validation, retained work/attempt/checkpoint/pending data and storage/integrity/projection/save order.
- Add independent refusal and persistence-order coverage; update version-consumer validation to its defining owner without changing format identity. Module loading/construction performs no work. This is not a new atomic restore guarantee.
- Update ownership, source/test indexes and roadmap. Recovery is 109 lines smaller; Writer retains its seven-module component and Reports stays acyclic. R63/build 64 and stored formats remain unchanged.

## Unreleased — Case records and load/rollback boundary (development)

- Separate seven live replay/projection/checkpoint/export/merge operations into case_records with direct defining exports; compose case-file load and shared merge through five lazy integrity/UI/save adapters. Module loading and construction perform no startup or storage work.
- Preserve all nine original bodies, identity remapping, event/correction conflicts, proof-before-load, case-detail reconciliation, rollback and original sequence high-water behavior, projection and refresh/save ordering. Helper integrity authority is unchanged.
- Add independent failure/rollback tests and import guards; update ownership, development rules and indexes. Workspace shell is 199 lines smaller; Writer remains a seven-module cycle and Reports stays acyclic. Retain R63/build 64 and stored formats.

## Unreleased — Shared writes and case-save coordination boundaries (development)

- Separate folder/helper write access through six lazy inputs, held-save retry through 12 inputs and case-save orchestration through 14 inputs. Keep helper verification/revision authority, native permission/write/close ordering and reporting summaries unchanged.
- Preserve all seven moved bodies, current-record retries, failed/new queue retention, serialization refusals, permission retries, verified response/later-edit handling and local save/summary order. Summary generation, merge/load validation and folder UI remain in their established owners.
- Add independent failure/order/interface tests and import guards; update ownership, development rules and indexes. case_files is 278 lines smaller; Writer remains a seven-module cycle and Reports stays acyclic. Retain R63/build 64 and stored formats.

## Unreleased — Device database and draft persistence boundaries (development)

- Separate IndexedDB connection/read/write access through two lazy inputs and draft snapshot/save/restore coordination through ten inputs. Keep the database/store names, transaction completion, required-read failures and connection retirement behavior.
- Preserve all six moved bodies, startup restoration/lock ordering, generation-aware save chain, isolated write snapshots, backup timing and retained workspace/history/integrity restoration. Keep debounce/status presentation, folder/shared writes and helper validation in their existing owners.
- Add independent failure/concurrency tests and import guards; update ownership, development rules, inventory and indexes. Writer remains a seven-module cycle and Reports stays acyclic; retain R63/build 64 and stored formats.

## Unreleased — Correction preparation and workflow boundaries (development)

- Separate correction comparisons, eligibility/type rules, checks, visit patches and retained snapshots through six lazy inputs; separate opening/issuing corrections through 18 scoped adapters. Preserve all nine original bodies apart from dependency/scroll adapter access.
- Retain item/case/revision lineage, historical authoring, recipient selection, stale-head/conflict and review guards, exact pending retry, shared confirmation before PDF/email and filing recovery. Helper/immutable receipt authority is unchanged.
- Remove court/deposit checks’ direct issuance/history import; add independent tests/import guards and update ownership, assessment and indexes. Writer remains a seven-module cycle and Reports stays acyclic. Retain R63/build 64 and stored formats.

## Unreleased — Publication preparation and continuation boundaries (development)

- Separate lifecycle checks and publication snapshots through nine lazy inputs, and issuance/confirmation/PDF continuation through 17 inputs. Recovery backup/restore UI no longer owns publication.
- Preserve all five moved bodies and issuance guard behavior, original event/group/snapshot identity, pending retries without repreparation, pre-render-before-commit and file-after-confirmation order, partial PDF failures and navigation/focus behavior. Shared confirmation/helper/immutable receipt authority is unchanged.
- Add independent service/behavior tests and import guards; update ownership, assessment, inventory and indexes. Writer remains a seven-module cycle and Reports stays acyclic; retain R63/build 64 and stored formats.

## Unreleased — Record save confirmation boundary (development)

- Isolate commitAmendment behind 11 lazy persistence/helper/projection/UI adapters, preserving its exact request, confirmation, failure and cleanup ordering. Publication, correction and recovery callers share the composed operation.
- Retain durable pending attempts before helper requests, idempotent lost-response retry, definitive rejection handling, later local edits and shared group/correction identity. Helper validation and immutable PDF authority are unchanged.
- Add independent failure/order/interface tests and import guards; update ownership, inventory and assessment. Writer remains a seven-module cycle and Reports stays acyclic. Retain R63/build 64 and stored formats.

## Unreleased — Citation workflow and item-selection boundaries (development)

- Compose citation editing/readiness/review through 16 lazy inputs and item selection through two. Preserve all eight function bodies, private declaration order, messages and markup apart from explicit dependency access.
- Retain typed/committed charge phases, original correction deposits, manual/scheduled authority, mandatory-appearance hold, private wording/cache and item identities. Existing pricing, events, storage, publication and historical rendering keep their authority.
- Retire the emptied case_timeline module without a forwarding barrel and narrow the Writer cycle guard from eight to seven modules; Reports stays acyclic. Add independent boundary/behavior tests and update current ownership, assessment and indexes. Retain R63/build-64 and all stored/format identities; no packaging or deployment.

## Unreleased — Workspace task presentation boundary (development)

- Separate workspace task generation through three lazy dependencies, preserving group order, count/list agreement, action links and existing record/artifact warnings. Delegate deposit completion to its unchanged citation calculation.
- Keep task generation read-only and observe replacement workspace references. Remove case_timeline's issuance dependency and app_screens' timeline dependency; Writer retains its eight-module component and Reports stays acyclic.
- Reduce case_timeline from 856 to 738 lines. Add independent tests/import guards and update ownership, assessment and indexes; retain R63/build-64, stored formats, existing assertions and publication authority.

## Unreleased — Deadline planning and assignment boundary (development)

- Separate batch deadline planning, assignment and presentation into a seven-dependency owner, with direct spacing/selection and live-context queries. Preserve all nine bodies apart from explicit dependency access, including draft/selection guards, atomic planning and deadline limits.
- Keep event registration, later-edit-safe undo and durable workspace/save ordering in existing owners. No persistence, publication, historical format or rule changes.
- Reduce case_timeline from 1,073 to 856 lines; Writer retains its eight-module component and Reports stays acyclic. Add independent tests/import guards and update ownership, assessment and indexes; retain R63/build-64 and all stored identities.

## Unreleased — Writer handoff and readiness boundary (development)

- Separate Writer readiness markers, Reports case opening and channel/URL handoff into a six-dependency owner. Preserve all four function bodies apart from explicit dependency access, including startup waits, local reconciliation, latest-request checks and channel reply guards.
- Keep locking/restoration, preflight, helper validation and file loading in their existing owners; channel initialization and readiness settlement remain at the original startup positions. No new constructor side effects or channel protocol changes.
- Reduce case_timeline from 1,178 to 1,073 lines and remove its workspace/screen imports plus case_files' timeline import. Writer still has an eight-module cyclic component; Reports stays acyclic. Add independent tests/guards and update ownership, assessment and indexes; keep R63/build-64 and all stored/format identities unchanged.

## Unreleased — Retained PDF artifact boundary (development)

- Separate outbox listing/selection/printing and artifact-location refresh into a five-dependency PDF artifact service, with direct artifact-status/independence queries. Preserve all six function bodies apart from explicit dependency access.
- Retain synchronous popup creation, authenticated original-byte reads, selection capture, stale/context/identity guards, partial-failure reporting, verification batches and object-URL lifetimes. Transfer and publication authority remain in their existing owners.
- Reduce case_timeline from 1,360 to 1,178 lines, keep Writer's eight-module cycle and acyclic Reports, and add independent tests/import guards plus updated ownership, roadmap and indexes. Keep R63/build-64 and stored/format identities unchanged; no packaging or deployment.

## Unreleased — Shared inspection facts (development)

- Move existing date/time parsing to calendar and inspection identity, date-source and reuse queries to an independent inspection_facts owner. Preserve all seven function bodies, frozen/correction precedence, blank times/dates and retained reuse evidence.
- Import the defining owners directly and narrow the Accela import interface from 28 to 21 UI/peer adapters. No forwarding barrel, new service factory, record or authority change; Writer retains its eight-module cycle and Reports remains acyclic.
- Add independent historical/live-state tests and dependency guards; update ownership, assessment and test/source indexes. Keep R63/build-64 and all stored/format identities unchanged; no packaging or deployment.

## Unreleased — Cohesive case activity service (development)

- Extract personal reminders and read-only case timeline presentation into a six-dependency activity owner. Preserve all seven function bodies, live date/state behavior, reminder IDs/filtering/dismissal, event ordering, export arrays and manual email-draft behavior.
- Reduce case_timeline from 1,575 to 1,394 lines while keeping outbox/handoff/deadline/pricing responsibilities in place. Writer retains its eight-module cycle cap and Reports remains acyclic; no graph reduction is claimed for this cohesion increment.
- Add independent behavior/interface guards and update ownership, assessment, roadmap, tests and source inventory. Preserve R63/build-64, stored/format identities, historical references and all existing assertions; no packaging or deployment.

## Unreleased — Reinspection service boundary (development)

- Compose worksheet/walkthrough and follow-up creation through named lazy dependencies. Preserve function bodies, live context/item guards, outcome/undo behavior, focus/save order, deadlines and historical observations.
- Reduce the Writer dependency cycle from nine to eight modules; keep Reports acyclic. Add independent boundary checks and retain all existing assertions and historical references.
- Update ownership, roadmap, test/source indexes and a remaining-maintainability assessment. Keep R63/build-64 and all record/format identities unchanged; no packaging or deployment.

## Unreleased — Catalog and shared-case preflight boundary (development)

- Compose catalog review, shared-case preflight/conflict actions and guarded workspace updates through named lazy adapters. Preserve original function bodies, stale/acknowledgement guards, explicit wording adoption, storage/integrity authority and durable save/rollback order.
- Reduce the Writer dependency cycle from ten to nine modules; keep Reports acyclic. Add independent service checks and narrow dependency guards while retaining all existing assertions and historical references.
- Update ownership, roadmap, test and source indexes. Keep R63/build-64 and all record/format identities unchanged; no packaging or deployment.

## Unreleased — Reports boundaries and visual review (development)

- Eliminate the five-module Reports dependency cycle through scoped, lazy service/screen/context constructors and explicit deposit adapters. Preserve verified data, function bodies, startup/listener order, cancellation, views, exports, maps and print behavior. Writer retains its ten-module cycle cap.
- Add independent boundary checks and keep existing report assertions through scoped private-diagnostic loaders. Narrow cycle/import guards and update ownership, test and source indexes.
- Review the documented PNG differences and preserve media-specific failure artifacts; exact image comparison remains strict and native/staff acceptance remains separate. No print/style/reference, release identity, packaging or deployment changes.

## Unreleased — Writer import-service boundary (development)

- Compose the complete Accela import workflow through named lazy UI/peer dependencies. Preserve parser/status rules, workbook/SQL paths, shared-record confirmation, stale-result and selection guards, cancellation, save/state order and original function bodies.
- Reduce the retained Writer cycle from 11 to 10 modules; Reports remains 5. Add independent import boundary checks, narrow dependency/lint guards and retain existing import assertions and historical references. Production browser diagnostics use the composed service.
- Update ownership, cleanup roadmap, test index and source inventory. Keep R63/build-64 and all record/format identities unchanged; no packaging or deployment.

## Unreleased — Screen-shell/CSS cleanup (development)

- Complete owner-authorized consolidation Phase 8: establish a current Writer/Reports screen-shell reference from verified source, recording provenance and replacing historical per-release CSS reversal bookkeeping. Preserve every historical print/document reference and approved print stylesheet.
- Remove 31 unused screen class families and the obsolete toast spinner animation. Retain live case-view/queue-primary styles missed by the old split-literal text scan; preserve surviving selector/declaration/cascade contracts and add runtime class checks.
- Add synthetic DOM capture and before/after style, geometry and pixel comparison, including forced colors; update review/reference guidance and test/source indexes. No intentional visual redesign, release/format bump, authority change, packaging or deployment.

## Unreleased — Document editor service (development)

- Compose editor rendering/actions through named lazy UI/peer dependencies. Preserve original function/listener bodies, markup, first-service copy-listener order, synchronous routing, focus and save scheduling; core exports actual instance functions and retains existing disclosure-test mutability.
- Reduce the retained Writer cycle from 12 to 11 modules and narrow dependency guards; Reports remains 5. Add independent editor checks and adapt the browser’s private readiness lookup without changing assertions. Existing diagnostic hooks, editor/disclosure/event tests and historical print references are retained.
- Update ownership, cleanup roadmap, source inventory and test index. R63/build-64, authored/storage identities, helper authorization, integrity/publication rules and acceptance holds remain unchanged.

## Unreleased — Pagination and feature ownership (development)

- Isolate physical pagination behind page-size, snow and history services. Move follow-up document creation to reinspection and sheet/overlay/dialog refresh to editor_screens, with direct imports from their defining owners. Preserve all nine function bodies, focus/save order, historical print allowance and layout behavior.
- Reduce the retained Writer cycle from 13 to 12 modules and narrow dependency guards; Reports remains 5. Add independent controlled-layout tests and retain the disclosure audit’s mutable pagination binding, existing private diagnostic hook and every historical/functional/print assertion.
- Update ownership, cleanup roadmap, source inventory and test index. R63/build-64, authored/storage identities, helper authorization, integrity/publication rules and acceptance holds remain unchanged.

## Unreleased — Scoped Writer view contexts (development)

- Construct saved-work, Workspace queue and language-discovery contexts through separate named lazy interfaces. Core exports their actual instance builders; preserve context field order, callback identities and call-time workspace references without a universal registry.
- Reduce the retained Writer cycle from 14 to 13 modules and narrow dependency/global guards; Reports remains 5. Add standalone context tests for replaced references and retained presentation warnings, keeping all existing saved-work, exit, language, functional, event and print assertions.
- Update ownership, cleanup roadmap, source inventory and test index. R63/build-64, authored/storage identities, integrity/storage/exit/catalog authority and acceptance holds remain unchanged.

## Unreleased — Document renderer boundary (development)

- Compose notice/document/citation rendering through named lazy dependencies, removing UI and live-query imports from document_render. Core exports the actual instance functions; existing consumers import them there. Preserve all seven template bodies, authored markup and fixed-print/pagination/publication ownership.
- Reduce the retained Writer cycle from 15 to 14 modules, keep Reports at 5, and narrow import/global guards. Add independent renderer checks; retain private diagnostic bindings through the existing test-only hook and preserve all property, historical, functional and print assertions.
- Update ownership, cleanup roadmap, source inventory and test index. R63/build-64 and authored/storage identities, court wording, integrity rules and acceptance holds remain unchanged.

## Unreleased — Remaining Writer feature-factory boundaries (development)

- Compose administrator tools, address preview/acceptance and new-document actions through named lazy UI/peer dependencies, retaining original initialization and click-listener order. The renderer obtains the unchanged historical affected-item predicate from the new-document service; the fixture factory receives explicit callbacks only under its existing test-build flag.
- Reduce the retained Writer cycle from 19 to 15 modules and narrow dependency guards; Reports remains 5. Add independent tests for stale address responses, explicit acceptance, administrator receipt bindings, historical selection, live visit replacement and test-only composition; preserve all existing functional, service, event and print assertions.
- Update ownership, cleanup roadmap, source inventory and test index. R63/build-64 and authored/storage identities, helper authorization, integrity/publication boundaries and acceptance holds remain unchanged.

## Unreleased — Scoped Writer service dependencies (development)

- Replace UI/core back-imports in navigation, language actions, citation pricing, deposit completion, initial citations and snow-case handling with explicitly composed lazy interfaces. Preserve calculation/action bodies, initialization order, existing listener phases, readiness/save guards and synchronous user actions.
- Reduce the retained Writer cycle from 25 to 19 modules and narrow the import/cycle guard; Reports remains at 5. Add independent service/composition tests covering delayed readiness, failed saves, stale navigation, changes during saving and citation guards; retain the historical functional, print and registration assertions.
- Update ownership, cleanup status, test index and source inventory. R63/build-64 identity, authoring/storage formats and acceptance holds remain unchanged.

## Unreleased — Record rules separated from UI/storage (development)

- Extract deterministic legacy migration, record shape/identity/correction-history checks, case merge/name rules, event replay, item carry-forward and summary derivation into four independent record owners. Callers import the defining owners directly; live loading, rollback, integrity verification, workspace mutation and I/O remain in their adapters.
- Summaries receive explicit roster/library/case facts and cache metadata. Shared source resolution preserves frozen/correction precedence and legacy snow fallback; the existing direct classifier API retains its static catalog default. Historical authoring, correction rules, record IDs, report fields and browser schema-4/helper schema-5 migration boundaries are unchanged.
- Standalone tests exercise the calculations with clock/randomness disabled and frozen inputs; import/lint guards prevent new UI/storage coupling. The independent helper projection, full corpus/captured-flow parity, event registration checkpoints and frozen print references are retained. Ownership docs and cleanup status are updated; R63/build-64 identity and acceptance holds are unchanged.

## Unreleased — Feature-owned event handlers (development)

- Move the 60 core document/window handlers into 14 feature event owners, preserving explicit registration positions, capture phases, original condition order and document snapshots. Cross-feature action bodies have scoped interfaces; construction does not access later service/state declarations. Synchronous permission and other user-action calls remain synchronous.
- Register each feature listener once per target/key, with retries after a failed registration. Tests cover registration order/state checkpoints, inert and lazy interfaces, repeated registration, exclusive routing, capture cancellation, synchronous permissions and preserved typing focus/caret. Existing historical assertions and print references are unchanged.
- app_core drops from 3,049 to 1,249 lines. Event owners import only foundations and the registration helper, without growing the Writer/Reports dependency cycles. Ownership docs, cleanup roadmap, test index and source inventory are updated. Current R63/build-64 identity and authored/storage formats are unchanged; no release package or deployment is included.

## Unreleased — Module cleanup: shared foundations (development)

- Extract document metadata, explicit authoring/item rules, live workspace queries, presentation formatting, calendar arithmetic, mailing facts and record-value helpers into seven independent owners. Callers import those owners directly. Service composition, workspace initialization and global listener/startup order stay in app_core; no persisted or installed names change.
- Reviewed-library updates no longer import startup; the largest maintained Writer import cycle drops from 26 modules to 25. A static dependency inventory and foundation-layer/cycle checks guard against renewed coupling. No-DOM tests cover live restored arrays, frozen/correction precedence and historical format cutoffs; existing output and test references are unchanged.
- Schema validation reads its new document_types owner. Code map and cleanup roadmap describe the remaining feature-listener, event-rule and Writer/Reports cycle work. Release identity, approved wording/styles, screen-shell references and City acceptance are unchanged.

## 2026-10-24 R63 — Release package

First release package since R61 (helper 2026.10.24.64, build 64; authoring 16, case schema 5, summary 6, backup 2). It contains the R62 Development 3 changes below the R63 sections (the R62 label was a development identity and was never packaged) and the following work, merged through PRs #35–#44. Published against the retained R61 deployment manifest. City, native, staff, legal and seasonal acceptance remain open; packaging is not deployment approval.

### Free-plan merge policy

- The owner chose to keep the private repository on GitHub's free plan, where branch rules are not enforced. DEVELOPMENT-STANDARD.md now records that decision and the merge policy followed by hand (pull requests only, both checks green on the current head and current main, owner approval, main checked after merge); the enforced-rule settings are kept for a future plan change. Documentation only.

### Post-consolidation corrections

- Writer protects retained private work until startup restoration finishes. Editable routes wait behind a restoration screen; early saves are refused. Failed required storage reads show reload/retry guidance instead of being treated as empty data. Internal held-write recovery saves only after drafts are read. Production-browser coverage uses real IndexedDB, delayed startup, navigation, read failure and retry.
- Shared views now accept all eleven supported Reports IDs, including Overridden deposits and Document actions, with frontend/helper contract coverage and existing invalid-ID/immutability checks retained.
- Build/synchronization validate canonical release names, actual matching calendar dates and independent positive version counters. Packaging requires the last approved published deployment manifest (or an explicit genuinely first-publication declaration), refuses identity reuse for changed content/protocol metadata and requires increasing release/helper counters without rollback; installer trust is unchanged.
- PR template, pinned read-only full-gate CI, safe PR-format checks, recorded Git/content/toolchain provenance and the development/release standard are added. GitHub main-branch protection requires administrator setup; integration inspection was denied (403), so server-side settings are not claimed applied.
- Generic entry points and implemented prompts reflect merged development; historical authoring-15 safety confirmation is distinguished from current authoring-16 behavior. Existing acceptance decisions and all open holds are retained.
- Current R62/helper-build-63 identity, authored formats, storage versions, frozen print fixtures and installed names are unchanged. No release assignment, packaging, deployment or native/City acceptance is performed by this development change.

### Consolidation Phase 7

- Review: retain direct entry-point links to the R59–R61 reviews still in docs/developer. Clarify that the special-extension version table does not describe ordinary Extensions, and that the historical signer-after-table rule starts with the aligned authoring-12 layout. All manual editions regenerated together.
- Preserve three additional replaced paragraphs verbatim in the documentation release narrative (maintenance guidance, the certificate workaround release label and Best Interest format guidance).
- Documentation only; no code, test expectation or document output changed.
- The Program instruction manual folds its release appendices into the chapters they concern (fill-in details, ordinance display, citation copies, referral and compliance histories, extension layout, editor addresses, correction money display) and adds a concise Earlier document formats section in chapter 22. All 22 chapter anchors, the hidden-import-rows warning, the release identity and the acceptance statement are unchanged. Every edition was regenerated together.
- Staff guides drop release labels from current instructions. 01-ARCHITECTURE, 03-DOMAIN-RULES and 04-PITFALLS are reorganized by feature with short historical-formats notes; 03-DOMAIN-RULES now lists the current import table, including No Fee statuses, in its import section. 00-START-HERE links every developer document.
- Replaced text is retained verbatim in docs/history/DOCUMENTATION-RELEASE-NARRATIVE.md.

### Consolidation Phase 6

- Review: suite timeouts now terminate scenario descendants as well as their feature-suite parent. The 150-second deadline is unchanged; an integration check verifies that a timed-out scenario stops writing and that output/failure statuses are retained.
- Test organization only; no application code, assertion, expected value or message changed.
- Feature suites (`audit_feature_*.js`) group scenarios by feature; tests/fixtures/scenarios.cjs runs each scenario in its own process, so isolation is unchanged (audit_scenario_harness.js).
- Thirteen suites moved: seven import suites and two history/referral suites whole, and the R60/R61 development and review-fix suites split block by block into their feature homes (Accela import, extensions, histories and referrals, citation packets, editor screens, worksheet dates, corrections, language catalog). The same 902 assertions and 108 import checks run.
- Chromium classification follows local requires transitively (tools/suite_classes.py, audit_suite_classes.py); the classification of every existing suite is unchanged.
- tests/README.md is reorganized by feature and maps former suite names.

### Consolidation Phase 5

- Review: the R60 browser fixture waits for Writer startup restoration before injecting case data. This prevents a late startup repaint from replacing the corrective-detail dialog's focus target; the Escape-focus assertion and its deadline are unchanged. The race also reproduces on the pre-Phase-5 bundle.
- Mechanical module realignment; no function body, initializer, listener registration or document output changed.
- New accela_import.js holds the whole Accela import path (from app_core.js, reinspection_walkthrough.js and inspection_import.js); reinspection_walkthrough.js is now reinspection.js (worksheet, checks and walkthrough); inspection_import.js is now editor_screens.js (document editor); new app_screens.js holds render, the shared modals and the case list.
- The Reports bundle is byte-identical; the Writer bundle has the same 439 function bodies, the same 140 executable top-level statements in the same order and the same 217 declarators.

### Consolidation Phase 4

- Consolidation only; no document output, user-visible message or helper rule changed.
- One live referred-case predicate, `isReferredCase(caseId)`, replaces ten equivalent checks with three spellings. The correction check keeps its source-document exclusion; Reports status and the workspace's "ever referred" flag are separate rules and unchanged (audit_referred_case.js).
- Tests that mean "the current format" read a pinned per-family authoring table (tests/fixtures/authoring_expectations.cjs) checked against version.json; historical literals stay.
- Production-only suites recognise a test bundle from its content and stop with one clear message (audit_production_build_guard.js).

### Import status validation fix

- Fix (pre-existing): an Accela status of `constructor` or `__proto__` (any case) was treated as having a document rule, so the row was importable and could be auto-selected. Import rules now read only their own entries, and such a row is listed greyed with "has no document rule", like any unknown status.
- Fix (pre-existing): a report case number spelled like an inherited object property (`constructor`, `__proto__`, `toString`, …) failed the import with an internal TypeError. Cases are now grouped by their own text.
- Applies to both the uploaded report and the SQL lookup; covered by audit_status_own_property.js. Release identity, authoring and storage versions unchanged.

### Consolidation Phase 3

- Review: initial and corrected citation PDF artifacts wait for print fonts and verify every required fee/language-access paragraph in extracted PDF text. This closes an unasserted capture gap; the cause of the earlier reported PDF difference remains unconfirmed. Production rendering is unchanged. The browser workflow explicitly foregrounds Reports when returning from Writer and checks navigation readiness without extending its deadline. Escape focus restoration uses a bounded wait for the asynchronous dialog close event, retaining the original focus assertion.

- Dead code removed with reachability evidence; no user-visible behavior, document output or helper rule changed.
- Obsolete Accela status table `ACC_STATUS`, the one-argument `accStatusEligible` branch and the unreachable Pending explanation removed; eligibility is `statusRule(type, status)`.
- Unreachable "already used to generate a document" import blocker (`plan.used`) removed: a used inspection is never an import candidate. The hidden-row message, helper reuse validation and unfinished-work check are unchanged.
- Nine module-internal exports made private; unused `rememberUI` parameter removed.
- Unused screen CSS inventoried as candidates only (docs/developer/CSS-CANDIDATES.md); embedded and frozen stylesheets unchanged.
- The division Word templates moved byte-for-byte from tests/fixtures/reference/new-documents/ to docs/history/division-templates/.

### Consolidation Phase 2

- Review fixes: failed browser preflight invalidates prior regression evidence; nested preflight diagnostics are read-only. Timer teardown preserves the native timeout receiver, with automated completion/failure checks. Projection captures reject non-UTF-8 text and boolean format versions.

- Verification only; no application behavior, document output or helper rule changed.
- JS suites finish when their work completes: remaining long UI timers run immediately after completion instead of being waited for (tests/fixtures/settle_ui_timers.cjs).
- The gate captures the seven Writer projection flows while they run and audit_case_projection.py reuses those run-bound captures instead of re-running the flows.
- Optional fast development tier (`DW_FAST=1`): skips measured performance suites and uses one projection seed; labelled fast, never release evidence, refused by packaging.
- Packaging refuses missing gate proof (a fast or interrupted run) or missing print compatibility evidence with a message instead of a traceback.

### Consolidation Phase 1

- The screen frame escapes its plain-text title and breadcrumb once; imported addresses on the case-actions screen are no longer inserted as markup, and no breadcrumb is escaped twice.
- The install guide's Get-FileHash command names the packaged deploy ZIP (the packager's file-name rule is shared with the build).
- Release identity unchanged (R62); assigned when a deploy package is requested.

## 2026-10-23 R62 — Development 3 (development)

- Import rules add Reinspection No Fee Extension Processing and No Fee No Occupancy. Scheduled, Pending, Completed, Inspection, No Violation, Reinspection and No Fee Reinspection results, Initial Inspection No Entry, Assist, undated rows and inspections already used on the case are hidden; other pairs are listed greyed with their reason.
- Authoring-16 Best Interest Extensions cover every uncorrected item, take the worksheet's Next due date like a normal Extension and have no safety confirmation.
- Authoring-16 Vacancy Extensions cover every uncorrected item with no due date and keep only Scope and a review inspection at least seven days after mailing; the removed fields, conditions, transfer wording and signer are gone.
- Authoring-16 referral, referral-update and compliance documents print inspector notes under the violation, corrected items included, not in the history column.
- A referred case offers and allows only Update for Case Referral and Compliance Letter; the emergency / occupancy exception is removed.
- Helper build 63; case schema 5, summary 6 and backup 2 unchanged. City/native acceptance remains open.

## 2026-10-23 R61 — Development 2 (development)

- Authoring-15 referral/compliance histories retain item observations, notes and correction dates; compliance retains Abate values.
- Citation previews show all four copies by default and packet generation checks completeness.
- Correction reviews display monetary values using their recorded dollar/cent units.
- Best Interest Extensions use Reasons plus the retained safety confirmation, with no signer block; earlier formats remain unchanged.
- Current order language displays 27.05(2)(g)2 without changing its canonical charge identity.
- Helper build 62; case schema 5, summary 6 and backup 2 unchanged. City/native acceptance remains open.

## 2026-10-22 R60 — Workspace and item history (development)

- Workspace now owns prominent import/shared-search entry; the import rail destination is removed.
- Missing corrective-action details use an accessible application dialog with stale-context checks.
- Reinspection batch dates are visible beside item review, with eligibility validation and selected counts.
- Editors can show all four distinct citation copies; final packets retain all copies per charge.
- Editor mailing addresses flow below expanding headers without changing approved print geometry.
- Authoring-14 referrals show item-specific observations and Days Outstanding from first observation to correction, or latest observation while outstanding. Historical formats remain unchanged.
- Helper build 61; case schema 5, summary 6 and backup 2 unchanged. City/native/staff acceptance remains open.

## 2026-10-22 R59

Helper 2026.10.22.60, helperBuild 60; authoring 13, schema 5, summary 6 and backup 2 unchanged. Writer workflow and screen consistency. Inspection candidates show type, date, inspector and status, the selected one is highlighted, and a used inspection explains why it cannot be imported; the helper refuses a new document whose imported inspection is already recorded on the case. An item with several ordinance sections offers a select of those sections with no default, and the deposit fields fill from the configured schedule for the pricing date. A visit imported from a CA Reinspection is accepted. Warnings and errors clear after 15 seconds and stay in Message history. Violation Items opens the violation list; Review opens a dialog; Print preview is removed and Issue returns to Workspace with the issued case highlighted. The remove button no longer covers the due date's calendar button above 860px. Writer screens and the Reports chrome share one set of type sizes (generated and printed documents unchanged). Adds open acceptance items S59-1 to S59-6.

## 2026-10-22 R58

Helper 2026.10.22.59, helperBuild 59; authoring 13, schema 5, summary 6 and backup 2 unchanged. Desktop launch and safe exit (kpbunnow/madison-document-writer#29). Stage A: the Document Writer desktop icon starts the program without a console (pythonw launcher, hidden detached helper, reuse of a running compatible helper, Chrome/Edge app window in the existing profile, Windows dialogs for startup problems, rotating logs/launcher.log and --open-logs, application icon and favicon); Start Document Writer.bat remains the IT diagnostic launcher. Stage B: Exit Document Writer in Tools & settings saves device drafts, lists unresolved work from existing state, refuses during issuance, PDF filing or device-save failure, and calls the new authenticated POST /helper/shutdown, which refuses with reasons (409) while the helper runs another request, holds a lock or installs an update, and otherwise stops serving; open Writer and Reports windows show Document Writer has stopped. The launcher never stops a running helper. Fixes the R51 update suite that ran no tests (missing unittest entry point) and the email message that named the batch launcher. Adds open acceptance items L58-1 to L58-9. Review corrections: a changed verified update restarts the installed launcher in a fresh process; damaged required-file metadata shows the repair dialog; integrity anchoring counts as active work for Exit; exit preparation can be cancelled and re-reviews new work; an unknown PDF outbox status needs acknowledgment; stop notifications are scoped to the helper instance; a stopped Writer releases its workspace lock and Reports handoff. After upgrading from R57 or earlier, the desktop shortcut is migrated at the second start.

## 2026-10-22 R57

Helper 2026.10.22.58, helperBuild 58; authoring 13, schema 5, summary 6 and backup 2 unchanged. Usability follow-up merged in kpbunnow/madison-document-writer#26: Save actions are named by destination (Save draft & return to Workspace, Save case to shared folder, File issued PDF, Create recovery copy on this device); Workspace quick views with More views; Remove from this workspace never deletes the shared record; Recipients ends with Done; backups are grouped by device and workspace; Reports exports read Current report — CSV and Reports workbook — Excel. The editor has one readiness summary (Go to first required field, Open full checklist), selects notice items for a shared due date in their rows with Apply date to selected items, and new Best Interest/Vacancy Extensions mark Affected beside each due date; the Inspection section appears only when actionable. Search this workspace, Search shared case records and Find Accela inspection name their scopes; Open case in Writer and Back to Reports / Open Reports ↗; reinspection offers Review all items or One item at a time with a step indicator; narrow editor screens get a compact header and bottom task bar; Browse language, Select for this notice, Review catalog and a collapsed Administrator tools group. Fixes affected-item check links that pointed at no field and removal toasts shown after a refused removal. Adds open acceptance item S56B; a new release identity requires the release owner's authorization. Review corrections: an issued document without a linked shared folder offers Download workspace backup and Connect shared folder; views keep the search and inspector filter; Back to Reports restores the saved report in an open Reports tab and clears an intervening drill-down or saved view; print pagination ignores screen-only row controls; notice rows reflow at 320px; the export note and workbook About sheet state each sheet's scope; a late save repaint keeps focus in the field being typed.

## 2026-10-21 R56

Helper 2026.10.21.57, helperBuild 57, authoring 13; schema 5, summary 6 and backup 2 unchanged. Writer simplification requested by the division: the document's Preview mailing address button, the notice's Property record details parcel field, the Other initial inspection actions panel and the bottom Add violation item button are removed; one Recipients button opens copies, email and registered agent; Cite is offered only when the imported Accela status is Citation. A notice still requires a 12-digit parcel, now corrected in Accela and re-imported. New Best Interest and Vacancy Extensions (authoring 13) require a later due date for each affected item, entered in Items and due dates; Vacancy Extensions are always dated. Authoring-12 and earlier documents are unchanged. Adds acceptance item S56 and extends P7.


## 2026-10-21 R55

Helper 2026.10.21.56, helperBuild 56; authoring 12, schema 5, summary 6 and backup 2 unchanged. Verification binds all deployment inputs and generated helper/release files; packaging checks staged bytes and an explicit source inventory, excluding local credentials/environments/operational data. Reconciles current import rules and security guidance, regenerates all manual editions, preserves fixture ownership and consolidation provenance. Carries the consolidation refactors, approved-language extraction and central helper route guards. City acceptance and legal holds remain open.

Snow citation fields (snowfall date, inches, condition, photographed) keep keyboard focus when the editor repaints in the background, for example when shared citation history finishes loading; previously focus fell to the page and further typing was lost. This was the cause of the intermittent browser_r34 failure.

Post-PR #16 corrections (identity retained; R55 had not been distributed): case, integrity and tool text is read and written as explicit UTF-8, so Unicode cases verify on Windows code pages; outbox transfer and direct filing share one per-name lock and never replace an existing PDF; packaging verifies and archives exactly the approved staged files; the manual builder stages and validates all editions before replacing them together, and each edition carries a source digest. Adds acceptance item C10. No format version changes.

Post-PR #19 correction: one summary with a non-text `sourceFile` (or a case file that is not a case record) is excluded as unreadable instead of failing the whole Reports index with HTTP 500; healthy summaries remain available. No format version changes.

Post-PR #18 correction: Reports summary validation distinguishes JSON booleans from numbers on save and read (a withdrawn notice's `noticeActive: false` altered to `0` was accepted and counted as active). No format version changes.

Post-PR #17 corrections (identity retained): Reports uses a cached summary only when its reported facts equal the helper's projection of the verified case; a summary changed on its own (owner, status, dates, documents, violations, citations) is excluded and explained with the rebuild step, and the helper refuses to write one. Adds helper/case_projection.py and its generated projection_tables.json to the deployment. Policy scripts read and write UTF-8 explicitly. No format version changes.

Staff quick guides and the program manual (Markdown, HTML, PDF, Word) no longer name files that do not ship (R49/R51-ACCEPTANCE-RECORD.md, R50_Program_Instruction_Manual.pdf) or tell staff to confirm an R50/R51 build; the manual's compatibility paragraph states authoring 12 with the rollback caution. The install guide states authoring 12. No program change.

## 2026-10-20 R54

Helper 2026.10.20.55, helperBuild 55, authoring 12. Newly authored Best Interest and Vacancy Extensions use the regular Extension's layout, items table, continuation pages, footer and copy handling, with unchanged approved language and the supervisory signer after the table. Conditional vacancy items show "Conditional — see conditions above" without changing stored repair dates; editing the shared table clears supervisory review. The regular Extension, authoring-11 and earlier documents and their corrections keep their existing output. Case schema 5, summary 6 and backup 2 are unchanged. Adds acceptance item P7 (native side-by-side extension printing).

## 2026-10-19 R53

Update recovery (signing-era detection, stale-file message, prepare_deployment.py, diagnostics, bounded link checks); documents follow the Accela inspection type and status, replacing Choose next action; group due dates on reinspection worksheets with Undo; top-of-page warnings clear after 15 seconds into Message history.

## 2026-10-18 R52

Removed release signing (key lost; option 3). Updates are checked against runtime-manifest.json for exact files, sizes, SHA-256 and no downgrade; deployment-folder permissions guard against deliberate tampering. Fixed the date-dependent document comparison. Install guide, manual and developer docs updated; stale and duplicate guide sections removed. Signing-era (R50/R51) installs need a fresh first installation.

## 2026-10-18 R51

Trusted local launcher handoff precedes shared sibling imports. Builds and tests read maintained folders directly; generated output stays under build/. Explicit helperBuild migration, stable manual routes, descriptive module names, browser preflight and font-independent authored-content/layout checks retain existing document behavior and all City holds.


## Orders archive compatibility and verification details

- Recognize the established top-level Orders archive as data, leaving existing order PDFs, Word files and metadata untouched. Its contents are not enumerated or installed.
- Keep verification of all program files and vendor dependencies; an Orders directory nested inside vendor receives no exemption.
- Show grouped missing/extra locations and the changed file name on refusal instead of hiding the underlying reason.
- Add first/repeated installation tests with an existing archive, retained local work and a nested-code refusal.

## 2026-10-17 R50 startup correction

- Prevent launcher imports from creating unsigned Python caches before verifying the signed deployment. Both Windows Python command paths use bytecode suppression; the Python entry point also suppresses cache writes before sibling imports.
- Add a regression that fails on the delivered 16 October launcher and exercises first and repeated installs with default Python settings, signed inventory, retained local settings and unfinished-work sentinels.
- Retain exact file-inventory, signature, hash and downgrade checks. Use a clean complete deployment to avoid caches left by an earlier failed extraction.
- Existing R50 manual remains applicable; the generated installation guide includes the correction and recovery steps.

## R50

Signed updates, private helper sessions, renderer/CSP containment, trusted connections, error/dead-code cleanup, direct modules, repository simplification, current manual and corrected inspection-result eligibility.

## R49

Bounded read-only reporting concurrency, production-readiness record and complete operating manual.

## R48

Report navigation, filters, coverage, exports and measured responsiveness.

## R47

Approved-language discovery, separate administration and private-edit retention.

## R46

Focused reinspection walk-through, progress, Undo and action choices.

## R45

Inspection choice, draft continuation and delayed-result isolation.

## R44

Saved-work and connection tools.

## R43

Compact charge completion and citation readiness.

## R42

Task-based document editing.

## R41

Workspace prioritization and next actions.

## R40

Integrity, migration/anchor, original-PDF and installation safeguards.

## R39

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R38

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R37

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R36

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R35

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R34

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R33

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R32

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R31

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R30

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R29

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R28

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R27

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R26

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R25

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R24

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R23

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R22

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R21

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R20

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R19

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R18

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R17

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R16

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R15

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R14

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R13

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R12

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R11

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R10

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R9

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R8

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R7

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R6

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R5

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R4

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R3

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R2

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R1

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.
