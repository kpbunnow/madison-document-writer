import { openAt as reportOpenAt } from "./report_facts.js";
import { createReportReturn } from "./report_return.js";
import { iso, validISO, fmtDate, fmtNum, fmtDays, fmtMoney, plural, uniq, avg, ownerKeyLabel, areaLabel, inPeriod, violOk } from "./report_facts.js";
export { iso, validISO, fmtDate, fmtNum, fmtDays, fmtMoney, plural, uniq, ownerKeyLabel, areaLabel, inPeriod, violOk };
import { createReportCatalog } from "./report_catalog.js";
import { createReportsServices } from "./reports_services.js";
import { createReportsScreens } from "./reports_screens.js";
import { createReportsViewContext } from "./reports_view_contexts.js";
import { listenForStop, showStopped } from "./helper_stopped.js";

import { ReportsState } from "./state.js";
import { initDepositSchedule } from "./deposit_schedule.js";
import { installLeaflet } from "./vendor/leaflet_runtime.js";
import { createAccessibility } from "./accessibility.js";

const reportsServices = createReportsServices({
  get render() {
    return render;
  },
  get drawMap() {
    return drawMap;
  },
  get shell() {
    return shell;
  },
  get A11Y() {
    return A11Y;
  },
  get REPORT_CHANNEL() {
    return REPORT_CHANNEL;
  },
  get REPORT_VIEWS_KEY() {
    return REPORT_VIEWS_KEY;
  },
  get STREET_WORDS() {
    return STREET_WORDS;
  },
  get TODAY() {
    return TODAY;
  },
  get areaIdOf() {
    return areaIdOf;
  },
  get esc() {
    return esc;
  },
  get iso() {
    return iso;
  },
  get plural() {
    return plural;
  },
  get reportById() {
    return reportById;
  },
  get restoreReportReturn() {
    return restoreReportReturn;
  },
  get uniq() {
    return uniq;
  },
  get validISO() {
    return validISO;
  },
  get violOk() {
    return violOk;
  },
});
export let {
  exportReportCSV,
  humanCorrectionValue,
  shareReportView,
  showSharedViews,
  printReport,
  daysBetween,
  median,
  normStreet,
  relativeDates,
  saveReportView,
  applyReportView,
  reportOrdinance,
  deleteReportView,
  openInWriter,
  loadAll,
  ordSort,
  areaKey,
  areaSort,
  caseOk,
  versionAt,
  noticeAt,
  statusAt,
  violationAt,
  violOpenAt,
  groupBy,
  render,
} = reportsServices;
const reportsScreens = createReportsScreens({
  get humanCorrectionValue() {
    return humanCorrectionValue;
  },
  get render() {
    return render;
  },
  get A11Y() {
    return A11Y;
  },
  get D() {
    return D;
  },
  get DEFINITIONS() {
    return DEFINITIONS;
  },
  get REPORTS() {
    return REPORTS;
  },
  get STATUSES() {
    return STATUSES;
  },
  get STATUS_COL() {
    return STATUS_COL;
  },
  get TILE() {
    return TILE;
  },
  get actions() {
    return actions;
  },
  get activeFilters() {
    return activeFilters;
  },
  get depositSchedule() {
    return depositSchedule;
  },
  get esc() {
    return esc;
  },
  get fmtDate() {
    return fmtDate;
  },
  get fmtDays() {
    return fmtDays;
  },
  get fmtMoney() {
    return fmtMoney;
  },
  get fmtNum() {
    return fmtNum;
  },
  get iso() {
    return iso;
  },
  get numOr() {
    return numOr;
  },
  get plural() {
    return plural;
  },
  get reportById() {
    return reportById;
  },
  get reports_reportpresentationContext() {
    return reports_reportpresentationContext;
  },
  facts: {
    get areaKey() {
      return areaKey;
    },
    get areaSort() {
      return areaSort;
    },
    get caseOk() {
      return caseOk;
    },
    get daysBetween() {
      return daysBetween;
    },
    get groupBy() {
      return groupBy;
    },
    get normStreet() {
      return normStreet;
    },
    get areaIdOf() {
      return areaIdOf;
    },
    get areaLabel() {
      return areaLabel;
    },
    get inPeriod() {
      return inPeriod;
    },
    get ownerKeyLabel() {
      return ownerKeyLabel;
    },
    get uniq() {
      return uniq;
    },
    get validISO() {
      return validISO;
    },
    get violOk() {
      return violOk;
    },
  },
  exports: {
    get CRC_T() {
      return CRC_T;
    },
    get EXPORT_SCOPE() {
      return EXPORT_SCOPE;
    },
    get STYLES() {
      return STYLES;
    },
    get excelDate() {
      return excelDate;
    },
    get xesc() {
      return xesc;
    },
  },
});
export let { reportActions, shell, drawMap, propertyHits, openCase, exportWorkbook, toggleArea } = reportsScreens;
const reportsViewContext = createReportsViewContext({
  get ctx_reports_areaKey() {
    return areaKey;
  },
  get ctx_reports_REPORTS() {
    return REPORTS;
  },
  get ctx_reports_areaLabel() {
    return areaLabel;
  },
  get ctx_reports_esc() {
    return esc;
  },
  get ctx_reports_fmtDate() {
    return fmtDate;
  },
  get ctx_reports_fmtNum() {
    return fmtNum;
  },
  get ctx_reports_ownerKeyLabel() {
    return ownerKeyLabel;
  },
  get ctx_reports_plural() {
    return plural;
  },
  get ctx_reports_reportById() {
    return reportById;
  },
});
export let { reports_reportpresentationContext } = reportsViewContext;

