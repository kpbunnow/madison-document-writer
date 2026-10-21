"""Regenerate the staff HTML, Word and PDF editions from PROGRAM-MANUAL.md.

Requires pandoc and the project's installed Playwright Chromium. Generated documents
are committed source inputs; run before verification, never during the gate.
"""

from pathlib import Path
from html import escape
import json
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
STAFF = ROOT / "docs/staff"
text = (STAFF / "PROGRAM-MANUAL.md").read_text()
chapters = re.findall(r"^## (\d+) (.+)$", text, re.M)
if [int(n) for n, _ in chapters] != list(range(1, 23)):
    raise ValueError("The manual must retain its 22 numbered chapters")
markdown = re.sub(r"^## (\d+) (.+)$", lambda m: "## " + m[1] + " " + m[2] + " {#chapter-" + m[1] + "}", text, flags=re.M)
fragment = subprocess.check_output(
    ["pandoc", "--from=markdown+pipe_tables+header_attributes", "--to=html5", "--wrap=none"], input=markdown, text=True
)
style = (STAFF / "manual-style.css").read_text()
nav = '<p class="downloads"><a href="Program_Instruction_Manual.pdf">Printable PDF</a><a href="Program_Instruction_Manual.docx">Word manual</a><a href="PROGRAM-MANUAL.md">Markdown source</a></p>'
nav += '<nav aria-label="Manual contents"><h2>Contents</h2><ol>'
nav += "".join('<li><a href="#chapter-' + n + '">' + escape(title) + "</a></li>" for n, title in chapters)
nav += '</ol></nav><div id="instructions">'
fragment = fragment.replace('<h2 id="chapter-1">', nav + '<h2 id="chapter-1">', 1)
html = (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Program instruction manual</title><style>'
    + style
    + '</style></head><body><a class="skip" href="#instructions">Skip contents</a><main>'
    + fragment
    + '</div><p class="meta">End of program instructions. See the packaged production readiness and City acceptance record for release decisions.</p></main></body></html>\n'
)
(STAFF / "PROGRAM-MANUAL.html").write_text(html)
with tempfile.TemporaryDirectory(prefix="manual-styles-") as tmp:
    reference = Path(tmp) / "reference.docx"
    shutil.copyfile(STAFF / "Program_Instruction_Manual.docx", reference)
    subprocess.run(
        [
            "pandoc",
            str(STAFF / "PROGRAM-MANUAL.md"),
            "--from=markdown+pipe_tables",
            "--reference-doc=" + str(reference),
            "--metadata=title:Program instruction manual",
            "--output=" + str(STAFF / "Program_Instruction_Manual.docx"),
        ],
        check=True,
    )
code = """
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
subprocess.run(["node", "-e", code, (STAFF / "PROGRAM-MANUAL.html").as_uri(), str(STAFF / "Program_Instruction_Manual.pdf")], cwd=ROOT, check=True)
print("Regenerated HTML, Word and PDF for " + json.loads((ROOT / "version.json").read_text())["release"])
