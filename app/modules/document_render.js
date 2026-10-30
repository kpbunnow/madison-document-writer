/* Document and citation-face renderers: authored notice HTML, print documents and the four court copies. */
import { mailingMaxDay, recordDay } from "../assets/shared.js";

import { citeAllowed, frozenOf, hasOwnInsp, isHistoryDoc, alignedExtension, datedExtension, simpleVacancy, specialType } from "./document_rules.js";
import { BOXN, BOXY, countBlanks, editableBlanks, esc, money, nl2 } from "./presentation_format.js";
import { DOC_TYPES, OC_WORD, globalCourt, globalCourtContact, globalCourtCopies, globalCourtInstructions } from "./document_types.js";

import { ccList, emailList, ownerLines } from "./mailing_rules.js";

import { CITATION_POLICY, cents, formatDeposit, formatDollarsOnLegacyReprints } from "./citation_policy.js";
import { LOGO } from "./data/build_identity.js";
import { INSPECTORS } from "./data/inspectors.js";

/* R62 (owner, Development 3): on authoring-16 referral, referral-update and compliance documents every observation
   note prints under the violation, oldest first, as on an Extension. Notes on corrected items print as well: the
   approved print style hides notes on corrected rows, so these notes keep an explicit display. */
/* A corrected item shows its confirmation date. A Reinspection Notice shows every due date as assigned, never as an input. */
const dueIsFinal = (d, it) => it.done || d.type === "reinspectionNotice";
const finalDueCell = (services, it) =>
  it.done
    ? `<span class="done-note"><strong>Corrected</strong>${esc(services.fmtDate(it.doneOn))}</span>`
    : `<span class="mono">${esc(services.fmtDate(it.due))}</span>`;

