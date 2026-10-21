import {
  applyReportView,
  areaKey,
  areaSort,
  caseOk,
  daysBetween,
  deleteReportView,
  exportReportCSV,
  groupBy,
  loadAll,
  median,
  noticeAt,
  openInWriter,
  ordSort,
  printReport,
  relativeDates,
  render,
  saveReportView,
  shareReportView,
  showSharedViews,
  statusAt,
  versionAt,
  violOpenAt,
  violationAt,
} from "./reports_services.js";
import { exportWorkbook, openCase, propertyHits, reportActions, toggleArea } from "./reports_screens.js";
import { ReportsState } from "./state.js";
import { reportSort } from "./contracts.js";
import { initDepositSchedule } from "./deposit_schedule.js";
import { installLeaflet } from "./vendor/leaflet_runtime.js";
import { recordDay } from "../assets/shared.js";
import { createAccessibility } from "./accessibility.js";

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
export const depositSchedule = initDepositSchedule();

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
export const iso = (d) => recordDay(d);
export const validISO = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ""))) return false;
  const d = new Date(s + "T12:00:00Z");
  return !isNaN(d) && iso(d) === s;
};
export const TODAY = iso(new Date());

export const fmtDate = (s) => (validISO(s) ? s.slice(5, 7) + "/" + s.slice(8, 10) + "/" + s.slice(0, 4) : "—");
export const fmtNum = (n) => (n == null || isNaN(n) ? "—" : Number(n).toLocaleString("en-US"));
export const fmtDays = (n) => (n == null || isNaN(n) ? "—" : (Math.round(n * 10) / 10).toLocaleString("en-US", { maximumFractionDigits: 1 }));
export const fmtMoney = (n) =>
  n == null || isNaN(n) ? "—" : "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const plural = (n, w, p) => fmtNum(n) + " " + (n === 1 ? w : p || w + "s");
export const uniq = (a) => Array.from(new Set(a));
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

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

export const ownerKeyLabel = (k) => (k ? k.replace("|", ", ") : "No usable mailing address");

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

export const areaLabel = (k, F) => (!k ? "Unlocated" : (F || ReportsState.S.F).areaType === "zip" ? k : "District " + k);

export const inPeriod = (d, F) => validISO(d) && d >= F.from && d <= F.to;
export const violOk = (v, F) => (!F.vtype || v.type === F.vtype) && (!F.ord || v.sections.indexOf(F.ord) >= 0);
/* A case counts once its Official Notice or its snow-only citation has been issued. */

/* As-of reports mean end of the selected calendar day. A correction starts
   when recorded, not at the old letter's mailing date; void/replacement ends
   that version without removing the days for which it was on the record. */

const openAt = (c, date) =>
  c.caseType === "snow-10.28"
    ? c.documents.some((d) => d.type === "citation" && versionAt(d, date)) && (!c.closedOn || c.closedOn > date)
    : noticeAt(c, date) && !["Closed", "Withdrawn"].includes(statusAt(c, date));

/* ---------- the reports ----------
   Each returns {cols, rows, total, area, points, note}. A numeric cell is
   {n, ids, fmt}; ids are the case numbers behind it, so every count links
   through to its cases. area is {areaKey: n}, for shading the map. */
const cell = (n, ids, fmt) => ({ n: n, ids: ids ? uniq(ids) : null, fmt: fmt || "int" });

const nos = (list) => list.map((x) => (x.c ? x.c.number : x.number));
const count = (l) => cell(l.length, nos(l));

