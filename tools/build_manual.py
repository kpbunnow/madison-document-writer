"""Regenerate the staff HTML, Word and PDF editions from PROGRAM-MANUAL.md.

Requires pandoc, pdftotext and the project's installed Playwright Chromium. All three
editions are generated and checked in a staging folder, then replaced together; a
failure leaves the maintained editions unchanged. Every edition carries a digest of
the Markdown, style, search script and media record it came from, so a stale edition is
detectable. Generated documents are committed source inputs; run before verification,
never during the gate.

Screenshots and captioned clips live in docs/staff/manual-media/ and are recorded in
manual-media.json (see tools/capture_manual_media.cjs). A Markdown line
`<!-- media:ID -->` places one; every recorded item must be placed and every placed item
must match its recorded size and SHA-256. The HTML edition embeds them, so it stays one
self-contained file served by the helper; Word and PDF carry the still or the clip's poster.
"""

from pathlib import Path
from html import escape, unescape
from html.parser import HTMLParser
import base64
import hashlib
import json
import os
import re
import shutil
import struct
import subprocess
import tempfile
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
STAFF = ROOT / "docs/staff"
EDITIONS = ("PROGRAM-MANUAL.html", "Program_Instruction_Manual.docx", "Program_Instruction_Manual.pdf")
JOURNAL, BACKUP = ".manual-publish.json", ".manual-previous"
MEDIA_RECORD, SEARCH_SCRIPT = "manual-media.json", "manual-search.js"
MEDIA_FILE = re.compile(r"manual-media/[a-z0-9]+(?:-[a-z0-9]+)*\.(png|webm|vtt)")
MEDIA_MARK = re.compile(r"^<!-- media:([a-z0-9]+(?:-[a-z0-9]+)*) -->$", re.M)
MEDIA_TYPES = {"png": "image/png", "webm": "video/webm", "vtt": "text/vtt"}
WORD = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
PRINT = """
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.DW_BROWSER,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try {
  const page=await browser.newPage();
  await page.route('**/*',route=>/^(file:|data:)/.test(route.request().url())?route.continue():route.abort());
  await page.goto(process.argv[1]); await page.evaluate(()=>document.fonts.ready);
  await page.pdf({path:process.argv[2],format:'Letter',printBackground:true,tagged:true,margin:{top:'0.5in',bottom:'0.5in',left:'0.5in',right:'0.5in'}});
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
"""


def run_pandoc(arguments, source):
    return subprocess.run(["pandoc", *arguments], input=source.encode("utf-8"), stdout=subprocess.PIPE, check=True).stdout


def print_pdf(html, pdf):
    subprocess.run(["node", "-e", PRINT, html.as_uri(), str(pdf)], cwd=ROOT, check=True)


def pdf_text(path):
    tool = shutil.which("pdftotext")
    if not tool:
        raise RuntimeError("pdftotext (poppler-utils) is required to inspect the PDF manual edition")
    return subprocess.check_output([tool, "-layout", str(path), "-"], encoding="utf-8")


def identity():
    version = json.loads((ROOT / "version.json").read_text(encoding="utf-8"))
    return {"release": version["release"], "helperVersion": version["helperVersion"]}


def source_digest(staff=STAFF):
    """Binds every edition to the exact Markdown, style, search script and media record it was generated from.
    The media record holds each file's SHA-256, and load_media refuses a file that differs from it."""
    digest = hashlib.sha256()
    for name in ("PROGRAM-MANUAL.md", "manual-style.css", SEARCH_SCRIPT, MEDIA_RECORD):
        raw = (staff / name).read_bytes()
        digest.update(len(raw).to_bytes(8, "big") + raw)
    return digest.hexdigest()[:16]


def colophon(digest):
    return "Manual source digest " + digest + "."


