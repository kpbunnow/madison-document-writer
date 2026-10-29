# Maintainability development checkpoints

Owner-requested follow-up to the October 27, 2026 maintainability plan. This work
preserves behavior, release identities, persisted formats, print bytes and security
authority. Each focused increment uses targeted local checks, then the full GitHub
gate on its final committed head before an explicitly authorized merge.

## Sequence

1. M0: reproducible complexity baseline and regression ratchet.
2. M1: repaint keepers and routing, with ordered focus/state regression protection.
3. M2: browser decision rules, then Python refusal validators, one function per PR.
4. M3: workspace action dispatch, screen sections and pagination nesting.
5. M6: independent owner test seams before broad state/markup work.
6. M4: owned state slices and narrowed lazy service interfaces.
7. M5: escaping screen templates; frozen print renderers remain excluded.

## Measurement

Run `node tools/complexity_report.cjs --report` for JSON findings, or run without
arguments to check the committed baseline. Python uses the current interpreter's
Ruff (`DW_PYTHON` may select an explicit executable). The regression suite invokes
the same report and exercises new/worsened/improved/removed findings. Improvements
must lower the reviewed baseline; the tool never rewrites it.

JS uses ESLint complexity >20, depth >4 and nonblank/noncomment function length
>80. Lexical function identities avoid line-number churn; anonymous sibling
ordinals can change after extraction and must be reviewed as removed/new findings.
Nested factory lengths include their nested methods. Depth counts report sites;
the ratchet stores the maximum depth per lexical owner.

The starting source reproduces 88 complexity reports, 13 depth reports and 143
length reports (79 non-factory plus 64 factory reports in the original review).
Ruff reproduces **35** C901 violations across the 50 maintained Python files in
helper/tools/policy, excluding vendor and inert history. The supplied plan's 37
across 53 files is not reproducible in this maintained scope; vendored/history
code is not added to development debt to fit that number.

No standardized cognitive-complexity score is claimed. Count reductions and full
gate evidence measure progress; a review score remains a reasoned assessment.

## M1 repaint phases

Private capture/restore keepers preserve the original capture and enhancement
order. Live text swaps happen before enhancement; its focus/caret restore happens
last. Routing reads current state after walk context and again after renderer
redirects. The public 24-input lazy factory interface remains unchanged.

The new real-Chromium owner test passed against the original implementation before
extraction and passes after it. Existing screen dependency assertions also pass.
JS complexity violations fall 88 → 87 and length reports 143 → 141. No function
in app_screens exceeds complexity 20 or 80 nonblank/noncomment lines.

## M2 first decision owner: citation deposits

Ordered named rules retain early-success boundaries for mandatory appearances,
unchanged corrections and approved totals. The coordinator and every rule stay
below complexity 10. A frozen test-only pre-refactor function provides differential
comparison over all generated policy rows, format versions, modes and 3,000 seeded
malformed combinations (11,685 cases total), including service-call precedence.
Production exports, factory inputs and stored charge fields are unchanged.
Complexity violations 87 → 86; length reports 141 → 140.

## M2 document readiness

Readiness facts retain their original eager evaluation order, followed by ordered
mailing/item/compliance/citation/inspection rule tables and the existing delegated
checks. Targets are built at their original phase, including the intentionally
different deposit calls in counts versus target selection. No validation is
reclassified as pure: preparation and delegated effects remain in place.

The original factory test and 3,002 differential generated documents preserve
exact rows, targets, lazy service reads and effect order. Every extracted rule
and coordinator stays below complexity 10. Complexity violations 86 → 85;
length reports 140 → 138. Historical assertions and output references remain.

## M2 special-document checks

Named historical-family stages retain the first-match scope/family selection and
the existing affected-item synchronization. Shared review, nuisance, occupancy
release, restriction, all-item and selected-extension checks are independently
readable sections, each below complexity 10. The final printed-placeholder check
still runs last. The printed renderer itself is unchanged.

A 5,000-case seeded historical corpus compares exact rows/targets, mutation and
service-call order against the original function. Malformed legacy date inputs
also compare the same exception and partial effects; no behavior fix is folded
into extraction. Complexity violations 85 → 84; length reports 138 → 137.

## M2 Accela decision plan

The decision core separates source facts/warnings, candidate selection, ordered
inspection-date rules, existing-work/referral refusals, snow handling and record
differences. The date rule list keeps first-match behavior. Candidate selection
mutates the original selection and serial at the original checkpoint. Historical
source lookups and live state remain call-time operations.

The independent import-service audit and a 3,003-case generated-report corpus
preserve full plans, source mutation, selection serial and service-call order.
Every extracted decision helper and baseLookupPlan stay below complexity 10.
Complexity violations 84 → 83; length reports 137 → 136.

## M2 Python special facts

The helper's special-field validator now delegates named scope/family/date
checks through explicit keyword-only inputs. Checks remain sequential rather
than eagerly constructing arguments for later phases: a malformed later field
must not preempt an earlier refusal. Every extracted function and coordinator
has McCabe complexity below 10. Helper authority and review evidence semantics
are unchanged.

The existing R26 storage tests and 3,000 seeded historical snapshots pass. The
new comparison retains exact exception type/message, calendar/time query order
and input mutation. Python C901 findings fall 35 → 34.

## M2 Python authoring

Document/date rules and per-citation identity, calendar, method, retained-basis,
policy, mandatory-appearance and cash-deposit checks now have explicit owners.
The item loop still appends a validated citation number at its original point,
and retained/mandatory success still skips later pricing checks. All extracted
checks and the coordinator remain below McCabe complexity 10.

The original nine authoring storage tests and 3,000 seeded historical citations
compare exact outcomes, calendar query order and mutations. Python C901 findings
fall 34 → 33. Decimal arithmetic and policy/time cutoffs remain unchanged.

## M2 Python publication

Identity/signer/date, snow, notice, follow-up source/visit/outcome and new-citation
number checks now have named boundaries. Snow and scoped-action terminal paths
still skip ordinary follow-up checks; current-source lookup remains before the
notice branch. The original inspection/mailing/referral refusal order is retained.
Every extracted function and the coordinator remain below McCabe complexity 10.

Fourteen original lifecycle/storage tests and 3,000 fixture-derived/generated
publication contexts pass, preserving exact exceptions and calendar calls.
Python C901 findings fall 33 → 32. Publication locks, integrity and actual writes
are outside this change.

## M2 Python history replay

History keeps head validation before dispatch, then explicit issued/visit/void/
service/note owners. Issued records retain snapshot/time, special, authoring,
publication and correction order. Correction target, scoped facts, item identity,
review chain and visit amendment checks are separate, with superseding only after
all checks. Snow/override validation and pricing keep their original checkpoints.
Every extracted function and coordinator stays below McCabe complexity 10.

The existing 24 helper tests, 14 lifecycle tests and 3,000 seeded fixture-derived
histories preserve exact refusals, delegated-call order and partial mutations.
Python C901 findings fall 32 → 31. Locks, authority and stored event semantics
are unchanged.

## M2 Python case saving

Case-number locking still encloses target resolution, reconciliation, read/merge,
recovery backup, validation, integrity commit and publication. Metadata and event
merge phases are named; an acknowledged idempotent retry still anchors and returns
before stale metadata, recovery or a fresh publication can be applied. Catalog
review retains its nested lock and validation-before-write order. Every extracted
function and _save_case stay below McCabe complexity 10.

The original 24 helper tests pass. A 101-request old/new real-filesystem sequence
compares outcomes, input mutations, lock/write order and exact case/recovery bytes.
Its synthetic anchor clock is fixed so independently timed status records are
comparable; initial differences were clock-only and no assertion was relaxed.
Python C901 findings fall 31 → 30. No stronger save acknowledgement is claimed.

## M3 workspace action dispatch

The click listener keeps target lookup, work capture, show-all and awaited
navigation in place. Remaining workspace and document actions use two ordered
feature dispatch tables; the current document is still fetched only between
those phases. Runs are synchronous unless the original action returned a promise;
no permission-sensitive call gains an await. All existing peer event owners keep
their responsibilities and the 60 registrations keep their exact order/capture.

The registration audit and 1,078 differential action/overlap cases compare results,
state, full effect order and the synchronous call prefix. Complexity violations
83 → 82; length reports 136 → 134.

## M3 Workspace sections

Workspace row headings, verification warnings, document links, dates, quick views,
case table and surrounding content now have named section renderers. Expressions
and their evaluation order remain unchanged; sections receive only their local
facts and retain live state reads. No function in workspace_screen exceeds 80
nonblank/noncomment lines or complexity 20.

The original screen-owner audit and 1,033 exact HTML snapshots from the frozen
pre-extraction function pass. Every snapshot renders successfully and compares
state mutations and service lookup order as well as byte-identical markup. The
corpus covers empty, queue/filter, proof, draft, deadline and import states; the
full gate retains the separate production accessibility checkpoints. Complexity
violations 82 → 80; length reports 134 → 131.

## M3 modal sections

Modal dispatch keeps its original precedence and delegates send, recipients,
workspace removal, storage, folder and finalization to named renderers. Copies,
email rows and final recipients have separate sections. Every function in
screen_overlays is at most 80 nonblank/noncomment lines and complexity 20.

The original screen-owner audit and 1,026 exact pre-refactor HTML snapshots pass,
including recipient errors, company agents, corrections, busy finalization,
folder filters and storage modes. Every snapshot renders and retains state and
lazy service lookup order. Complexity violations 80 → 79; length 131 → 129.
Frozen print renderers and screen-shell references are untouched.

## M3 reinspection sections

Worksheet rendering now separates item facts/result fields, walk mode, visit
header/progress/filters, prior visits, body and verdict. Only string-valued top-
level markup operands are regrouped at section boundaries; their evaluation order
and exact bytes remain protected by comparison to the original renderer. Missing
worksheet/source redirects still happen before presentation. All new renderers
and screenReinspect stay within complexity 20 and 80 nonblank/noncomment lines.

The independent reinspection audit and 1,026 exact HTML snapshots pass, including
all outcomes, carried results, walk stages, date/filter states, retained drafts,
closed inspections and missing-source redirects. Every snapshot renders and
retains state and service lookup order. Complexity violations 79 → 77; length
reports 129 → 127. Other workflow functions in the same owner are unchanged.

## M3 pagination nesting

History-row continuation, note fitting, observation fitting and continuation
cleanup are named phases. Snow table handling uses an early continue rather than
a nested else. Page creation, binary-search/word-boundary rules, furniture and
measurement order are unchanged. No pagination function nests beyond four levels.

The existing pagination audit and eight native-Chromium differential layouts
compare exact page HTML and every overflow/limit measurement, including long
Unicode notes, observation continuations, snow tables, mobile flow and historical
page limits. All note characters are retained. The unchanged 69 authored print
variants and their overflow/clipping/missing-copy mutation checks pass locally.
JS complexity findings 77 → 76; nesting reports 13 → 3; length reports 127 → 125.
The full GitHub gate remains required before this increment merges.

## M3 language focus nesting

The ordered control-attribute search is a named helper. Search caret and disclosure restoration stay unchanged; catalog-field identity still includes its catalog key. The independent DOM focus test passes. No selection/approval, markup or persistence policy changes.

Measured counts: {'complexity': 76, 'max-depth': 3, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 2, 'max-lines-per-function': 125, 'python': 30}.

## M3 report loading nesting

Parcel-result merging is a synchronous helper called after the same awaited request. No await or cancellation checkpoint is added. The independent actual-transport test passes for chunk boundaries, partial results, token propagation and superseded reads; Reports stays read-only.

Measured counts: {'complexity': 76, 'max-depth': 2, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 1, 'max-lines-per-function': 125, 'python': 30}.

## M3 safety action nesting

Pending safety actions delegate a synchronous scoped helper. The existing document branch, holder lookup, unawaited amendment dispatch and no-holder behavior are unchanged. The new independent seam and 60-listener registration audit pass. No authority or persistence guarantee changes. No maintained JS function now nests deeper than four levels.

