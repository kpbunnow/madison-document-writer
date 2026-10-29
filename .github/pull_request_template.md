## Problem and resulting behavior

<!-- Explain the trigger, before/after behavior and linked issue. -->

## Scope and rule ownership

<!-- Name the frontend/helper/report/documentation rules and their tests.
     Explain historical rendering, storage or authority changes, if applicable. -->

## Version decision

<!-- No identity change, or the owner-approved release/helper identity.
     Explain authoring/schema/summary/backup changes independently.
     Preserve stored identities and historical renderer cutoffs. -->

## Verification

- Reviewed head: <!-- Full commit SHA; update after review fixes. -->
- Targeted local checks: <!-- Commands and actual outcomes; include failures, skips and unrun checks. -->
- Delivery path: <!-- Direct PR, constituent review PR, or integration PR. For a batch, link every member and its approved head SHA, record baseline main and integration head, and explain dependency closure/integration fixes. -->
- GitHub full gate: <!-- Pending or actual result for the exact direct/integration head merged into main, with run/artifact link. A constituent may link its delivery batch; do not claim the batch gate passed on a different SHA. Local full gate is optional. -->
- Toolchain: <!-- Node, Python, Chromium and any supported fallback. -->
- Coverage: <!-- Counts from completed runs only; explain changes. -->
- Regression: <!-- What failed before and passes now; keep historical assertions. -->

## Acceptance and readiness

<!-- Identify open City/native/staff/legal items and decisions required.
     State ready or blocked, naming the actual blocker. Post-merge main verification may
     continue asynchronously; report its pending run link and investigate failures when reported.
     Guarded merging requires explicit owner authorization for the delivered scope.
     Close unchanged constituent PRs only after verifying their heads are contained in merged main.
     Merge is not deployment. -->