installLeaflet();

/* Per-report exports and immutable, shareable preferences. */

document.addEventListener("click", async (e) => {
  const t = e.target.closest?.("[data-report-csv],[data-report-print],[data-share-report-view],[data-shared-report-views]");
  if (!t) return;
  try {
    if (t.hasAttribute("data-report-csv")) exportReportCSV();
    else if (t.hasAttribute("data-report-print")) printReport();
    else if (t.hasAttribute("data-share-report-view")) await shareReportView();
    else await showSharedViews();
  } catch (error) {
    A11Y.notify(error.message, { severity: "error" });
  }
});

export const A11Y = createAccessibility();
export const depositSchedule = initDepositSchedule({ render: (...args) => render(...args), esc: (...args) => esc(...args) });

/* =====================================================================
   Building Inspection — Reports
   Reads the per-case summaries the Document Writer keeps in
   Case JSON Files/Reporting Index, through the local helper (server.py).
   It never writes the case record. Everything shown is computed here
   from those summaries, the parcel cache and the area outlines.
   ===================================================================== */

/* ---------- small helpers ---------- */
export const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const TODAY = iso(new Date());

/* ---------- owner key ----------
   One owner is recognized by mailing address (division, 09/18/2026): the
   street line and the 5-digit ZIP. The first line of a mailing block may be a
   person's name or a care-of line, so the street line is the last line
   before the city line that starts with a number or PO BOX.
   Management-company addresses are kept: every owner using one manager
   shares its key, and the report lists every owner name under a key. */
export const STREET_WORDS = {
  STREET: "ST",
  STR: "ST",
  AVENUE: "AVE",
  AV: "AVE",
  AVN: "AVE",
  ROAD: "RD",
  DRIVE: "DR",
  DRV: "DR",
  LANE: "LN",
  COURT: "CT",
  BOULEVARD: "BLVD",
  BLV: "BLVD",
  PLACE: "PL",
  PARKWAY: "PKWY",
  PKY: "PKWY",
  CIRCLE: "CIR",
  TERRACE: "TER",
  TRAIL: "TRL",
  HIGHWAY: "HWY",
  SQUARE: "SQ",
  CROSSING: "XING",
  RIDGE: "RDG",
  NORTH: "N",
  SOUTH: "S",
  EAST: "E",
  WEST: "W",
  NORTHEAST: "NE",
  NORTHWEST: "NW",
  SOUTHEAST: "SE",
  SOUTHWEST: "SW",
  APARTMENT: "UNIT",
  APT: "UNIT",
  SUITE: "UNIT",
  STE: "UNIT",
  RM: "UNIT",
  ROOM: "UNIT",
  FLOOR: "FL",
};

/* ---------- geometry ---------- */

/* In a polygon: inside the outer ring and in none of its holes. In a
   multipolygon: in any of its parts. */

/* The property carrying the area's identifier. The district layer's field
   name is not known in advance, so the first property whose name reads as a
   district (or ZIP) and whose values all fit is used. */

export const areaIdOf = (f, field) =>
  String((f.properties || {})[field] == null ? "" : (f.properties || {})[field])
    .trim()
    .replace(/^0+(\d)/, "$1");