Measured counts: {'complexity': 76, 'max-depth': 1, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M6 test seam inventory

The inventory distinguishes whole-application evaluation, independent owner/VM construction and production browser evaluation. Textual hook candidates are explicitly not treated as proof of unused hooks. The initial migration baseline has 91 bundle evaluators and 74 retained core hook fields. No existing assertion or production hook is removed by this increment.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M6 Reports error seam

Old access: getJSON and orderedRows names injected into the Reports application bundle by bundle_test. New access: createReportsServices(...).getJSON plus direct report_presentation.orderedRows, evaluated as independent owners with explicit synthetic transport services. The original 502/unreadable, default row order and warning assertions are unchanged. No Writer/Reports startup is run. Whole-application evaluator files fall 91 → 90; no production hook is retired yet.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M6 save serialization seam

Old access: saveCaseFile plus mutable kase/caseFileName/caseFile/transport names inside the application eval. New access: createCaseSaveWorkflow services and live synthetic WriterState cases; the real filename/query owners are used. Every original false/no-write/export-error assertion remains, with an added check that initial serialization failure never reaches merge. Whole-application evaluator files fall 90 → 89; no production hook is retired yet.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M6 catalog cache seam

Old access: screenLibrary/refreshCatalog plus mutable helper/render globals in the application eval. New access: real catalog queries/key, createLanguageCatalog, createLanguageDiscoveryContext and createLanguageViews with explicit transport/cache adapters. All original cached/current/offline caption and verification assertions remain unchanged. Whole-application evaluator files fall 89 → 88; no production hook is retired yet.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M6 disclosure seam

Old access: render and mutable screen/enhancement globals in the application eval. New access: createAppScreens with explicit render/enhancement adapters and a real DOM. Every original same-document/open-pricing, absent initial-options and changed-document reset assertion is retained. Whole-application evaluator files fall 88 → 87; no production hook is retired yet.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M6 record form seam

Old access: application startup, newDoc, render and internal record-form globals. New access: createRecoveryEvents.registerWorkingInput and createCorrectionUI.recordActionModal with a real DOM and explicit live form-key/save adapters. The capture-phase replacement listener stays before the actual input owner. Both original typed-value and repaint assertions remain unchanged. Whole-application evaluator files fall 87 → 86; no production hook is retired yet.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M6 date boundary seam

Old access: date and court-policy names retained inside the application eval after startup. New access: shared calendar, calendar owner, citation policy and createCourtScheduling with the explicit test day. All original assertions across UTC/Los Angeles/New York and both Chicago midnight sides remain, including helper day parity, mailing limits, fees, court dates and rolling windows. Whole-application evaluator files fall 86 → 85; no production hook is retired yet.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M6 production contract seam

Old access: public contract functions plus application-bundle eval for fixture exclusion. New access: direct contract owner compilation and a native Chromium production entrypoint helper. All original exact event/request identity, source parse/fixture exclusion and runtime empty-case/undefined-fixture-function assertions remain; MADISON_TEST_DATA is set before native startup to prove production ignores it. Local Chromium and transitive serial-suite classification checks pass. Whole-application evaluator files fall 85 → 84; no production diagnostic hook is installed or retired.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M6 folded hook consumers

The read-only inventory folds constant string concatenations and String.raw payloads before identifying possible diagnostic consumers. Tests pin split-name detection and direct bundle-harness invocation. This closes an important gap in raw-text searches without claiming static matches prove execution or unused hooks. The 84 remaining application evaluator baseline is unchanged.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M6 import diagnostic retention

Twenty import diagnostic retention entries have no folded JS/helper/browser consumers or Python test-text references. Public core exports and import service interfaces are preserved. The independent import audit, seven original Accela scenarios and 23 selection assertions pass. Both production HTML files are byte-identical before/after removing these test-only fields. A new retained-hook baseline guards explicit review. Fields fall 74 → 54; current-head full CI remains required before merge.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 live workspace state boundary

Thirteen record/save owners now use a 16-field workspace boundary. Accessors resolve the current existing root store on every read/write; construction performs no reads and initializes nothing. Tests pin absent values, replacement identity and getter/setter timing. Existing dependency, serialization, import and 19,687 differential rule cases pass, as do all six day-boundary runs. The first day-boundary invocation lacked PYTHONPATH; rerunning with the documented environment passed. Direct root-state importers fall 83 to 71, with zero cycles. View-pointer capture and remaining state cohorts are deferred to separate increments; M4 is not complete.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 catalog state boundary

Catalog forms, events, language actions, views and review services use an explicit six-field catalog boundary. Existing cached-status, independent service, catalog feature and 27 language-review assertions pass unchanged. Initialization stays in core and no approval or review authority is inferred. Getter/setter tests pin absent values, live replacement identity and access timing. Direct root-state importers remain 71: the new boundary offsets the migrated catalog-forms importer. The graph remains acyclic. Other state cohorts and interface narrowing remain open.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 startup coordination state boundary

Seven lifecycle and screen/event owners use the eight-field startup coordination boundary. Core still initializes promises, channel and lock state in the original order. Existing startup tests pass all stages, helper branches, lock refusals and restore barriers; handoff latest-request and channel tests and screen repaint/startup tests pass. The boundary reads no fields at construction and preserves live promise/function identities. Direct root-state importers are 72, including the new boundary: these mixed lifecycle owners retain other root fields until their cohorts migrate. The aggregate remains below the initial 83 and cycles remain zero. No service construction reads are introduced.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 import coordination state boundary

Four import and navigation event owners use the five-field import coordination boundary. Initialization, abort/controller identity, serial increments and pending-selection guards remain in their original checkpoints. Independent import service tests, seven original import feature scenarios and 23 selection assertions pass. The root importer count is temporarily 73 because these mixed owners retain workspace/editor state; this remains below baseline 83 and all cycles remain zero. Other cohorts and removal of the remaining mixed imports follow separately.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 recovery coordination state boundary

Five recovery/exit owners use the six-field recovery boundary. Existing independent automatic recovery and case recovery tests pass, including serialized latest-state, retry/deduplication, selection guards, backup-before-confirmation and rollback retention. Recovery history and desktop exit assertions pass unchanged. Import construction remains inert and queue identities remain live. The root importer count is temporarily 74 as mixed owners retain editor/workspace fields; cycles remain zero. This cohort introduces no new state keys or persisted formats.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 editor view and local state boundary

Eleven editor/record owners use a sixteen-field editor boundary. Direct state reads follow the current view object, while an explicit local capture retains the original pointer; tests pin both behaviors. Existing correction-service, deadline and correction-feature checks pass, as do all eight native pagination scenarios with exact page HTML and measurements. The initial browser invocation omitted DW_BROWSER; the documented Chromium fallback rerun passed. Direct root-state importers fall 74 to 71; no state is initialized during import and cycles remain zero. Remaining callers migrate in bounded batches.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 reinspection editor-state callers

Reinspection workflow, entry and events now resolve their editor view/work fields through the existing editor boundary. No new surface or initializer is added. All 1,026 exact HTML snapshots and independent reinspection service, walkthrough and R46 reinspection assertions pass unchanged. Explicit view captures and live work-buffer access keep their prior timing. The mixed owners still import workspace fields directly; direct root importers remain 71 and cycles remain zero.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 editor workflow state callers

Editor screens/events, new-document rules, publication and record commit use the existing editor state boundary for view/work and interaction fields. Independent editor, publication and record-commit tests pass, as do 5,000 differential special-rule cases, original editor screen scenarios and R59 editor flow assertions. No state keys, interface services, print layout or initialization checkpoints change. Mixed workspace fields remain for their own migration; direct root importers remain 71 and cycles remain zero.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 import and catalog editor-state callers

Import and catalog owners now read their view/work fields through the existing editor boundary. Independent import/catalog services, cached review checks, seven original import scenarios and 27 language assertions pass. The import fixture emits the existing JSDOM scrollTo-not-implemented diagnostic but completes every assertion; no runtime adapter or assertion was changed. Explicit view captures remain original pointers. Direct root-state importers fall 71 to 69 and cycles remain zero.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 lifecycle editor-state callers

Screen repaint, recovery, handoff, navigation, device persistence and exit owners use the existing editor state boundary. Automatic/case recovery, handoff, screen dependency and desktop exit assertions pass unchanged, including deferred work, rollback retention and original startup barriers. No view pointer is copied or initialized. Direct root importers remain 69 because mixed workspace/helper fields are still direct; cycles remain zero.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 remaining editor-state callers

Remaining workspace, storage, record, worksheet and delivery owners use the existing editor boundary. Exact Workspace/overlay HTML and workspace dispatch comparisons pass across 3,137 cases; worksheet, workspace queue, backup, delivery and safety tests pass unchanged. AST inspection found no shadowed cohort aliases. This completes editor-root caller migration outside core; explicit captured view pointers remain unchanged. Direct root-state importers fall 69 to 64, with zero cycles. Other root cohorts still require migration.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 workspace storage and artifact state

The workspace boundary now covers 25 existing record, connection, timeline and artifact fields, without new keys or initialization. Eight storage/record owners migrate their workspace fields. Existing artifact stale-identity/retained-PDF, activity/timeline, folder, database, backup and queue assertions pass; all 25 field accessors retain live identity and timing. Direct root-state importers fall 64 to 57 with zero cycles. An initial unformatted accessor list was missed by the local migration helper and caught by ESLint; the corrected migration passes. Remaining workspace callers follow in separate bounded batches.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 catalog and recovery workspace-state callers

Catalog/import, recovery, folder and status owners use the existing workspace boundary. Independent import/catalog, cached-review, synchronous folder picker, recovery, handoff and device-restore assertions pass unchanged. This preserves stale-selection guards, original permission checkpoints and live restored arrays. Direct root-state importers fall 57 to 53; mixed helper/session state follows separately, and cycles remain zero.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 remaining workspace-state callers

Remaining record, screen and event owners use the existing workspace boundary. Eight differential rule/HTML/dispatch suites retain exact assertions across 26,853 cases; native pagination retains exact page HTML and measurements. Removal of incidental production imports exposed a historical-test composition dependency: an explicit test-only import now supplies the unchanged frozen functions with their original WriterState binding. This fixes the reference scope without changing any reference bytes or assertions. Publication ordering and both state boundary tests pass. Direct root-state importers fall 53 to 27, with zero cycles; helper/session fields remain for the final startup cohort.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 helper session and handoff state

The startup boundary now covers twelve existing startup, session and handoff fields. The remaining sixteen mixed owners migrate their helper/handoff access. All independent startup, handoff, folder, recovery, artifact and delivery assertions pass, alongside exact overlay, import-plan and dispatch comparisons and original desktop exit tests. Core retains every initialization checkpoint. Direct state.js importers fall 27 to 11: six Writer boundaries, Writer core and four Reports owners. No feature owner accesses WriterState directly. Boundaries are 25/16/12/6/6/5 fields with zero cycles. Interface narrowing and explicit composition remain open.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 editor screen service groups

The editor screen interface is split from 32 fields into explicit UI/edit/record groups of 8/5/19 fields. Core keeps each original lazy forwarder and getter and the original construction/copy-registration checkpoint. The contract audit recursively verifies exact used dependencies, no spreads, deferred leaf reads and a 25-field cap at every interface. Existing independent editor behavior assertions remain unchanged. A long carried-item hint is named as screen copy without changing its bytes. Five original editor screen scenarios and R59 editor-flow checks also pass on the committed source. Negative composition fixtures reject eager leaves, spreads, undeclared/computed accesses, unused fields and widths above 25. Further event/workflow interfaces and core forwarder reduction remain open.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 editor event service groups

The 38-field editor event interface becomes explicit UI/event-routing/action groups of 6/7/25 fields. Core retains the same lazy leaves; construction still reads no services, all sixty listener registrations and synchronous user actions remain in their original positions, and duplicate registration is still refused. The recursive contract guard now applies to grouped event composition. R59 editor flow, all five original screen scenarios and replaced-DOM record-note continuity pass unchanged. Other large interfaces and core forwarder reduction remain open.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 workspace event service groups

The 36-field workspace event interface becomes explicit UI/event-routing/case-operation groups of 6/9/21 fields. The historical dispatch reference receives its original flat test services, while the current factory receives the same adapters through named groups; all 1,078 exact outcome/effect comparisons pass. All sixty listener checkpoints, synchronous permission calls, fourteen workspace queue assertions and five editor scenarios pass unchanged. No extra listener or async boundary is introduced. An initial wrapped property access was caught by the exact interface and dispatch tests, then corrected; both pass on the final source. Other large interfaces and core forwarder reduction remain open.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 recovery event service groups

The 30-field recovery event interface becomes explicit UI/recovery/publication groups of 4/18/8 fields. Lazy service construction, all sixty listener checkpoints and replaced-DOM form continuity pass unchanged. Recovery export naming is a private pure helper, with an independent public-event test pinning the original filename, JSON bytes, synchronous invocation and selected identity. No stored format changes. Reinspection remains the final over-wide interface; core forwarder reduction is still open.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 reinspection service groups

The final over-wide 30-field interface becomes explicit UI/inspection/authoring groups of 5/16/9 fields. The exact composition audit verifies all used paths, lazy leaves and the 25-field limit. Independent workflow outcomes, undo/focus/save order and all 1,026 exact historical worksheet snapshots pass unchanged. Historical rendering keeps its original flat adapters in an explicit test-only closure; current production receives named groups. A private check-panel renderer is separated without changing its public wrapper or HTML. All measured Writer interfaces are now at most 25 fields. A broader scan found a 40-field Reports screen interface, which also needs narrowing; core forwarder reduction remains open.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 Reports screen service groups

The additional 40-field Reports screen interface is narrowed to 24 root fields, with thirteen fact helpers and five spreadsheet dependencies in explicit groups. Existing lazy getter identity and construction/deposit ordering pass. Reports, R48, R21 and R61 ordinance assertions pass unchanged, including workbook generation. JSDOM emits its canvas-not-implemented diagnostics while the assertions pass; native browser proof remains the required full gate. A private pure column-name helper preserves the public per-instance wrapper. The contract guard permits computed data lookup only after a statically declared service leaf, while rejecting computed interface paths; positive and negative fixtures pin this distinction. All scanned Writer/Reports injection objects are now at most 25 fields; core forwarder reduction remains open.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 scoped architecture guard

A read-only inventory now inspects 113 statically declared Writer/Reports injection interfaces, including nested groups: the largest has 25 fields and no spreads/computed interface keys. An architecture regression guard pins eleven state.js importers, six bounded owners covering exactly seventy disjoint root fields, and zero cycles. Existing grouped service, event, editor, reinspection and Reports contract tests pass. Namespace internals and behavioral coupling are explicitly outside this field-width measurement. Core forwarder reduction remains open.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 declared editor composition

A stateless per-owner adapter generates deferred callbacks/getters from explicit ordered resolver declarations. It stores no global registry and reads no dependency during construction. The first editor screen composition replaces 27 handwritten forwarders and five getters; scoped widths remain 8/5/19. Independent tests pin original property order/descriptors, callback name/arity, per-instance identity, live rebinding, synchronous error and Promise identity, and no early access to uninitialized bindings. Static contracts accept only named synchronous zero-argument resolvers and explicit value names; eager calls, spreads, unknown adapters and malformed metadata fail. Existing editor/architecture/dependency checks, five screen scenarios and R59 flow pass. The inventory still measures 113 interfaces at a maximum of 25 fields; no startup checkpoint changes.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 declared event composition

Four grouped event/worksheet compositions replace 110 handwritten forwarders and 24 getters with explicit ordered declarations. The existing adapter preserves live target lookup, callback/value identities and descriptor order; feature construction remains inert. All sixty listener registrations, independent editor/reinspection contracts, architecture widths, 1,078 dispatch and 1,026 worksheet comparisons, R59 editor flow, walkthrough and replaced-DOM form continuity pass. No new asynchronous boundary, startup checkpoint or state field is introduced. Further flat core compositions remain to migrate.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 declared domain composition

Eight domain compositions replace 83 handwritten forwarders and thirteen getters with explicit ordered resolver lists. Forty existing contract readers accept the independently verified generated descriptor shape while retaining every exact dependency, timing and behavior assertion. All forty suites pass on the new source, as do architecture/listener guards, seven import scenarios, original deposit assertions and snow repaint. The migration validates that each old callback is a synchronous transparent rest-argument forwarder and each getter is a single identifier return before rewriting. No policy, data, print or release identity changes.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 declared shell composition

Twelve shell, screen and helper compositions replace 52 handwritten forwarders and 25 getters with explicit ordered declarations. Existing screen, shell, helper and feature contracts pass, including popup timers, print-clone values, escaped status, frame/probe ordering and source projection parity. Native Chromium confirms fixture-free production and repaint keepers. Source inspection identified custom integrity-store, platform fallback, scroll and clock/random adapters; these remain explicit rather than being mechanically converted. State importers, scope widths and startup checkpoints remain unchanged.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 declared workspace composition

Nine workspace/import compositions replace transparent handwritten callbacks/getters with explicit ordered declarations. Folder permission/picker, case loading, local controls, recipient, catalog and import contracts pass unchanged. Seven import scenarios and all 27 language-review assertions pass on the new bundle. Arrays and service objects remain live, the API field widths stay at or below 25, and no source, status, review-authority or storage-format rule changes.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 declared record composition

Eleven record, worksheet and publication compositions use explicit ordered declarations. All targeted activity/artifact/handoff/deadline/citation/task/commit/publication/correction contracts pass, including exact retry payloads, verification-before-write, archived PDF reuse, outcome lineage and receipt ordering. Original correction feature and R59 editor-flow assertions pass on the new bundle. The custom correction scroll adapter remains explicit. No validation, trust, clock, stored format or release identity changes.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 declared persistence composition

Ten persistence/recovery/worksheet compositions use explicit ordered declarations. Existing database/transaction failure, snapshot/restore barrier, shared-save exact retry, backup validation/write order, queue serialization, recovery rollback and worksheet assertions pass unchanged. Serialization failure still writes no stale/empty bytes and desktop exit still saves/reviews before stopping. No lock, retry, local storage, backup, helper trust or startup timing changes; interfaces remain bounded and acyclic.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 declared document composition

Fifteen document, delivery and recovery compositions use explicit ordered declarations. Existing recovery/history, record/visit, working-paper, printing/delivery, readiness, source and charge contracts pass unchanged, including snapshot-bound filing, receipt deduplication, guard-before-mutation and retained retry semantics. Original citation packet scenarios pass on the new bundle. The native clock/random adapter remains explicit. No document bytes, wording, protocol, source authority or initialization order changes.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 declared rendering composition

Eight rendering/context/event compositions replace 67 handwritten forwarders and thirty getters with explicit ordered declarations. Renderer, view-context callback identity, pagination and sixty-listener contracts pass, with unchanged frozen facts, footer/read order, snow/mobile behavior and scope widths. Native Chromium passes all 69 exact authored variants and detects overflow/clipping/missing-copy mutations. Renderers and approved print wording/layout are untouched. An AST census at the pre-M4 checkpoint measured 763 transparent rest-argument forwarders (the earlier plan reported 761) and 209 getters; current measurements use the explicit AST definition rather than assuming the earlier raw count.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 declared startup and listener composition

The final eligible listener/startup and test-fixture compositions replace 127 transparent handwritten forwarders and eight getters with explicit ordered declarations. Sixty listener checkpoints, all startup stage/lock/restore tests, native fixture-free production, real-browser repaint, seven import scenarios and R59 editor flow pass. Test-fixture construction remains behind the unchanged build-time branch. Only four small compositions with deliberate custom store/platform/scroll/clock behavior remain handwritten; they retain their original semantics rather than being forced through a transparent adapter. No registry, eager service read, release change or deployment is introduced.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M4 composition census and ratchet

The final Writer composition census records 19 transparent handwritten rest-argument forwarders and eight getters, down from the measured pre-M4 763 and 209. Only the four deliberate custom store/platform/scroll/clock compositions remain handwritten. A regression guard prevents increases without review and distinguishes native receiver/custom argument adapters from transparent forwarding. The six disjoint state boundaries still cover seventy fields, state.js has eleven importers, all 113 statically declared interfaces are at most 25 fields, and cycles remain zero. The census measures structure; it does not prove behavioral coupling or native City acceptance.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M5 screen template boundary

A small screen-only html tag uses the existing esc implementation by default; raw explicitly marks trusted renderer fragments, with private unforgeable marker identity. Tests pin escaping, attributes, Unicode/null/primitive handling, cooked whitespace, explicit string coercion and print-owner exclusion. The class scanner is tested with tagged templates without changing any CSS hash or retained-class assertion. History inspection finds the concat/split-literal forms already in imported R53 source (fe389b3), retained through feature extraction (2cbc4ef/fa23029); the current formatter has a 150-column limit and does not generate those concat forms. No guard requires screen literal boundaries, while approved wording remains in its original data. No screen is converted in this foundation increment and no print owner imports the helper.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M5 Workspace row templates

Four Workspace row/proof/document/deadline fragments now use escaped screen templates. Source history and class-guard inspection confirm these literal splits were retained source shape rather than approved wording boundaries. Data interpolations escape by default; raw is limited to the static issued-row attribute branch and the existing task renderer fragment. Adjacent tagged fragments keep logical HTML blocks readable without inserting output whitespace. All 1,033 historical exact HTML/state/effect comparisons, class/style guards and independent screen dependencies pass unchanged. No approved wording data, print renderer or CSS is modified.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M5 Workspace record row template

The record-row coordinator and its task links use escaped templates for data and explicit trusted task-owner attribute fragments. Existing named row/proof/document/deadline renderers keep their original order, and all output whitespace, action attributes and displayed wording remain byte-equivalent. All 1,033 historical HTML/state/effect comparisons, retained-class/style guards and independent screen dependencies pass. No source rule, proof/status precedence, stored data, CSS or print owner changes.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M5 Workspace quick-view template

Quick-view markup uses escaped templates and a named static resolution-attribute fragment. Labels/counts and pressed state remain in their original evaluation order, with identical source text and output whitespace. All 1,033 historical HTML/state/effect comparisons and retained-class/style checks pass. The static attribute fragment is the only raw interpolation; no case data or dynamic renderer result is granted implicit trust.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M5 Workspace table template

The filter/table renderer uses escaped templates instead of split-literal concat chains. Search text, names, labels and counts are escaped by default; only the existing row renderer/fallback HTML is explicitly marked raw. Filter option/selection reads, empty-result offers and row/inspector ordering retain their prior checkpoints. All 1,033 exact historical HTML/state/effect comparisons, retained-class/style guards and independent screen dependencies pass without changing wording, output whitespace, CSS or print owners.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M5 Workspace content template

Workspace composition now uses escaped templates for lead, import/empty states, queue notices and support. Repeated live-state reads and renderer/service order remain unchanged. Removing the incidental production esc import exposed a frozen-reference scope dependency; test-only historical bindings now explicitly provide its original esc and WriterState without changing reference bytes or assertions. All eight rule/HTML/dispatch comparisons (26,853 cases), native pagination, class/style, screen dependency and escaping/print-exclusion checks pass. This completes Workspace markup conversion without CSS, approved wording, print layout, release or stored-format changes.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M5 editor screen equivalence seam

Before extracting the editor screen, an independent public-factory seam pins its current function as an immutable test reference. It compares complete HTML, state mutations and ordered service getter/call traces across 2,031 seeded and boundary cases covering drafts, retained/locked records, corrections, invalid proof, pending actions, initial citations, copies and missing documents. Attribute/text inputs include escaped characters. Every generated case must render successfully, so matching exceptions cannot mask missing coverage. The reference and assertions are test-only; no application hook or production function changes.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30}.

