# Workspace row reuse

The improvement plan's first performance increment retains per-case presentation and unchanged live rows. `workspace_rows.js` receives freshly computed status/task/proof facts on each render; it caches only rendered HTML against the complete row/document/context snapshot. Inspector labels, issued selection and visit-source counts are read again. In-place changes invalidate, removed cases are pruned, and unserializable transient inputs use the ordinary renderer. No readiness, record verification, shared-file authority, publication or print result is retained by this cache.

`workspace_repaint.js` updates only affected rows when the surrounding generated Workspace shell is identical. It preserves unchanged row nodes, open options, controls and focus; reconciles ordering/additions/removal; and uses the complete repaint when the frame changes, a prior table is detached, keys are duplicated or row markup has an unexpected shape. Other routes always use the ordinary repaint. The retained finder query is reapplied after painting so changed cases cannot leave stale highlights/counts. State is bounded to the currently loaded cases and the current screen root; cached rows retain strings rather than source records.

Existing 1,033 screen states and the 500-case/2,000-document read/mutation/failure regression remain. New regressions cover current proof/actions/documents/deadlines/staff/source/visit data, focus/disclosure/node preservation, sorting/add/remove and fallback shapes. Production Chromium additionally checks repeated real renders, one-case changes and fresh verification reads on every render. Existing full browser/long-session/axe and independent historical print suites remain mandatory.

## Matched measurement

Frozen Node 24.19.0, Python 3.14.10, Playwright 1.64.1 and pinned Chromium 156.0.8078.4; serial Linux synthetic IndexedDB/Workspace workloads, four alternating paired rounds, one warmup and three measured trials per round (12 samples per version/size). Every fixture, durable/model digest, record count and row count agrees. All eight runs recorded a clean harness source. No performance threshold or functional assertion was relaxed.

| Cases | Refresh median before → after | Median paired reduction | Opening median before → after |
| ---: | ---: | ---: | ---: |
| 50 | 10.95 → 4.05 ms | 63.75% | 147.39 → 135.32 ms |
| 200 | 35.45 → 13.00 ms | 64.58% | 219.36 → 174.95 ms |
| 500 | 131.80 → 35.90 ms | 70.75% | 361.54 → 375.30 ms |

Every paired refresh comparison improved (53–77% across rounds/sizes). Opening is noisy: the 500-case aggregate median increased 3.8%, while its median paired change improved 7.6%; ranges were 236–512 ms before and 242–550 ms after. A preliminary matched run also mixed opening results. Claim a repeat-refresh gain, not a reliable opening-time improvement or a City/network/Windows speedup. The unchanged complete performance gates remain required.

Before control: source `f29d9608d68382f3e3da891c7b5749a8108ead5f`, Writer SHA-256 `9338e1ca02969ce10779df47d056c5499a35b904134673f34210caedbfcd217b`. After control/harness: source `d06f652f30405d278d101267164879c577557897`, Writer SHA-256 `b28a3f6f60fc575d8dafe3cb4828ca7ddbb782ddf62812d047c1535b9dacc92d`. Comparison JSON SHA-256 `cb25288e66dd544c277bea1e1f27163002a2dc04428fd41b59121587a063f1f5`. Raw controls/results are outside source under `improvement-plan-2026-11-13/perf-before-final`, `perf-after-final` and `perf-matched-final`. The comparison command is `PROFILE_SIZES=50,200,500 PROFILE_PAIRS=4 node tools/compare_workspace_opening.cjs <before.html> <after.html> <new-output-dir>`.
