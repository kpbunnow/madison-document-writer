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
