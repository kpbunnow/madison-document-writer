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
| FULL-004 | P2 | Startup reparses and locks the full migration registry for every already-registered case, producing quadratic I/O and redundant lock writes. | Startup reuses one registry inventory while independently validating/verifying every case. New/conflicting registration retains the original locked fresh read. Eight regressions and alternating before/after measurements cover the correction below. |
| FULL-005 | P2 | Nonfinite numbers in the parcel cache enter the HTTP response as `NaN`/`Infinity`; browser JSON parsing fails and Reports cannot open. Excessive nesting can also break the read. | The cache uses the existing finite-number decoder and expected nesting fallback. Real HTTP regression checks browser-readable JSON, unchanged damaged bytes and exact retention of healthy historical cache entries. |
| FULL-006 | P2 | The case-number inventory flags a supported BOM case as unreadable, accepts a linked case as ordinary, and aborts the complete scan on excessively nested JSON. | Uses the established secure case decoder; names unusable entries without following links, rewriting records or stopping healthy-file review. |
| FULL-007 | P2 | Overflowing creation times/process IDs or excessive nesting in lock metadata crash lock inspection instead of reporting an unreadable owner. | Expected parse failures and process-ID bounds report unknown ownership. Regressions preserve bytes, recent-lock refusal and live-owner refusal; no automatic release or authority change. |
| FULL-008 | P2 | A catalog manifest containing an array/null/scalar or deeply nested JSON crashes the complete setup health check. | Shape validation and expected nesting handling report an unavailable manifest while retaining the other setup facts. |
| FULL-009 | P2 | Individual-case recovery drops its backup's retained integrity records. With the share offline, an invalid record's evidence is lost from the persisted bundle and its live status becomes “not yet checked.” | Validate/bind retained records, merge only the restored case's evidence and restore through the integrity owner after durable acknowledgment. Invalid verdicts remain read-only; unrelated proofs, older backups and local ID aliases are retained. |
| FULL-010 | P2 | Automatic citation numbering can choose `B…` when `b…` is already reserved, although publication correctly refuses that duplicate. | The generator uses the existing case-insensitive citation-number key. Regression covers draft, withdrawn and issued reservations, next-second rollover and unchanged stored numbers. |
| FULL-011 | P2 | While issuance or correction waits for shared-save confirmation, later navigation is overwritten when the save finishes, closing the newer view/dialog. | The successful continuation updates the originating view only while its context still matches. Filing still completes. Ordinary/paired issuance and correction regressions reproduce the earlier navigation loss. |
| FULL-012 | P2 | A schema-5 file with self-consistent hashes but a nontext case number crashes startup registration; an empty number can be appended to the registry and make retained evidence unusable for other cases. | Reconstruction also runs the established legacy-compatible case-shape/identity validation before verifying and registering a case. The malformed file and existing registry remain byte-identical. |

## Checkpoint 1: helper transport and integrity

Completed reads cover the helper server, integrity/verification, summary/index readers, inspector lists, operational locks/health, session bootstrap, file containment, trust/CSP, value semantics, cash/admin validation, parcel history and shared workflow owners, plus selected regression sources. Remaining helper owners, application modules, build/update/CI, tests and data remain in the ledger for subsequent checkpoints.

Targeted tests pass for the first corrective batch: 12 reporting-input tests, 10 damaged-folder/startup/BOM tests, 8 integrity tests and 7 integrity-phase tests. The PR records the final head, actual checks and required GitHub results. Frozen fixtures, approved wording, release identities, dependency locks and issued histories are preserved; no release is packaged or deployed.

