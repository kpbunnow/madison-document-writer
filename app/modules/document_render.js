import { citationOnlyItem, canChooseCitationOnly, citationOnlyFollowup } from "./citation_disposition.js";
/* Document and citation-face renderers: authored notice HTML, print documents and retained court-copy definitions. */
import { mailingMaxDay, recordDay } from "../assets/shared.js";

import {
  citeAllowed,
  frozenOf,
  omitRepairDueDate,
  citationCopiesFor,
  hasOwnInsp,
  isHistoryDoc,
  alignedExtension,
  datedExtension,
  simpleVacancy,
  specialType,
} from "./document_rules.js";
import { BOXN, BOXY, countBlanks, editableBlanks, esc, money, nl2 } from "./presentation_format.js";
import { DOC_TYPES, OC_WORD, globalCourt, globalCourtContact, globalCourtInstructions } from "./document_types.js";

import { copiesOf, emailList, violatorActive } from "./mailing_rules.js";
import { defendantLines, ownerCopy, cleanOwnerCopyLines } from "./defendant_contact.js";

import { CITATION_POLICY, cents, formatDeposit, formatDollarsOnLegacyReprints } from "./citation_policy.js";
import { LOGO } from "./data/build_identity.js";
import { INSPECTORS } from "./data/inspectors.js";

/* R62 (owner, Development 3): on authoring-16 referral, referral-update and compliance documents every observation
   note prints under the violation, oldest first, as on an Extension. Notes on corrected items print as well: the
   approved print style hides notes on corrected rows, so these notes keep an explicit display. */
/* The mailing block comes from the Violator contact when one is set, so it is not edited on the document. */
const mailingBlockEdit = (k, ce) => (violatorActive(k) ? "" : ce);
const mailingBlockNote = (k) =>
  violatorActive(k)
    ? '<p class="hint no-print" id="mailing-from-violator">This address block is the Violator contact. Change it in Recipients; the property owner stays in the case record.</p>'
    : "";
/* A copy prints its name and address lines; the property owner copy brings its own lines. */
const ccEntryLines = (services, c, draft) => c.lines || services.ccLines(c, draft);
const ccRoleHTML = (c) => (c.agent ? '<div class="cc-role">Registered agent</div>' : c.owner ? '<div class="cc-role">Property owner</div>' : "");

/* Owner lines an issued document retained: the current fact for every owner line, or the earlier CC-only fact. */
const retainedOwnerLines = (d, key) => (Array.isArray(frozenOf(d)?.[key]) ? frozenOf(d)[key] : undefined);
/* Mailing block and citation defendant: drafts print a repeated owner address line once; issued documents print what
   they retained, or their original lines. */
const printedDefendantLines = (d, k) => defendantLines(k, !!d.draft, retainedOwnerLines(d, "ownerMailingLines"));

/* New drafts clean the derived CC; issued documents use their retained fact or the original legacy lines. */
function documentOwnerCopy(d, k) {
  const owner = ownerCopy(k);
  if (!owner) return null;
  if (d.draft) return ownerCopy(k, cleanOwnerCopyLines(k));
  const retained = retainedOwnerLines(d, "ownerMailingLines") || retainedOwnerLines(d, "ownerCopyLines");
  return retained ? ownerCopy(k, retained) : owner;
}

/* A corrected item shows its confirmation date. A Reinspection Notice shows every due date as assigned, never as an input. */
const dueIsFinal = (d, it) => it.done || d.type === "reinspectionNotice";
const finalDueCell = (services, it) =>
  it.done
    ? `<span class="done-note"><strong>Corrected</strong>${esc(services.fmtDate(it.doneOn))}</span>`
    : `<span class="mono">${esc(services.fmtDate(it.due))}</span>`;

function noticeDueSelectHTML(row) {
  const { it, num, dueSelection, dueSelected } = row;
  return dueSelection && it.dueExempt !== "snow-10.28" && !citationOnlyItem(it)
    ? '<input type="checkbox" tabindex="-1" class="no-print due-pick" style="margin:0 6px 0 0;vertical-align:middle" data-due-select="' +
        esc(it.id) +
        '" aria-label="Select item ' +
        esc(num) +
        ' for a shared due date" title="Select for a shared due date" ' +
        (dueSelected.has(it.id) ? "checked" : "") +
        ">"
    : "";
}

function noticeAffectedHTML(row) {
  const { d, it, num, affectedRows } = row;
  return affectedRows
    ? '<label class="no-print affected-pick" style="display:block;margin:0 0 4px;font-size:12px;white-space:nowrap">' +
        '<input type="checkbox" style="margin:0 5px 0 0;vertical-align:middle" data-special-item="' +
        esc(String(it.no)) +
        '" ' +
        ((d.special?.affected || []).includes(String(it.no)) ? "checked" : "") +
        ' aria-label="Item ' +
        esc(num) +
        ' is affected by this extension">Affected</label>'
    : "";
}

