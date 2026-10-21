import { normParcel, recordDay } from "../assets/shared.js";
import { appendEvent, caseNumberAllowed, printNotice, printableHTML, project } from "./workspace_shell.js";
import { addressProblem, saveCaseFile, validateAndStandardizeAddresses } from "./case_files.js";
import { correctionChecks } from "./issuance_and_corrections.js";
import { lifecycleChecks } from "./draft_recovery.js";
import { catalogDraftBlocked } from "./language_catalog.js";
import { authoringChecks, citationDepositFault, refreshArtifactLocations } from "./case_timeline.js";
import { attachCheckTargets, render } from "./inspection_import.js";
import { documentHTML } from "./document_render.js";
import { paginate } from "./document_pagination.js";
import {
  A11Y,
  BLOCKS,
  CITEPOCH,
  CITFEES,
  CIT_COPIES,
  CIT_INSTRUCTIONS,
  COURT,
  COURT_CONTACT,
  DOC_TYPES,
  EXTERIOR_WORK,
  checkTarget,
  citSelector,
  citationPricing,
  clone,
  countBlanks,
  daysBetween,
  doc,
  docBlocks,
  docBody,
  docCase,
  docInsp,
  emailList,
  esc,
  eventsFor,
  frozenOf,
  hasOwnInsp,
  initialCitations,
  initialOrderCitation,
  isHistoryDoc,
  isLLC,
  isLocked,
  iso,
  itemSelector,
  kase,
  newDocuments,
  nowISO,
  ownerLines,
  recordIntegrity,
  snow,
  unchangedCorrectionValue,
  unchangedCourtDate,
} from "./app_core.js";
import { CITATION_POLICY, assessmentCents, canonicalOrdinance, cents, resolveOrdinance } from "./citation_policy.js";
import { LIBRARY } from "./data/library.js";
import { specialType } from "./new_documents.js";
import { WriterState } from "./state.js";
import { authFetch } from "./helper_transport.js";
/* app functions; direct dependencies use explicit shared state. */

function nthWeekday(y, m, wd, n) {
  // n-th weekday of a month, 1-based
  const d = new Date(Date.UTC(y, m, 1, 12));
  d.setUTCDate(1 + ((wd - d.getUTCDay() + 7) % 7) + (n - 1) * 7);
  return d;
}

function lastWeekday(y, m, wd) {
  const d = new Date(Date.UTC(y, m + 1, 0, 12));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() - wd + 7) % 7));
  return d;
}

function courtHolidays(y) {
  const f = [
    [0, 1],
    [5, 19],
    [6, 4],
    [10, 11],
    [11, 24],
    [11, 25],
    [11, 31],
  ]; // fixed dates
  const out = f.map((p) => new Date(Date.UTC(y, p[0], p[1], 12)));
  out.push(nthWeekday(y, 0, 1, 3)); // Martin Luther King Jr. Day
  out.push(lastWeekday(y, 4, 1)); // Memorial Day
  out.push(nthWeekday(y, 8, 1, 1)); // Labor Day
  const tg = nthWeekday(y, 10, 4, 4); // Thanksgiving and the day after
  out.push(tg);
  out.push(new Date(Date.UTC(y, 10, tg.getUTCDate() + 1, 12)));
  return out.map((d) => iso(d));
}

function isCourtHoliday(d) {
  const s = typeof d === "string" ? d : iso(d);
  return courtHolidays(+s.slice(0, 4)).indexOf(s) >= 0;
}

function nextCourtDate(from) {
  const p = String(from || recordDay(today)).split("-");
  const d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12));
  d.setUTCDate(d.getUTCDate() + 42); // six weeks out
  d.setUTCDate(d.getUTCDate() + ((3 - d.getUTCDay() + 7) % 7)); // then on to a Wednesday
  let guard = 0;
  while (isCourtHoliday(d) && guard++ < 12) d.setUTCDate(d.getUTCDate() + 7);
  return iso(d);
}

