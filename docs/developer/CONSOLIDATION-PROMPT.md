# Document Writer — Consolidation and Code-Health Development Prompt

Prepared October 23, 2026.

Reviewed baseline: `main` at `f90306c`, following PR #34.

- Release: `2026-10-23 R62`
- Helper: `2026.10.23.63`
- Helper build: `63`
- Authoring version: `16`
- Case schema: `5`
- Summary version: `6`
- Backup version: `2`

B1 and B2 below are confirmed by source inspection. Timing figures from the original report are planning estimates; this review did not rerun the full gate or independently reproduce those measurements.

Status: development prompt. Implementation does not authorize automatic merging or deployment. Existing City, staff, native, legal and accessibility acceptance items remain open.

## Recorded owner decisions (October 23, 2026)

1. Implement phase by phase, one PR per phase, beginning with Phase 1.
2. Fast development tier (Phase 2, T3): approved. It never produces release evidence; full-gate and packaging requirements are unchanged.
3. Phase 8 screen-shell baseline cleanup: declined for now. Unused screen CSS stays documented as candidates.
4. Release identity: develop under the current R62 identity; assign the next release/helper identity only when a deploy package is requested.
5. Carried R61 items (dotted `27.05(2)(g)2.` display reference; legacy non-boolean Abate value): carried forward unchanged.

## Objective

Improve maintainability, correctness and verification speed without changing approved document output or weakening full-gate coverage.

Complete the work in separate, reviewable phase PRs. Begin from the latest `main`, follow `AGENTS.md` and the developer guides, and record actual verification results on each PR.

Do not merge automatically.

## Priorities

| Priority | Work | Recommendation |
| --- | --- | --- |
| 1 | Address escaping and deploy instructions | Fix the confirmed defects first. |
| 2 | Test teardown and projection capture reuse | Improve speed while preserving asynchronous failure detection and evidence integrity. |
| 3 | Dead code and duplicated rules | Prove reachability and semantic equivalence before removing or consolidating code. |
| 4 | Module and test organization | Preserve initialization order, independent fixtures and serial browser scheduling. |
| 5 | Documentation | Describe current behavior directly while preserving historical requirements and acceptance holds. |
| Optional | Fast development tier and screen baseline cleanup | Keep separate from release evidence and frozen print references. |

## Ground Rules

1. Preserve application behavior except for the explicit defects in Phase 1.

   Refactors must preserve:

   - Rendered document bytes.
   - Historical corrections and frozen originals.
   - Print goldens and document parity references.
   - Stored record formats.
   - Helper validation rules.
   - User-visible messages.

2. Never change an assertion, expected hash, reference fixture or release trust merely to make verification pass.

   When moving tests, preserve their inputs, expected values, messages and independent setup. Keep duplicate assertions by default. Any proposed removal requires a separate coverage justification and review.

3. Preserve approved references.

   Print styles, historical document references and release trust remain frozen throughout this plan. Phase 8 may change only explicitly approved screen-shell references and screen-only bookkeeping.

4. Preserve historical authoring behavior.

   Authoring versions 1–16, their correction paths and frozen originals must retain their existing output. Move historical branches unchanged.

5. Preserve Writer/helper parity.

   Keep both implementations of mirrored rules:

   - Writer `summarize()` and helper `case_projection.py`.
   - Browser checks and helper `case_store.py` validation.

6. Follow release identity rules.

   Do not change release identity, authoring version or storage versions without authorization. Before shipping changed runtime bytes, assign the next authorized release/helper identity with a monotonic helper build.

   R63/helper build 64 are proposals, not assigned identities. Do not increment authoring versions merely because code was refactored.

7. Keep measured browser and performance work serial.

8. Never commit operational records, credentials, private keys, dependency installations, caches or build output.

9. Run the full gate on each phase’s final commit before proposing its PR for approval.

## Phase 1 — Confirmed Defects

### B2. Escape imported addresses in the case-actions screen

**Confirmed problem**

`caseActionScreen()` in `app/modules/new_documents.js` passes:

`k.address || "Current case action"`

directly to `shell()` in both its referred-case and normal branches.