function noticeDueDisabled(row) {
  const { d, it, dis } = row;
  return (
    dis || (datedExtension(d) && !d.special?.affected?.includes(String(it.no)) ? 'disabled title="Only affected items receive a new due date"' : "")
  );
}

function noticeDueInputs(services, row) {
  const { d, it, num } = row;
  const option = canChooseCitationOnly(d, it)
    ? '<select class="d-in no-print" tabindex="-1" data-citation-disposition="' +
      esc(it.id) +
      '" aria-label="Due date option for item ' +
      esc(num) +
      '"><option value="date">Due date</option><option value="citation-only"' +
      (citationOnlyItem(it) ? " selected" : "") +
      ">Citation only — no follow-up</option></select>"
    : "";
  if (citationOnlyItem(it)) return option;
  return (
    option +
    noticeDueSelectHTML(row) +
    noticeAffectedHTML(row) +
    '<input type="date"' +
    (d.draft && !row.locked ? ' tabindex="-1"' : "") +
    ' class="d-in due-in" data-field="due" data-id="' +
    `${esc(it.id)}` +
    '" value="' +
    `${esc(it.due || "")}` +
    '" min="' +
    `${d.correction ? "" : services.MINDUE()}` +
    '" aria-label="Due date for item ' +
    `${esc(num)}` +
    '" ' +
    `${noticeDueDisabled(row)}` +
    ">"
  );
}

function noticeDueHistory(services, row, referralHistoryHTML) {
  const { d, it } = row;
  return d.authoringVersion >= 14
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
        "</span>";
}

function noticeDueValue(services, row, referralHistoryHTML) {
  const { d, it } = row;
  if (citationOnlyFollowup(d) && citationOnlyItem(it) && !it.withdrawn)
    return '<span class="done-note"><strong>Closed by initial citation</strong>No follow-up required</span>';
  return "".concat(
    it.withdrawn
      ? `<span class="done-note withdrawn-note"><strong>Withdrawn</strong>Entered in error</span>` +
          (services.hasItemInspectionHistory(d) ? referralHistoryHTML(d, it) : "")
      : isHistoryDoc(d) || services.hasItemInspectionHistory(d)
        ? noticeDueHistory(services, row, referralHistoryHTML)
        : noticeOpenDueValue(services, row),
  );
}

function noticeConditionalDue(row) {
  const { d, it, aligned } = row;
  return aligned && d.type === "vacancyExtension" && d.special?.deadlineMode === "conditional" && d.special.affected?.includes(String(it.no));
}

// The due cell of an item that is neither withdrawn nor shown with its inspection history.
function noticeOpenDueValue(services, row) {
  const { d, it } = row;
  return d.type === "compliance"
    ? `<span class="mono">${esc(services.fmtDate(it.doneOn || it.due))}</span>`
    : dueIsFinal(d, it)
      ? finalDueCell(services, it)
      : simpleVacancy(d)
        ? "" // R62: uncorrected items on a Vacancy Extension have no due date.
        : noticeConditionalDue(row)
          ? '<span class="conditional-due">Conditional — see conditions above</span>'
          : noticeDueInputs(services, row);
}

function noticeNumberCell(row) {
  const { d, it, ix, struct, num, b } = row;
  return (
    '<td class="c-no">' +
    "\n        " +
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
    "</span></td>\n      "
  );
}

function noticeSectionsCell(row) {
  const { d, it, rce } = row;
  return (
    '<td class="c-sec">' +
    '<div class="sec-list ed" ' +
    `${rce}` +
    (rce && d.draft ? ' tabindex="-1"' : "") +
    ' data-field="sections" data-id="' +
    `${esc(it.id)}` +
    '" data-ph="section">' +
    `${it.sections.map((x) => esc(d.authoringVersion >= 9 ? it.printedReferences?.[x] || x : x)).join("<br>")}` +
    "</div></td>\n      "
  );
}

function noticeAbatementCell(row) {
  const { d, it, dis } = row;
  return (
    '<td class="c-ab">' +
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
    "</td>\n      "
  );
}

function noticeActionCell(services, row, historyNotesHTML) {
  const { d, it, rce } = row;
  return (
    '<td class="corr">' +
    "".concat(it.withdrawn ? `<p class="withdrawn-note"><strong>Withdrawn as entered in error.</strong> ${esc(it.withdrawalReason || "")}</p>` : "") +
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
    (!row.dueColumn && d.draft ? '<div class="no-print">' + noticeDueValue(services, row, () => "") + noticeDueActions(row) + "</div>" : "") +
    "</td>\n      "
  );
}

