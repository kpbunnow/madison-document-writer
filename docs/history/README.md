# Development history

Inert reference material retained for provenance. Nothing here is a runtime build input, test input or deployment file, and none of it is an instruction for current work. This directory is retained in source distributions and maintained-source fingerprints; edits require fresh verification. The optional ignored archive/development-history is excluded from both fingerprints and release archives.

| File | What it records |
| --- | --- |
| `R53-INVENTORY.json` | File inventory and SHA-256 values of the R53 source archive imported as the repository baseline |
| `R53-BASELINE.md`, `R53-VERIFICATION.json` | How the R53 baseline was imported and its first verification result: the gate failed on three dark-theme contrast nodes, later fixed in kpbunnow/madison-document-writer#2 |
| `R53-PR-DESCRIPTION.md` | Prepared description for the baseline import pull request, kpbunnow/madison-document-writer#1 |
| `R54 Development Prompt — Align Best Interest and Vacancy Extensions.md` | The R54 development request, implemented and merged in kpbunnow/madison-document-writer#3 |
| `R50`–`R58-REVIEW.md`, `R55-IMPLEMENTATION.md`, `R51-DEPLOY-COMPARISON.json` | Each release's change review; the current release's review stays in `docs/developer/` |
| `R50`–`R54-PRODUCTION-READINESS.md`, `R51`–`R54-ACCEPTANCE-RECORD.md` | Release-named readiness and acceptance records, superseded by the living `docs/developer/PRODUCTION-READINESS.md` and `ACCEPTANCE-RECORD.md`. Packaging renders those under the current release's names; the R54 copies here are byte-identical to that rendering |
| `R54-runtime-parity.json` | R54's reviewed whole-bundle code hash. Retired: application code is now checked by its rendered output, and the shell by `R51-R50-parity.json` |
| `R51-HISTORY-RESTORE.json` | Source-archive hash and per-file hashes for restoring R39–R48 development history from the retained R49 source ZIP |
| `DOCUMENTATION-RELEASE-NARRATIVE.md` | Text that Consolidation Phase 7 replaced when it rewrote the manual, staff guides and developer guides by feature: release narrative, release-labelled format history and the R62 editions of 01, 03 and 04, verbatim |
| `division-templates/` | The division's original Word letter templates (abatement, No Occupancy, Best Interest and Vacancy Extension), moved byte-for-byte from `tests/fixtures/reference/new-documents/`; filenames and SHA-256 values in its README |
| `restore_history.py` | One-time tool that restores that history into the ignored `archive/development-history` folder; run with the R49 source ZIP path |

R54 screenshots remain alongside its review in r54-images/. CONSOLIDATION-2026-10-21.md is explicitly retrospective, reconstructed from Git and the supplied handoff.

- [Post-consolidation review](POST-CONSOLIDATION-REVIEW.md): baseline findings following PR #42; follow-up implementation is recorded in the current changelog and development standard.
