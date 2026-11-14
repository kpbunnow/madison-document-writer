# Maintainability Phase 2 — helper reasoning cost (2026-11-14)

Owner-authorized continuation after reviewing Phases 0/1 (PRs 511–512). Starting main: 3183bff1a529b655a4e2f6b1e1d79f76bc8610cf, with the diagnostic corrections in PR 513. R82/helper build 83, authoring 16, case schema 5, summary 6 and backup 2 stay unchanged. No release is packaged or deployed. This records implementation evidence, not maintainability points or City acceptance.

## Work packages

| Package | Scope | Status |
| --- | --- | --- |
| H1 | Integrity verification phases | Implemented; targeted results below; exact-head GitHub delivery pending |
| H2 | Store validation phases | Pending |
| H3 | Request/index phases | Pending |
| H4 | Projection/pricing calculations | Pending |

## H1 — integrity verification

The original `verify_record` is retained in `tests/fixtures/integrity_verification_reference.py.txt`, SHA-256 a5199d943b52636438f92ee060ed3fa1b40e6f00892eb65887226669efaad79c. It was verified against the untouched production AST and committed with the comparison tests before production changes.

`case_integrity.verify_record` still acquires the operation's context/evidence, reads retained migration data, owns event-entry sequencing and last-good progress, and catches malformed metadata into the original verdict. Its seven pure calculation phases now live in `integrity_verification`: legacy classification, genesis/event identity, entry predicate, complete event/head coverage, committed context/root, anchor conflict and final verified status. They perform no I/O or writes and import no storage/security owner. Hash operations and the original failure callback are explicit inputs. The store and all existing callers retain the same public API.

The comparison tests exercise six real synthetic chain/legacy/restart seeds, anchored/known/retained/pending/context variants, 2,200 seeded missing/malformed/tampered records, and injected OSError/ValueError/KeyError/TypeError/IndexError/AttributeError failures at every observed hash/context checkpoint. They compare exact verdicts, ordered calls and unchanged inputs. Distinct commit times verify last-good progress explicitly. Deliberately bypassing genesis, entry-link, committed-root and anchored-head checks is detected.

Measured change: verifier 108 → 51 physical lines, Radon 52 → 13, Ruff C901 19 → 10 (the exception is removed; repository Python exceptions 5 → 4). The largest new phase has Radon 13. This is genuine phase decomposition; all extracted helpers remain in the full measurement scope. No MI or overall score improvement is inferred merely from adding a module.

The original four integrity pilot mutations move to the corresponding new phase code without weakening their invariant or dropping tests. Two new mutants target anchored-head refusal and last-good progress. The full pilot passed: 18 killed, zero survived/timeout/invalid, no baseline failures. The new module is explicitly included in the required flat-runtime manifest, high-risk coverage group and hotspot inventory; an isolated Python import from only declared runtime files passes.

Targeted results passed: retained/current comparison (7 tests), store/integrity (8 and 4 tests), malformed integrity shapes (3), reporting inputs (10), authoring (12), runtime manifest (3), repository contracts (6), complexity, source inventory and the complete mutation pilot. Detailed commands and actual results belong to the delivered PR. Full gate, PR format, security and Windows recovery must pass on the exact delivered head. Historical/issued facts, source verification, request-local evidence, automatic restart notes, recovery holds and failure order remain unchanged.

Remaining plan-wide coverage/type targets from Phase 1 remain explicit backlog. Completion of H1 alone does not complete Phase 2 or establish a score of 90.