function noticeCitationCell(row) {
  const { d, it, citeColumn } = row;
  return (
    "".concat(
      !citeColumn
        ? ""
        : !it.done && (citeAllowed(d) || it.cite)
          ? '<td class="c-cite no-print"><label title="Issue a citation with this not' +
            'ice"><input type="checkbox" tabindex="-1" data-notecite="' +
            `${esc(it.id)}` +
            '" ' +
            `${it.cite ? "checked" : ""}` +
            "><span>Cite</span></label></td>"
          : '<td class="c-cite no-print"></td>',
    ) + "\n      "
  );
}

function noticeDueCell(services, row, referralHistoryHTML) {
  if (!row.dueColumn) return "";
  return '<td class="c-due">' + noticeDueValue(services, row, referralHistoryHTML) + "\n        " + noticeDueActions(row) + "</td>";
}

function noticeDueActions(row) {
  const { d, it, num, locked, struct } = row;
  return (
    "".concat(
      d.correction && !locked
        ? '<button class="lnk no-print" data-withdraw="' + `${esc(it.id)}` + '">' + `${it.withdrawn ? "Restore item" : "Withdraw item"}` + "</button>"
        : "",
    ) +
    "".concat(
      struct
        ? '<button class="rm no-print" data-del="' +
            `${esc(it.id)}` +
            '" aria-label="Remove item ' +
            `${esc(num)}` +
            '" title="Remove this item">&times;</button>'
        : "",
    )
  );
}

const noticeRowNumber = (struct, it, ix) => (struct ? String(ix + 1) : it.no || String(ix + 1));
const noticeRowLocked = (d, it) => (it.done && !d.correction) || it.withdrawn;
const noticeRowDone = (d, it) => (it.done && d.type !== "compliance") || (d.correction && it.withdrawn);

function noticeRows(services, d, context, historyNotesHTML, referralHistoryHTML) {
  const { aligned, ce, dis, struct, citeColumn, dueColumn, dueSelection, dueSelected, affectedRows, locked } = context;
  let last = null;
  return d.items
    .map((it, ix) => {
      let head = "";
      const g = (it.group || "").trim();
      if (g !== last) {
        last = g;
        if (g)
          head =
            '<tr class="grp"><td colspan="' +
            (dueColumn ? 5 : 4 + Number(citeColumn)) +
            '"><span class="ed" ' +
            `${ce}` +
            ' data-field="group" data-id="' +
            `${esc(it.id)}` +
            '">' +
            `${esc(g)}` +
            "</span></td></tr>";
      }
      const b = countBlanks(it.text);
      const num = noticeRowNumber(struct, it, ix);
      const rce = noticeRowLocked(d, it) ? "" : ce;
      const row = { d, it, ix, num, b, rce, struct, dis, citeColumn, dueColumn, locked, aligned, dueSelected, dueSelection, affectedRows };
      return (
        head +
        '<tr data-row="' +
        `${esc(it.id)}` +
        '" class="' +
        `${noticeRowDone(d, it) ? "done" : ""}` +
        '">\n      ' +
        noticeNumberCell(row) +
        noticeSectionsCell(row) +
        noticeAbatementCell(row) +
        noticeActionCell(services, row, historyNotesHTML) +
        noticeCitationCell(row) +
        noticeDueCell(services, row, referralHistoryHTML) +
        "</tr>"
      );
    })
    .join("");
}

function noticeCopiesHTML(services, d, k) {
  // the agent is served a copy as a matter of course
  const ag = services.agentLines(k);
  const cc = [documentOwnerCopy(d, k), ...copiesOf(k)]
    .filter((c) => c && ccEntryLines(services, c, !!d.draft).length)
    .concat(ag.length ? [{ name: ag[0], addr: ag[1] || "", city: ag[2] || "", agent: true }] : []);
  const mailRows = noticeMailRows(d, k);
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
                    `${ccEntryLines(services, c, !!d.draft)
                      .map((l) => `<div>${esc(l)}</div>`)
                      .join("")}` +
                    "" +
                    `${ccRoleHTML(c)}` +
                    "</div>",
                )
                .join(""),
            ) +
            "</div></div>"
        : "",
    ) +
    "\n        " +
    "".concat(noticeMailRowHTML(d, mailRows)) +
    "\n      </div>"
  );
}

