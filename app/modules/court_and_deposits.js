import { caseNumberAllowed } from "./case_records.js";
import { inspAt } from "./inspection_facts.js";
import { normParcel, recordDay } from "../assets/shared.js";

import { addressProblem, validateAndStandardizeAddresses } from "./case_files.js";
import { simpleVacancy, simplifiedBestInterest, specialType, frozenOf, isHistoryDoc } from "./document_rules.js";
import {
  correctionChecks,
  lifecycleChecks,
  authoringChecks,
  citationDepositFault,
  catalogDraftBlocked,
  A11Y,
  docBlocks,
  docBody,
  initialCitations,
  initialOrderCitation,
  isLocked,
  newDocuments,
  snow,
  unchangedCorrectionValue,
  unchangedCourtDate,
  attachCheckTargets,
} from "./app_core.js";

import { BLOCKS, CIT_COPIES, CIT_INSTRUCTIONS, COURT, COURT_CONTACT, EXTERIOR_WORK } from "./document_types.js";
import { checkTarget, citSelector, countBlanks, esc, itemSelector } from "./presentation_format.js";
import { doc, docCase, docInsp, kase } from "./writer_queries.js";
import { clone } from "./record_values.js";
import { validISO, parseTime, daysBetween, nowISO } from "./calendar.js";
import { isLLC, ownerLines } from "./mailing_rules.js";

import { CITATION_POLICY } from "./citation_policy.js";
import { LIBRARY } from "./data/library.js";
import { WriterState } from "./state.js";

/* app functions; direct dependencies use explicit shared state. */

/* R59: an item with several sections charges one of them, chosen explicitly. Options keep each section as
   stored for display and use its canonical ordinance as the charged value. */

/* R59: every value derived from, priced for or approved for the previous charge. A new charge is priced
   afresh; an administrator override, tier override and manual deposit basis are tied to the old charge. */

/* The schedule row, measurements and authorizations of the previous charge. A single-section (or free-text)
   charge edit clears only these and keeps the R31 contract: an earlier amount stays only as a blocked
   proposal (reconfirmDeposit) until its source and amount are confirmed again or the new charge is priced. */

/* R59: one path for every charge edit (charge card, deposit step, initial citations). A drafted citation or a
   required-completion request takes the new ordinance without the old charge's basis (clearChargeBasis), then the ordinary pricing
   runs: a scheduled amount completes the charge; otherwise the request shows that charge's own reason. An
   unchanged-correction charge returns to its original's retained basis. Returns false when nothing changed. */

function rnd12() {
  const b = new Uint8Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < 8; i++) b[i] = Math.floor(Math.random() * 256);
  return Array.prototype.map.call(b, (x) => ("0" + x.toString(16)).slice(-2)).join("");
}

function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s + "T12:00:00Z");
  return String(d.getUTCMonth() + 1).padStart(2, "0") + "/" + String(d.getUTCDate()).padStart(2, "0") + "/" + d.getUTCFullYear();
}

function splitOwner(text) {
  const ls = String(text || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  return { owner: ls[0] || "", addr: ls.slice(1) };
}

function longDate(v) {
  if (!v) return "";
  const p = String(v).split("-");
  if (p.length < 3) return fmtDate(v);
  const dt = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12));
  const D = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const M = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return D[dt.getUTCDay()] + ", " + M[dt.getUTCMonth()] + " " + dt.getUTCDate() + ", " + dt.getUTCFullYear();
}

function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return (h % 12 === 0 ? 12 : h % 12) + ":" + String(m).padStart(2, "0") + " " + (h >= 12 ? "PM" : "AM");
}

function toast(m, options) {
  WriterState.undoFn = null;
  A11Y.notify(m, options);
}

function toastHold(m) {
  WriterState.undoFn = null;
  A11Y.notify(m, { severity: "progress" });
}

function toastUndo(m, fn) {
  WriterState.undoFn = fn;
  A11Y.notify(m, {
    severity: "success",
    undo: () => {
      WriterState.undoFn = null;
      fn();
    },
  });
}

