# Maintainability Phase 2 — helper reasoning cost (2026-11-14)

Owner-authorized continuation after reviewing Phases 0/1 (PRs 511–512). Starting main: 3183bff1a529b655a4e2f6b1e1d79f76bc8610cf, with the diagnostic corrections in PR 513. R82/helper build 83, authoring 16, case schema 5, summary 6 and backup 2 stay unchanged. No release is packaged or deployed. This records implementation evidence, not maintainability points or City acceptance.

## Work packages

| Package | Scope | Status |
| --- | --- | --- |
| H1 | Integrity verification phases | Merged PR #514 at 544541424cc414165a82ca90bda2741d9e3b3d43; all exact-head checks passed |
| H2 | Store validation phases | Merged PR #515 at ae21684ae96894ae280d1031932b63fa6a2d6dd8; all exact-head checks passed |
| H3 | Request/index phases | Merged PR #516 at b99ac6f5c2cd3f3e5fff609b0f4c0e78b45d7f3b; all exact-head checks passed |
| H4 | Projection/pricing calculations | Merged PR #516 at b99ac6f5c2cd3f3e5fff609b0f4c0e78b45d7f3b; all exact-head checks passed |

## H1 — integrity verification

The original `verify_record` is retained in `tests/fixtures/integrity_verification_reference.py.txt`, SHA-256 a5199d943b52636438f92ee060ed3fa1b40e6f00892eb65887226669efaad79c. It was verified against the untouched production AST and committed with the comparison tests before production changes.

`case_integrity.verify_record` still acquires the operation's context/evidence, reads retained migration data, owns event-entry sequencing and last-good progress, and catches malformed metadata into the original verdict. Its seven pure calculation phases now live in `integrity_verification`: legacy classification, genesis/event identity, entry predicate, complete event/head coverage, committed context/root, anchor conflict and final verified status. They perform no I/O or writes and import no storage/security owner. Hash operations and the original failure callback are explicit inputs. The store and all existing callers retain the same public API.

The comparison tests exercise six real synthetic chain/legacy/restart seeds, anchored/known/retained/pending/context variants, 2,200 seeded missing/malformed/tampered records, and injected OSError/ValueError/KeyError/TypeError/IndexError/AttributeError failures at every observed hash/context checkpoint. They compare exact verdicts, ordered calls and unchanged inputs. Distinct commit times verify last-good progress explicitly. Deliberately bypassing genesis, entry-link, committed-root and anchored-head checks is detected.

Measured change: verifier 108 → 51 physical lines, Radon 52 → 13, Ruff C901 19 → 10 (the exception is removed; repository Python exceptions 5 → 4). The largest new phase has Radon 13. This is genuine phase decomposition; all extracted helpers remain in the full measurement scope. No MI or overall score improvement is inferred merely from adding a module.

The original four integrity pilot mutations move to the corresponding new phase code without weakening their invariant or dropping tests. Two new mutants target anchored-head refusal and last-good progress. The full pilot passed: 18 killed, zero survived/timeout/invalid, no baseline failures. The new module is explicitly included in the required flat-runtime manifest, high-risk coverage group and hotspot inventory; an isolated Python import from only declared runtime files passes.

Targeted results passed: retained/current comparison (7 tests), store/integrity (8 and 4 tests), malformed integrity shapes (3), reporting inputs (10), authoring (12), runtime manifest (3), repository contracts (6), complexity, source inventory and the complete mutation pilot. Detailed commands and actual results belong to the delivered PR. Full gate, PR format, security and Windows recovery must pass on the exact delivered head. Historical/issued facts, source verification, request-local evidence, automatic restart notes, recovery holds and failure order remain unchanged.

Remaining plan-wide coverage/type targets from Phase 1 remain explicit backlog. Completion of H1 alone does not complete Phase 2 or establish a score of 90.

## H2 — store validation

