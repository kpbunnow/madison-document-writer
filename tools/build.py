#!/usr/bin/env python3
"""Bundle maintained ES modules into the original single-file/base64 runtime."""

import base64
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

HERE = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(HERE / "policy"), str(HERE / "tools"), str(HERE / "helper"), str(HERE / "build/generated")]
from project_layout import version

GENERATED = HERE / "build/generated"
DATA = GENERATED / "modules/data"
DATA.mkdir(parents=True, exist_ok=True)
(GENERATED / "modules/vendor").mkdir(parents=True, exist_ok=True)
identity = version()
MANIFEST = json.loads((HERE / "tools/runtime-manifest.template.json").read_text())
MANIFEST.update(identity)
(GENERATED / "runtime-manifest.json").write_text(json.dumps(MANIFEST, indent=2) + "\n")
(GENERATED / "RELEASE").write_text(identity["release"] + "\n")
(GENERATED / "runtime_identity.py").write_text(
    '"""Generated from version.json; do not edit."""\nVERSION = '
    + repr(identity["helperVersion"])
    + "\nHELPER_BUILD = "
    + str(identity["helperBuild"])
    + "\n"
)
OUTDIR = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else HERE / "build/dist"
if OUTDIR.suffix.lower() == ".html":
    OUTDIR = OUTDIR.parent
OUTDIR.mkdir(parents=True, exist_ok=True)
STAMP = os.environ.get("DW_BUILD_STAMP") or MANIFEST["release"]
TEST_BUILD = os.environ.get("DW_TEST_BUILD") == "1"
(GENERATED / "modules/data/approved_print_style.js").write_text(
    "export const APPROVED_PRINT_STYLE=" + json.dumps((HERE / "app/assets/approved-print-style.css").read_text()) + ";\n"
)
(GENERATED / "modules/data/build_identity.js").write_text(
    "export const BUILD="
    + json.dumps(STAMP)
    + ";\nexport const HELPER_VERSION="
    + json.dumps(MANIFEST["helperVersion"])
    + ";\nexport const LOGO="
    + json.dumps("data:image/png;base64," + (HERE / "app/assets/logo_b64.txt").read_text().strip())
    + ";\n"
)
node = shutil.which("node")
if not node or not (HERE / "node_modules/esbuild/lib/main.js").is_file():
    raise SystemExit("Node/esbuild missing. Run npm ci in source first.")


def rd(name):
    return (
        HERE
        / (
            "app/assets/" + name
            if (HERE / "app/assets" / name).is_file()
            else "docs/staff/" + name
            if (HERE / "docs/staff" / name).is_file()
            else name
        )
    ).read_text(encoding="utf-8")


policy = {
    key: int(re.search(r"const " + key + r"\s*=\s*(\d+)\s*;", rd("shared.js")).group(1))
    for key in ("MAILED_MAX_DAYS_AHEAD", "CITATION_MAX_DAYS_AHEAD")
}
(GENERATED / "calendar_policy.json").write_text(json.dumps(policy, indent=2) + "\n")
subprocess.run([sys.executable, str(HERE / "policy/regenerate_deposits.py"), "--check"], check=True)
library = json.loads(rd("library.js").split("=", 1)[1].rsplit(";", 1)[0])
from compiler import compile_policy

citation_policy = compile_policy(HERE)
(GENERATED / "citation_policy.json").write_text(json.dumps(citation_policy, indent=2) + "\n")
(GENERATED / "modules/data/citation_policy.js").write_text(
    "const CITATION_POLICY=" + json.dumps(citation_policy, ensure_ascii=False, separators=(",", ":")) + ";\nexport { CITATION_POLICY };\n"
)
manifest = {
    json.dumps([c["code"], g["code"], i["o"]], separators=(",", ":")): {"draft": i.get("p") == "draft", "ordinances": i.get("s", [])}
    for c in library
    for g in c["groups"]
    for i in g["items"]
}
assert json.loads(rd("catalog_manifest.json")) == {"format": "madison-catalog-manifest", "version": 1, "items": manifest}
(GENERATED / "modules/data/snow_letter.js").write_text(
    "const DEFAULT_SNOW_LETTER="
    + json.dumps(json.loads(rd("snow_letter.json")), ensure_ascii=False, separators=(",", ":"))
    + ";\nexport { DEFAULT_SNOW_LETTER };\n"
)
for name in ("library.js", "deposits.js", "inspectors.js"):
    data = rd(name)
    symbols = re.findall(r"^(?:const|let|var)\s+(\w+)\s*=", data, re.M)
    (GENERATED / "modules/data" / name).write_text(data + "\nexport { " + ", ".join(symbols) + " };\n")