/* ---------- state ---------- */
export const TILE = {
  labels: "https://maps.cityofmadison.com/arcgis/rest/services/BaseMaps/Color_basemap/MapServer/tile/{z}/{y}/{x}",
  plain: "https://maps.cityofmadison.com/arcgis/rest/services/BaseMaps/Color_base_No_Names/MapServer/tile/{z}/{y}/{x}",
};
export const STATUSES = [
  "Notice",
  "Extension",
  "Best Interest Extension",
  "Vacancy Extension",
  "Summary Abatement",
  "Non-Summary Abatement",
  "Occupancy restricted",
  "Restriction released",
  "Cited",
  "Referred",
  "Closed",
  "Withdrawn",
  "Cited – snow",
];
export const STATUS_COL = { Notice: "#14567F", Extension: "#C26A00", Cited: "#A8201A", Referred: "#5A3C8C", Closed: "#1B6045" };
ReportsState.S = {
  phase: "loading",
  msg: "Reading the reporting index…",
  error: "",
  raw: null,
  parcels: {},
  parcelMissing: [],
  parcelNote: "",
  areas: null,
  M: null,
  rep: null,
  screen: "openCases",
  view: "table",
  basemap: "labels",
  drill: null,
  prop: { q: "", hits: null },
  own: { q: "", key: "" },
  areasOpen: false,
  F: {
    from: TODAY.slice(0, 4) + "-01-01",
    to: TODAY,
    asOf: TODAY,
    areaType: "district",
    boundary: "current",
    areas: [],
    inspector: "",
    vtype: "",
    ord: "",
    status: "",
    owner: "",
  },
};

/* Saved views are local preferences, never reporting records. The date mode
   records whether dates are fixed or evaluated anew when opened. */
export const REPORT_VIEWS_KEY = "madison-report-views-v1";
ReportsState.SAVED_VIEWS = [];
try {
  const data = JSON.parse(localStorage.getItem(REPORT_VIEWS_KEY) || "[]");
  if (Array.isArray(data)) ReportsState.SAVED_VIEWS = data.filter((x) => x && x.version === 1 && x.name && x.report && x.filters).slice(0, 40);
} catch (e) {
  /* Malformed optional local preferences are ignored; default report filters remain available. */
}
ReportsState.S.dateMode = "fixed";
ReportsState.S.savedId = "";
ReportsState.S.reportNotice = "";

export const REPORT_CHANNEL = "madison-writer-handoff-v1";
ReportsState.REPORT_LINK = null;

/* ---------- loading ---------- */

/* ---------- the model ---------- */

/* ---------- filters ---------- */

/* A case counts once its Official Notice or its snow-only citation has been issued. */

/* As-of reports mean end of the selected calendar day. A correction starts
   when recorded, not at the old letter's mailing date; void/replacement ends
   that version without removing the days for which it was on the record. */

const openAt = (c, date) => reportOpenAt(c, date, reportsServices);

/* ---------- the reports ----------
   Each returns {cols, rows, total, area, points, note}. A numeric cell is
   {n, ids, fmt}; ids are the case numbers behind it, so every count links
   through to its cases. area is {areaKey: n}, for shading the map. */
export const REPORTS = createReportCatalog({
  get TODAY() {
    return TODAY;
  },
  get areaKey() {
    return areaKey;
  },
  get areaLabel() {
    return areaLabel;
  },
  get areaSort() {
    return areaSort;
  },
  get avg() {
    return avg;
  },
  get caseOk() {
    return caseOk;
  },
  get daysBetween() {
    return daysBetween;
  },
  get fmtDate() {
    return fmtDate;
  },
  get groupBy() {
    return groupBy;
  },
  get inPeriod() {
    return inPeriod;
  },
  get median() {
    return median;
  },
  get openAt() {
    return openAt;
  },
  get ordSort() {
    return ordSort;
  },
  get ownerKeyLabel() {
    return ownerKeyLabel;
  },
  get plural() {
    return plural;
  },
  get statusAt() {
    return statusAt;
  },
  get uniq() {
    return uniq;
  },
  get violOk() {
    return violOk;
  },
  get violOpenAt() {
    return violOpenAt;
  },
  get violationAt() {
    return violationAt;
  },
});
export const reportById = (id) => REPORTS.find((r) => r.id === id);

/* ---------- rendering ---------- */

export const actions = () => reportActions();

export const activeFilters = () => {
  const F = ReportsState.S.F;
  return !!(F.areas.length || F.inspector || F.vtype || F.ord || F.status || F.owner);
};

/* ---------- map ---------- */
ReportsState.MAP = null;

/* ---------- property and owner ---------- */

/* ---------- data and definitions ---------- */

