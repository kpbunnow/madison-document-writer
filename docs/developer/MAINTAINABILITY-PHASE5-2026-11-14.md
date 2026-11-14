# Phase 5 — rule ownership, parity and compatibility

This phase follows the review of #522 and #523 at `7b472d7`. Those PRs changed tests and documentation, not production rules. Review fix [#524](https://github.com/kpbunnow/madison-document-writer/pull/524) requires normal process outcomes and valid syntax before a migration mutant can count as killed, and refuses inherited object names as unbound test services. Its eight original mutation scenarios still fail for their intended regressions. Full gate, PR format, CodeQL and Windows passed before normal merge (`f078911`).

## Rule ownership

[policy-compatibility.json](../../tools/policy-compatibility.json) is the machine-checked inventory: seven rule families, actual browser/helper owners, real consumers, preserved variants and required parity/compatibility suites. `audit_policy_inventory.py` rejects missing owners/suites, duplicate rules and an unreviewed identity change. It checks references, not semantic correctness. The listed behavioral suites are discovered by the ordinary full gate; the inventory does not replace them.

| Family | Authority and independent validation | Behavioral evidence |
| --- | --- | --- |
| Parcel/site identity | City twelve ASCII digits; shared browser owner, existing helper pure leaf | Actual JS/helper Unicode, whitespace and site comparisons; full reporting corpus |
| Owner mailing | Approved derived-address rules and frozen facts; browser/helper independently normalize | BOM/JS-whitespace, repeated street/PO Box/unit boundaries; current and legacy authoring/address suites |
| Calendar | City civil day, not truncated UTC; shared constants compiled to existing helper policy | DST boundaries, year rollover, leap dates and actual mailing messages/limits |
| New due spacing | Seven days between distinct new ordinary dates; helper publication validation | 400 deterministic cases plus unchanged correction pair and changed-pair refusal; authoring/extensions suites |
| Citation pricing | Approved dated schedule/assessment inputs; helper recalculates | Every schedule entry at three dates across three tiers, exact cents and mandatory flags, historical/violator suites |
| Reporting projection | Browser summary and independent helper replay | Existing 6,000-case canonical JSON corpus and captured Writer flows, projection phase oracle, report facts |
| Recovery | Browser restore and helper storage are complementary security boundaries | Envelope/identity parity plus full browser shape/history/rollback, workspace-backup and integrity suites |

The new parity bridge bundles actual browser modules without startup, DOM, runtime hooks or test exports. Python invokes actual helper owners. Neither result is copied into a reference table. The pricing assertion derives expected eligibility from the helper and requires the browser to match, rather than silently accepting missing priced rows. Existing generated inputs/provenance remain unchanged. No new generated shared policy or dependency was needed.

## Confirmed production defects and consolidation

1. Helper pricing's `\d` accepted full-width/Arabic parcel digits that the browser rejects. It now imports the existing projection leaf's ASCII normalization. `case_projection.norm_parcel` and `citation_pricing.normalized_parcel` remain available as imported aliases. The browser pricing duplicate imports `shared.normParcel`. The leaf was already deployed; no new runtime manifest surface was added.
2. Helper owner mailing used Python's whitespace and word/digit semantics while the browser used JavaScript's. In particular, a BOM-prefixed street line followed by its ordinary duplicate survived helper cleanup. The helper now uses the already-defined JS whitespace set and ASCII street/unit boundaries. Frozen owner mailing/copy validation also uses JS trimming and whitespace keys, so it accepts the actual browser-derived owner name/address lines, including BOM and Python-only whitespace boundaries; missing-line tampering remains rejected. Raw addresses and issued facts remain unchanged. `preserve_numbered_units=False` still selects the historical unit behavior.
3. Both production profilers now share argument/page validation, page digests and the same before/after HTTP routes in `profile_support.cjs`. Their workloads, rounds, alternation, assertions and serial browser execution are unchanged. Both receipts capture the entry harness and shared helper digests before workloads and refuse source changes before writing results. This is diagnostic integrity, not release evidence.

## Duplication measurement and dispositions

Reproduce from a stable checkout with the frozen runtime:

```bash
python tools/measure_duplication.py --out /outside/checkout/clones.json
```

The tool scans explicit maintained JS/Python paths under app modules/shared, helper, tools and policy. It preserves identifiers, literals and Python indentation/logical newlines; ignores comments and spacing; verifies rolling-hash matches with actual tokens; records every source hash, toolchain, thresholds and source-state receipt; and refuses source changes during measurement. Default threshold: **80 tokens and 8 lines**. Cross-language matching, generated/vendor files, frozen references, test scenarios, CSS/HTML/SQL and semantic or renamed clones are excluded. This is a candidate inventory, not a global duplication percentage. Overlapping candidates are not summed.