The store retains the two-pass notice-before-citation coordinator, transaction/lock ownership, amount parsing and historical policy file reads. `issuance_validation` contains pure grouped identity, signer, source and selection checks; `cash_validation` contains zero-base approval, assessment, total, schedule and legacy tier calculations. Pricing operations are supplied explicitly and remain lazy and ordered. Historical fallback rows are transformed eagerly as before; historical float-to-Decimal conversion is unchanged.

The existing 3,000-case issuance and 3,000-case authoring differential corpora pass. The new five-test suite compares the retained cash function across versions 4–16, modes, date windows, 2,400 malformed field scenarios and interrupted pricing checkpoints, and compares original legacy scheduling across all approved legacy ordinances/tiers and 400 malformed policies. Results, exception classes/messages, ordered resource/pricing calls and input immutability agree. A declared-files-only flat runtime imports the store successfully. References were committed before extracting their production functions. Existing legal wording, mandatory appearance, publication, prior records and date holds are unchanged.

The full mutation pilot adds grouped-signer, recorded-assessment and zero-base approval probes without removing the original mutations. Complexity remains subject to the existing ratchet, with no higher allowance. New leaves remain measured hotspots, high-risk coverage inputs and explicit deployed runtime entries. Larger store authorities retain cohesive ordered validation/publication responsibilities; their remaining MI/complexity debt is not claimed resolved by this extraction.

## H3 — request/index and parcel phases

`read_index` retains folder discovery, fresh request-local summary inputs/context, bounded ordered speculative reads, consuming-thread trust verification and per-case failure isolation. Named server phases separate speculative input reading from verified acceptance. The new `index_validation` leaf checks metadata/duplicates and assembles final exclusions; `parcel_history` merges a single operation's supplied history. Neither leaf reads files or contacts the network. Server authentication, source hashing, integrity verification on every request, locks, cache write timing, cancellation/transport and source-bound projection caching retain their owners and behavior.

The original index and parcel functions are retained with SHA-checked fixtures. Three new tests compare 240 malformed/missing/duplicate summary variants, interrupted case reads, unavailable folders and damaged retained evidence, plus historical parcel cache/refusal combinations. Exact results, ordered reads/writes and partial state agree. Existing reporting-input (10 tests), readiness (5) and R23 helper/GIS tests remain required. The new test initially needed closure-aware cloning for decorated server functions; that harness defect was corrected, with original/current comparisons then passing. No app behavior change was required.

The read_index Ruff exception is removed (repository Python exceptions 4 → 3). All extracted work remains measured and explicitly deployed. Larger server route coordinators retain authenticated transport and ordered effect authority; their remaining debt is explicit rather than hidden behind a new module. Stale-summary and duplicate-summary mutation probes must be detected before delivery.

## H4 — projection and pricing calculations

`projection_values` owns the pure JavaScript value primitives, with a single shared undefined sentinel re-exported through the existing projection API. Strict boolean/number/undefined distinctions, UTF-16 ordering, whitespace, array/object conversion and JSON omission remain exact. Dates, City time, policy/roster loading, replay, workspace access and report projection stay in `case_projection`. No browser interpreter or legal/print reference is changed.

Pricing resolution now names exact-entry, mapping, parent/child and fallback decisions. `prior_offenses` coordinates ordered per-record accumulation through explicit eligibility and append phases; the seen-citation set still spans the whole operation and staged entries remain appended under their original window rules. Live policy callbacks stay in their original owner and are evaluated at the same time; no policy or trust cache is introduced.

Four new tests compare the original/current functions over all 564 schedule entries at four historical/current policy selections, every item mapping, exact/missing IDs and every observed dependency interruption; 1,200 history scenarios include duplicate citations, different owners, withdrawn items, staged offenses and window/date boundaries. Direct value tests cover undefined, null, booleans, numeric/string conversion, arrays/objects and ordered strict comparisons. Original function fixtures were retained before production extraction. Reference extraction uses LF boundaries (the original ECMAScript whitespace literal contains Unicode line separators); hashes and AST provenance are checked. Compiled reference code is reused with a fresh namespace for every comparison, preserving isolation.

