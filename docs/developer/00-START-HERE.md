# R54 developer start guide

Madison Building Inspection Document Writer is an offline Windows browser application with a loopback Python helper. version.json owns release and protocol identity. R54 uses authoring 12 for the aligned special-extension layout; historical authoring-11 and earlier layouts remain available. Case schema 5, summary 6 and workspace backup 2 remain unchanged. version-notes.md documents the independent helperBuild counter. See R54-REVIEW.md for the confirmed extension decisions and regression boundaries.

Build directly from app/, helper/, policy/, tools/, tests/ and docs/. Generated modules, policies, identity, bundles, evidence and caches belong under build/. No flat source staging tree or source mapping exists. The Windows deployment and installed filenames remain stable.

From a clean source copy:

    npm ci
    python3 -m pip install --require-hashes -r requirements-dev.txt
    npx playwright install chromium
    python3 tools/build.py
    python3 tools/verify_release.py

For offline development, DW_BROWSER selects a compatible Chromium executable. Read 05-TESTING.md for browser setup, exact source-bound evidence, the complete regression and production-browser gate, and signing. Add helper/app files through ordinary imports, test discovery and the deployment manifest. Never edit generated files or approved/frozen fixtures to make a test pass.

First installation comes from a deploy ZIP whose SHA-256 IT has checked against the release owner’s separately published value. After installation, run the installed shortcut. Shared launch.py hands control to the installed launcher before importing any sibling module.

Read 01-ARCHITECTURE, 03-DOMAIN-RULES, 04-PITFALLS and 05-TESTING before changing code. docs/staff/PROGRAM-MANUAL.html and Program_Instruction_Manual.pdf/.docx are staff guidance. R51-ACCEPTANCE-RECORD.md belongs at the package top level, never on inspector PCs. Historical material in archive/development-history is inert reference, excluded from all build inputs and release packages. Its recovery provenance identifies the R49 source ZIP.

Legal holds and all open City acceptance items remain open. Automated checks do not supply legal, City hardware, native print, accessibility or staff approval.
