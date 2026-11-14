# Maintainability Phase 2 — helper reasoning cost (2026-11-14)

Owner-authorized continuation after reviewing Phases 0/1 (PRs 511–512). Starting main: 3183bff1a529b655a4e2f6b1e1d79f76bc8610cf, with the diagnostic corrections in PR 513. R82/helper build 83, authoring 16, case schema 5, summary 6 and backup 2 stay unchanged. No release is packaged or deployed. This records implementation evidence, not maintainability points or City acceptance.

## Work packages

| Package | Scope | Status |
| --- | --- | --- |
| H1 | Integrity verification phases | Merged PR #514 at 544541424cc414165a82ca90bda2741d9e3b3d43; all exact-head checks passed |
| H2 | Store validation phases | Implemented; exact-head gate pending |
| H3 | Request/index phases | Implemented; exact-head gate pending |
| H4 | Projection/pricing calculations | Pending |

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