class VisibleText(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.parts, self.hidden = [], 0
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        self.hidden += tag in ("style", "script")

    def handle_endtag(self, tag):
        self.hidden -= tag in ("style", "script")

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def normalized(text):
    return re.sub(r"\s+", " ", text).strip()


def edition_texts(folder, read_pdf=pdf_text):
    """Visible text of each edition, refusing an untagged or non-PDF print edition."""
    html = (folder / EDITIONS[0]).read_text(encoding="utf-8")
    with zipfile.ZipFile(folder / EDITIONS[1]) as archive:
        document = ET.fromstring(archive.read("word/document.xml"))
    pdf = folder / EDITIONS[2]
    raw = pdf.read_bytes()
    if not raw.startswith(b"%PDF-") or b"/StructTreeRoot" not in raw:
        raise ValueError("The PDF manual edition is not a tagged PDF")
    return {
        "HTML": normalized(" ".join(VisibleText(html).parts)),
        "Word": normalized(" ".join("".join(p.itertext()) for p in document.findall(".//w:p", WORD))),
        "PDF": normalized(read_pdf(pdf)),
    }, html


def check_editions(folder, digest, expected, read_pdf=pdf_text):
    """All three editions come from the same sources and carry the release identity and anchors."""
    texts, html = edition_texts(Path(folder), read_pdf)
    problems = []
    for name, text in texts.items():
        for phrase in [colophon(digest), "Release " + expected["release"], "Helper " + expected["helperVersion"]]:
            if phrase not in text:
                problems.append(name + " edition lacks " + repr(phrase))
    if '<html lang="en">' not in html or '<meta name="dw-manual-source" content="' + digest + '">' not in html:
        problems.append("HTML edition lacks its language or source digest")
    if any(html.count('id="chapter-' + str(n) + '"') != 1 for n in range(1, 23)) or 'class="downloads"' not in html:
        problems.append("HTML edition lacks its 22 chapter anchors or download links")
    if problems:
        raise ValueError("Manual editions do not match their sources: " + "; ".join(problems))


def media_bytes(staff, reference):
    """One recorded media file: a plain file under manual-media/ whose size and SHA-256 match its record."""
    name = reference.get("file", "") if isinstance(reference, dict) else ""
    if not MEDIA_FILE.fullmatch(name):
        raise ValueError("Invalid manual media file name: " + repr(name))
    path = Path(staff) / name
    if path.is_symlink() or path.parent.is_symlink() or not path.is_file():
        raise ValueError("Manual media file is missing or linked: " + name)
    raw = path.read_bytes()
    if len(raw) != reference.get("bytes") or hashlib.sha256(raw).hexdigest() != reference.get("sha256"):
        raise ValueError("Manual media file differs from its record; recapture or restore it: " + name)
    return raw


def png_size(raw):
    if raw[:8] != b"\x89PNG\r\n\x1a\n" or raw[12:16] != b"IHDR":
        raise ValueError("Manual still is not a PNG")
    return struct.unpack(">II", raw[16:24])


def load_media(staff=STAFF):
    """The verified media record: id -> item with its loaded bytes."""
    record = json.loads((Path(staff) / MEDIA_RECORD).read_text(encoding="utf-8"))
    if record.get("format") != "document-writer-manual-media" or record.get("version") != 1:
        raise ValueError("Unsupported manual media record")
    media = {}
    for item in record["items"]:
        key, kind = item.get("id", ""), item.get("kind")
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", key) or key in media:
            raise ValueError("Invalid or duplicate manual media id: " + repr(key))
        if not str(item.get("caption", "")).strip() or not str(item.get("alt", "")).strip():
            raise ValueError("Manual media needs a caption and alternative text: " + key)
        parts = {"image": ("image",), "clip": ("video", "poster", "captions")}.get(kind)
        if not parts:
            raise ValueError("Unknown manual media kind: " + key)
        loaded = {part: media_bytes(staff, item.get(part)) for part in parts}
        if not loaded.get("video", b"\x1aE\xdf\xa3").startswith(b"\x1aE\xdf\xa3"):
            raise ValueError("Manual clip is not WebM: " + key)
        if kind == "clip" and not loaded["captions"].startswith(b"WEBVTT"):
            raise ValueError("Manual clip captions are not WebVTT: " + key)
        media[key] = {**item, "loaded": loaded, "size": png_size(loaded.get("image") or loaded["poster"])}
    return media


def data_uri(raw, name):
    return "data:" + MEDIA_TYPES[name.rsplit(".", 1)[1]] + ";base64," + base64.b64encode(raw).decode("ascii")


def cue_texts(vtt):
    """Caption lines of a WebVTT file, in order, without repeats."""
    lines, seen = [], set()
    for block in vtt.decode("utf-8").split("\n\n")[1:]:
        text = " ".join(line for line in block.strip().splitlines()[2:]).strip()
        if text and text not in seen:
            seen.add(text)
            lines.append(text)
    return lines


def figure_html(item, number):
    """A figure for the HTML edition, embedded so the manual stays one self-contained page."""
    width, height = item["size"]
    caption = escape(item["caption"])
    if item["kind"] == "image":
        return (
            '<figure class="manual-figure" id="figure-'
            + item["id"]
            + '"><img src="'
            + data_uri(item["loaded"]["image"], item["image"]["file"])
            + '" alt="'
            + escape(item["alt"])
            + '" width="'
            + str(width)
            + '" height="'
            + str(height)
            + '" loading="lazy">'
            + "<figcaption><span>Figure "
            + str(number)
            + ".</span> "
            + caption
            + "</figcaption></figure>"
        )
    steps = "".join("<li>" + escape(text) + "</li>" for text in cue_texts(item["loaded"]["captions"]))
    return (
        '<figure class="manual-clip" id="figure-'
        + item["id"]
        + '"><video controls preload="metadata" width="'
        + str(width)
        + '" height="'
        + str(height)
        + '" poster="'
        + data_uri(item["loaded"]["poster"], item["poster"]["file"])
        + '" aria-label="'
        + escape(item["alt"])
        + '">'
        + '<source src="'
        + data_uri(item["loaded"]["video"], item["video"]["file"])
        + '" type="video/webm">'
        + '<track kind="captions" srclang="en" label="English captions" default src="'
        + data_uri(item["loaded"]["captions"], item["captions"]["file"])
        + '">'
        + '</video><img class="clip-print" src="'
        + data_uri(item["loaded"]["poster"], item["poster"]["file"])
        + '" alt="'
        + escape(item["alt"])
        + '" width="'
        + str(width)
        + '" height="'
        + str(height)
        + '">'
        + "<figcaption><span>Video "
        + str(number)
        + ".</span> "
        + caption
        + " ("
        + str(round(item.get("duration", 0)))
        + " seconds, captioned)"
        + "<details><summary>Steps shown in this video</summary><ol>"
        + steps
        + "</ol></details>"
        + ' <span class="clip-steps-print">Steps shown in the HTML manual\'s captioned video:</span><ol class="clip-steps-print">'
        + steps
        + "</ol></figcaption></figure>"
    )


def word_figure(item, staff, number):
    """The same figure for Word: the still, or the clip's poster with its steps."""
    image = Path(staff) / (item["image"] if item["kind"] == "image" else item["poster"])["file"]
    label = ("Figure " if item["kind"] == "image" else "Video ") + str(number) + ". " + item["caption"]
    text = "![" + label.replace("]", "\\]") + "](" + image.as_posix() + "){width=6.5in}"
    if item["kind"] == "clip":
        text += "\n\n*The HTML manual plays this video with captions. Steps shown: " + " ".join(cue_texts(item["loaded"]["captions"])) + "*"
    return text


def placed_media(text, media):
    """Media marks in reading order; each recorded item is placed exactly once."""
    marks = MEDIA_MARK.findall(text)
    unknown = sorted(set(marks) - set(media))
    if unknown:
        raise ValueError("The manual places unrecorded media: " + ", ".join(unknown))
    if len(marks) != len(set(marks)) or set(marks) != set(media):
        raise ValueError("Every recorded manual media item must be placed exactly once")
    numbers, counts = {}, {"image": 0, "clip": 0}
    for key in marks:
        counts[media[key]["kind"]] += 1
        numbers[key] = counts[media[key]["kind"]]
    return numbers


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", unescape(re.sub(r"<[^>]+>", "", text)).lower()).strip("-")[:60] or "section"


def anchor_lead_ins(fragment):
    """Give each bold lead-in paragraph (**Like this.**) an id under its chapter, so it can be linked and searched."""
    used, chapter = set(re.findall(r'\sid="([^"]+)"', fragment)), "manual"

    def visit(match):
        nonlocal chapter
        if match["heading"]:
            chapter = match["id"] or chapter
            return match[0]
        key, n = chapter + "-" + slug(match["lead"]), 2
        while key in used:
            key, n = chapter + "-" + slug(match["lead"]) + "-" + str(n), n + 1
        used.add(key)
        return '<p id="' + key + '"><strong>' + match["lead"] + "</strong>"

    pattern = r'(?P<heading><h2 id="(?P<id>chapter-\d+)")|<p><strong>(?P<lead>[^<]{2,80})</strong>'
    return re.sub(pattern, visit, fragment)


def contents(fragment):
    """The contents list: one link per numbered chapter, as the browser suite and staff expect."""
    return "".join(
        '<li><a href="#' + key + '">' + re.sub(r"<[^>]+>", "", title) + "</a></li>"
        for key, title in re.findall(r'<h2 id="(chapter-\d+)"[^>]*>(.*?)</h2>', fragment)
    )


def neutral_running_text(reference):
    """The Word style reference once carried a release number in its running header and footer; the manual's
    identity is the release line on its first page, so the header and footer name no release."""
    with zipfile.ZipFile(reference) as source:
        parts = {name: source.read(name) for name in source.namelist()}
        infos = {name: source.getinfo(name) for name in source.namelist()}
    for name in parts:
        if re.fullmatch(r"word/(header|footer)\d*\.xml", name):
            text = parts[name].decode("utf-8")
            text = re.sub(r"R\d+ program instructions", "Program instruction manual", text)
            text = re.sub(r">R\d+(\s*•\s*)", ">", text)
            parts[name] = text.encode("utf-8")
    with zipfile.ZipFile(reference, "w", zipfile.ZIP_DEFLATED) as target:
        for name, raw in parts.items():
            target.writestr(infos[name], raw)


SEARCH_PANEL = (
    '<section class="manual-search" aria-labelledby="manual-search-title" data-manual-search hidden><h2 id="manual-search-title">Search this manual</h2>'
    "<p>Type a word or phrase, such as <em>due date</em>, <em>reinspection</em> or <em>backup</em>. Results link to the matching section.</p>"
    '<label for="manual-search-input">Search words</label> <input id="manual-search-input" type="search" autocomplete="off" spellcheck="false">'
    '<p id="manual-search-status" role="status"></p><ol id="manual-search-results"></ol></section>'
)


def render(staff, staging, digest, pandoc=run_pandoc, printer=print_pdf):
    text = (staff / "PROGRAM-MANUAL.md").read_text(encoding="utf-8")
    chapters = re.findall(r"^## (\d+) (.+)$", text, re.M)
    if [int(n) for n, _ in chapters] != list(range(1, 23)):
        raise ValueError("The manual must retain its 22 numbered chapters")
    media = load_media(staff)
    numbers = placed_media(text, media)
    markdown = re.sub(r"^## (\d+) (.+)$", lambda m: "## " + m[1] + " " + m[2] + " {#chapter-" + m[1] + "}", text, flags=re.M)
    fragment = pandoc(["--from=markdown+pipe_tables+header_attributes", "--to=html5", "--wrap=none"], markdown).decode("utf-8")
    fragment = re.sub(r"<!-- media:([a-z0-9-]+) -->", lambda m: figure_html(media[m[1]], numbers[m[1]]), fragment)
    fragment = anchor_lead_ins(fragment)
    style = (staff / "manual-style.css").read_text(encoding="utf-8")
    script = (staff / SEARCH_SCRIPT).read_text(encoding="utf-8")
    nav = '<p class="downloads"><a href="Program_Instruction_Manual.pdf">Printable PDF</a><a href="Program_Instruction_Manual.docx">Word manual</a><a href="PROGRAM-MANUAL.md">Markdown source</a></p>'
    nav += SEARCH_PANEL + '<nav aria-label="Manual contents"><h2>Contents</h2><ol>' + contents(fragment) + '</ol></nav><div id="instructions">'
    first = fragment.find("<h2")
    if first < 0 or 'id="chapter-1"' not in fragment:
        raise ValueError("The manual has no chapter headings")
    fragment = fragment[:first] + nav + fragment[first:]
    html = (
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        + '<meta name="dw-manual-source" content="'
        + digest
        + '"><title>Program instruction manual</title><style>'
        + style
        + '</style></head><body><a class="skip" href="#instructions">Skip contents</a><main>'
        + fragment
        + '</div><p class="meta">End of program instructions. See the packaged production readiness and City acceptance record for release decisions. '
        + colophon(digest)
        + "</p></main><script>"
        + script.replace("</", "<\\/")
        + "</script></body></html>\n"
    )
    (staging / EDITIONS[0]).write_text(html, encoding="utf-8")
    # The maintained Word edition supplies its own styles to the new one.
    reference = staging / ".reference.docx"
    shutil.copyfile(staff / EDITIONS[1], reference)
    neutral_running_text(reference)
    word = MEDIA_MARK.sub(lambda m: word_figure(media[m[1]], staff, numbers[m[1]]), markdown)
    pandoc(
        [
            "--from=markdown+pipe_tables+header_attributes",
            "--reference-doc=" + str(reference),
            "--metadata=title:Program instruction manual",
            "--resource-path=" + str(staff),
            "--output=" + str(staging / EDITIONS[1]),
        ],
        word.rstrip("\n") + "\n\n" + colophon(digest) + "\n",
    )
    reference.unlink()
    printer(staging / EDITIONS[0], staging / EDITIONS[2])


def write_journal(staff, value):
    path = staff / JOURNAL
    fd, temporary = tempfile.mkstemp(prefix=".manual-journal-", dir=staff)
    with os.fdopen(fd, "w", encoding="utf-8") as stream:
        json.dump(value, stream)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, path)


