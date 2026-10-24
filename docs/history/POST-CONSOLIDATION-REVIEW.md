> Historical review of main at 73c72a0. Follow-up implementation is recorded in CHANGELOG.md and docs/developer/DEVELOPMENT-STANDARD.md. Original findings below describe that baseline and are not a new instruction to repeat the work.

# Post-consolidation program and development review

Reviewed baseline: `main` at `73c72a0` (Phase 7 / PR #42 merged), 24 October 2026.

This is a review and proposed development standard, not authorization to deploy, change legal policy, rename stored identities, or merge a future PR. No maintained application source was changed during this review. Reproduction files and logs are isolated outside the repository in `/tmp/post-consolidation-review/`.

## Assessment

Consolidation phases 1–7 are complete. Phase 8 remains declined under the recorded owner decision. The project has substantial safeguards: source-bound verification, historical renderers, frozen print references, helper-owned publication and integrity checks, generated deployment manifests, and independently pinned authoring expectations. The current release identities are mutually consistent.

Development completion does not establish absence of defects or production acceptance. Two functional problems emerged outside the existing regression coverage: startup can save before restoring private work, and two Reports screens disagree with the helper's shared-view allowlist. Address those before operational rollout.

Full verification of merged main completed successfully: **167 regression suites, 286 accessibility screens and 69 print-compatibility checks**, full mode, with passing production browser/PDF and repository evidence. Writer and Reports runtime hashes remain identical to the preceding verified baseline. The worktree is clean.

The additional production-browser startup reproduction also succeeded in exposing F1: an actual previously saved IndexedDB draft existed before delayed startup; clicking the real Order language navigation button while readiness was false reduced stored drafts from one to zero; startup then completed with zero drafts. The matching production-browser no-click control retained one stored draft throughout delayed startup and restored that one draft successfully. Both runs used synthetic isolated profiles and helpers, not operational data. Passing the existing gate therefore does not certify the newly identified early-startup path.

## Findings and recommendations

### F1 — High: startup navigation can overwrite retained private drafts

Evidence: [navigation.js:55](https://github.com/kpbunnow/madison-document-writer/blob/73c72a0/app/modules/navigation.js#L55), [case_files.js:518](https://github.com/kpbunnow/madison-document-writer/blob/73c72a0/app/modules/case_files.js#L518), [case_files.js:654](https://github.com/kpbunnow/madison-document-writer/blob/73c72a0/app/modules/case_files.js#L654).

`bootStorage()` grants workspace access before awaiting helper/catalog discovery and before `restoreDrafts()`. Normal navigation calls `saveDrafts()`, which checks ownership (`WRITER_ACCESS`) but not restoration readiness (`WRITER_READY`). A quick navigation during delayed startup can therefore persist the initially empty in-memory workspace over the IndexedDB `drafts` entry. Restoration subsequently reads that empty entry.

An isolated test using the actual navigation, save and restoration functions confirmed a valid retained draft restores normally, but is lost from the stored workspace after navigation during a delayed startup. Its recorded save occurred with `ready:false`, zero cases and zero drafts. No real records were used. A separate production-browser test, run after the full gate with actual IndexedDB and a real Order language click, confirmed the same one-draft-to-zero loss. Only a catalog response was delayed; application save/navigation/restoration code and IndexedDB were not mocked in that confirmation. The no-click browser control preserved and restored the draft.

The Reports-to-Writer handoff already waits for readiness ([case_timeline.js:629](https://github.com/kpbunnow/madison-document-writer/blob/73c72a0/app/modules/case_timeline.js#L629)); ordinary navigation does not. Existing browser tests wait for startup readiness, so they do not exercise early user interaction. A recovery backup might provide another copy, but its availability cannot be assumed.

Recommendation:

- Make startup restoration an explicit state (`starting`, `ready`, `failed`) and prevent user-triggered saves, imports and navigation from replacing storage until restoration completes.
- Distinguish acquiring the workspace lock from becoming ready to edit. Guard public mutation entry points as well as disabling controls.
- Preserve internal startup recovery operations; avoid creating a deadlock by waiting on readiness inside work that startup itself awaits.
- Show a recovery/retry state on startup failure rather than leaving an indefinitely editable or waiting workspace.
- Add a production-browser regression with existing IndexedDB drafts, deliberately delayed startup, real navigation clicks and an assertion that all retained draft/workspace data survives. Test the normal no-click control too. Do not fix this by increasing timeouts or only making test fixtures wait.

Priority: fix before operational use. Shared issued records are not demonstrated to be lost; the confirmed risk concerns private workspace/draft retention.

### F2 — Medium: two report types cannot share views

Evidence: [reports_core.js:543](https://github.com/kpbunnow/madison-document-writer/blob/73c72a0/app/modules/reports_core.js#L543), [reports_core.js:620](https://github.com/kpbunnow/madison-document-writer/blob/73c72a0/app/modules/reports_core.js#L620), [reports_services.js:67](https://github.com/kpbunnow/madison-document-writer/blob/73c72a0/app/modules/reports_services.js#L67), [workflow_helper.py:10](https://github.com/kpbunnow/madison-document-writer/blob/73c72a0/helper/workflow_helper.py#L10).

The frontend defines eleven reports and exposes Share view, including `overriddenDeposits` and `documentActions`. The helper's `REPORTS` allowlist contains only nine. Valid synthetic view payloads for the two omitted reports both fail with `Invalid view settings`; `openCases` passes the same control test.

Recommendation: add the missing canonical report IDs to the approved shared-view contract and add an integration/contract test enumerating every shareable frontend report. Retain validation of invalid IDs and immutable shared views. Prefer one small reviewed report-ID contract consumed or compared by both languages. This is a concrete rule-consistency defect, not a reason to rename the stored IDs.

### F3 — Medium: release-name and calendar-version validation is incomplete

Evidence: [project_layout.py:124](https://github.com/kpbunnow/madison-document-writer/blob/73c72a0/tools/project_layout.py#L124), [verified_update.py:52](https://github.com/kpbunnow/madison-document-writer/blob/73c72a0/helper/verified_update.py#L52).

The build's version validator checks npm agreement, the final helper-version segment and several code consumers. It does not validate the canonical release-label grammar, calendar dates, or agreement of release/helper dates. An isolated source-copy test was accepted with release `not-a-release` and helper version `2026.99.99.63` after synchronizing the npm consumers. The current checked-in values are valid; this is a future release-input validation defect. It demonstrates missing early validation, not that an invalid identity can complete the entire gate and packaging process.

Recommendation: introduce a shared version-schema validator with real date parsing, canonical label syntax, four numeric helper segments, a positive integer helper build, explicit positive data-format versions and the intended relationship between release/helper dates. Add negative tests for malformed labels, impossible dates, booleans, negative counters and drift. Keep historical format thresholds separate from current creation versions.

### F4 — Medium: immutable published release identity is a policy, not an enforced publication rule

Evidence: [verified_update.py:96](https://github.com/kpbunnow/madison-document-writer/blob/73c72a0/helper/verified_update.py#L96), [package_release.py:54](https://github.com/kpbunnow/madison-document-writer/blob/73c72a0/tools/package_release.py#L54), [launch.py:170](https://github.com/kpbunnow/madison-document-writer/blob/73c72a0/helper/launch.py#L170), [CONSOLIDATION-PROMPT.md:78](https://github.com/kpbunnow/madison-document-writer/blob/73c72a0/docs/developer/CONSOLIDATION-PROMPT.md#L78).

An isolated installer-verifier test accepted different program bytes and a correspondingly regenerated manifest while keeping the same release, helper version and helper build as the local installation pin. Downgrade comparisons reject lower values, not equality with different content. Packaging checks agreement with current metadata but does not compare against an authoritative last-published release. The launcher also reuses an existing helper based on its version, making different content under one identity operationally confusing.

This is not an authentication bypass: the manifest's documented security boundary is release-owner write permission on the share, and same-identity reinstalls can be legitimate. It is a release-governance gap relative to the rule requiring a new identity before shipping changed runtime bytes.

Recommendation: enforce immutability at release publication/packaging against a retained published-release ledger or verified prior artifact. Same published identity must mean identical published content. Permit exact reinstalls. Require a new owner-assigned release/helper identity for changed deployed bytes, including deployed manuals/assets. Preserve the existing unsigned manifest/NTFS trust model; do not introduce signing keys or silently change installer compatibility.

### F5 — Medium: no repository PR template or checked-in CI workflow

`git ls-files` contains no `.github/` files, PR template or CODEOWNERS file. The local gate is strong and packaging requires its evidence, but the repository does not carry a uniform PR format or an Actions workflow that makes merge verification repeatable. Server-side branch protection was not established by this inspection; absence of checked-in CI does not prove branch protection is absent.

Recommendation: add the template below, a documented contribution/release standard, and a required full-gate CI check with pinned dependencies/browser and retained evidence. Configure protected `main`, review requirements and dismissal of stale approvals in GitHub settings. Require verification for the final reviewed head, not an earlier author commit. Native City acceptance remains a separate owner-controlled process, even if a Windows tooling CI job is added.

### F6 — Medium: current development and historical acceptance instructions need one final closure pass

Examples:

- [README.md:1](https://github.com/kpbunnow/madison-document-writer/blob/73c72a0/README.md#L1) still names R59 while `version.json` is R62.
- [AGENTS.md:3](https://github.com/kpbunnow/madison-document-writer/blob/73c72a0/AGENTS.md#L3) describes R62 Development 3 as work awaiting review/merge, although it is merged.
- [R62-DEVELOPMENT-PROMPT.md:5](https://github.com/kpbunnow/madison-document-writer/blob/73c72a0/docs/developer/R62-DEVELOPMENT-PROMPT.md#L5) still labels itself a development prompt and starts from an old main commit, while the entry guide correctly calls it an implemented record.
- [PRODUCTION-READINESS.md:59](https://github.com/kpbunnow/madison-document-writer/blob/73c72a0/docs/developer/PRODUCTION-READINESS.md#L59) retains the R61 safety-checkbox statement. Current authoring-16 Best Interest has no checkbox; authoring-15 retains it. R61/R62 acceptance rows need to explicitly name the respective formats so they are tested as historical/current behavior, not competing current requirements.

Recommendation: give implemented prompts a conspicuous implemented/superseded status and source PR references, mark phases 1–7 completed and Phase 8 declined, remove stale release labels from generic entry points, and qualify retained acceptance rows by authoring version. Preserve old URLs and exact historical evidence. Do not reopen already accepted S56B or mark unresolved R60/R61/R62/City/legal items accepted merely because consolidation is complete.

### F7 — Low: large cyclic module ownership remains a future development risk

The maintained top-level JavaScript source graph has 45 modules; its largest strongly connected component contains 26, including the conditionally compiled test-fixture module. `app_core.js` is 3,525 lines; other large modules include `new_documents.js`, `accela_import.js`, `case_timeline.js` and `issuance_and_corrections.js`.

This does not prove a runtime bug. The consolidation intentionally preserved executable initialization/listener order and output. It does mean a future feature can introduce initialization-order or ownership mistakes despite feature-oriented filenames.

Recommendation: document public service boundaries and the dependency direction for new work. Keep pure rule/rendering functions separate from persistence and global event wiring. Break a cycle only when a focused change needs it, with initialization and historical-output checks; do not launch another repository-wide rename or recreate a universal runtime registry. Extend explicit test execution classification when new Python/dynamic browser helpers are introduced; the current classifier follows static local JavaScript `require()` calls, not every possible dependency form.

## Rules and naming that should remain stable

- Release number, helper build, authoring version and storage versions are independent. R62 with helper build 63 is intentional, not an off-by-one defect.
- Current identities: release `2026-10-23 R62`; helper `2026.10.23.63`; helper build `63`; authoring `16`; case schema `5`; summary `6`; backup `2`.
- New ordinary documents use authoring 16; scoped orders keep 13. Historical cutoffs such as 12/13/14/15/16 are renderer capabilities, not text to replace globally during a release bump.
- Internal document types and report IDs, event names, stored JSON keys, operational folder names and installed filenames are compatibility contracts. Preserve them unless an explicit migration is approved.
- User-facing names and source identifiers need a glossary, not a blanket rename. For example: `referral` = Referral for Prosecution; `referralUpdate` = Update for Case Referral; compliance history does not itself mean the case is referred.
- Product: Madison Building Inspection Document Writer. Repository: `kpbunnow/madison-document-writer`. Private npm identity: `madison-building-inspection-document-writer`. Desktop shortcut: `Document Writer.lnk`. These serve different purposes and can remain stable.
- New source files: descriptive `snake_case.js`, `.cjs` or `.py`; JavaScript functions use `camelCase`, Python uses `snake_case`, immutable constants use `UPPER_SNAKE_CASE`. Continue feature-based suite names; preserve the former-name map for historical tests.

## Proposed PR standard

Branch: `develop/<issue-number>-<short-feature-slug>`. Use one focused concern per PR; branch names are development references, not release identifiers.

Title: `<type>(<area>): <concrete change>`. Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`. Areas should use the program's established feature names. Examples:

- `fix(storage): preserve drafts while Writer starts`
- `fix(reports): allow sharing views for all supported reports`
- `docs(development): standardize release and review practices`

Use `release: YYYY-MM-DD Rnn` only for an owner-assigned release preparation PR. Do not call each feature a new R release.

Suggested `.github/pull_request_template.md`:

```markdown
## Problem and resulting behavior
<!-- Explain the concrete trigger and before/after behavior. Link the issue. -->

## Scope and rule ownership
<!-- Identify affected frontend/helper/report/documentation rules and their tests.
     State historical rendering, storage or authority changes, if any. -->

## Version decision
<!-- No identity change, or the owner-approved release/helper identity.
     List authoring/schema/summary/backup changes individually, with reasons.
     Never globally replace historical authoring cutoffs. -->

## Verification
- Reviewed head: <full SHA>
- Full gate: <command, actual result, evidence/artifact link>
- Toolchain: <Node, Python, Chromium; any supported fallback>
- Regression/accessibility/print coverage: <actual counts and any explained change>
- Targeted reproduction/regression: <what failed before and passes after>

## Acceptance and readiness
<!-- Open City/native/staff/legal items; owner decisions required, if any.
     State ready or blocked, with the exact unresolved blocker. -->
```

Counts are evidence, not permanent acceptance constants. New valid tests may change the suite count. A passing comment is not a replacement for run-bound evidence. After review changes, test the final source and request review again. Merge approval and deployment approval are distinct.

## Proposed release naming and structure

Preserve the existing calendar-plus-release scheme:

| Item | Standard |
| --- | --- |
| Product release | `YYYY-MM-DD Rnn`, an actual calendar date and monotonically advancing assigned release number |
| Helper version | `YYYY.MM.DD.<helperBuild>`, with the fourth segment equal to the independent build counter |
| Helper build | Positive integer; strictly increases for changed published deployment bytes |
| New package date | Release/helper dates agree for newly assigned releases; never backdate around downgrade protection |
| Authoring version | Changes only for an intentional new authored format; older issued documents retain theirs |
| Case/summary/backup versions | Change only for the respective compatibility contract, with migration/reader tests |
| Git release tag | Adopt one case-sensitive form, e.g. `rNN`, at the exact approved package source commit; do not rename historical tags |
| Unpublished development | Keep the owner-authorized development identity; attach commit SHA to CI artifacts rather than inventing production release numbers |
| Published artifact | Immutable identity and bytes; corrected published content gets a new authorized identity |

The current `2026-10-23 R62` remains in place until the owner requests/authorizes release packaging. R63/helper build 64 have been proposals, not assigned identities. This report does not assign them.

Preserve the existing package stem:

`Madison-Building-Inspection-YYYY-MM-DD-Rnn`

Deliver the existing distinct artifacts:

- `<stem>-deploy.zip`: runtime for installation.
- `<stem>-source.zip`: maintained source.
- `<stem>-evidence.zip`: source-bound verification evidence.
- `<stem>.zip`: complete owner/IT package, with `deploy/`, `source/`, release records and checksums.

Keep installed runtime filenames unversioned and stable. Keep `Rnn-REVIEW.md` release-specific, and continue updating the living acceptance/readiness records in place before the build renders their release-specific package copies. The existing standalone manual filenames can remain stable within the release's output directory.

Official release metadata should additionally record source commit, content fingerprint, clean-source status, toolchain/browser versions, manifest hash, actual verification counts and artifact hashes. Preserve building extracted source ZIPs without Git: carry provenance metadata rather than making a local `.git` directory mandatory. Do not change signing/trust or frozen references to implement naming rules.

## Recommended order of work

1. Fix F1 in a focused storage/startup PR, with a real IndexedDB/browser regression, then run the full gate.
2. Fix F2 in a focused Reports contract PR; exercise all eleven report IDs and invalid-ID refusal.
3. Add the PR template, CI/branch settings, release validation/publication guard and current-document closure as bounded, separately reviewable development-governance work.
4. Complete the actual City/native/staff/legal acceptance required for any pilot or deployment. Keep accepted decisions and open holds accurately scoped.
5. Assign a new release/helper identity only when packaging is authorized; regenerate manual/release documents as required, run the complete final gate, package with the existing tool, and independently verify deployment inputs/checksums.

Avoid a broad cosmetic rename or a new consolidation phase solely to make every historical identifier look uniform. Preserve the stable baseline and make specific, regression-tested corrections.

## Validation record

| Check | Actual outcome |
| --- | --- |
| Full gate on `73c72a045d68dcc703c2fd9b9b93ae5493d3dbfe` | Passed, `mode: full`; 167 regression suites, 286 accessibility screens, 69 print checks; browser/PDF/repository checks passed |
| Startup race, isolated function test | Existing draft restores in the control; early navigation writes zero cases/drafts while readiness is false and subsequent restore loses that private draft |
| Startup race, real production Chromium/IndexedDB | One draft present before delayed startup; actual Order language click stores zero drafts; completed startup has zero drafts |
| Startup control, real production Chromium/IndexedDB | Same delayed-startup setup without the early click retains and restores one draft |
| Shared view validator | `openCases` accepted; `overriddenDeposits` and `documentActions` rejected with `Invalid view settings` |
| Isolated version-validator copy | Accepted `not-a-release` / `2026.99.99.63` with synchronized npm consumers |
| Isolated installer verifier | Accepted changed manifest-consistent program bytes under the same pinned release/helper/build identity |
| Repository changes | None; clean worktree. Report and diagnostic scripts/logs are outside maintained source |

The full-gate evidence remains in `build/verification/latest/`; the subsequent browser reproductions used separate output folders and did not overwrite it. City Windows, actual network/SQL/NTFS behavior, Classic Outlook, native printing, assistive technology, legal and seasonal acceptance were not established by these synthetic checks. No deployment, release identity assignment, automatic merge or operational record change was performed.
