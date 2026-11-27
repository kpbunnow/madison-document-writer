# Order-language picker: search and grouping (2026-11-10)

Owner direction 2026-11-10, after a review of how inspectors add violation items to an Official Notice. Shipped in R77. Evidence for the screen-reference review entries of the same date.

## Problems found

- An ordinance search was split into digits and letters: `27.04(2)(g)` became the words 27, 04, 2 and g, each matched
  anywhere in the title, wording or guidance, and results kept library order. On the bundled library it returned a mixed
  list in which only 14 entries cited 27.04(2)(g); `27.05(2)(c)` returned 149 entries for 15 that cite it.
- Picker results were one flat run of identical cards with no checklist or group heading.
- Every card carried the same orange "Standard · formal approval not recorded" badge, the loudest thing on screen.
- The ordinance was small grey text; the picker's checklist names were tiny grey capitals.
- Consolidated Order Language (109 entries) repeats much of the four earlier checklists (66 of their 141 entries cite
  exactly the same sections).

## Owner decisions

1. Consolidated Order Language replaces the earlier checklists: list it first; keep the others, labelled as earlier.
2. Keep the current colours; rely on headings.
3. Ordinance searches show exact matches, with related sections behind a "show related" option.
6. Status badges only on the Review catalog screen.

4. An entry can be added more than once on notices, and so on the extensions and citations that carry its items; on a citation each copy is its own charge and deposit and counts toward the repeat-offense tier.
5. Identical copies are only a warning.

Follow-up direction 2026-11-11: show Consolidated Order Language as "Violation Categories" with title-case group
names; remove Earlier checklists from the picker's left-hand list; remove Keep adding (the picker stays open until Done
adding) and Save draft & return to Workspace from the picker. Searches still reach the earlier checklists so language
that exists only there (snow removal, erosion control) can be added.

Decisions 4 and 5 shipped as a separate change: Add again in the picker (not a new control on the printed item rows, whose layout is fixed by the approved print references).

## What changed

- `app/modules/language_search.js` (new): ordinance-aware search. An ordinance in the query (with or without MGO/SPS,
  spaces inside parentheses ignored) matches an entry that cites that section or a narrower part of it; the parent,
  siblings and broader sections are "related". Word terms match word beginnings (single letters ignored), with aliases,
  and are ranked title, then ordinance/checklist names, then wording. 27.04(2)(g) now lists exactly the 14 citing entries;
  14 related entries are folded.
- `app/modules/language_discovery.js`: picker and Browse language results under sticky checklist › group headings, with
  Consolidated first and earlier checklists labelled; equally ranked results list Consolidated first; each entry leads
  with ordinance tags; an earlier entry notes when Consolidated has language for the same ordinance; related sections in
  a closed "Show related sections (n)" fold; status badges and review-provenance lines removed from the picker and Browse
  language (kept on Review catalog); an unavailable entry says so in words.
- `app/assets/ui-refresh.css`: one append-only screen block (headings, tags, notes, fold, picker checklist headings).
  No colour changes; official print styles untouched.

## Verification and evidence

Before and after screenshots were captured from a synthetic draft notice in Chromium (picker opened, a group, the
27.04(2)(g) search, the related fold, a word search and Browse language). The screenshots are kept outside the source
tree. The retained Browse/picker screen references used by `audit_language_presentation_rules.js` were replaced with the
new screens because the owner changed the layout they pinned; behaviour is asserted directly by
`audit_language_search.js` and `audit_language_grouping.js`.

## Picker shortcuts and item defaults (2026-11-13)

Owner direction 2026-11-13 (improvement plan, ease of use 4 and 5). `language_shortcuts.js` keeps Recently used (12)
and Favorites in the browser profile; the picker lists them above the categories when they hold something that can be
shown, and each card has a Favorite star. A new item follows the previous item's location heading (not its due date). After a
fill-in detail is saved, focus moves to the next bubble. `audit_language_shortcuts.js` asserts all of this; the picker
reference was regenerated for the new markup.

## Weights and Measures checklist (2026-11-25)

Owner request 2026-11-25: write Weights and Measures documents under MGO Chapter 22. The supplied chapter export is
retained as `policy/sources/r30-CHAPTER_22___CONSUMER_PROTECTION_AND_WEIGHTS_AND_MEASURES.txt`, with page headers and
footers removed and wrapped lines joined, so `library_ordinances.py` confirms every cited 22.x section against it.

`ENF_WEIGHTS_MEASURES` ("Weights and Measures") is a separate checklist appended after the consolidated catalog. It
holds 23 entries (`WM01`–`WM23`) in eight groups. `language_discovery.js` treats it as a current checklist: it is
browsed after Violation Categories, with title-case group names, and is never labelled as an earlier checklist. Every
entry is new, unreviewed wording, so each is `p: "draft"`, and the catalog manifest marks it `draft: true`. The picker
cannot select it, and the helper refuses to issue it, until a division review is recorded in Review catalog. No owner
approval is implied. Chapter 22 pricing is unchanged: the deposit schedule's 22.21(2) row is still unverified, and the
entries cite the subdivisions 22.21(2)(a)–(f), which have no reviewed pricing mapping.

The retained library is byte-identical. Tests that count it or pin its identity (`audit_r21.js`, `audit_authoring.js`,
`audit_r33_core.py`, `audit_catalog_publication_rules.py`) now exclude the new checklist and keep their exact counts.
`audit_language_grouping.js` now expects both current checklists in the group list. The new checklist is asserted by
`audit_weights_measures.py` (source, sections, drafts, manifest, publication refusal until review) and
`audit_weights_measures.js` (picker and Browse language).

### Owner approval and pricing (2026-11-27)

The owner approved all 23 Weights and Measures entries for selection on 2026-11-27 and approved the charge basis: every
Weights and Measures charge is priced under the MGO 1.08(3)(a) deposit schedule row 22.21(2) ($200 first, $500 second or
subsequent).

- **Library:** entries are `p: "export"`, `status: "Approved for selection"`, `provenance: "owner-approved"` with an
  `approval` note, the same fields the 2026-10-31 owner decision used. The manifest marks them `draft: false`. The
  retained library bytes before the checklist are unchanged.
- **Pricing:** `policy/metadata.json` `itemMappings` holds one `calculated` mapping per entry and cited section
  (30 in all) to `scheduleOrdinance: "22.21(2)"`. The cited section stays the charged ordinance printed on the MC-2000,
  as for the other mapped charges. A Chapter 22 section typed without a library entry is not mapped.
- **Tests:** `audit_weights_measures.py` asserts the approval fields, the manifest and the pricing of every cited
  section; `browser_order_language.js` exercises the 23 entries and keeps the retained library's 242 count exact.