// The email recipients shown under the copies: those selected on a draft, those prepared on an issued document.
function noticeMailRows(d, k) {
  const sent = d.emailedTo || [],
    draftMail = d.draft
      ? emailList(k).filter(
          (e) => e.on !== false && (!Array.isArray(d.emailSelection) || d.emailSelection.includes(e.addr + "|" + (e.kind || "Other"))),
        )
      : [];
  return (d.draft ? draftMail : sent).filter((e) => String(e.addr || "").trim());
}

function noticeMailRowHTML(d, mailRows) {
  return mailRows.length
    ? '<div class="cc-row cc-mail"><span class="cc-l">' +
        `${d.draft ? "Email recipients:" : "Email copy prepared for:"}` +
        '</span><div class="cc-set">' +
        `${mailRows.map((e) => `<div>${esc(e.kind || "Other")} &mdash; ${esc(e.addr)}</div>`).join("")}` +
        "</div></div>"
    : "";
}

function noticeTitleHTML(d, aligned) {
  const ty = DOC_TYPES.find((x) => x.id === d.type) || {};
  if (!ty.pfx) return "Building Inspection Official Notice";
  return ty.stacked && !aligned
    ? `<span class="pfx">${esc(ty.pfx)}</span><br>${esc(ty.heading || "Building Inspection Official Notice")}`
    : `<span class="pfx">${esc(ty.pfx)} - </span>Building Inspection Official Notice`;
}

function noticeInspectionFieldsHTML(d, k, dis) {
  return hasOwnInsp(d)
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
        ">";
}

function noticeHeaderHTML(services, d, k, i, context) {
  const { aligned, ce, dis, locked, presentation } = context;
  return (
    '<div class="n-head">' +
    '<img class="n-seal" src="' +
    `${LOGO}` +
    '" alt="City of Madison Building Inspection">\n      <div class="n-headmain"><div class="n-title' +
    `${!aligned && (DOC_TYPES.find((x) => x.id === d.type) || {}).stacked ? " stacked" : ""}` +
    '"' +
    (aligned ? ' style="font-size:11pt!important"' : "") +
    ">" +
    "".concat(noticeTitleHTML(presentation, aligned)) +
    '</div>\n      <div class="n-meta">\n        <dl class="n-col">\n          <dt>Case number:</dt><dd><strong class="ed" ' +
    `${ce}` +
    ' data-case="number" aria-readonly="' +
    `${services.eventsFor(d.caseId).length ? "true" : "false"}` +
    '">' +
    `${esc(k.number)}` +
    "</strong></dd>\n          <dt>Inspection date:</dt><dd>" +
    "".concat(noticeInspectionFieldsHTML(d, k, dis)) +
    '</dd>\n          <dt>Mailed date:</dt><dd><input type="date" class="d-in hdr-in" data-doc="mailed" value="' +
    `${esc(d.mailed || "")}` +
    '" max="' +
    `${mailingMaxDay(services.initialCitations.enabled(d) ? "citation" : d.type)}` +
    '" aria-label="Mailed date" ' +
    `${dis}` +
    '></dd>\n        </dl>\n        <dl class="n-col">\n          <dt>Property:</dt><dd><strong class="ed" ' +
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
    "</div></dd>\n        </dl>\n      </div></div></div>\n\n    "
  );
}

function noticeMailingHTML(services, d, k, ce) {
  return (
    '<div class="n-owner">' +
    '<div class="ed" ' +
    `${mailingBlockEdit(k, ce)}` +
    ' data-case="ownerBlock" data-ph="Owner and mailing address" style="white-space:pre-wrap">' +
    `${esc(printedDefendantLines(d, k).join("\n"))}` +
    "</div>" +
    mailingBlockNote(k) +
    '</div>\n    <div class="win-note no-print">Envelope window</div>\n    <div class="n-winspace" aria-hidden="true"></div>\n\n    ' +
    `${services.revisionPrintNote(d)}` +
    "\n    "
  );
}

function noticeTableHTML(services, d, rows, citeColumn, dueColumn) {
  return (
    '<table class="notice"><thead><tr><th class="c-no">Item No.</th><th class="c-sec">Violation Section No.</th><th class="c-ab">Abate</th><th>Corrections Required</th>' +
    `${citeColumn ? '<th class="c-cite no-print">Cite</th>' : ""}` +
    (dueColumn
      ? '<th class="c-due">' +
        `${services.hasItemInspectionHistory(d) ? "Inspection History" : isHistoryDoc(d) ? "" : d.type === "compliance" ? "Date Complied" : "Due Date"}` +
        "</th>"
      : "") +
    "</tr></thead>\n      <tbody>" +
    "".concat(rows || '<tr class="n-empty"><td colspan="6">No items yet — use Violation Items to add violations.</td></tr>') +
    "</tbody></table>"
  );
}

