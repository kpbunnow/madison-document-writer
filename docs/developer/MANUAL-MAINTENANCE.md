# Maintaining the program manual

`docs/staff/PROGRAM-MANUAL.md` is the one source for the staff manual and the nine quick guides. When the program
changes, update the manual in the same pull request as the change. The edition builder, the guide generator and the
gate refuse an out-of-date edition.

## What the manual is made of

| File | Role |
| --- | --- |
| `docs/staff/PROGRAM-MANUAL.md` | The text. Its 22 numbered chapters (`## N Title`) are fixed anchors (`#chapter-N`). `<!-- guide:…:start/end -->` markers feed the quick guides. |
| `docs/staff/manual-style.css` | Screen and print style of the HTML edition, which is also printed to the PDF. |
| `docs/staff/manual-search.js` | The HTML edition's search, embedded in the page. It needs no network and no helper route. |
| `docs/staff/manual-media/` | Screenshots (PNG) and clips (VP9 WebM with WebVTT captions and a poster PNG). |
| `docs/staff/manual-media.json` | The media record: for each item, its caption, alternative text, chapter, and each file's size and SHA-256. |
| `PROGRAM-MANUAL.html`, `Program_Instruction_Manual.docx`, `Program_Instruction_Manual.pdf` | Generated editions. They are committed and deployed. Never edit them by hand. |

How each edition handles the media:
- **HTML:** embeds every figure and clip as data, so it stays one self-contained file. The helper serves it exactly as
  before; no new route, deployment file or trusted connection is involved.
- **Word and PDF:** carry the still, or the clip's poster with its caption steps.
- **Quick guides:** each figure becomes the line "Shown in the program manual: …", and in-manual links point into
  `PROGRAM-MANUAL.html`.

## Writing for staff

- **Wording:** use the program's exact on-screen labels, and say what the person does and what they see next. Prefer
  numbered steps for a procedure and bullets for facts about one screen.
- **Placement:** put a new topic in the chapter that owns it, and add a row to **Find a task** when it is a task people
  will look for.
- **Links:** link instead of repeating: `[chapter 14](#chapter-14)`. A bold lead-in paragraph such as
  `**Stop Document Writer.**` gets the anchor `#chapter-1-stop-document-writer`.
- **Facts are checked:** the edition and identity checks still apply, as do the import-eligibility sentence checked by
  `audit_r55_documentation.py` and the guide sections checked by `audit_staff_guides.py`.

## Changing screenshots and clips

1. Build the production pages: `python3 tools/build.py`.
2. Capture: `node tools/capture_manual_media.cjs`. To capture only some items, name them:
   `node tools/capture_manual_media.cjs notice-editor clip-reinspection`.
   - **What it drives:** the real helper and production pages in the pinned Chromium, with synthetic cases and the
     synthetic inspector Taylor Example. City-only services (the report server, GIS and Outlook) get synthetic answers.
   - **Requirements:** `ffmpeg` (for VP9 and palette PNGs) and the project's CPython 3.14 (`PYTHON`).
   - **Output:** it rewrites the named files and their entries in `manual-media.json`.
3. Look at every changed image and watch every changed clip with captions on before committing.

Defining the media:
- **Stills:** a still is defined by `still(id, chapter, caption, alt)` and the step in `stills()` that reaches its screen.
- **Clips:** a clip is cut from a recorded session in `SESSIONS` between two caption marks. Its captions are the
  `s.caption(…)` texts.
- **Workflow changes:** if a workflow changes, update its `flows` step. The tool fails loudly when a control it expects
  has gone, which shows that a screenshot or clip, and probably the manual text, needs review.

Placing the media:
- **Add:** write a mark on its own line in the manual, `<!-- media:ID -->`.
- **Each item once:** every recorded item must be placed exactly once.
- **Remove:** delete its mark, its entry in `manual-media.json` and its files together.

## Rebuilding

```
python3 tools/staff_guides.py --write     # quick guides from the manual
python3 tools/build_manual.py             # HTML, Word and tagged PDF, replaced together
python3 tests/unit/audit_manual_publication.py
python3 tests/unit/audit_staff_guides.py
python3 tests/unit/audit_r55_documentation.py
```

`build_manual.py` refuses all of the following, and leaves the maintained editions unchanged when it does:
- a media file whose size or SHA-256 differs from its record;
- a link, or a file outside `manual-media/`;
- a clip that is not WebM or whose captions are not WebVTT;
- a missing caption or alternative text;
- an unrecorded, unplaced or twice-placed mark.

Every edition carries a source digest. The digest covers the Markdown, the style, the search script and the media
record, so a stale edition fails `audit_r55_documentation.py` in the gate.

Packaging copies the three editions and the quick guides into `deploy/`. The media folder is source only, because the
HTML edition embeds the media.

The browser suite opens the manual from Tools & settings and runs axe on it at several widths. Clips must keep their
caption track.

Keep Search manual and Contents reachable through the sticky navigation, including at 320px. Search highlights
synonyms using the original passage text, and Clear search returns focus to the input. Script-free contents must
remain usable. Print figures preserve their aspect ratio and fit within 6.5 inches wide and 7 inches tall in Word;
the HTML print style also caps image height at 7 inches so portrait screenshots do not split across PDF pages.
