# R54 extension layout review

Development starts from R53 main commit `761e0540abc8a6d2214bca25646b759aa4807f64`.
Identity: 2026-10-20 R54, helper 2026.10.20.55, helperBuild 55, authoring 12.
Case schema 5, summary 6, backup 2, status eligibility and all acceptance holds remain unchanged.
This is reviewable development work; it is not City acceptance or a packaged release.

## Division decisions applied

The division confirmed all five proposed defaults in the development chat:

1. Retain supervisory signer name/title after the items table on both special extensions. This is the explicit exception to layout equality, in addition to title and language.
2. Show only the new due date; retain previous dates in the case record.
3. Conditional vacancy items display “Conditional — see conditions above” without changing stored repair dates.
4. List all items, including unextended and corrected items, with regular Extension ordering, notes and rulings.
5. Use regular Extension CC handling, without a separate Best Interest CC block.

## Rendering and historical boundaries

`noticeHTML` is the shared layout for all three extensions. Authoring-12 Best Interest and Vacancy Extensions bypass the legacy narrative-table transformation. Their existing language paragraphs are reused without the redundant item-reference sentences, contact closing or signer paragraph. The signer moves after the shared table. The longer special titles use 11pt text within the title region to fit on one line; the regular Extension's title and output are unchanged.

The shared pager splits long language into its existing bounded paragraphs only for these authoring-12 special extensions, before continuing through the item table. Continuation headers, row groups and footers use the existing shared furniture. Regular Extensions and historical documents keep their original pagination path. The long-language regression verifies every paragraph remains intact and ordered, in addition to clipping and overflow checks.

The first regression was run against R53 and failed for both special types' missing items tables, two-line titles and missing corrected-item rows. Additional failing checks identified title clipping, render-time authoring downgrades and missing current-visit notes. The implementation addresses each without changing `specialChecks` or approved language.

`R53-extension-rendering.json` was captured twice from the unchanged R53 runtime before implementation, with identical results. It checks regular Extension bytes at authoring versions 1–12 and historical special-extension bytes through version 11, including corrected documents. Date-input min/max limits alone are normalized as day-relative metadata, matching the existing historical print tests. Existing historical references and the approved print stylesheet are unchanged.

The new R54 runtime parity record acknowledges the intentional code changes separately from the retained R51/R50 reference. Its shell still uses the original frozen hash after the already reviewed screen-transition substitution. The 69 authored print variants, court copies and frozen stylesheet remain independently checked.

## Synthetic before and after screenshots

These screenshots use the same synthetic case and item facts. Before images come from the retained R53 runtime; after images come from R54. They are layout evidence, not operational records or legal approval.

| Type | R53 before | R54 after |
| --- | --- | --- |
| Regular Extension | [Before](r54-images/before-extension.png) | [After](r54-images/after-extension.png) |
| Best Interest Extension | [Before](r54-images/before-bestInterestExtension.png) | [After](r54-images/after-bestInterestExtension.png) |
| Vacancy Extension | [Before](r54-images/before-vacancyExtension.png) | [After](r54-images/after-vacancyExtension.png) |

## Verification and remaining acceptance

Run `python3 tools/verify_release.py` with the documented browser selection. Measured Chromium tests run serially, with unchanged 150-second suite deadlines. The R54 tests compare layout outside the title, language and approved signer exception; preserve historical hashes; compare language paragraphs word for word; retain conditional dates; and check real one-page/two-page layouts, identical footers, text clipping, continuation headers, axe and PDF output. Current logs and source-bound results belong under `build/verification/latest` and `build/test-results`.

The staff manual is updated in Markdown, HTML, PDF and DOCX. `R54-ACCEPTANCE-RECORD.md` adds P7 for native side-by-side printing of all three extension types. Native Windows, SQL/SMB, Outlook, printing, accessibility/staff acceptance and existing legal/seasonal holds remain open. No merge, rollout or release packaging is authorized by this review.
