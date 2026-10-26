import { recordDay } from "../assets/shared.js";
import { doc, docsFor, insp } from "./writer_queries.js";
import { esc } from "./presentation_format.js";
import { WriterState } from "./state.js";

// Document-history and revision presentation only; no record actions or persistence.
export function createRecordHistory(services) {
  function recordHistoryHTML(d) {
    if (d.draft) return "";
    const chain = docsFor(d.caseId)
      .filter((x) => !x.draft && ((x.revision || {}).rootId || x.id) === ((d.revision || {}).rootId || d.id))
      .slice()
      .reverse();
    const notes = d.annotations || [],
      follow = !!d.void,
      pending = follow && !d.reconciliation;
    const finishing = !!WriterState.state.publicationBusy && doc(WriterState.state.publicationBusy)?.caseId === d.caseId;
    return (
      '<section class="card record-history no-print"><div class="card-b"><h2>Do' +
      "cument record</h2>\n    " +
      "".concat(
        pending
          ? '<div class="banner warn"><div><strong>Follow-through still needs recordi' +
              "ng.</strong> Notify affected recipients and update Accela and any court " +
              "/ attorney records as applicable. Opening an email draft does not confir" +
              'm delivery. <button class="btn" id="btn-reconcile">Record follow-through' +
              "</button></div></div>"
          : d.reconciliation
            ? "<p>Follow-through recorded by " +
              `${esc(insp(d.reconciliation.by).name || d.reconciliation.by)}` +
              " on " +
              `${esc(services.fmtDate(recordDay(d.reconciliation.at)))}` +
              ": " +
              `${esc(d.reconciliation.reference)}` +
              "</p>"
            : "",
      ) +
      "\n    " +
      "".concat(
        Object.values(WriterState.RECORD_ATTEMPTS)
          .filter((x) => x.cid === d.caseId && x.pendingAmendment.payload.docId === d.id)
          .map(
            (x) =>
              '<div class="banner warn">A record change is awaiting save confirmation. ' +
              'Its exact request is retained. <button class="btn" data-resumerecord="' +
              `${esc(x.recordKey)}` +
              '">Confirm save</button></div>',
          )
          .join(""),
      ) +
      "\n    <details><summary>Version history · " +
      `${chain.length}` +
      " " +
      `${chain.length === 1 ? "version" : "versions"}` +
      "" +
      `${notes.length ? " · " + notes.length + " record notes" : ""}` +
      '</summary><ol class="record-chain">' +
      "".concat(
        chain
          .map(
            (x) =>
              '<li><button class="lnk" data-open="' +
              `${esc(x.id)}` +
              '">' +
              `${x.revision ? "Revision " + x.revision.number : "Original"}` +
              " · " +
              `${esc(services.fmtDate(recordDay((x.revision && x.revision.at) || x.issuedAt)))}` +
              "</button> <span>" +
              `${x.superseded ? "Replaced" : x.void ? "Withdrawn" : "Current version"}` +
              "</span>" +
              `${x.revision ? `<p>${esc(x.revision.reason)}</p>` : ""}` +
              "</li>",
          )
          .join(""),
      ) +
      "</ol>\n    " +
      "".concat(
        notes.length
          ? "<h3>Record notes</h3>" +
              "".concat(
                notes
                  .map(
                    (n) =>
                      "<p><strong>" +
                      `${esc(services.fmtDate(recordDay(n.at)))}` +
                      " · " +
                      `${esc(insp(n.by).name || n.by)}` +
                      "</strong><br>" +
                      `${esc(n.text)}` +
                      "</p>",
                  )
                  .join(""),
              ) +
              ""
          : '<p class="hint">Record notes explain earlier errors without changing the issued copy.</p>',
      ) +
      "\n    </details>" +
      "".concat(finishing ? '<p class="hint" id="record-save-progress" role="status">Finishing document save…</p>' : "") +
      '<div class="correction-actions"><button class="btn" id="btn-recordnote" ' +
      `${finishing ? 'disabled aria-describedby="record-save-progress"' : ""}` +
      '>Add record note</button> <button class="btn" id="btn-original">Print or' +
      "iginal issued copy</button></div></div></section>"
    );
  }

  function revisionPrintNote(d) {
    if (d.draft) return '<div class="revision-print"><strong>DRAFT · NOT ISSUED</strong></div>';
    const r = d.revision;
    if (!r) return "";
    return (
      '<div class="revision-print"><strong>CORRECTED DOCUMENT · Revision ' +
      `${esc(r.number)}` +
      "</strong><br>Replaces document " +
      `${esc(r.targetId)}` +
      ", originally issued " +
      `${esc(services.fmtDate(r.originalIssued))}` +
      ". This revision: " +
      `${esc(d.id)}` +
      ".<br>" +
      `${esc(r.reason)}` +
      "</div>"
    );
  }
  return { recordHistoryHTML, revisionPrintNote };
}
