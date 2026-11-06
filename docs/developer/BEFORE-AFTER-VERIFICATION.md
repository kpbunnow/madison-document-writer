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

`local` adds no file delay. `synthetic` adds deterministic path-based delay to fixture reads: 80% 0.5 ms / 15% 2 ms / 5% 8 ms. This is explicitly simulated file latency, never measured City SMB/SQL. Warmup/imports and fixture hashing are outside the timed operation. Each worker runs Reports then due-date enrichment; versions alternate order per pair. Raw samples and ranges remain available alongside median/paired reductions.

## Regression and merge requirements

`audit_benchmark_comparison.js` verifies paired statistics, raw-evidence preservation, A/A behavior and rejection of corrupted timing/workload/result/environment evidence. Its transitive controller dependency keeps it classified as a serial browser-capable suite. `audit_benchmark_comparison.py` covers immutable fixtures, worker workload substitution, missing operations/proofs/case reads, unsafe concurrency, invalid durations and a real small read/proof workload; it stays in the ordinary regression pool. These tests guard the diagnostic contracts without imposing machine-specific speed thresholds on CI.

Keep actual observations distinct from prior results and planned targets. Report exact measured input identities, source clean state, environment, sample counts, raw paths, uncertainty and any rejected attempt. Run targeted checks and the full exact-head GitHub gate before the focused PR merges. Do not change legal/issued output, verification, case coverage, frozen references, dependencies, release identities or security rules to make a benchmark faster. No package/deployment or native City/SQL/Outlook approval follows from these diagnostics.
