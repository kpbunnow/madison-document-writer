# R54 Development Prompt — Align Best Interest and Vacancy Extensions with the Regular Extension

Oct 20, 2026 · @Kyle

## How to use this prompt

Paste everything below this section into the implementing agent with the complete R53 package. It is self-contained. The decisions at the end have proposed defaults; the division confirms or changes them before the build.

## Role and context

You are maintaining the Madison Building Inspection Document Writer. Produce release R54 from R53 (release 2026-10-19 R53, helper 2026.10.19.54, helperBuild 54, authoring 11, case schema 5, summary 6, backup 2).

During City testing, the regular **Extension** document formats and displays correctly. **Best Interest Extension** and **Vacancy Extension** do not match it. All three must share one layout; the only intended difference is the language section.

Read first: `docs/developer/00-START-HERE.md`, `01-ARCHITECTURE.md`, `03-DOMAIN-RULES.md`, `04-PITFALLS.md`; `app/modules/new_documents.js` (`specialBody`, `selected`, `specialChecks`), `app/modules/app_core.js` (`docBody` and the body selection at line \~744, `activeBlocks`), `app/modules/inspection_import.js` (`noticeHTML`, the item table), `app/modules/document_pagination.js` (`paginate`, continuation headers, page footer).

Non-negotiable constraints:

1. **Issued documents reprint byte-identical.** Bump `authoringVersion` to 12. Only authoring-12 Best Interest and Vacancy Extensions use the aligned layout; authoring 11 and earlier keep their current rendering, including corrections of them.
2. **The regular Extension does not change at all**, at any authoring version. It is the reference.
3. **No wording changes** inside the language sections: the existing Best Interest and Vacancy text, including every condition, reason and clause, is moved, not rewritten.
4. Preserve the R53 status rules (Extension Processing offers all three types), the R52 manifest model and all security controls.
5. Each change starts with a failing test; every suite finishes in under 150 seconds; the full gate and Chromium audit pass before packaging.

## What is wrong today (from the R53 Chromium evidence)

The Best Interest and Vacancy Extensions are rendered through `specialBody` in `new_documents.js` as plain paragraphs, not through the regular Extension's layout:

| Area | Regular Extension (correct) | Best Interest and Vacancy Extension (today) |
| --- | --- | --- |
| Title | One line: red “EXTENSION -” followed by “BUILDING INSPECTION OFFICIAL NOTICE” | Two lines: red type name, then “BUILDING INSPECTION OFFICIAL NOTICE” below it |
| Items | Items table: Item No., Violation Section No., Abate, Corrections Required, Due Date; inspector notes as callouts; corrected items ruled through with the date confirmed; continuation across pages | Sentences: “Affected item references: 1.” then “Item 1 — … Previous deadline: …; extended deadline: …”; no table, notes, abate column or ruled-through corrected items |
| Footer | The standard page footer behavior | Differs: Vacancy shows a case-number/page footer only because its text spills to a second page; Best Interest shows none |
| Closing | Ends after the items table | Adds a “For questions, contact …” line, a signer name and title block, and (Best Interest) its own CC block |

## Required layout for all three types (authoring 12)

Top to bottom, Best Interest and Vacancy Extensions must render exactly like the regular Extension:

1. **Header block:** the same one-line title style, with the type name in red followed by “- BUILDING INSPECTION OFFICIAL NOTICE”: “EXTENSION -”, “BEST INTEREST EXTENSION -”, “VACANCY EXTENSION -”. Then the same case number, property, inspection date and time, mailed date and inspector block, and the same recipient address block.
2. **Language section (the only part that differs):** the text between the inspector block and the items table.
   - *Extension:* unchanged.
   - *Best Interest Extension:* the existing best-interest reasons and statements now in `specialBody`.
   - *Vacancy Extension:* the existing vacancy paragraphs now in `specialBody` (request reviewed, building must remain secure, exterior maintenance, scheduled review inspection, expiry, contact and approval requirements, further-extension and transfer clauses, approved conditions, security and No Occupancy statement).

   Remove the “Affected item references: …” line and the per-item “Item N — … Previous deadline …” sentences; the items table replaces them.
3. **Items table:** the regular Extension's table, built by the same code: the same columns, sort order and location headings, the same inspector-note callouts, the same ruling-through of corrected items with the date confirmed, the same “Items already corrected are listed below ruled through” note, the same continuation behavior across pages. The Due Date column shows each item's new (extended) due date; items not extended show their existing due date.
4. **Closing and footer:** identical to the regular Extension. Use the same footer markup and pagination code, so every page footer (case number, page numbering, email-copy line when emailed) is the same for all three types and does not depend on which type is used. Remove the type-specific “For questions” line, signer block and CC block unless decisions 1 or 5 below keep them.
5. **Furniture blocks:** whatever blocks the regular Extension carries (for example language access), all three carry the same.

Implement this as one shared extension renderer with a language-section function per type, not as three copies of the layout, so they cannot drift again. Keep `specialChecks` validations (required approvals, references, conditions) unchanged, since they apply to the data, not the layout.

## Acceptance

- [ ] For the same case and items, the three types' authoring-12 HTML is identical everywhere except the title's type name and the language section. Write a test that removes those two regions and asserts byte equality across the three.
- [ ] Best Interest and Vacancy show the items table with Abate, inspector notes, ruled-through corrected items and extended due dates, exactly as the regular Extension does for the same items.
- [ ] Every Best Interest and Vacancy sentence present today still appears, word for word, in its language section; none appears elsewhere on the page.
- [ ] Footers are identical across the three types for one-page and multi-page documents (force a two-page document for each type in the Chromium audit and compare footers).
- [ ] The regular Extension's output is byte-identical to R53 at every authoring version.
- [ ] Authoring-11 Best Interest and Vacancy Extensions reprint byte-identical to R53, including a correction of one.
- [ ] The Chromium audit renders all three types on one-page and multi-page fixtures with no overflow, clipping or blank pages, and the axe audit passes.

## Decisions for the division

| # | Question | Proposed default |
| --- | --- | --- |
| 1 | The Best Interest and Vacancy Extensions currently end with a signer name and title (for example “Director of Building Inspection”). The regular Extension has no signer block. Keep it? | Keep it, placed after the items table in the same position on both, because these extensions record a supervisory approval |
| 2 | Should the table show each item's **previous** deadline as well as the extended one? The regular Extension shows only the due date. | No: show only the new due date, matching the regular Extension; the previous deadline stays in the case record |
| 3 | A Vacancy Extension in **conditional** mode has no replacement repair date. What should the Due Date column show for those items? | “Conditional — see conditions above” |
| 4 | Which items appear: all items on the case (as the regular Extension lists them, with corrected items ruled through), or only the items being extended? | All items, exactly as the regular Extension lists them; items not extended keep their existing due date |
| 5 | Keep the Best Interest Extension's own CC block, or handle CC recipients the way the regular Extension does? | Handle CC the same way as the regular Extension |

## Release gate and deliverables

- [ ] `R54-REVIEW.md` with before-and-after screenshots of all three types and the decisions as applied.
- [ ] Updated manual (extension documents section) and an acceptance-record item to review all three types printed side by side.
- [ ] Version with helperBuild 55, byte-parity fixture updated with the acknowledged change, full gate and Chromium audit passing, deploy rechecked against its manifest.

**Out of scope:** extension wording, eligibility rules, the R53 status rules and any change to issued snapshots.