`workspace_shell.js` inserts the title directly into `<h1>`. Imported address text containing markup can therefore become HTML.

**Implementation**

- Escape the title in both branches.
- Audit every `shell()` call and helpers that accept raw HTML parameters.
- Include the breadcrumb parameter in that audit.
- Establish and document one consistent title convention:
  - Callers supply escaped text, or
  - `shell()` escapes plain-text titles centrally.
- Preserve intentional HTML parameters and avoid double escaping.

**Verification**

For both referred and normal cases:

- Use the address `<b>X</b> & Co`.
- Confirm the address appears as literal text.
- Confirm no injected `<b>` element is created.
- Include a synthetic event-handler payload and confirm no injected element or handler is created.
- Preserve existing escaping checks.

### B1. Correct the deploy ZIP filename in installation instructions

**Confirmed problem**

`docs/staff/DEPLOY.template.md` uses:

`Madison-Building-Inspection-{{RELEASE}}-deploy.zip`

The release value contains a space:

`2026-10-23 R62`

The packager replaces that space with a hyphen:

`Madison-Building-Inspection-2026-10-23-R62-deploy.zip`

The generated integrity command therefore names the wrong file.

**Implementation**

- Add a filename-safe release placeholder in `render_deploy_guide()` in `tools/build.py`, such as `{{RELEASE_FILE}}`.
- Derive its value using the same naming rule as `tools/package_release.py`.
- Use the placeholder wherever the template names a package file.
- Factor the naming rule into a shared helper if practical.
- Preserve existing release identity checks.

**Verification**

Assert that:

- Generated `build/generated/DEPLOY.md` names the actual deploy ZIP.
- The README inside the archive uses the same filename.
- The named ZIP exists in the release output directory after packaging.

The ZIP should not be nested inside its own deploy folder.

### Phase 1 Acceptance

- Both defects have regression coverage.
- Existing full-gate checks pass.
- The PR records the fixes, test results and release identity decision.
- No historical document output changes.

## Phase 2 — Improve Verification Speed

Preserve full-mode coverage. Treat the original timing figures as estimates until measured on the same machine with the same worker count.

Original report baseline:

- Approximately 11 minutes total.
- 163 unit/helper suites.
- Approximately 4 minutes 50 seconds for unit/helper work.
- Approximately 5 minutes 45 seconds for browser work.
- 286 accessibility screens.
- 69 print variants.

### T1. Remove test-owned idle timer waits

**Reported problem**

Warnings and errors auto-dismiss after 15 seconds in `app/modules/accessibility.js`.

Some JS suites finish assertions quickly but remain alive waiting for UI timers.

Candidate suites:

- `audit_e2e`
- `audit_events`
- `audit_final`
- `audit_func`
- `audit_import`
- `audit_order_improvements`
- `audit_perm`
- `audit_r21`
- `audit_recipient_flow`
- `audit_reports`
- `audit_resume`
- `audit_review`
- `audit_storage`
- `audit_summary`
- `audit_valid`
- `audit_walkthrough`

**Implementation**

- Inventory each suite’s DOM and timer lifecycle.
- Add explicit test-owned teardown after the suite’s completion promise settles.
- Close the test DOM/window and clear its UI timers.
- Share teardown where suites use the same lifecycle.
- Do not change production timer durations.

`tests/fixtures/built_bundle.cjs` only reads a page and its bundle. Changing that loader alone will not clean up independently created test environments.

**Do not**

- Call `process.exit()` merely because a success summary was printed.
- Patch logging to terminate tests.
- Globally unref timers.
- Suppress asynchronous failures or pending callbacks.

**Verification**

Demonstrate locally that all of the following still fail correctly:

- A broken synchronous assertion.
- A delayed asynchronous assertion.
- An unhandled rejection.

Do not commit intentional failures.

Retain exit-code and failure-output detection. Measure actual timing improvement; use under four seconds per affected standalone suite only as a target where its workload permits.

### T2. Reuse projection captures from the current gate run

**Confirmed duplication**

`audit_case_projection.py` reruns these Writer suites to capture real summaries:

- `audit_summary`
- `audit_lifecycle`
- `audit_corrections`
- `audit_r25`
- `audit_r26`
- `audit_r28`
- `audit_release`

