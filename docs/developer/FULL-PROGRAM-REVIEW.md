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
| FULL-005 | P2 | Nonfinite numbers in the parcel cache enter the HTTP response as `NaN`/`Infinity`; browser JSON parsing fails and Reports cannot open. Excessive nesting can also break the read. | The cache uses the existing finite-number decoder and expected nesting fallback. Real HTTP regression checks browser-readable JSON, unchanged damaged bytes and exact retention of healthy historical cache entries. |
| FULL-006 | P2 | The case-number inventory flags a supported BOM case as unreadable, accepts a linked case as ordinary, and aborts the complete scan on excessively nested JSON. | Uses the established secure case decoder; names unusable entries without following links, rewriting records or stopping healthy-file review. |
| FULL-007 | P2 | Overflowing creation times/process IDs or excessive nesting in lock metadata crash lock inspection instead of reporting an unreadable owner. | Expected parse failures and process-ID bounds report unknown ownership. Regressions preserve bytes, recent-lock refusal and live-owner refusal; no automatic release or authority change. |
| FULL-008 | P2 | A catalog manifest containing an array/null/scalar or deeply nested JSON crashes the complete setup health check. | Shape validation and expected nesting handling report an unavailable manifest while retaining the other setup facts. |

## Checkpoint 1: helper transport and integrity

Completed reads cover the helper server, integrity/verification, summary/index readers, inspector lists, operational locks/health, session bootstrap, file containment, trust/CSP, value semantics, cash/admin validation, parcel history and shared workflow owners, plus selected regression sources. Remaining helper owners, application modules, build/update/CI, tests and data remain in the ledger for subsequent checkpoints.

Targeted tests pass for the first corrective batch: 12 reporting-input tests, 10 damaged-folder/startup/BOM tests, 8 integrity tests and 7 integrity-phase tests. The PR records the final head, actual checks and required GitHub results. Frozen fixtures, approved wording, release identities, dependency locks and issued histories are preserved; no release is packaged or deployed.

Delivered through [PR #566](https://github.com/kpbunnow/madison-document-writer/pull/566). Its exact head `7852ef99557812a24d1d899fad33320a9172f578` passed the [full gate](https://github.com/kpbunnow/madison-document-writer/actions/runs/46037161765), PR format, CodeQL and Windows recovery before normal merge `01e5fd3c2131a1c7fa86a08fda42fd9ce75e2b40`; the merged tree equals the verified head's tree. Post-merge main verification is separate.

## Checkpoint 2: auxiliary data, persistence and recovery

All 43 maintained helper code files have now been read, alongside the first application persistence/startup/recovery owners. This does not complete the application, tooling, CI, test or data review. The new seven-test auxiliary-metadata suite reproduces findings FULL-005 through FULL-008 before their corrections; the delivery PR records subsequent targeted and exact-head gate results.

For FULL-004, five repeated runs over identical retained 100/400/1,200-case folders measured median startup reconstruction times of 0.118/0.623/3.231 seconds, with 100/400/1,200 registry reads respectively. Every case, summary and registry byte remained unchanged. These are local synthetic baselines; the separate optimization and matched after measurements remain pending.
