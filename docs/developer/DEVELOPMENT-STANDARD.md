# Development, pull requests and release standard

This is the current development process. Implemented prompts and release reviews are evidence of earlier decisions, not instructions to repeat those changes. Follow AGENTS.md and the current architecture, domain, pitfalls and testing guides. Preserve all legal holds and owner decisions.

## Focused changes and naming

Use `develop/<issue>-<short-slug>` when an issue exists, or `develop/<short-slug>` for owner-requested maintenance without one. Start from current main. Use `<type>(<area>): <concrete change>` for PR titles; types are `feat`, `fix`, `refactor`, `docs`, `test`, `chore`. Example: `fix(storage): preserve drafts during startup`. Use `release: YYYY-MM-DD Rnn` only for owner-assigned release preparation. The repository PR template and PR format workflow enforce the title and review sections.

Keep one focused concern per PR; related corrections from one approved maintenance review may use separately reviewable commits. Explain the final behavior and risk, not the conversational history. Link the issue or owner-requested review and use the template's scope/rule ownership, version decision, verification and readiness sections.

New source files use descriptive snake_case; JavaScript functions use camelCase, Python functions use snake_case, and immutable constants use UPPER_SNAKE_CASE. New tests use feature names. Retain the test index and former-name map for historical suites.

## Stable names and rule ownership

These names serve distinct roles and stay stable:

| Role | Name |
| --- | --- |
| Product | Madison Building Inspection Document Writer |
| Repository | kpbunnow/madison-document-writer |
| Private npm package | madison-building-inspection-document-writer |
| Desktop shortcut | Document Writer.lnk |
| Internal referral types | `referral` = Referral for Prosecution; `referralUpdate` = Update for Case Referral |

Persisted document/report IDs, JSON keys, event names, operational folders and installed filenames are compatibility contracts. Do not rename them for appearance. Compliance history does not itself make a case referred. Compare frontend/helper rule mirrors with contract tests, including every shareable report ID.

Ownership for new work:

- Navigation/screens express intent and render facts; no private-storage replacement before startup restoration completes.
- workspace_database owns device IndexedDB access; draft_persistence owns local draft snapshots, restore and the autosave chain. shared_case_storage owns folder/helper write access, pending_case_saves owns held-save retry and case_save_workflow owns case-save orchestration. case_files retains startup lock/readiness sequencing, summaries and folder/debounce UI. Lock ownership and readiness to edit are separate states; internal recovery may save only after retained workspace data has been read.
- case_records owns live replay/projection/checkpoint/export/event-merge operations; case_loading coordinates case-file loading, shared merge validation and existing rollback through scoped adapters. These operations do not replace helper trust or grant readiness to edit.
- workspace_backup owns whole-workspace backup download/restore coordination; recovery UI retains file selection and individual-case/automatic recovery. Preserve the existing persistence/integrity/live replacement order and versions; this boundary does not grant startup readiness or new transactional guarantees.
- automatic_recovery owns recovery identity/snapshot/helper-backup scheduling through scoped adapters; recovery UI owns status, selection and individual-case restoration. Preserve original key/startup order, acknowledgement/signature, debounce and latest queued state semantics; scheduled serialization is not a general concurrent-call or durable-queue guarantee.
- The helper owns validation, authority, integrity, atomic publication and immutable original PDF retention. UI validation does not replace it.
- Rendering/pagination consumes explicit facts and frozen issued versions; it does not own persistence or query later live history for reprints.
- Reports consumes verified projections and remains read-only against case history.
- Prefer scoped service dependencies to new global wiring. Break dependency cycles incrementally only when needed; do not recreate a universal registry or repeat a broad module rename.
- A new Python/dynamic browser helper must keep its suite serial: extend execution classification and its tests before moving a launch outside the currently followed static local JavaScript requires.

## Verification and merge review

Run the full `python3 tools/verify_release.py` on final reviewed source. Fast runs are iteration only. Keep Chromium/performance work serial and retain every historical assertion and frozen reference. Review fixes require fresh verification for changed inputs. Actual suite/screen/print counts belong in evidence; counts may legitimately increase.

Record the reviewed SHA, actual outcomes, targeted before/after regression, toolchain/browser and evidence link in the PR. The gate records source commit/clean state when Git exists, a verified-input digest and actual toolchain versions. Extracted source ZIPs can still verify without Git, using content fingerprints; do not invent a source commit for them.

CI checks the PR head, installs frozen dependencies and the pinned Playwright browser, runs the full gate and retains evidence even on failure. The metadata workflow treats titles/body as environment data, not executable shell text. No production credentials are needed for synthetic verification. A passing gate is not proof of absence of every bug, native acceptance or deployment approval. Do not merge automatically.

## Merge policy on the free GitHub plan

The repository is private on GitHub's free plan. GitHub does not enforce branch rules or rulesets there: its branch-protection and rules APIs answer "Upgrade to GitHub Pro or make this repository public to enable this feature." The owner decided (October 24, 2026) to stay on the free plan. The Full gate and PR format checks still run on every pull request and on every push to main, but nothing on the server prevents a merge or a direct push, so the merge policy is followed by hand:

