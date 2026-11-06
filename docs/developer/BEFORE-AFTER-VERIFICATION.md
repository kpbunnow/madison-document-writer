# Before/after performance verification

Performance work needs equal workloads and equal observable results before its timings are useful. These diagnostic controllers automate repeated, alternating before/after runs while retaining raw evidence. They do not replace targeted regressions, the exact-head GitHub Full gate/PR format or any release/City acceptance requirement.

## Prepare trusted inputs

Keep the active checkout and outside work intact. Obtain the baseline production HTML or an isolated baseline source extraction at the reviewed Git commit; do not change the active checkout to run an old build. Build trusted source with frozen dependencies, the same supported Python/Node/browser and unchanged dependency pins. An extracted source tree can share the existing frozen Node installation only after checking identical package-lock bytes. Do not use operational case files or private configuration.

Record baseline and candidate commits/trees, actual build commands, production HTML SHA-256 and dependency hashes. The Workspace controller measures the supplied HTML bytes; it records their actual hashes, not a claim that an arbitrary supplied HTML was built from the harness checkout. `harnessSource`/`harnessSourceClean` describe the checked-out profiling harness. Extracted helper sources have no invented Git commit: their maintained-content digest is recorded, and their Git extraction/build receipt supplies the external commit association.

Output directories must be new, under ignored `build/` or outside source. A failed comparison retains raw diagnostics but publishes no successful comparison summary. Do not reuse a previous passing summary after a failed run.

## Workspace opening and refresh

```sh
node tools/compare_workspace_opening.cjs /outside/before.html /outside/after.html /outside/new-workspace-run
```

Default sizes are 100/1,000/3,000 cases. The same deterministic synthetic fixture has three issued snapshots and one private draft per case plus a worksheet every fifth case. The controller runs four paired rounds, alternating **before/after, after/before**, twice. Each version has a fresh browser context for each size, one untimed warmup and three measured reload/render trials per round: **12 measured samples per version/size**. CPU profiling is disabled in these timing trials. Run the standalone profiler separately for CPU attribution rather than including sampled timings in the comparison.

The profiler checks production rather than test HTML, actual restored/visible counts and retained text, hashes every durable seeded fixture and verifies it is unchanged after opening. Full projected case/document/worksheet/event arrays are hashed and must agree across all trials and both versions. Toolchain, platform/architecture, viewport, timezone, trial protocol, harness hash, workload identity and every requested size must agree; missing or different evidence fails. A changed candidate HTML between rounds also fails.

The JSON retains raw trials, before/after medians and ranges, every paired percentage and the median paired percentage. Negative improvement values are retained as regressions; A/A controls are allowed and do not imply improvement. Small differences with overlapping ranges are noise-sensitive observations, not demonstrated speedups or statistical significance. Keep measured browser runs serial and retain the raw files.

`PROFILE_SIZES` selects unique case counts from 1–10,000; `PROFILE_PAIRS` allows 4/6/8/10 pairs. For standalone attribution `tools/profile_workspace_opening.cjs` also accepts `PROFILE_TRIALS` (3–25), `PROFILE_WARMUP` (0–5) and `PROFILE_CPU=0` to disable sampling. The paired controller always fixes three trials, one warmup and sampling off. Existing standalone defaults remain three trials/no warmup/one sampled trial; their mixed sampling timings must not be used as the paired timing evidence.

## Reports and open-case due-date enrichment

```sh
python3 tools/compare_reporting_reads.py /outside/baseline-source /path/to/candidate-source /outside/new-local-run
python3 tools/compare_reporting_reads.py /outside/baseline-source /path/to/candidate-source /outside/new-latency-run --latency synthetic
```

Build both roots first. Default sizes are 600/3,000 cases with four paired rounds; `--sizes` and `--rounds` can select the same documented bounds as above. Both roots must have identical Python and Node dependency pins. Each trial imports the entire selected helper source in a fresh Python process, refusing mixed server/integrity/inspector roots. No baseline module is spliced into current helper code.

One temporary synthetic fixture is generated per size using the existing chained-record readiness fixture, then read by both versions without modification. Every worker's fixture digest is checked against the original and the actual files. Both operations receive an untimed warmup; the pure projection-match cache is cleared before timing. These are warm-process/filesystem measurements with fresh per-operation verification, not cold OS-cache measurements. The two versions use the same absent synthetic anchor settings and no City SQL connection.

The results retain summary/case/evidence reads, summary directory scans, settings lookups, independent proof count and peak read concurrency. **Every case must still be read and independently verified**, with at most four concurrent readers. Complete Reports results and ordered due-date mappings must match; only Reports' operation timestamp `readAt` is excluded. Every other fact/error/status/order remains compared. Requested size, latency mode, operation set and source fingerprints must remain intact. A changed fixture, changed source, missing proof or mixed environment refuses the comparison.

`local` adds no file delay. `synthetic` adds deterministic path-based delay to fixture reads: 80% 0.5 ms / 15% 2 ms / 5% 8 ms. This is explicitly simulated file latency, never measured City SMB/SQL. Warmup/imports and fixture hashing are outside the timed operation. Timings include the same read/proof-count instrumentation in both versions; they are instrumented diagnostics, not uninstrumented service-level measurements. Each worker runs Reports then due-date enrichment; versions alternate order per pair. Raw samples and ranges remain available alongside median/paired reductions.

