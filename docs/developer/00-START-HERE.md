# R55 developer start guide

Madison Building Inspection Document Writer is an offline Windows browser application with a loopback Python helper. version.json owns release and protocol identity. R54 uses authoring 12 for the aligned special-extension layout; historical authoring-11 and earlier layouts remain available. Case schema 5, summary 6 and workspace backup 2 remain unchanged. version-notes.md documents the independent helperBuild counter. See R55-REVIEW.md for the current development scope and docs/history/R54-REVIEW.md for the confirmed extension decisions and regression boundaries.

Build directly from app/, helper/, policy/, tools/, tests/ and docs/. Generated modules, policies, identity, bundles, evidence and caches belong under build/. No flat source staging tree or source mapping exists. The Windows deployment and installed filenames remain stable.

From a clean source copy:

    npm ci
    python3 -m pip install --require-hashes -r requirements-dev.txt
    npx playwright install chromium
    python3 tools/build.py
    python3 tools/verify_release.py

For offline development, DW_BROWSER selects a compatible Chromium executable. Read 05-TESTING.md for browser setup, exact source-bound evidence, the complete regression and production-browser gate, and packaging. Add helper/app files through ordinary imports, test discovery and the deployment manifest. Never edit generated files or approved/frozen fixtures to make a test pass.

## Maintenance rules

Read 01-ARCHITECTURE, 03-DOMAIN-RULES, 04-PITFALLS and 05-TESTING before changing code. Preserve every record/PDF identity, integrity boundary and legal hold. Keep exactly five Writer destinations; importing inspection results stays first. Do not restore manual/CSV case creation. Keep due-date assignment below the initial notice, exceptional recovery in Tools, and manual links inside Tools.

Use direct module imports and state.js; never recreate the universal runtime registry. Edit maintained source only; generated files live under build/. version.json is the release identity source; check generated consumers. Source or policy changes require fresh complete verification and packaging. Actual City approval is not supplied by an automated gate. No live rollout is performed by release packaging.

## Release documents

ACCEPTANCE-RECORD.md and PRODUCTION-READINESS.md are living records. Update them in place when a release adds or closes an acceptance item; do not copy them for each release. The build renders them with the current identity, and packaging places them at the release package top level as Rnn-ACCEPTANCE-RECORD.md and Rnn-PRODUCTION-READINESS.md, never on inspector PCs. Each release adds its own Rnn-REVIEW.md here; earlier reviews and release-named records are in docs/history/.

## Installation and history

First installation comes from a deploy ZIP whose SHA-256 IT has checked against the release owner’s separately published value. After installation, run the installed shortcut. Shared launch.py hands control to the installed launcher before importing any sibling module.

docs/staff/PROGRAM-MANUAL.html and Program_Instruction_Manual.pdf/.docx are staff guidance. docs/history/ is inert provenance included in source distributions and maintained-source fingerprints, but excluded from runtime/deployment inputs. The optional, ignored archive/development-history is excluded from fingerprints and every release archive. docs/history/R51-HISTORY-RESTORE.json identifies the R49 source ZIP that archive/development-history is restored from.

Legal holds and all open City acceptance items remain open. Automated checks do not supply legal, City hardware, native print, accessibility or staff approval.