export const DEFINITIONS = [
  [
    "Counted cases",
    "A case counts once its Official Notice or snow-only citation has been is" +
      "sued. Snow cases close on PDF filing when configured and are excluded fr" +
      "om Days to compliance. Drafts never reach the record and are never count" +
      "ed. Current period reports use current corrected facts, keep the origina" +
      "l action date and count each action once. Withdrawn items are excluded f" +
      "rom compliance totals. As-of reports retain earlier versions until their" +
      " recorded replacement or withdrawal day (end-of-day basis).",
  ],
  [
    "Case opened",
    "The initial inspection date. Reports with a period filter cases by this " +
      "date, except citations, referrals, overridden deposits and document actions, which filter by the date they were" +
      " issued. The workbook's Corrections sheet filters by the date each correction was recorded.",
  ],
  ["Open", 'A case with an issued notice and no compliance letter. "As of" a date means open on that date.'],
  [
    "Status",
    "The latest issued document: Notice, Extension, Cited, Referred, Closed (" +
      "compliant) or Withdrawn (all items entered in error). A referred case st" +
      "ays Referred until it is closed.",
  ],
  ["Violation", "One numbered item on the Official Notice. Item numbers never change, so " + "item 3 is the same violation on every later document."],
  ["Open violation", "An item not yet recorded as corrected, on the latest document or at a later visit."],
  [
    "Days to compliance",
    "From the initial inspection date to the date the item was recorded as co" + "rrected. Items still open are shown separately with their age.",
  ],
  [
    "Violation type",
    "The order-language library entry the item was picked from. Items written" +
      " before the library key existed are matched on the same title and sectio" +
      "ns; anything else is grouped as Unclassified by its first ordinance sect" +
      "ion.",
  ],
  ["Citation", "Each citation number on an issued, non-void citation, with the ordinance" + ", date and cash deposit printed on the MC-2000."],
  ["Referral", "A Referral for Prosecution. Updates to a referral are not counted again."],
  ["Owner", "The owner as the most recent issued document printed it."],
  [
    "Owner by mailing address",
    "One owner is recognized by the street line and 5-digit ZIP of the mailin" +
      "g address, with street types, directions and unit markers written one wa" +
      "y. Name and care-of lines are skipped. Owners sharing a property manager" +
      "’s address share one key; every name seen is shown.",
  ],
  [
    "Area",
    "Alder district comes from the city parcel layer for the case’s parcel. C" +
      "urrent uses the district as the parcel reads now; When opened uses the d" +
      "istrict as it read when the case opened, as far as the parcel had been l" +
      "ooked up by then. ZIP comes from the Accela site address, else from ZIP " +
      "outlines if provided. Cases with neither are Unlocated.",
  ],
];

/* What each workbook sheet selects, for the About sheet. Text only: it describes
   exportSheets() and the report definitions and must change when they do. */
export const EXPORT_SCOPE = [
  [
    "Cases",
    "Counted cases opened in the period (case opening date). Area, inspector (the inspector on the case), owner and current " +
      "status apply. Violation type and ordinance keep cases with at least one matching item that is not withdrawn.",
  ],
  [
    "Violations",
    "Items on the cases in the Cases sheet that match the violation type and ordinance, including withdrawn items. The period " +
      "uses the case opening date.",
  ],
  [
    "Visits",
    "Every visit and item result on the cases in the Cases sheet. Visit date, visit inspector, violation type and ordinance are " +
      "not applied to the visits, so a visit can fall outside the period.",
  ],
  [
    "Citations",
    "Citations issued in the period (issue date) on any counted case, whenever it opened. Inspector means the issuing inspector " +
      "and ordinance the cited ordinance. Violation type is not applied. Area, owner and current status apply to the case.",
  ],
  [
    "Referrals",
    "Referrals issued in the period (issue date) on any counted case, whenever it opened. Inspector means the referring " +
      "inspector. Area, owner, current status, violation type and ordinance apply to the case (at least one matching item).",
  ],
  [
    "Corrections",
    "Corrections recorded in the period (date recorded, Central time) on any counted case, whenever it opened. Area, inspector " +
      "(the inspector on the case), owner, current status, violation type and ordinance apply to the case.",
  ],
  [
    "Numbered report sheets",
    "The same rows as each report on screen. Reports 1 and 3 use the As of date instead of the period; reports 2 and 4–7 use " +
      "the case opening date; reports 8–11 use the date issued and the issuing inspector. Report 8 applies violation type to " +
      "the cited item, reports 9 and 10 apply it to the case and report 11 does not apply it.",
  ],
];