Comparable working-tree measurements with Python 3.14.10, Node 24.19.0 and pinned Acorn:

| Measurement | Files | Tokens | Candidates |
| --- | ---: | ---: | ---: |
| Before runtime/profiler consolidation | 256 | 428,636 | 3 |
| After consolidation and diagnostic tool refactor | 257 | 428,797 | 1 |

The extra file is the shared profiler helper. Counts include diagnostic tools, whose implementation changed between measurements; this is not a controlled application-performance benchmark. Exact receipts are stored outside the checkout under `/workspace/scratch/work/phase5-2026-11-14/`. They truthfully record a dirty tree and input digests. No speed or maintainability-score claim follows from these counts.

Every detected baseline candidate is recorded by token-content SHA-256 in the JSON inventory. Two profiler clones (135 and 125 tokens) were consolidated. The remaining 97-token case/index write-refusal clone is deliberately retained: the callers have different permission return shapes, committed-revision proof, error reporting and write authorities. Combining these coordinators merely to reduce the count would add integrity risk. Two small same-runtime parcel copies below the threshold were found by rule review and consolidated. Cross-language validators and frozen historical test implementations are intentional; they were not counted as removable debt.

## Compatibility decisions

All independently versioned identities remain unchanged: R82/build 83, authoring 16, scoped-order authoring 13, case schema 5, summary 6, workspace backup 2. Draft recovery remains envelope 1. `version.json` is still the release source; the inventory requires an explicit review when it changes.

| Boundary | Retained behavior and verification |
| --- | --- |
| Issued documents | Immutable facts, frozen wording/mailing/pricing and source-format corrections retained. Authoring/address/pricing oracle suites and full historical print compatibility remain required. No issued records are migrated or repriced. |
| Authoring versions | Existing historical dispatch remains untouched (including pre/current numbered-unit mailing, citation versions and scoped/extension variants); `audit_authoring.*`, `audit_r31_address.*`, `audit_r32_pricing.*`, `audit_r34.*`, extensions and full print compatibility check them. |
| Case schemas | Legacy 2/3/4 readers remain; schema 5 writes require helper integrity, committed revision and current head. Existing integrity/backup suites remain mandatory. No direct-folder fallback was expanded. |
| Reporting Index | Current summary 6 only; stale summaries rebuilt from validated records. Full projection corpus/captures and `audit_report_facts` remain mandatory. |
| Workspace backup vs recovery | Workspace backup reader retains 1/2; draft envelope stays 1. Restore identity, references, conflicting history, unrelated work and rollback checks remain independent from helper envelope/deposit validation. |
| Mandatory appearance | Intentionally empty mandatory drafts may be saved, but issuance stays held pending approved legal instructions. A wrong ordinance/mandatory flag is rejected. No legal text changed. |
| Dates/history | Ordinary new-date spacing is enforced; unchanged corrections and retained historical/read-only outstanding dates are not rewritten. No observation or issuance dates are inferred. |

The Unicode correction narrows new computed parcel acceptance to the existing browser contract. It does not authorize applying current pricing/normalization to old issued snapshots. GIS transport's separate normalizer is intentionally retained. Domain rules and their approved exceptions remain authoritative in [03-DOMAIN-RULES.md](03-DOMAIN-RULES.md).

## Verification and limits

Targeted parity, compatibility, profiler, lexical-tool and report checks are recorded in the PR alongside exact-head required GitHub checks. Five additional syntax-valid hand-seeded mutations exercise Unicode parcel acceptance, BOM mailing cleanup, frozen-owner trimming, browser mandatory flag and recovery version drift. Each must fail the real parity suite after a passing unmutated baseline; abnormal/invalid outcomes are not success. The Python mutation pilot now also classifies signal termination or spawn failure as invalid, with explicit timeout/survivor/restoration regressions. This is targeted failure-detection evidence, not a global mutation score.

The first final-head CI attempt caught two integration omissions: diagnostic toolchain subprocess calls lacked explicit UTF-8 decoding, and the module-boundary inventory did not yet declare the intentional citation-policy import of the existing shared parcel owner. The calls now specify UTF-8; the exact reviewed dependency edge is recorded without changing the boundary assertions. Its standalone check reports no cycles or UI/startup dependency. Both original failing guards pass locally; the complete exact-head gate must run again.

Full CI retains all existing assertions, frozen references, historical print variants, measured browser serialization, integrity and Windows recovery requirements. No fast-mode evidence approves merge. No release was packaged or deployed. Synthetic/Linux automation supplies no City/native hardware, Outlook, SMB, legal or accessibility acceptance. Broader coverage, checked-JS adoption, complexity and usability work in later plan phases remains separate; Phase 5 is not a claim of a 90-point score.