export const REPORTS = [
  {
    id: "openCases",
    n: 1,
    label: "Open cases by area",
    date: "asOf",
    lede: "Cases with an issued notice or snow citation that remain open on the date chosen.",
    run(M, F) {
      const base = M.counted.filter((c) => caseOk(c, F, { asOf: F.asOf }) && openAt(c, F.asOf));
      const g = groupBy(base, (c) => areaKey(c, F)),
        keys = Array.from(g.keys()).sort(areaSort);
      const age = (l) => cell(avg(l.map((c) => daysBetween(c.opened, F.asOf)).filter((x) => x != null)), null, "days");
      const ref = (l) => count(l.filter((c) => statusAt(c, F.asOf) === "Referred"));
      const area = {};
      keys.forEach((k) => {
        area[k] = g.get(k).length;
      });
      return {
        cols: ["Area", "Open cases", "Average age (days)", "Of which referred"],
        rows: keys.map((k) => [areaLabel(k, F), count(g.get(k)), age(g.get(k)), ref(g.get(k))]),
        total: ["All areas", count(base), age(base), ref(base)],
        area: area,
        points: base,
      };
    },
  },
  {
    id: "byInspector",
    n: 2,
    label: "Cases by inspector",
    date: "period",
    lede: "Cases opened in the period, by the inspector on the case and the area.",
    run(M, F) {
      const base = M.counted.filter((c) => caseOk(c, F) && inPeriod(c.opened, F));
      const keys = uniq(base.map((c) => areaKey(c, F))).sort(areaSort);
      const g = groupBy(base, (c) => c.inspector || "—"),
        names = Array.from(g.keys()).sort();
      const across = (l) => keys.map((k) => count(l.filter((c) => areaKey(c, F) === k)));
      const area = {};
      keys.forEach((k) => {
        area[k] = base.filter((c) => areaKey(c, F) === k).length;
      });
      return {
        cols: ["Inspector"].concat(
          keys.map((k) => areaLabel(k, F)),
          ["Total"],
        ),
        rows: names.map((nm) => [nm].concat(across(g.get(nm)), [count(g.get(nm))])),
        total: ["All inspectors"].concat(across(base), [count(base)]),
        area: area,
        points: base,
        matrix: true,
      };
    },
  },
  {
    id: "openViolations",
    n: 3,
    label: "Open violations by area",
    date: "asOf",
    lede: "Violation items not corrected on the date chosen, on cases whose notice had been issued by then.",
    run(M, F) {
      const vs = [];
      M.counted.forEach((c) => {
        if (!caseOk(c, F, { asOf: F.asOf }) || !(c.noticeIssued <= F.asOf)) return;
        c.violations.forEach((v) => {
          const at = violationAt(v, F.asOf);
          if (at && violOk(at, F) && violOpenAt(v, F.asOf)) vs.push(at);
        });
      });
      const g = groupBy(vs, (v) => areaKey(v.c, F)),
        keys = Array.from(g.keys()).sort(areaSort);
      const top = (l) => {
        let best = "",
          n = 0;
        groupBy(l, (v) => v.typeLabel).forEach((x, k) => {
          if (x.length > n) {
            n = x.length;
            best = k;
          }
        });
        return best ? best + " (" + n + ")" : "—";
      };
      const row = (label, l) => [label, count(l), cell(uniq(nos(l)).length, nos(l)), top(l)];
      const area = {};
      keys.forEach((k) => {
        area[k] = g.get(k).length;
      });
      return {
        cols: ["Area", "Open violations", "Cases", "Most common violation"],
        rows: keys.map((k) => row(areaLabel(k, F), g.get(k))),
        total: row("All areas", vs),
        area: area,
        points: uniq(vs.map((v) => v.c)),
      };
    },
  },
  {
    id: "allCases",
    n: 4,
    label: "All cases",
    date: "period",
    lede: "Cases opened in the period (by initial inspection date), and where they stand now.",
    run(M, F) {
      const base = M.counted.filter((c) => caseOk(c, F) && inPeriod(c.opened, F));
      const g = groupBy(base, (c) => areaKey(c, F)),
        keys = Array.from(g.keys()).sort(areaSort);
      const closed = (c) => c.status === "Closed" || (c.caseType === "snow-10.28" && !!c.closedOn);
      const row = (label, l) => [
        label,
        count(l),
        count(l.filter((c) => !closed(c) && c.status !== "Withdrawn")),
        count(l.filter(closed)),
        count(l.filter((c) => c.status === "Withdrawn")),
        count(l.filter((c) => c.citations.length > 0)),
        count(l.filter((c) => c.referrals.length > 0)),
      ];
      const area = {};
      keys.forEach((k) => {
        area[k] = g.get(k).length;
      });
      return {
        cols: ["Area", "Cases", "Still open", "Closed", "Withdrawn", "Cited", "Referred"],
        rows: keys.map((k) => row(areaLabel(k, F), g.get(k))),
        total: row("All areas", base),
        area: area,
        points: base,
      };
    },
  },
  {
    id: "allViolations",
    n: 5,
    label: "All violations",
    date: "period",
    lede: "Violation items on cases opened in the period, by type and area.",
    run(M, F) {
      const vs = [];
      M.counted.forEach((c) => {
        if (!caseOk(c, F) || !inPeriod(c.opened, F)) return;
        c.violations.forEach((v) => {
          if (!v.withdrawn && violOk(v, F)) vs.push(v);
        });
      });
      const keys = uniq(vs.map((v) => areaKey(v.c, F))).sort(areaSort);
      const g = groupBy(vs, (v) => v.typeLabel),
        types = Array.from(g.keys()).sort((a, b) => g.get(b).length - g.get(a).length || (a < b ? -1 : 1));
      const across = (l) => keys.map((k) => count(l.filter((v) => areaKey(v.c, F) === k)));
      const area = {};
      keys.forEach((k) => {
        area[k] = vs.filter((v) => areaKey(v.c, F) === k).length;
      });
      return {
        cols: ["Violation type", "Total"].concat(keys.map((k) => areaLabel(k, F))),
        rows: types.map((t) => [t, count(g.get(t))].concat(across(g.get(t)))),
        total: ["All types", count(vs)].concat(across(vs)),
        area: area,
        points: uniq(vs.map((v) => v.c)),
        matrix: true,
      };
    },
  },
  {
    id: "daysToCompliance",
    n: 6,
    label: "Days to compliance",
    date: "period",
    lede: "From the initial inspection to the date each item was corrected, for cases opened in the period.",
    run(M, F) {
      const vs = [];
      M.counted
        .filter((c) => c.caseType !== "snow-10.28")
        .forEach((c) => {
          if (!caseOk(c, F) || !inPeriod(c.opened, F)) return;
          c.violations.forEach((v) => {
            if (!v.withdrawn && violOk(v, F)) vs.push(v);
          });
        });
      const d = (v) => daysBetween(v.c.opened, v.doneOn);
      const row = (label, l) => {
        const done = l.filter((v) => v.done && d(v) != null),
          open = l.filter((v) => !v.done),
          ds = done.map(d);
        return [
          label,
          count(l),
          count(done),
          cell(avg(ds), null, "days"),
          cell(median(ds), null, "days"),
          count(open),
          cell(avg(open.map((v) => daysBetween(v.c.opened, TODAY)).filter((x) => x != null)), null, "days"),
        ];
      };
      const g = groupBy(vs, (v) => v.typeLabel),
        types = Array.from(g.keys()).sort((a, b) => g.get(b).length - g.get(a).length || (a < b ? -1 : 1));
      return {
        cols: ["Violation type", "Violations", "Corrected", "Average days", "Median days", "Still open", "Average age of open (days)"],
        rows: types.map((t) => row(t, g.get(t))),
        total: row("All types", vs),
        area: null,
        points: uniq(vs.map((v) => v.c)),
      };
    },
  },
  {
    id: "repeatOwners",
    n: 7,
    label: "Repeat cases by owner",
    date: "period",
    lede: "Owners, recognized by mailing address, with two or more cases opened in the period.",
    run(M, F) {
      const base = M.counted.filter((c) => caseOk(c, F) && inPeriod(c.opened, F));
      const g = groupBy(
        base.filter((c) => c.ownerKey),
        (c) => c.ownerKey,
      );
      const keys = Array.from(g.keys())
        .filter((k) => g.get(k).length >= 2)
        .sort((a, b) => g.get(b).length - g.get(a).length || (a < b ? -1 : 1));
      const tail = (l) => [
        count(l),
        count(l.filter((c) => !["Closed", "Withdrawn"].includes(c.status))),
        cell(uniq(l.map((c) => c.parcelKey || c.address)).length, nos(l)),
      ];
      const rows = keys.map((k) => [{ owner: k, text: uniq(g.get(k).map((c) => c.owner)).join("; ") }, ownerKeyLabel(k)].concat(tail(g.get(k))));
      const none = base.filter((c) => !c.ownerKey);
      if (none.length) rows.push({ dim: true, cells: ["Unmatched — no usable mailing address", ""].concat(tail(none)) });
      return {
        cols: ["Owner names seen", "Mailing address", "Cases", "Still open", "Properties"],
        rows: rows,
        total: null,
        area: null,
        points: [].concat(...keys.map((k) => g.get(k))),
        note: keys.length
          ? plural(keys.length, "owner") +
            (" with more than one case. An address shared through a property manager g" +
              "roups every owner that manager represents; the names column shows who is" +
              " under each.")
          : "",
      };
    },
  },
  {
    id: "citations",
    n: 8,
    label: "Citations by ordinance",
    date: "period",
    lede: "Citations issued in the period, by the ordinance on the MC-2000 and the area. Voided citations are not counted.",
    run(M, F) {
      const cs = [];
      M.counted.forEach((c) => {
        if (!caseOk(c, F, { noViol: true, noInspector: true })) return;
        c.citations.forEach((x) => {
          if (!inPeriod(x.issued, F) || (F.inspector && x.by !== F.inspector)) return;
          if (F.ord && x.ordinance !== F.ord) return;
          if (F.vtype) {
            const v = c.violations.find((v) => v.no === x.no);
            if (!v || v.type !== F.vtype) return;
          }
          cs.push(x);
        });
      });
      const keys = uniq(cs.map((x) => areaKey(x.c, F))).sort(areaSort);
      const g = groupBy(cs, (x) => x.ordinance || "—"),
        ords = Array.from(g.keys()).sort(ordSort);
      const money = (l) =>
        cell(
          l.reduce((n, x) => n + (x.amount || 0), 0),
          null,
          "money",
        );
      const across = (l) => keys.map((k) => count(l.filter((y) => areaKey(y.c, F) === k)));
      const area = {};
      keys.forEach((k) => {
        area[k] = cs.filter((x) => areaKey(x.c, F) === k).length;
      });
      return {
        cols: ["Ordinance", "Citations"].concat(
          keys.map((k) => areaLabel(k, F)),
          ["Cash deposits"],
        ),
        rows: ords.map((o) => [o, count(g.get(o))].concat(across(g.get(o)), [money(g.get(o))])),
        total: ["All ordinances", count(cs)].concat(across(cs), [money(cs)]),
        area: area,
        points: uniq(cs.map((x) => x.c)),
        matrix: true,
      };
    },
  },
  {
    id: "overriddenDeposits",
    n: 11,
    label: "Overridden deposits",
    date: "period",
    lede: "Exceptional determined deposits with a named administrator, reason, source and helper authorization.",
    run(M, F) {
      const list = [];
      M.counted.forEach((c) => {
        if (!caseOk(c, F, { noViol: true, noInspector: true })) return;
        c.citations.forEach((x) => {
          if (x.overrideBasis && inPeriod(x.issued, F) && (!F.inspector || x.by === F.inspector) && (!F.ord || x.ordinance === F.ord)) list.push(x);
        });
      });
      return {
        cols: ["Case", "Citation", "Ordinance", "Cash deposit", "Administrator", "Reason", "Source reference", "Authorized"],
        rows: list.map((x) => [
          x.c.number,
          x.num,
          x.ordinance,
          cell(x.amount, null, "money"),
          x.overrideBasis.administrator,
          x.overrideBasis.reason,
          x.overrideBasis.sourceReference,
          fmtDate(recordDay(x.overrideBasis.approvedAt)),
        ]),
        total: ["Overridden deposits", count(list), "", "", "", "", "", ""],
        points: uniq(list.map((x) => x.c)),
        area: null,
      };
    },
  },
  {
    id: "referrals",
    n: 9,
    label: "Referrals for prosecution",
    date: "period",
    lede: "Cases referred to the City Attorney in the period, with the owner as the referral printed it.",
    run(M, F) {
      const rs = [];
      M.counted.forEach((c) => {
        if (!caseOk(c, F, { noInspector: true })) return;
        c.referrals.forEach((r) => {
          if (inPeriod(r.issued, F) && (!F.inspector || r.by === F.inspector)) rs.push(r);
        });
      });
      rs.sort((a, b) => (a.issued < b.issued ? 1 : -1));
      const byOwner = groupBy(
        M.counted.filter((c) => c.ownerKey),
        (c) => c.ownerKey,
      );
      const rows = rs.map((r) => {
        const all = r.ownerKey && byOwner.get(r.ownerKey);
        return [
          fmtDate(r.issued),
          { kase: r.c.number },
          r.c.address,
          areaLabel(areaKey(r.c, F), F),
          { owner: r.ownerKey, text: r.owner },
          ownerKeyLabel(r.ownerKey),
          all ? count(all) : cell(0, null),
        ];
      });
      const area = {};
      groupBy(rs, (r) => areaKey(r.c, F)).forEach((l, k) => {
        area[k] = l.length;
      });
      return {
        cols: ["Referred", "Case", "Address", "Area", "Owner", "Mailing address", "Owner’s cases, all time"],
        rows: rows,
        total: ["All referrals", count(rs), "", "", "", "", ""],
        area: area,
        points: uniq(rs.map((r) => r.c)),
        list: true,
      };
    },
  },
  {
    id: "documentActions",
    n: 10,
    label: "Document actions",
    date: "period",
    lede: "Issued actions by document family. Includes scoped orders before an Offi" + "cial Notice; one inspection may support several actions.",
    run(M, F) {
      const docs = [];
      M.cases.forEach((c) => {
        if (!caseOk(c, F, { noInspector: true, noNotice: true })) return;
        c.documents
          .filter((d) => !d.void && !d.superseded && inPeriod(d.issued, F) && (!F.inspector || d.by === F.inspector))
          .forEach((d) => docs.push({ c, d }));
      });
      const g = groupBy(docs, (x) => (x.d.type === "referralUpdate" ? "Referral for Prosecution" : x.d.label)),
        labels = Array.from(g.keys()).sort();
      const area = {};
      groupBy(docs, (x) => areaKey(x.c, F)).forEach((l, k) => (area[k] = l.length));
      return {
        cols: ["Document family", "Actions", "Cases"],
        rows: labels.map((l) => [
          l,
          cell(
            g.get(l).length,
            g.get(l).map((x) => x.c.number),
          ),
          cell(
            uniq(g.get(l).map((x) => x.c.number)).length,
            g.get(l).map((x) => x.c.number),
          ),
        ]),
        total: [
          "All actions",
          cell(
            docs.length,
            docs.map((x) => x.c.number),
          ),
          cell(
            uniq(docs.map((x) => x.c.number)).length,
            docs.map((x) => x.c.number),
          ),
        ],
        area,
        points: uniq(docs.map((x) => x.c)),
      };
    },
  },
];
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
      "date, except citations and referrals, which filter by the date they were" +
      " issued.",
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
/* The flat tables follow the current filters. Cases, violations and visits
   use the period on the case opening date; citations and referrals use the
   date they were issued. */

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

if (!window.__NO_AUTOLOAD__)
  loadAll(false).then(() => {
    if (new URLSearchParams(location.search).has("return")) {
      try {
        const x = JSON.parse(localStorage.getItem("madison-report-return-v1") || "null");
        if (x && reportById(x.report)) {
          ReportsState.S.screen = x.report;
          ReportsState.S.F = { ...ReportsState.S.F, ...x.filters };
          ReportsState.S.view = x.view === "map" ? "map" : "table";
          ReportsState.S.tableSort = reportSort(x.sort, x.report);
          ReportsState.S.dateMode = x.dateMode || "fixed";
          if (relativeDates(ReportsState.S.dateMode)) Object.assign(ReportsState.S.F, relativeDates(ReportsState.S.dateMode));
          ReportsState.S.reportNotice = "Returned to the saved report context.";
          render();
        }
      } catch (e) {
        /* A missing optional return preference does not affect report records or filters. */
      }
    }
  });
