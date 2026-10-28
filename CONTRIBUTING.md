# Development and review standard

Start at [the developer guide](docs/developer/00-START-HERE.md), follow [AGENTS.md](AGENTS.md), and preserve the rules in [the development standard](docs/developer/DEVELOPMENT-STANDARD.md).

Use a focused branch `develop/<issue>-<short-slug>` when an issue exists, or `develop/<short-slug>` for an owner-requested maintenance change without an issue. Titles use `<type>(<area>): <concrete change>` with `feat`, `fix`, `refactor`, `docs`, `test` or `chore`. An owner-assigned release preparation uses `release: YYYY-MM-DD Rnn`. Feature PRs do not assign release numbers. Approved batches use an `integration/<short-slug>` branch.

Before submitting a development PR, run targeted local checks appropriate to the changed behavior and complete the PR template with actual results. A local full gate is optional. GitHub's Full gate and PR format must pass on the exact head merged into main. Approved, related review PRs may use one combined integration PR under [the batch procedure](docs/developer/INTEGRATION-BATCHES.md), without repeated per-member full gates as main advances; after corrections, rerun affected local checks and obtain fresh GitHub checks for the new head. Reduced-coverage fast runs never replace the required GitHub gate or release evidence.

The automatic full gate on merged main runs asynchronously. A merge task may finish with that run pending if its status/link is reported; investigate failures when reported and fix forward through a new PR. Release packaging still requires current passing full-gate evidence for the exact source and runtime.

Merge only within explicit owner authorization. Guarded automation may execute approved merges after every required check and review condition passes; never bypass protection. Keep operational data and credentials outside source. City/native acceptance and deployment require their own authorization and recorded evidence.