## M5 editor named sections

The editor screen now coordinates named action, metadata, inspection, work and workspace sections. Four helpers receive bounded data/services explicitly; the private workspace renderer retains its factory-owned readiness/section helpers. The shell getter remains before its body arguments, and no service object is captured early. All 2,031 pre-refactor HTML/state/getter/effect comparisons, independent editor/architecture contracts, five original screen scenarios, R59 flow and editor repaint assertions pass. JS complexity violations fall 76 to 75 and total long-function violations 125 to 124; the coordinator is below both thresholds. Printed renderers and wording are untouched.

Measured counts: {'complexity': 76, 'max-depth': 0, 'max-lines-per-function': 125, 'python': 30} → {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 30}.

## M5 editor metadata template

Editor metadata uses escaped screen templates for document type, status and revision. The original pending/withdrawn/replaced/draft/issued precedence and deferred date-format call remain unchanged; no raw interpolation is needed. All 2,031 exact editor HTML/state/service-effect comparisons and editor, class/style, escaping/print-exclusion and dependency guards pass. No approved document wording or print renderer is converted.

Measured counts: {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 30} → {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 30}.

## M2 scoped action publication phases

Scoped publication now delegates source identity, verified inspection, administrative evidence, retained item facts and occupancy release checks in the original order. The coordinator falls from McCabe 25 to 8; its five helpers range from 4 to 5. The 3,000-context differential corpus and all 16 original R26 helper tests pass, alongside existing publication/history/authoring/special-field differential suites. No format, wording, integrity, print or release identity changes. Full Ruff check reports an existing E731 lambda in untouched case merging; the required F checks and formatting pass.

Measured counts: {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 30} → {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 29}.

## M2 catalog publication phases

Catalog publication delegates review-history loading and selected-item checks while retaining manifest-before-review reads, latest-by-key ordering, approved replacements and selection refusal precedence. Inherited history and corrections still return before any file access. Coordinator McCabe complexity falls from 16 to 5; review loading is 5 and item validation is 8. The 3,000-context differential corpus, five original R22 helper tests, scoped-publication and history comparisons, required Ruff F checks and formatting pass. No approved language, format, release identity, trust or print change.

Measured counts: {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 29} → {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 28}.

## M2 citation base calculation phases

Base-price calculation separates measurement validation and measured-rule evaluation after the unchanged readiness/fixed-tier/mandatory boundaries. Original arithmetic, band ordering, bounds, boolean/whole-number checks and tree-alternative exception remain. Coordinator McCabe complexity falls from 17 to 6; helpers are 6 and 8. Policy-row/generated comparisons include malformed, infinite and NaN measurements. Four original R32 pricing tests, existing authoring/history comparisons and the unchanged JS/Python pricing parity suite pass, as do required Ruff F checks and formatting. Policy data, print output, historical values, identities and authority are unchanged.

Measured counts: {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 28} → {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 27}.

## M2 citation pricing validation phases

Pricing validation delegates duplicate snow checks, retained-basis exits, schedule selection/site evidence, calculated/manual mode, override history and scheduled tier/base checks. Early unchanged and mandatory success still skips staging; staged history remains shared within the original item loop. Coordinator McCabe complexity falls from 26 to 7; seven helpers range from 2 to 6. All policy snapshots and 3,000 generated contexts compare exact results/errors, collaborator calls including staged arguments and input mutation with the frozen original. Existing R30 (9), R32 (4), R33 core (4), R33 admin (1), base/authoring/history comparisons and Ruff F/C901/format pass. An initial local F check caught an omitted case parameter in the extracted selection helper; explicit wiring was corrected before differential verification. Policy data, stored amounts, print and release identities remain unchanged.

Measured counts: {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 27} → {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 26}.

## M2 inspection validation phases

Visit validation now distinguishes the terminal occupancy-release path from ordinary current-source, imported-identity and item-outcome checks. Source/duplicate identity still precedes import reuse and calendar/outcome validation. Coordinator McCabe complexity falls from 18 to 2; helpers are 3, 4, 4 and 9. The 3,000-context differential corpus, unchanged imported-inspection reuse assertions, all 16 R26 helper and 14 workflow tests, existing history/scoped-publication/publication comparisons and required Ruff F/format checks pass. Window/date reads, withdrawn/carried compliance and release inspection authority are unchanged; no format, print, identity or trust change.

Measured counts: {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 26} → {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 25}.

## M2 atomic issuance group passes

Atomic group validation retains the initial document index, then the complete notice pass, then the complete citation pass. Named checks keep their original short-circuit identity, selection and companion checks; neither merges, writes or repairs records. Coordinator McCabe complexity falls from 11 to 3; notice and citation checks are 6 and 4. The new 3,000-case differential corpus and reversed-event precedence assertion pass, along with original R28 atomic-store (8), authoring (9), workflow (14), history/publication comparisons, Ruff F and formatting. No partial issuance, stored format, signer/identity, trust, print or release change.

Measured counts: {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 25} → {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 24}.

## M2 citation history scan phases

Citation-history reading retains folder readiness, sorted UTF-8 reads, shape and integrity checks, duplicate numbering and exclusions in the scanner. Only effective snapshot projection moves to a named helper using the same history list. Coordinator McCabe complexity falls from 12 to 6; projection is 7. A 3,000-case differential scan uses explicit synthetic guard adapters to compare exact outcomes and read/validation/integrity order, including excluded duplicate cases and ignored underscore files. All nine original R30 real-store and seven UTF-8/integrity tests pass unchanged, along with existing history/pricing comparisons and required Ruff F/format checks. Synthetic guards do not establish trust; existing real-store authority and bytes are unchanged.

Measured counts: {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 24} → {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 23}.

## M2 shared search terms

Shared search retains folder/query validation, sorted bounded byte reads, legacy shape checks, filename identity, duplicate accounting, unreadable catches and logging. Only current/historical address, owner, parcel and citation-number term gathering moves to a named helper. Coordinator McCabe complexity falls from 11 to 9; term gathering is 3. A 3,000-case comparison against the frozen original worker preserves exact results and I/O/validation traces, including malformed snapshots, Unicode casefolding, duplicate records and ignored underscore files. An explicit 5,001-file case pins 5,000 scanned records, 100 result rows and partial/duplicate flags. All six original public workflow-tools tests, existing citation-history comparison, Ruff F/C901 and formatting pass. The logging decorator, frozen references, search limits, formats and release identity are unchanged.

Measured counts: {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 23} → {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 22}.

