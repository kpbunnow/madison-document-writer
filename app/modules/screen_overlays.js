import { doc, kase, docCase } from "./writer_queries.js";
import { iso } from "./calendar.js";
import { DOC_TYPES } from "./document_types.js";
import { emailList, ccList, isLLC, EMAIL_KINDS } from "./mailing_rules.js";
import { esc, fmtDate } from "./presentation_format.js";
import { WriterState } from "./state.js";
import { recordDay, mailingMaxDay } from "../assets/shared.js";

export function createScreenOverlays(services) {
  function modalHTML() {
    if (WriterState.state.modal === "shared-change") return services.sharedChangeModal();
    if (WriterState.state.modal === "review") return services.reviewModalHTML();
    if (WriterState.state.modal === "recovery") return services.recoveryModal();
    if (["void", "recordnote", "reconcile"].includes(WriterState.state.modal)) return services.recordActionModal();
    if (WriterState.state.modal === "sendto") {
      const d = doc(WriterState.state.sendDoc) || doc(WriterState.state.docId);
      if (!d) return "";
      const k = kase(d.caseId),
        list = emailList(k).filter((e) => String(e.addr || "").trim());
      return (
        '<div class="modal"><div class="modal-box" role="dialog" aria-modal="true' +
        '">\n      <div class="modal-h"><h2>Send this document to</h2></div><div c' +
        'lass="modal-b">\n      <p class="hint">Choose recipients for the email dr' +
        "aft. Review and send it in your mail application. The issued document st" +
        "ays unchanged.</p>\n      " +
        "".concat(
          list
            .map(
              (e, ix) => `<label class="sendrow"><input type="checkbox" data-sendto="${ix}" checked>
        <span><strong>${esc(e.kind || "Other")}</strong> ${esc(e.addr)}</span></label>`,
            )
            .join(""),
        ) +
        '\n      </div><div class="modal-f">\n        <button class="btn" data-clos' +
        'e="modal">Cancel</button>\n        <button class="btn" id="btn-sendnone">' +
        'Send without recording</button>\n        <button class="btn btn-primary" ' +
        'id="btn-sendgo">Open the email</button>\n      </div></div></div>'
      );
    }
    if (WriterState.state.modal === "cc") {
      const d = doc(WriterState.state.docId);
      if (!d) return "";
      const k = docCase(d),
        cc = ccList(k),
        em = emailList(k),
        needAgent = d.type === "citation" && isLLC(k),
        problem = WriterState.state.ccProblem;
      const invalid = (scope, index, field) =>
        problem && problem.scope === scope && problem.index === index && problem.field === field
          ? ' aria-invalid="true" aria-describedby="cc-address-error"'
          : "";
      return (
        '<div class="modal"><div class="modal-box" role="dialog" aria-modal="true' +
        '">\n      <div class="modal-h"><h2>Copies, email and registered agent</h2' +
        '></div><div class="modal-b">\n      <div class="banner info"><div>' +
        "".concat(
          d.correction
            ? "These edits belong to this correction. Select the case-details option on" +
                " the correction panel to also use them for future documents."
            : "Anything entered here appears on future documents for " + esc(k.number) + ". Issued copies stay unchanged.",
        ) +
        "</div></div>\n      " +
        "".concat(
          problem
            ? '<div class="banner alert" id="cc-address-error" role="alert"><div><stron' +
                "g>Check this address:</strong> " +
                `${esc(problem.message)}` +
                "</div></div>"
            : "",
        ) +
        '\n\n      <h3 class="rec-h">Copies</h3>\n      <p class="hint">Printed at t' +
        "he foot of the document under &ldquo;CC:&rdquo;. Enter a numbered street" +
        " address and city, state and ZIP; the print preview below shows the stan" +
        "dardized lines.</p>\n      " +
        "".concat(
          cc.length
            ? cc
                .map(
                  (c, ix) =>
                    '<div class="rec">\n        <div class="rec-n">' +
                    `${ix + 1}` +
                    '</div>\n        <div class="rec-f">\n          <input type="text" data-cc=' +
                    '"' +
                    `${ix}` +
                    '|name" value="' +
                    `${esc(c.name || "")}` +
                    '" placeholder="Name" aria-label="Copy ' +
                    `${ix + 1}` +
                    ' name"' +
                    `${invalid("copy", ix, "name")}` +
                    '>\n          <input type="text" data-cc="' +
                    `${ix}` +
                    '|addr" value="' +
                    `${esc(c.addr || "")}` +
                    '" placeholder="Street number and name (123 Main St, Apt 4)" aria-label="' +
                    "Copy " +
                    `${ix + 1}` +
                    ' street number and name"' +
                    `${invalid("copy", ix, "addr")}` +
                    '>\n          <input type="text" data-cc="' +
                    `${ix}` +
                    '|city" value="' +
                    `${esc(c.city || "")}` +
                    '" placeholder="City, ST ZIP (Madison, WI 53703)" aria-label="Copy ' +
                    `${ix + 1}` +
                    ' city, state and ZIP"' +
                    `${invalid("copy", ix, "city")}` +
                    '>\n          <p class="rec-preview" data-recipient-preview="copy|' +
                    `${ix}` +
                    '">' +
                    `${esc(services.recipientPreview(c))}` +
                    '</p><button class="btn btn-sm" data-parse-address="copy|' +
                    `${ix}` +
                    '">Preview standardized copy address</button>\n        </div>\n        <but' +
                    'ton class="btn btn-sm" data-rmcc="' +
                    `${ix}` +
                    '" aria-label="Remove copy ' +
                    `${ix + 1}` +
                    '">&times;</button></div>',
                )
                .join("")
            : '<p class="hint">No copies yet.</p>',
        ) +
        '\n      <button class="btn btn-sm" id="btn-addcc">Add a copy</button>\n\n  ' +
        '    <h3 class="rec-h">Email recipients</h3>\n      <p class="hint">Offere' +
        "d when you email a document. Recipients selected when finalizing are lis" +
        "ted on that document.</p>\n      " +
        "".concat(
          em.length
            ? em
                .map(
                  (e, ix) =>
                    '<div class="rec">\n        <div class="rec-n">' +
                    `${ix + 1}` +
                    '</div>\n        <div class="rec-f rec-mail">\n          <select data-em="' +
                    `${ix}` +
                    '|kind" aria-label="Recipient ' +
                    `${ix + 1}` +
                    ' type">' +
                    `${EMAIL_KINDS.map((x) => `<option ${e.kind === x ? "selected" : ""}>${esc(x)}</option>`).join("")}` +
                    '</select>\n          <input type="email" data-em="' +
                    `${ix}` +
                    '|addr" value="' +
                    `${esc(e.addr || "")}` +
                    '" placeholder="name@example.com" aria-label="Recipient ' +
                    `${ix + 1}` +
                    ' email">\n        </div>\n        <button class="btn btn-sm" data-rmem="' +
                    `${ix}` +
                    '" aria-label="Remove recipient ' +
                    `${ix + 1}` +
                    '">&times;</button></div>',
                )
                .join("")
            : '<p class="hint">No email recipients yet.</p>',
        ) +
        '\n      <button class="btn btn-sm" id="btn-addem">Add an email recipient<' +
        '/button>\n\n      <h3 class="rec-h">Registered agent' +
        `${needAgent ? ' <span class="req">required</span>' : ""}` +
        '</h3>\n      <p class="hint">' +
        `${
          needAgent
            ? esc(k.owner) + " reads as a company, so a citation cannot be served without an agent."
            : "Only needed when the owner is a company. Printed on the citation."
        }` +
        '</p>\n      <div class="rec"><div class="rec-n">&nbsp;</div><div class="r' +
        'ec-f">\n        <input type="text" data-agent="name" value="' +
        `${esc((k.agent || {}).name || "")}` +
        '" placeholder="Agent name" aria-label="Registered agent name"' +
        `${invalid("agent", 0, "name")}` +
        '>\n        <input type="text" data-agent="addr" value="' +
        `${esc((k.agent || {}).addr || "")}` +
        '" placeholder="Street number and name (123 Main St, Apt 4)" aria-label="' +
        'Registered agent street number and name"' +
        `${invalid("agent", 0, "addr")}` +
        '>\n        <input type="text" data-agent="city" value="' +
        `${esc((k.agent || {}).city || "")}` +
        '" placeholder="City, ST ZIP (Madison, WI 53703)" aria-label="Registered ' +
        'agent city, state and ZIP"' +
        `${invalid("agent", 0, "city")}` +
        '>\n        <p class="rec-preview" data-recipient-preview="agent|0">' +
        `${esc(services.recipientPreview(k.agent || {}))}` +
        '</p><button class="btn btn-sm" data-parse-address="agent|0">Preview stan' +
        'dardized agent address</button>\n      </div><div style="width:34px"></di' +
        'v></div>\n      </div><div class="modal-f"><button class="btn btn-primary' +
        '" data-close="modal">Done</button></div></div></div>'
      );
    }
    if (WriterState.state.modal === "clear") {
      const risky = WriterState.CASES.filter((k) => services.caseUnsaved(k)),
        safe = WriterState.CASES.filter((k) => !services.caseUnsaved(k));
      return (
        '<div class="modal"><div class="modal-box" role="dialog" aria-modal="true' +
        '">\n      <div class="modal-h"><h2>Remove cases from this workspace</h2></div><di' +
        'v class="modal-b">\n      <div class="banner info"><div>This workspace is your ' +
        "working desk, not the record. Removing a case from this workspace does not delete its shared case record" +
        " &mdash; <strong>Open saved case</strong> brings it straight ba" +
        "ck.</div></div>\n      " +
        "".concat(
          safe.length
            ? '<p class="hint"><strong>' +
                `${safe.length}` +
                " case" +
                `${safe.length === 1 ? "" : "s"}` +
                " safe to remove</strong> &mdash; all current case details and issued hist" +
                "ory are saved to the share; no unfinished work remains.</p>\n        <ul " +
                'class="clearlist">' +
                "".concat(
                  safe
                    .slice(0, 12)
                    .map((k) => `<li>${esc(k.number)} &middot; ${esc(k.address)}</li>`)
                    .join(""),
                ) +
                "" +
                `${safe.length > 12 ? `<li class="muted">and ${safe.length - 12} more</li>` : ""}` +
                "</ul>"
            : "",
        ) +
        "\n      " +
        "".concat(
          risky.length
            ? '<div class="banner warn" style="margin-top:14px"><div><strong>' +
                `${risky.length}` +
                " case" +
                `${risky.length === 1 ? " has" : "s have"}` +
                " work that has not reached the share.</strong> Removing " +
                `${risky.length === 1 ? "it" : "them"}` +
                ' would lose that work.</div></div>\n        <ul class="clearlist">' +
                "".concat(
                  risky
                    .map(
                      (k) =>
                        "<li>" +
                        `${esc(k.number)}` +
                        " &middot; " +
                        `${esc(k.address)}` +
                        ' <span class="muted">&mdash; ' +
                        `${esc(services.caseUnsaved(k))}` +
                        "</span></li>",
                    )
                    .join(""),
                ) +
                "</ul>"
            : "",
        ) +
        '\n      </div><div class="modal-f">\n        <button class="btn" data-clos' +
        'e="modal">Cancel</button>\n        ' +
        "".concat(
          safe.length
            ? '<button class="btn btn-primary" data-clearcases="safe">Remove the ' +
                `${safe.length}` +
                " safe case" +
                `${safe.length === 1 ? "" : "s"}` +
                "</button>"
            : "",
        ) +
        "\n        " +
        "".concat(
          risky.length ? `<button class="btn" data-clearcases="all">Remove all ${WriterState.CASES.length}, losing that unsaved work</button>` : "",
        ) +
        "\n      </div></div></div>"
      );
    }
    if (WriterState.state.modal === "storage") {
      return (
        '<div class="modal"><div class="modal-box" role="dialog" aria-modal="true' +
        '">\n      <div class="modal-h"><h2>Where documents are going</h2></div><d' +
        'iv class="modal-b">\n      ' +
        `${services.storageReport()}` +
        "\n      " +
        "".concat(
          WriterState.CASEDIR && WriterState.DIRNAME !== services.CASEDIR_EXPECT
            ? '<div class="banner warn" style="margin-top:14px"><div><strong>Case files' +
                " are going to a folder called &ldquo;" +
                `${esc(WriterState.DIRNAME)}` +
                "&rdquo;, not &ldquo;" +
                `${esc(services.CASEDIR_EXPECT)}` +
                "&rdquo;.</strong>\n        If that is not where they belong, relink below" +
                ". Anything already written stays where it is &mdash; move those files ac" +
                "ross by hand.</div></div>"
            : "",
        ) +
        '\n      <p class="hint" style="margin-top:14px">' +
        "".concat(
          WriterState.CASEDIR && WriterState.CASEDIR.helper
            ? "Case files are saved through the local helper with a shared lock and a r" + "ecoverable previous copy. Drafts stay on this device."
            : "The browser only supplies the folder name. Write a test file to verify the destination.",
        ) +
        "</p>\n      " +
        `${services.reindexReport()}` +
        '<p><button class="btn" data-sync-safety>Back to saved work &amp; connect' +
        'ion</button></p>\n      </div><div class="modal-f">\n        ' +
        "".concat(
          WriterState.CASEDIR
            ? '<button class="btn" id="btn-reindex" ' +
                `${WriterState.state.reindex && WriterState.state.reindex.running ? "disabled" : ""}` +
                ">Rebuild reporting index</button>" +
                "".concat(
                  WriterState.CASEDIR.helper
                    ? ""
                    : '<button class="btn" id="btn-testwrite">Write a test file</button><button' +
                        ' class="btn" id="btn-linkdir">Link a different folder…</button>',
                ) +
                ""
            : `<button class="btn" id="btn-linkdir">Link the case folder…</button>`,
        ) +
        '\n        <button class="btn btn-primary" data-close="modal">Close</butto' +
        "n></div></div></div>"
      );
    }
    if (WriterState.state.modal === "folder") {
      const fs = (WriterState.state.folder || []).filter((f) => f.name.toLowerCase().includes((WriterState.state.folderQ || "").toLowerCase()));
      return (
        '<div class="modal"><div class="modal-box" role="dialog" aria-modal="true' +
        '">\n      <div class="modal-h"><h2>Open a saved case</h2></div><div class' +
        '="modal-b"><label class="f"><span>Search saved cases</span><input type="' +
        'search" id="folder-search" value="' +
        `${esc(WriterState.state.folderQ || "")}` +
        '" placeholder="Address or case number…"></label>' +
        "".concat(WriterState.state.folderError ? `<div class="banner warn">${esc(WriterState.state.folderError)}</div>` : "") +
        "\n      " +
        "".concat(
          fs.length
            ? '<div class="folderlist">' +
                "".concat(
                  fs
                    .map(
                      (f) =>
                        '<button data-openfolder="' +
                        `${esc(f.name)}` +
                        '">' +
                        `${esc(f.name.replace(/\.json$/i, ""))}` +
                        "\n        <span>" +
                        `${(f.size / 1024).toFixed(0)}` +
                        " KB &middot; " +
                        `${f.mod ? fmtDate(iso(new Date(f.mod))) : ""}` +
                        "</span></button>",
                    )
                    .join(""),
                ) +
                "</div>"
            : '<div class="banner info"><div>No case files in that folder yet.</div></div>',
        ) +
        '\n      </div><div class="modal-f"><button class="btn" data-close="modal"' +
        ">Close</button></div></div></div>"
      );
    }
    if (WriterState.state.modal !== "final") return "";
    const d = doc(WriterState.state.docId),
      ch = services.checks(d),
      bad = services.blockers(d);
    const notes = ch.filter((c) => !c.ok && c.soft);
    const ty = (DOC_TYPES.find((t) => t.id === d.type) || {}).label || "document";
    return (
      '<div class="modal"><div class="modal-box" role="dialog" aria-modal="true' +
      '">\n    <div class="modal-h"><h2>' +
      `${d.correction ? "Review correction" : "Finalize this " + esc(ty.toLowerCase())}` +
      '</h2></div><div class="modal-b">\n      ' +
      "".concat(
        d.correction
          ? "<p><strong>Reason:</strong> " +
              `${esc(d.correction.reason)}` +
              "</p>" +
              `${services.correctionDiffHTML(d)}` +
              '<p class="hint">Changed case details will also update future documents a' +
              "nd current reports. No new visit or enforcement action is counted. The p" +
              'revious version remains in history.</p><label class="correction-option">' +
              '<input type="checkbox" id="correction-reviewed" ' +
              `${d.correction.reviewed ? "checked" : ""}` +
              "> I reviewed the changes, dates and affected recipients.</label>"
          : "",
      ) +
      "\n      " +
      "".concat(
        bad.length
          ? '<div class="banner alert"><div><strong>' +
              `${bad.length}` +
              " thing" +
              `${bad.length === 1 ? "" : "s"}` +
              " to fix before this can be issued.</strong> Select a check below to go d" +
              "irectly to the field that needs attention.</div></div>"
          : notes.length
            ? '<div class="banner warn"><div><strong>Ready to issue.</strong> One thing' + " worth a second look, noted below.</div></div>"
            : '<div class="banner ok"><div>Every check passed.</div></div>',
      ) +
      "\n      " +
      // The decision: blocking failures and advisories link back to their fields; passed checks stay in the Review checklist.
      `${ch.map((c, ix) => (!c.ok ? services.checkRowHTML(c, ix) : "")).join("")}` +
      '\n      <label class="f" style="margin-top:16px"><span>Mailed d' +
      'ate</span><input type="date" id="fin-mailed" value="' +
      `${esc(d.mailed || recordDay(services.today))}` +
      '" max="' +
      `${mailingMaxDay(services.initialCitations.enabled(d) ? "citation" : d.type)}` +
      '" ' +
      `${d.correction ? "disabled" : ""}` +
      "></label>\n      " +
      "".concat(
        (function () {
          if (!WriterState.HELPER || !WriterState.HELPER.chrome) return "";
          const list = emailList(d.correction ? docCase(d) : kase(d.caseId)).filter((e) => String(e.addr || "").trim());
          if (!list.length)
            return (
              '<p class="hint" style="margin-top:14px">No email recipients on this case' +
              ". Add them under <strong>Recipients</strong> if you want this se" +
              "nt as well as filed.</p>"
            );
          return (
            '<div class="fin-send"><div class="flab">Email this document to</div>\n   ' +
            "       " +
            "".concat(
              list
                .map(
                  (e, ix) =>
                    '<label class="sendrow"><input type="checkbox" data-finsend="' +
                    `${ix}` +
                    '" ' +
                    "".concat(
                      (Array.isArray(d.emailSelection) ? d.emailSelection.includes(e.addr + "|" + (e.kind || "Other")) : e.on !== false)
                        ? "checked"
                        : "",
                    ) +
                    ">\n            <span><strong>" +
                    `${esc(e.kind || "Other")}` +
                    "</strong> " +
                    `${esc(e.addr)}` +
                    "</span></label>",
                )
                .join(""),
            ) +
            '\n          <p class="hint">Selected recipients are listed on the documen' +
            "t. An email draft opens for you to review and send." +
            "".concat(
              WriterState.HELPER.outlook === false ? " Outlook was not found, so your default mail program will open without the attachment." : "",
            ) +
            "</p></div>"
          );
        })(),
      ) +
      '\n      <p class="hint">Finalizing locks the item text, wording and numbe' +
      "ring. Two things come out of it: the printable copy for the owner, and t" +
      'he case file you reopen on your next visit, saved as <span class="mono">' +
      `${esc((kase(d.caseId).address || "PROPERTY") + " - " + (kase(d.caseId).number || "CASE"))}` +
      '.json</span>.</p></div>\n    <div class="modal-f"><button class="btn" dat' +
      'a-close="modal">' +
      `${bad.length ? "Back to the document" : "Cancel"}` +
      '</button><button class="btn" id="btn-savework">Save draft &amp; return to Workspace' +
      '</button>\n      <button class="btn btn-primary" id="fin-go" ' +
      `${bad.length ? 'disabled title="Clear the outstanding checks first"' : WriterState.AMENDMENT_BUSY || WriterState.state.publicationBusy ? 'disabled title="The save is in progress"' : ""}` +
      ">" +
      "".concat(d.correction ? "Save &amp; issue correction" : services.initialCitations.enabled(d) ? "Issue citation" : "Issue document") +
      "</button></div></div></div>"
    );
  }

  function overlayHTML() {
    return WriterState.state.modal ? modalHTML() : WriterState.state.picker ? services.pickerHTML() : "";
  }
  return { overlayHTML };
}
