import { editorState as editor } from "./editor_state.js";
import { recordDay } from "../assets/shared.js";
import { DOC_TYPES, CIT_COPIES } from "./document_types.js";
import { frozenOf } from "./document_rules.js";
import { docCase } from "./writer_queries.js";

/* Print job phases. Each takes the owner's `services` and runs in the order the single job used to. */
function fileName(services, d) {
  const k = docCase(d),
    ty = (DOC_TYPES.find((t) => t.id === d.type) || {}).label || d.type;
  const tag = String(d.id || "")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(-8);
  const name = [k.address || "PROPERTY", k.number || "CASE", ty, services.fmtDate(d.mailed || recordDay(services.today)).replace(/\//g, "-")]
    .concat(tag ? [tag] : [])
    .join(" - ")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return (d.void ? "VOID - " : "") + name;
}

function refuseUnprintable(services, d) {
  if (d.type === "citation" && d.draft && Object.values(d.cits || {}).some((c) => c.mandatoryAppearance))
    throw new Error("Mandatory-appearance citations need division-approved defendant instructions. Your draft is retained.");
  if (
    d.type === "citation" &&
    (Object.keys(d.depositRequests || {}).length ||
      d.items.some((i) => i.cite && !i.withdrawn && services.citationDepositFault(d.cits?.[i.id] || {}, d, i)))
  )
    throw new Error("Complete and confirm every citation deposit before printing or filing.");
}

// A separate, fixed-width frame prevents a narrow viewport or old scroll
// geometry from changing the filed document. Everything comes from d.
function openFrame(services) {
  const frame = services.document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:absolute;left:-20000px;top:0;width:1400px;height:1200px;border:0;pointer-events:none";
  services.document.body.appendChild(frame);
  return frame;
}

function writeDesk(services, fd, d) {
  fd.open();
  fd.write(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><style>' +
      ((services.document.querySelector("style") || {}).textContent || "") +
      '</style></head><body><div class="desk">' +
      services.documentHTML(d) +
      "</div></body></html>",
  );
  fd.close();
  return fd.querySelector(".desk");
}

// Refuse an incomplete new packet instead of filing a successful-looking
// PDF with missing copies. Historical retained PDFs are never rewritten.
function checkCitationPacket(d, stage) {
  if (d.type !== "citation" || !(d.draft || d.authoringVersion >= 15)) return;
  const faces = [...stage.querySelectorAll(".cit")],
    cited = d.items.filter((it) => it.cite && !it.withdrawn),
    // The rendered faces use the document's frozen copies; compare with those, not today's labels.
    labels = ((frozenOf(d) || {}).courtCopies || CIT_COPIES).map((copy) => copy.label);
  if (
    labels.length !== 4 ||
    faces.length !== cited.length * 4 ||
    faces.some(
      (face, index) =>
        face.querySelector(".cit-foot span:last-child")?.textContent !== labels[index % 4] ||
        face.querySelector(".cit-no")?.textContent.trim() !== String(d.cits?.[cited[Math.floor(index / 4)]?.id]?.num || "").trim(),
    )
  )
    throw new Error(
      "The citation packet is incomplete. Court, Agency, Inspector and Defendant copies are required for every charge. Nothing was filed; " +
        (d.draft ? "your draft is retained." : "the issued record is unchanged and its PDF still needs filing."),
    );
}

// Measure the same locked print styles and value spans that will be filed.
function snowJob(services, fd, d, stage) {
  const html = services.printableHTML(d, stage);
  fd.open();
  fd.write(html);
  fd.close();
  services.paginate(fd.querySelector(".desk"), d);
  return { docId: d.id, name: fileName(services, d) + ".pdf", html: "<!doctype html>" + fd.documentElement.outerHTML };
}

function framedJob(services, fd, d) {
  const stage = writeDesk(services, fd, d);
  checkCitationPacket(d, stage);
  if (services.snow.is(d) && d.authoringVersion >= 9) return snowJob(services, fd, d, stage);
  // Row selection controls (affected-item and shared-due-date checkboxes) are screen-only and sit in the
  // due-date cell; printableHTML drops them, so drop them before measuring page breaks as well. Page
  // breaks then match the non-editable rendering of the same facts.
  stage.querySelectorAll(".affected-pick,.due-pick").forEach((n) => n.remove());
  services.paginate(stage, d);
  return { docId: d.id, name: fileName(services, d) + ".pdf", html: services.printableHTML(d, stage) };
}

export function createDocumentPrinting(services) {
  function documentFileName(d) {
    return fileName(services, d);
  }

  function printJob(d) {
    if (!d) return null;
    refuseUnprintable(services, d);
    const frame = openFrame(services);
    try {
      const fd = frame.contentDocument;
      if (fd && fd.open) return framedJob(services, fd, d);
      if (editor.state.docId !== d.id) return null;
      return { docId: d.id, name: documentFileName(d) + ".pdf", html: services.printableHTML() };
    } finally {
      frame.remove();
    }
  }
  return { documentFileName, printJob };
}
