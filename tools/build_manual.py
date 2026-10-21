"""Regenerate the staff HTML, Word and PDF editions from PROGRAM-MANUAL.md.

Requires pandoc, pdftotext and the project's installed Playwright Chromium. All three
editions are generated and checked in a staging folder, then replaced together; a
failure leaves the maintained editions unchanged. Every edition carries a digest of
the Markdown and style it came from, so a stale edition is detectable. Generated
documents are committed source inputs; run before verification, never during the gate.
"""

from pathlib import Path
from html import escape
from html.parser import HTMLParser
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
STAFF = ROOT / "docs/staff"
EDITIONS = ("PROGRAM-MANUAL.html", "Program_Instruction_Manual.docx", "Program_Instruction_Manual.pdf")
JOURNAL, BACKUP = ".manual-publish.json", ".manual-previous"
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
    """Binds every edition to the exact Markdown and style it was generated from."""
    digest = hashlib.sha256()
    for name in ("PROGRAM-MANUAL.md", "manual-style.css"):
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


def render(staff, staging, digest, pandoc=run_pandoc, printer=print_pdf):
    text = (staff / "PROGRAM-MANUAL.md").read_text(encoding="utf-8")
    chapters = re.findall(r"^## (\d+) (.+)$", text, re.M)
    if [int(n) for n, _ in chapters] != list(range(1, 23)):
        raise ValueError("The manual must retain its 22 numbered chapters")
    markdown = re.sub(r"^## (\d+) (.+)$", lambda m: "## " + m[1] + " " + m[2] + " {#chapter-" + m[1] + "}", text, flags=re.M)
    fragment = pandoc(["--from=markdown+pipe_tables+header_attributes", "--to=html5", "--wrap=none"], markdown).decode("utf-8")
    style = (staff / "manual-style.css").read_text(encoding="utf-8")
    nav = '<p class="downloads"><a href="Program_Instruction_Manual.pdf">Printable PDF</a><a href="Program_Instruction_Manual.docx">Word manual</a><a href="PROGRAM-MANUAL.md">Markdown source</a></p>'
    nav += '<nav aria-label="Manual contents"><h2>Contents</h2><ol>'
    nav += "".join('<li><a href="#chapter-' + n + '">' + escape(title) + "</a></li>" for n, title in chapters)
    nav += '</ol></nav><div id="instructions">'
    fragment = fragment.replace('<h2 id="chapter-1">', nav + '<h2 id="chapter-1">', 1)
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
        + "</p></main></body></html>\n"
    )
    (staging / EDITIONS[0]).write_text(html, encoding="utf-8")
    # The maintained Word edition supplies its own styles to the new one.
    reference = staging / ".reference.docx"
    shutil.copyfile(staff / EDITIONS[1], reference)
    pandoc(
        [
            "--from=markdown+pipe_tables",
            "--reference-doc=" + str(reference),
            "--metadata=title:Program instruction manual",
            "--output=" + str(staging / EDITIONS[1]),
        ],
        text.rstrip("\n") + "\n\n" + colophon(digest) + "\n",
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
