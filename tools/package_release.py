"""Create the deployment and maintained-source packages from exact passing evidence.

R52 integrity model: the deploy folder carries runtime-manifest.json listing every program file with its
size and SHA-256 (no signing key). Tamper protection relies on the deployment folder being writable only
by the release owner; IT records that permission check in the acceptance record.
"""

from pathlib import Path
import argparse, hashlib, json, shutil, sys, tempfile
from project_layout import ROOT, fingerprint, assemble_deploy
from release_inputs import archive, checksum, complete, prefixed, source_inventory, verify_deployment, verify_source_copy, verify_package_links

WORK = ROOT
sys.path[:0] = [str(ROOT / p) for p in ["helper", "policy", "tools", "build/generated"]]

parser = argparse.ArgumentParser()
parser.add_argument("--output", type=Path, required=True)
parser.add_argument("--evidence", type=Path)
args = parser.parse_args()
if args.output.resolve().is_relative_to(ROOT):
    raise SystemExit("Release output must be outside maintained source.")
proof = ROOT / "build/verification/latest"
if not args.evidence:
    args.evidence = proof / "browser"
# A fast run or an interrupted gate leaves no repository.json; that is the same refusal, not a traceback.
repository = json.loads((proof / "repository.json").read_text(encoding="utf-8")) if (proof / "repository.json").is_file() else {}
if repository.get("passed") is not True or repository.get("files") != fingerprint():
    raise SystemExit("Maintained source changed or repository verification is missing. Run tools/verify_release.py.")

from release_evidence import verify

verify(WORK)
gate = json.loads((proof / "verification.json").read_text(encoding="utf-8"))
verified_inputs = gate.get("deploymentInputs")
verify_deployment(ROOT, verified_inputs)
source_files = source_inventory(ROOT)
browser = json.loads((args.evidence / "browser-results.json").read_text(encoding="utf-8"))
axe = json.loads((args.evidence / "axe-results.json").read_text(encoding="utf-8"))
hashes = {
    name: hashlib.sha256((ROOT / "build/dist" / name).read_bytes()).hexdigest() for name in ["madison-document-writer.html", "madison-reports.html"]
}
if (
    browser.get("runtimeHashes") != hashes
    or gate.get("runtimeHashes") != hashes
    or not gate.get("passed")
    or gate.get("mode") != "full"
    or browser.get("mode") != "full"
    or not browser.get("passed")
    or not axe.get("passed")
):
    raise SystemExit("Passing full-gate production browser evidence must match every runtime byte; fast or unlabelled evidence is never packaged.")
version = json.loads((ROOT / "version.json").read_text(encoding="utf-8"))
manifest = json.loads((ROOT / "build/generated/runtime-manifest.json").read_text(encoding="utf-8"))
if any(manifest.get(k) != v for k, v in version.items()):
    raise SystemExit("Runtime identity differs from version.json.")
base = args.output.resolve()
base.mkdir(parents=True, exist_ok=True)
name = "Madison-Building-Inspection-" + version["release"].replace(" ", "-")
stage = base / name
if stage.exists():
    raise SystemExit("Choose a new output folder; existing release packages are never overwritten.")
(stage / "deploy").mkdir(parents=True)
(stage / "source").mkdir()
assemble_deploy(stage / "deploy")
# No archive, dependency installation, generated code or browser screenshots in maintained source.
for relative in source_files:
    p = stage / "source" / relative
    p.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT / relative, p)
from verified_update import stage_update
from deploy_manifest import write_manifest


R = version["release"].split()[-1]
release_docs = [R + "-REVIEW.md", R + "-PRODUCTION-READINESS.md", R + "-ACCEPTANCE-RECORD.md"]
shutil.copyfile(ROOT / "docs/developer" / release_docs[0], stage / release_docs[0])
# The living records are rendered with this release's identity by tools/build.py.
for doc in release_docs[1:]:
    shutil.copyfile(ROOT / "build/generated/release-docs" / doc, stage / doc)
verify_deployment(ROOT, verified_inputs, stage)
verify_source_copy(ROOT, stage / "source")
verify_package_links(stage, release_docs)
write_manifest(stage / "deploy")
# Independently recheck the finished deploy folder with the installer's own verifier.
with tempfile.TemporaryDirectory(prefix="deploy-check-") as tmp:
    p = Path(tmp)
    (p / "staged").mkdir()
    (p / "local").mkdir()
    stage_update(stage / "deploy", p / "staged", p / "local")
