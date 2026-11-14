# Maintainability Phase 1 — coverage, mutation pilot and checked contracts (2026-11-14)

Phase 1 of the 90+ maintainability development plan, following the baseline in `MAINTAINABILITY-BASELINE-2026-11-14.md`. It establishes coverage denominators for JavaScript and Python, runs a targeted mutation pilot and adds the first checked contracts beyond `contracts.js`. Every number here is diagnostic. None of it is gate, release or acceptance evidence, and no score is awarded. The machine-readable record is `docs/developer/maintainability/coverage-phase1-2026-11-14.json`.

## Coverage

### Method

`python tools/measure_coverage.py` copies the working tree to a temporary directory, so this checkout's build is never instrumented. The copy is a throwaway git repository with the same content. The collectors' own files sit beside the copy, not inside it, so repository-shape suites see the normal layout. The tool makes the production and test builds as the gate does, then runs every unit suite once with two collectors:

- **JavaScript** (no new dependency):
  - `tools/coverage_js_preload.cjs` starts V8 precise block coverage through Node's built-in inspector.
  - It forces inline source maps, with an absolute `sourceRoot`, on every esbuild build in the process tree, including `tools/build.py`'s builder.
  - Writer modules run through `new Function`, `eval`, jsdom or `vm`, so the preload reads each script's source and source map at exit.
  - `tools/coverage_js_report.cjs` maps executed ranges back to source files.
  - `DW_COVERAGE_SOURCEMAPS=1` makes `tools/build.py` blank, rather than delete, esbuild's path-comment lines, so the built page's map stays valid. Normal and production builds are unchanged.
- **Python:** coverage.py 7.17.3 from the hash-locked analysis environment, with branch measurement.
  - A temporary `sitecustomize` extends it to Python subprocesses.
  - `[paths]` maps the suites' temporary `…/source/` repository copies back to the canonical files, so that execution counts instead of being skipped.

Suites that may launch Chromium run afterwards, one at a time, as the gate keeps browser work serial.

**Definitions.**

- **Denominators:** every maintained file is in the denominator whether or not it ran. `helper/vendor` is the only exclusion.
- **JavaScript statements:** acorn statement and declaration nodes, excluding block statements and the function or class declaration nodes themselves; their bodies count.
- **JavaScript branches:** if/else arms, conditional arms, the right operand of `&&`, `||` and `??`, and switch cases. An implicit missing else is not counted.
- **Python:** coverage.py's own statement and arc definitions.

`tests/unit/audit_coverage_js.js` proves the JavaScript attribution on a synthetic module run through `new Function`. It checks that executed and unexecuted statements and branches are reported exactly, and that a never-run file stays in the denominator.

### Results (Phase 1 branch source; 415 suites, all passing under instrumentation)

| Language | Group | Files (unexecuted) | Statements | Branches | Plan target |
| --- | --- | ---: | ---: | ---: | --- |
| JavaScript | runtime | 166 (3) | 11,888/14,807 = 80.3% | 8,445/10,536 = 80.2% | 85% / 75% |
| JavaScript | high-risk (12 import, publication, integrity, recovery and correction modules) | 12 (0) | 1,677/1,823 = 92.0% | 1,097/1,237 = 88.7% | 90% / 85% |
| Python | runtime (`helper/*.py`) | 31 (0) | 5,592/6,273 = 89.1% | 2,065/2,476 = 83.4% | 85% / 75% |
| Python | developer (`tools/*.py`, `policy/*.py`) | 32 (6) | 1,543/2,488 = 62.0% | 546/860 = 63.5% | 80% / 70% |
| Python | high-risk (7 helper and 8 gate/release tools) | 15 (1) | 3,350/4,056 = 82.6% | 1,347/1,692 = 79.6% | 90% / 85% |

The groups are defined in `tools/coverage-groups.json`. Targets met: JavaScript runtime branches, JavaScript high-risk, and Python runtime. Not met: JavaScript runtime statements (80.3% of 85%), Python high-risk, and Python developer tools.

### Gap map

- **Not measured:**
  - Code executing inside Chromium: the browser suites and production-page workflows. This is the main reason event-owner modules read low: `workspace_events` 21%, `correction_events` 21%, `editor_events` 49%, `reinspection_events` 46% and `contact_events` 49% of statements.
  - Developer JavaScript in `tools/*.cjs`.
  - Collecting Playwright coverage from the browser suites is the next step for JavaScript.
- **Unexecuted JavaScript files:** the two bundle entry points (`app_entry.js`, `reports_entry.js`) and `reports_core.js`. Reports' composition runs only on the Reports page; no unit suite composes it.
- **Unexecuted Python developer files:** `check_format.py`, `sync_version.py`, `propose_policy_version.py` and `verify_release.py`, which are gate and release entry points that run as the gate itself, never under a unit suite; plus the two Phase 1 tools, which are themselves the measurement.
- **Python high-risk below target:** `verify_release.py` (0 of 69), `package_release.py` (14 of 128) and `gate_stages.py` (71 of 140) are exercised through subprocesses and the CI gate rather than unit suites. `server.py` is at 81% (1,017 of 1,254).

## Mutation pilot

`python tools/mutation_pilot.py` applies each hand-seeded mutant from `tools/mutation-pilot.json` alone, in a temporary copy, so this checkout is never mutated.