(GENERATED / "modules/vendor/leaflet_runtime.js").write_text(
    "export function installLeaflet(){\n(function(){var exports=void 0,module=void 0,define=void 0;\n" + rd("leaflet.js") + "\n}).call(window);\n}\n"
)


def render_deploy_guide():
    "R34: the staff install guide is generated from the release files and fails the build if it drifts."
    release = STAMP if re.fullmatch(r"\d{4}-\d{2}-\d{2} R\d+", STAMP) else (GENERATED / "RELEASE").read_text().strip()
    helper = MANIFEST["helperVersion"]
    required = MANIFEST["required"]
    tags = sorted({int(m) for m in re.findall(r"-cp3(\d+)-", " ".join(p.name for p in (HERE / "helper/vendor/wheels").glob("*.whl")))})
    if not tags:
        raise SystemExit("No bundled wheels found for the install guide")
    meta = json.loads(rd("policy/metadata.json"))
    labels = meta.get("settingLabels", {})
    start = meta.get("snowSeasonStartMonthDay", "07-01")
    day = release[:10]
    year = int(day[:4]) - (1 if day[5:] < start else 0)
    snow = [
        k
        for k in labels
        if (k.startswith("snow") or k == "mc2000CaseNumberLabel") and k in meta and isinstance(meta[k], (bool, str)) and k != "snowDefaultDescription"
    ]
    value = lambda v: ("Yes" if v else "No") if isinstance(v, bool) else v
    text = rd("DEPLOY.template.md")
    for key, val in {
        "RELEASE": release,
        "RELEASE_NUMBER": release.split()[-1],
        "HELPER_VERSION": helper,
        "PYTHON_RANGE": "3.%d–3.%d" % (tags[0], tags[-1]),
        "FILE_LIST": "\n".join("- `" + name + "`" for name in required),
        "SNOW_SEASON": "%d–%s" % (year, str(year + 1)[-2:]),
        "SNOW_SETTINGS": "\n".join("   - " + labels[k] + ": **" + str(value(meta[k])) + "** (`" + k + "`)" for k in snow),
        "CASE_SCHEMA": str(MANIFEST["caseSchema"]),
        "SUMMARY_VERSION": str(MANIFEST["summaryVersion"]),
        "AUTHORING": str(MANIFEST["authoringVersion"]),
    }.items():
        text = text.replace("{{" + key + "}}", val)
    if "{{" in text:
        raise SystemExit("Install guide template has an unfilled placeholder")
    for key, pattern in [("caseSchema", r"\bcase schema (\d+)"), ("summaryVersion", r"\bsummary (\d+)"), ("authoringVersion", r"\bauthoring (\d+)")]:
        if any(int(v) != MANIFEST[key] for v in re.findall(pattern, text)):
            raise SystemExit("Install guide states " + key + " other than " + str(MANIFEST[key]))
    number = release.split()[-1]
    if any(r != number for r in re.findall(r"\bR\d{2,3}\b", text.replace(number + "-ACCEPTANCE-RECORD.md", "City acceptance record"))):
        raise SystemExit("Install guide names a release other than " + number)
    if any(v != helper for v in re.findall(r"\b20\d\d\.\d\d\.\d\d\.\d+\b", text)):
        raise SystemExit("Install guide names a helper version other than " + helper)
    if any(v != release for v in re.findall(r"\b20\d\d-\d\d-\d\d R\d+\b", text)):
        raise SystemExit("Install guide names a build other than " + release)
    (GENERATED / "DEPLOY.md").write_text(text, encoding="utf-8")


render_deploy_guide()


def render_release_docs():
    "The living acceptance and readiness records are packaged under release-named copies."
    number = MANIFEST["release"].split()[-1]
    target = GENERATED / "release-docs"
    shutil.rmtree(target, ignore_errors=True)
    target.mkdir()
    for name in ("ACCEPTANCE-RECORD.md", "PRODUCTION-READINESS.md"):
        text = rd("docs/developer/" + name)
        for key, val in {
            "RELEASE": MANIFEST["release"],
            "RELEASE_NUMBER": number,
            "HELPER_VERSION": MANIFEST["helperVersion"],
            "AUTHORING": str(MANIFEST["authoringVersion"]),
        }.items():
            text = text.replace("{{" + key + "}}", val)
        if "{{" in text:
            raise SystemExit(name + " has an unfilled placeholder")
        (target / (number + "-" + name)).write_text(text, encoding="utf-8")