## M2 retained policy version checks

Policy versions retain whole-range coverage first, then per-row legal source and date checks, adjacency checks and verified review/amount evidence in the original order. Named helpers do not normalize, repair or infer policy data. Coordinator McCabe complexity falls from 11 to 4; source/date and verified-evidence helpers are 5 and 4. The new retained-row/generated comparison pins exact exceptions, date calls and immutability; complete compiled JSON bytes including versionHash match compilation with the frozen original validator. All five existing R31 policy and four R32 pricing tests, Ruff F/format and the complexity ratchet pass. Approved policy data, outputs, wording, cutoffs, formats and release identity are unchanged.

Measured counts: {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 22} → {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 21}.

## M2 retained source validation phases

Retained-source validation reads grammar/library first, validates every library provision, then reads and validates retained schedule rows in the original order. Private library and schedule checks retain markers, normalization, ordinance grammar, reviewed raw amounts, review presence and stale-data refusals without data repair or new defaults. Coordinator McCabe complexity falls from 12 to 2; helpers are 8 and 4. The new 3,000-case differential test pins exact errors/read order and unchanged source files, while full compiled JSON bytes match the frozen original validator. Existing R31 policy (5), retained-version comparisons/compiled parity and R32 pricing (4), Ruff F/format and ratchet pass. Legal data, wording, policy outputs, cutoffs, identities and trust remain unchanged.

Measured counts: {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 21} → {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 20}.

## M2 policy compilation phases

Policy compilation separates building-size annotations, snow-window annotations and legislation-example validation after the unchanged source/version/ledger/interpretation phases. Coordinator McCabe complexity falls from 17 to 8; three helpers are 4 each. A frozen whole-compiler comparison covers 128 contexts with varied metadata, schedule identities, parameter sources, ladders, interpreter refusals and late example mismatches. It compares exact build-formatted JSON bytes (indent 2 plus newline), including policy hash, read/interpret/example order and restoration of the original pricing.policy object on every outcome. Existing R31 policy (5), retained-version and source comparisons/byte parity, R32 pricing (4), Ruff F/C901/format and ratchet pass. Approved policy data, wording, cutoffs, generated output and all identities are unchanged.

Measured counts: {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 20} → {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 19}.

## M2 health write probe phase

Health keeps original case/share lookup, optional probe checkpoint, manifest and lookup checks, anchor/parser/reachability/status clocks and version reads. Only the existing two-target temporary-file probe moves behind a private helper; outbox lookup remains inside the original OSError boundary and no probe-related property/write is accessed when disabled. Coordinator McCabe complexity falls from 11 to 8; probe is 4. The new 3,000-case frozen-worker comparison preserves full outputs/errors and write/flush/fsync/context-exit/query/read order, including changing parser availability and clocks. Native temporary-file tests pin cleanup and missing-outbox behavior. All six original safety/privacy and eight storage tests, Ruff F/C901/format and ratchet pass. Local automated checks do not claim Windows acceptance; diagnostics, probe limits, logging, authority and identities remain unchanged.

Measured counts: {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 19} → {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 18}.

## M2 catalog review request boundary

Catalog review validates the original request shape, key/status/replacement, manifest membership, ordinance references and review fields through a named helper, returning the original captured key/status. Directory creation, lock acquisition, event reading, expected-version and cycle checks, UUID/time reads, append-before-write and serialized bytes remain in the original persistence body. Coordinator McCabe complexity falls from 12 to 5; request validation is 8. A 3,000-case frozen-function comparison covers malformed and boundary fields, concurrency/cycles and directory/lock/read/write failures, matching output/errors, full effects and partial event-list mutation. Existing R21 catalog/storage (5), R22 atomic/concurrency (5), catalog-publication comparison, Ruff F/format and ratchet pass. Route/admin authority, locking, stored formats, wording, trust and identities remain unchanged.

Measured counts: {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 18} → {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 17}.

## M2 mailing parser normalization phases

Mailing parsing keeps input bounds, availability/tag/repeated-label handling and state/ZIP/city validation before normalization. Named helpers preserve USPS direction/suffix/unit normalization and street assembly; a None sentinel retains the original missing-street return without rejecting normalized empty strings. Coordinator McCabe complexity falls from 15 to 9; helpers are 6 and 3. Real-parser corpus and 3,000 generated tagged inputs compare complete results/errors, clean/owner-key calls and unchanged tag data against the frozen original. Existing R31 address (4), R32 unavailable fallback (1), pricing comparison, Ruff F/C901/format and ratchet pass. An initial new-test run exposed oracle parser bindings leaking into the real corpus; per-test binding isolation fixed that harness issue without changing frozen source or expectations. Raw addresses, parser model, postal data, fallback and identities are unchanged.

Measured counts: {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 17} → {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 16}.

## M2 snow snapshot evidence phases

Snow snapshot validation now delegates exempt-item identity and observed snow/timing facts before the unchanged ordinance and optional frozen-letter checks. Coordinator McCabe complexity falls from 14 to 5; helpers are 3 and 8. The frozen-function comparison covers 3,000 malformed and valid contexts, including noon boundaries, finite inches, strict photography/corner flags, identity, comments and letter requirements; exact outcomes, query order and inputs match. All four original R33 snow and four R33 core tests plus pricing comparison, Ruff F/C901/format and ratchet pass. Source comparison confirms every pre-existing non-validator function, including printed cover HTML, comments and totals, is byte-identical. No snow deadline, pricing, evidence, hold, printed wording, stored format, trust or release identity changes.

Measured counts: {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 16} → {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 15}.

## M2 citation refresh equivalence seam

An independent public initCitationPricing composition compares the current refresh operation against a byte-exact frozen function before extraction. All policy rows across scheduled/base/total modes plus 3,000 generated draft/request/correction/history/typed-charge/readonly/error contexts preserve complete state, held citation/request aliases, exceptions and lazy service-read/call order. A separate live-cache sequence pins unchanged-history reuse, local signature invalidation, non-signature stability and reloads. All 4,692 scenarios, cache checks, original R32 pricing (3,872 row/tier/measurement comparisons and draft workflow), R33 snow workflow, seam inventory, module boundaries, ESLint and formatting pass after a fresh test build. No application code, production hook, assertion, stored format, print, policy or identity changes. Python target is met at 15; JS complexity remains 75 and the refresh hotspot remains 68 pending the next extraction. The owner requested a pause after this PR; finish its required checks and merge, then stop development.

Measured counts: {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 15} → {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 15}.

## M2 citation refresh phases

Citation refresh delegates pending requests, history facts/warnings, site evidence, manual pricing, scheduled-result application and descriptions through private module-local helpers. Constructor/public exports and live closure/cache state remain unchanged. Coordinator complexity falls from 68 to 15; eight new helpers range from 5 to 12. The frozen-owner comparison and cache sequence pass, alongside original R32 pricing parity/draft workflow, R33 snow and immutable citation checks, R59 charge selection (40) and editor flow, module boundaries, seam inventory, ESLint and formatting after a fresh test build. An initial local extraction misplaced the public export; restored the original initCitationPricing export before successful verification. No assertion, policy, timing, hook, format or identity change. This increment is queued for review and approval; it is not merged.

Measured counts: {'complexity': 75, 'max-depth': 0, 'max-lines-per-function': 124, 'python': 15} → {'complexity': 74, 'max-depth': 0, 'max-lines-per-function': 123, 'python': 15}.

## case-status-equivalence

Added 3037 comparison scenarios before changing the status coordinator. Comparison, module boundaries, seam inventory, ESLint and JavaScript formatting pass. The frozen text fixture is retained source, not formatted; an initial explicit Prettier invocation on its .txt extension was unsupported. No production code or debt allowances changed.

Measured counts: {'complexity': 74, 'max-depth': 0, 'max-lines-per-function': 123, 'python': 15} → {'complexity': 74, 'max-depth': 0, 'max-lines-per-function': 123, 'python': 15}.

## case-status-phases

Separated closure, deadline facts, attention and status-label precedence into private named helpers. Live snow and clock reads remain at their original short-circuit points; query order and returned aliases remain intact. All 3037 differential scenarios, independent screen/workspace/task audits, module boundaries, seam inventory, ESLint, formatting and a fresh test build pass. No production exports or factory inputs added.

Measured counts: {'complexity': 74, 'max-depth': 0, 'max-lines-per-function': 123, 'python': 15} → {'complexity': 73, 'max-depth': 0, 'max-lines-per-function': 121, 'python': 15}.

## case-file-validation-phases

Separated recipient/list, event and issued-snapshot checks without changing refusal order or property-read timing. The new comparison passed against the unchanged validator before extraction and after it over 3468 scenarios, including interrupted getters and malformed records. Record-rule, module-boundary, seam, ESLint and formatting checks pass. Initial test composition missed generated data resolution; corrected its explicit build plugin before verification. Existing assertions and frozen references remain unchanged.

Measured counts: {'complexity': 73, 'max-depth': 0, 'max-lines-per-function': 121, 'python': 15} → {'complexity': 72, 'max-depth': 0, 'max-lines-per-function': 121, 'python': 15}.

## catalog-audit-owner-seam

Migrated the retained data diagnostics from eval of the full Writer bundle to explicit catalog/pricing/query/mailing/fixture exports. Preserved every diagnostic calculation and compared complete stdout before/after byte for byte. Added inert-import protection and explicit cloned seed cases. Removed unused DOM/browser stubs. ESLint, formatting and seam ratchet pass; legacy bundle evaluator files 84 to 83. No diagnostic hook is removed while another consumer remains.

Measured counts: {'complexity': 72, 'max-depth': 0, 'max-lines-per-function': 121, 'python': 15} → {'complexity': 72, 'max-depth': 0, 'max-lines-per-function': 121, 'python': 15}.

## projection-corpus-owner-seam

Migrated the synthetic projection corpus from full Writer bundle eval to the public summary adapter and actual record-integrity owner with explicit cloned seed cases. All generated files/summary/error/table bytes match the previous composition for 2000 cases with a controlled comparison clock. The full standalone six-test projection audit passes across all three seeds and retained real-flow captures. ESLint, formatting and seam ratchet pass; legacy bundle evaluator files 83 to 82. Production projection algorithms, assertions and format identities are unchanged.

Measured counts: {'complexity': 72, 'max-depth': 0, 'max-lines-per-function': 121, 'python': 15} → {'complexity': 72, 'max-depth': 0, 'max-lines-per-function': 121, 'python': 15}.

## inspection-history-phases

Separated inspection lineage tracing, observed-visit rows and initial/visit citation annotations into private phases. Every phase retains its original query and mutation order. All 4000 seeded comparisons passed before/after extraction. Document rendering, correction service, record workflows and all six history/referral feature scenarios pass against a fresh test build, as do module boundaries, seam inventory, ESLint and formatting. Historical renderers and print assertions are unchanged.

Measured counts: {'complexity': 72, 'max-depth': 0, 'max-lines-per-function': 121, 'python': 15} → {'complexity': 71, 'max-depth': 0, 'max-lines-per-function': 121, 'python': 15}.

## citation-resolution-phases

Separated schedule selection, mandatory deposits, measurement refusals and row-selection metadata into private phases. All 8917 comparisons passed before/after extraction; R32 passed 3872 JavaScript/Python pricing combinations and draft workflows; citation refresh and snow regressions pass against a fresh build. Boundaries, seam inventory, ESLint and formatting pass. Initial local extraction had an object-wrapper syntax error caught before verification and corrected. Initial trace assertions inspected returned proxies; snapshotting now unwraps test instrumentation before comparing, preserving full input-read traces without assertion-induced reads.

Measured counts: {'complexity': 71, 'max-depth': 0, 'max-lines-per-function': 121, 'python': 15} → {'complexity': 70, 'max-depth': 0, 'max-lines-per-function': 121, 'python': 15}.

## editor-action-templates

Converted editor action and inspection fragments to escaped screen templates. Dynamic case identity and static primary labels escape by default; raw is limited to existing primary attributes, composed action markup and the owned inspection renderer. Preserved original condition/service evaluation order, displayed text and output whitespace. The 2031 frozen HTML/state/effect comparisons pass, as do screen class/style, escaping/print exclusion, dependency, ESLint and formatting checks. Prior source inspection confirms split literals are retained source shape, not approved wording boundaries; no CSS or printed document wording changes.

Measured counts: {'complexity': 70, 'max-depth': 0, 'max-lines-per-function': 121, 'python': 15} → {'complexity': 70, 'max-depth': 0, 'max-lines-per-function': 121, 'python': 15}.

## editor-work-template

Converted working-document taskbar, preview tools and surrounding preview containers to escaped templates with explicit raw boundaries for existing citation/document/due renderers. Retained UI banner text exactly, service calls and repeated live enabled/copy-state reads at their original checkpoints. All 2031 frozen editor HTML/state/effect comparisons pass, along with CSS class/style, escaping/print exclusion, independent screen dependencies, ESLint and formatting. Printed renderers, approved wording data and CSS remain unchanged.

Measured counts: {'complexity': 70, 'max-depth': 0, 'max-lines-per-function': 121, 'python': 15} → {'complexity': 70, 'max-depth': 0, 'max-lines-per-function': 121, 'python': 15}.

## editor-readiness-templates

Converted readiness chips/actions, mobile bar, Review dialog and hidden field messages to escaped screen templates. Added a frozen pre-change helper fixture so references do not share the changed implementation; extended every one of 2031 scenarios to compare the public Review dialog as well as screenWrite. The strengthened comparison passes against pre-change and refactored source. R59 editor workflow passes against a fresh build; class/style, escaping/print exclusion, screen dependencies, seam inventory, ESLint and formatting pass. No existing assertion or frozen reference was changed.

Measured counts: {'complexity': 70, 'max-depth': 0, 'max-lines-per-function': 121, 'python': 15} → {'complexity': 70, 'max-depth': 0, 'max-lines-per-function': 121, 'python': 15}.

## editor-workspace-template

