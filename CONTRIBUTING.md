# Development and review standard

Start at [the developer guide](docs/developer/00-START-HERE.md), follow [AGENTS.md](AGENTS.md), and preserve the rules in [the development standard](docs/developer/DEVELOPMENT-STANDARD.md).

Use a focused branch `develop/<issue>-<short-slug>` when an issue exists, or `develop/<short-slug>` for an owner-requested maintenance change without an issue. Titles use `<type>(<area>): <concrete change>` with `feat`, `fix`, `refactor`, `docs`, `test` or `chore`. An owner-assigned release preparation uses `release: YYYY-MM-DD Rnn`. Feature PRs do not assign release numbers.

Complete the PR template with actual results. Run `python3 tools/verify_release.py` on the final reviewed source, retain its evidence, and request review again after corrections. Reduced-coverage fast runs never certify a PR or release. A merge commit with identical source can retain the source-bound result; any changed maintained input requires a fresh gate.

Do not merge automatically. Keep operational data and credentials outside source. City/native acceptance and deployment require their own authorization and recorded evidence.
