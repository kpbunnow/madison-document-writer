# Editor preview reuse

The Workspace row reuse (WORKSPACE-ROW-REUSE.md) extends to the screen with the heaviest repaint: the document editor. A diagnostic profile of a 60-item Official Notice draft found each sheet refresh and each full editor render spent about 95 ms re-paginating an unchanged document. The R80 reuse in `preview_refresh.js` existed but never hit, because it compared the painted desk's exact markup and two screen passes rewrite it after every paint: open-check highlighting (`check-open`, `data-open-check`, `aria-invalid`, `aria-describedby`, `data-check-desc`) and the shared accessibility pass (`role`, `aria-label`, `aria-multiline`, `tabindex`, a screen-reader table caption and header-cell `scope`), plus `data-editor-extra-copy` for compact citation copies.

## Change

- `preview_refresh.js` compares a decoration-free snapshot: exactly those screen-only attributes, class tokens and the inserted `sr-only` caption are removed from both sides. Document-HTML changes, identity (document, type, authoring version), layout and font changes, live text edits, structural changes and every other attribute still invalidate.
- A full editor repaint builds a new, unpaginated desk. `paintEditorPreview` (editor owner) puts the previous paginated desk back only when it is detached, was painted from the same identity and document HTML, the layout matches and its decoration-free content is unchanged; otherwise it paginates the new desk in place, as before, without resetting its content (the repaint's live editing node and focus stay), and records it so the next refresh can reuse it.
- Print jobs never use either path; document print, PDF and historical print paginate independently as before.

## Matched measurement

Diagnostic only (not gate or release evidence; no City/Windows claim): `node tools/profile_editor_repaint.cjs <before.html> <after.html> <output.json>`, production builds of main adc1e9e and this change, Chromium 141.0.7390.37, four alternating paired rounds. Every round's document HTML, model, page count and printed page text matched.

| Workload (60-item notice) | Median total before → after | Per step | Reduction |
| --- | ---: | ---: | ---: |
| 60 sheet refreshes (10 with edits) | 6436 → 1879 ms | 107 → 31 ms | 71% |
| 30 full renders (5 with edits) | 3147 → 1875 ms | 105 → 62 ms | 40% |
| 30 keep-renders (5 with edits) | 3173 → 2400 ms | 106 → 80 ms | 24% |
| Paginations per round | 120 → 20 | | |

Runtime SHA-256: before `6c8178b45ef5389cdf4801c27246a6910e8e814d674a64dfffbb88e2770602ab`, after `9eeda273c509fffcb8e9d9b0080f0ea52b4928cc2ca05fb6a73d0ceb6391ec20`; harness `c9fe5e77bb86104589f249a15cdf48861f3368f7c319e33fa82933ffbcebd9ae`. Paginations fall to one per real edit. Remaining full-render time is the screen markup, readiness checks and accessibility passes, which still run on every render.