Converted editor workspace composition and named sections to escaped screen templates. Case/document identities, section labels and status counts escape by default; raw is limited to the existing owned renderers and composed section bodies. Retained panel/service order, live structural-edit checks and exact screen output. All 2031 independent frozen screen/Review comparisons pass, as do class/style, escaping/print exclusion, screen dependencies, ESLint and formatting. This completes the editor screen markup conversion; no CSS, approved wording data or printed renderer changes.

Measured counts: {'complexity': 70, 'max-depth': 0, 'max-lines-per-function': 121, 'python': 15} → {'complexity': 70, 'max-depth': 0, 'max-lines-per-function': 121, 'python': 15}.

## citation-measurement-validation

Separated measurement eligibility from schedule rule arithmetic while retaining the tiers shortcut and original ordered field reads. Added an exact pre-change private-rule reference and 624 direct measurement boundary cases; all 8917 amount/input-read comparisons and 624 direct cases pass before/after extraction. R32 JavaScript/Python pricing parity and automatic draft workflow pass against a fresh build, plus module boundaries, seam inventory, ESLint and formatting. Private rule is exported only inside the isolated test compilation; production API is unchanged.

Measured counts: {'complexity': 70, 'max-depth': 0, 'max-lines-per-function': 121, 'python': 15} → {'complexity': 69, 'max-depth': 0, 'max-lines-per-function': 121, 'python': 15}.

## citation-row-selection

Separated exact schedule row selection from mapping, ancestor, child and fallback resolution. Retained ambiguity refusal, equivalent-rule selection and explicit entry identity behavior. Added an exact pre-change ordinance reference and 1950 direct mapping/row selections. All 8917 resolution scenarios, 624 measurement cases and 1950 ordinance selections pass before/after extraction. R32 JavaScript/Python parity/draft workflow, citation refresh comparisons, fresh build, boundaries, seams, ESLint and formatting pass. Production API and lookup/refusal order are unchanged.

Measured counts: {'complexity': 69, 'max-depth': 0, 'max-lines-per-function': 121, 'python': 15} → {'complexity': 69, 'max-depth': 0, 'max-lines-per-function': 121, 'python': 15}.

## citation-row-selection-completion

Completed row-selection separation by naming the ancestor/child/fallback phase. The first exact-row extraction lowered resolveOrdinance 27 to 22; this completion lowers it below 20 rather than claiming that the earlier commit had already removed the finding. All 8917 resolution, 624 measurement and 1950 ordinance comparisons pass; ESLint and formatting pass. JS findings now fall 69 to 68. Production exports remain unchanged.

Measured counts: {'complexity': 69, 'max-depth': 0, 'max-lines-per-function': 121, 'python': 15} → {'complexity': 68, 'max-depth': 0, 'max-lines-per-function': 121, 'python': 15}.

## scoped-edit-dispatch

Separated case/visit selection, administrative family switching, special-field editing and affected-item editing into private scoped handlers. The coordinator retains original lookups, first-match order and special-document lock guard. All 2000 frozen state/DOM/service-order scenarios pass before/after, plus 5000 special-rule scenarios, independent writer feature boundaries, every extension feature scenario, R62 all-item extensions and R32 pricing parity on a fresh build. Boundaries, seams, ESLint and formatting pass. No public factory inputs, authoring identities, assertions or approved wording changes.

Measured counts: {'complexity': 68, 'max-depth': 0, 'max-lines-per-function': 121, 'python': 15} → {'complexity': 67, 'max-depth': 0, 'max-lines-per-function': 120, 'python': 15}.

## admin-override-phases

Separated administrator authorization shape, citation binding and history/measurement binding into private ordered validators. Kept eager document-case resolution before the absent-basis shortcut, first refusal text and short-circuit field reads. All 3520 frozen comparison scenarios pass before/after extraction. Writer feature boundaries retain listener construction and override binding; module boundaries, seams, ESLint and formatting pass. Production API, authorization receipts, helper authority and format identities are unchanged.

Measured counts: {'complexity': 67, 'max-depth': 0, 'max-lines-per-function': 120, 'python': 15} → {'complexity': 66, 'max-depth': 0, 'max-lines-per-function': 120, 'python': 15}.

## worksheet-visit-templates

Converted earlier-visit rows, visit header and progress fragments to escaped screen templates. Source history from the prior M5 review establishes these split literals as retained formatting rather than approved wording boundaries. Data escape by default; raw is confined to joined option/visit markup produced by the tag. Kept element boundaries, exact whitespace and live date/inspector evaluation order. All 1026 frozen worksheet comparisons pass, along with class/style, escaping/print exclusion, screen dependencies, ESLint and formatting. No CSS or printed renderer changes.

Measured counts: {'complexity': 66, 'max-depth': 0, 'max-lines-per-function': 120, 'python': 15} → {'complexity': 66, 'max-depth': 0, 'max-lines-per-function': 120, 'python': 15}.

## Worksheet template dependency contract

The initial worksheet-template gate failed. The local boundary checker identified the missing planned screen_html foundation edge for reinspection, which already owns the worksheet UI. Recorded that single dependency in the reviewed contract; retained the unchanged whitelist assertion, acyclic graph and print-owner exclusion assertions. No broader dependency allowance or output reference changes.

## worksheet-filter-template

Converted worksheet count/filter controls to escaped templates, retaining repeated live walk/filter reads, pressed/disabled state, conditional offers and exact whitespace. No raw interpolation is needed in this section. All 1026 frozen worksheet comparisons, class/style and escaping/print-exclusion checks pass, as do ESLint and formatting. No filter behavior, CSS, printed renderer or approved wording changes.

Measured counts: {'complexity': 66, 'max-depth': 0, 'max-lines-per-function': 120, 'python': 15} → {'complexity': 66, 'max-depth': 0, 'max-lines-per-function': 120, 'python': 15}.

## followup-draft-equivalence

Added an independent owner comparison before changing follow-up drafting. All 2605 cases pass, including all five successful draft families, 100 explicit service-interruption points and 2500 seeded refusal/history combinations. Positive assertions require actual draft registration, write routing, dirty state and retained citation aliases. ESLint, formatting and seam inventory pass. Production drafting code and debt allowances are unchanged.

Measured counts: {'complexity': 66, 'max-depth': 0, 'max-lines-per-function': 120, 'python': 15} → {'complexity': 66, 'max-depth': 0, 'max-lines-per-function': 120, 'python': 15}.

## followup-draft-phases

Separated existing-draft routing, ordered refusal checks, item/due projection, draft construction, citation preparation and completion text into private phases. Registration remains before citation numbering, and notification counts and lazy toast reads retain their original checkpoints. Expanded service interruptions through 35 call points for each successful family; all 2680 comparisons pass. Exact worksheet snapshots, owner/service and history/referral/extension feature regressions pass, including a final fresh build and R46 outcomes. Boundaries, seams, ESLint and formatting pass. Initial local AST/syntax extraction errors were corrected before verification. No public factory inputs or format identities change.

Measured counts: {'complexity': 66, 'max-depth': 0, 'max-lines-per-function': 120, 'python': 15} → {'complexity': 64, 'max-depth': 0, 'max-lines-per-function': 119, 'python': 15}.

## reinspection-entry-phases

Separated imported-visit date/time/inspector refresh and inherited result-date updates from worksheet entry. Kept snow/integrity refusal priority, clear-walk timing, repeated live draft queries and the original open-visit reference. All 3501 frozen scenarios pass before/after, including partial service failures and clearWalk replacing draft state. Reinspection service, module boundaries, seams, ESLint and formatting pass. No dependency, public API, stored identity or UI behavior change.

Measured counts: {'complexity': 64, 'max-depth': 0, 'max-lines-per-function': 119, 'python': 15} → {'complexity': 63, 'max-depth': 0, 'max-lines-per-function': 118, 'python': 15}.

## report-model-equivalence

Added isolated public-owner coverage before simplifying report model projection. All 3401 comparisons pass across generated summary versions, parcel-history order, geography and partial service failures. Explicit assertions require actual counted cases and retained summary/child links; generated duplicate numbers preserve existing byNo semantics. ESLint, formatting and seam inventory pass. No production model, report assertion, export behavior or debt allowance changes.

Measured counts: {'complexity': 63, 'max-depth': 0, 'max-lines-per-function': 118, 'python': 15} → {'complexity': 63, 'max-depth': 0, 'max-lines-per-function': 118, 'python': 15}.

## report-model-phases

Separated case identity, parcel/coordinate facts and linked report records from the model coordinator. Retained stale-version exclusions, historical district selection, geographic lookup, sort/count rules, original summary/owner-address references and child-to-case links. All 3401 frozen comparisons pass before/after. Independent authenticated loading, Reports boundaries, ordinance normalization, mismatch exclusion and export-scope regressions pass against a final fresh build. Module boundaries, seams, ESLint and formatting pass. The initial projected-summary helper remained at complexity 21; separating record linkage removes the new finding rather than increasing an allowance.

Measured counts: {'complexity': 63, 'max-depth': 0, 'max-lines-per-function': 118, 'python': 15} → {'complexity': 62, 'max-depth': 0, 'max-lines-per-function': 117, 'python': 15}.

## report-filter-phases

Separated notice eligibility and status inclusion into private decisions while retaining area, inspector, owner and violation precedence. Historical status is still computed at the original point even without a status filter; TODAY remains a short-circuit read. All 4501 frozen comparisons pass before/after. Model comparisons, authenticated loading, Reports boundaries and fresh-build ordinance/mismatch/export-scope regressions pass, with module boundaries, seam inventory, ESLint and formatting. No public inputs, report outputs, dependencies or version identities change.

Measured counts: {'complexity': 62, 'max-depth': 0, 'max-lines-per-function': 117, 'python': 15} → {'complexity': 61, 'max-depth': 0, 'max-lines-per-function': 117, 'python': 15}.

## walk-shortcut-guard

Separated the initial walkthrough eligibility guard without changing registration or dispatch. Context validation retains its original place before prevented/repeat/modifier checks, and target/key reads still follow it. All 4561 comparisons pass before/after, including an eligible-key/target/undo matrix and contexts that mutate live worksheet state. Event registration, reinspection service, fresh-build R46 outcomes, module boundaries, seams, ESLint and formatting pass. No shortcut, input ownership, native action timing, dependency or public factory input changes.

Measured counts: {'complexity': 61, 'max-depth': 0, 'max-lines-per-function': 117, 'python': 15} → {'complexity': 60, 'max-depth': 0, 'max-lines-per-function': 117, 'python': 15}.

## worksheet-verdict-template

Converted worksheet verdict banners and their follow-up explanation to escaped screen templates. Kept the existing closed/incomplete/compliance/deadline/default precedence, repeated document lookups, import-rule fields and exact text/entities. Raw is limited to the composed escaped explanation fragment. All 1026 frozen worksheet comparisons and 2680 drafting comparisons pass, plus class/style, escaping/print exclusion, module boundaries, ESLint and formatting. No CSS, print owner, approved wording data or stored format changes.

Measured counts: {'complexity': 60, 'max-depth': 0, 'max-lines-per-function': 117, 'python': 15} → {'complexity': 60, 'max-depth': 0, 'max-lines-per-function': 117, 'python': 15}.

## report-filter-coordinator

Completed ordered notice, identity, status and violation decisions. ESLint measures the caseOk coordinator at complexity 7; every extracted inclusion rule is below 10 (snow 5, standard notice 6, notice routing 4, status 9, identity 9, violation 6). All 4501 frozen field/service-read comparisons, 3401 model comparisons, authenticated loading and Reports boundary tests pass. Module boundaries, seams, ESLint and formatting pass. No public inputs, query order, report outputs or debt allowances change.

Measured counts: {'complexity': 60, 'max-depth': 0, 'max-lines-per-function': 117, 'python': 15} → {'complexity': 60, 'max-depth': 0, 'max-lines-per-function': 117, 'python': 15}.

## report-parcel-cache-phase

Separated parcel cache defaults and lookup-key selection into a synchronous helper, retaining every await boundary and superseded-read guard. The existing loading assertions now run against both retained and current public owners through actual authenticated transport; full cache/model snapshots, request/abort details and render frames compare equal. Existing chunk-size, partial-lookup and superseded-read assertions remain unchanged. Model/filter comparisons, Reports/module boundaries, seams, ESLint and formatting pass. No async stage, request shape, chunk limit, authority or public interface changes.

Measured counts: {'complexity': 60, 'max-depth': 0, 'max-lines-per-function': 117, 'python': 15} → {'complexity': 59, 'max-depth': 0, 'max-lines-per-function': 117, 'python': 15}.

## report-view-owner-seam

Migrated the R21 saved-view and handoff audit from full Reports bundle eval to createReportsServices with explicit storage, clock formatting, catalog and window/channel services. Every existing assertion is retained; complete console output matches before/after. The test supplies its catalog fixture because report definitions and screen rendering are outside this preference/handoff owner; inert-import protection was added. Reports boundaries, seam inventory, ESLint and formatting pass. Legacy bundle-evaluator files fall 82 to 81; no diagnostic hook is retired while other consumers remain. Production code is unchanged.

Measured counts: {'complexity': 59, 'max-depth': 0, 'max-lines-per-function': 117, 'python': 15} → {'complexity': 59, 'max-depth': 0, 'max-lines-per-function': 117, 'python': 15}.

## language-action-phases

Separated catalog opening and picker/library filtering into private named actions without changing navigation or asynchronous refresh boundaries. Passed 7,734 retained-owner comparisons, event registration (60 registrations/14 owners), module boundaries (137 modules/no cycles), test seams, ESLint and Prettier. Release identities and existing assertions unchanged.

Measured counts: {'complexity': 59, 'max-depth': 0, 'max-lines-per-function': 117, 'python': 15} → {'complexity': 58, 'max-depth': 0, 'max-lines-per-function': 117, 'python': 15}.

## storage-status-row-phases

Separated last-write and reporting-index row formatting into private functions in the existing storage-status owner. Passed 4,000 retained-owner comparisons of exact HTML and property/service read order; shell boundary behavior, module boundaries, test seams, ESLint and formatting passed. No print/probe behavior or release identity changes.