function fillBlank(el) {
  const field = el.closest('[data-field="text"]'),
    d = doc(WriterState.state.docId);
  if (!field || !d || isLocked(d)) return;
  const itemId = field.dataset.id,
    documentId = d.id;
  A11Y.utility(
    "Add corrective-action detail",
    '<form id="corrective-detail-form"><label class="f" for="corrective-detail"><span>Enter the missing corrective-action detail</span><textarea id="corrective-detail" rows="4" required></textarea></label><p class="hint" id="corrective-detail-error" role="alert"></p><button type="submit" class="btn btn-primary">Save</button></form>',
  );
  const dialog = document.getElementById("utility-dialog"),
    form = dialog.querySelector("form");
  dialog.querySelector("[data-utility-close]").textContent = "Cancel";
  dialog.querySelector("textarea").focus();
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = dialog.querySelector("textarea").value.trim();
    if (!value) {
      dialog.querySelector("#corrective-detail-error").textContent = "Enter text, or choose Cancel to leave this item unchanged.";
      return;
    }
    const current = doc(documentId),
      item = current?.items.find((it) => it.id === itemId);
    if (
      WriterState.state.screen !== "write" ||
      WriterState.state.docId !== documentId ||
      !current ||
      isLocked(current) ||
      !item ||
      item.withdrawn ||
      (item.done && !current.correction) ||
      !field.isConnected ||
      !field.contains(el)
    ) {
      dialog.querySelector("#corrective-detail-error").textContent = "This item is no longer editable. Cancel and reopen the current document.";
      return;
    }
    el.replaceWith(document.createTextNode(value));
    field.dispatchEvent(new Event("input", { bubbles: true }));
    // The browser delivers "close" asynchronously and the utility dialog's own handler then restores focus to
    // the replaced blank, which no longer exists. Return focus to the item text after that handler runs.
    dialog.addEventListener("close", () => field.isConnected && field.focus(), { once: true });
    dialog.close();
    field.focus();
  });
}

function allItems() {
  const out = [];
  LIBRARY.forEach((c, ci) => c.groups.forEach((g, gi) => g.items.forEach((i) => out.push({ ...i, ci, gi, cl: c.name, grp: g.name }))));
  return out;
}

function activeBlocks(d) {
  if (snow.is(d) && d.authoringVersion >= 9) return ["LANGUAGE"];
  // the division's follow-up documents carry none of these
  if (d.type !== "notice" && !initialOrderCitation(d)) return [];
  const k = kase(d.caseId),
    set = new Set();
  Object.keys(BLOCKS).forEach((b) => {
    if (BLOCKS[b].always) set.add(b);
  });
  if (d.items.some((i) => /permit|repair|replace/i.test(i.text))) set.add("PERMIT_500");
  // Preserve Historic District wording; omit unsupplied optional Landmark wording.
  const exterior = d.items.some((i) => EXTERIOR_WORK.test(i.text));
  if (k.historic && exterior) set.add("LANDMARKS");
  if (String(k.landmark || "").trim() && exterior && String((BLOCKS.LANDMARK || {}).text || "").trim()) set.add("LANDMARK");
  return [...set];
}

function freezeSources(d) {
  return {
    ...(snow.is(d) ? snow.freeze(d) : {}),
    case: clone(docCase(d)),
    inspector: clone(docInsp(d)),
    body: docBody(d),
    // Authoring-15+ Best Interest and authoring-16 Vacancy Extensions have no signer or division review.
    ...(d.special && !simplifiedBestInterest(d) && !simpleVacancy(d)
      ? {
          documentPolicyVersion: 26,
          authorizedSigner: { name: d.special.signerName, title: d.special.signerTitle, delegation: d.special.delegation },
          divisionReview: { by: d.special.reviewer, at: d.special.reviewDateLegal, reference: d.special.reviewRef },
        }
      : {}),
    blocks: clone(docBlocks(d)),
    court: {
      ...clone((frozenOf(d) || {}).court || COURT),
      ...(d.authoringVersion >= 9 ? { room: "RM#203,", caseNumberLabel: CITATION_POLICY.mc2000CaseNumberLabel } : {}),
    },
    courtCopies: clone((frozenOf(d) || {}).courtCopies || CIT_COPIES),
    courtInstructions: (frozenOf(d) || {}).courtInstructions || CIT_INSTRUCTIONS,
    courtContact: clone((frozenOf(d) || {}).courtContact || COURT_CONTACT),
    at: nowISO(),
  };
}

