/* Document and citation-face renderers: authored notice HTML, print documents and the four court copies. */
import { mailingMaxDay as dep_mailingMaxDay, recordDay as dep_recordDay } from "../assets/shared.js";
import {
  fmtDate as dep_fmtDate,
  fmtTime as dep_fmtTime,
  inspAt as dep_inspAt,
  longDate as dep_longDate,
  parseTime as dep_parseTime,
} from "./court_and_deposits.js";
import { documentItemHistory as dep_documentItemHistory, revisionPrintNote as dep_revisionPrintNote } from "./issuance_and_corrections.js";
import { catalogDraftNotice as dep_catalogDraftNotice } from "./language_catalog.js";
import {
  BOXN as dep_BOXN,
  BOXY as dep_BOXY,
  DOC_TYPES as dep_DOC_TYPES,
  MINDUE as dep_MINDUE,
  OC_WORD as dep_OC_WORD,
  agentLines as dep_agentLines,
  ccLines as dep_ccLines,
  ccList as dep_ccList,
  countBlanks as dep_countBlanks,
  docBlocks as dep_docBlocks,
  docBody as dep_docBody,
  docCase as dep_docCase,
  docInsp as dep_docInsp,
  editableBlanks as dep_editableBlanks,
  emailList as dep_emailList,
  esc as dep_esc,
  eventsFor as dep_eventsFor,
  frozenOf as dep_frozenOf,
  globalCourt as dep_globalCourt,
  globalCourtContact as dep_globalCourtContact,
  globalCourtCopies as dep_globalCourtCopies,
  globalCourtInstructions as dep_globalCourtInstructions,
  hasOwnInsp as dep_hasOwnInsp,
  initialCitations as dep_initialCitations,
  isHistoryDoc as dep_isHistoryDoc,
  isLocked as dep_isLocked,
  money as dep_money,
  nl2 as dep_nl2,
  ownerLines as dep_ownerLines,
  snow as dep_snow,
  structEditable as dep_structEditable,
} from "./app_core.js";
import {
  CITATION_POLICY as dep_CITATION_POLICY,
  cents as dep_cents,
  formatDeposit as dep_formatDeposit,
  formatDollarsOnLegacyReprints as dep_formatDollarsOnLegacyReprints,
} from "./citation_policy.js";
import { LOGO as dep_LOGO } from "./data/build_identity.js";
import { INSPECTORS as dep_INSPECTORS } from "./data/inspectors.js";
import { alignedExtension as dep_alignedExtension, specialType as dep_specialType } from "./new_documents.js";