1. Never push directly to main. Every change goes through a pull request from a `develop/...` branch.
2. Merge only when **Full gate** and **PR format** have both passed on the pull request's current head commit, and the branch includes the current main (update it and wait for the checks again if main moved).
3. Merge only with the owner's explicit approval, after review conversations are resolved. A merge is never automatic.
4. After each merge, confirm the Full gate on the resulting main commit passed. If it failed, fix forward through a new pull request; do not rewrite main's history.
5. Do not force-push to or delete main. An emergency change still goes through a pull request with the full gate; record the reason in the pull request.

If the repository later moves to a plan that enforces rules, configure main to require pull requests, resolved conversations, the **Full gate** and **PR format** checks and an up-to-date branch; prevent force pushes and deletion; dismiss stale approvals on new commits; and keep an explicit owner-review policy for a single maintainer instead of an impossible self-approval requirement. Then confirm the rules read back as enforced.

## Independent version identities

version.json is authoritative. `tools/version_schema.py` validates actual dates, canonical labels, matching release/helper dates, a positive helper build and positive format versions before build/synchronization. npm identities must still agree.

| Field | Rule |
| --- | --- |
| release | `YYYY-MM-DD Rnn`, actual date and positive assigned release number |
| helperVersion | `YYYY.MM.DD.<helperBuild>` |
| helperBuild | Independent positive integer, advanced for changed published deployment bytes |
| authoringVersion | New authored format only; preserve historical renderer cutoffs and issued versions |
| caseSchema / summaryVersion / backupVersion | Change only their own compatibility contract with reader/migration/parity tests |

R63 with helper build 64 is the current assigned release (the development label R62, build 63, was never published). New ordinary documents use authoring 16; scoped orders retain 13. Constants such as historical authoring 12/13/14/15/16 are capabilities, not values to globally replace during a release bump. The independently pinned per-family test expectations remain separate from application implementation.

The owner authorized development under `2026-10-23 R62` until a deploy package was requested, then assigned `2026-10-24 R63` (helper 2026.10.24.64, build 64) for the authorized release package, published against the R61 deployment manifest. Assigning and packaging a release does not approve legal wording, deploy it or close City acceptance. The owner subsequently authorized Phase 8 screen-shell/CSS cleanup on October 25, 2026. SCREEN-SHELL.md defines its current-reference contract; approved print styles, historical document references and release trust remain excluded.

## Publication and package structure

Keep the existing stem `Madison-Building-Inspection-YYYY-MM-DD-Rnn` and distinct `-deploy.zip`, `-source.zip`, `-evidence.zip` and complete `.zip` packages. Keep installed filenames stable. Adopt case-sensitive `rNN` tags for future assigned releases at the approved source commit; preserve historical tags.

For publication, the release owner supplies the deployment `runtime-manifest.json` retained from the **last approved published release**, not the local verified-install.json pin:

```sh
python3 tools/package_release.py --output <new-output-folder> --published-manifest <last-approved-deploy/runtime-manifest.json>
```

The packager refuses changed content or protocol metadata under the same identity, release-number reuse, helper-build reuse and calendar rollback. An identical manifest is an allowed exact reinstall. New published content requires a new authorized release number and helper build. The baseline is supplied by the release owner; this is a publication policy check, not new cryptographic authentication.

Only a genuinely first program publication may use `--first-publication`, an explicit owner declaration that no preceding publication exists. It does **not** mean a first installation on a new PC or a missing baseline. This program already has earlier releases; obtain the retained approved manifest for its next publication. Never fabricate a baseline or use the first-publication declaration to bypass an upgrade.

Retained historical baselines can keep their original calendar labels and derive a legacy counter from helperVersion; newly assigned candidates must follow the current strict identity rules.

Keep the publication input and output outside maintained source. Record release identity, source commit/content digest, clean-source state, actual toolchain, manifest/artifact hashes and evidence. In a Git checkout packaging refuses known uncommitted source. Offline extracted source retains its content evidence and can verify without .git. The existing installer verification and unsigned manifest/NTFS trust model are unchanged.

For an assigned release, edit version.json, run tools/sync_version.py, update the manual source’s current Release/Helper/date line and the current developer first-line release tokens, and create the assigned `Rnn-REVIEW.md`. Keep historical labels and renderer cutoffs unchanged. Update living acceptance/readiness records in place and let the build render their package copies. Regenerate all manual editions together if manual source/style or release identity changes. Publish the deploy ZIP hash separately and retain the prior complete release for deliberate rollback. Do not reuse a published identity for different bytes.

## Acceptance and completion

R60, R61, R62 and consolidation phases 1–7 are implemented. Their original prompts are kept in place for provenance and incoming links. Older format acceptance stays version-specific: authoring-15 Best Interest retains its safety confirmation; authoring-16 does not. Preserve accepted S56B and other recorded decisions; unresolved City/native/staff/legal/seasonal checks remain open until their owners record actual evidence. Merge approval does not authorize rollout.
