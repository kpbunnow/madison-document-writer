# Development, pull requests and release standard

This is the current development process. Implemented prompts and release reviews are evidence of earlier decisions, not instructions to repeat those changes. Follow AGENTS.md and the current architecture, domain, pitfalls and testing guides. Preserve all legal holds and owner decisions.

## Focused changes and naming

Use `develop/<issue>-<short-slug>` when an issue exists, or `develop/<short-slug>` for owner-requested maintenance without one. Start from current main. Use `<type>(<area>): <concrete change>` for PR titles; types are `feat`, `fix`, `refactor`, `docs`, `test`, `chore`. Example: `fix(storage): preserve drafts during startup`. Use `release: YYYY-MM-DD Rnn` only for owner-assigned release preparation. The repository PR template and PR format workflow enforce the title and review sections.

Keep one focused concern per review PR; related corrections from one approved maintenance review may use separately reviewable commits. Approved, related review PRs may be assembled on an `integration/<short-slug>` branch and delivered through one integration PR under INTEGRATION-BATCHES.md. Explain the final behavior and risk, not the conversational history. Link the issue or owner-requested review and use the template's scope/rule ownership, version decision, verification and readiness sections.

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
- automatic_recovery owns recovery identity/snapshot/helper-backup scheduling through scoped adapters; recovery UI owns status/modal presentation, while case_recovery owns selection and individual-case restoration. Preserve original key/startup order, acknowledgement/signature, debounce and latest queued state semantics; scheduled serialization is not a general concurrent-call or durable-queue guarantee.
- case_recovery owns individual-case backup selection/validation/restore; preserve original shared/selection checks, pre-replacement backup and confirmation, single-transaction acknowledgement/fallback rollback, unrelated work retention and live replacement order. UI renders facts; shape validation does not establish integrity, readiness or a stronger all-stage atomic restore guarantee.
- worksheet_workflow owns worksheet readiness and reopen/restore/discard coordination; direct date/clean helpers retain original explicit-input mutation/copy semantics. Keep carried/withdrawn/date/deadline rules, previous-draft identity and refusal/save/render/walk order. Synchronous save dispatch is not durable acknowledgement or publication authority.
- recovery_ui owns work controls/navigation intent, backup file selection and recovery status/modal presentation; catalog_forms owns retained catalog forms/keys. record_history presents document revision history and print notes without mutating records; record actions and inspection-history calculations keep their established owners. Keep scoped lazy browser adapters, disabled/error/conflict states and original dispatch/markup.
- inspection_history owns live legacy/item-lineage history and historical display cutoffs, correction_ui owns correction/record-action presentation, and record_actions owns retained withdrawal/note/follow-through requests. Preserve original lineage/units/locking, holder/request identity and confirmation-before-UI order; these boundaries do not replace record_commit/helper trust or add general request serialization.
- citation_drafts owns citation draft preparation/recovery guards, visit_recording owns visit append/projection dispatch, and working_papers owns capture/unfinished-work presentation. Preserve identity/source metadata, typed/cleared/walk/recipient data and original synchronous save/deposit/message order. record_actions finalization delegates existing correction/publication policy; these boundaries add no issuance authority or stronger save acknowledgement.
- document_printing owns fixed-frame packet preparation/naming; document_delivery coordinates authenticated archive/email/filing through explicit native/UI/receipt adapters. Preserve four-copy/hold checks, archived original identity, reconstructed labeling, snapshot-bound operations, outbox/counter/save order and helper immutable receipt authority. Native adapters do not establish Windows/Outlook acceptance or stronger persistence guarantees.
- helper_requests and case_summary_adapter retain authenticated transport/verification and summary projection authority through scoped integrity inputs. Import sourceDocFor from writer_queries and events from record_event_log directly; preserve clocks/randomness, chronology/explicit overrides and payload semantics without new trust/uniqueness claims.
- case_status owns live case facts, citation_history owns rolling citation counts, workspace_screen owns Workspace presentation/reveal/focus, language_views owns language presentation adapters, screen_overlays owns modal composition, and app_screens owns repaint orchestration. Keep explicit scoped inputs, native/readiness/feature authority, live replacements and exact startup/listener/paint/focus order; both Writer and Reports must remain acyclic.
- workspace_shell owns the screen frame; browser_printing owns printable cloning/browser print dispatch, storage_status owns live diagnostics and storage_probe owns the existing write probe. Preserve fixed print CSS/geometry, native popup/download/timer behavior, escaped status and grant/request/error/render order through scoped lazy inputs; these boundaries add no publication or save authority.
- folder_connections owns folder linking/restoration/grants through explicit native/capability/handle-store/helper/UI inputs. Preserve synchronous picker, helper priority, handle/persistence/flush and quiet/error order; extraction does not add rollback or save authority.
- writer_startup owns lock/startup restoration through scoped native/restore/readiness adapters. Preserve invocation checkpoint, acquisition/held-lock lifetime, restore barrier and failure order; existing persistence/handoff/helper authority and partial-effect semantics remain.
- case_workspace_actions and reinspection_entry own local case/draft actions and reinspection routing/creation. Preserve pending-save refusals, risk precedence, filtering/current lookup order, historical source/inspection identity and awaited versus dispatched save order; shared records/helper/startup retain authority.
- local_case_files and draft_save_controls own native JSON controls and save-status/debounce presentation through explicit adapters. Preserve timer durations/cancellation/dispatch, original unavailable-IDB behavior, raw file text and error/status order; persistence/loader/startup owners keep authority.
- case_folder_workflow orchestrates folder reads/opens and summary/index work through existing permission/projection/write/integrity/load adapters. Preserve raw-byte dispatch, metadata/partial-result and refusal-versus-write status semantics; existing helper/projection authority and startup guards remain.
- address_format owns postal normalization/field checks; recipient_workflow owns parser-aware recipient validation/previews and copy/email edits. Preserve accepted line evidence, validation-before-normalization, correction/live-case scope and dirty/render order; extraction grants no new edit/save authority.
- Import display/mail parsing from presentation_format/mailing_rules and record suffix/catalog traversal from record_ids/catalog_queries directly. Preserve historical generator naming/byte count/native fallback/error behavior and catalog shallow copies; no forwarding utility barrel or new security/uniqueness claim.
- document_readiness orchestrates existing readiness rules through explicit scoped adapters. Preserve initial-citation preparation, every message/action target and delegate/mapping order, correction/family exceptions and helper/feature authority; do not treat it as an effect-free validator.
- document_feedback owns notifications/undo and corrective-detail editing; document_sources owns approved-block selection and frozen source capture. Preserve contextual edit guards, input/focus order, snapshot precedence/cloning, special-format cutoffs and retained court/copy defaults; no new publication or language authority.
- court_scheduling owns court dates/number generation through the existing call-time day/clock/random sources; citation_charges owns charge basis/options/calculations and edits. Preserve calendar/number scan, original policy defaults, units, multi/single-section clearing, retained correction basis and pricing/UI order; extraction adds no numbering/uniqueness or pricing authority.
- The helper owns validation, authority, integrity, atomic publication and immutable original PDF retention. UI validation does not replace it.
- Rendering/pagination consumes explicit facts and frozen issued versions; it does not own persistence or query later live history for reprints.
- Reports consumes verified projections and remains read-only against case history.
- Prefer scoped service dependencies to new global wiring. Break dependency cycles incrementally only when needed; do not recreate a universal registry or repeat a broad module rename.
- A new Python/dynamic browser helper must keep its suite serial: extend execution classification and its tests before moving a launch outside the currently followed static local JavaScript requires.