function noticeHTML(d) {
  const aligned = dep_alignedExtension(d);
  const k = dep_docCase(d),
    i = dep_docInsp(d),
    blocks = dep_docBlocks(d),
    locked = dep_isLocked(d);
  const ce = locked ? "" : 'contenteditable="true"';
  const dis = locked ? "disabled" : "";
  let last = null;
  // while the first notice is still a draft the numbering follows the order;
  // after it is issued the stored number is what the owner has in hand
  const struct = dep_structEditable(d);
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
            `${dep_esc(it.id)}` +
            '">' +
            `${dep_esc(g)}` +
            "</span></td></tr>";
      }
      const b = dep_countBlanks(it.text);
      const num = struct ? String(ix + 1) : it.no || String(ix + 1);
      const rce = (it.done && !d.correction) || it.withdrawn ? "" : ce;
      return (
        head +
        ('<tr data-row="' +
          `${dep_esc(it.id)}` +
          '" class="' +
          `${(it.done && d.type !== "compliance") || (d.correction && it.withdrawn) ? "done" : ""}` +
          '">\n      <td class="c-no">\n        ' +
          "".concat(
            struct
              ? '<span class="grip no-print" data-grip="' +
                  `${dep_esc(it.id)}` +
                  '" role="button" tabindex="0" aria-label="Reorder item ' +
                  `${dep_esc(num)}` +
                  '; use up or down arrow" title="Drag or use arrow keys to reorder">&#1026' +
                  '2;</span><button class="gbtn no-print" data-move="' +
                  `${dep_esc(it.id)}` +
                  '" data-direction="up" aria-label="Move item ' +
                  `${dep_esc(num)}` +
                  ' up" ' +
                  `${ix === 0 ? "disabled" : ""}` +
                  '>↑</button><button class="gbtn no-print" data-move="' +
                  `${dep_esc(it.id)}` +
                  '" data-direction="down" aria-label="Move item ' +
                  `${dep_esc(num)}` +
                  ' down" ' +
                  `${ix === d.items.length - 1 ? "disabled" : ""}` +
                  '>↓</button>\n          <button class="gbtn no-print" data-grpbtn="' +
                  `${dep_esc(it.id)}` +
                  '" aria-label="Location heading for item ' +
                  `${dep_esc(num)}` +
                  '" title="Location heading">&#9143;</button>'
              : "",
          ) +
          '\n        <span class="num">' +
          `${dep_esc(num)}` +
          '.</span>\n        <span class="bl" data-blanks="' +
          `${dep_esc(it.id)}` +
          '" style="' +
          `${b ? "" : "display:none"}` +
          '">' +
          `${b}` +
          "&nbsp;blank" +
          `${b === 1 ? "" : "s"}` +
          '</span></td>\n      <td class="c-sec"><div class="sec-list ed" ' +
          `${rce}` +
          ' data-field="sections" data-id="' +
          `${dep_esc(it.id)}` +
          '" data-ph="section">' +
          `${it.sections.map((x) => dep_esc(d.authoringVersion >= 9 ? it.printedReferences?.[x] || x : x)).join("<br>")}` +
          '</div></td>\n      <td class="c-ab">' +
          "".concat(
            it.done
              ? "&mdash;"
              : d.type !== "notice"
                ? `<span class="ab-fixed">${it.abate ? "Yes" : "No"}</span>`
                : '<button class="ab-btn" data-abate="' +
                  `${dep_esc(it.id)}` +
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
            it.withdrawn ? `<p class="withdrawn-note"><strong>Withdrawn as entered in error.</strong> ${dep_esc(it.withdrawalReason || "")}</p>` : "",
          ) +
          '<div class="ed" ' +
          `${rce}` +
          ' data-field="text" data-id="' +
          `${dep_esc(it.id)}` +
          '" data-ph="Corrective action" style="white-space:pre-wrap">' +
          `${dep_editableBlanks(it.text)}` +
          "</div>" +
          `${d.draft ? dep_catalogDraftNotice(it) : ""}` +
          "\n        " +
          "".concat(
            dep_isHistoryDoc(d)
              ? dep_documentItemHistory(d, it)
                  .filter((x) => x.note)
                  .map(
                    (x) =>
                      '<div class="it-note"><span class="it-note-h">Inspector\'s note &middot; ' +
                      `${dep_esc(dep_fmtDate(x.on))}` +
                      "</span>" +
                      `${dep_esc(x.note)}` +
                      "</div>",
                  )
                  .join("")
              : it.note
                ? '<div class="it-note"><span class="it-note-h">Inspector\'s note &middot; ' +
                  `${dep_esc(dep_fmtDate(it.noteOn))}` +
                  '</span><span class="ed" ' +
                  `${rce}` +
                  ' data-field="note" data-id="' +
                  `${dep_esc(it.id)}` +
                  '" style="white-space:pre-wrap">' +
                  `${dep_esc(it.note)}` +
                  "</span></div>"
                : "",
          ) +
          "</td>\n      " +
          "".concat(
            struct && !it.done
              ? '<td class="c-cite no-print"><label title="Issue a citation with this not' +
                  'ice"><input type="checkbox" data-notecite="' +
                  `${dep_esc(it.id)}` +
                  '" ' +
                  `${it.cite ? "checked" : ""}` +
                  "><span>Cite</span></label></td>"
              : "",
          ) +
          '\n      <td class="c-due">' +
          "".concat(
            it.withdrawn
              ? `<span class="done-note withdrawn-note"><strong>Withdrawn</strong>Entered in error</span>`
              : dep_isHistoryDoc(d)
                ? it.done
                  ? `<span class="done-note"><strong>Corrected</strong>${dep_esc(dep_fmtDate(it.doneOn))}</span>`
                  : '<span class="visit-list">' +
                    "".concat(
                      dep_documentItemHistory(d, it).length
                        ? dep_documentItemHistory(d, it)
                            .map(
                              (x) =>
                                `<span><b>${dep_esc(dep_fmtDate(x.on))}</b><em>${dep_esc(dep_OC_WORD[x.oc] || x.oc)}</em>${
                                  x.cit ? `<i>Citation ${dep_esc(x.cit)}</i>` : ""
                                }</span>`,
                            )
                            .join("")
                        : '<span class="muted">no reinspection recorded</span>',
                    ) +
                    "</span>"
                : d.type === "compliance"
                  ? `<span class="mono">${dep_esc(dep_fmtDate(it.doneOn || it.due))}</span>`
                  : it.done
                    ? `<span class="done-note"><strong>Corrected</strong>${dep_esc(dep_fmtDate(it.doneOn))}</span>`
                    : aligned &&
                        d.type === "vacancyExtension" &&
                        d.special?.deadlineMode === "conditional" &&
                        d.special.affected?.includes(String(it.no))
                      ? '<span class="conditional-due">Conditional — see conditions above</span>'
                      : '<input type="date" class="d-in due-in" data-field="due" data-id="' +
                        `${dep_esc(it.id)}` +
                        '" value="' +
                        `${dep_esc(it.due || "")}` +
                        '" min="' +
                        `${d.correction ? "" : dep_MINDUE()}` +
                        '" aria-label="Due date for item ' +
                        `${dep_esc(num)}` +
                        '" ' +
                        `${dis}` +
                        ">",
          ) +
          "\n        " +
          "".concat(
            d.correction && !locked
              ? '<button class="lnk no-print" data-withdraw="' +
                  `${dep_esc(it.id)}` +
                  '">' +
                  `${it.withdrawn ? "Restore item" : "Withdraw item"}` +
                  "</button>"
              : "",
          ) +
          "" +
          "".concat(
            struct
              ? '<button class="rm no-print" data-del="' +
                  `${dep_esc(it.id)}` +
                  '" aria-label="Remove item ' +
                  `${dep_esc(num)}` +
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
            `${dep_esc(dep_fmtDate(dep_recordDay(d.void.at)))}` +
            "" +
            `${d.void.reason ? " &mdash; " + dep_esc(d.void.reason) : ""}` +
            "</div>"
        : "",
    ) +
    '\n    <div class="n-head"><img class="n-seal" src="' +
    `${dep_LOGO}` +
    '" alt="City of Madison Building Inspection">\n      <div class="n-headmai' +
    'n"><div class="n-title' +
    `${!aligned && (dep_DOC_TYPES.find((x) => x.id === d.type) || {}).stacked ? " stacked" : ""}` +
    '"' +
    (aligned ? ' style="font-size:11pt!important"' : "") +
    ">" +
    "".concat(
      (function () {
        const ty = dep_DOC_TYPES.find((x) => x.id === d.type) || {};
        if (!ty.pfx) return "Building Inspection Official Notice";
        return ty.stacked && !aligned
          ? `<span class="pfx">${dep_esc(ty.pfx)}</span><br>${dep_esc(ty.heading || "Building Inspection Official Notice")}`
          : `<span class="pfx">${dep_esc(ty.pfx)} - </span>Building Inspection Official Notice`;
      })(),
    ) +
    '</div>\n      <div class="n-meta">\n        <dl class="n-col">\n          <' +
    'dt>Case number:</dt><dd><strong class="ed" ' +
    `${ce}` +
    ' data-case="number" aria-readonly="' +
    `${dep_eventsFor(d.caseId).length ? "true" : "false"}` +
    '">' +
    `${dep_esc(k.number)}` +
    "</strong></dd>\n          <dt>Inspection date:</dt><dd>" +
    "".concat(
      dep_hasOwnInsp(d)
        ? '<input type="date" class="d-in hdr-in" data-doc="inspDate" value="' +
            `${dep_esc(d.inspDate || "")}` +
            '" aria-label="Inspection date" ' +
            `${dis}` +
            '><input type="time" class="d-in hdr-in hdr-time" data-doc="inspTime" val' +
            'ue="' +
            `${dep_esc(d.inspTime || "")}` +
            '" aria-label="Inspection time" ' +
            `${dis}` +
            ">"
        : '<input type="date" class="d-in hdr-in" data-case="date" value="' +
            `${dep_esc(k.date || "")}` +
            '" aria-label="Inspection date" ' +
            `${dis}` +
            '><input type="time" class="d-in hdr-in hdr-time" data-case="time" value=' +
            '"' +
            `${dep_esc(k.time || "")}` +
            '" aria-label="Inspection time" ' +
            `${dis}` +
            ">",
    ) +
    '</dd>\n          <dt>Mailed date:</dt><dd><input type="date" class="d-in ' +
    'hdr-in" data-doc="mailed" value="' +
    `${dep_esc(d.mailed || "")}` +
    '" max="' +
    `${dep_mailingMaxDay(dep_initialCitations.enabled(d) ? "citation" : d.type)}` +
    '" aria-label="Mailed date" ' +
    `${dis}` +
    '></dd>\n        </dl>\n        <dl class="n-col">\n          <dt>Property:<' +
    '/dt><dd><strong class="ed" ' +
    `${ce}` +
    ' data-case="address">' +
    `${dep_esc(k.address)}` +
    "</strong></dd>\n          <dt>Inspector:</dt><dd>" +
    "".concat(
      locked
        ? `<span class="n-insp-name">${dep_esc(i.name)}</span>`
        : '<select class="d-in hdr-in" data-doc="inspectorId" aria-label="Signing i' +
            'nspector">' +
            "".concat(dep_INSPECTORS.map((x) => `<option value="${x.id}" ${i.id === x.id ? "selected" : ""}>${dep_esc(x.name)}</option>`).join("")) +
            "</select>",
    ) +
    '\n            <div class="n-insp-l">' +
    `${dep_esc(i.title)}` +
    '</div>\n            <div class="n-insp-l">' +
    `${dep_esc(i.phone)}` +
    '</div>\n            <div class="n-insp-l">' +
    `${dep_esc(i.email)}` +
    '</div></dd>\n        </dl>\n      </div></div></div>\n\n    <div class="n-ow' +
    'ner"><div class="ed" ' +
    `${ce}` +
    ' data-case="ownerBlock" data-ph="Owner and mailing address" style="white' +
    '-space:pre-wrap">' +
    `${dep_esc(dep_ownerLines(k).join("\n"))}` +
    "</div>" +
    "".concat(
      d.draft && !dep_isLocked(d) ? '<button class="btn btn-sm no-print" data-parse-address="owner|0">Preview mailing address</button>' : "",
    ) +
    '</div>\n    <div class="win-note no-print">Envelope window</div>\n    <div' +
    ' class="n-winspace" aria-hidden="true"></div>\n\n    ' +
    `${dep_revisionPrintNote(d)}` +
    '\n    <div class="n-body">' +
    `${dep_docBody(d)}` +
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
    `${struct ? '<th class="c-cite no-print">Cite</th>' : ""}` +
    '<th class="c-due">' +
    `${dep_isHistoryDoc(d) ? "" : d.type === "compliance" ? "Date Complied" : "Due Date"}` +
    "</th></tr></thead>\n      <tbody>" +
    "".concat(rows || '<tr class="n-empty"><td colspan="6">No items yet — add the first violation below.</td></tr>') +
    "</tbody></table>\n    " +
    (aligned
      ? '<div class="extension-signer"><p>' +
        dep_esc((d.correction ? null : dep_frozenOf(d)?.authorizedSigner)?.name || d.special?.signerName || "◯") +
        "\n" +
        dep_esc((d.correction ? null : dep_frozenOf(d)?.authorizedSigner)?.title || d.special?.signerTitle || "◯") +
        "</p></div>"
      : "") +
    "".concat(
      !struct ? "" : '<div class="addwrap no-print"><button class="btn btn-primary addrow" id=' + '"btn-add">Add violation item</button></div>',
    ) +
    "\n    " +
    "".concat(
      (function () {
        // the agent is served a copy as a matter of course
        const ag = dep_agentLines(k);
        const cc = dep_ccList(k)
          .filter((c) => dep_ccLines(c, !!d.draft).length)
          .concat(ag.length ? [{ name: ag[0], addr: ag[1] || "", city: ag[2] || "", agent: true }] : []);
        const sent = d.emailedTo || [],
          draftMail = d.draft
            ? dep_emailList(k).filter(
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
                          `${dep_ccLines(c, !!d.draft)
                            .map((l) => `<div>${dep_esc(l)}</div>`)
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
                  `${mailRows.map((e) => `<div>${dep_esc(e.kind || "Other")} &mdash; ${dep_esc(e.addr)}</div>`).join("")}` +
                  "</div></div>"
              : "",
          ) +
          "\n      </div>"
        );
      })(),
    ) +
    "\n    " +
    "".concat(
      blocks.length ? `<div class="n-notes">${blocks.map((b) => `<h4>${dep_esc(b.label)}</h4><div>${dep_nl2(b.text)}</div>`).join("")}</div>` : "",
    ) +
    '\n    <div class="n-foot"><span class="mono">' +
    `${dep_esc(k.number)}` +
    "</span></div>\n  </div>";
  if (dep_snow.is(d) && d.authoringVersion >= 9)
    return result
      .replace('<div class="n-body">', '<div class="n-body snow-cover">')
      .replace(/<table class="notice">[\s\S]*?<\/table>/, "")
      .replace(/<div class="addwrap no-print">[\s\S]*?<\/div>/, "");
  if (!dep_specialType(d.type) || aligned) return result;
  const narrative = dep_docBody(d).match(/<p>[\s\S]*?<\/p>/g) || [];
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
    ? dep_fmtDate(raw)
    : f === "courtTime"
      ? dep_fmtTime(raw)
      : f === "ord" && d.authoringVersion >= 8
        ? String(raw).replace(/^SPS(?=\d)/, "SPS ")
        : raw;
  return (
    '<span class="ed cf" ' +
    `${locked ? "" : 'contenteditable="true"'}` +
    ' data-cit="' +
    `${dep_esc(iid)}` +
    "|" +
    `${dep_esc(f)}` +
    '" data-ph="' +
    `${dep_esc(ph)}` +
    '">' +
    `${dep_esc(v)}` +
    "</span>"
  );
}

function citAmount(d, it) {
  // Rendering retained documents never recalculates or changes their evidence.
  const amount = ((d.cits || {})[it.id] || {}).amount;
  return d.authoringVersion >= 7 || dep_formatDollarsOnLegacyReprints ? dep_formatDeposit(amount) : String(amount ?? "");
}

function citationFaces(d, locked) {
  locked = true;
  const source = dep_frozenOf(d) || {},
    COURT =
      source.court ||
      (d.authoringVersion >= 9
        ? { ...dep_globalCourt(), room: "RM#203,", caseNumberLabel: dep_CITATION_POLICY.mc2000CaseNumberLabel }
        : dep_globalCourt()),
    CIT_COPIES = source.courtCopies || dep_globalCourtCopies(),
    CIT_INSTRUCTIONS = source.courtInstructions || dep_globalCourtInstructions(),
    COURT_CONTACT = source.courtContact || dep_globalCourtContact();

  const k = dep_docCase(d),
    i = dep_docInsp(d);
  const cited = d.items.filter((x) => x.cite && !x.withdrawn);
  if (cited.some((x) => !(d.authoringVersion >= 8 && d.cits?.[x.id]?.mandatoryAppearance) && !(dep_cents(d.cits?.[x.id]?.amount) > 0)))
    return (
      '<p class="banner alert no-print">Citation needs deposit. <button class="btn" data-open-deposit="' +
      dep_esc(d.id) +
      '">Complete deposit</button></p>'
    );
  if (!cited.length) return "";
  if (d.draft && cited.some((it) => d.cits?.[it.id]?.mandatoryAppearance))
    return (
      '<p class="banner alert no-print">Mandatory-appearance citation preview i' +
      "s on hold until the division approves defendant instructions. Your draft" +
      " is retained.</p>"
    );
  const addr = dep_ownerLines(k).slice(1).join(", ");
  const face = (it, copy) => {
    const c = (d.cits || {})[it.id] || {};
    return (
      '<section class="cit' +
      `${d.authoringVersion >= 9 ? " cit-v9" : ""}` +
      "" +
      `${d.authoringVersion >= 9 && dep_snow.is(d) ? " cit-snow" : ""}` +
      "" +
      `${d.authoringVersion >= 7 || dep_formatDollarsOnLegacyReprints ? " cit-dollar" : ""}` +
      '"><div class="cit-form">\n\n    <div class="cit-bar">\n      <div class="ci' +
      't-idbar"><span class="cit-no">' +
      `${citField(d, it.id, "num", "Citation number", locked)}` +
      '</span>\n        <span class="cit-title">WISCONSIN UNIFORM MUNICIPAL<br>C' +
      'OURT CITATION AND COMPLAINT</span></div>\n      <div class="cit-juv">' +
      `${dep_BOXY}` +
      ' Juvenile</div>\n      <div class="cit-dep"><div class="cit-dep-l">Deposi' +
      't Permitted</div>\n        <div class="amt' +
      `${d.authoringVersion >= 9 && c.mandatoryAppearance ? " cit-mandatory" : ""}` +
      '">' +
      "".concat(dep_esc(d.authoringVersion >= 9 && c.mandatoryAppearance ? "NONE – MANDATORY APPEARANCE" : citAmount(d, it))) +
      '</div></div>\n      <div class="cit-tender"><div>' +
      `${dep_BOXY}` +
      " Cash</div><div>" +
      `${dep_BOXY}` +
      ' Card</div></div>\n      <div class="cit-cfu">(For court use only)</div>\n' +
      '    </div>\n\n    <div class="cit-cols">\n      <div class="cit-l">\n       ' +
      ' <div class="cit-h">You Are Notified To Appear</div>\n        <div class=' +
      '"cit-sm">Is this a mandatory appearance? &nbsp; ' +
      `${d.authoringVersion >= 8 && c.mandatoryAppearance ? dep_BOXN : dep_BOXY}` +
      " Yes &nbsp; " +
      `${d.authoringVersion >= 8 && c.mandatoryAppearance ? dep_BOXY : dep_BOXN}` +
      ' No</div>\n        <div class="cit-sm">(Read the reverse side of this cit' +
      'ation for court information)</div>\n        <div class="cit-dt"><b>Date:<' +
      "/b>" +
      `${citField(d, it.id, "courtDate", "00/00/0000", locked)}` +
      '</div>\n        <div class="cit-dt"><b>Time:</b>' +
      `${citField(d, it.id, "courtTime", "09:30 AM", locked)}` +
      "\n          <span>" +
      `${+(dep_parseTime(c.courtTime) || "00:00").slice(0, 2) < 12 ? dep_BOXN : dep_BOXY}` +
      " AM &nbsp; " +
      `${+(dep_parseTime(c.courtTime) || "00:00").slice(0, 2) >= 12 ? dep_BOXN : dep_BOXY}` +
      ' PM</span></div>\n        <div class="cit-court">' +
      `${dep_esc(COURT.name)}` +
      "<br>" +
      `${dep_esc(COURT.room)}` +
      "<br>" +
      `${dep_esc(COURT.addr)}` +
      "<br>" +
      `${dep_esc(COURT.city)}` +
      '</div>\n        <div class="cit-sm">Plaintiff: &nbsp; ' +
      `${dep_BOXN}` +
      " City &nbsp; " +
      `${dep_BOXY}` +
      " Village &nbsp; " +
      `${dep_BOXY}` +
      ' Town</div>\n        <div class="cit-sm">OF: MADISON</div>\n      </div>\n ' +
      '     <div class="cit-r">\n        <div class="cit-f"><div class="cit-cell' +
      's"><span class="cit-lab">Defendant Name - Last</span><span class="cit-la' +
      'b">First</span><span class="cit-lab">MI</span></div>\n          <div clas' +
      's="v">' +
      `${dep_esc(dep_ownerLines(k)[0] || "")}` +
      '</div></div>\n        <div class="cit-f"><div class="cit-cells"><span cla' +
      'ss="cit-lab">Street Address</span><span class="cit-lab">Post Office</spa' +
      'n><span class="cit-lab">State</span><span class="cit-lab">Zip Code</span' +
      '></div>\n          <div class="v">' +
      `${dep_esc(addr)}` +
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
      `${dep_esc(dep_longDate(c.violDate || dep_inspAt(d).date))}` +
      " " +
      `${dep_esc(dep_fmtTime(c.violTime || dep_inspAt(d).time))}` +
      '</div></div>\n          <div><span class="cit-lab">At:</span> <span class' +
      '="v">' +
      `${dep_esc(k.address || "")}` +
      '</span>\n            <div class="cit-lab" style="margin-top:3px">County: ' +
      '<span class="v">Dane</span></div></div>\n        </div>\n        <div clas' +
      's="cit-served">\n          <div>Citation Served: &nbsp; ' +
      `${dep_BOXY}` +
      " Personally &nbsp;&nbsp; " +
      `${dep_BOXN}` +
      " Mailed to defendant&rsquo;s last known address</div>\n          <div>" +
      `${dep_BOXY}` +
      " Left with person residing at defendant&rsquo;s residence: &nbsp; Name _" +
      "_____________________ &nbsp; Age ____</div>\n        </div>\n      </div>\n" +
      '      <div class="cit-agent"><span class="cit-lab">Registered Agent</spa' +
      'n>\n        <div class="v agent">' +
      `${
        dep_agentLines(k, !!d.draft)
          .map((l) => `<div>${dep_esc(l)}</div>`)
          .join("") || "&nbsp;"
      }` +
      '</div></div>\n    </div>\n\n    <div class="cit-sign">\n      <div><span cla' +
      'ss="cit-lab">Print Officer Name</span><div class="v">' +
      `${dep_esc(i.name || "")}` +
      '</div></div>\n      <div><span class="cit-lab">Department</span><div clas' +
      's="v">Building Inspection</div></div>\n      <div><span class="cit-lab">I' +
      '.D. No.</span><div class="v">' +
      "".concat(
        ((d.cits || {})[it.id] || {}).deptId
          ? citField(d, it.id, "deptId", "0000", locked)
          : '<span class="ed cf" ' +
              `${locked ? "" : 'contenteditable="true"'}` +
              ' data-cit="' +
              `${dep_esc(it.id)}` +
              '|deptId" data-ph="0000">' +
              `${dep_esc(i.badge || "")}` +
              "</span>",
      ) +
      '</div></div>\n      <div><span class="cit-lab">Date Citation Issued</span' +
      '><div class="v">' +
      `${citField(d, it.id, "issued", dep_fmtDate(d.mailed || ""), locked)}` +
      '</div></div>\n      <div><span class="cit-lab">' +
      "".concat(dep_esc(d.authoringVersion >= 9 ? COURT.caseNumberLabel || dep_CITATION_POLICY.mc2000CaseNumberLabel : "Agency Case Number")) +
      '</span><div class="v">' +
      `${dep_esc(k.number || "")}` +
      "</div></div>\n    </div>\n\n    </div>\n    " +
      "".concat(
        c.assessments
          ? '<div class="cit-assessments">Base ' +
              "".concat(
                d.authoringVersion >= 8
                  ? dep_formatDeposit((c.assessments.base / 100).toFixed(2)) || "$0.00"
                  : "$" + dep_money(c.assessments.base / 100),
              ) +
              " · Penalty " +
              "".concat(
                d.authoringVersion >= 8
                  ? dep_formatDeposit((c.assessments.penalty / 100).toFixed(2)) || "$0.00"
                  : "$" + dep_money(c.assessments.penalty / 100),
              ) +
              " · Jail " +
              "".concat(
                d.authoringVersion >= 8
                  ? dep_formatDeposit((c.assessments.jail / 100).toFixed(2)) || "$0.00"
                  : "$" + dep_money(c.assessments.jail / 100),
              ) +
              " · Crime lab " +
              "".concat(
                d.authoringVersion >= 8
                  ? dep_formatDeposit((c.assessments.crimeLab / 100).toFixed(2)) || "$0.00"
                  : "$" + dep_money(c.assessments.crimeLab / 100),
              ) +
              " · Court " +
              "".concat(
                d.authoringVersion >= 8
                  ? dep_formatDeposit((c.assessments.court / 100).toFixed(2)) || "$0.00"
                  : "$" + dep_money(c.assessments.court / 100),
              ) +
              "</div>"
          : "",
      ) +
      '\n    <div class="cit-foot"><span>MC-2000, 02/06' +
      "".concat(d.revision ? ` · Corrected rev. ${dep_esc(d.revision.number)} · ${dep_esc(d.id)}` : d.draft ? " · DRAFT" : "") +
      "</span><span>" +
      `${dep_esc(copy.label)}` +
      "</span></div>\n    " +
      "".concat(
        copy.comment || (d.authoringVersion === 9 && dep_snow.is(d))
          ? '<div class="cit-cmt"><div class="cit-lab">VIOLATION COMMENT:</div>\n     ' +
              ' <span class="ed" ' +
              `${locked ? "" : 'contenteditable="true"'}` +
              ' data-cit="' +
              `${dep_esc(it.id)}` +
              '|comment" data-ph="Inspection history: initial inspection, notice issued' +
              ', reinspection findings">' +
              `${dep_esc(c.comment || "")}` +
              "</span></div>"
          : "",
      ) +
      "\n    " +
      "".concat(
        copy.record
          ? '<div class="cit-rec">\n      <div class="cit-rec-h">' +
              `${dep_esc(copy.record)}` +
              '</div>\n      <div class="cit-rec-g">\n        <div>\n          <div class=' +
              '"cit-rec-f">Date of Disposition</div>\n          <div class="cit-rec-f">P' +
              'LEA:</div>\n          <div class="cit-rec-o">' +
              `${dep_BOXY}` +
              " Guilty &nbsp; " +
              `${dep_BOXY}` +
              " No Contest &nbsp; " +
              `${dep_BOXY}` +
              ' Not Guilty</div>\n          <div class="cit-rec-f">Other Disposition:</d' +
              'iv>\n          <div class="cit-rec-f last">Court Officer:</div>\n        <' +
              '/div>\n        <div>\n          <div class="cit-rec-f">FINDING:</div>\n    ' +
              '      <div class="cit-rec-o">' +
              `${dep_BOXY}` +
              " Guilty &nbsp;&nbsp; " +
              `${dep_BOXY}` +
              ' Dismissed</div>\n          <div class="cit-rec-o">' +
              `${dep_BOXY}` +
              " Default &nbsp; " +
              `${dep_BOXY}` +
              ' Forfeiture</div>\n          <div class="cit-rec-o">' +
              `${dep_BOXY}` +
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
              `${dep_esc(COURT_CONTACT.name)}` +
              "<br>" +
              `${dep_esc(COURT_CONTACT.addr)}` +
              "<br>" +
              `${dep_esc(COURT_CONTACT.city)}` +
              "</div>\n        <div>" +
              `${dep_esc(COURT_CONTACT.phone)}` +
              "<br>" +
              `${dep_esc(COURT_CONTACT.fax)}` +
              "<br>" +
              `${dep_esc(COURT_CONTACT.email)}` +
              "</div>\n      </div></div>"
          : "",
      ) +
      "\n    </section>"
    );
  };
  return cited.map((it) => CIT_COPIES.map((cp) => face(it, cp)).join("")).join("");
}

/* R42 presentation only: storage/publication and fixed print construction stay in their owners. */

export { noticeHTML, documentHTML, citField, citAmount, citationFaces };