function citationNumber() {
  const used = {};
  WriterState.DOCS.forEach((d) =>
    Object.keys(d.cits || {}).forEach((x) => {
      const v = (d.cits[x] || {}).num;
      if (v) used[v] = 1;
    }),
  );
  const base = Math.floor((Date.now() - CITEPOCH) / 1000);
  for (let bump = 0; bump < 120; bump++) {
    const secs = String(base + bump)
      .padStart(9, "0")
      .slice(-9);
    const start = Math.floor(Math.random() * 100);
    for (let i = 0; i < 100; i++) {
      const c = "B" + secs + String((start + i) % 100).padStart(2, "0");
      if (!used[c]) return c;
    }
  }
  return "B" + String(base).padStart(9, "0").slice(-9) + String(Math.floor(Math.random() * 100)).padStart(2, "0");
}

function applyDeposit(d, iid, ord) {
  const c = (d.cits || {})[iid];
  if (!c) return;
  d.authoringVersion = 11;
  c.depositMode = "schedule";
  delete c.depositApproved;
  delete c.tierOverrideSource;
  c.ord = canonicalOrdinance(ord) || String(ord || "");
  citationPricing.refresh(d);
  const el = document.querySelector('[data-cit="' + iid + '|amount"]');
  if (el) el.textContent = c.amount;
  return c.amount;
}

function feeLines(base, cc, date) {
  const b = cents(base) ?? 0,
    c = cc === "" || cc == null ? CITFEES.courtCosts * 100 : (cents(cc) ?? 0),
    v = assessmentCents(b, c, date);
  return {
    cents: v,
    rows: [
      { k: "Base cash deposit", v: v.base / 100, note: "MGO 1.08(3)(a)–(b)" },
      { k: "Penalty assessment", v: v.penalty / 100, note: "Wis. Stat. 757.05" },
      { k: "Jail assessment", v: v.jail / 100, note: "Greater of 1% or $10, Wis. Stat. 302.46(1)" },
      { k: "Crime lab assessment", v: v.crimeLab / 100, note: "Wis. Stat. 165.755" },
      { k: "Court costs", v: v.court / 100, note: "Wis. Stat. 814.65" },
    ],
    total: v.total / 100,
  };
}

function lookupForf(sections, libraryKey = "", entryId = "", date) {
  if ((sections || []).length !== 1) return null;
  return resolveOrdinance(sections[0], libraryKey, entryId, date);
}

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

function validISO(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
  if (!m) return false;
  const d = new Date(s + "T12:00:00Z");
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() + 1 === +m[2] && d.getUTCDate() === +m[3];
}

