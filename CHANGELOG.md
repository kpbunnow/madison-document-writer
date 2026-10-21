# Release changelog

## 2026-10-21 R55

Helper 2026.10.21.56, helperBuild 56; authoring 12, schema 5, summary 6 and backup 2 unchanged. Verification binds all deployment inputs and generated helper/release files; packaging checks staged bytes and an explicit source inventory, excluding local credentials/environments/operational data. Reconciles current import rules and security guidance, regenerates all manual editions, preserves fixture ownership and consolidation provenance. Carries the consolidation refactors, approved-language extraction and central helper route guards. City acceptance and legal holds remain open.

Snow citation fields (snowfall date, inches, condition, photographed) keep keyboard focus when the editor repaints in the background, for example when shared citation history finishes loading; previously focus fell to the page and further typing was lost. This was the cause of the intermittent browser_r34 failure.

Post-PR #16 corrections (identity retained; R55 had not been distributed): case, integrity and tool text is read and written as explicit UTF-8, so Unicode cases verify on Windows code pages; outbox transfer and direct filing share one per-name lock and never replace an existing PDF; packaging verifies and archives exactly the approved staged files; the manual builder stages and validates all editions before replacing them together, and each edition carries a source digest. Adds acceptance item C10. No format version changes.

Post-PR #19 correction: one summary with a non-text `sourceFile` (or a case file that is not a case record) is excluded as unreadable instead of failing the whole Reports index with HTTP 500; healthy summaries remain available. No format version changes.

Post-PR #18 correction: Reports summary validation distinguishes JSON booleans from numbers on save and read (a withdrawn notice's `noticeActive: false` altered to `0` was accepted and counted as active). No format version changes.

Post-PR #17 corrections (identity retained): Reports uses a cached summary only when its reported facts equal the helper's projection of the verified case; a summary changed on its own (owner, status, dates, documents, violations, citations) is excluded and explained with the rebuild step, and the helper refuses to write one. Adds helper/case_projection.py and its generated projection_tables.json to the deployment. Policy scripts read and write UTF-8 explicitly. No format version changes.

Staff quick guides and the program manual (Markdown, HTML, PDF, Word) no longer name files that do not ship (R49/R51-ACCEPTANCE-RECORD.md, R50_Program_Instruction_Manual.pdf) or tell staff to confirm an R50/R51 build; the manual's compatibility paragraph states authoring 12 with the rollback caution. The install guide states authoring 12. No program change.

## 2026-10-20 R54

Helper 2026.10.20.55, helperBuild 55, authoring 12. Newly authored Best Interest and Vacancy Extensions use the regular Extension's layout, items table, continuation pages, footer and copy handling, with unchanged approved language and the supervisory signer after the table. Conditional vacancy items show "Conditional — see conditions above" without changing stored repair dates; editing the shared table clears supervisory review. The regular Extension, authoring-11 and earlier documents and their corrections keep their existing output. Case schema 5, summary 6 and backup 2 are unchanged. Adds acceptance item P7 (native side-by-side extension printing).

## 2026-10-19 R53

Update recovery (signing-era detection, stale-file message, prepare_deployment.py, diagnostics, bounded link checks); documents follow the Accela inspection type and status, replacing Choose next action; group due dates on reinspection worksheets with Undo; top-of-page warnings clear after 15 seconds into Message history.

## 2026-10-18 R52

Removed release signing (key lost; option 3). Updates are checked against runtime-manifest.json for exact files, sizes, SHA-256 and no downgrade; deployment-folder permissions guard against deliberate tampering. Fixed the date-dependent document comparison. Install guide, manual and developer docs updated; stale and duplicate guide sections removed. Signing-era (R50/R51) installs need a fresh first installation.

## 2026-10-18 R51

Trusted local launcher handoff precedes shared sibling imports. Builds and tests read maintained folders directly; generated output stays under build/. Explicit helperBuild migration, stable manual routes, descriptive module names, browser preflight and font-independent authored-content/layout checks retain existing document behavior and all City holds.


## Orders archive compatibility and verification details

- Recognize the established top-level Orders archive as data, leaving existing order PDFs, Word files and metadata untouched. Its contents are not enumerated or installed.
- Keep verification of all program files and vendor dependencies; an Orders directory nested inside vendor receives no exemption.
- Show grouped missing/extra locations and the changed file name on refusal instead of hiding the underlying reason.
- Add first/repeated installation tests with an existing archive, retained local work and a nested-code refusal.

## 2026-10-17 R50 startup correction

- Prevent launcher imports from creating unsigned Python caches before verifying the signed deployment. Both Windows Python command paths use bytecode suppression; the Python entry point also suppresses cache writes before sibling imports.
- Add a regression that fails on the delivered 16 October launcher and exercises first and repeated installs with default Python settings, signed inventory, retained local settings and unfinished-work sentinels.
- Retain exact file-inventory, signature, hash and downgrade checks. Use a clean complete deployment to avoid caches left by an earlier failed extraction.
- Existing R50 manual remains applicable; the generated installation guide includes the correction and recovery steps.

## R50

Signed updates, private helper sessions, renderer/CSP containment, trusted connections, error/dead-code cleanup, direct modules, repository simplification, current manual and corrected inspection-result eligibility.

## R49

Bounded read-only reporting concurrency, production-readiness record and complete operating manual.

## R48

Report navigation, filters, coverage, exports and measured responsiveness.

## R47

Approved-language discovery, separate administration and private-edit retention.

## R46

Focused reinspection walk-through, progress, Undo and action choices.

## R45

Inspection choice, draft continuation and delayed-result isolation.

## R44

Saved-work and connection tools.

## R43

Compact charge completion and citation readiness.

## R42

Task-based document editing.

## R41

Workspace prioritization and next actions.

## R40

Integrity, migration/anchor, original-PDF and installation safeguards.

## R39

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R38

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R37

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R36

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R35

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R34

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R33

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R32

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R31

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R30

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R29

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R28

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R27

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R26

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R25

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R24

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R23

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R22

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R21

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R20

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R19

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R18

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R17

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R16

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R15

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R14

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R13

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R12

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R11

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R10

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R9

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R8

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R7

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R6

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R5

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R4

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R3

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R2

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.

## R1

Retained historical document, workflow, import, policy and reliability development; consult version-controlled history for implementation details.