- Each mutant's text must occur exactly once, or it is invalid.
- The listed suites must pass on the unmutated copy first.
- The test build is remade for browser-code mutants.
- The 16 mutants cover integrity refusals (4), source/head comparisons (2), date decisions (2), pricing decisions (3), a recovery guard, issued-fact rules (3) and output safety (1).

This is a scoped pilot, not a global mutation score.

| Run | Killed | Survived | Invalid | Notes |
| --- | ---: | ---: | ---: | --- |
| 1 | 7 | 4 | 5 | The copy lacked `build/test-results`, which `run_tests.py` creates, so `audit_r31_integrity.py` failed unmutated and its five mutants were invalid. The tools now create it. |
| 2 | 12 | 4 | 0 | Survivors: genesis hash, duplicate events, chain previous hash, pending-recovery guard. |
| Final | 16 | 0 | 0 | All hand-seeded critical regressions are detected; kill rate 100% of 16 applicable mutants. |

Every survivor was reviewed. None was equivalent, and each was a missing test, now added:

- **`pricing-window-boundary` and `pricing-future-prior`.** No test pinned the window's first day or a prior dated after the violation. Added to `audit_citation_pricing_rules.py`.
- **`notice-due-spacing`.** The Best Interest Extension test refused dates three days apart, but not six. Boundary assertions (six refused, exactly seven accepted) were added to `audit_r62_extensions.js`.
- **`escape-ampersand`.** `audit_editor_html.js` compares screens against `esc()` itself, so a broken escape could not fail it. New `audit_presentation_escaping.js` checks literal expected strings.
- **`integrity-genesis-hash`, `integrity-duplicate-events` and `integrity-chain-previous-hash`.**
  - A changed genesis field, a repeated event identity and a broken chain link must each be refused with their own failure name, in the verifier's order.
  - Without the duplicate check, a later check still refused the record but named a different failure. The plan requires the original error order, so the test pins it.
  - Added to `audit_r31_integrity.py`.
- **`recovery-pending-guard`.** No test exercised it. Added to `audit_r31_integrity.py`: an ordinary save refuses a pending recovery intent, writes nothing and keeps the intent; with administrator approval it completes.

## Checked contracts

**Entries.** `tools/checked-js.json` lists the strict `tsc --checkJs` entries. `tools/run_tests.py` checks exactly these, and `tools/maintainability_js.cjs` reports the resulting file list:

- `contracts.js`, now with the mailing-fact types `MailingCase`, `MailingContact` and `EmailRecipient`;
- `mailing_rules.js`, `address_format.js` and `defendant_contact.js` (the mailing-facts port);
- `record_values.js` (`clone`, `byTime`, `caseDetails` and `stableJSON`);
- `presentation_format.js` (escaping, selectors, dates and money text).

Together that is 6 files and 306 logic lines, or 1.0% of the 30,557 runtime JavaScript logic lines, up from 16 lines (0.05%).

**What the annotations use.** Annotations are JSDoc parameter, return and declaration types only. There is no `any`, cast, `@ts-ignore`, `@ts-nocheck` or `@ts-expect-error`, and `audit_checked_contracts.js` enforces that. Where the checker could not prove a fact the code relies on, the expression was rewritten into an equivalent form, with no change in behaviour:

- `defendantName` and `defendantLines` read the Violator once, since `violatorActive` already implies one exists.
- `setCopyKind` names its target contact.
- `cleanOwnerAddress` normalizes its input with an explicit `Array.isArray` (a scalar is one line, as `[].concat` treated it).
- `esc` uses a module-level escape map.
- `stableJSON` reads properties with `Reflect.get`, the same property read.

**Negative evidence.** `audit_checked_contracts.js` compiles six deliberately wrong calls against the new contracts and requires tsc to reject each at the probe:

- a numeric address;
- a numeric owner name;
- a case-less defendant;
- copy lines used as numbers;
- escaped HTML used as a number;
- event ordering without times.

**Python typed boundaries.** Deferred. No Python type checker is locked, and annotations that nothing checks would earn no credit. Adding a hash-locked checker to `tools/analysis-requirements.txt` and checking the hotspots' public boundaries remains backlog.

## Phase 1 acceptance

| Plan requirement | Status |
| --- | --- |
| Baseline denominators explicit, per language and subgroup, including unexecuted files | Done (tables above; per-file counts in the JSON record) |
| Checked implementations compile | Done (6 entries, strict) |
| Negative tests demonstrate detection | Done (6 rejected wrong calls; 16 of 16 pilot mutants killed) |
| Complete gate passes | Recorded in the PR |
| Unfinished targets visible | See backlog below |

## Backlog after Phase 1

| Item | Now | Target |
| --- | --- | --- |
| JS runtime statement coverage | 80.3% (Chromium-executed code not measured) | 85%: collect Playwright coverage from the browser suites, then cover the event owners |
| Python high-risk coverage | 82.6% / 79.6% | 90% / 85%: gate and release tools need direct tests; `server.py` request paths |
| Python developer-tool coverage | 62.0% / 63.5% | 80% / 70% |
| Checked JS logic lines | 1.0% | 80% of runtime logic; next critical ports: import plans, issued/correction payloads, pending writes, integrity results, projection summaries, document-edit events |
| Python typed boundaries | Not checked | Hash-locked checker; five hotspots' public boundaries |
| Mutation pilot | 16 critical mutants, 100% killed | Extend with each Phase 2–3 extraction's invariants |