def recover(staff=STAFF):
    """Complete an interrupted publication: keep a fully replaced set, otherwise restore the previous one."""
    journal, backup = staff / JOURNAL, staff / BACKUP
    if journal.exists():
        state = json.loads(journal.read_text(encoding="utf-8"))
        if state["state"] != "replaced":
            for name in EDITIONS:
                if (backup / name).exists():
                    os.replace(backup / name, staff / name)
                elif name not in state["previous"]:
                    (staff / name).unlink(missing_ok=True)
    shutil.rmtree(backup, ignore_errors=True)
    journal.unlink(missing_ok=True)


def publish(staging, staff=STAFF):
    recover(staff)
    backup = staff / BACKUP
    write_journal(staff, {"state": "replacing", "previous": [n for n in EDITIONS if (staff / n).exists()]})
    backup.mkdir()
    try:
        for name in EDITIONS:
            if (staff / name).exists():
                os.replace(staff / name, backup / name)
            os.replace(staging / name, staff / name)
    except BaseException:
        recover(staff)
        raise
    write_journal(staff, {"state": "replaced"})
    recover(staff)


def build(staff=STAFF, expected=None, pandoc=run_pandoc, printer=print_pdf, read_pdf=pdf_text):
    staff = Path(staff)
    expected = expected or identity()
    recover(staff)
    digest = source_digest(staff)
    staging = Path(tempfile.mkdtemp(prefix=".manual-staging-", dir=staff))
    try:
        render(staff, staging, digest, pandoc, printer)
        check_editions(staging, digest, expected, read_pdf)
        publish(staging, staff)
    finally:
        shutil.rmtree(staging, ignore_errors=True)
    check_editions(staff, digest, expected, read_pdf)
    return digest


if __name__ == "__main__":
    digest = build()
    print("Regenerated HTML, Word and PDF for " + identity()["release"] + " from manual source " + digest)
