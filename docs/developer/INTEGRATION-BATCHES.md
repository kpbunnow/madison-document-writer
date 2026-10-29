# Approved integration batches

Use a combined integration PR to deliver approved, related changes without repeating a full gate and main integration for every small review PR. Keep focused constituent PRs for review and targeted local checks. The exact combined head that will enter main must pass the complete GitHub Full gate and PR format checks. A direct single-PR merge follows the same exact-head requirement.

## Select and record the batch

Group changes by shared behavior, dependency order and manageable review, failure diagnosis and rollback scope. Do not batch unrelated changes merely to fill a quota. For example, approved Reports export builders, workbook metadata and report presentation can form three batches instead of twenty serial merges. This is an example of grouping, not approval of any pending PR.

Create `integration/<short-slug>` from current main. Record the following in its PR description:

- Baseline main SHA and the integration head SHA.
- Each member PR link, approved source head SHA and authorization scope.
- All unmerged predecessor dependencies included by stacked heads; no unapproved changes may enter implicitly.
- Integration fixes and conflicts resolved, with their affected checks and review outcome.
- Targeted check commands/results and exact-head Full gate/PR format run links and evidence.

Use ordinary merges of the recorded source heads in dependency order, retaining their ancestry. A later stacked head may already contain earlier members; record all of them without reapplying their changes. Do not silently cherry-pick, rebase, drop commits or substitute a different head for the approved one. A changed delivery scope needs the required owner authorization; an existing authorization may cover routine fixes within its defined scope.

## Assemble, review and verify

1. Review the complete diff from baseline main to the integration head. Confirm it contains all and only the approved scope, including every predecessor and integration fix. Small constituent diffs do not replace combined review.
2. Check that every recorded member head is an ancestor of the integration head, for example with `git merge-base --is-ancestor <member-head> <integration-head>`. An ancestry check proves containment, not correctness; review the combined tree for omissions or changes introduced by integration.
3. Run affected targeted checks during assembly. Preserve all existing assertions, frozen references, deadlines, policy, stored identities and print behavior. Local full verification remains optional for development; release evidence requirements are unchanged.
4. Include current main once for the batch. Require GitHub Full gate and PR format on the final combined head, with resolved conversations and the required owner authorization. If main or any source changes before merge, integrate and review the changes, run affected local checks, then obtain a fresh full gate for the new head. Never reuse evidence from an earlier SHA.
5. A constituent's earlier full gate need not be rerun separately after each main advance. Existing CI still runs on PRs; no workflow check is skipped or disabled by this policy. Investigate constituent failures. If a fix in the combined source supersedes a failed or stale member run, explain the cause and fix and require the combined full gate; do not label the failed member head as passing.

If the combined gate fails, inspect its artifacts and isolate the failing interaction or change. Fix within the authorized scope or split the batch, repeat affected local checks and run the full gate again on the resulting head. Do not weaken checks to keep the batch moving.

## Merge and reconcile

Immediately before merging, recheck the head SHA, current-main ancestry, latest required check results, resolved conversations and authorization. Use an exact-head merge guard such as `gh pr merge <integration-pr> --merge --match-head-commit <tested-head>`. Guarded automation is allowed only when it enforces these conditions within the owner's explicit authorization. Never use an admin bypass, direct main push or force push.

GitHub normally creates a new merge commit, so its SHA differs from the tested PR head. Confirm the merged tree matches the reviewed integration tree, and verify the recorded member heads are ancestors of main. Do not present PR-head evidence as a completed run on that new main commit.

Link the merged integration PR from unchanged constituent review records. If GitHub leaves them open, close them as integrated through the batch only after checking their current heads still match the manifest and are contained in main. Do not merge the constituents again. A constituent with newer, undelivered commits stays open. Preserve feature branches while other queued PRs depend on them; update remaining review bases without dropping source changes.

The automatic full gate on the resulting main commit may run asynchronously. Report its link and pending status, investigate failures when reported and fix forward through another PR. Never rewrite main. Release packaging still requires passing full-gate evidence for its exact source/runtime; merge does not assign a release or authorize packaging, deployment or City/native acceptance.

## Existing GitHub protection

Keep existing required checks and branch protection. An integration PR runs the same Full gate and PR format as a direct PR, so this procedure does not require weaker server rules. Where protection settings cannot be inspected, report that limitation; do not claim enforcement was verified or work around a server refusal. DEVELOPMENT-STANDARD.md records the current observed protection status.