Existing projection-phase comparison (2 tests over three generated seeds and both workspace modes), pricing rules (3), historical pricing (4), violator pricing (3), report facts (17 unchanged expressions), runtime import (3), repository (6), formatter, Pyflakes, Vulture and complexity ratchet pass. Full generated/captured browser projection parity, historical print and native recovery remain mandatory in the exact-head GitHub gate. The pilot adds exact-entry selection, prior-number deduplication, strict types and undefined truthiness mutants, retaining all earlier mutations.

## Measured improvements and remaining debt

Radon 6.0.1, Python 3.14.10; original source 3183bff1a529b655a4e2f6b1e1d79f76bc8610cf. All extracted leaves stay in runtime scope, high-risk coverage and hotspot inventory and are declared in both required/deploy manifest sections. These are function-level comparisons, not a new overall maintenance score.

| Existing operation | Original Radon | Current Radon |
| --- | ---: | ---: |
| Integrity verification | 52 | 13 |
| Initial notice group coordinator | 32 | 11 |
| Cash-citation store entry point | 26 | 1 |
| Historical scheduled-base store entry point | 28 | 1 |
| Index request coordinator | 38 | 8 |
| Parcel lookup coordinator | 31 | 5 |
| Pricing resolution | 38 | 14 |
| Prior-offense coordinator | 27 | 5 |

The entry-point reductions are not the disappearance of debt: pure phases and per-record loops are measured in their new owners. Genesis/commit validation phases remain Radon 12/13, historical schedule coordination 13, summary metadata 12, pricing resolution 14 and prior-record accumulation 15. These preserve related ordered decisions and failure progress; further decomposition should require an actual testable boundary. No raised threshold or baseline exemption masks them. Python Ruff exceptions fall from 5 to 3; the remaining exceptions are the existing integrity-context initializer, store file lock and launcher main.

File-level MI remains zero for `case_store`, `server`, `case_projection` and `citation_pricing`. Store publication/locking, authenticated transport and request-local evidence, independent replay/report calculation, and historical pricing authority respectively remain cohesive owners; remaining large functions and low-MI debt are explicit follow-up work, not waived targets. Pure projection semantics also remain below the plan's desired MI 70. Do not split modules solely to increase MI or move policy/storage authority into new layers. The full metrics output retains every file/function, analyzer compatibility treatment and source-input hashes.

Phase 1 overall coverage/type targets and later plan phases remain incomplete. Selected-suite instrumentation and a mutation pilot establish focused evidence only, never complete coverage, Windows/City acceptance or release approval. Completion of Phase 2 does not establish an overall score of 90.

The complete 26-mutant pilot passed with zero survivors, timeouts, invalid mutations or baseline failures before the final parcel calculation extraction. The parcel differential/GIS checks were rerun after that extraction; the delivered head gets a fresh source-bound pilot and the complete required GitHub checks before merging.


Final local verification: full standalone `audit_case_projection.py` passed all 6 tests, retaining its >5,000 generated-comparison threshold, three seeds and seven captured Writer flows. An initial standalone invocation used a production build, whose test-only fixture `futureDue` is absent; rebuilding with the documented `DW_TEST_BUILD=1` setup resolved the harness setup failure without changing app code or assertions. The production build and its separate browser checks remain required in GitHub.

Comparable complete-series runtime measurement (all top-level helper Python files, including methods/closures and every new leaf): functions 645 → 684; above 10 remains 112 → 112; above 20 falls 17 → 9; maximum 52 → 25. The new phases reduce severe hotspots without implying that all remaining complexity debt vanished. The final parcel extraction reduces its coordinator 31 → 5, with normalization, needed-ID selection, history merge and response leaves each at 7–8. The final integrity/store/server/projection/pricing owners retain their original responsibilities and public entry points.
