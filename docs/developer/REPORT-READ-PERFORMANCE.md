# Reports and open-case operation performance

The measured baseline is main `10739019e6e1f3aa926661d0fae25970fcf23320`, after the Workspace opening improvement. This work preserves report facts, due-date authority and every independent case proof.

## Repeated work removed

- Reports and inspector due-date enrichment read each summary once for integrity evidence, then again for consumption. `SummaryInputs` now shares already-read inputs within that operation. It retains at most **16 MiB of raw summary bytes and 4,096 entries**, plus parsed values; inputs beyond either bound fall back to ordinary reads. Consumed inputs are removed. Nothing survives the request.
- The same complete Reporting Index inventory serves both phases, reducing two directory enumerations to one. Linked names remain in the evidence scan so an old-format record cannot hide retained migration evidence. Secure inspector reads never consume bytes obtained through the evidence-only fallback reader.
- A supplied `VerificationContext` already fixes the request's registry, anchors and known history. `verify_record` no longer repeatedly rereads unused protected-folder settings; it still independently verifies every current case's chain and retained evidence.
- Inspector context reads use the same existing maximum of **four** ordered readers as the due-date reads. The phases finish sequentially; this does not create eight concurrent readers. Empty inspector results return without scanning other cases, while an unreachable case folder still reports unavailable.
- Browser and Python projections compute continuing-item state once per summary instead of once per violation. The result is first computed at the original validation point, preserving error order, and is never reused by another summary.

Summary UTF-8 evidence parsing and byte-oriented consumer parsing retain their different BOM/encoding behavior. Malformed input, original size refusal, secure link/reparse refusal, stale revision, orphan/duplicate records, projection mismatch, damaged registry and tampered-chain handling remain authoritative. No case bytes or verified verdicts are cached by this change. Existing content-keyed projection-match handling in Reports remains unchanged.

## Measurements

Three serial trials per case count compared actual baseline modules loaded from Git with candidate modules in the same Python 3.14.10 process. Every result and its ordering matched; each trial still read and verified every case. The 600/3,000-case fixtures are synthetic modern records with intact chains and summaries.

For the **3,000-case** fixture:

| Work per request | Before | After |
| --- | ---: | ---: |
| Summary file reads | 6,000 | 3,000 |
| Summary directory enumerations | 2 | 1 |
| Protected-folder settings lookups | 3,001 | 1 |
| Current case reads | 3,000 | 3,000 |
| Independent case proofs | 3,000 | 3,000 |
| Peak active readers | 4 | 4 |

With deterministic synthetic file latency (80% 0.5 ms / 15% 2 ms / 5% 8 ms assigned by file path), median Reports reading was **5.30 → 3.90 seconds**, and open-case due-date enrichment **7.45 → 3.65 seconds**. This illustrates avoided file operations and bounded scheduling, not measured City SMB or SQL performance. The summary inputs in this fixture fit the retention bounds; larger inputs may require ordinary fallback reads.

A separate local-filesystem pass without injected latency observed 3,000-case medians of **2.10 → 1.87 seconds** for cold Reports, **1.53 → 1.07 seconds** with the existing pure projection-match cache warm, and **2.05 → 1.75 seconds** for due-date enrichment. These initial working-tree measurements vary with load; the paired latency comparison above additionally checks exact baseline/candidate results and read/proof counts.

For a synthetic case with **100 violation items and eight visits**, continuing-item calculations fell from **100 to one** per summary. Median Python projection time over three local trials fell from **293 to 107 ms**; at 25 items it fell from **24 to 14 ms**. Both measured outputs matched the original. The matching browser optimization is checked against its retained implementation as well.

An alternative whole-object canonical comparison was measured and was slightly slower than the existing field comparison; it was not introduced. Required cryptographic verification and report-field validation remain intact.

## Verification contracts

`audit_reporting_inputs.py` checks parse/read reuse, byte and entry limits, fallback, encoding/BOM/error behavior, no-follow input provenance, retained downgrade evidence, fresh tamper detection, zero-work empty lists, one directory enumeration, one settings resolution and one independent proof per case. Ordered-reader tests compare serial and four-reader results.

`audit_projection_work.js` and `.py` compare 25/100-item summaries with retained implementations, count the real continuing-item calculation, verify untouched source history and confirm that a later changed visit produces a fresh result. Existing full projection-corpus comparisons remain unchanged.

The two existing measured index suites intentionally strengthen their physical-summary-read expectations from `count * 2` to `count`, reflecting this owner-requested I/O contract. Every case-count, proof, anchored-history, mismatch, concurrency, order and latency assertion remains. No frozen reference or expected hash changes.

The required exact-head GitHub Full gate, PR format and applicable Windows recovery still govern merge. Source identity, stored formats, issued history, legal wording, dependencies, native acceptance and release trust are unchanged. No release assignment, packaging or deployment is included.
