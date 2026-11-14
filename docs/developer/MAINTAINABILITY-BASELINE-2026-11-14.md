# Maintainability baseline — 2026-11-14 (plan Phase 0)

Phase 0 of the 90+ maintainability development plan (owner document, version 1.0, 2026-11-14). This record reproduces the assessment's measurements on current main, binds them to source, inventories the five helper hotspots, records analyzer limitations, and freezes the debt cohort used for later comparison. It is diagnostic evidence, not gate, release or acceptance evidence, and awards no score.

## Baseline source

- Main `6e90380af8b31536c5d7371aa08fb5b59a5c500b` (merge of PR #510). This is the plan's recorded baseline; no outside development has advanced main since. PRs #507–#510 are merged, and main's Program verification, Windows interruption and recovery and push checks passed on that commit.
- Identity unchanged: R82, helper 2026.11.13.83/build 83, authoring 16, case schema 5, summary 6, backup 2.
- Measured input digest `467a527d92fa4005588b8663a3271b7c1e224c00285876b7503283879084aa73` over the scoped files at that commit. The per-file SHA-256 values are in `metrics.json`. The only scoped file that differs on the measuring branch is `tools/run_tests.py`, whose one changed line reads the type-checked entry list from `tools/checked-js.json`. No function's complexity changes.
- The source assessment (`MAINTAINABILITY-EVALUATION-2026-11-14.md` and `MAINTAINABILITY-METRICS-2026-11-14.zip`) was not available in the repository or the session. Every number below was therefore reproduced independently and compared with the figures the plan quotes.

## Measurement procedure

```
python -m venv ../madison-runtime/analysis-venv
../madison-runtime/analysis-venv/bin/pip install --require-hashes -r tools/analysis-requirements.txt
python tools/measure_maintainability.py --scope-commit 6e90380 --out build/maintainability/baseline-6e90380
python tools/hotspot_inventory.py build/maintainability/baseline-6e90380/metrics.json > build/maintainability/baseline-6e90380/hotspots.json
```

- **Analysis environment.** Radon 6.0.1 (with mando 0.7.1, colorama 0.4.6 and six 1.17.0) and coverage.py 7.17.3 are pinned with hashes in `tools/analysis-requirements.txt`. They are installed outside the checkout and never become runtime, build or gate dependencies; application locks are unchanged.
- **JavaScript.** Measured with the existing ESLint ratchet (`tools/complexity_report.cjs`), with its thresholds lowered to 0 so every function is recorded under the ratchet's own lexical identities. Two diagnostic-only corrections let every function be counted:
  - a method or property function is located from its key, where ESLint reports it;
  - nesting in top-level statements is attributed to `<top-level>`.

  The ratchet's own results are unchanged (`audit_complexity` passes).
- **Python.** Radon's flat CLI series (`radon cc -j`) is the comparable series. The complete series adds every class method and closure. Ruff C901 is reported separately and is never mixed with Radon.
- **Subgroups.** JavaScript is one runtime scope: `app/modules/*.js` plus `app/assets/shared.js`. Python is split into runtime (`helper/*.py`, excluding `helper/vendor`) and developer tools (`tools/*.py`, `policy/*.py`), with combined totals. `--scope-commit` limits a series to the files tracked at a given commit, so files added later cannot shift a baseline average.

## Reproduced measurements

| Measurement | Plan's assessment | Reproduced at 6e90380 | Notes |
| --- | ---: | ---: | --- |
| Import cycles | 0 | 0 | `tools/module_graph.cjs` |
| JS functions above complexity 20 | 0 | 0 | 5,566 functions; maximum 20 |
| JS functions above complexity 10 | 261 | 261 | Buckets: 1–5 4,825; 6–10 480; 11–15 169; 16–20 92 |
| JS functions above 80 nonblank/noncomment lines | 32 | 32 | Longest 233 lines |
| JS nesting above four levels | 0 | 0 | Maximum 4 |
| Service-area references | 671 over 52 pairs | 671 over 52 pairs | Event owners → Case work 98; → Documents/history 33; Feature owners → Documents/history 31 |
| Whole-app evaluator files | 7 migratable, 60 integration | 7 migratable, 60 integration | `tests/fixtures/test-seam-baseline.json` |
| Python Radon maximum complexity | 52 | 52 | `case_integrity.verify_record` |
| Python Radon functions above 10 | 131 | 131 | CLI series of 700 functions (runtime 106 of 560; developer 25 of 140). The complete series has 138 above 10 among 784. |
| Python MI | Five large modules at 0 | Same five at 0 | `case_integrity`, `case_projection`, `case_store`, `citation_pricing`, `server` |
| Type-checked JavaScript | `contracts.js` only | 1 file, 16 logic lines (0.05% of 30,557) | `tools/checked-js.json` |

**Additional distributions (baseline scope):**

- JavaScript file logic lines: mean 184, median 102.5, size-weighted 598.
- Python Radon distribution, combined: 1–5 402; 6–10 192; 11–15 74; 16–20 37; 21+ 20. Above 15: 57.
- Python MI, runtime: file mean 38.7, median 42.4, sloc-weighted 14.4.
- Python MI, developer tools: mean 47.3, median 45.5, weighted 37.6.
- Ruff C901 findings above 10: 5, the existing ratchet.

**Coverage.** No statement or branch coverage measurement existed at baseline. Phase 1 establishes the denominators; until then coverage is unknown and earns no credit.

## Analyzer limitations and their handling

1. **Radon MI and raw metrics on `helper/case_projection.py`.** Radon splits source text with `str.splitlines()`, which also breaks on U+2028/U+2029. Line 61's ECMAScript whitespace table contains those characters inside a string literal, so the MI pass raises a SyntaxError.
   - Handling: `tools/maintainability_py.py` analyses a copy in which each raw line separator is replaced by its escape sequence. The copy is accepted only if its AST is identical to the original's and its LF line count is unchanged.
   - Production source is never rewritten, and Radon's complexity pass parses the original unchanged.
2. **Radon CLI series versus complete series.** `radon cc -j` nests class methods under their class and omits them from its flat function list. The assessment's 131/700 is that flat series, so it remains the comparable series. The complete series (138/784) is recorded alongside it so methods and closures are never invisible.
3. **ESLint function identities.** Identities are lexical (`file:owner#n/inner#n`) and never line numbers. Five of the 5,566 complexity entries have no matching line-count entry (identity collisions between same-named anonymous functions). The counts above use each metric's own entries.
4. **Two complexity tools.** ESLint and Radon count Boolean operators and comprehension conditions differently. JavaScript and Python are therefore reported separately and never combined.
5. **Missing analyzers at baseline.**
   - No JavaScript coverage tool, Python coverage report, Python type checker or mutation tool is part of the toolchain.
   - Phase 1 adds coverage collection without new application dependencies.
   - A Python type checker is not yet locked, so Python boundary typing remains backlog.

## Helper hotspot register

Produced by `tools/hotspot_inventory.py` from the AST; nothing is executed. The listed effects are only those a function performs itself.

| Module | SLOC | MI | Functions (>10) | Refusal sites | Direct writes / locks / network | Top complexity |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `case_integrity.py` | 542 | 0 | 32 (6) | 20 | Writes in `register_migration`, `reconcile_publication`, `publish_record`, `anchor_daily`, `anchor_after_save`; locks in `register_migration`, `anchor_daily` | `verify_record` 52, `VerificationContext.__init__` 18, `commit_record` 17 |
| `case_store.py` | 1,817 | 0 | 124 (44) | 185 | Writes in `atomic_write`, `create_only_write`, `publish_new`, `_merge_existing_case_save`, `_publish_validated_case`, `save_summary`, `file_lock`; lock scopes in `save_case`, `_save_case`, `_publish_validated_case`, `save_summary` | `_validate_initial_notice_group` 32, `legacy_scheduled_citation_base` 28, `_validate_cash_citation` 26 |
| `server.py` | 1,570 | 0 | 101 (14) | 80 | Writes for PDFs, backups, GIS cache and catalog review; network in `fetch_json`, `city_parcels`, `read_areas` | `read_index` 38, `lookup_parcels` 31, `_validated_catalog_review_request` 24 |
| `case_projection.py` | 837 | 0 | 91 (10) | 6 | None (pure projection) | `violation_row`, `date_ms`, `case_status` and `Facts.__init__`, each 16 |
| `citation_pricing.py` | 429 | 0 | 36 (8) | 14 | None (pure policy calculation) | `resolve` 38, `prior_offenses` 27, `_validate_pricing_selection` 25 |

### Operation maps of the largest functions

**`case_integrity.verify_record` (52).** This is the read-side trust decision for every case read, save and Reports index entry. It writes nothing; it reads anchor evidence and the retained registry through its `VerificationContext`. Its ordered phases each return the first failure:

1. Anchor evidence.
2. Legacy versus downgraded classification.
3. Retained-genesis match.
4. Genesis hash.
5. Duplicate event identities.
6. Genesis history hash.
7. Per-event chain walk (sequence, previous hash, hash).
8. Missing or surplus events and the head hash.
9. Record-commit chain.
10. Commit context: event order, metadata and root hash of case details and inspectors.
11. The anchored head, including the administrative-recovery exception.
12. Verdict labels: pending migration, anchored or unanchored, and history restarted.

Six exception types map to `_damaged_verdict`.

- **Authority:** the only producer of `valid`, the label and `lastGoodCommitTime`.
- **Invariants to preserve:** failure order, labels, the `eventId`/`expected`/`actual` text and the administrative-recovery acceptance.
- **Separable pure phases:** genesis, chain, commits and commit context, each taking explicit inputs. Anchor and context lookups and verdict composition stay in the coordinator.

**`server.read_index` (38).** This is the Reports index over the shared case folder. It reads the folder listing, summaries and case files through the bounded speculative reader (`ordered_reads`). Identity, duplicate, revision and chain checks happen in a fixed order on the consuming thread.

- Each case is put in exactly one bucket: summaries, unreadable, missing, stale or mismatched. One unreadable case never fails the index.
- **Authority:**
  - verification is delegated to `verify_record`;
  - the facts in a summary are accepted only if they equal the projection of the verified case (`projection_mismatch`).
- **Separable phases:** summary shape validation, case-file identity resolution and bucket classification. Speculative reads and ordering stay in the coordinator.

**`server.lookup_parcels` (31).** This updates the parcel history cache under `CACHE_LOCK` and the `parcel-cache` file lock, and fetches City GIS data through trusted connections. The cache merge is the separable calculation.

**`case_store._validate_initial_notice_group` (32), `_validate_cash_citation` (26) and `legacy_scheduled_citation_base` (28).** These are write-side validation run inside the save transaction:

- the issuance-group rules for an Official Notice and its selected initial citations;
- cash deposit modes and zero-base rules by authoring version and date window;
- the historical scheduled base recovered for older citations.

They raise `ValueError`, which becomes a 400 refusal, and they change nothing; the coordinators (`_save_case`, `_publish_validated_case`) own locks, expected heads and atomic writes. Historical acceptance by authoring version is a frozen contract.

**`citation_pricing.resolve` (38) and `prior_offenses` (27).**

- `resolve` maps a charged ordinance and library key to a schedule entry: exact entry, mapped entry, child-section fallback, and the excluded and manual-only cutoffs.
- `prior_offenses` counts earlier counted offenses within the entry's window, for the site and season windows and for the defendant key, plus staged charges.

Both are pure and mirrored in the frontend (`citation_policy.js`). They need frontend/helper parity evidence before any extraction.

**`case_projection.py` (ten functions above 10).** This is the pure summary and Reports projection mirrored by `app/modules/case_projection.js`, and `read_index` depends on exact parity between the two. Its JavaScript-compatible primitives (`jstr`, `date_ms`, `JS_SPACE`) are deliberate cross-runtime mirrors, not accidental duplication.

## Frozen debt cohort

`docs/developer/maintainability/baseline-cohort-2026-11-14.json` lists, by stable identity, every function above the thresholds at baseline:

- 261 JavaScript functions above complexity 10;
- 32 JavaScript functions above 80 lines;
- 131 Python functions in the Radon CLI series above 10;
- the five MI-zero modules.

Later measurements map each entry to its successors. An entry leaves only with a recorded disposition, so moving or renaming code cannot erase debt from the trend.

## Implementation backlog (from this baseline)

| Item | Baseline | Plan target | Next owner |
| --- | ---: | --- | --- |
| Statement/branch coverage, JS and Python | Not measured | Runtime 85%/75%; high-risk 90%/85%; tools 80%/70% | Phase 1 (denominators), then later batches |
| Type-checked JS logic lines | 0.05% | 80% of runtime logic; all critical ports | Phase 1 begins; later batches |
| Python typed boundaries | None checked | Hotspot public boundaries | Needs a locked type checker |
| JS functions above complexity 10 | 261 | ≤130 | Phase 3 |
| Python Radon functions above 10 | 131 | ≤65; none above 20 | Phase 2 (H1–H4) |
| Python maximum complexity | 52 | ≤20 | Phase 2 |
| Long JS functions | 32 | ≤20 | Phase 3 |
| Migratable whole-app evaluators | 7 | 0 | Phase 4 |
| Mutation evidence | None | Pilot ≥90% of applicable mutants killed | Phase 1 pilot |
| New-code complexity rule (≤10) | `case_store._clean_owner_address` is 11 (added in PR #507) | ≤10 | Phase 2 (H2), with its JS mirror |