Those suites also run independently in the regression pool.

**Implementation**

- Have `tools/run_tests.py` supply `DW_PROJECTION_CAPTURE` when running those seven suites.
- Use separate capture files in a newly created per-run directory.
- Run the projection comparison after the required source suites complete.
- Keep the full generated corpus unchanged: three seeds, 2,000 cases each.

**Capture integrity**

Bind captures to:

- Source fingerprint.
- Run identifier.
- Suite name.
- Successful completion.

Validate that all seven expected captures are complete, nonempty and from the current run. Publish completion atomically.

In a full gate, missing, failed, stale or malformed captures must fail explicitly.

Standalone fallback may rerun the flows only when no gate capture context was supplied. Do not silently fall back during a full gate.

**Acceptance**

- Identical full-mode comparisons and coverage.
- No duplicate execution of the seven flows during the gate.
- Standalone projection testing remains supported.

### T3. Optional fast development tier

This tier has explicitly reduced coverage and must never produce release evidence.

**Implementation**

Add `DW_FAST=1` to:

- Skip `audit_r48_performance.py` and `audit_r49_performance.py`.
- Run one projection corpus seed instead of three.
- Retain all other checks, including the browser stage.

**Required correction**

`audit_case_projection.py` currently requires more than 5,000 successful projections. A single 2,000-case seed cannot satisfy that threshold.

- Keep the existing threshold unchanged in full mode.
- Define an explicit fast-mode threshold.
- Retain boolean/type distinction and refusal checks.
- Record this as a deliberate fast-only coverage reduction.

**Evidence safeguards**

- Label run mode explicitly in regression, browser and verification evidence.
- Invalidate prior evidence when a new run starts, including fast runs that fail or abort.
- `tools/verify_release.py` must not write passing release evidence for fast mode.
- Packaging must reject fast evidence and evidence missing required mode metadata.
- A previous full result must never be mistaken for the current fast result.

**Documentation**

Document both tiers in:

- `docs/developer/05-TESTING.md`
- `docs/developer/CLOUD-DEVELOPMENT.md`

The full gate remains mandatory before proposing each phase PR and before packaging.

### Phase 2 Acceptance

- Report before/after wall time and stage timings.
- Record hardware quota and worker count.
- Preserve the accessibility screen-name set and print-variant coverage.
- Keep full-mode checks and thresholds intact.

Suite counts are a baseline, not a permanent requirement: Phase 6 intentionally reduces suite files while preserving coverage.

## Phase 3 — Remove Verified Dead Code

### D1. Remove obsolete Accela status handling

Candidate code:

- `ACC_STATUS` in `app/modules/app_core.js`.
- The one-argument branch of `accStatusEligible(status, type)`.
- The `ACC_STATUS` import and obsolete explanatory branch in `reinspection_walkthrough.js`.

**Implementation conditions**

- Recheck every application and test caller.
- Confirm callers supply a type.
- Confirm the explanatory branch cannot be reached under current filtering.
- Preserve behavior for supported inputs.

If confirmed, simplify eligibility to use `statusRule(type, status)`.

Search the complete repository for remaining references before removal.

### D2. Evaluate the “already used” import blocker

Candidate code in `baseLookupPlan()`:

- `p.used`
- Its “already used to generate a document” blocker.
- Corresponding `plan.used` browser-test expressions.

**Do not remove solely because rows are normally hidden.**

First prove the invariant for:

- Shared-record refresh.
- A selection becoming stale.
- Direct plan construction.
- Refreshing an unissued document or worksheet.

Preserve authoritative helper reuse validation and unfinished-work checks.

If the branch is reachable, keep it and document why. If proven unreachable, remove it with its redundant test expression.

Keep:

- `inspectionUsed()`.
- Existing hidden-row filtering.
- The “Every inspection returned … already used” message.

### D3. Make internal exports private

Recheck these candidates:

| Module | Candidate exports |
| --- | --- |
| `court_and_deposits.js` | `clearChargeBasis` |
| `desktop_exit.js` | `exitDialogHTML` |
| `helper_stopped.js` | `HELPER_STOPPED_CHANNEL`, `STOPPED_TITLE`, `stoppedHTML` |
| `new_documents.js` | `ALL_ITEM_EXTENSIONS`, `REFERRED_MESSAGE`, `allItemExtension`, `syncAffected` |

