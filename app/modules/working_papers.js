import { deliveredByCitation } from "./document_rules.js";
import { doc, kase } from "./writer_queries.js";
import { emailList } from "./mailing_rules.js";
import { esc } from "./presentation_format.js";
import { clone } from "./record_values.js";
import { WriterState } from "./state.js";

export function hasSetupWork() {
  return !!WriterState.state.acc || !!String(WriterState.WORK.entry?.["lookup-number"] || "").trim();
}

export function importResumePanel() {
  const acc = WriterState.state.acc || WriterState.WORK.acc;
  if (acc) {
    const c = acc.cases && acc.cases[acc.caseIx || 0],
      number = c && c.number,
      address = c && c.address;
    const detail = [number, address].filter(Boolean).join(" · ");
    const issue = acc.shareError ? "The shared record needs attention before you can confirm." : "";
    return (
      '<section class="attention-import" aria-label="Import awaiting review"><d' +
      'iv class="attention-import-copy"><span class="attention-eyebrow">Import ' +
      "awaiting review</span><strong>" +
      `${esc(detail || acc.fileName || "Inspection result")}` +
      "</strong><span>" +
      `${esc(issue || "Review the inspection result and confirm what to do next.")}` +
      '</span></div><button class="btn btn-primary" data-nav="import">Review im' +
      "port</button></section>"
    );
  }
  const number = String(WriterState.WORK.entry?.["lookup-number"] || "").trim();
  return number
    ? '<section class="attention-import" aria-label="Import in progress"><div c' +
        'lass="attention-import-copy"><span class="attention-eyebrow">Import in p' +
        "rogress</span><strong>Case " +
        `${esc(number)}` +
        "</strong><span>Your case search is saved on this device.</span></div><bu" +
        'tton class="btn btn-primary" data-nav="import">Continue search</button><' +
        "/section>"
    : "";
}

export function workingNotesPanel() {
  const forms = Object.entries(WriterState.WORK.recordForms || {}).filter(
    ([key, v]) => doc(key.slice(0, key.lastIndexOf(":"))) && String(v.text || v.external || "").trim(),
  );
  if (!forms.length) return "";
  const names = { void: "withdrawal review", recordnote: "record note", reconcile: "follow-through" };
  return (
    '<div class="banner info"><div><strong>Record work in progress</strong><div class="doclinks">' +
    forms
      .map(([key]) => {
        const cut = key.lastIndexOf(":"),
          d = doc(key.slice(0, cut));
        return (
          '<button class="btn" data-worknote="' +
          esc(key) +
          '">Continue ' +
          esc(names[key.slice(cut + 1)] || "record work") +
          " · " +
          esc(kase(d.caseId).number) +
          "</button>"
        );
      })
      .join("") +
    "</div></div></div>"
  );
}

export function filingPanel(d) {
  if (!d || d.draft || d.void || d.superseded || d.filedAt) return "";
  if (deliveredByCitation(d))
    return (
      '<div class="banner info no-print"><div><strong>Delivered within the cita' +
      "tion.</strong> This Official Notice record holds the case deadlines. It " +
      "was not mailed separately; the citation letter carried its order languag" +
      "e.</div></div>"
    );
  return (
    '<div class="banner warn no-print"><div><strong>PDF filing needed.</stron' +
    'g> The case record is issued. <button class="btn" id="btn-retryfiling">F' +
    "ile issued PDF</button> Keep any manually saved copy with the case recor" +
    "d.</div></div>"
  );
}

export function createWorkingPapers(services) {
  function captureWork() {
    if (WriterState.state.screen === "reinspect" && WriterState.state.riWalk && services.ensureWalkContext())
      WriterState.WORK.walk = {
        context: WriterState.state.riWalkContext,
        item: WriterState.state.riWalkItem,
        undo: clone(WriterState.state.riWalkUndo),
        skipped: clone(WriterState.state.riWalkSkipped),
        mode: WriterState.state.riWalkMode,
        stage: WriterState.state.riWalkStage,
      };
    // Input/change listeners own every edit, including an explicit clear. A finishing save must not capture a transient empty control over typed work.
    if (WriterState.state.screen === "import")
      services.ENTRY_IDS.forEach((id) => {
        const el = services.document.getElementById(id);
        if (el && WriterState.WORK.entry[id] === undefined) WriterState.WORK.entry[id] = el.value;
      });
    WriterState.WORK.acc = WriterState.state.acc ? clone(WriterState.state.acc) : null;
    if (WriterState.state.modal === "final") {
      const d = doc(WriterState.state.docId),
        boxes = [...services.document.querySelectorAll("[data-finsend]")];
      if (d && d.draft && !d.pendingAmendment && boxes.length) {
        const list = emailList(kase(d.caseId)).filter((e) => String(e.addr || "").trim());
        d.emailSelection = boxes
          .filter((b) => b.checked)
          .map((b) => list[+b.dataset.finsend])
          .filter(Boolean)
          .map((e) => e.addr + "|" + (e.kind || "Other"));
      }
    }
    if (["void", "recordnote", "reconcile"].includes(WriterState.state.modal)) {
      const text = services.document.getElementById("record-action-text");
      /* R35: the input listener records every user edit (including clearing a field). A re-rendered dialog can briefly
       show empty fields, and saves call captureWork, so the DOM fills only fields never recorded; it never overwrites typed text. */
      if (text) {
        const key = services.recordFormKey(),
          prev = WriterState.WORK.recordForms[key] || {},
          dom = {
            text: text.value,
            external: (services.document.getElementById("record-action-external") || {}).value || "",
            actor: (services.document.getElementById("record-action-inspector") || {}).value || "",
          };
        WriterState.WORK.recordForms[key] = Object.fromEntries(Object.keys(dom).map((f) => [f, prev[f] !== undefined ? prev[f] : dom[f]]));
      }
    }
  }
  return { captureWork };
}