## Verification and merge review

Before submitting a development PR, run targeted local checks appropriate to the change: formatting and documentation/workflow checks for guidance changes; relevant regression, build, static, boundary or browser checks for application changes. Record the exact commands and outcomes, including failed, skipped and unrun checks. A local full `python3 tools/verify_release.py` run is optional, including for the baseline; use it when diagnosis or the change warrants it.

GitHub's Full gate and PR format must pass on the final current head of the PR being merged into main. For an approved integration batch, this is the combined integration PR; constituent review PRs retain targeted checks and review records, without repeated full-gate runs after each main advance. Review fixes require affected local checks and fresh GitHub verification for the new head. Fast runs are iteration only and never replace the required GitHub gate or release evidence. Keep Chromium/performance work serial and retain every historical assertion and frozen reference. Report actual suite/screen/print counts only from completed runs. Release packaging still requires current passing full-gate evidence for the exact source and runtime.

Record the reviewed SHA, actual outcomes, targeted before/after regression, toolchain/browser and evidence link in the PR. The gate records source commit/clean state when Git exists, a verified-input digest and actual toolchain versions. Extracted source ZIPs can still verify without Git, using content fingerprints; do not invent a source commit for them.

CI checks the PR head, installs frozen dependencies and the pinned Playwright browser, runs the full gate and retains evidence even on failure. The metadata workflow treats titles/body as environment data, not executable shell text. No production credentials are needed for synthetic verification. A passing gate is not proof of absence of every bug, native acceptance or deployment approval. Guarded merge automation is allowed only within explicit owner authorization and must enforce all merge conditions; it cannot supply approval or bypass repository protection.

## Merge policy and approved integration batches

Use [the integration-batch procedure](INTEGRATION-BATCHES.md) to deliver approved, related review PRs together. Keep individual review diffs and targeted checks. Run the complete GitHub gate on the combined integration head after including current main; do not merge every constituent separately or repeatedly re-run its full gate as main advances. Unrelated or independently risky changes stay separate. A direct single-PR merge remains available.

