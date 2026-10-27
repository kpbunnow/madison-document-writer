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