## Regression and merge requirements

`audit_benchmark_comparison.js` verifies paired statistics, raw-evidence preservation, A/A behavior and rejection of corrupted timing/workload/result/environment evidence. Its transitive controller dependency keeps it classified as a serial browser-capable suite. `audit_benchmark_comparison.py` covers immutable fixtures, worker workload substitution, missing operations/proofs/case reads, unsafe concurrency, invalid durations and a real small read/proof workload; it stays in the ordinary regression pool. These tests guard the diagnostic contracts without imposing machine-specific speed thresholds on CI.

Keep actual observations distinct from prior results and planned targets. Report exact measured input identities, source clean state, environment, sample counts, raw paths, uncertainty and any rejected attempt. Run targeted checks and the full exact-head GitHub gate before the focused PR merges. Do not change legal/issued output, verification, case coverage, frozen references, dependencies, release identities or security rules to make a benchmark faster. No package/deployment or native City/SQL/Outlook approval follows from these diagnostics.

## Repeated observations — November 6, 2026

These runs revalidate the prior application optimizations; this diagnostic PR changes no application/helper/policy behavior. Baseline Workspace source is `53cf62091f29d95684c14d3d5e45b48b010024f1`; baseline helper source is `10739019e6e1f3aa926661d0fae25970fcf23320`. Both were independently extracted/built with identical dependency pins. Candidate application behavior is main `a37b0051931fe2f75f1a56de6b1b306f446b5dfe`, unchanged by this work.

Workspace measurements used clean harness checkpoint `8a0ebfeffb677006aef20bfd1ed9ca18dca2ceec`; final helper comparisons used clean checkpoint `0a1f59983b010e6a404429fd253a75fbbddf561e`, which additionally fingerprints generated runtime inputs. Final documentation records these measurements after the fact; it is not a new timed run. Both tool checkpoints are retained in this PR's history.

Python 3.14.10, Node 24.19.0, Playwright 1.64.1 and pinned Chromium 156.0.8078.4 ran serially on the same Linux x64 executor. Workspace has 12 measured trials per version/size; each helper mode has four independent process trials per version/size/operation, with the equal warmups described above. All complete result/workload and source checks passed.

| Cases | Opening before/after (s) | Less opening time | Refresh before/after (s) | Less refresh time |
| --- | ---: | ---: | ---: | ---: |
| 100 | 0.178 / 0.177 | 0.9% | 0.019 / 0.015 | 23.1% |
| 1,000 | 1.113 / 0.598 | 46.3% | 0.601 / 0.135 | 77.6% |
| 3,000 | 5.731 / 1.108 | 80.7% | 4.911 / 0.478 | 90.3% |

The 100-case opening result is **not an established improvement**: its medians are almost equal and median paired percentage is negative. The actual 100-case A/A control (same HTML on both sides) observed 158.5/170.0 ms opening medians and 14.3/15.6 ms refresh medians, with overlapping ranges. This illustrates substantial percentage noise for small absolute timings; no correction factor or guarantee is inferred. The 3,000-case opening/refresh reductions remain large across the paired rounds. All raw ranges and paired percentages remain in the comparison JSON.

| Mode | Cases | Operation | Before/after median (s) | Less time |
| --- | ---: | --- | ---: | ---: |
| Local | 600 | reports | 0.483 / 0.350 | 27.6% |
| Local | 600 | open-case-dues | 0.503 / 0.432 | 14.0% |
| Local | 3,000 | reports | 2.419 / 1.774 | 26.7% |
| Local | 3,000 | open-case-dues | 2.380 / 2.209 | 7.2% |
| Simulated file latency | 600 | reports | 0.967 / 0.717 | 25.9% |
| Simulated file latency | 600 | open-case-dues | 1.447 / 0.714 | 50.6% |
| Simulated file latency | 3,000 | reports | 5.076 / 3.801 | 25.1% |
| Simulated file latency | 3,000 | open-case-dues | 7.219 / 3.773 | 47.7% |

Every 3,000-case trial still read and independently verified all 3,000 case files, returned equal complete results/order and kept peak readers at four. Summary reads dropped 6,000→3,000, summary directory enumerations 2→1 and settings lookups 3,001→1. The fixture fits the existing summary-retention bounds; larger inputs retain ordinary fallback reads. Local and simulated-latency modes use separate internally identical fixtures; their before/after percentages are separate observations, never City SMB/SQL claims.

The first complete helper comparisons, before generated-input fingerprint hardening, are also retained: at 3,000 cases local Reports/due reductions were 23.6%/8.4%, and simulated-latency reductions were 24.0%/47.9%. The table above uses the subsequent runtime-bound repeat rather than choosing the largest result. An initial five-case instrumentation smoke failure exposed a bound-method adapter error; the adapter was corrected, a real-read regression added, and all complete runs above passed. No failed or partial run is counted as completed evidence.

Raw builds/receipts, full paired trials, immutable input/result hashes, source checkpoints and the A/A control are retained outside source at `/workspace/scratch/work/before-after-verification/`. The principal outputs are `workspace/comparison.json`, `workspace-control/comparison.json`, `reports-local-final/comparison.json`, `reports-latency-final/comparison.json` and `baseline-builds.json`. This is developer diagnostic evidence; required exact-head GitHub results and final merge status are recorded in the delivery PR.