Run an export/import scan and include its results in the PR.

Tests can access bundle-scope names through `eval`; absence of an ES module importer does not prove a symbol is unused. Preserve required test hooks and verify the full unit stage.

### D4. Remove an unused parameter

Remove unused `S` from `rememberUI()` in `app/modules/report_presentation.js`.

Update call sites consistently.

### D5. Inventory unused CSS; defer frozen-shell changes

The original report identified candidate unused classes in:

- `app/assets/writer.css`
- `app/assets/accessibility.css`
- `app/assets/reports.css`

Treat those as candidates, not confirmed deletions.

`audit_r51_layout.py` hashes the complete HTML shell after replacing the embedded JS payload and specified reviewed changes. Embedded stylesheet bytes are consequently protected.

**Requirements**

- Search application, helper, templates and tests.
- Check dynamically constructed class names and stems.
- Preserve runtime/library families such as `st-*`, `message-*` and `leaflet-*`.
- Do not change embedded screen styles without the Phase 8 approval.
- Keep `approved-print-style.css` frozen throughout this plan.

This phase may document candidates without deleting them.

### D6. Move inert provenance templates

Review the division Word templates under:

`tests/fixtures/reference/new-documents/`

If confirmed unused by tests and tools:

- Move them to `docs/history/division-templates/`.
- Add a README identifying their source and inert provenance purpose.
- Inventory exact filenames and SHA-256 values before and after.
- Preserve every file byte.
- Check literal references and glob-based ownership rules.
- Update source inventory and relevant ownership rules.
- Confirm the files remain in maintained source and out of deployment packages.

### Phase 3 Acceptance

- Full gate passes.
- Rendered document output remains byte-identical for unchanged fixtures, including historical corrections.
- Every removed symbol and rule is listed.
- Conditional removals are supported by reachability evidence.

The JavaScript bundle and runtime/CSP hashes will legitimately change when code is removed. Do not require identical bundle bytes or refresh frozen document hashes to hide output drift.

## Phase 4 — Consolidate Equivalent Rules

### C1. Share the live referred-case predicate

Candidate repeated expressions include:

- `isEffective(d) && isHistoryDoc(d)`
- Explicit draft/void/superseded exclusions.
- Explicit referral/referralUpdate type checks.

Candidate modules include:

- `new_documents.js`
- `draft_recovery.js`
- `document_pagination.js`
- `inspection_import.js`
- `reinspection_walkthrough.js`

**Implementation**

For semantically equivalent live-current-case callers, introduce:

`isReferredCase(caseId)`

using the effective referral/history documents for that case.

**Preserve distinctions**

- Historical or as-of projections.
- Source-document exclusions.
- Correction-specific predicates.
- Helper-side validation.

Keep `priorReferral` in `issuance_and_corrections.js` as a named variant where it excludes the source document.

Do not replace a temporal predicate with a global live lookup.

**Verification**

Cover:

- Draft.
- Voided.
- Superseded.
- Referral.
- Referral update.
- Source exclusions where applicable.

Existing referred-case tests must pass unchanged.

### B3. Clarify current-authoring expectations in tests

Use a shared current-authoring expectation only where a test means the current format for that document family.

Candidate suites:

- `audit_r54_extensions.js`
- `audit_r59_charge_select.js`
- `audit_r60_development.js`
- `audit_r61_development.js`

**Important distinctions**

Not every new document uses `version.json.authoringVersion`.

Under R62:

- Scoped orders retain authoring 13.
- New all-item extensions use authoring 16.
- Older drafts retain their existing formats.
- Family switching can restore cached authoring versions.

Use family-specific expectations where appropriate.

Keep historical version literals when they identify a format. Preserve an independent pinned version-to-format contract so application and test code cannot both pass by reading the same incorrect constant.

List each converted assertion and explain why its meaning is “current.”

### B4. Improve production-parity error messages

Some parity suites default to `build/dist`, which can contain a test-module build after:

`DW_TEST_BUILD=1 python tools/build.py`