export function createDocumentRenderer(services) {
  function historyNotesHTML(d, it) {
    return services
      .documentItemHistory(d, it)
      .filter((x) => x.note)
      .slice()
      .sort((a, b) => String(a.on || "").localeCompare(String(b.on || "")))
      .map(
        (x) =>
          '<div class="it-note" data-history-note style="display:block"><span class="it-note-h">Inspector\'s note &middot; ' +
          esc(services.validISO(x.on) ? services.fmtDate(x.on) : "Date unavailable") +
          "</span>" +
          esc(x.note) +
          "</div>",
      )
      .join("");
  }

  function referralHistoryHTML(d, it) {
    const history = services
      .documentItemHistory(d, it)
      .slice()
      .sort((a, b) => String(a.on || "").localeCompare(String(b.on || "")));
    const dates = history.map((x) => x.on),
      end = it.done ? it.doneOn : dates.at(-1),
      start = dates[0];
    const valid =
      dates.length &&
      dates.every(services.validISO) &&
      services.validISO(end) &&
      end >= start &&
      (!it.done || history.some((x) => x.oc === "corrected" && x.on === end));
    const days = valid ? (Date.parse(end + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) / 86400000 : null;
    return (
      '<span class="visit-list" style="white-space:normal;overflow-wrap:anywhere">' +
      (history.length
        ? history
            .map(
              (x) =>
                "<span><b>" +
                esc(services.validISO(x.on) ? services.fmtDate(x.on) : "Date unavailable") +
                "</b><em>" +
                esc(x.oc === "initial" ? "First observed" : d.authoringVersion >= 15 && x.oc === "corrected" ? "CORRECTED" : OC_WORD[x.oc] || x.oc) +
                "</em>" +
                (x.cit ? "<i>Citation " + esc(x.cit) + "</i>" : "") +
                // R62: authoring-16 notes print under the violation, not in the history column.
                (x.note && d.authoringVersion < 16 ? "<em>Note: " + esc(x.note) + "</em>" : "") +
                "</span>",
            )
            .join("")
        : "<span>Inspection history unavailable</span>") +
      (it.done && !it.withdrawn && (d.authoringVersion < 15 || !history.some((x) => x.oc === "corrected" && x.on === it.doneOn))
        ? d.authoringVersion >= 15
          ? "<span><b>" +
            esc(services.validISO(it.doneOn) ? services.fmtDate(it.doneOn) : "Date unavailable") +
            "</b><em>CORRECTED</em><em>Correction observation unavailable</em></span>"
          : '<span class="done-note"><strong>Corrected</strong>' +
            esc(services.validISO(it.doneOn) ? services.fmtDate(it.doneOn) : "Date unavailable") +
            "</span>"
        : "") +
      "<span><strong>Days Outstanding: " +
      (it.withdrawn || days === null ? "Unavailable" : days) +
      "</strong></span></span>"
    );
  }

  function noticeHTML(d) {
    const aligned = alignedExtension(d);
    const k = services.docCase(d),
      i = services.docInsp(d),
      blocks = services.docBlocks(d),
      locked = services.isLocked(d);
    const ce = locked ? "" : 'contenteditable="true"';
    const dis = locked ? "disabled" : "";
    let last = null;
    // while the first notice is still a draft the numbering follows the order;
    // after it is issued the stored number is what the owner has in hand
    const struct = services.structEditable(d);
    // One condition for the Cite heading and every row's cell, so the columns stay aligned when only an old mark remains.
    const citeColumn = struct && (citeAllowed(d) || d.items.some((i) => i.cite));
    /* Editable-draft controls beside each row's due date (never on issued, locked or correction documents):
     on a new Official Notice, a selection for a shared due date (the Assign due dates bar applies it);
     on an authoring-13 Best Interest or Vacancy Extension, the affected-item selection. */
    const dueSelection = d.type === "notice" && !locked && !d.correction && !services.snow.is(d),
      dueSelected = new Set(d.dueWork?.selected || []),
      affectedRows = services.newDocuments.rowAffectedSelection(d);
    const rows = d.items
      .map((it, ix) => {
        let head = "";
        const g = (it.group || "").trim();
        if (g !== last) {
          last = g;
          if (g)
            head =
              '<tr class="grp"><td colspan="5"><span class="ed" ' +
              `${ce}` +
              ' data-field="group" data-id="' +
              `${esc(it.id)}` +
              '">' +
              `${esc(g)}` +
              "</span></td></tr>";
        }
        const b = countBlanks(it.text);
        const num = struct ? String(ix + 1) : it.no || String(ix + 1);
        const rce = (it.done && !d.correction) || it.withdrawn ? "" : ce;
        return (
          head +
          ('<tr data-row="' +
            `${esc(it.id)}` +
            '" class="' +
            `${(it.done && d.type !== "compliance") || (d.correction && it.withdrawn) ? "done" : ""}` +
            '">\n      <td class="c-no">\n        ' +
            "".concat(
              struct
                ? '<span class="grip no-print" data-grip="' +
                    `${esc(it.id)}` +
                    '" role="button" tabindex="0" aria-label="Reorder item ' +
                    `${esc(num)}` +
                    '; use up or down arrow" title="Drag or use arrow keys to reorder">&#1026' +
                    '2;</span><button class="gbtn no-print" data-move="' +
                    `${esc(it.id)}` +
                    '" data-direction="up" aria-label="Move item ' +
                    `${esc(num)}` +
                    ' up" ' +
                    `${ix === 0 ? "disabled" : ""}` +
                    '>↑</button><button class="gbtn no-print" data-move="' +
                    `${esc(it.id)}` +
                    '" data-direction="down" aria-label="Move item ' +
                    `${esc(num)}` +
                    ' down" ' +
                    `${ix === d.items.length - 1 ? "disabled" : ""}` +
                    '>↓</button>\n          <button class="gbtn no-print" data-grpbtn="' +
                    `${esc(it.id)}` +
                    '" aria-label="Location heading for item ' +
                    `${esc(num)}` +
                    '" title="Location heading">&#9143;</button>'
                : "",
            ) +
            '\n        <span class="num">' +
            `${esc(num)}` +
            '.</span>\n        <span class="bl" data-blanks="' +
            `${esc(it.id)}` +
            '" style="' +
            `${b ? "" : "display:none"}` +
            '">' +
            `${b}` +
            "&nbsp;blank" +
            `${b === 1 ? "" : "s"}` +
            '</span></td>\n      <td class="c-sec"><div class="sec-list ed" ' +
            `${rce}` +
            ' data-field="sections" data-id="' +
            `${esc(it.id)}` +
            '" data-ph="section">' +
            `${it.sections.map((x) => esc(d.authoringVersion >= 9 ? it.printedReferences?.[x] || x : x)).join("<br>")}` +
            '</div></td>\n      <td class="c-ab">' +
            "".concat(
              d.type === "compliance" && d.authoringVersion >= 15
                ? `<span class="ab-fixed">${typeof it.abate === "boolean" ? (it.abate ? "Yes" : "No") : "Unavailable"}</span>`
                : it.done
                  ? "&mdash;"
                  : d.type !== "notice"
                    ? `<span class="ab-fixed">${it.abate ? "Yes" : "No"}</span>`
                    : '<button class="ab-btn" data-abate="' +
                      `${esc(it.id)}` +
                      '" data-on="' +
                      `${it.abate ? 1 : 0}` +
                      '" ' +
                      `${dis}` +
                      ">" +
                      `${it.abate ? "Yes" : "No"}` +
                      "</button>",
            ) +
            '</td>\n      <td class="corr">' +
            "".concat(
              it.withdrawn ? `<p class="withdrawn-note"><strong>Withdrawn as entered in error.</strong> ${esc(it.withdrawalReason || "")}</p>` : "",
            ) +
            '<div class="ed" ' +
            `${rce}` +
            ' data-field="text" data-id="' +
            `${esc(it.id)}` +
            '" data-ph="Corrective action" style="white-space:pre-wrap">' +
            `${editableBlanks(it.text)}` +
            "</div>" +
            `${d.draft ? services.catalogDraftNotice(it) : ""}` +
            "\n        " +
            "".concat(
              isHistoryDoc(d) || services.hasItemInspectionHistory(d)
                ? d.authoringVersion >= 16
                  ? historyNotesHTML(d, it)
                  : (d.authoringVersion >= 14 ? [] : services.documentItemHistory(d, it))
                      .filter((x) => x.note)
                      .map(
                        (x) =>
                          '<div class="it-note"><span class="it-note-h">Inspector\'s note &middot; ' +
                          `${esc(services.fmtDate(x.on))}` +
                          "</span>" +
                          `${esc(x.note)}` +
                          "</div>",
                      )
                      .join("")
                : it.note
                  ? '<div class="it-note"><span class="it-note-h">Inspector\'s note &middot; ' +
                    `${esc(services.fmtDate(it.noteOn))}` +
                    '</span><span class="ed" ' +
                    `${rce}` +
                    ' data-field="note" data-id="' +
                    `${esc(it.id)}` +
                    '" style="white-space:pre-wrap">' +
                    `${esc(it.note)}` +
                    "</span></div>"
                  : "",
            ) +
            "</td>\n      " +
            "".concat(
              !citeColumn
                ? ""
                : !it.done && (citeAllowed(d) || it.cite)
                  ? '<td class="c-cite no-print"><label title="Issue a citation with this not' +
                    'ice"><input type="checkbox" data-notecite="' +
                    `${esc(it.id)}` +
                    '" ' +
                    `${it.cite ? "checked" : ""}` +
                    "><span>Cite</span></label></td>"
                  : '<td class="c-cite no-print"></td>',
            ) +
            '\n      <td class="c-due">' +
            "".concat(
              it.withdrawn
                ? `<span class="done-note withdrawn-note"><strong>Withdrawn</strong>Entered in error</span>` +
                    (services.hasItemInspectionHistory(d) ? referralHistoryHTML(d, it) : "")
                : isHistoryDoc(d) || services.hasItemInspectionHistory(d)
                  ? d.authoringVersion >= 14
                    ? referralHistoryHTML(d, it)
                    : it.done
                      ? `<span class="done-note"><strong>Corrected</strong>${esc(services.fmtDate(it.doneOn))}</span>`
                      : '<span class="visit-list">' +
                        "".concat(
                          services.documentItemHistory(d, it).length
                            ? services
                                .documentItemHistory(d, it)
                                .map(
                                  (x) =>
                                    `<span><b>${esc(services.fmtDate(x.on))}</b><em>${esc(OC_WORD[x.oc] || x.oc)}</em>${
                                      x.cit ? `<i>Citation ${esc(x.cit)}</i>` : ""
                                    }</span>`,
                                )
                                .join("")
                            : '<span class="muted">no reinspection recorded</span>',
                        ) +
                        "</span>"
                  : d.type === "compliance"
                    ? `<span class="mono">${esc(services.fmtDate(it.doneOn || it.due))}</span>`
                    : dueIsFinal(d, it)
                      ? finalDueCell(services, it)
                      : simpleVacancy(d)
                        ? "" // R62: uncorrected items on a Vacancy Extension have no due date.
                        : aligned &&
                            d.type === "vacancyExtension" &&
                            d.special?.deadlineMode === "conditional" &&
                            d.special.affected?.includes(String(it.no))
                          ? '<span class="conditional-due">Conditional — see conditions above</span>'
                          : (dueSelection && it.dueExempt !== "snow-10.28"
                              ? '<input type="checkbox" class="no-print due-pick" style="margin:0 6px 0 0;vertical-align:middle" data-due-select="' +
                                esc(it.id) +
                                '" aria-label="Select item ' +
                                esc(num) +
                                ' for a shared due date" title="Select for a shared due date" ' +
                                (dueSelected.has(it.id) ? "checked" : "") +
                                ">"
                              : "") +
                            (affectedRows
                              ? '<label class="no-print affected-pick" style="display:block;margin:0 0 4px;font-size:12px;white-space:nowrap">' +
                                '<input type="checkbox" style="margin:0 5px 0 0;vertical-align:middle" data-special-item="' +
                                esc(String(it.no)) +
                                '" ' +
                                ((d.special?.affected || []).includes(String(it.no)) ? "checked" : "") +
                                ' aria-label="Item ' +
                                esc(num) +
                                ' is affected by this extension">Affected</label>'
                              : "") +
                            '<input type="date" class="d-in due-in" data-field="due" data-id="' +
                            `${esc(it.id)}` +
                            '" value="' +
                            `${esc(it.due || "")}` +
                            '" min="' +
                            `${d.correction ? "" : services.MINDUE()}` +
                            '" aria-label="Due date for item ' +
                            `${esc(num)}` +
                            '" ' +
                            `${dis || (datedExtension(d) && !d.special?.affected?.includes(String(it.no)) ? 'disabled title="Only affected items receive a new due date"' : "")}` +
                            ">",
            ) +
            "\n        " +
            "".concat(
              d.correction && !locked
                ? '<button class="lnk no-print" data-withdraw="' +
                    `${esc(it.id)}` +
                    '">' +
                    `${it.withdrawn ? "Restore item" : "Withdraw item"}` +
                    "</button>"
                : "",
            ) +
            "" +
            "".concat(
              struct
                ? '<button class="rm no-print" data-del="' +
                    `${esc(it.id)}` +
                    '" aria-label="Remove item ' +
                    `${esc(num)}` +
                    '" title="Remove this item">&times;</button>'
                : "",
            ) +
            "</td></tr>")
        );
      })
      .join("");

    const result =
      '<div class="sheet' +
      `${d.void ? " voided" : ""}` +
      '">\n    ' +
      "".concat(
        d.void
          ? '<div class="void-wm" aria-hidden="true"><span>VOID</span></div>\n      <d' +
              'iv class="void-note">Voided ' +
              `${esc(services.fmtDate(recordDay(d.void.at)))}` +
              "" +
              `${d.void.reason ? " &mdash; " + esc(d.void.reason) : ""}` +
              "</div>"
          : "",
      ) +
      '\n    <div class="n-head"><img class="n-seal" src="' +
      `${LOGO}` +
      '" alt="City of Madison Building Inspection">\n      <div class="n-headmai' +
      'n"><div class="n-title' +
      `${!aligned && (DOC_TYPES.find((x) => x.id === d.type) || {}).stacked ? " stacked" : ""}` +
      '"' +
      (aligned ? ' style="font-size:11pt!important"' : "") +
      ">" +
      "".concat(
        (function () {
          const ty = DOC_TYPES.find((x) => x.id === d.type) || {};
          if (!ty.pfx) return "Building Inspection Official Notice";
          return ty.stacked && !aligned
            ? `<span class="pfx">${esc(ty.pfx)}</span><br>${esc(ty.heading || "Building Inspection Official Notice")}`
            : `<span class="pfx">${esc(ty.pfx)} - </span>Building Inspection Official Notice`;
        })(),
      ) +
      '</div>\n      <div class="n-meta">\n        <dl class="n-col">\n          <' +
      'dt>Case number:</dt><dd><strong class="ed" ' +
      `${ce}` +
      ' data-case="number" aria-readonly="' +
      `${services.eventsFor(d.caseId).length ? "true" : "false"}` +
      '">' +
      `${esc(k.number)}` +
      "</strong></dd>\n          <dt>Inspection date:</dt><dd>" +
      "".concat(
        hasOwnInsp(d)
          ? '<input type="date" class="d-in hdr-in" data-doc="inspDate" value="' +
              `${esc(d.inspDate || "")}` +
              '" aria-label="Inspection date" ' +
              `${dis}` +
              '><input type="time" class="d-in hdr-in hdr-time" data-doc="inspTime" val' +
              'ue="' +
              `${esc(d.inspTime || "")}` +
              '" aria-label="Inspection time" ' +
              `${dis}` +
              ">"
          : '<input type="date" class="d-in hdr-in" data-case="date" value="' +
              `${esc(k.date || "")}` +
              '" aria-label="Inspection date" ' +
              `${dis}` +
              '><input type="time" class="d-in hdr-in hdr-time" data-case="time" value=' +
              '"' +
              `${esc(k.time || "")}` +
              '" aria-label="Inspection time" ' +
              `${dis}` +
              ">",
      ) +
      '</dd>\n          <dt>Mailed date:</dt><dd><input type="date" class="d-in ' +
      'hdr-in" data-doc="mailed" value="' +
      `${esc(d.mailed || "")}` +
      '" max="' +
      `${mailingMaxDay(services.initialCitations.enabled(d) ? "citation" : d.type)}` +
      '" aria-label="Mailed date" ' +
      `${dis}` +
      '></dd>\n        </dl>\n        <dl class="n-col">\n          <dt>Property:<' +
      '/dt><dd><strong class="ed" ' +
      `${ce}` +
      ' data-case="address">' +
      `${esc(k.address)}` +
      "</strong></dd>\n          <dt>Inspector:</dt><dd>" +
      "".concat(
        locked
          ? `<span class="n-insp-name">${esc(i.name)}</span>`
          : '<select class="d-in hdr-in" data-doc="inspectorId" aria-label="Signing i' +
              'nspector">' +
              "".concat(INSPECTORS.map((x) => `<option value="${x.id}" ${i.id === x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")) +
              "</select>",
      ) +
      '\n            <div class="n-insp-l">' +
      `${esc(i.title)}` +
      '</div>\n            <div class="n-insp-l">' +
      `${esc(i.phone)}` +
      '</div>\n            <div class="n-insp-l">' +
      `${esc(i.email)}` +
      '</div></dd>\n        </dl>\n      </div></div></div>\n\n    <div class="n-ow' +
      'ner"><div class="ed" ' +
      `${ce}` +
      ' data-case="ownerBlock" data-ph="Owner and mailing address" style="white' +
      '-space:pre-wrap">' +
      `${esc(ownerLines(k).join("\n"))}` +
      "</div>" +
      '</div>\n    <div class="win-note no-print">Envelope window</div>\n    <div' +
      ' class="n-winspace" aria-hidden="true"></div>\n\n    ' +
      `${services.revisionPrintNote(d)}` +
      '\n    <div class="n-body">' +
      `${services.docBody(d)}` +
      "</div>\n\n\n    " +
      "".concat(
        d.type !== "compliance" && d.items.some((x) => x.done)
          ? '<p class="n-ruled">Items already corrected are listed below ruled throug' +
              "h, with the date we confirmed them. The remaining items are still outsta" +
              "nding.</p>"
          : "",
      ) +
      '\n    <table class="notice"><thead><tr><th class="c-no">Item No.</th><th ' +
      'class="c-sec">Violation Section No.</th><th class="c-ab">Abate</th><th>C' +
      "orrections Required</th>" +
      `${citeColumn ? '<th class="c-cite no-print">Cite</th>' : ""}` +
      '<th class="c-due">' +
      `${services.hasItemInspectionHistory(d) ? "Inspection History" : isHistoryDoc(d) ? "" : d.type === "compliance" ? "Date Complied" : "Due Date"}` +
      "</th></tr></thead>\n      <tbody>" +
      "".concat(rows || '<tr class="n-empty"><td colspan="6">No items yet — use Violation Items to add violations.</td></tr>') +
      "</tbody></table>\n    " +
      (aligned && !(d.type === "bestInterestExtension" && d.authoringVersion >= 15) && !simpleVacancy(d)
        ? '<div class="extension-signer"><p>' +
          esc((d.correction ? null : frozenOf(d)?.authorizedSigner)?.name || d.special?.signerName || "◯") +
          "\n" +
          esc((d.correction ? null : frozenOf(d)?.authorizedSigner)?.title || d.special?.signerTitle || "◯") +
          "</p></div>"
        : "") +
      "\n    " +
      "".concat(
        (function () {
          // the agent is served a copy as a matter of course
          const ag = services.agentLines(k);
          const cc = ccList(k)
            .filter((c) => services.ccLines(c, !!d.draft).length)
            .concat(ag.length ? [{ name: ag[0], addr: ag[1] || "", city: ag[2] || "", agent: true }] : []);
          const sent = d.emailedTo || [],
            draftMail = d.draft
              ? emailList(k).filter(
                  (e) => e.on !== false && (!Array.isArray(d.emailSelection) || d.emailSelection.includes(e.addr + "|" + (e.kind || "Other"))),
                )
              : [],
            mailRows = (d.draft ? draftMail : sent).filter((e) => String(e.addr || "").trim());
          if (!cc.length && !mailRows.length) return "";
          return (
            '<div class="n-cc">\n        ' +
            "".concat(
              cc.length
                ? '<div class="cc-row"><span class="cc-l">CC:</span><div class="cc-set">' +
                    "".concat(
                      cc
                        .map(
                          (c) =>
                            '<div class="cc-one">' +
                            `${services
                              .ccLines(c, !!d.draft)
                              .map((l) => `<div>${esc(l)}</div>`)
                              .join("")}` +
                            "" +
                            `${c.agent ? '<div class="cc-role">Registered agent</div>' : ""}` +
                            "</div>",
                        )
                        .join(""),
                    ) +
                    "</div></div>"
                : "",
            ) +
            "\n        " +
            "".concat(
              mailRows.length
                ? '<div class="cc-row cc-mail"><span class="cc-l">' +
                    `${d.draft ? "Email recipients:" : "Email copy prepared for:"}` +
                    '</span><div class="cc-set">' +
                    `${mailRows.map((e) => `<div>${esc(e.kind || "Other")} &mdash; ${esc(e.addr)}</div>`).join("")}` +
                    "</div></div>"
                : "",
            ) +
            "\n      </div>"
          );
        })(),
      ) +
      "\n    " +
      "".concat(
        blocks.length ? `<div class="n-notes">${blocks.map((b) => `<h4>${esc(b.label)}</h4><div>${nl2(b.text)}</div>`).join("")}</div>` : "",
      ) +
      '\n    <div class="n-foot"><span class="mono">' +
      `${esc(k.number)}` +
      "</span></div>\n  </div>";
    if (services.snow.is(d) && d.authoringVersion >= 9)
      return result
        .replace('<div class="n-body">', '<div class="n-body snow-cover">')
        .replace(/<table class="notice">[\s\S]*?<\/table>/, "")
        .replace(/<div class="addwrap no-print">[\s\S]*?<\/div>/, "");
    if (!specialType(d.type) || aligned) return result;
    const narrative = services.docBody(d).match(/<p>[\s\S]*?<\/p>/g) || [];
    return result
      .replace('<div class="n-head">', '<div class="n-head r26-header">')
      .replace(/<div class="n-body">[\s\S]*?<\/div>/, '<div class="n-body"></div>')
      .replace(/<p class="n-ruled">[\s\S]*?<\/p>/, "")
      .replace(
        /<table class="notice">[\s\S]*?<\/table>/,
        '<table class="notice r26-narrative"><thead><tr><th aria-label="Order and conditions"></th></tr></thead><tbody>' +
          narrative.map((p) => "<tr><td>" + p + "</td></tr>").join("") +
          "</tbody></table>",
      );
  }

  function documentHTML(d) {
    return noticeHTML(d) + (d.type === "citation" ? citationFaces(d, true) : "");
  }

  function citField(d, iid, f, ph, locked) {
    const raw = ((d.cits || {})[iid] || {})[f] ?? "";
    const v = ["courtDate", "issued"].includes(f)
      ? services.fmtDate(raw)
      : f === "courtTime"
        ? services.fmtTime(raw)
        : f === "ord" && d.authoringVersion >= 8
          ? String(raw).replace(/^SPS(?=\d)/, "SPS ")
          : raw;
    return (
      '<span class="ed cf" ' +
      `${locked ? "" : 'contenteditable="true"'}` +
      ' data-cit="' +
      `${esc(iid)}` +
      "|" +
      `${esc(f)}` +
      '" data-ph="' +
      `${esc(ph)}` +
      '">' +
      `${esc(v)}` +
      "</span>"
    );
  }

  function citAmount(d, it) {
    // Rendering retained documents never recalculates or changes their evidence.
    const amount = ((d.cits || {})[it.id] || {}).amount;
    return d.authoringVersion >= 7 || formatDollarsOnLegacyReprints ? formatDeposit(amount) : String(amount ?? "");
  }

  function citationFaces(d, locked) {
    locked = true;
    const source = frozenOf(d) || {},
      COURT =
        source.court ||
        (d.authoringVersion >= 9 ? { ...globalCourt(), room: "RM#203,", caseNumberLabel: CITATION_POLICY.mc2000CaseNumberLabel } : globalCourt()),
      CIT_COPIES = source.courtCopies || globalCourtCopies(),
      CIT_INSTRUCTIONS = source.courtInstructions || globalCourtInstructions(),
      COURT_CONTACT = source.courtContact || globalCourtContact();

    const k = services.docCase(d),
      i = services.docInsp(d);
    const cited = d.items.filter((x) => x.cite && !x.withdrawn);
    if (cited.some((x) => !(d.authoringVersion >= 8 && d.cits?.[x.id]?.mandatoryAppearance) && !(cents(d.cits?.[x.id]?.amount) > 0)))
      return (
        '<p class="banner alert no-print">Citation needs deposit. <button class="btn" data-open-deposit="' +
        esc(d.id) +
        '">Complete deposit</button></p>'
      );
    if (!cited.length) return "";
    if (d.draft && cited.some((it) => d.cits?.[it.id]?.mandatoryAppearance))
      return (
        '<p class="banner alert no-print">Mandatory-appearance citation preview i' +
        "s on hold until the division approves defendant instructions. Your draft" +
        " is retained.</p>"
      );
    const addr = ownerLines(k).slice(1).join(", ");
    const face = (it, copy) => {
      const c = (d.cits || {})[it.id] || {};
      return (
        '<section class="cit' +
        `${d.authoringVersion >= 9 ? " cit-v9" : ""}` +
        "" +
        `${d.authoringVersion >= 9 && services.snow.is(d) ? " cit-snow" : ""}` +
        "" +
        `${d.authoringVersion >= 7 || formatDollarsOnLegacyReprints ? " cit-dollar" : ""}` +
        '"><div class="cit-form">\n\n    <div class="cit-bar">\n      <div class="ci' +
        't-idbar"><span class="cit-no">' +
        `${citField(d, it.id, "num", "Citation number", locked)}` +
        '</span>\n        <span class="cit-title">WISCONSIN UNIFORM MUNICIPAL<br>C' +
        'OURT CITATION AND COMPLAINT</span></div>\n      <div class="cit-juv">' +
        `${BOXY}` +
        ' Juvenile</div>\n      <div class="cit-dep"><div class="cit-dep-l">Deposi' +
        't Permitted</div>\n        <div class="amt' +
        `${d.authoringVersion >= 9 && c.mandatoryAppearance ? " cit-mandatory" : ""}` +
        '">' +
        "".concat(esc(d.authoringVersion >= 9 && c.mandatoryAppearance ? "NONE – MANDATORY APPEARANCE" : citAmount(d, it))) +
        '</div></div>\n      <div class="cit-tender"><div>' +
        `${BOXY}` +
        " Cash</div><div>" +
        `${BOXY}` +
        ' Card</div></div>\n      <div class="cit-cfu">(For court use only)</div>\n' +
        '    </div>\n\n    <div class="cit-cols">\n      <div class="cit-l">\n       ' +
        ' <div class="cit-h">You Are Notified To Appear</div>\n        <div class=' +
        '"cit-sm">Is this a mandatory appearance? &nbsp; ' +
        `${d.authoringVersion >= 8 && c.mandatoryAppearance ? BOXN : BOXY}` +
        " Yes &nbsp; " +
        `${d.authoringVersion >= 8 && c.mandatoryAppearance ? BOXY : BOXN}` +
        ' No</div>\n        <div class="cit-sm">(Read the reverse side of this cit' +
        'ation for court information)</div>\n        <div class="cit-dt"><b>Date:<' +
        "/b>" +
        `${citField(d, it.id, "courtDate", "00/00/0000", locked)}` +
        '</div>\n        <div class="cit-dt"><b>Time:</b>' +
        `${citField(d, it.id, "courtTime", "09:30 AM", locked)}` +
        "\n          <span>" +
        `${+(services.parseTime(c.courtTime) || "00:00").slice(0, 2) < 12 ? BOXN : BOXY}` +
        " AM &nbsp; " +
        `${+(services.parseTime(c.courtTime) || "00:00").slice(0, 2) >= 12 ? BOXN : BOXY}` +
        ' PM</span></div>\n        <div class="cit-court">' +
        `${esc(COURT.name)}` +
        "<br>" +
        `${esc(COURT.room)}` +
        "<br>" +
        `${esc(COURT.addr)}` +
        "<br>" +
        `${esc(COURT.city)}` +
        '</div>\n        <div class="cit-sm">Plaintiff: &nbsp; ' +
        `${BOXN}` +
        " City &nbsp; " +
        `${BOXY}` +
        " Village &nbsp; " +
        `${BOXY}` +
        ' Town</div>\n        <div class="cit-sm">OF: MADISON</div>\n      </div>\n ' +
        '     <div class="cit-r">\n        <div class="cit-f"><div class="cit-cell' +
        's"><span class="cit-lab">Defendant Name - Last</span><span class="cit-la' +
        'b">First</span><span class="cit-lab">MI</span></div>\n          <div clas' +
        's="v">' +
        `${esc(ownerLines(k)[0] || "")}` +
        '</div></div>\n        <div class="cit-f"><div class="cit-cells"><span cla' +
        'ss="cit-lab">Street Address</span><span class="cit-lab">Post Office</spa' +
        'n><span class="cit-lab">State</span><span class="cit-lab">Zip Code</span' +
        '></div>\n          <div class="v">' +
        `${esc(addr)}` +
        '</div></div>\n        <div class="cit-f"><div class="cit-cells"><span cla' +
        'ss="cit-lab">Driver License Number or Other I.D. (specify)</span><span c' +
        'lass="cit-lab">State</span><span class="cit-lab">Exp Yr.</span></div></d' +
        'iv>\n        <div class="cit-f"><div class="cit-cells"><span class="cit-l' +
        'ab">Date of Birth</span><span class="cit-lab">Sex</span><span class="cit' +
        '-lab">Race</span><span class="cit-lab">Height</span><span class="cit-lab' +
        '">Weight</span><span class="cit-lab">Hair</span><span class="cit-lab">Ey' +
        'es</span></div></div>\n        <div class="cit-f"><div class="cit-cells">' +
        '<span class="cit-lab">License Plate Number</span><span class="cit-lab">P' +
        'late Type</span><span class="cit-lab">State</span><span class="cit-lab">' +
        'Exp Yr.</span></div></div>\n        <div class="cit-f" style="border-bott' +
        'om:0"><div class="cit-ord">\n          <div><span class="cit-lab">Defenda' +
        'nt Violated: &nbsp; Ordinance No.</span>\n            <div class="v">' +
        `${citField(d, it.id, "ord", "Ordinance number", locked)}` +
        '</div></div>\n          <div><span class="cit-lab">Adopting State Statute' +
        ' No.</span>\n            <div class="v">' +
        `${citField(d, it.id, "statute", "", locked)}` +
        "</div></div>\n        </div></div>\n      </div>\n    </div>\n\n    <div clas" +
        's="cit-desc"><span class="cit-lab">Description of Violation</span>\n     ' +
        ' <div class="v">' +
        `${citField(d, it.id, "desc", "e.g. IMPROPER MAINTENANCE OF EXTERIOR PROPERTY AREA", locked)}` +
        '</div></div>\n\n    <div class="cit-mid">\n      <div class="cit-mid-l">\n  ' +
        '      <div class="cit-when">\n          <div><div class="cit-cells"><span' +
        ' class="cit-lab">Week Day</span><span class="cit-lab">Month - Day - Year' +
        '</span><span class="cit-lab">Time</span></div>\n            <div class="v' +
        '">' +
        `${esc(services.longDate(c.violDate || services.inspAt(d).date))}` +
        " " +
        `${esc(services.fmtTime(c.violTime || services.inspAt(d).time))}` +
        '</div></div>\n          <div><span class="cit-lab">At:</span> <span class' +
        '="v">' +
        `${esc(k.address || "")}` +
        '</span>\n            <div class="cit-lab" style="margin-top:3px">County: ' +
        '<span class="v">Dane</span></div></div>\n        </div>\n        <div clas' +
        's="cit-served">\n          <div>Citation Served: &nbsp; ' +
        `${BOXY}` +
        " Personally &nbsp;&nbsp; " +
        `${BOXN}` +
        " Mailed to defendant&rsquo;s last known address</div>\n          <div>" +
        `${BOXY}` +
        " Left with person residing at defendant&rsquo;s residence: &nbsp; Name _" +
        "_____________________ &nbsp; Age ____</div>\n        </div>\n      </div>\n" +
        '      <div class="cit-agent"><span class="cit-lab">Registered Agent</spa' +
        'n>\n        <div class="v agent">' +
        `${
          services
            .agentLines(k, !!d.draft)
            .map((l) => `<div>${esc(l)}</div>`)
            .join("") || "&nbsp;"
        }` +
        '</div></div>\n    </div>\n\n    <div class="cit-sign">\n      <div><span cla' +
        'ss="cit-lab">Print Officer Name</span><div class="v">' +
        `${esc(i.name || "")}` +
        '</div></div>\n      <div><span class="cit-lab">Department</span><div clas' +
        's="v">Building Inspection</div></div>\n      <div><span class="cit-lab">I' +
        '.D. No.</span><div class="v">' +
        "".concat(
          ((d.cits || {})[it.id] || {}).deptId
            ? citField(d, it.id, "deptId", "0000", locked)
            : '<span class="ed cf" ' +
                `${locked ? "" : 'contenteditable="true"'}` +
                ' data-cit="' +
                `${esc(it.id)}` +
                '|deptId" data-ph="0000">' +
                `${esc(i.badge || "")}` +
                "</span>",
        ) +
        '</div></div>\n      <div><span class="cit-lab">Date Citation Issued</span' +
        '><div class="v">' +
        `${citField(d, it.id, "issued", services.fmtDate(d.mailed || ""), locked)}` +
        '</div></div>\n      <div><span class="cit-lab">' +
        "".concat(esc(d.authoringVersion >= 9 ? COURT.caseNumberLabel || CITATION_POLICY.mc2000CaseNumberLabel : "Agency Case Number")) +
        '</span><div class="v">' +
        `${esc(k.number || "")}` +
        "</div></div>\n    </div>\n\n    </div>\n    " +
        "".concat(
          c.assessments
            ? '<div class="cit-assessments">Base ' +
                "".concat(
                  d.authoringVersion >= 8 ? formatDeposit((c.assessments.base / 100).toFixed(2)) || "$0.00" : "$" + money(c.assessments.base / 100),
                ) +
                " · Penalty " +
                "".concat(
                  d.authoringVersion >= 8
                    ? formatDeposit((c.assessments.penalty / 100).toFixed(2)) || "$0.00"
                    : "$" + money(c.assessments.penalty / 100),
                ) +
                " · Jail " +
                "".concat(
                  d.authoringVersion >= 8 ? formatDeposit((c.assessments.jail / 100).toFixed(2)) || "$0.00" : "$" + money(c.assessments.jail / 100),
                ) +
                " · Crime lab " +
                "".concat(
                  d.authoringVersion >= 8
                    ? formatDeposit((c.assessments.crimeLab / 100).toFixed(2)) || "$0.00"
                    : "$" + money(c.assessments.crimeLab / 100),
                ) +
                " · Court " +
                "".concat(
                  d.authoringVersion >= 8 ? formatDeposit((c.assessments.court / 100).toFixed(2)) || "$0.00" : "$" + money(c.assessments.court / 100),
                ) +
                "</div>"
            : "",
        ) +
        '\n    <div class="cit-foot"><span>MC-2000, 02/06' +
        "".concat(d.revision ? ` · Corrected rev. ${esc(d.revision.number)} · ${esc(d.id)}` : d.draft ? " · DRAFT" : "") +
        "</span><span>" +
        `${esc(copy.label)}` +
        "</span></div>\n    " +
        "".concat(
          copy.comment || (d.authoringVersion === 9 && services.snow.is(d))
            ? '<div class="cit-cmt"><div class="cit-lab">VIOLATION COMMENT:</div>\n     ' +
                ' <span class="ed" ' +
                `${locked ? "" : 'contenteditable="true"'}` +
                ' data-cit="' +
                `${esc(it.id)}` +
                '|comment" data-ph="Inspection history: initial inspection, notice issued' +
                ', reinspection findings">' +
                `${esc(c.comment || "")}` +
                "</span></div>"
            : "",
        ) +
        "\n    " +
        "".concat(
          copy.record
            ? '<div class="cit-rec">\n      <div class="cit-rec-h">' +
                `${esc(copy.record)}` +
                '</div>\n      <div class="cit-rec-g">\n        <div>\n          <div class=' +
                '"cit-rec-f">Date of Disposition</div>\n          <div class="cit-rec-f">P' +
                'LEA:</div>\n          <div class="cit-rec-o">' +
                `${BOXY}` +
                " Guilty &nbsp; " +
                `${BOXY}` +
                " No Contest &nbsp; " +
                `${BOXY}` +
                ' Not Guilty</div>\n          <div class="cit-rec-f">Other Disposition:</d' +
                'iv>\n          <div class="cit-rec-f last">Court Officer:</div>\n        <' +
                '/div>\n        <div>\n          <div class="cit-rec-f">FINDING:</div>\n    ' +
                '      <div class="cit-rec-o">' +
                `${BOXY}` +
                " Guilty &nbsp;&nbsp; " +
                `${BOXY}` +
                ' Dismissed</div>\n          <div class="cit-rec-o">' +
                `${BOXY}` +
                " Default &nbsp; " +
                `${BOXY}` +
                ' Forfeiture</div>\n          <div class="cit-rec-o">' +
                `${BOXY}` +
                ' Not Guilty &nbsp; $ ____________</div>\n          <div class="cit-rec-f ' +
                'last">Comments:</div>\n        </div>\n      </div></div>'
            : "",
        ) +
        "\n    " +
        "".concat(
          copy.instructions
            ? '<div class="cit-inst">\n      <div class="cit-inst-h">INSTRUCTIONS &ndash' +
                "; READ CAREFULLY</div>\n      " +
                `${CIT_INSTRUCTIONS}` +
                '\n      <div class="cit-inst-c">\n        <div>' +
                `${esc(COURT_CONTACT.name)}` +
                "<br>" +
                `${esc(COURT_CONTACT.addr)}` +
                "<br>" +
                `${esc(COURT_CONTACT.city)}` +
                "</div>\n        <div>" +
                `${esc(COURT_CONTACT.phone)}` +
                "<br>" +
                `${esc(COURT_CONTACT.fax)}` +
                "<br>" +
                `${esc(COURT_CONTACT.email)}` +
                "</div>\n      </div></div>"
            : "",
        ) +
        "\n    </section>"
      );
    };
    return cited.map((it) => CIT_COPIES.map((cp) => face(it, cp)).join("")).join("");
  }

  /* R42 presentation only: storage/publication and fixed print construction stay in their owners. */

  return { documentHTML, citationFaces, noticeHTML, citAmount, referralHistoryHTML };
}