/* ---------- Excel ----------
   A stored (uncompressed) ZIP holding the SpreadsheetML parts. Dates are
   real Excel dates and money is numeric. */
export const CRC_T = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export const xesc = (s) =>
  String(s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const excelDate = (s) => {
  const p = s.split("-").map(Number);
  return Date.UTC(p[0], p[1] - 1, p[2]) / 86400000 + 25569;
};
/* cell values: string, number, {d:'YYYY-MM-DD'}, {m:n} money, {f:n} one
   decimal, null */

export const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  ('<numFmts count="2"><numFmt numFmtId="164" formatCode="mm/dd/yyyy"/><numF' + 'mt numFmtId="165" formatCode="0.0"/></numFmts>') +
  ('<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2' +
    '"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/>' +
    "</font></fonts>") +
  ('<fills count="2"><fill><patternFill patternType="none"/></fill><fill><pa' + 'tternFill patternType="gray125"/></fill></fills>') +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

export const D = (s) => (validISO(s) ? { d: s } : null);
export const numOr = (v) => (/^\d+$/.test(String(v)) ? +v : v);
/* The flat tables follow the current filters as EXPORT_SCOPE describes. Cases,
   violations and visits use the period on the case opening date; citations and
   referrals use the date they were issued; corrections the date recorded. */

document.addEventListener("click", (e) => {
  const t = e.target.closest?.("[data-report-sort]");
  if (!t) return;
  const ci = +t.dataset.reportSort,
    old = ReportsState.S.tableSort;
  ReportsState.S.tableSort = { report: ReportsState.S.screen, ci, dir: old?.report === ReportsState.S.screen && old.ci === ci ? -old.dir : 1 };
  render();
  document.querySelector('[data-report-sort="' + ci + '"]')?.focus();
});
/* ---------- events ---------- */

document.addEventListener("click", (e) => {
  const t =
    e.target.closest &&
    e.target.closest(
      "[data-screen],[data-view],[data-act],[data-drill],[data-case],[data-writ" +
        "er],[data-owner],[data-areatype],[data-boundary],[data-basemap],[data-pe" +
        "riod]",
    );
  if (!t) return;
  const d = t.dataset;
  if (d.period) {
    const now = iso(new Date());
    ReportsState.S.F.to = now;
    ReportsState.S.F.asOf = now;
    ReportsState.S.F.from =
      d.period === "month"
        ? now.slice(0, 7) + "-01"
        : d.period === "year"
          ? now.slice(0, 4) + "-01-01"
          : ReportsState.S.M.counted
              .map((c) => c.opened)
              .filter(validISO)
              .sort()[0] || now;
    ReportsState.S.dateMode = d.period;
    ReportsState.S.savedId = "";
    ReportsState.S.drill = null;
    render();
    return;
  }
  if (d.screen) {
    ReportsState.S.screen = d.screen;
    ReportsState.S.savedId = "";
    ReportsState.S.reportNotice = "";
    ReportsState.S.drill = null;
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (d.view) {
    ReportsState.S.view = d.view;
    ReportsState.S.savedId = "";
    render();
    return;
  }
  if (d.basemap) {
    ReportsState.S.basemap = d.basemap;
    render();
    return;
  }
  if (d.areatype) {
    if (ReportsState.S.F.areaType !== d.areatype) {
      ReportsState.S.F.areaType = d.areatype;
      ReportsState.S.F.areas = [];
      ReportsState.S.drill = null;
      ReportsState.S.savedId = "";
    }
    render();
    return;
  }
  if (d.boundary) {
    if (ReportsState.S.F.boundary !== d.boundary) {
      ReportsState.S.F.boundary = d.boundary;
      ReportsState.S.F.areas = [];
      ReportsState.S.drill = null;
      ReportsState.S.savedId = "";
    }
    render();
    return;
  }
  if (d.drill) {
    const parts = d.drill.split(":"),
      res = ReportsState.S.rep && ReportsState.S.rep.res;
    if (!res) return;
    const row = parts[0] === "t" ? res.total : res.rows[+parts[0]].cells || res.rows[+parts[0]],
      x = row && row[+parts[1]];
    if (!x || !x.ids) return;
    const first = typeof row[0] === "string" ? row[0] : (row[0] && row[0].text) || "";
    ReportsState.S.drill = { at: d.drill, ids: x.ids, title: res.list ? "Referred cases" : first + ", " + res.cols[+parts[1]].toLowerCase() };
    render();
    const p = document.getElementById("drill");
    if (p && p.scrollIntoView) p.scrollIntoView({ block: "start" });
    return;
  }
  if (d.case) {
    openCase(d.case);
    return;
  }
  if (d.writer) {
    openInWriter(d.writer);
    return;
  }
  if (d.owner) {
    ReportsState.S.screen = "owner";
    ReportsState.S.own = { q: "", key: d.owner };
    ReportsState.S.drill = null;
    render();
    window.scrollTo(0, 0);
    return;
  }
  const a = d.act;
  if (a === "reload") {
    loadAll(false);
    return;
  }
  if (a === "refreshParcels") {
    loadAll(true);
    return;
  }
  if (a === "export") {
    exportWorkbook();
    return;
  }
  if (a === "saveView") {
    saveReportView();
    return;
  }
  if (a === "deleteView") {
    deleteReportView();
    return;
  }
  if (a === "closeDrill") {
    ReportsState.S.drill = null;
    render();
    return;
  }
  if (a === "clearOwner") {
    ReportsState.S.F.owner = "";
    render();
    return;
  }
  if (a === "clearFilters") {
    Object.assign(ReportsState.S.F, {
      from: TODAY.slice(0, 4) + "-01-01",
      to: TODAY,
      asOf: TODAY,
      areaType: "district",
      boundary: "current",
      areas: [],
      inspector: "",
      vtype: "",
      ord: "",
      status: "",
      owner: "",
    });
    ReportsState.S.dateMode = "fixed";
    ReportsState.S.tableSort = null;
    ReportsState.S.savedId = "";
    ReportsState.S.drill = null;
    render();
    return;
  }
  if (a === "useOwner") {
    ReportsState.S.F.owner = ReportsState.S.own.key;
    ReportsState.S.screen = "allCases";
    ReportsState.S.savedId = "";
    ReportsState.S.drill = null;
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (a === "propGo") {
    const q = (document.getElementById("pv-q") || {}).value || "";
    ReportsState.S.prop = { q: q, hits: propertyHits(q) };
    render();
    return;
  }
  if (a === "ownGo") {
    const q = (document.getElementById("ow-q") || {}).value || "";
    ReportsState.S.own = { q: q, key: "" };
    render();
    return;
  }
});
document.addEventListener("change", (e) => {
  const t = e.target,
    F = ReportsState.S.F;
  if (t.id === "saved-view") {
    applyReportView(t.value);
    return;
  }
  if (t.dataset && t.dataset.area !== undefined) {
    ReportsState.S.areasOpen = true;
    toggleArea(t.dataset.area);
    return;
  }
  const k = {
    "f-from": "from",
    "f-to": "to",
    "f-asOf": "asOf",
    "f-inspector": "inspector",
    "f-vtype": "vtype",
    "f-ord": "ord",
    "f-status": "status",
  }[t.id];
  if (!k) return;
  if ((k === "from" || k === "to" || k === "asOf") && !validISO(t.value)) return; // a half-typed date is not a filter
  F[k] = t.value;
  if (["from", "to", "asOf"].includes(k)) ReportsState.S.dateMode = "fixed";
  ReportsState.S.savedId = "";
  ReportsState.S.drill = null;
  render();
});
document.addEventListener(
  "toggle",
  (e) => {
    if (e.target && e.target.id === "f-areas") ReportsState.S.areasOpen = e.target.open;
  },
  true,
);
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  if (e.target.id === "pv-q") {
    ReportsState.S.prop = { q: e.target.value, hits: propertyHits(e.target.value) };
    render();
  }
  if (e.target.id === "ow-q") {
    ReportsState.S.own = { q: e.target.value, key: "" };
    render();
  }
});

// Restores the report, filters, view, date mode and sort saved when a case was opened in Writer.
// Used by both the ?return=1 page load and the existing-tab return message.
export const restoreReportReturn = createReportReturn({
  get reportById() {
    return reportById;
  },
  get reportOrdinance() {
    return reportOrdinance;
  },
  get relativeDates() {
    return relativeDates;
  },
  get render() {
    return render;
  },
});

/* Exit Document Writer in a Writer window stops the helper: this window shows the same stopped state. */
listenForStop(() =>
  showStopped(["Exit Document Writer was used in a Writer window. Reports cannot read case records until Document Writer starts again."]),
);
if (!window.__NO_AUTOLOAD__)
  loadAll(false).then(() => {
    if (new URLSearchParams(location.search).has("return")) restoreReportReturn();
  });