(stage / "README.md").write_text(
    "# Madison Building Inspection " + R + "\n\n"
    "Install the complete deploy folder using its Start Document Writer - READ ME.md. Before the first installation, IT checks the deploy ZIP's "
    "SHA-256 against the value the release owner publishes separately. After that, inspectors use the installed desktop shortcut; each update is "
    "checked file by file against runtime-manifest.json. The deployment folder must be writable only by the release owner.\n\n"
    "Source is maintained under source/ with one version.json. Verification is in the matching evidence ZIP. The manual is in "
    "deploy/PROGRAM-MANUAL.html and its Word/PDF editions. City acceptance remains open in the acceptance record; no live rollout has been performed.\n",
    encoding="utf-8",
)
summary = {
    "release": version["release"],
    "passed": True,
    "suiteCount": gate["suiteCount"],
    "axeScreens": gate["axeScreens"],
    "printVariants": len(json.loads((ROOT / "build/test-results/r50-print-compatibility.json").read_text(encoding="utf-8"))["checks"]),
    "runtimeHashes": hashes,
    "cityNativeAcceptance": False,
}
(stage / (R + "-Verification-Summary.json")).write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")


# Recheck verified bytes after assembly and before producing any release archives.
verify_deployment(ROOT, verified_inputs, stage, finalized=True)
source_package = verify_source_copy(ROOT, stage / "source")
# Every archive holds exactly an approved file set with verified bytes; staging is never
# traversed for content. The deploy file set is defined by runtime-manifest.json. A checksum
# file inside deploy/ would be an unlisted extra file, so deploy/ never gets one.
deploy_files = complete(stage / "deploy", [t.removeprefix("deploy/") for t in verified_inputs if t.startswith("deploy/")])
generated = {f: hashlib.sha256((stage / f).read_bytes()).hexdigest() for f in ["README.md", R + "-Verification-Summary.json"]}
top_level = {**{f: verified_inputs[f]["sha256"] for f in release_docs}, **generated}
source_package = checksum(stage / "source", source_package)
package_files = {**prefixed("deploy/", deploy_files), **prefixed("source/", source_package), **top_level}
checksum(stage, package_files)
count = sum(Path(f).name != "SHA256SUMS.txt" for f in package_files)
with tempfile.TemporaryDirectory(prefix="final-deploy-") as tmp:
    p = Path(tmp)
    (p / "staged").mkdir()
    (p / "local").mkdir()
    stage_update(stage / "deploy", p / "staged", p / "local")
# Separate evidence includes original logs, JSON proof and synthetic PDFs, with screenshots omitted.
evidence = base / (R + "-Verification-Evidence")
evidence.mkdir()
evidence_files = []
for folder, dest in [(proof, "final"), (ROOT / "build/test-results", "suites")]:
    for p in folder.rglob("*"):
        if not p.is_file() or p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".zip"}:
            continue
        relative = dest + "/" + p.relative_to(folder).as_posix()
        target = evidence / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(p, target)
        evidence_files.append(relative)
format_proof = ROOT / "build/format-proof.json"
if format_proof.is_file():
    shutil.copyfile(format_proof, evidence / "format-proof.json")
    evidence_files.append("format-proof.json")
evidence_files = checksum(evidence, complete(evidence, evidence_files))
archive(stage / "deploy", base / (name + "-deploy.zip"), deploy_files)
archive(stage / "source", base / (name + "-source.zip"), source_package)
archive(evidence, base / (name + "-evidence.zip"), evidence_files, R + "-Verification-Evidence/")
evidence_zip = base / (name + "-evidence.zip")
(stage / "EVIDENCE-SHA256.txt").write_text(hashlib.sha256(evidence_zip.read_bytes()).hexdigest() + "  " + evidence_zip.name + "\n", encoding="utf-8")
package_files["EVIDENCE-SHA256.txt"] = hashlib.sha256((stage / "EVIDENCE-SHA256.txt").read_bytes()).hexdigest()
archive(stage, base / (name + ".zip"), checksum(stage, package_files), name + "/")
for ext in ["pdf", "docx"]:
    source = stage / "deploy" / ("Program_Instruction_Manual." + ext)
    shutil.copyfile(source, base / source.name)
for file in release_docs + [R + "-Verification-Summary.json"]:
    shutil.copyfile(stage / file, base / file)
print("Verified", count, "packaged checksums; all ZIP CRCs pass; deploy folder rechecked against its manifest.")
for p in sorted(base.glob("*.zip")):
    print(p.name, p.stat().st_size)