Measured counts: {'complexity': 58, 'max-depth': 0, 'max-lines-per-function': 117, 'python': 15} → {'complexity': 57, 'max-depth': 0, 'max-lines-per-function': 117, 'python': 15}.

## case-load-status-message

Moved success-message formatting into a private function, retaining the toast getter and argument evaluation order. Passed 320 retained-loader comparisons using actual migration/projection/event operations, varying zero/one/many documents and visits, repeats, saved/held loads and UI/save interruptions. Differential snapshots omit only wall-clock savedAt; existing proof/conflict/rollback assertions all pass. Module boundaries, test seams, ESLint and formatting pass; identities unchanged.

Measured counts: {'complexity': 57, 'max-depth': 0, 'max-lines-per-function': 117, 'python': 15} → {'complexity': 56, 'max-depth': 0, 'max-lines-per-function': 116, 'python': 15}.

## language-catalog-owner-test

Migrated catalog normalization/pricing/classification coverage from whole Writer bundle evaluation to actual public catalog queries, citation policy, projection and shared date owners. All six original assertion ASTs are unchanged and console output is byte-identical; added inert-import assertion. Removed unused startup/persistence mocks; production source unchanged. Test seams, module boundaries, ESLint and formatting pass; legacy evaluator allowance lowered 81→80, retained hooks unchanged.

Measured counts: {'complexity': 56, 'max-depth': 0, 'max-lines-per-function': 116, 'python': 15} → {'complexity': 56, 'max-depth': 0, 'max-lines-per-function': 116, 'python': 15}.

## correction-special-comparison

Separated the special-extension comparison phase from the correction change coordinator. Passed 4,120 retained-owner comparisons covering authoring cutoffs, optional special values, ordered case/item/citation/visit changes and property reads; existing correction lineage/retry/delivery checks pass. Module boundaries, test seams, ESLint and formatting pass. No wording, print, format or release identity changes.

Measured counts: {'complexity': 56, 'max-depth': 0, 'max-lines-per-function': 116, 'python': 15} → {'complexity': 55, 'max-depth': 0, 'max-lines-per-function': 116, 'python': 15}.

## message-paint-phases

Separated message markup, focus restoration and timer/event binding into private phases, retaining their execution order. Passed 1,024 retained-owner DOM comparisons with controlled clock/timers, plus fresh test build and existing accessibility/R59 editor-flow suites. Initial local iterations caught factory growth and an incorrect markup return; both corrected without changing assertions or debt allowances. Final module boundaries, test seams, ESLint and formatting pass. No timer duration, print or release identity changes.

Measured counts: {'complexity': 55, 'max-depth': 0, 'max-lines-per-function': 116, 'python': 15} → {'complexity': 54, 'max-depth': 0, 'max-lines-per-function': 116, 'python': 15}.

## worksheet-result-templates

Converted result-date/note/citation controls and next-due-date screen markup to escaped templates; raw fragments contain only local renderer output. Passed 1,026 exact retained-screen comparisons, screen escaping/print-owner exclusion, fresh test build, screen CSS contracts, R46 reinspection, reinspection-service behavior, module boundaries, test seams, ESLint and formatting. Controls, whitespace, labels, disabled states and release identities retained. Calendar-generated minimum/maximum attributes now flow through the existing screen escape.

Measured counts: {'complexity': 54, 'max-depth': 0, 'max-lines-per-function': 116, 'python': 15} → {'complexity': 54, 'max-depth': 0, 'max-lines-per-function': 116, 'python': 15}.

## worksheet-walk-copy-templates

Converted walkthrough explanation text and progress-step list to escaped templates. Retained exact wording, whitespace and current-step attributes; raw fragments contain only local step renderer output. Passed 1,026 exact frozen-screen comparisons, escaping/print exclusion, independent reinspection behavior, module boundaries, test seams, ESLint and formatting. Release identities unchanged.

Measured counts: {'complexity': 54, 'max-depth': 0, 'max-lines-per-function': 116, 'python': 15} → {'complexity': 54, 'max-depth': 0, 'max-lines-per-function': 116, 'python': 15}.

## worksheet-walk-panel-template

Converted walkthrough mode controls, details navigation, undo and shortcut panel to an escaped template. Trusted fragments come only from local explanation, step and shortcut renderers. Passed 1,026 exact frozen-screen comparisons, screen escaping/print exclusion, reinspection service behavior, module boundaries, test seams, ESLint and formatting. Existing controls, keyboard labels, eligibility callbacks and output whitespace retained.

Measured counts: {'complexity': 54, 'max-depth': 0, 'max-lines-per-function': 116, 'python': 15} → {'complexity': 54, 'max-depth': 0, 'max-lines-per-function': 116, 'python': 15}.

## worksheet-body-template

Converted worksheet body composition, filtered count, previous draft controls and closed-document action to an escaped template. Due panel, chooser, item rows and inspection checks retain their owners and evaluation order; only those renderer outputs use raw fragments. Passed 1,026 exact retained-screen comparisons, escaping/print exclusion, reinspection service, module boundaries, test seams, ESLint and formatting. Existing assertions, wording, structure and release identities unchanged.

Measured counts: {'complexity': 54, 'max-depth': 0, 'max-lines-per-function': 116, 'python': 15} → {'complexity': 54, 'max-depth': 0, 'max-lines-per-function': 116, 'python': 15}.

## worksheet-item-template

Converted worksheet item rows, outcome controls and carried-result copy to escaped templates. Existing item context/eligibility calculations stay unchanged; raw fragments contain only local renderer output, fixed attributes or escaped fill-in markup. Passed 1,026 exact frozen-screen comparisons, escaping/print exclusion, reinspection service, module boundaries, ESLint and formatting. Formatted due-date text now flows through screen escaping; valid-date display, controls, historical text and release identities retained.

Measured counts: {'complexity': 54, 'max-depth': 0, 'max-lines-per-function': 116, 'python': 15} → {'complexity': 54, 'max-depth': 0, 'max-lines-per-function': 116, 'python': 15}.

## worksheet-check-templates

Completed worksheet check rows/panel template conversion and removed the now-unused production esc import. Added 1,536 independent retained-row/panel comparisons because the historical full-screen fixture shares this owner; its original references/assertions remain unchanged. Historical test composition explicitly supplies esc after production imports narrow. Passed 1,026 full-screen comparisons, fresh test build, R46 (256 outcomes), walkthrough (30 assertions), screen CSS/escaping/print exclusion, editor HTML (2,031 states), reinspection service, module boundaries, test seams, ESLint and formatting. No fragmented HTML concat chains remain in reinspection.js; other screen owners and quantitative targets remain unfinished.

Measured counts: {'complexity': 54, 'max-depth': 0, 'max-lines-per-function': 116, 'python': 15} → {'complexity': 54, 'max-depth': 0, 'max-lines-per-function': 116, 'python': 15}.

## citation-prior-history-phases

Separated record matching from prior-citation collection in private helpers, preserving first-source wins, read order, seasonal owner rules, date windows and staged facts. Passed 4,045 retained-owner comparisons using real history transport and matching, plus 4,692 existing pricing-refresh scenarios/cache reload checks. Module boundaries, test seams, ESLint and formatting pass. No pricing policy, print, stored format or release identity changes.

Measured counts: {'complexity': 54, 'max-depth': 0, 'max-lines-per-function': 116, 'python': 15} → {'complexity': 53, 'max-depth': 0, 'max-lines-per-function': 116, 'python': 15}.

## report-spreadsheet-sheet-owner

Extracted spreadsheet worksheet XML into an independently loadable owner with lazy facts/exports groups; split cell display and serialization below the complexity limit. Passed 4,002 retained-sheet inputs through composed and standalone owners, exact XML/property reads/service receivers and exceptions. Fresh test build, Reports workbook/export-scope suites, Reports boundaries, module boundaries (138 modules/no cycles), test seams, ESLint and formatting pass. Exact scoped-interface guard now inspects both composed owners; dependency whitelist adds only the new edge/owner. Initial scoped-interface mismatch corrected by checking the forwarded consumer, without relaxing assertions. Existing Reports suite passes with its JSDOM canvas warnings. No workbook format, print or release identity changes.

Measured counts: {'complexity': 53, 'max-depth': 0, 'max-lines-per-function': 116, 'python': 15} → {'complexity': 52, 'max-depth': 0, 'max-lines-per-function': 116, 'python': 15}.

## saved-case-confirmation-phase

Separated shared-save/connection confirmation status from higher-priority integrity, draft, queue and PDF decisions. Passed 5,108 retained-owner comparisons covering ordered reads and interruptions, 1,033 exact Workspace snapshots, fresh test build, existing R44 saved-work and desktop-exit suites, module boundaries, test seams, ESLint and formatting. No storage/write authority, status wording, print or release identity changes.

Measured counts: {'complexity': 52, 'max-depth': 0, 'max-lines-per-function': 116, 'python': 15} → {'complexity': 51, 'max-depth': 0, 'max-lines-per-function': 115, 'python': 15}.

## correction-format-owner-test

Migrated correction-value formatting coverage from whole Writer evaluation to createCorrectionUI with explicit fail-on-read services under its existing test-build interface. All nine original behavioral assertion ASTs remain unchanged and console output is byte-identical; added inert-import protection. Production code unchanged; existing test-only hooks retained. Test seams, module boundaries, ESLint and formatting pass; legacy bundle evaluators80→79.

Measured counts: {'complexity': 51, 'max-depth': 0, 'max-lines-per-function': 115, 'python': 15} → {'complexity': 51, 'max-depth': 0, 'max-lines-per-function': 115, 'python': 15}.

## saved-work-presentation-phases

Separated connection status and PDF/recovery/diagnostic presentation from the saved-work coordinator without changing escaping, wording or renderer order. Passed 3,020 retained-function exact HTML and ordered context/escape/renderer comparisons, 5,108 saved-case comparisons, 1,033 Workspace snapshots, fresh test build and existing R44 saved-work suite. Module boundaries, test seams, ESLint and formatting pass. No storage, print, format or release identity changes.

Measured counts: {'complexity': 51, 'max-depth': 0, 'max-lines-per-function': 115, 'python': 15} → {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 114, 'python': 15}.

## report-export-case-rows

Case sheet headers and row construction retain column order, date wrappers and live case facts. Extracted one named private phase, preserving the existing owner and public interface. Passed 303 frozen-owner comparisons of exact export sheets/workbook bytes/HTML/ordered service exceptions, 4,002 standalone-sheet inputs, fresh test build and existing export-scope/mismatched-summary checks, Reports/module boundaries, test seams, ESLint and formatting. No print renderer, assertion, stored format, release identity or packaging changes. The large new test-only fixture retains the complete pre-batch owner once so every later extraction has an independent oracle; existing frozen references are untouched. Existing full Reports suite also passes (its JSDOM canvas warnings remain).

Measured counts: {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 114, 'python': 15} → {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 114, 'python': 15}.

## report-export-violation-rows

Violation sheet rows retain case-opening scope, item filters, compliance dates and snow exclusions. Extracted one named private phase, preserving the existing owner and public interface. Passed 303 frozen-owner comparisons of exact export sheets/workbook bytes/HTML/ordered service exceptions, 4,002 standalone-sheet inputs, fresh test build and existing export-scope/mismatched-summary checks, Reports/module boundaries, test seams, ESLint and formatting. No print renderer, assertion, stored format, release identity or packaging changes.

Measured counts: {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 114, 'python': 15} → {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 114, 'python': 15}.

## report-export-visit-rows

Visit sheet construction retains original case scope, result order and visit-date wrappers. Extracted one named private phase, preserving the existing owner and public interface. Passed 303 frozen-owner comparisons of exact export sheets/workbook bytes/HTML/ordered service exceptions, 4,002 standalone-sheet inputs, fresh test build and existing export-scope/mismatched-summary checks, Reports/module boundaries, test seams, ESLint and formatting. No print renderer, assertion, stored format, release identity or packaging changes.

Measured counts: {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 114, 'python': 15} → {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 114, 'python': 15}.

## report-export-citation-rows

Citation sheet construction retains issuing-inspector and ordinance exceptions, dates and override audit fields. Extracted one named private phase, preserving the existing owner and public interface. Passed 303 frozen-owner comparisons of exact export sheets/workbook bytes/HTML/ordered service exceptions, 4,002 standalone-sheet inputs, fresh test build and existing export-scope/mismatched-summary checks, Reports/module boundaries, test seams, ESLint and formatting. No print renderer, assertion, stored format, release identity or packaging changes.

Measured counts: {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 114, 'python': 15} → {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 114, 'python': 15}.

## report-export-referral-rows

Referral sheet construction retains referring-inspector scope and owner/mail fields. Extracted one named private phase, preserving the existing owner and public interface. Passed 303 frozen-owner comparisons of exact export sheets/workbook bytes/HTML/ordered service exceptions, 4,002 standalone-sheet inputs, fresh test build and existing export-scope/mismatched-summary checks, Reports/module boundaries, test seams, ESLint and formatting. No print renderer, assertion, stored format, release identity or packaging changes.

Measured counts: {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 114, 'python': 15} → {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 114, 'python': 15}.

## report-export-about-rows

About sheet construction retains clock-read order, coverage counts, definitions and exact scope wording. Extracted one named private phase, preserving the existing owner and public interface. Passed 303 frozen-owner comparisons of exact export sheets/workbook bytes/HTML/ordered service exceptions, 4,002 standalone-sheet inputs, fresh test build and existing export-scope/mismatched-summary checks, Reports/module boundaries, test seams, ESLint and formatting. No print renderer, assertion, stored format, release identity or packaging changes.

Measured counts: {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 114, 'python': 15} → {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 113, 'python': 15}.

## report-export-correction-rows

Correction rows retain Central-time recorded-day filtering, case scope and before/after formatting order. Extracted one named private phase, preserving the existing owner and public interface. Passed 303 frozen-owner comparisons of exact export sheets/workbook bytes/HTML/ordered service exceptions, 4,002 standalone-sheet inputs, fresh test build and existing export-scope/mismatched-summary checks, Reports/module boundaries, test seams, ESLint and formatting. No print renderer, assertion, stored format, release identity or packaging changes.