function parseDate(v) {
  const s = String(v || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return validISO(s) ? s : null;
  const m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/.exec(s);
  if (!m) return null;
  let y = +m[3];
  if (y < 100) y += 2000;
  const mo = +m[1],
    da = +m[2];
  if (mo < 1 || mo > 12 || da < 1 || da > 31 || y < 1900 || y > 2200) return null;
  const out = y + "-" + String(mo).padStart(2, "0") + "-" + String(da).padStart(2, "0");
  return validISO(out) ? out : null;
}

function parseTime(v) {
  const m = /^(\d{1,2}):(\d{2})(?::([0-5]\d)(?:\.\d+)?)?\s*([AaPp](?:[Mm])?)?$/.exec(String(v || "").trim());
  if (!m) return null;
  let h = +m[1];
  const mi = +m[2],
    ap = (m[4] || "").slice(0, 1).toLowerCase();
  if (ap && (h < 1 || h > 12)) return null;
  if (ap === "p" && h < 12) h += 12;
  if (ap === "a" && h === 12) h = 0;
  if (h > 23 || mi > 59) return null;
  return String(h).padStart(2, "0") + ":" + String(mi).padStart(2, "0");
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
  const value = prompt("Enter the missing corrective-action detail:");
  if (value === null || !value.trim()) return;
  el.replaceWith(document.createTextNode(value.trim()));
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.focus();
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

function inspAt(d) {
  if (hasOwnInsp(d)) return { date: d.inspDate || "", time: d.inspTime || "", own: true };
  const k = docCase(d);
  return { date: k.date || "", time: k.time || "", own: false };
}

function freezeSources(d) {
  return {
    ...(snow.is(d) ? snow.freeze(d) : {}),
    case: clone(docCase(d)),
    inspector: clone(docInsp(d)),
    body: docBody(d),
    ...(d.special
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
    [checkTarget("#btn-add-top", "Select violations")],
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
      ? [
          checkTarget(
            "#btn-cc",
            "Copies & email",
            "recipient:" + recipientProblem.scope + ":" + recipientProblem.index + ":" + recipientProblem.field,
          ),
        ]
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
  forCit[5].targets = noAgent ? [checkTarget("#btn-cc", "Copies & email")] : [];
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
          ? "The parcel number is not 12 digits — check it against Accela"
          : "No parcel number on the case — a notice cannot be issued without one",
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

function documentFileName(d) {
  const k = docCase(d),
    ty = (DOC_TYPES.find((t) => t.id === d.type) || {}).label || d.type;
  const tag = String(d.id || "")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(-8);
  const name = [k.address || "PROPERTY", k.number || "CASE", ty, fmtDate(d.mailed || recordDay(today)).replace(/\//g, "-")]
    .concat(tag ? [tag] : [])
    .join(" - ")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return (d.void ? "VOID - " : "") + name;
}

async function checkHelper() {
  try {
    const r = await authFetch("/dw-status", { cache: "no-store" });
    if (!r.ok) throw 0;
    WriterState.HELPER = await r.json();
  } catch (e) {
    WriterState.HELPER = null;
  }
  return WriterState.HELPER;
}

function emailSubject(d) {
  const k = docCase(d),
    ty = (DOC_TYPES.find((t) => t.id === d.type) || {}).label || d.type;
  return "City of Madison Building Inspection — " + ty + " — " + (k.address || "") + " — " + (k.number || "");
}

function emailBody(d) {
  const k = docCase(d),
    i = docInsp(d),
    ty = (DOC_TYPES.find((t) => t.id === d.type) || {}).label || d.type;
  return [
    "Attached is a " + ty.toLowerCase() + " for " + (k.address || "the property above") + ".",
    "",
    "Case number: " + (k.number || ""),
    "Property: " + (k.address || ""),
    "Date mailed: " + fmtDate(d.mailed || recordDay(today)),
    "",
    "Please contact the inspector below with any questions.",
    "",
    i.name || "",
    i.title || "",
    i.phone || "",
    i.email || "",
  ].join("\r\n");
}

async function emailDocument(d, picked, reuse, job) {
  if (!d || d.draft || d.pendingAmendment) {
    toast("Issue and confirm the document before preparing an email.");
    return false;
  }
  const k = kase(d.caseId),
    list = emailList(k).filter((e) => String(e.addr || "").trim());
  // An issued document has already been filed. The email attaches that same
  // file; the page travels with the request only as a fallback for when it
  // is not there, so a second render can never replace what was filed.
  const artifact = issuedArtifact(d);
  if (!artifact) {
    toast(
      "This issued version has no verified archived PDF. It cannot be attached " +
        "as an exact original. Re-file it only after reviewing the record.",
    );
    return false;
  }
  const jb = job && job.docId === d.id ? job : { docId: d.id, name: artifact.filename, html: "" };
  const useFiled = true;
  if (!picked && list.length) {
    WriterState.state.modal = "sendto";
    WriterState.state.sendDoc = d.id;
    WriterState.state.sendJob = jb;
    WriterState.state.sendReuse = useFiled;
    render();
    return false;
  }
  const to = (picked || []).filter((e) => String(e.addr || "").trim());
  if (!WriterState.HELPER) {
    toast("Emailing needs the program started with Start Document Writer.bat");
    return false;
  }

  toastHold("Preparing the email — this takes a few seconds");
  try {
    const r = await authFetch("/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: (jb && jb.name) || documentFileName(d) + ".pdf",
        html: "",
        reuse: useFiled,
        sha256: artifact.sha256,
        docId: d.id,
        to: to.map((e) => e.addr).join("; "),
        subject: emailSubject(d),
        body: emailBody(d),
      }),
    });
    const j = await r.json();
    if (j && j.ok) {
      // Opening a compose window is not confirmation of delivery.
      // Do not alter an issued snapshot or its filed PDF here.
      toast(
        j.via === "outlook"
          ? "Outlook is opening with " + j.name + " attached"
          : "Outlook was not found — your mail program is opening without the attachment",
      );
      return true;
    }
    toast("Could not open the email — " + ((j && j.error) || "unknown reason"));
    return false;
  } catch (e) {
    toast("Could not reach the local helper to send the email");
    return false;
  }
}

function issuedArtifact(d) {
  if (!d || d.draft) return null;
  const events = eventsFor(d.caseId).filter((ev) => ev.type === "document.filed" && (ev.payload || {}).docId === d.id);
  const p = (events.at(-1) || {}).payload || {};
  return p.sha256 && p.filename ? { filename: p.filename, sha256: p.sha256, docId: d.id } : null;
}

async function openIssuedCopy(d) {
  if (!d || d.draft) return false;
  const artifact = issuedArtifact(d);
  if (artifact && WriterState.HELPER) {
    try {
      const response = await authFetch("/artifact/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(artifact),
      });
      const reply = await response.json();
      if (reply.ok) {
        const bytes = Uint8Array.from(atob(reply.pdf), (c) => c.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
        const windowCopy = window.open(url, "_blank");
        if (windowCopy) {
          toast("Opened the verified archived PDF. Print it from the PDF viewer.");
          setTimeout(() => URL.revokeObjectURL(url), 300000);
          return true;
        }
        const a = document.createElement("a");
        a.href = url;
        a.download = artifact.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast("Pop-up blocked — downloaded the verified archived PDF.");
        setTimeout(() => URL.revokeObjectURL(url), 300000);
        return true;
      }
      toast("Exact issued PDF unavailable: " + (reply.error || "verification failed"));
    } catch (e) {
      toast("Exact issued PDF unavailable: the local helper or archive could not be reached.");
    }
  } else
    toast(
      artifact
        ? "Exact issued PDF unavailable: start the local helper."
        : "This historical version has no recorded PDF checksum, so its original bytes cannot be verified.",
    );
  if (confirm("The exact issued PDF could not be verified. Open a clearly labeled RECONSTRUCTED copy from saved data instead?")) {
    const job = printJob(d);
    if (job) {
      job.html = job.html.replace(
        "<body>",
        '<body><div style="font: bold 14px sans-serif;padding:12px;border:2px sol' +
          'id #900">RECONSTRUCTED COPY — NOT VERIFIED ORIGINAL ISSUED PDF</div>',
      );
      printNotice(job);
    }
  }
  return false;
}

function printJob(d) {
  if (!d) return null;
  if (d.type === "citation" && d.draft && Object.values(d.cits || {}).some((c) => c.mandatoryAppearance))
    throw new Error("Mandatory-appearance citations need division-approved defendant instructions. Your draft is retained.");
  if (
    d.type === "citation" &&
    (Object.keys(d.depositRequests || {}).length || d.items.some((i) => i.cite && !i.withdrawn && citationDepositFault(d.cits?.[i.id] || {}, d, i)))
  )
    throw new Error("Complete and confirm every citation deposit before printing or filing.");
  // A separate, fixed-width frame prevents a narrow viewport or old scroll
  // geometry from changing the filed document. Everything comes from d.
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:absolute;left:-20000px;top:0;width:1400px;height:1200px;border:0;pointer-events:none";
  document.body.appendChild(frame);
  try {
    const fd = frame.contentDocument;
    if (fd && fd.open) {
      fd.open();
      fd.write(
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><style>' +
          ((document.querySelector("style") || {}).textContent || "") +
          '</style></head><body><div class="desk">' +
          documentHTML(d) +
          "</div></body></html>",
      );
      fd.close();
      const stage = fd.querySelector(".desk");
      if (snow.is(d) && d.authoringVersion >= 9) {
        // Measure the same locked print styles and value spans that will be filed.
        const html = printableHTML(d, stage);
        fd.open();
        fd.write(html);
        fd.close();
        paginate(fd.querySelector(".desk"), d);
        return { docId: d.id, name: documentFileName(d) + ".pdf", html: "<!doctype html>" + fd.documentElement.outerHTML };
      }
      paginate(stage, d);
      return { docId: d.id, name: documentFileName(d) + ".pdf", html: printableHTML(d, stage) };
    }
    if (WriterState.state.docId !== d.id) return null;
    return { docId: d.id, name: documentFileName(d) + ".pdf", html: printableHTML() };
  } finally {
    frame.remove();
  }
}

async function filePdf(d, job) {
  if (!d) return false;
  if (!WriterState.HELPER || !WriterState.HELPER.chrome) return false;
  // named jb: the JSON reply inside the try block is already called j
  const jb = job && job.docId === d.id ? job : printJob(d);
  if (!jb || !jb.html) return false;
  const snapshot = eventsFor(d.caseId).find((e) => e.payload?.snapshot?.id === d.id)?.payload.snapshot;
  if (!snapshot) throw new Error("Save the issued document before filing its PDF.");
  const operation = {
    caseId: snapshot.caseId || d.caseId,
    caseNumber: snapshot.frozen?.case?.number || kase(d.caseId).number,
    docId: d.id,
    version: await recordIntegrity.sourceHash(snapshot),
  };
  toastHold("Filing " + jb.name + " — this takes a few seconds");
  try {
    const r = await authFetch("/save-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: jb.name, html: jb.html, operation }),
    });
    const j = await r.json();
    if (j && j.ok) {
      if (j.local) {
        WriterState.HELPER.outbox = (WriterState.HELPER.outbox || 0) + 1;
        toast("PDF filing needed. Original saved in the local outbox. Open Saved work & connection to transfer it.");
      } else toast("Filed " + j.name);
      if (
        !d.draft &&
        !d.void &&
        !d.superseded &&
        !eventsFor(d.caseId).some((e) => e.type === "document.filed" && e.payload.docId === d.id && e.payload.sha256 === j.sha256)
      ) {
        appendEvent(d.caseId, "document.filed", {
          docId: d.id,
          reference: j.path || j.name,
          filename: j.name,
          sha256: j.sha256 || "",
          local: !!j.local,
        });
        project();
      }
      if (!d.draft && !d.void && !d.superseded) {
        await saveCaseFile(d.caseId);
        await refreshArtifactLocations();
      }
      return true;
    }
    toast("Could not write the PDF — " + ((j && j.error) || "unknown reason"));
    return false;
  } catch (e) {
    toast("PDF filing needed. The helper response is uncertain. Use File issued PDF to retry the same original.");
    return false;
  }
}

export {
  nthWeekday,
  lastWeekday,
  courtHolidays,
  isCourtHoliday,
  nextCourtDate,
  citationNumber,
  applyDeposit,
  feeLines,
  lookupForf,
  rnd12,
  fmtDate,
  validISO,
  parseDate,
  parseTime,
  splitOwner,
  longDate,
  fmtTime,
  toast,
  toastHold,
  toastUndo,
  fillBlank,
  allItems,
  activeBlocks,
  inspAt,
  freezeSources,
  checks,
  documentFileName,
  checkHelper,
  emailSubject,
  emailBody,
  emailDocument,
  issuedArtifact,
  openIssuedCopy,
  printJob,
  filePdf,
};