Delivered through [PR #566](https://github.com/kpbunnow/madison-document-writer/pull/566). Its exact head `7852ef99557812a24d1d899fad33320a9172f578` passed the [full gate](https://github.com/kpbunnow/madison-document-writer/actions/runs/46037161765), PR format, CodeQL and Windows recovery before normal merge `01e5fd3c2131a1c7fa86a08fda42fd9ce75e2b40`; the merged tree equals the verified head's tree. Post-merge main verification is separate.

## Checkpoint 2: auxiliary data, persistence and recovery

All 43 maintained helper code files have now been read, alongside the first application persistence/startup/recovery owners. This does not complete the application, tooling, CI, test or data review. The new seven-test auxiliary-metadata suite reproduces findings FULL-005 through FULL-008 before their corrections; the delivery PR records subsequent targeted and exact-head gate results.

For FULL-004, the initial five-run baseline over retained 100/400/1,200-case folders measured median reconstruction times of 0.118/0.623/3.231 seconds, with 100/400/1,200 registry reads respectively. Every case, summary and registry byte remained unchanged. Matched alternating measurements are recorded below.

Delivered through [PR #567](https://github.com/kpbunnow/madison-document-writer/pull/567). Its exact head `c94c9a4520356ea86ee765f298b347cbae3a22e3` passed the [full gate](https://github.com/kpbunnow/madison-document-writer/actions/runs/46039094752), PR format, CodeQL and Windows recovery before normal merge `7458b326cf37e2c172c2a6cc7050090d69bd2ff3`; the merged tree equals that verified head. The earlier post-merge main run for #566 failed before browser tests during apt setup (Microsoft package repository HTTP 403); the complete workflow was rerun rather than combining evidence from different attempts.

That rerun was superseded by #567's main push. Main `7458b326cf37e2c172c2a6cc7050090d69bd2ff3` subsequently passed its own [full gate](https://github.com/kpbunnow/madison-document-writer/actions/runs/46041456029) and [Windows recovery](https://github.com/kpbunnow/madison-document-writer/actions/runs/46041456054).

## Checkpoint 3: retained recovery evidence and Writer continuation

Review has continued through application startup/storage, backups, record actions, issuance/corrections, citation readiness, mailing and PDF coordination. Remaining application, tooling/CI, tests and data ranges are still pending in the coverage ledger. Findings FULL-009 through FULL-011 are a focused Writer correction batch; its PR records exact verification and delivery status. The original issuance comparison still covers all 5,000 scenarios with unchanged assertions and frozen reference; new regressions separately exercise navigation while save acknowledgment is pending.

The first checkpoint-3 GitHub gate exposed two unrecorded architectural dependencies, despite passing functional/browser suites: the pure citation-number identity import and individual recovery’s existing integrity owner. Both edges were explicitly reviewed and documented in the architecture and exact dependency inventories; architectural assertions remain in place. Current main’s independently approved Weights and Measures development was incorporated before repeating the complete gate.

Submitted as [PR #570](https://github.com/kpbunnow/madison-document-writer/pull/570); its complete exact-head GitHub gate is required before merge.

## Checkpoint 4: startup reconstruction

The startup correction addresses FULL-004 and the additionally reproduced malformed-identity gap FULL-012. Its request-local inventory is discarded after the call. It does not cache verdicts or replace the fresh locked registry check for new/conflicting registrations. Tests confirm all cases are still independently checked, missing registries rebuild with the original genesis identities, damaged registries remain for administrator review, concurrent evidence is retained, and a concurrent conflicting genesis is not overwritten.

Five alternating pairs executed the unchanged pre-fix `reconstruct_registry` from commit `f63c224cca7e7b5efa5bb04100ddeb317e06bec3` and the corrected function over the exact same retained `shared_folder` synthetic fixtures, reversing old/new order on alternating pairs. CPython 3.14.10, one Linux workspace/filesystem, no browser/performance suites in parallel. Counts instrument registry reads and actual `verify_record` calls; timing excludes fixture creation and byte-fingerprint checks.

| Cases | Before median | After median | Reduction | Registry reads before → after | Verified cases before → after |
| --- | --- | --- | --- | --- | --- |
| 100 | 0.115 s | 0.018 s | 84.6% | 100 → 1 | 100 → 100 |
| 400 | 0.637 s | 0.070 s | 89.0% | 400 → 1 | 400 → 400 |
| 1,200 | 3.508 s | 0.178 s | 94.9% | 1,200 → 1 | 1,200 → 1,200 |

Every case, summary and registry byte remained unchanged after every run. Raw samples, immutable baseline source hash, corrected source hash and the reproduction driver are retained in `/workspace/scratch/work/full-review-2026-11-27/startup-interleaved.json` and `startup_interleaved.py`. The maintained eight-test suite provides deterministic read/check counts and recovery/concurrency regressions. These measurements cover the registry reconstruction segment, not complete program startup or native Windows/City SMB performance. Missing/new registrations still require authoritative locked writes; no baseline is silently replaced for speed.