Measured counts: {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 113, 'python': 15} → {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 113, 'python': 15}.

## report-export-numbered-sheets

Numbered report assembly retains stable sorting, cell conversion, totals and failure notification order. Extracted one named private phase, preserving the existing owner and public interface. Passed 303 frozen-owner comparisons of exact export sheets/workbook bytes/HTML/ordered service exceptions, 4,002 standalone-sheet inputs, fresh test build and existing export-scope/mismatched-summary checks, Reports/module boundaries, test seams, ESLint and formatting. No print renderer, assertion, stored format, release identity or packaging changes. Existing complete Reports workbook suite also passes.

Measured counts: {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 113, 'python': 15} → {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 113, 'python': 15}.

## report-workbook-content-types

Workbook content type XML retains exact names, namespaces and sheet index order. Extracted one named private phase, preserving the existing owner and public interface. Passed 303 frozen-owner comparisons of exact export sheets/workbook bytes/HTML/ordered service exceptions, 4,002 standalone-sheet inputs, fresh test build and existing export-scope/mismatched-summary checks, Reports/module boundaries, test seams, ESLint and formatting. No print renderer, assertion, stored format, release identity or packaging changes.

Measured counts: {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 113, 'python': 15} → {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 113, 'python': 15}.

## report-workbook-manifest

Workbook manifest XML retains escaped sheet names, identifiers and relationship order. Extracted one named private phase, preserving the existing owner and public interface. Passed 303 frozen-owner comparisons of exact export sheets/workbook bytes/HTML/ordered service exceptions, 4,002 standalone-sheet inputs, fresh test build and existing export-scope/mismatched-summary checks, Reports/module boundaries, test seams, ESLint and formatting. No print renderer, assertion, stored format, release identity or packaging changes.

Measured counts: {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 113, 'python': 15} → {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 113, 'python': 15}.

## report-workbook-relationships

Workbook relationships retain exact worksheet/style targets and identifiers. Extracted one named private phase, preserving the existing owner and public interface. Passed 303 frozen-owner comparisons of exact export sheets/workbook bytes/HTML/ordered service exceptions, 4,002 standalone-sheet inputs, fresh test build and existing export-scope/mismatched-summary checks, Reports/module boundaries, test seams, ESLint and formatting. No print renderer, assertion, stored format, release identity or packaging changes.

Measured counts: {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 113, 'python': 15} → {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 113, 'python': 15}.

## report-table-header

Table header rendering retains numeric alignment, sort attributes, arrows and escaped labels. Extracted one named private phase, preserving the existing owner and public interface. Passed 303 frozen-owner comparisons of exact export sheets/workbook bytes/HTML/ordered service exceptions, 4,002 standalone-sheet inputs, fresh test build and existing export-scope/mismatched-summary checks, Reports/module boundaries, test seams, ESLint and formatting. No print renderer, assertion, stored format, release identity or packaging changes.

Measured counts: {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 113, 'python': 15} → {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 112, 'python': 15}.

## report-table-body

Table rows retain selection/dim markers, original row indices and first-column row headers. Extracted one named private phase, preserving the existing owner and public interface. Passed 303 frozen-owner comparisons of exact export sheets/workbook bytes/HTML/ordered service exceptions, 4,002 standalone-sheet inputs, fresh test build and existing export-scope/mismatched-summary checks, Reports/module boundaries, test seams, ESLint and formatting. No print renderer, assertion, stored format, release identity or packaging changes.

Measured counts: {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 112, 'python': 15} → {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 112, 'python': 15}.

## report-case-timeline

Case timeline construction retains document/revision/void/note facts, visit order and stable date sorting. Extracted one named private phase, preserving the existing owner and public interface. Passed 303 frozen-owner comparisons of exact export sheets/workbook bytes/HTML/ordered service exceptions, 4,002 standalone-sheet inputs, fresh test build and existing export-scope/mismatched-summary checks, Reports/module boundaries, test seams, ESLint and formatting. No print renderer, assertion, stored format, release identity or packaging changes.

Measured counts: {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 112, 'python': 15} → {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 112, 'python': 15}.

## report-case-metadata

Case metadata retains parcel/district/owner/mail facts, fallbacks and exact HTML. Extracted one named private phase, preserving the existing owner and public interface. Passed 303 frozen-owner comparisons of exact export sheets/workbook bytes/HTML/ordered service exceptions, 4,002 standalone-sheet inputs, fresh test build and existing export-scope/mismatched-summary checks, Reports/module boundaries, test seams, ESLint and formatting. No print renderer, assertion, stored format, release identity or packaging changes.

Measured counts: {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 112, 'python': 15} → {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 111, 'python': 15}.

## report-case-violation-rows

Case violation rows retain withdrawal/correction/outcome precedence, citation matching and rendered fields. Extracted one named private phase, preserving the existing owner and public interface. Passed 303 frozen-owner comparisons of exact export sheets/workbook bytes/HTML/ordered service exceptions, 4,002 standalone-sheet inputs, fresh test build and existing export-scope/mismatched-summary checks, Reports/module boundaries, test seams, ESLint and formatting. No print renderer, assertion, stored format, release identity or packaging changes.

Measured counts: {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 111, 'python': 15} → {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 111, 'python': 15}.

## report-coverage-file-list

Coverage file list rendering retains empty-list behavior, escaping, focus and accessible label. Extracted one named private phase, preserving the existing owner and public interface. Passed 303 frozen-owner comparisons of exact export sheets/workbook bytes/HTML/ordered service exceptions, 4,002 standalone-sheet inputs, fresh test build and existing export-scope/mismatched-summary checks, Reports/module boundaries, test seams, ESLint and formatting. No print renderer, assertion, stored format, release identity or packaging changes.

Measured counts: {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 111, 'python': 15} → {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 111, 'python': 15}.

## report-unlocated-reason

Unlocated-case explanations retain missing/invalid/unlooked/unmatched parcel precedence and wording. Extracted one named private phase, preserving the existing owner and public interface. Passed 303 frozen-owner comparisons of exact export sheets/workbook bytes/HTML/ordered service exceptions, 4,002 standalone-sheet inputs, fresh test build and existing export-scope/mismatched-summary checks, Reports/module boundaries, test seams, ESLint and formatting. No print renderer, assertion, stored format, release identity or packaging changes.

Measured counts: {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 111, 'python': 15} → {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 111, 'python': 15}.

## report-coverage-rows

Coverage rows retain missing/stale/unreadable/mismatched summaries, unlocated cases and parcel notes. Extracted one named private phase, preserving the existing owner and public interface. Passed 303 frozen-owner comparisons of exact export sheets/workbook bytes/HTML/ordered service exceptions, 4,002 standalone-sheet inputs, fresh test build and existing export-scope/mismatched-summary checks, Reports/module boundaries, test seams, ESLint and formatting. No print renderer, assertion, stored format, release identity or packaging changes.

Measured counts: {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 111, 'python': 15} → {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 110, 'python': 15}.

## report-outline-coverage

Outline coverage retains district/ZIP availability, field selection, dates, notes and exact wording. Extracted one named private phase, preserving the existing owner and public interface. Passed 303 frozen-owner comparisons of exact export sheets/workbook bytes/HTML/ordered service exceptions, 4,002 standalone-sheet inputs, fresh test build and existing export-scope/mismatched-summary checks, Reports/module boundaries, test seams, ESLint and formatting. No print renderer, assertion, stored format, release identity or packaging changes. Existing complete Reports workbook suite also passes.

Measured counts: {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 110, 'python': 15} → {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 110, 'python': 15}.

## workspace-queue-actions

Separated blocked, working, PDF and issued-case queue actions into named private phases. Passed 5,007 retained-owner comparisons and 1,033 exact Workspace snapshots, module boundaries, test seams, ESLint and formatting. Live input aliases, task/priority/read order, labels and storage/publication authority are unchanged. No print, stored format or release identity changes.

Measured counts: {'complexity': 50, 'max-depth': 0, 'max-lines-per-function': 110, 'python': 15} → {'complexity': 49, 'max-depth': 0, 'max-lines-per-function': 108, 'python': 15}.

## workspace-artifact-task-phases

Separated unfiled/local/problem artifact task collection into private functions without changing task order or authority. The existing public-owner suite runs unchanged against the maintained and frozen original module; outputs and diagnostics are byte-identical, and missing retained-owner execution fails explicitly. Passed 5,007 queue comparisons, 1,033 Workspace snapshots, task parity, module boundaries, test seams, ESLint and formatting. Existing assertions/references and release identities unchanged.

Measured counts: {'complexity': 49, 'max-depth': 0, 'max-lines-per-function': 108, 'python': 15} → {'complexity': 49, 'max-depth': 0, 'max-lines-per-function': 106, 'python': 15}.

## workspace-backup-validation

Separated empty-workspace and retained-record validation from backup restoration coordination. Kept every refusal and validation order, synchronous validation checkpoint, awaited device/integrity writes and live replacement order. The existing public-owner suite passes unchanged against maintained and retained modules with byte-identical output/diagnostics; module boundaries, test seams, ESLint and formatting pass. No stronger transaction guarantee, authority, version or release change.

Measured counts: {'complexity': 49, 'max-depth': 0, 'max-lines-per-function': 106, 'python': 15} → {'complexity': 48, 'max-depth': 0, 'max-lines-per-function': 104, 'python': 15}.

## restore-draft-context

Original work/checkpoint restoration occurs before the same case-array guard; async restoration and projection order are unchanged. The unchanged public-owner suite passes against maintained and frozen original modules, with byte-identical output/diagnostics. Module boundaries, test seams, ESLint and formatting pass. No new awaits, assertions, trust, stored formats or release identities changed.

Measured counts: {'complexity': 48, 'max-depth': 0, 'max-lines-per-function': 104, 'python': 15} → {'complexity': 47, 'max-depth': 0, 'max-lines-per-function': 103, 'python': 15}.

## case-save-presentation

Download fallback and save/refusal messages retain original service-getter, persistence and toast evaluation order. The unchanged public-owner suite passes against maintained and frozen original modules, with byte-identical output/diagnostics. Module boundaries, test seams, ESLint and formatting pass. No new awaits, assertions, trust, stored formats or release identities changed.

Measured counts: {'complexity': 47, 'max-depth': 0, 'max-lines-per-function': 103, 'python': 15} → {'complexity': 47, 'max-depth': 0, 'max-lines-per-function': 102, 'python': 15}.

## shared-save-result-phases

Committed metadata replacement and native write-failure classification retain lazy reads, concurrent-edit preservation and verification/write/projection order. The unchanged public-owner suite passes against maintained and frozen original modules, with byte-identical output/diagnostics. Module boundaries, test seams, ESLint and formatting pass. No new awaits, assertions, trust, stored formats or release identities changed.

Measured counts: {'complexity': 47, 'max-depth': 0, 'max-lines-per-function': 102, 'python': 15} → {'complexity': 46, 'max-depth': 0, 'max-lines-per-function': 102, 'python': 15}.

## citation-request-refresh

Separated pending deposit repricing after the existing citation pricing refresh. Retained aliases, source/correction restoration, property/service order and approved-basis resets. Existing charge public-owner suite passes unchanged against maintained and original modules with byte-identical output/diagnostics. Prior-history and pricing-refresh regressions, module boundaries, test seams, ESLint and formatting pass. No policy, price, format, print or release changes.

Measured counts: {'complexity': 46, 'max-depth': 0, 'max-lines-per-function': 102, 'python': 15} → {'complexity': 45, 'max-depth': 0, 'max-lines-per-function': 102, 'python': 15}.

## approved-deposit-completion

Separate approved manual basis completion from scheduled lookup without changing validation, partial mutations or pricing reads. Generated comparisons cover 3,036 real-policy inputs; writer services, boundaries, seams, lint and formatting pass.

Measured counts: {'complexity': 45, 'max-depth': 0, 'max-lines-per-function': 102, 'python': 15} → {'complexity': 44, 'max-depth': 0, 'max-lines-per-function': 102, 'python': 15}.

## citation-edit-phases

Split ordinance input/commit, early refusal, mode, fee and approved-basis phases. Public editing and lazy interfaces stay unchanged. 5,306 comparisons against retained source plus existing citation workflow, boundaries, seams and lint pass.

Measured counts: {'complexity': 44, 'max-depth': 0, 'max-lines-per-function': 102, 'python': 15} → {'complexity': 44, 'max-depth': 0, 'max-lines-per-function': 102, 'python': 15}.

## citation-edit-normalization

Complete the same edit-phase increment by naming date/time normalization. Retained comparisons and existing owner checks pass.

Measured counts: {'complexity': 44, 'max-depth': 0, 'max-lines-per-function': 102, 'python': 15} → {'complexity': 43, 'max-depth': 0, 'max-lines-per-function': 102, 'python': 15}.

## recipient-validation-phases

Name copy validation, agent validation and post-validation normalization. Preserve parser precedence, all-or-nothing normalization and field-specific refusal metadata. Retained public-owner checks, boundaries, seams, lint and format pass.

Measured counts: {'complexity': 43, 'max-depth': 0, 'max-lines-per-function': 102, 'python': 15} → {'complexity': 42, 'max-depth': 0, 'max-lines-per-function': 102, 'python': 15}.

## recovery-validation-phases

Separate recovery shape, unrelated work and reference checks, retaining first failure and walk identity timing. Existing recovery tests run unchanged against both sources; boundaries, seams, lint and formatting pass.

Measured counts: {'complexity': 42, 'max-depth': 0, 'max-lines-per-function': 102, 'python': 15} → {'complexity': 41, 'max-depth': 0, 'max-lines-per-function': 102, 'python': 15}.

## recovery-restore-phases

Name local history refusal, draft comparison, staging, post-commit assignment and stale-selection checks. Await checkpoints and rollback authority remain in the coordinator. Existing tests pass against the original and refactored owners with boundaries, seams, lint and formatting.

Measured counts: {'complexity': 41, 'max-depth': 0, 'max-lines-per-function': 102, 'python': 15} → {'complexity': 40, 'max-depth': 0, 'max-lines-per-function': 101, 'python': 15}.

