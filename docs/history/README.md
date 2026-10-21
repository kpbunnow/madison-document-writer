# Development history

Inert reference material retained for provenance. Nothing here is a build input,
test input or deployment file, and none of it is an instruction for current work.

| File | What it records |
| --- | --- |
| `R53-INVENTORY.json` | File inventory and SHA-256 values of the R53 source archive imported as the repository baseline |
| `R53-BASELINE.md`, `R53-VERIFICATION.json` | How the R53 baseline was imported and its first verification result: the gate failed on three dark-theme contrast nodes, later fixed in kpbunnow/madison-document-writer#2 |
| `R53-PR-DESCRIPTION.md` | Prepared description for the baseline import pull request, kpbunnow/madison-document-writer#1 |
| `R54 Development Prompt — Align Best Interest and Vacancy Extensions.md` | The R54 development request, implemented and merged in kpbunnow/madison-document-writer#3 |
| `R51-HISTORY-RESTORE.json` | Source-archive hash and per-file hashes for restoring R39–R48 development history from the retained R49 source ZIP |
| `restore_history.py` | One-time tool that restores that history into the ignored `archive/development-history` folder; run with the R49 source ZIP path |