function finishNoticeHTML(services, d, result, aligned) {
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

const noticeShowsSigner = (d, aligned) => aligned && !(d.type === "bestInterestExtension" && d.authoringVersion >= 15) && !simpleVacancy(d);
// The frozen authorized signer's field, else the draft's own, else the blank mark.
const noticeSignerField = (d, key, draftKey) => (d.correction ? null : frozenOf(d)?.authorizedSigner)?.[key] || d.special?.[draftKey] || "◯";

function noticeSignerHTML(d, aligned) {
  return noticeShowsSigner(d, aligned)
    ? '<div class="extension-signer"><p>' +
        esc(noticeSignerField(d, "name", "signerName")) +
        "\n" +
        esc(noticeSignerField(d, "title", "signerTitle")) +
        "</p></div>"
    : "";
}

function renderHistoryNotes(services, d, it) {
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

const referralDate = (services, on) => (services.validISO(on) ? services.fmtDate(on) : "Date unavailable");

// Whole days between the first observation and correction (or the latest visit); null when the dates do not support it.
function referralDaysOutstanding(services, history, it) {
  const dates = history.map((x) => x.on),
    end = it.done ? it.doneOn : dates.at(-1),
    start = dates[0];
  const valid =
    dates.length &&
    dates.every(services.validISO) &&
    services.validISO(end) &&
    end >= start &&
    (!it.done || history.some((x) => x.oc === "corrected" && x.on === end));
  return valid ? (Date.parse(end + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) / 86400000 : null;
}

function referralOutcomeWord(d, x) {
  return x.oc === "initial" ? "First observed" : d.authoringVersion >= 15 && x.oc === "corrected" ? "CORRECTED" : OC_WORD[x.oc] || x.oc;
}

function referralEntryHTML(services, d, x) {
  return (
    "<span><b>" +
    esc(referralDate(services, x.on)) +
    "</b><em>" +
    esc(referralOutcomeWord(d, x)) +
    "</em>" +
    (x.cit ? "<i>Citation " + esc(x.cit) + "</i>" : "") +
    // R62: authoring-16 notes print under the violation, not in the history column.
    (x.note && d.authoringVersion < 16 ? "<em>Note: " + esc(x.note) + "</em>" : "") +
    "</span>"
  );
}

// A correction the history does not show as an observation (always before authoring 15).
function referralCorrectionHTML(services, d, it, history) {
  if (!(it.done && !it.withdrawn && (d.authoringVersion < 15 || !history.some((x) => x.oc === "corrected" && x.on === it.doneOn)))) return "";
  return d.authoringVersion >= 15
    ? "<span><b>" + esc(referralDate(services, it.doneOn)) + "</b><em>CORRECTED</em><em>Correction observation unavailable</em></span>"
    : '<span class="done-note"><strong>Corrected</strong>' + esc(referralDate(services, it.doneOn)) + "</span>";
}

function renderReferralHistory(services, d, it) {
  const history = services
    .documentItemHistory(d, it)
    .slice()
    .sort((a, b) => String(a.on || "").localeCompare(String(b.on || "")));
  const days = referralDaysOutstanding(services, history, it);
  return (
    '<span class="visit-list" style="white-space:normal;overflow-wrap:anywhere">' +
    (history.length ? history.map((x) => referralEntryHTML(services, d, x)).join("") : "<span>Inspection history unavailable</span>") +
    referralCorrectionHTML(services, d, it, history) +
    "<span><strong>Days Outstanding: " +
    (it.withdrawn || days === null ? "Unavailable" : days) +
    "</strong></span></span>"
  );
}

const noticeDueSelectable = (services, d, locked) => d.type === "notice" && !locked && !d.correction && !services.snow.is(d);

function noticeVoidHTML(services, d) {
  return d.void
    ? '<div class="void-wm" aria-hidden="true"><span>VOID</span></div>\n      <d' +
        'iv class="void-note">Voided ' +
        `${esc(services.fmtDate(recordDay(d.void.at)))}` +
        "" +
        `${d.void.reason ? " &mdash; " + esc(d.void.reason) : ""}` +
        "</div>"
    : "";
}

function noticeRuledHTML(d) {
  return d.type !== "compliance" && d.items.some((x) => x.done)
    ? '<p class="n-ruled">Items already corrected are listed below ruled throug' +
        "h, with the date we confirmed them. The remaining items are still outsta" +
        "nding.</p>"
    : "";
}

function noticeNotesHTML(blocks) {
  return blocks.length ? `<div class="n-notes">${blocks.map((b) => `<h4>${esc(b.label)}</h4><div>${nl2(b.text)}</div>`).join("")}</div>` : "";
}

function renderNoticeSheet(services, d) {
  const aligned = alignedExtension(d);
  const presentation = services.initialCitations.enabled(d) && d.authoringVersion >= 11 ? services.initialCitations.preview(d) : d;
  const dueColumn = !omitRepairDueDate(d);
  const k = services.docCase(d),
    i = services.docInsp(d),
    blocks = services.docBlocks(d),
    locked = services.isLocked(d);
  const ce = locked ? "" : 'contenteditable="true"';
  const dis = locked ? "disabled" : "";
  // while the first notice is still a draft the numbering follows the order;
  // after it is issued the stored number is what the owner has in hand
  const struct = services.structEditable(d);
  // One condition for the Cite heading and every row's cell, so the columns stay aligned when only an old mark remains.
  const citeColumn = struct && (citeAllowed(d) || d.items.some((i) => i.cite));
  /* Editable-draft controls beside each row's due date (never on issued, locked or correction documents):
   on a new Official Notice, a selection for a shared due date (the Assign due dates bar applies it);
   on an authoring-13 Best Interest or Vacancy Extension, the affected-item selection. */
  const dueSelection = noticeDueSelectable(services, d, locked),
    dueSelected = new Set(d.dueWork?.selected || []),
    affectedRows = services.newDocuments.rowAffectedSelection(d);
  const rows = noticeRows(
    services,
    d,
    { aligned, ce, dis, struct, citeColumn, dueColumn, dueSelection, dueSelected, affectedRows, locked },
    (d, it) => renderHistoryNotes(services, d, it),
    (d, it) => renderReferralHistory(services, d, it),
  );

  const result =
    '<div class="sheet' +
    `${d.void ? " voided" : ""}` +
    '">\n    ' +
    "".concat(noticeVoidHTML(services, d)) +
    "\n    " +
    noticeHeaderHTML(services, d, k, i, { aligned, ce, dis, locked, presentation }) +
    noticeMailingHTML(services, d, k, ce) +
    '<div class="n-body">' +
    `${services.docBody(presentation)}` +
    "</div>\n\n\n    " +
    "".concat(noticeRuledHTML(d)) +
    "\n    " +
    noticeTableHTML(services, d, rows, citeColumn, dueColumn) +
    "\n    " +
    noticeSignerHTML(d, aligned) +
    "\n    " +
    "".concat(noticeCopiesHTML(services, d, k)) +
    "\n    " +
    "".concat(noticeNotesHTML(blocks)) +
    '\n    <div class="n-foot"><span class="mono">' +
    `${esc(k.number)}` +
    "</span></div>\n  </div>";
  return finishNoticeHTML(services, d, result, aligned);
}

function renderDocumentSheet(services, d) {
  return renderNoticeSheet(services, d) + (d.type === "citation" ? renderCitationFaces(services, d, true) : "");
}

function renderCitField(services, d, iid, f, ph, locked) {
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

function renderCitAmount(d, it) {
  // Rendering retained documents never recalculates or changes their evidence.
  const amount = ((d.cits || {})[it.id] || {}).amount;
  return d.authoringVersion >= 7 || formatDollarsOnLegacyReprints ? formatDeposit(amount) : String(amount ?? "");
}

// The court printed on the face: the frozen one, else the current court (room and label from authoring 9).
function citationCourt(source, d) {
  return (
    source.court ||
    (d.authoringVersion >= 9 ? { ...globalCourt(), room: "RM#203,", caseNumberLabel: CITATION_POLICY.mc2000CaseNumberLabel } : globalCourt())
  );
}

const citationNeedsDeposit = (d, x) => !(d.authoringVersion >= 8 && d.cits?.[x.id]?.mandatoryAppearance) && !(cents(d.cits?.[x.id]?.amount) > 0);

function renderCitationFaces(services, d, locked) {
  locked = true;
  const source = frozenOf(d) || {},
    COURT = citationCourt(source, d),
    CIT_COPIES = citationCopiesFor(d),
    CIT_INSTRUCTIONS = source.courtInstructions || globalCourtInstructions(),
    COURT_CONTACT = source.courtContact || globalCourtContact();

  const k = services.docCase(d),
    i = services.docInsp(d);
  const cited = d.items.filter((x) => x.cite && !x.withdrawn);
  if (cited.some((x) => citationNeedsDeposit(d, x)))
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
  const addr = printedDefendantLines(d, k).slice(1).join(", ");
  const face = (it, copy) => {
    const c = (d.cits || {})[it.id] || {};
    return citationFaceHTML(services, { d, it, copy, c, locked, k, i, addr, COURT, CIT_INSTRUCTIONS, COURT_CONTACT });
  };
  return cited.map((it) => CIT_COPIES.map((cp) => face(it, cp)).join("")).join("");
}

function citationFaceHTML(services, face) {
  return (
    citationFacePart1(services, face) +
    citationFacePart2(services, face) +
    citationFacePart3(services, face) +
    citationFacePart4(services, face) +
    citationFacePart5(services, face)
  );
}

function citationFaceClasses(services, d) {
  return (
    `${d.authoringVersion >= 9 ? " cit-v9" : ""}` +
    "" +
    `${d.authoringVersion >= 9 && services.snow.is(d) ? " cit-snow" : ""}` +
    "" +
    `${d.authoringVersion >= 7 || formatDollarsOnLegacyReprints ? " cit-dollar" : ""}`
  );
}

// A mandatory appearance, as recorded from the given authoring version on.
const citationMandatory = (d, c, fromVersion) => d.authoringVersion >= fromVersion && c.mandatoryAppearance;
const citationCourtHour = (services, c) => +(services.parseTime(c.courtTime) || "00:00").slice(0, 2);

// Citation face, part 1 of 5 (concatenated in order by citationFaceHTML).
function citationFacePart1(services, face) {
  const { d, it, c, locked, COURT } = face;
  return (
    '<section class="cit' +
    citationFaceClasses(services, d) +
    '"><div class="cit-form">\n\n    <div class="cit-bar">\n      <div class="ci' +
    't-idbar"><span class="cit-no">' +
    `${renderCitField(services, d, it.id, "num", "Citation number", locked)}` +
    '</span>\n        <span class="cit-title">WISCONSIN UNIFORM MUNICIPAL<br>C' +
    'OURT CITATION AND COMPLAINT</span></div>\n      <div class="cit-juv">' +
    `${BOXY}` +
    ' Juvenile</div>\n      <div class="cit-dep"><div class="cit-dep-l">Deposi' +
    't Permitted</div>\n        <div class="amt' +
    `${citationMandatory(d, c, 9) ? " cit-mandatory" : ""}` +
    '">' +
    "".concat(esc(citationMandatory(d, c, 9) ? "NONE – MANDATORY APPEARANCE" : renderCitAmount(d, it))) +
    '</div></div>\n      <div class="cit-tender"><div>' +
    `${BOXY}` +
    " Cash</div><div>" +
    `${BOXY}` +
    ' Card</div></div>\n      <div class="cit-cfu">(For court use only)</div>\n' +
    '    </div>\n\n    <div class="cit-cols">\n      <div class="cit-l">\n       ' +
    ' <div class="cit-h">You Are Notified To Appear</div>\n        <div class=' +
    '"cit-sm">Is this a mandatory appearance? &nbsp; ' +
    `${citationMandatory(d, c, 8) ? BOXN : BOXY}` +
    " Yes &nbsp; " +
    `${citationMandatory(d, c, 8) ? BOXY : BOXN}` +
    ' No</div>\n        <div class="cit-sm">(Read the reverse side of this cit' +
    'ation for court information)</div>\n        <div class="cit-dt"><b>Date:<' +
    "/b>" +
    `${renderCitField(services, d, it.id, "courtDate", "00/00/0000", locked)}` +
    '</div>\n        <div class="cit-dt"><b>Time:</b>' +
    `${renderCitField(services, d, it.id, "courtTime", "09:30 AM", locked)}` +
    "\n          <span>" +
    `${citationCourtHour(services, c) < 12 ? BOXN : BOXY}` +
    " AM &nbsp; " +
    `${citationCourtHour(services, c) >= 12 ? BOXN : BOXY}` +
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
    's"><span class="cit-lab">Defendant Name - Last</span><span class="cit-la'
  );
}

// Citation face, part 2 of 5 (concatenated in order by citationFaceHTML).
function citationFacePart2(services, face) {
  const { d, it, c, locked, k, addr } = face;
  return (
    'b">First</span><span class="cit-lab">MI</span></div>\n          <div clas' +
    's="v">' +
    `${esc(printedDefendantLines(d, k)[0] || "")}` +
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
    `${renderCitField(services, d, it.id, "ord", "Ordinance number", locked)}` +
    '</div></div>\n          <div><span class="cit-lab">Adopting State Statute' +
    ' No.</span>\n            <div class="v">' +
    `${renderCitField(services, d, it.id, "statute", "", locked)}` +
    "</div></div>\n        </div></div>\n      </div>\n    </div>\n\n    <div clas" +
    's="cit-desc"><span class="cit-lab">Description of Violation</span>\n     ' +
    ' <div class="v">' +
    `${renderCitField(services, d, it.id, "desc", "e.g. IMPROPER MAINTENANCE OF EXTERIOR PROPERTY AREA", locked)}` +
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
    'n>\n        <div class="v agent">'
  );
}

const citationCaseNumberLabel = (d, COURT) =>
  d.authoringVersion >= 9 ? COURT.caseNumberLabel || CITATION_POLICY.mc2000CaseNumberLabel : "Agency Case Number";

// The recorded department ID, else the inspector's badge in an editable field.
function citationDeptIdHTML(services, d, it, i, locked) {
  return ((d.cits || {})[it.id] || {}).deptId
    ? renderCitField(services, d, it.id, "deptId", "0000", locked)
    : '<span class="ed cf" ' +
        `${locked ? "" : 'contenteditable="true"'}` +
        ' data-cit="' +
        `${esc(it.id)}` +
        '|deptId" data-ph="0000">' +
        `${esc(i.badge || "")}` +
        "</span>";
}

// Citation face, part 3 of 5 (concatenated in order by citationFaceHTML).
function citationFacePart3(services, face) {
  const { d, it, locked, k, i, COURT } = face;
  return (
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
    "".concat(citationDeptIdHTML(services, d, it, i, locked)) +
    '</div></div>\n      <div><span class="cit-lab">Date Citation Issued</span' +
    '><div class="v">' +
    `${renderCitField(services, d, it.id, "issued", services.fmtDate(d.mailed || ""), locked)}` +
    '</div></div>\n      <div><span class="cit-lab">' +
    "".concat(esc(citationCaseNumberLabel(d, COURT))) +
    '</span><div class="v">' +
    `${esc(k.number || "")}` +
    "</div></div>\n    </div>\n\n    </div>\n    "
  );
}

// One assessment line: dollar-formatted from authoring 8, as a plain amount before.
const citationAssessmentAmount = (d, cents) =>
  d.authoringVersion >= 8 ? formatDeposit((cents / 100).toFixed(2)) || "$0.00" : "$" + money(cents / 100);

function citationAssessmentsHTML(d, c) {
  return c.assessments
    ? '<div class="cit-assessments">Base ' +
        "".concat(citationAssessmentAmount(d, c.assessments.base)) +
        " · Penalty " +
        "".concat(citationAssessmentAmount(d, c.assessments.penalty)) +
        " · Jail " +
        "".concat(citationAssessmentAmount(d, c.assessments.jail)) +
        " · Crime lab " +
        "".concat(citationAssessmentAmount(d, c.assessments.crimeLab)) +
        " · Court " +
        "".concat(citationAssessmentAmount(d, c.assessments.court)) +
        "</div>"
    : "";
}

const citationFootRevision = (d) => (d.revision ? ` · Corrected rev. ${esc(d.revision.number)} · ${esc(d.id)}` : d.draft ? " · DRAFT" : "");

function citationCommentHTML(services, face) {
  const { d, it, copy, c, locked } = face;
  return copy.comment || (d.authoringVersion === 9 && services.snow.is(d))
    ? '<div class="cit-cmt"><div class="cit-lab">VIOLATION COMMENT:</div>\n     ' +
        ' <span class="ed" ' +
        `${locked ? "" : 'contenteditable="true"'}` +
        ' data-cit="' +
        `${esc(it.id)}` +
        '|comment" data-ph="Inspection history: initial inspection, notice issued' +
        ', reinspection findings">' +
        `${esc(c.comment || "")}` +
        "</span></div>"
    : "";
}

// Citation face, part 4 of 5 (concatenated in order by citationFaceHTML).
function citationFacePart4(services, face) {
  const { d, copy, c } = face;
  return (
    "".concat(citationAssessmentsHTML(d, c)) +
    '\n    <div class="cit-foot"><span>MC-2000, 02/06' +
    "".concat(citationFootRevision(d)) +
    "</span><span>" +
    `${esc(copy.label)}` +
    "</span></div>\n    " +
    "".concat(citationCommentHTML(services, face)) +
    "\n    "
  );
}

// Citation face, part 5 of 5 (concatenated in order by citationFaceHTML).
function citationFacePart5(services, face) {
  const { copy, CIT_INSTRUCTIONS, COURT_CONTACT } = face;
  return (
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
}

export function createDocumentRenderer(services) {
  /* R42 presentation only: storage/publication and fixed print construction stay in their owners.
     The renderers are module functions below; this owner binds them to its scoped services. */
  return {
    documentHTML: (d) => renderDocumentSheet(services, d),
    citationFaces: (d, locked) => renderCitationFaces(services, d, locked),
    noticeHTML: (d) => renderNoticeSheet(services, d),
    citAmount: (d, it) => renderCitAmount(d, it),
    referralHistoryHTML: (d, it) => renderReferralHistory(services, d, it),
  };
}