/* R53: an initial-inspection draft must match its Accela status. There is no override: correct the
   items or the status in Accela, then import the inspection again. */
function importStatusChecks(d) {
  const rule = d.importRule;
  if (!rule || rule.kind !== "initial" || !d.draft || d.correction) return [];
  const cited = d.items.some((i) => i.cite && !i.withdrawn);
  if (rule.cite && !cited)
    return [
      {
        ok: false,
        t: "The Accela status is Citation, but no item is marked for citation. Mark the items to cite, or correct the status in Accela and import this inspection again.",
      },
    ];
  if (!rule.cite && rule.doc === "notice" && cited)
    return [
      {
        ok: false,
        t: "The Accela status is Official Notice, so no item can be cited. Remove the citation marks, or correct the status in Accela and import this inspection again.",
      },
    ];
  return [{ ok: true, t: "Matches the Accela status: " + rule.status }];
}

function checks(d) {
  if (!d || !Array.isArray(d.items)) return [{ ok: false, t: "Open a document first" }];
  initialCitations.prepare(d);
  // a compliance letter reports on every item; elsewhere the cleared ones are
  // history and are not checked again
  const comp = d.type === "compliance";
  // neither a compliance letter nor a referral carries due dates: one reports
  // dates already met, the other stops setting them altogether
  const special = !!specialType(d.type);
  const noDates = comp || special || isHistoryDoc(d) || snow.is(d);
  const live = comp ? d.items.filter((i) => !i.withdrawn) : d.items.filter((i) => !i.done && !i.withdrawn);
  const noComply = comp
    ? d.items.filter((i) => !i.withdrawn).filter((i) => !validISO(i.doneOn) || i.doneOn > recordDay(today) || i.doneOn < (docCase(d).date || ""))
        .length
    : 0;
  const notAllDone = comp ? d.items.filter((i) => !i.done && !i.withdrawn).length : 0;
  const blanks = live.reduce((n, i) => n + countBlanks(i.text), 0);
  const noDue = noDates ? 0 : live.filter((i) => !i.due).length;
  const past = noDates
    ? 0
    : live.filter((i) => i.due && validISO(i.due) && !unchangedCorrectionValue(d, i.id, "due") && daysBetween(recordDay(today), i.due) < 1).length;
  const badDue = noDates ? 0 : live.filter((i) => i.due && !validISO(i.due)).length;
  const noSec = live.filter((i) => !i.sections.length).length;
  const own = ownerLines(docCase(d));
  const addrOk = own.length >= 3 && /\b[A-Z]{2}\.?\s+\d{5}(-\d{4})?$/.test(own[own.length - 1] || "");
  const cited = d.items.filter((i) => i.cite && !i.withdrawn);
  const citMissing =
    d.type !== "citation"
      ? 0
      : cited.reduce(
          (n, i) =>
            n +
            ["num", "courtDate", "amount", "desc", "ord"].filter(
              (f) => !(f === "amount" && d.cits?.[i.id]?.mandatoryAppearance) && !String(((d.cits || {})[i.id] || {})[f] || "").trim(),
            ).length,
          0,
        );
  const citBad =
    d.type !== "citation"
      ? 0
      : cited.filter((i) => {
          const cd = ((d.cits || {})[i.id] || {}).courtDate;
          return !cd || !validISO(cd) || (!unchangedCourtDate(d, i.id) && daysBetween(recordDay(today), cd) < 1);
        }).length;
  const noAgent =
    d.type === "citation" && isLLC(docCase(d)) ? addressProblem(...["name", "addr", "city"].map((key) => (docCase(d).agent || {})[key])) : "";
  // every citation carries its own officer I.D. — one completed form does
  // not speak for the others on the same document
  const noBadge = d.type !== "citation" ? 0 : cited.filter((i) => !String(((d.cits || {})[i.id] || {}).deptId || "").trim()).length;
  const noBase =
    d.type !== "citation"
      ? 0
      : cited.filter((i) => {
          const cc = (d.cits || {})[i.id] || {};
          return citationDepositFault(cc, d, i) !== "";
        }).length;
  const tight = noDates
    ? 0
    : live.filter((i) => i.due && daysBetween(recordDay(today), i.due) > 0 && daysBetween(recordDay(today), i.due) < 7).length;
  const far = noDates
    ? 0
    : live.filter((i) => i.due && !unchangedCorrectionValue(d, i.id, "due") && daysBetween(recordDay(today), i.due) > 180).length;
  const draft = live.filter(catalogDraftBlocked).length;
  const base = [
    {
      ok: addrOk,
      t: !own[0]
        ? "No defendant name on the mailing block"
        : own.length < 3
          ? "Mailing block needs a name, a street line and a city, state and ZIP"
          : addrOk
            ? "Mailing block has the required address format"
            : "Last line of the mailing block does not end in a state and ZIP",
    },
    {
      ok: own.length <= 5,
      t: own.length > 5 ? own.length + " lines in the mailing block — the envelope window fits five" : "Mailing block fits the envelope window",
    },
    {
      ok: live.length > 0 || !!(d.correction && d.items.length && d.items.every((i) => i.withdrawn)),
      t: comp
        ? live.length
          ? live.length + " item" + (live.length === 1 ? "" : "s") + " on the letter"
          : "No items on the letter"
        : live.length
          ? live.length +
            " item" +
            (live.length === 1 ? "" : "s") +
            " outstanding" +
            (d.items.length > live.length ? ", " + (d.items.length - live.length) + " shown as corrected" : "")
          : d.items.length
            ? "Every item is already corrected — nothing for this document to order"
            : "No violation items yet — add at least one",
    },
    {
      ok: blanks === 0,
      t: blanks ? blanks + " unfilled bubble" + (blanks === 1 ? "" : "s") + " in the corrective action text" : "No unfilled blanks",
    },
    {
      ok: noDue === 0,
      t: snow.is(d)
        ? "Snow item is exempt from due dates"
        : noDue
          ? noDue + " item" + (noDue === 1 ? " has" : "s have") + " no due date"
          : "Every item has a due date",
    },
    { ok: past === 0, t: past ? past + " due date" + (past === 1 ? " is" : "s are") + " today or in the past" : "Due dates are in the future" },
    {
      ok: badDue === 0,
      t: badDue
        ? badDue + " due date" + (badDue === 1 ? " is not" : "s are not") + " a real calendar date"
        : "Every due date reads as a calendar date",
    },
    { ok: noSec === 0, t: noSec ? noSec + " item" + (noSec === 1 ? " has" : "s have") + " no ordinance section" : "Every item cites an ordinance" },
    {
      ok: draft === 0,
      t: draft
        ? draft +
          (draft === 1 ? " item uses" : " items use") +
          (" draft language or retired catalog language; division review is required" +
            ". Open Order language or choose a reviewed item. Editing text alone cann" +
            "ot approve it.")
        : "No unreviewed or retired catalog language",
    },
    { ok: far === 0, t: far ? far + " due date" + (far === 1 ? " is" : "s are") + " more than six months out" : "Due dates fall in a normal range" },
    {
      ok: tight === 0,
      soft: true,
      t: tight
        ? tight + " due date" + (tight === 1 ? " is" : "s are") + " less than a week out — confirm that is intended"
        : "No unusually short compliance windows",
    },
  ];

  const itemTargets = (items, field) => items.map((i) => checkTarget(itemSelector(i.id, field), "Item " + i.no));
  [
    [checkTarget('[data-case="ownerBlock"]', "Mailing block")],
    [checkTarget('[data-case="ownerBlock"]', "Mailing block")],
    [checkTarget("#btn-add-top", "Violation Items")],
    itemTargets(
      live.filter((i) => countBlanks(i.text)),
      "text",
    ),
    itemTargets(
      live.filter((i) => !i.due),
      "due",
    ),
    itemTargets(
      live.filter((i) => i.due && validISO(i.due) && !unchangedCorrectionValue(d, i.id, "due") && daysBetween(recordDay(today), i.due) < 1),
      "due",
    ),
    itemTargets(
      live.filter((i) => i.due && !validISO(i.due)),
      "due",
    ),
    itemTargets(
      live.filter((i) => !i.sections.length),
      "sections",
    ),
    live.filter(catalogDraftBlocked).map((i) => checkTarget('[data-nav="library"]', "Review catalog for item " + i.no, "catalog")),
    itemTargets(
      live.filter((i) => i.due && !unchangedCorrectionValue(d, i.id, "due") && daysBetween(recordDay(today), i.due) > 180),
      "due",
    ),
    itemTargets(
      live.filter((i) => i.due && daysBetween(recordDay(today), i.due) > 0 && daysBetween(recordDay(today), i.due) < 7),
      "due",
    ),
  ].forEach((targets, ix) => (base[ix].targets = targets));
  const recipientProblem = validateAndStandardizeAddresses(docCase(d), false, false);
  base.push({
    ok: !recipientProblem,
    t: recipientProblem ? recipientProblem.message : "Copy and registered-agent addresses are complete",
    targets: recipientProblem
      ? [checkTarget("#btn-cc", "Recipients", "recipient:" + recipientProblem.scope + ":" + recipientProblem.index + ":" + recipientProblem.field)]
      : [],
  });
  const forComp = [
    {
      ok: notAllDone === 0,
      t: notAllDone
        ? notAllDone + " item" + (notAllDone === 1 ? " is" : "s are") + " not marked corrected — a compliance letter closes every item"
        : "Every item is corrected",
    },
    {
      ok: noComply === 0,
      t: noComply
        ? noComply + " item" + (noComply === 1 ? " has" : "s have") + " no date of compliance"
        : "Every item carries its date of compliance",
    },
  ];

  const forCit = [
    {
      ok: cited.length > 0 || !!(d.correction && d.items.length && d.items.every((i) => i.withdrawn)),
      t: cited.length ? cited.length + " item" + (cited.length === 1 ? "" : "s") + " cited" : "No item selected for citation",
    },
    {
      ok: citMissing === 0,
      t: citMissing
        ? citMissing + " court citation field" + (citMissing === 1 ? "" : "s") + " still blank (number, court date, amount, ordinance, description)"
        : "Court citation fields complete",
    },
    {
      ok: citBad === 0,
      t: citBad ? citBad + " court date" + (citBad === 1 ? " is" : "s are") + " not a real date in the future" : "Court dates are in the future",
    },
    {
      ok: noBase === 0,
      t: noBase
        ? noBase +
          " citation" +
          (noBase === 1 ? " has" : "s have") +
          " an unresolved deposit — use Citation review to correct the ordinance or enter an approved deposit and its source"
        : "Deposit calculated for every citation",
    },
    {
      ok: noBadge === 0,
      t: noBadge
        ? noBadge + " citation" + (noBadge === 1 ? " has" : "s have") + " no badge number in the I.D. No. field — enter it on each form"
        : "Officer I.D. number present",
    },
    { ok: !noAgent, t: noAgent ? esc(docCase(d).owner) + " is a company — " + noAgent : "Registered agent recorded" },
  ];

  const citTargets = (items, fields) => items.flatMap((i) => fields.map((f) => checkTarget(citSelector(i.id, f), "Item " + i.no + " · " + f)));
  forCit[1].targets = cited.flatMap((i) =>
    ["num", "courtDate", "amount", "desc", "ord"]
      .filter((f) => !(f === "amount" && d.cits?.[i.id]?.mandatoryAppearance) && !String(((d.cits || {})[i.id] || {})[f] || "").trim())
      .map((f) => checkTarget(citSelector(i.id, f === "amount" ? "depositMode" : f), "Item " + i.no + " · " + f)),
  );
  forCit[2].targets = citTargets(
    cited.filter((i) => {
      const c = (d.cits || {})[i.id] || {};
      return !validISO(c.courtDate) || (!unchangedCourtDate(d, i.id) && daysBetween(recordDay(today), c.courtDate) < 1);
    }),
    ["courtDate"],
  );
  forCit[3].targets = citTargets(
    cited.filter((i) => citationDepositFault((d.cits || {})[i.id] || {})),
    ["depositMode", "ord"],
  );
  forCit[4].targets = citTargets(
    cited.filter((i) => !String(((d.cits || {})[i.id] || {}).deptId || "").trim()),
    ["deptId"],
  );
  forCit[5].targets = noAgent ? [checkTarget("#btn-cc", "Recipients")] : [];
  // the inspection this document was written from
  const at = inspAt(d),
    forInsp = [
      { ok: validISO(d.mailed), t: validISO(d.mailed) ? "Mailed date recorded" : "Enter a valid mailed date" },
      {
        ok: caseNumberAllowed(docCase(d)) && !!String(docCase(d).address || "").trim(),
        t: "Case number must use 3–80 letters, numbers or hyphens; property address is required",
      },
      { ok: !!docInsp(d).name, t: "Select the inspector signing this document" },
    ];
  // a notice is what puts a case on the map: without a parcel it cannot be
  // located or reported by district (division, 09/18/2026)
  if (d.type === "notice") {
    const pk = normParcel(docCase(d).parcel);
    forInsp.push({
      ok: !!pk,
      t: pk
        ? "Parcel number recorded"
        : String(docCase(d).parcel || "").trim()
          ? "The parcel number is not 12 digits — correct it in Accela, then import this inspection again"
          : "No parcel number on the case — a notice cannot be issued without one. Add it in Accela, then import this inspection again",
    });
  }
  forInsp.push({
    ok: validISO(at.date) && at.date <= recordDay(today),
    t:
      validISO(at.date) && at.date <= recordDay(today)
        ? "Inspection date recorded"
        : "No inspection date — enter the date of the reinspection this document is written from",
    targets: [checkTarget(at.own ? '[data-doc="inspDate"]' : '[data-case="date"]', "Inspection date")],
  });
  if (at.own)
    forInsp.push({
      ok: !!parseTime(at.time),
      t: parseTime(at.time) ? "Inspection time recorded" : "Enter the inspection time before generating this document",
      targets: [checkTarget('[data-doc="inspTime"]', "Inspection time")],
    });
  // with no due dates on the document, the due-date checks have nothing to say
  return (special ? base.filter((c, n) => [0, 1, 3, base.length - 1].includes(n)) : noDates ? base.filter((c) => !/due date/i.test(c.t)) : base)
    .concat(comp ? forComp : [])
    .concat(d.type === "citation" ? forCit : [])
    .concat(forInsp)
    .concat(snow.checks(d))
    .concat(initialCitations.checks(d))
    .concat(importStatusChecks(d))
    .concat(newDocuments.specialChecks(d))
    .concat(authoringChecks(d))
    .concat(d.correction ? correctionChecks(d) : lifecycleChecks(d))
    .map((c) => attachCheckTargets(d, c));
}

export { rnd12, fmtDate, splitOwner, longDate, fmtTime, toast, toastHold, toastUndo, fillBlank, allItems, activeBlocks, freezeSources, checks };