1. Never push directly to main. Deliver changes through a development or integration PR.
2. Before merging into main, require **Full gate** and **PR format** to pass on that PR's exact current head, require current main to be an ancestor of that head, and resolve review conversations. Any code change, conflict resolution or new main integration requires affected local checks and a new full gate on the changed head.
3. Require explicit owner authorization for the delivered scope. A standing authorization may cover a specified PR range and routine fixes within that scope; preparing a review stack or receiving green checks does not itself authorize merging. Guarded automation may execute an authorized merge with an exact-head guard. Never use an admin bypass, direct main push or an unattended merge that omits these conditions.
4. For a batch, record the included PRs, approved head SHAs, dependency closure, baseline main SHA, integration head and gate evidence. Review the complete main-to-batch diff, including integration fixes. Verify the approved source heads remain ancestors of the integration head; do not include unapproved predecessor changes hidden in a stacked branch.
5. After the integration merge, verify the recorded member heads are contained in main. Link and close unchanged constituent PRs as integrated through the batch if GitHub leaves them open; do not merge them again or claim their old checks verified the new main. Keep any member with new, undelivered commits open.
6. The automatic Full gate on the resulting main commit may continue asynchronously. Report its link and pending status without claiming it passed. Investigate failures when reported and fix forward through a new PR; do not rewrite main or use an unverified main run as release evidence.
7. Do not force-push to or delete main. Emergency changes still use a PR and the full gate. Release assignment, packaging, deployment and City/native acceptance require their existing separate authorization.

The owner chose the private free GitHub plan on October 24, 2026, when protection APIs reported that an upgrade or public repository was required. That historical observation does not establish current protection. On October 28, the branch API reports `main.protected: true`; the current integration token cannot read classic protection details (HTTP 403), and the applicable rules endpoint returns no rules. Do not infer that protection is absent, claim its detailed configuration was verified, or weaken it. The integration procedure uses the existing required check names and does not require removing branch protection.

Where server configuration is accessible, require PRs, resolved conversations, **Full gate**, **PR format** and an up-to-date merge candidate; prevent force pushes and deletion. Verify enforcement by reading it back. Server approval requirements remain in force alongside the owner's authorization policy.

## Independent version identities

version.json is authoritative. `tools/version_schema.py` validates actual dates, canonical labels, matching release/helper dates, a positive helper build and positive format versions before build/synchronization. npm identities must still agree.

| Field | Rule |
| --- | --- |
| release | `YYYY-MM-DD Rnn`, actual date and positive assigned release number |
| helperVersion | `YYYY.MM.DD.<helperBuild>` |
| helperBuild | Independent positive integer, advanced for changed published deployment bytes |
| authoringVersion | New authored format only; preserve historical renderer cutoffs and issued versions |
| caseSchema / summaryVersion / backupVersion | Change only their own compatibility contract with reader/migration/parity tests |

R67 with helper build 68 is the current assigned release (R66, build 67, R65, build 66, R64, build 65, and R63, build 64, preceded it; the development label R62, build 63, was never published). New ordinary documents use authoring 16; scoped orders retain 13. Constants such as historical authoring 12/13/14/15/16 are capabilities, not values to globally replace during a release bump. The independently pinned per-family test expectations remain separate from application implementation.

The owner authorized development under `2026-10-23 R62` until a deploy package was requested, then assigned `2026-10-24 R63` (helper 2026.10.24.64, build 64) for the authorized release package, published against the R61 deployment manifest. Assigning and packaging a release does not approve legal wording, deploy it or close City acceptance. The owner subsequently authorized Phase 8 screen-shell/CSS cleanup on October 25, 2026. SCREEN-SHELL.md defines its current-reference contract; approved print styles, historical document references and release trust remain excluded. Development continued under R63 until the owner requested a new package on October 30, 2026 and assigned `2026-10-30 R64` (helper 2026.10.30.65, build 65); R64-REVIEW.md records what it contains. Development continued under R64 until the owner requested another package the same day and assigned `2026-10-30 R65` (helper 2026.10.30.66, build 66, authoring unchanged at 16), published against the R64 deployment manifest; R65-REVIEW.md records what it contains. R65 could not start on an installed PC because a new helper module was missing from its runtime manifest; the owner assigned `2026-10-30 R66` (helper 2026.10.30.67, build 67, authoring unchanged at 16) as the corrected package, published against the R65 deployment manifest; R66-REVIEW.md records the cause and the new guards. R66 was never published; development continued under R66 until the owner requested a package on October 31, 2026 and assigned `2026-10-31 R67` (helper 2026.10.31.68, build 68, authoring unchanged at 16), published against the R66 deployment manifest; R67-REVIEW.md records what it contains.

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