## integrity-legacy-classification

Separate legacy/downgraded classification from modern chain verification. Hashing, trust, fail metadata and asynchronous checkpoints are unchanged. 238 original-source comparisons and existing canonical/tamper/read-only tests pass; boundaries, seams, lint and formatting pass.

Measured counts: {'complexity': 40, 'max-depth': 0, 'max-lines-per-function': 101, 'python': 15} → {'complexity': 40, 'max-depth': 0, 'max-lines-per-function': 100, 'python': 15}.

## shared-case-comparison

Separate field merge and conflict classification from shared identity/history checks. Preserve field order, checkpoint semantics and live unfinished-work default timing. Existing catalog-service assertions pass on both sources with boundaries, seams, lint and format.

Measured counts: {'complexity': 40, 'max-depth': 0, 'max-lines-per-function': 100, 'python': 15} → {'complexity': 39, 'max-depth': 0, 'max-lines-per-function': 100, 'python': 15}.

## shared-case-generated-rules

Supplement public-owner tests with 5,000 generated actual-validator cases covering field merging and conflict classifications beyond identity refusal. Existing assertions remain unchanged.

Measured counts: {'complexity': 39, 'max-depth': 0, 'max-lines-per-function': 100, 'python': 15} → {'complexity': 39, 'max-depth': 0, 'max-lines-per-function': 100, 'python': 15}.
## recovery-identical-work-regression

Pre-merge review found an automatic semicolon insertion mistake in the extracted comparison. Correct its return expression and add identical-work restore assertions, which pass on maintained and original owners. Existing assertions retained; no affected change has merged.

Measured counts: {'complexity': 40, 'max-depth': 0, 'max-lines-per-function': 101, 'python': 15} → {'complexity': 40, 'max-depth': 0, 'max-lines-per-function': 101, 'python': 15}.

## shared-preflight-phases

Name stale-view, conflict-review, notice and replacement-staging decisions. Retain read/save awaits and rollback. 168 comparisons protect merge refusal, stale views, storage failure and replacement state. Pre-commit comparisons found and corrected a return-expression extraction error; no failed version was submitted. Includes the separately tested recovery correction, retaining both checkpoint records.

Measured counts: {'complexity': 39, 'max-depth': 0, 'max-lines-per-function': 100, 'python': 15} → {'complexity': 37, 'max-depth': 0, 'max-lines-per-function': 99, 'python': 15}.

## report-filter-screen-templates

Separate advanced filters and select controls; select/option markup uses the shared screen-only tag with explicit pre-escaped fragments preserving adapter timing. Extend existing differential operations to filter output without dropping assertions. Permit only the new screen_html dependency in the strict boundary map; cycles and peer/core isolation remain enforced. Full owner comparisons, sheet XML, Reports boundaries, module boundaries, seams, lint and formatting pass.

Measured counts: {'complexity': 37, 'max-depth': 0, 'max-lines-per-function': 99, 'python': 15} → {'complexity': 37, 'max-depth': 0, 'max-lines-per-function': 98, 'python': 15}.

## report-catalog-owner

Move eleven report definitions into focused private builders and a twenty-input inert public catalog. Scope analysis rewrites only unbound calculation references; metadata and report expressions retain their original logic. All 2,750 real-model comparisons and complete Reports integration checks pass; strict module map adds only the shared-facts import and no core/UI/storage dependency. Reports startup and listeners remain unchanged.

Measured counts: {'complexity': 37, 'max-depth': 0, 'max-lines-per-function': 98, 'python': 15} → {'complexity': 37, 'max-depth': 0, 'max-lines-per-function': 98, 'python': 15}.

## report-facts-return-owners

Move formatting/filter facts and historical openness to report_facts and return preferences to a four-input inert owner. Core retains original exports and TODAY initialization. Source-body and direct live/date checks pass; catalog tests compose public owners without extracting private core bodies. 389 return comparisons retain canonical filters, duplicate relative-date calls, optional-storage refusal and partial effects. Boundaries, seams, lint and formatting pass. No new or worsened debt.

Measured counts: {'complexity': 37, 'max-depth': 0, 'max-lines-per-function': 98, 'python': 15} → {'complexity': 37, 'max-depth': 0, 'max-lines-per-function': 98, 'python': 15}.

## reports-ordinance-owner-test

Migrate the R61 ordinance suite from evaluated startup bundle to actual independently composed owners, retaining every assertion byte-for-byte. Reduce whole-bundle files79 to78, retain all54 hooks pending other consumers. Move unchanged lookup facts to the public fact owner with added source-body parity. Fix the Python shared-view inventory source path after catalog extraction; PR273 failed only because it still scanned core (0 instead of11 definitions), and all six assertions now pass against the correct defining owner. Existing expectations and trust rules unchanged. Public fact/catalog/return, boundaries, seams, lint and formatting pass.

Measured counts: {'complexity': 37, 'max-depth': 0, 'max-lines-per-function': 98, 'python': 15} → {'complexity': 37, 'max-depth': 0, 'max-lines-per-function': 98, 'python': 15}.

## reports-history-binding-regression

The Reports assembly stopped because esbuild assigned the imported fact helper the historical openAt diagnostic binding; retained bundle tests called it without history inputs. Rename only the internal helper binding and preserve its public export alias. The unchanged complete Reports suite now passes, as do public fact/catalog comparisons, boundaries, seams, lint and formatting. This corrects the PR275 regression before integration publication; no failed Reports source entered main.

Measured counts: {'complexity': 37, 'max-depth': 0, 'max-lines-per-function': 98, 'python': 15} → {'complexity': 37, 'max-depth': 0, 'max-lines-per-function': 98, 'python': 15}.

## report-export-owner-tests

Move unchanged report definitions/sheet scope and typed cell helpers out of startup core. Compose actual model, catalog, presentation and export owners for the workbook-scope regression; all25 assertions remain structurally identical, including expected rows and exported-note checks. Whole-bundle files78 to77; no hook retired while consumers remain. Complete Reports integration, 303 owner comparisons, 4,002 sheet comparisons, fact/metadata parity, boundaries, seams, lint and formatting pass.

Measured counts: {'complexity': 37, 'max-depth': 0, 'max-lines-per-function': 98, 'python': 15} → {'complexity': 37, 'max-depth': 0, 'max-lines-per-function': 98, 'python': 15}.

## reports-scoped-owner-correction

Correct failures exposed by integration PR277 without widening architecture allowances. Inject live filters into the area-label factory and live view state into return preferences; root-state importers remain11. Import the distinct report formatter by its defining name while preserving original core/public aliases. Add the omitted facts suite to the test index. Scoped architecture, Writer utilities, repository checks, source expression parity, catalog/return/R61/export-scope, complete Reports regression, boundaries, seams, lint and formatting pass. No failed Reports head has merged.

Measured counts: {'complexity': 37, 'max-depth': 0, 'max-lines-per-function': 98, 'python': 15} → {'complexity': 37, 'max-depth': 0, 'max-lines-per-function': 98, 'python': 15}.

## report-navigation-owner

Separate the large Reports click handler into period, view/filter, drill, subject and action phases through twelve scoped lazy inputs. Construction stays inert and core retains the original listener position. All5,100 comparisons retain first-match routing, synchronous errors/effects, state-read order and interruption behavior. Fresh build, complete Reports, R48, mismatch, architecture/utilities, boundaries, seams, lint and formatting pass. Complexity37 to36, long functions98 to97.

Measured counts: {'complexity': 37, 'max-depth': 0, 'max-lines-per-function': 98, 'python': 15} → {'complexity': 36, 'max-depth': 0, 'max-lines-per-function': 97, 'python': 15}.

## report-coverage-owner-test

Replace the evaluated application bundle in the mismatched-summary regression with actual model, catalog, screens, print and navigation owners. The fixture uses the real render coordinator, screen shell, row model, print preparation and click handler; no startup core or private diagnostics are evaluated. All13 original assertions are structurally unchanged, including exclusion from exports/screen/print and the real Data navigation click. Both migrated report suites pass; evaluator files77 to76, all54 hooks retained. Lint and seam ratchet pass.

Measured counts: {'complexity': 36, 'max-depth': 0, 'max-lines-per-function': 97, 'python': 15} → {'complexity': 36, 'max-depth': 0, 'max-lines-per-function': 97, 'python': 15}.

## report-preference-owner-test

Migrate the R48 output/preferences/overlapping-read suite from evaluated startup to public owners. Retain every assertion, real focus/disclosure restoration, saved preferences/storage failure behavior, malformed sorts, stale request exclusion and deposit table. Native fetch remains a controlled adapter with a synthetic page token; helper authorization code and production test flags remain unchanged. Move the active-filter expression unchanged to report_facts for shared composition. Whole-bundle files76 to75; all54 diagnostic hooks retained. All migrated Reports suites, 5,100 event comparisons, fact parity, full Reports regression, scoped architecture, boundaries, seams, lint and formatting pass. Correct the earlier coverage-entry assertion count to13.

Measured counts: {'complexity': 36, 'max-depth': 0, 'max-lines-per-function': 97, 'python': 15} → {'complexity': 36, 'max-depth': 0, 'max-lines-per-function': 97, 'python': 15}.

## report-output-owner-fixture

Migrate the report_output CLI used by Python metadata/projection tests to public owners. Compose actual accessibility enhancement and all status options; all returned rows, counted totals, coverage, sheets and complete enhanced/printed HTML equal the prior fixture across eleven reports under a fixed test clock. Move status metadata unchanged into report_metadata with exact source-expression parity; core exports are retained. Five metadata and thirteen projection Python tests pass, with all migrated Reports suites, architecture/boundaries, seams, lint and formatting. Whole-bundle files75 to74; all54 hooks remain for other consumers.

Measured counts: {'complexity': 36, 'max-depth': 0, 'max-lines-per-function': 97, 'python': 15} → {'complexity': 36, 'max-depth': 0, 'max-lines-per-function': 97, 'python': 15}.

## check-target-routing

Name identity/administrative and content/inspection target phases while retaining parcel refusal, first-match message precedence, case/source queries and Workspace fallback. All4,075 comparisons preserve selectors, labels/actions, alias returns, mutations and date-service interruptions. Existing reinspection owner, 1,026 worksheet HTML and 1,536 check HTML comparisons, architecture, boundaries, seams, lint and format pass. Complexity36 to35 with no new/worsened debt; no print or approved-wording change.

Measured counts: {'complexity': 36, 'max-depth': 0, 'max-lines-per-function': 97, 'python': 15} → {'complexity': 35, 'max-depth': 0, 'max-lines-per-function': 97, 'python': 15}.

## reinspection-outcome-result

Name the outcome result construction without changing acceptance guards, walk context, undo capture, mutation, save/render or focus order. All4,032 retained-function comparisons cover result fields, missing/carried/withdrawn work, replaced data, quick/details modes, undo and interrupted effects. Existing public owner, 4,075 target comparisons, 1,026 worksheet/1,536 check HTML cases, scoped architecture, boundaries, seams, lint and formatting pass. Complexity35 to34, with no new/worsened findings.

Measured counts: {'complexity': 35, 'max-depth': 0, 'max-lines-per-function': 97, 'python': 15} → {'complexity': 34, 'max-depth': 0, 'max-lines-per-function': 97, 'python': 15}.

## check-focus-routing

Separate workspace/catalog and recipient focus routes from worksheet/general field focusing. Preserve capture-before-context changes, live versus retained document queries, early returns, exact validation arguments, disclosure/focus/scroll and2200ms cleanup. All700 real-DOM comparisons retain partial state and interrupted effects; unchanged owner, 4,075 target and4,032 outcome comparisons, frozen worksheet/check HTML, architecture/boundaries, seams, lint and formatting pass. Complexity34 to33; no print, warning text or interface change.

Measured counts: {'complexity': 34, 'max-depth': 0, 'max-lines-per-function': 97, 'python': 15} → {'complexity': 33, 'max-depth': 0, 'max-lines-per-function': 97, 'python': 15}.

## case-save-serialization

Deduplicate pre-merge and post-merge case serialization in one synchronous helper. Keep both existing try/catch boundaries, fresh case reads, failure wording, permission/merge/write/queue ordering and partial effects. All4,048 full retained-save comparisons and original refusal assertions pass, with architecture/boundaries, lint and formatting. Complexity33 to32, no new/worsened debt or public-interface/format/trust change.

Measured counts: {'complexity': 33, 'max-depth': 0, 'max-lines-per-function': 97, 'python': 15} → {'complexity': 32, 'max-depth': 0, 'max-lines-per-function': 97, 'python': 15}.

## snow-inspection-preparation

Name the existing snow authoring/inspection defaults while leaving required-guard precedence and asynchronous letter-loading checkpoint intact. All1,824 comparisons retain draft/case identity, authoring11, inspection fallbacks, existing/new citation fields, comment facts, repeated preparation, helper reads and service failures. Existing writer-service listener audit, R33 snow, R36/R37 import regressions, fresh build, architecture/boundaries, seams, lint and format pass. Complexity32 to31; no rule, wording, authoring cutoff or release identity changes.

Measured counts: {'complexity': 32, 'max-depth': 0, 'max-lines-per-function': 97, 'python': 15} → {'complexity': 31, 'max-depth': 0, 'max-lines-per-function': 97, 'python': 15}.

## saved-work-focus-target

Name the saved-work focus target lookup at the same post-response checkpoint. Preserve summary/id/case/dataset precedence, missing-target close fallback, disclosure state, live-context refusal, helper errors and disconnected-focus behavior. All364 real-DOM comparisons pass, plus existing catalog, shared comparison/preflight, saved-work HTML, R44 saved-work regression, fresh build, architecture/boundaries, seams, lint and formatting. Complexity31 to30 meets the numerical target; long-method, test migration, screen cleanup and final audit work remain.

Measured counts: {'complexity': 31, 'max-depth': 0, 'max-lines-per-function': 97, 'python': 15} → {'complexity': 30, 'max-depth': 0, 'max-lines-per-function': 97, 'python': 15}.
