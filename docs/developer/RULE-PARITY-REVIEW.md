# Rule parity and boundary review — 2026-11-23

This review used extra compute to look for hidden defects in the rules where a mistake becomes a legal or record
problem: citation pricing, outstanding deadlines, money values, case integrity and canonical hashing. Everything ran on
synthetic data against main at `bc4eed19635ccdbdb72b89d56b2993c179c40b16`.

## What was run

- **Baseline mutation pilot:** `tools/mutation_pilot.py`. All 46 hand-seeded mutants were detected.
- **Differential fuzzing, browser against helper:**
  - The fuzzer compiles the browser's actual policy owners with esbuild and compares them with the helper's functions
    on random inputs.
  - Pricing was compared on 3,000 to 20,000 cases per function: ordinance spelling, tiers, money parsing, assessments,
    court fees, repeat-offense windows, respondent and site keys, ordinance resolution, and full priced amounts with
    measurements.
  - Due-date rules were compared on 30,000 random notices.
  - RFC 8785 canonical hashing was compared on 30,000 random JSON values.
- **Property testing:** due-date sorting (`orderByDue`) was checked on 200,000 random notices.
- **Tampering:**
  - Each stored field of a saved schema-5 case was changed or deleted (114 single changes), and the helper's verdict
    was compared with the browser's independent verifier.
  - Integrity downgrades were also tested.
- **Generated mutants:** single-operator and boundary changes were made in the helper's `citation_pricing.py` and due
  rules in `case_store.py`, and in the browser's `citation_policy.js` and `deadline_assignment.js`. Each was run
  against its owning suites.

## Defects fixed

| Finding | Effect | Fix |
| --- | --- | --- |
| Ordinance whitespace differed between runtimes. JavaScript's `\s` includes U+FEFF and Python's does not; Python's includes U+0085 and U+001C–U+001F and JavaScript's does not. | A pasted ordinance with one of these characters was priced by one runtime and refused or unpriced by the other. The helper then refused issuance with a confusing message. | Both runtimes remove one explicit, identical whitespace set before matching the prefix and grammar. |
| Python's `\d` matches non-ASCII digits. | The helper read `"1١٠"` as $110 and accepted an ordinance written with Arabic-Indic digits; the browser refused both. | Helper money, ordinance, tier-override, ZIP and catalog-key patterns use `[0-9]`, and the policy grammar is matched with `re.ASCII`. |
| Tier text parsing differed. | `" 2"` and `"+3"` gave tier 2 and 3 in the browser but 1 in the helper, and an Arabic-Indic `"٢"` gave 2 in the helper only. | The helper's `ordinal` now follows JavaScript `parseInt` exactly, with ASCII digits. |
| The helper accepted `NaN`/`Infinity` in request JSON. | A crafted request could price a banded charge at "Infinity", raise an unexpected exception for tree charges, or write `NaN` into a schema-3/4 case file that no browser could then read. Schema-5 hashing already refused them. | Request bodies are parsed with a refusal of non-finite numbers, and case files are written with `allow_nan=False`. |
| The browser's prior-offense window accepted impossible dates such as `2026-13-01`. | The browser could count a malformed prior date that the helper ignores. | `withinWindow` requires a real calendar date, as the helper does. |
| Missing boundary tests. Generated mutants survived at the schedule's own edges:<br>• building tune-up at exactly 100,000 sq ft and 365 days;<br>• recycling at 10% and 20%, tonnage at 1 and 2 tons, parking at $20 and $50;<br>• whole-inch and removed-tree rules;<br>• season start and month-end repeat windows;<br>• a ten-character tier-override source;<br>• parcel-less site matching;<br>• respondent keys;<br>• the half-cent assessment rounding of 1% jail above its minimum;<br>• deadline counts excluding corrected and withdrawn items;<br>• spacing scope;<br>• conflict detail and stable due-date sorting. | A future edit could change who is charged what, or which earlier citation counts, without any test failing. | The new boundary tests and parity checks below pin each edge to the schedule row's own text (for example "100,000 Square Feet or More", "365 days", "1% to 10%"). |

All fixes were confirmed against the old code: the new tests fail on `bc4eed1` and pass after the change. A rerun of the
differential fuzzer shows no remaining disagreement except invalid dates, which both runtimes refuse.

## Results after the change

| Check | Result |
| --- | --- |
| Pricing differential fuzz (20,000 per function) | Ordinance, tier, money, assessment, window, respondent, defendant and site results all agree. The remaining differences are invalid dates that both runtimes refuse with different messages. |
| Due-date rule differential (30,000 notices) | 0 disagreements |
| Canonical hash differential (30,000 values) | 0 disagreements. Lone surrogates are refused by both, and integers outside ±2^53 are refused by the helper with a 400. |
| Tampering (114 field changes, plus downgrades) | Every change is detected, except an unknown extra key inside `integrity` (see below). |
| Generated mutants, helper pricing | 121 in the full suite run, 94 detected. The survivors led to `audit_pricing_boundaries.py`. A recheck against a faster subset of suites shows the rest are equivalent or already caught by the full run. |
| Generated mutants, helper due and money rules | 26 of 26 detected |
| Generated mutants, browser pricing | 88 of 92 detected; the 4 survivors are equivalent |
| Generated mutants, browser due helpers | 13 of 15 detected (3 by timeout); the 2 survivors are equivalent |

The equivalent survivors are:
- **Band minimum:** `>` and `>=` on a band minimum that the previous inclusive band already covers.
- **Missing address key:** `||` and `&&` when one address has no key, where the raw strings then necessarily differ.
- **String type test:** a type test before a regex that already rejects non-strings.
- **Non-finite measurement:** the `typeof`/`isFinite` pair for a measurement no band accepts.
- **Spacing loop bound:** an out-of-range spacing loop bound that compares with `NaN`.
- **Sort comparator:** a comparator change that V8 does not observe at these sizes.

## Not changed, for an owner or City decision

- **Schedule band gaps.** These come from the transcribed schedule, not the code. For each one the program fails safe:
  it asks for an approved manual basis.
  - Unpaid parking fee: the source reads "$0-20, $20.05-50.00, $50.05 or more", so $20.01–$20.04 and $50.01–$50.04 have
    no amount.
  - Recycling shortfall:
    - the source reads "$250, 1% to 10% / $500, 11% to 20% / $1,000, > 21%";
    - the rule treats anything above 10% as $500 and above 20% as $1,000;
    - below 1% has no amount.
  - Whether these readings are right is a policy question for the division and City Attorney.
- **Browser-only downgrade check.** The browser's own verifier accepts a record whose integrity block was stripped, when
  the record has no modern markers. The helper detects it from its folder registry, and the browser uses the helper's
  verdict whenever it has one. This is the designed authority split.
- **Unknown keys inside the stored `integrity` block are ignored.** They do not change any verified content. Rejecting
  them would need an audit of every integrity shape ever written, so it is left for a separate, reviewed change.
- **Citation review hint.** It formerly said "four matching court copies". It already counts the actual copies on main (PR #544).

The fuzzers and mutant generators used for this review are not part of the gate. The permanent tests listed above are.