**Implementation**

Detect when a production-only comparison receives a test bundle and fail with a clear message:

“This suite compares against the production build; run `python3 tools/build.py` without `DW_TEST_BUILD` first or set `DW_PRODUCTION_DIR`.”

Inspect actual bundle content or its marker.

Do not rely solely on the environment variable: the full runner legitimately supplies a separate production directory while testing.

Respect build-directory overrides and document the requirement in `05-TESTING.md`.

## Phase 5 — Realign Modules

Current module names do not consistently match their contents:

- `inspection_import.js` contains reinspection worksheet and editor screens.
- `reinspection_walkthrough.js` contains Accela parsing and import review in addition to walkthrough behavior.
- `app_core.js` contains import columns, status rules and XLSX primitives alongside shared state and wiring.

**Suggested organization**

- `accela_import.js`: import columns, parsing, status rules, candidates, plans and review.
- `reinspection.js`: worksheet, walkthrough and result fields.
- `editor_screens.js`: editor screens.
- `app_core.js`: shared state, utilities and wiring.

**Mechanical-only requirements**

- Do not rename functions or edit logic during moves.
- Preserve global listener registration order.
- Preserve capture flags and `stopImmediatePropagation` behavior.
- Check import cycles, initialization order and startup in Writer and Reports.
- Preserve maintained public APIs and required test hooks.

Bundler-local names may change. Function-name equality is not sufficient evidence that behavior is unchanged.

Update:

- Imports.
- Tests that name source modules.
- `tests/README.md`.
- `docs/developer/01-ARCHITECTURE.md`.
- Source inventory.

Run the full gate before and after the move.

## Phase 6 — Consolidate Tests by Feature

Preserve scenarios and coverage rather than pursuing a fixed file-count reduction.

### Rules

- Move assertions with the same inputs, expectations and messages.
- Share immutable setup only.
- Reset DOM, application state, storage, mocks and asynchronous work between independent scenarios.
- Label moved blocks with their source suite.
- Keep duplicate assertions unless a separate reviewed coverage change proves equivalence of setup, execution path and intent.

### Proposed groups

1. Accela import:
   - Parsing and columns.
   - Routing, status and case rules.
   - Selection, stale-state races and repaint.

2. Extensions:
   - Current and historical formats.
   - Family switching.
   - Explicit adoption.
   - Keep print-parity work separate and serial.

3. Histories and referrals:
   - Item-specific observation history.
   - Correction endpoints.
   - Referral state and updates.

4. Small focused regression suites:
   - Fold into the appropriate feature home while retaining their independent scenarios.

### Correct mixed-suite grouping

Do not move entire release suites into a single feature merely because their filenames match.

Examples:

- `audit_r60_review_fixes` also covers batch due dates, dialog focus and Workspace routing.
- `audit_r61_review_fixes` includes citation packet validation and retry filing.
- `audit_r61_development` spans multiple features.

Move individual assertion blocks to their actual feature homes.

### Preserve execution constraints

- Keep the existing 150-second per-suite deadline.
- Split target suites if they would exceed it.
- Keep measured performance and Chromium work serial.
- Preserve Writer/helper pairs.
- Preserve parity and reference suites.

`run_tests.py` currently identifies Chromium suites by searching source text for:

`chromium|playwright|DW_BROWSER`

Moving browser calls into shared helpers can bypass this detection. Establish reliable execution classification or preserve and test detection before relocating those calls.

### Required evidence

Provide:

- Source suite → target suite → scenario/assertion mapping.
- Before/after executed assertion counts.
- Deterministic seeds and corpus coverage.
- Negative-path and security coverage.
- Any separately approved removals.

Counts support the review but do not prove equivalence. Repeated loop assertions must not conceal a missing unique scenario.

Rewrite `tests/README.md` as a feature index and preserve repository/index checks.

Keep the accessibility screen-name set and print-variant coverage unchanged.

## Phase 7 — Rewrite Documentation Around Current Behavior

Rewrite current documentation by feature so readers do not need to reconcile release appendices.

Include:

- `docs/staff/PROGRAM-MANUAL.md`
- Staff guides.
- `docs/developer/01-ARCHITECTURE.md`
- `docs/developer/03-DOMAIN-RULES.md`
- `docs/developer/04-PITFALLS.md`

**Requirements**

- Preserve all 22 required manual chapter anchors by exact identifier.
- Preserve incoming links.
- Keep a concise historical-formats section.
- Move release narrative to `CHANGELOG.md` and `docs/history/`.
- Keep safety confirmations, legal holds and acceptance status explicit.
- Preserve the semantic requirements of pinned warning text.
- Explain any intentional wording changes and corresponding documentation-test updates.
- Update developer entry-point links.

Regenerate all manual editions together using:

`tools/build_manual.py`

Do not claim City, native, legal or accessibility acceptance from automated checks.

## Phase 8 — Optional Screen-Shell Baseline Cleanup

Requires explicit owner approval. (Declined for now; see Recorded owner decisions.)

### Scope

- Create a reviewed screen-shell reference from a verified current source.
- Record its source commit and hashes.
- Simplify obsolete per-release screen-block bookkeeping.
- Consider removing proven-unused screen-only CSS.

### Exclusions

This approval does not authorize:

- Changes to `approved-print-style.css`.
- Print golden updates.
- Historical document reference updates.
- Release trust changes.

Print styles remain frozen even if a selector appears unused.

### Verification

Preserve:

- All 69 existing print variants.
- `R53-extension-rendering.json`.
- Print goldens.
- Historical corrections.

Review screen behavior for:

- Responsive layouts.
- Keyboard focus.
- Forced colors.
- Visual output.
- Accessibility checks.

Accessibility counts alone do not establish visual parity.

Any proposed print-output change requires a separate development proposal and approval.

## Decisions to Record

1. Release identity:
   - Assign the next authorized release/helper identity before shipping changed runtime bytes.
   - Verify the then-current release sequence.
   - Do not bump authoring versions for mechanical refactoring.

2. Fast development tier:
   - Confirm whether to add the reduced-coverage development command.
   - Full-gate and packaging requirements remain unchanged.

3. Screen-shell baseline:
   - Approve or decline optional Phase 8.

4. Carried R61 items:
   - Record or carry forward the decision on the dotted `27.05(2)(g)2.` display reference and correction text in `policy/metadata.json`.
   - Record or carry forward the legacy compliance behavior where a missing boolean Abate value prints “Unavailable” and prevents resolution before issuance.

## Acceptance for Every Phase PR

- Full gate passes on the final commit.
- Full-mode checks and coverage remain intact.
- Exact source commit and runtime identity are recorded.
- Pinned browser, worker count and machine CPU quota are recorded.
- Actual stage and wall times are reported.
- Removed, moved and consolidated items are listed.
- No assertion weakening or release-trust change is introduced.
- Frozen print and historical document references remain unchanged.
- Runtime, CSP and evidence hashes accurately reflect changed bytes.
- Existing acceptance holds remain open.

## Evidence and Failure-Path Checklist

Preserve these checks when changing orchestration:

- ESLint.
- TypeScript contracts.
- Ruff.
- Vulture.
- Repository ownership and test-index checks.
- Source fingerprints.
- Writer/helper parity.
- Strict JSON boolean/number distinctions.
- Exit-code and failure-output detection.

Exercise these failure paths:

- Missing projection capture.
- Partial or malformed capture.
- Failed source flow.
- Capture from an older run.
- Interrupted fast run.
- Source/runtime drift before packaging.

Do not produce passing release evidence from these experiments. Restore intentional failure mutations before the final gate.

## Target Outcomes

Timing targets are provisional and require comparable before/after measurements.

- Fix both confirmed defects.
- Remove only proven dead code.
- Reduce idle timer and duplicate flow overhead.
- Consolidate equivalent live-case rules.
- Preserve family-specific authoring behavior.
- Organize modules and tests by feature.
- Make documentation describe current behavior directly.
- Preserve document output, full-mode coverage and acceptance holds.

The original estimates of approximately 9.5 minutes for a full gate and seven minutes for a fast tier are planning targets, not guarantees.

S62-1 through S62-5 and all carried City, staff, native, legal and accessibility acceptance items remain open.
