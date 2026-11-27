# Full program code review

Status: **in progress**. This is a checkpoint record, not a claim that the entire program is reviewed or bug-free.

The reviewed baseline is main `68c5f0482d46a22dd6c9241b61d84b59591fa7cb` (R86), with passing GitHub full, security and Windows recovery gates. The working source inventory includes 167 application modules (about 35,000 lines), 43 helper code files (about 11,000 lines), 53 tooling files (about 8,000 lines), and tests, data and CI. Maintained source is reviewed separately from generated output, approved print/history, bundled dependencies and staff/manual editions; binary and generated artifacts are verified through their source, integrity and existing gates.

A resumable file/hash/range ledger is retained in the execution workspace at `/workspace/scratch/work/full-review-2026-11-27/coverage.json`. Pending ranges stay pending. Checkpoints do not replace exact-head merge verification or establish City/native acceptance.

## Confirmed findings

| ID | Severity | Trigger and consequence | Correction/status |
| --- | --- | --- | --- |
| FULL-001 | P2 | A deeply nested summary raises `RecursionError` in speculative index loading, aborting the complete Reports request instead of excluding that file. | Corrected expected-error handling in the summary input/context reader and per-file index boundary. Serial/four-reader regressions preserve two healthy cases, name the damaged summary, retain original bytes and preserve secure-reader refusals. |
| FULL-002 | P2 | A valid BOM-prefixed case can be opened normally but blocks daily integrity anchoring and is omitted when reconstructing a missing registry. | Both case-reading paths use the established case decoder. Actual anchoring and registry rebuild tests preserve case bytes/genesis identities; a tampered BOM case still cannot be anchored. Integrity metadata decoding stays strict. |
| FULL-003 | P1 | A case file containing an array/null/scalar, or excessively deep JSON, raises before the helper starts its HTTP listener. One damaged file can prevent opening the program. | Startup reconstruction now skips nonrecords and expected nesting failures. Regressions preserve the damaged bytes and existing registry, including an unregistered malformed entry. Normal read/report owners still expose damage. |
| FULL-004 | P2 | Startup reparses the full migration registry for every already-registered case, producing quadratic I/O. A 400-case synthetic baseline read it 400 times in 0.408 seconds. | Reproduced; a separate performance correction and comparable before/after verification remain pending. Existing verification, recovery and conflict rules must be preserved. |

## Checkpoint 1: helper transport and integrity

Completed reads cover the helper server, integrity/verification, summary/index readers, inspector lists, operational locks/health, session bootstrap, file containment, trust/CSP, value semantics, cash/admin validation, parcel history and shared workflow owners, plus selected regression sources. Remaining helper owners, application modules, build/update/CI, tests and data remain in the ledger for subsequent checkpoints.

Targeted tests pass for the first corrective batch: 12 reporting-input tests, 10 damaged-folder/startup/BOM tests, 8 integrity tests and 7 integrity-phase tests. The PR records the final head, actual checks and required GitHub results. Frozen fixtures, approved wording, release identities, dependency locks and issued histories are preserved; no release is packaged or deployed.
