# R74 Round 11 findings review

Reviewed the supplied `r74-round-11-findings-2026-11-05.md` against main `10739019e6e1f3aa926661d0fae25970fcf23320` and the subsequent authorized performance work. The document supplies findings to validate; its proposed repairs are not automatically accepted as development instructions.

## Build and helper startup

The reported blocker does **not** reproduce on the supported toolchain. Python **3.14** permits multiple unparenthesized exception types when there is no `as` binding (PEP 758). The reported `except ValueError, TypeError:` syntax is valid under the owner-required Python minimum. Its SyntaxError is consistent with an older interpreter; the supplied report does not identify its Python version.

All 176 tracked Python files at the reviewed baseline compiled under pinned **Python 3.14.10**, including the cited exception syntax. Production builds and the exact-main Full gate passed, and the real helper started in production Chromium startup/Exit checks. The existing Python-3.14 AST comparison for the Ruff upgrade also found no semantic change in the formatted Python files.

Do not revert valid Python-3.14 syntax or weaken the Python requirement to satisfy an unsupported development interpreter. Use the frozen Python-3.14 environment documented in CLOUD-DEVELOPMENT.md; City PCs need the separately recorded PY-1 acceptance, 64-bit Python and retargeted shortcuts. This work assigns, packages and deploys no release.

## Confirmed corrections

### Exit promises contradicted workspace clearing

The dialog promised that device drafts would stay, while confirmed Exit clears them. Related conflict/unsaved-work guidance and the successful stopped-page message carried the same obsolete promise.

The correction changes presentation only:

- The dialog explains clearing after the helper stops and directs inspectors to save or download a workspace backup before confirming removal.
- Conflict and local-only change guidance directs preservation before Exit rather than promising work will survive it.
- The acknowledgment refers to unresolved work and the clearing warning; both acknowledgment and unfinished-work clearing confirmation remain required in their original conditions.
- The stopped page distinguishes complete clearing, cases retained for pending save confirmation, and a failed clear whose work was kept. Queued saves/PDFs retain their original wording and behavior.
- Network-uncertain shutdown and another-window stop paths still describe retained work, because those paths do not clear this window's workspace.

Shutdown requests, refusal, lock ownership, confirmation, recovery, clear/rollback, queue retention and shared records are unchanged. Tests retain all 12,000 review and 3,000 request scenarios/effect-order assertions. Their expected copy is deliberately adapted at three named text boundaries without editing retained reference files. Production Chromium checks the clear warning and successful stopped message; an additional device-write-refusal scenario checks truthful failure reporting and restored case/document identities.

### Staff instructions contained an obsolete installation identity

The daily-start paragraph still instructed staff to confirm R63/helper64, although the manual header is R74/helper75. It now refers to the current identity printed at the beginning of the manual, avoiding another stale hardcoded version. Restart guidance also distinguishes retained work from work removed by confirmed clearing. HTML, Word and tagged PDF editions are regenerated together; release and format identities remain unchanged.

## Other supplied observations

| Observation | Current assessment |
| --- | --- |
| PO Box copies and Violators | Supported. Closing Recipients standardizes ordinary entries through `standardMailingAddress`; the production browser checks `p.o. box 123` becomes `PO BOX 123`. Registered agents remain street-only by design. |
| `ccLines` raw fallback | Present as retained formatting. New recipient entry is standardized before closing; parser-accepted and frozen historical lines retain their accepted text. No global renderer change is made that could rewrite an issued reprint. |
| Citation level dropdown/source requirements | Present in browser/helper; Automatic clears the override and source. Pricing holds and issued/correction provenance remain. |
| Draft discard recipients / worksheet unavailable reasons | The described corrections are present; no new defect confirmed. |
| Import review modal / Exit keeping typed number | Present. Confirm remains explicit, busy/blocker guards remain, and Exit cancels/clears the retrieved review without deleting the typed lookup number. |
| Workspace clearing and rollback | Present and unchanged. Failed final device saving restores work; pending confirmations and queued operations are retained under their existing rules. |
| Due dates / exclusions / seven-day spacing / past-due Reinspection Notices | The described rules and corrections remain, including independent verified-case/projection authority and unchanged assigned Notice dates. |
| Historical snow counts / repeat-owner open count / Withdrawn timeline / import-only recovery | The described fixes remain; report-fact and retained projection checks continue to cover them. |
| Deployment target link check | Current CLI uses `args.target.absolute()`, preserving the supplied final component for the link/reparse check. It does not resolve that target before checking. Pre-write verification, operational-root protection and rollback remain; actual City-share acceptance is separate. |
| No-Chrome PDF message / unavailable Correct-Withdraw reasons | Present in current source and existing automated coverage. No new defect confirmed. |
| Correction reason counter | The 1,000-character limit and readiness validation exist. A visible counter is an optional presentation feature, not evidence that the limit is unenforced. |
| Number-key shortcuts missing | Not current: `reinspection_events.js` maps 1–4 to outcomes in One item at a time and excludes editable targets/modifier/repeat events. Existing walkthrough/shortcut suites cover these paths. |
| OCL-7 spec/code discrepancy | Current acceptance wording explicitly requires canceling the running lookup when another case is selected. The current behavior follows that decision. |
| Stale “nothing new” toast / lingering review | Not reproduced as a current defect. “Nothing new” exists as a shared-file merge message; current selection/lookup guards and import-review clearing were inspected. The report itself records no live reproduction. No speculative behavior change is introduced. |

## Verification and acceptance boundaries

The Workspace performance change is delivered in PR #450 with passing exact-head and post-merge Full/CodeQL/native checks. Reports/open-case performance is a separate focused PR, #451; it preserves every case read and proof and strengthens measured summary-read expectations. This Exit/manual correction is reviewed and gated separately after the performance delivery, with its final exact head recorded in the PR.

Current release/helper identities and all independently versioned stored formats remain unchanged. Approved legal wording, issued history, historical print and retained reference files are untouched. The deliberate presentation/test-contract changes above are listed in the correction PR; frozen fixtures and expected hashes are not edited.

Automated cloud/native-CI checks do not close PO-1, LVL-1, OCL-18, CLR-1/2, S74-1, PY-1, SQL-2 or other real City/staff/legal/Outlook/hardware acceptance items. Those remain with their actual acceptance owners.
