# Maintenance correction review — November 5, 2026

Reviewed main `e7ef760768a072a045d46e9ad6675b78ec2b440f`, including correction PRs #423–#425 and feature PRs #426–#427. Its GitHub verification passed. This review preserves R73/helper build 74, authoring 16, case schema 5, summary 6 and workspace backup 2. No release package or deployment is authorized here.

## Original findings

| Finding | Correction and review |
| --- | --- |
| MCR-001 | #425 removes only the removed documents' record forms and includes unfinished forms in case risk checks. Case-work-action tests cover other cases' retained work. |
| MCR-002 | #424 verifies case integrity, source revision and projection before showing due dates, and distinguishes unknown from no order. Follow-up includes linked/non-regular case names in coverage so skipping an unsafe file cannot imply no order. No linked case contents are read. |
| MCR-003 | #424 applies checked workflow names and deferred names to exclusions in case requests. Inspector helper tests cover both sources. |
| MCR-004 | #425 captures worksheet/walk ownership before removal and clears the owned state. |
| MCR-005 | #425 restores only import-owned fields, retaining unrelated record forms and walkthrough context. Recovery tests cover persisted and live work. |
| MCR-006 | #424 refuses new ordinary visits after their recording day while retaining historical validation conventions. |
| MCR-007 | #424 permits an empty-deposit mandatory draft only when the actual schedule authorizes it. Ordinary deposits and the mandatory issuance hold remain enforced. |
| MCR-008 | #424 enforces seven-day spacing for new ordinary deadlines while allowing an unchanged historical correction pair. |
| MCR-009 | #423 exempts retained Reinspection Notice dates from new-deadline range checks without removing valid-date/source equality rules. Browser coverage now issues with retained past/today dates. |
| MCR-010 | #425 retains historically cited snow cases for effective-interval as-of calculation after withdrawal. |
| MCR-011 | #425 excludes snow cases closed on filing from repeat-owner open counts. |
| MCR-012 | #425 classifies canonical `document.voided` events as Withdrawn, including filtered export. |
| MCR-013 | #424 verifies source before writes, archives replaced files and rolls back copy failures. Follow-up refuses program-directory links/reparse points before planning, revalidates the supplied plan before applying, protects operational roots without case sensitivity, and refuses reused or conflicting archive destinations. |

The original defects are addressed by those corrections and the follow-up. Exact-head required GitHub checks remain the merge condition; this table does not substitute for their results or native acceptance.

## Additional session-close corrections

The new close-session workflow could repopulate its cleared import entry from the still-visible DOM during `saveDrafts`. It also ignored a false storage acknowledgement and could mark an uncleared durable workspace closed. A composed regression using the actual removal, capture and draft-persistence owners reproduced the import resurrection.

Clearing now performs case removals without intermediate draft writes, prevents stale editing controls from being captured, and persists the final clear once. A refused write restores live cases, documents, events, forms and view context and leaves the prior durable bundle in place. The session is marked closed only after clearing succeeds and its own marker write acknowledges. Startup clearing displays errors in its existing dialog; Exit displays a clear failure on the stopped page. Pending record confirmations, queued shared writes and the outbox remain protected.

Targeted regression coverage includes a successful composed clear, refused persistence with retained work, failed session-marker acknowledgement, target links, a changed deployment plan and an existing archive. Existing tests for recovery, inspector exclusions/verified dues, helper visit/spacing/mandatory drafts, report facts/model/catalog, readiness, record-form cleanup, timeline and desktop exit remain applicable.

## Evidence and limits

Local commands and counts are recorded in the delivery PR; GitHub retains the exact-head gate evidence. The before/after session and deployment regressions use synthetic data and temporary folders. Windows reparse-point behavior uses the established verifier predicate; City Windows/SMB/SQL/Outlook/native printing, staff and legal acceptance remain separate. No historical assertion or approved reference was changed for this follow-up.
