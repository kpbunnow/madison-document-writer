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