render_release_docs()
# Direct ES module exports are authoritative; no generated ownership registry.

for stem, template, outname, cssname in [
    ("app", "app_template.html", "madison-document-writer.html", "writer.css"),
    ("reports", "reports_template.html", "madison-reports.html", "reports.css"),
]:
    html = rd(template).replace("__BUILD__", STAMP)
    css = rd(cssname)
    for marker, name in [
        ("__UI_CSS__", "ui-refresh.css"),
        ("__FONT_CSS__", "language-font.css"),
        ("__ACCESSIBILITY_CSS__", "accessibility.css"),
        ("__LEAFLET_CSS__", "leaflet.css"),
    ]:
        css = css.replace("/* " + marker + " */", rd(name)).replace(marker, rd(name))
    html = html.replace("__WRITER_CSS__", css).replace("__REPORTS_CSS__", css)
    entry = rd("app/modules/" + stem + "_entry.js")
    # Asynchronous build so the plugin can resolve data/ and vendor/ imports to generated modules.
    command = """
const fs=require('fs'),path=require('path'),root=process.argv[1],stem=process.argv[2],entry=process.argv[3];
require('esbuild').build({stdin:{contents:entry,resolveDir:path.join(root,'app/modules'),sourcefile:stem+'_entry.js'},
 outfile:path.join(root,'build',stem+'.js'),bundle:true,format:'esm',treeShaking:true,minifySyntax:true,
 define:{__TEST_BUILD__:process.argv[4]},supported:{'template-literal':false},allowOverwrite:true,logLevel:'warning',
 plugins:[{name:'generated-data',setup(b){
 b.onResolve({filter:/[\\/]data[\\/]|[\\/]vendor[\\/]/},a=>{
 const p=path.resolve(a.resolveDir,a.path),base=path.join(root,'app/modules');
 if(p.startsWith(base+path.sep)) return {path:path.join(root,'build/generated/modules',path.relative(base,p))};
 });}}]});
"""
    subprocess.run([node, "-e", command, str(HERE), stem, entry, "true" if TEST_BUILD else "false"], cwd=HERE, check=True)
    payload = (HERE / "build" / (stem + ".js")).read_text()
    payload = re.sub(r"^// (?:app|build/generated)/[^\n]+\n", "", payload, flags=re.M)
    (HERE / "build" / (stem + ".js")).write_text(payload)
    assert "`" not in payload
    data = base64.b64encode(payload.encode()).decode("ascii")
    boot = (
        '(function(){var B="'
        + data
        + (
            '";var bin=atob(B),n=bin.length,u=new Uint8Array(n);for(var i=0;i<n;i'
            '++)u[i]=bin.charCodeAt(i);var src=new TextDecoder("utf-8").decode(u)'
            ';var s=document.createElement("script");s.textContent=src;document.b'
            "ody.appendChild(s);setTimeout(function(){var a=document.getElementBy"
            'Id("app");if(a&&!a.innerHTML){a.style.padding="24px";a.style.font="1'
            '5px system-ui";a.textContent="The application script did not start. '
            'Please reopen this file.";}},1200);})();'
        )
    )
    assert not re.search(r"</[a-zA-Z]", boot)
    html = html.replace("__ENTRY__", boot)
    assert html.startswith("<!doctype html>") and html.rstrip().endswith("</html>")
    assert not re.search(r"__(?:WRITER_CSS|REPORTS_CSS|ENTRY|BUILD|LOGO|LEAFLET|UI_CSS|FONT_CSS|ACCESSIBILITY_CSS)__", html)
    destination = OUTDIR / outname
    destination.write_text(html, encoding="utf-8")
    assert base64.b64decode(re.search(r'var B="([A-Za-z0-9+/=]+)"', html).group(1)).decode() == payload
    print("built " + outname + " (" + str(destination.stat().st_size) + " bytes; " + ("test" if TEST_BUILD else "production") + " modules)")
