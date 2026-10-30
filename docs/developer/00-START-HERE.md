# R65 developer start guide

Madison Building Inspection Document Writer is an offline Windows browser application with a loopback Python helper. version.json owns release and protocol identity: the current release writes authoring version 16 with case schema 5, summary 6 and workspace backup 2, and every earlier authoring format remains readable and reprintable. VERSION-NOTES.md documents the independent helperBuild counter.

## Developer documents

| Document | Read it for |
| --- | --- |
| [01-ARCHITECTURE.md](01-ARCHITECTURE.md) | Runtime, modules, import, documents and authoring versions, helper storage, PDFs, security, installation and build |
| [02-CODE-MAP.md](02-CODE-MAP.md) | Which module owns what |
| [MAINTAINABILITY-ASSESSMENT.md](MAINTAINABILITY-ASSESSMENT.md) | Final architecture audit, interface review, exception register and maintainability contract |
| [MODULE-CLEANUP.md](MODULE-CLEANUP.md) | Authorized cleanup increments, dependency boundaries and completion criteria |
| [03-DOMAIN-RULES.md](03-DOMAIN-RULES.md) | Rules the program enforces, by feature, including owner-confirmed rules |
| [04-PITFALLS.md](04-PITFALLS.md) | Mistakes to avoid, by area |
| [INTEGRATION-BATCHES.md](INTEGRATION-BATCHES.md) | Approved review stacks, combined exact-head verification and guarded batch merges |
| [DEVELOPMENT-STANDARD.md](DEVELOPMENT-STANDARD.md) | PR/branch naming, rule ownership, CI, independent version identities and publication safeguards |
| [05-TESTING.md](05-TESTING.md) | The gate, feature suites, evidence and packaging |
| [../../tests/README.md](../../tests/README.md) | Every suite by feature, with former suite names |
| [CLOUD-DEVELOPMENT.md](CLOUD-DEVELOPMENT.md), [DESKTOP-LAUNCH.md](DESKTOP-LAUNCH.md) | Cloud setup and validation; the desktop launch and exit design |
| [ACCEPTANCE-RECORD.md](ACCEPTANCE-RECORD.md), [PRODUCTION-READINESS.md](PRODUCTION-READINESS.md) | Living acceptance and readiness records (see Release documents) |
| [R65-REVIEW.md](R65-REVIEW.md), [R64-REVIEW.md](R64-REVIEW.md), [R63-REVIEW.md](R63-REVIEW.md), [R62-REVIEW.md](R62-REVIEW.md), [R61-REVIEW.md](R61-REVIEW.md), [R60-REVIEW.md](R60-REVIEW.md), [R59-REVIEW.md](R59-REVIEW.md) | The current and recent release reviews; older reviews are in [../history/](../history/README.md) |
| [SCREEN-VISUAL-REVIEW.md](SCREEN-VISUAL-REVIEW.md) | Technical PNG difference review, evidence limits and native acceptance status |
| [SCREEN-SHELL.md](SCREEN-SHELL.md) | Current screen-shell reference, reviewed CSS decisions and visual comparison workflow |
| [CONSOLIDATION-PROMPT.md](CONSOLIDATION-PROMPT.md), [CSS-CANDIDATES.md](CSS-CANDIDATES.md) | The consolidation plan and its unused-CSS inventory |

Release-by-release history is in CHANGELOG.md, the release reviews and docs/history/DOCUMENTATION-RELEASE-NARRATIVE.md. The R60, R61 and R62 development prompts kept here are implemented records, not instructions for current work.

Build directly from app/, helper/, policy/, tools/, tests/ and docs/. Generated modules, policies, identity, bundles, evidence and caches belong under build/. No flat source staging tree or source mapping exists. The Windows deployment and installed filenames remain stable.

From a clean source copy:

    npm ci
    python3 -m pip install --require-hashes -r requirements-dev.txt
    npx playwright install chromium
    python3 tools/build.py
    python3 tools/verify_release.py

For offline development, DW_BROWSER selects a compatible Chromium executable. Read 05-TESTING.md for browser setup, exact source-bound evidence, the complete regression and production-browser gate, and packaging. Add helper/app files through ordinary imports, test discovery and the deployment manifest. Never edit generated files or approved/frozen fixtures to make a test pass.

## Maintenance rules

Read 01-ARCHITECTURE, 03-DOMAIN-RULES, 04-PITFALLS and 05-TESTING before changing code. Preserve every record/PDF identity, integrity boundary and legal hold. Keep four Writer rail destinations: Workspace, Order language, Reports and Tools & settings. Import inspection remains an internal route entered from Workspace (owner-approved; it superseded a former five-destination, import-first rule). Do not restore manual/CSV case creation. Keep due-date assignment below the initial notice (items are selected beside their due dates; the Assign due dates bar applies the date), exceptional recovery in Tools, and manual links inside Tools. Specialist tools sit in the collapsed Administrator tools group in Tools; the grouping grants no authorization and each tool keeps its own administrator checks.

Use direct module imports and state.js; never recreate the universal runtime registry. Edit maintained source only; generated files live under build/. version.json is the release identity source; check generated consumers. Source or policy changes require targeted local checks and a passing full GitHub gate on the exact direct or integration PR head merged into main (see INTEGRATION-BATCHES.md). Post-merge main verification may run asynchronously. Packaging is a separately authorized release task requiring exact-source full-gate evidence. Actual City approval is not supplied by an automated gate. No live rollout is performed by release packaging.

## Release documents

ACCEPTANCE-RECORD.md and PRODUCTION-READINESS.md are living records. Update them in place when a release adds or closes an acceptance item; do not copy them for each release. The build renders them with the current identity, and packaging places them at the release package top level as Rnn-ACCEPTANCE-RECORD.md and Rnn-PRODUCTION-READINESS.md, never on inspector PCs. Each release adds its own Rnn-REVIEW.md here; earlier reviews and release-named records are in docs/history/.

## Installation and history

First installation comes from a deploy ZIP whose SHA-256 IT has checked against the release owner’s separately published value. After installation, run the installed shortcut. Shared launch.py hands control to the installed launcher before importing any sibling module.

docs/staff/PROGRAM-MANUAL.html and Program_Instruction_Manual.pdf/.docx are staff guidance. docs/history/ is inert provenance included in source distributions and maintained-source fingerprints, but excluded from runtime/deployment inputs. The optional, ignored archive/development-history is excluded from fingerprints and every release archive. docs/history/R51-HISTORY-RESTORE.json identifies the R49 source ZIP that archive/development-history is restored from.

Legal holds and all open City acceptance items remain open. Automated checks do not supply legal, City hardware, native print, accessibility or staff approval.
