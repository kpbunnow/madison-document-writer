import { TILE } from "./report_metadata.js";
export { TILE };
import { CRC_T, xesc, excelDate, STYLES } from "./report_workbook_definitions.js";
export { CRC_T, xesc, excelDate, STYLES };
import { createReportFilterChange } from "./report_filter_events.js";
import { STATUSES, STATUS_COL } from "./report_metadata.js";
export { STATUSES, STATUS_COL };
import { activeReportFilters } from "./report_facts.js";
import { createReportNavigation } from "./report_navigation.js";
import { D, numOr } from "./report_facts.js";
export { D, numOr };
import { DEFINITIONS, EXPORT_SCOPE } from "./report_metadata.js";
export { DEFINITIONS, EXPORT_SCOPE };
import { STREET_WORDS, areaIdOf } from "./report_facts.js";
export { STREET_WORDS, areaIdOf };
import { openAt as reportOpenAt } from "./report_facts.js";
import { createReportReturn } from "./report_return.js";
import {
  iso,
  validISO,
  formatReportDate,
  fmtNum,
  fmtDays,
  fmtMoney,
  plural,
  uniq,
  avg,
  ownerKeyLabel,
  createReportAreaLabel,
  inPeriod,
  violOk,
} from "./report_facts.js";
const fmtDate = formatReportDate;
function currentReportFilters() {
  return ReportsState.S.F;
}
const areaLabel = createReportAreaLabel(currentReportFilters);
export { iso, validISO, fmtDate, fmtNum, fmtDays, fmtMoney, plural, uniq, ownerKeyLabel, areaLabel, inPeriod, violOk };
import { createReportCatalog } from "./report_catalog.js";
import { createReportsServices } from "./reports_services.js";
import { createReportsScreens } from "./reports_screens.js";
import { createReportsViewContext } from "./reports_view_contexts.js";
import { listenForReportStop } from "./report_connection.js";

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

/* ---------- geometry ---------- */

/* In a polygon: inside the outer ring and in none of its holes. In a
   multipolygon: in any of its parts. */

/* The property carrying the area's identifier. The district layer's field
   name is not known in advance, so the first property whose name reads as a
   district (or ZIP) and whose values all fit is used. */

/* ---------- state ---------- */

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

export const activeFilters = () => activeReportFilters(ReportsState.S.F);

/* ---------- map ---------- */
ReportsState.MAP = null;

/* ---------- property and owner ---------- */

/* ---------- data and definitions ---------- */

/* What each workbook sheet selects, for the About sheet. Text only: it describes
   exportSheets() and the report definitions and must change when they do. */

/* ---------- Excel ----------
   A stored (uncompressed) ZIP holding the SpreadsheetML parts. Dates are
   real Excel dates and money is numeric. */

/* cell values: string, number, {d:'YYYY-MM-DD'}, {m:n} money, {f:n} one
   decimal, null */

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

document.addEventListener(
  "click",
  createReportNavigation({
    get state() {
      return ReportsState.S;
    },
    get iso() {
      return iso;
    },
    get validISO() {
      return validISO;
    },
    get render() {
      return render;
    },
    get TODAY() {
      return TODAY;
    },
    get openCase() {
      return openCase;
    },
    get openInWriter() {
      return openInWriter;
    },
    get loadAll() {
      return loadAll;
    },
    get exportWorkbook() {
      return exportWorkbook;
    },
    get saveReportView() {
      return saveReportView;
    },
    get deleteReportView() {
      return deleteReportView;
    },
    get propertyHits() {
      return propertyHits;
    },
  }),
);
document.addEventListener(
  "change",
  createReportFilterChange({
    get state() {
      return ReportsState.S;
    },
    get applyReportView() {
      return applyReportView;
    },
    get toggleArea() {
      return toggleArea;
    },
    get validISO() {
      return validISO;
    },
    get render() {
      return render;
    },
  }),
);
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
  get state() {
    return ReportsState.S;
  },
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
listenForReportStop();
if (!window.__NO_AUTOLOAD__)
  loadAll(false).then(() => {
    if (new URLSearchParams(location.search).has("return")) restoreReportReturn();
  });
