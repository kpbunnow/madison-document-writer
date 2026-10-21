import { SUMMARY_VERSION, csvText, downloadText, normParcel } from "../assets/shared.js";
import { drawMap, shell } from "./reports_screens.js";
import {
  A11Y,
  REPORT_CHANNEL,
  REPORT_VIEWS_KEY,
  STREET_WORDS,
  TODAY,
  areaIdOf,
  esc,
  iso,
  plural,
  reportById,
  uniq,
  validISO,
  violOk,
} from "./reports_core.js";
import { ReportsState } from "./state.js";
import { authFetch } from "./helper_transport.js";
/* reports functions; direct dependencies use explicit shared state. */
import { orderedRows, validSort, rememberUI, restoreUI } from "./report_presentation.js";

function reportCellValue(cell) {
  if (cell == null) return "";
  if (typeof cell !== "object") return cell;
  return cell.n ?? cell.text ?? cell.kase ?? "";
}

function currentReportRows() {
  const res = ReportsState.S.rep?.res;
  if (!res) return [];
  const rows = orderedRows(res, validSort(ReportsState.S.tableSort, ReportsState.S.screen), (message) => {
    ReportsState.S.reportNotice = message;
    A11Y.notify(message);
  });
  return [res.cols, ...rows.map(({ row }) => (row.cells || row).map(reportCellValue)), ...(res.total ? [res.total.map(reportCellValue)] : [])];
}

function exportReportCSV() {
  if (!ReportsState.S.rep) return;
  downloadText("Madison-" + ReportsState.S.screen + ".csv", csvText(currentReportRows()), "text/csv");
}

function humanCorrectionValue(value) {
  if (value === undefined || value === null) return "Not recorded";
  if (Array.isArray(value)) return value.map(humanCorrectionValue).join("; ");
  if (typeof value === "object")
    return Object.entries(value)
      .map(([key, v]) => key.replace(/([a-z])([A-Z])/g, "$1 $2") + ": " + humanCorrectionValue(v))
      .join("; ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

async function reportHelper(url, body) {
  const response = await authFetch(
      url,
      body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    ),
    data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || "Shared report preferences unavailable");
  return data;
}

async function shareReportView() {
  if (!reportById(ReportsState.S.screen)) throw new Error("Open a report before sharing a view");
  const name = prompt("Name this shared report view:");
  if (!name?.trim()) return;
  const view = {
    format: "madison-report-view",
    version: 1,
    id: String(Date.now()) + "-" + Math.random().toString(36).slice(2),
    name: name.trim().slice(0, 80),
    report: ReportsState.S.screen,
    filters: JSON.parse(JSON.stringify(ReportsState.S.F)),
    view: ReportsState.S.view,
    dateMode: ReportsState.S.dateMode,
  };
  await reportHelper("/reporting/views", view);
  A11Y.notify("Saved shared report view " + view.name, { severity: "success" });
}

async function showSharedViews() {
  const views = (await reportHelper("/reporting/views")).views;
  A11Y.utility(
    "Shared report views",
    "<p>These preferences are stored in Reporting Index/Views. Relative dates" +
      " are evaluated when loaded.</p><ul>" +
      "".concat(
        views
          .map(
            (view) =>
              "<li>" +
              `${esc(view.name)}` +
              " · " +
              `${esc(reportById(view.report)?.label || view.report)}` +
              " · " +
              `${esc(view.dateMode)}` +
              ' <button class="btn" data-load-shared-view="' +
              `${esc(view.id)}` +
              '">Load view</button></li>',
          )
          .join("") || "<li>No shared views saved.</li>",
      ) +
      "</ul>",
  );
  document.querySelectorAll("[data-load-shared-view]").forEach((button) =>
    button.addEventListener("click", () => {
      const view = views.find((x) => x.id === button.dataset.loadSharedView);
      if (!view || !reportById(view.report)) return;
      const previous = ReportsState.SAVED_VIEWS;
      try {
        const next = previous
          .filter((v) => v.id !== view.id)
          .concat([view])
          .slice(-40);
        localStorage.setItem(REPORT_VIEWS_KEY, JSON.stringify(next));
        ReportsState.SAVED_VIEWS = next;
        applyReportView(view.id);
        document.getElementById("utility-dialog")?.close();
      } catch (error) {
        ReportsState.SAVED_VIEWS = previous;
        A11Y.notify("Could not store the shared view on this device", { severity: "error" });
      }
    }),
  );
}

function printReport() {
  if (!ReportsState.S.rep) {
    A11Y.notify("Open a valid report before printing", { severity: "error" });
    return;
  }
  const details = [...document.querySelectorAll(".map-table-alternative")];
  details.forEach((el) => (el.open = true));
  window.print();
}

function daysBetween(a, b) {
  if (!validISO(a) || !validISO(b)) return null;
  const p = a.split("-").map(Number),
    q = b.split("-").map(Number);
  return Math.round((Date.UTC(q[0], q[1] - 1, q[2]) - Date.UTC(p[0], p[1] - 1, p[2])) / 86400000);
}

function median(a) {
  if (!a.length) return null;
  const s = a.slice().sort((x, y) => x - y),
    m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function normStreet(s) {
  const t = String(s || "")
    .toUpperCase()
    .replace(/\bP\.?\s*O\.?\s*BOX\b/g, "PO BOX")
    .replace(/\bPOBOX\b/g, "PO BOX")
    .replace(/#\s*/g, " UNIT ")
    .replace(/[^A-Z0-9 \/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t
    .split(" ")
    .map((w) => STREET_WORDS[w] || w)
    .join(" ")
    .replace(/\bUNIT UNIT\b/g, "UNIT");
}

function ownerKey(addr) {
  const lines = (addr || []).map((x) => String(x || "").trim()).filter(Boolean);
  if (lines.length < 2) return "";
  const zm = /(\d{5})(?:-\d{4})?\s*$/.exec(lines[lines.length - 1]);
  if (!zm) return "";
  for (let i = lines.length - 2; i >= 0; i--) {
    if (/^(\d|P\.?\s*O\.?\s*BOX\b|POBOX\b)/i.test(lines[i])) return normStreet(lines[i]) + "|" + zm[1];
  }
  return "";
}

function ringHas(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0],
      yi = ring[i][1],
      xj = ring[j][0],
      yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-30) + xi) inside = !inside;
  }
  return inside;
}

function polyHas(geom, x, y) {
  if (!geom) return false;
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
  return polys.some((p) => p && p.length && ringHas(p[0], x, y) && !p.slice(1).some((h) => ringHas(h, x, y)));
}

function detectField(fc, kind) {
  const feats = (fc && fc.features) || [];
  if (!feats.length) return "";
  const names = Object.keys(feats[0].properties || {});
  const want = kind === "zip" ? /zip|postal/i : /ald|dist/i;
  const fits = kind === "zip" ? (v) => /^\d{5}$/.test(String(v).trim()) : (v) => /^\d{1,2}$/.test(String(v).trim()) && +v >= 1 && +v <= 40;
  return names.filter((n) => want.test(n)).find((n) => feats.every((f) => fits((f.properties || {})[n]))) || "";
}

function relativeDates(mode) {
  const day = iso(new Date());
  if (mode === "month") return { from: day.slice(0, 7) + "-01", to: day, asOf: day };
  if (mode === "year") return { from: day.slice(0, 4) + "-01-01", to: day, asOf: day };
  if (mode === "today") return { from: day, to: day, asOf: day };
  if (mode === "all")
    return {
      from:
        ReportsState.S.M?.counted
          ?.map((c) => c.opened)
          .filter(validISO)
          .sort()[0] || day,
      to: day,
      asOf: day,
    };
  return null;
}

function saveReportView() {
  const name = prompt("Name this report view:");
  if (!name?.trim()) return;
  const view = {
    version: 1,
    id: String(Date.now()) + "-" + Math.random().toString(36).slice(2),
    name: name.trim().slice(0, 80),
    report: ReportsState.S.screen,
    filters: JSON.parse(JSON.stringify(ReportsState.S.F)),
    view: ReportsState.S.view,
    dateMode: ReportsState.S.dateMode,
    sort: validSort(ReportsState.S.tableSort, ReportsState.S.screen),
  };
  const next = ReportsState.SAVED_VIEWS.concat([view]).slice(-40);
  try {
    localStorage.setItem(REPORT_VIEWS_KEY, JSON.stringify(next));
    ReportsState.SAVED_VIEWS = next;
    ReportsState.S.savedId = view.id;
    ReportsState.S.reportNotice = "Saved view " + view.name + ".";
    render();
  } catch (e) {
    ReportsState.S.reportNotice = "Could not store a saved view in this browser.";
    render();
  }
}

function applyReportView(id) {
  const x = ReportsState.SAVED_VIEWS.find((v) => v.id === id);
  if (!x) return;
  if (!reportById(x.report)) {
    ReportsState.S.reportNotice = "This saved report is no longer available.";
    render();
    return;
  }
  ReportsState.S.screen = x.report;
  ReportsState.S.F = { ...ReportsState.S.F, ...JSON.parse(JSON.stringify(x.filters)), areas: Array.isArray(x.filters.areas) ? x.filters.areas : [] };
  const dates = relativeDates(x.dateMode);
  if (dates) Object.assign(ReportsState.S.F, dates);
  ReportsState.S.tableSort = validSort(x.sort, x.report);
  ReportsState.S.dateMode = x.dateMode;
  ReportsState.S.view = x.view === "map" ? "map" : "table";
  ReportsState.S.savedId = x.id;
  ReportsState.S.drill = null;
  ReportsState.S.reportNotice = "Loaded " + x.name + " (" + (dates ? "relative " + x.dateMode : "fixed dates") + ").";
  render();
}

function deleteReportView() {
  if (!ReportsState.S.savedId) return;
  const x = ReportsState.SAVED_VIEWS.find((v) => v.id === ReportsState.S.savedId);
  if (!x || !confirm("Delete saved view " + x.name + "?")) return;
  const next = ReportsState.SAVED_VIEWS.filter((v) => v.id !== x.id);
  try {
    localStorage.setItem(REPORT_VIEWS_KEY, JSON.stringify(next));
  } catch (e) {
    ReportsState.S.reportNotice = "Could not remove this saved view from this browser.";
    render();
    return;
  }
  ReportsState.SAVED_VIEWS = next;
  ReportsState.S.savedId = "";
  ReportsState.S.reportNotice = "Saved view removed.";
  render();
}

function reportsChannel() {
  if (!("BroadcastChannel" in window)) return null;
  if (!ReportsState.REPORT_LINK) {
    ReportsState.REPORT_LINK = new BroadcastChannel(REPORT_CHANNEL);
    ReportsState.REPORT_LINK.onmessage = (e) => {
      if (e.data?.kind === "accepted" && e.data.request === ReportsState.S.handoff?.request) {
        ReportsState.S.handoff.accepted = true;
        ReportsState.S.reportNotice = "Existing Writer tab received the case request…";
        render();
      }
      if (e.data?.kind === "result" && e.data.request === ReportsState.S.handoff?.request) {
        ReportsState.S.reportNotice = e.data.ok
          ? "Case " + ReportsState.S.handoff.number + " opened in the existing Writer tab. Switch to that tab."
          : "Writer could not open the case: " + e.data.error;
        ReportsState.S.handoff = null;
        render();
      }
      if (e.data?.kind === "return") {
        ReportsState.REPORT_LINK.postMessage({ kind: "return-ack", request: e.data.request });
        window.focus();
        ReportsState.S.reportNotice = "Returned from Writer.";
        render();
      }
    };
  }
  return ReportsState.REPORT_LINK;
}

function openInWriter(number) {
  if (!ReportsState.S.M?.byNo[number]) return;
  const request = String(Date.now()) + "-" + Math.random().toString(36).slice(2);
  ReportsState.S.handoff = { request, number };
  try {
    localStorage.setItem(
      "madison-report-return-v1",
      JSON.stringify({
        report: ReportsState.S.screen,
        filters: ReportsState.S.F,
        view: ReportsState.S.view,
        dateMode: ReportsState.S.dateMode,
        sort: validSort(ReportsState.S.tableSort, ReportsState.S.screen),
      }),
    );
  } catch (e) {
    /* Return preferences are optional; the explicit handoff still opens and verifies the shared case. */
  }
  ReportsState.S.reportNotice = "Contacting the Writer for " + number + "…";
  render();
  const summary = ReportsState.S.raw?.summaries?.find((x) => x.case?.number === number);
  reportsChannel()?.postMessage({ kind: "open", request, number, eventCount: summary?.eventCount });
  setTimeout(() => {
    if (ReportsState.S.handoff?.request !== request || ReportsState.S.handoff.accepted) return;
    const tab = window.open("madison-document-writer.html?case=" + encodeURIComponent(number), "_blank");
    ReportsState.S.reportNotice = tab
      ? "Writer opened in a new tab. It will resolve the shared case."
      : "Writer was blocked. Open Document Writer, then choose this case from the shared record.";
    ReportsState.S.handoff = null;
    render();
  }, 1100);
  setTimeout(() => {
    if (ReportsState.S.handoff?.request !== request) return;
    ReportsState.S.reportNotice = "Writer did not finish opening this case. Switch to the Writer tab and check its message, or retry the handoff.";
    ReportsState.S.handoff = null;
    render();
  }, 15000);
}

async function getJSON(url, opts) {
  const r = await authFetch(url, opts);
  let j = null;
  try {
    j = await r.json();
  } catch (e) {
    throw new Error("The helper answered " + r.status + " without readable report data. Refresh or contact IT.");
  }
  if (!j || !r.ok) throw new Error((j && j.error) || url + " answered " + r.status + " with nothing readable");
  return j;
}

let loadSequence = 0,
  loadController = null;
async function loadAll(refreshParcels) {
  const sequence = ++loadSequence;
  loadController?.abort();
  const controller = new AbortController();
  loadController = controller;
  const get = async (url, opts = {}) => {
    const result = await getJSON(url, { ...opts, signal: controller.signal });
    if (sequence !== loadSequence) throw new Error("Superseded report read");
    return result;
  };
  ReportsState.S.phase = "loading";
  ReportsState.S.error = "";
  ReportsState.S.msg = "Reading the reporting index…";
  render();
  try {
    const idx = await get("/reporting/index");
    if (!idx.ok) throw new Error(idx.error || "the index could not be read");
    ReportsState.S.raw = idx;
    ReportsState.S.msg = "Reading the parcel cache…";
    render();
    const pc = await get("/reporting/parcels");
    ReportsState.S.parcels = (pc && pc.parcels) || {};
    ReportsState.S.parcelMissing = (pc && pc.missing) || [];
    ReportsState.S.parcelNote = "";
    const keys = uniq(idx.summaries.map((s) => normParcel((s["case"] || {}).parcel)).filter(Boolean));
    const need = refreshParcels ? keys : keys.filter((k) => !ReportsState.S.parcels[k]);
    if (need.length) {
      ReportsState.S.msg = "Looking up " + plural(need.length, "parcel") + " on the city parcel layer…";
      render();
      try {
        for (let offset = 0; offset < need.length; offset += 500) {
          ReportsState.S.msg = "Looking up parcels " + (offset + 1) + "–" + Math.min(offset + 500, need.length) + " of " + need.length + "…";
          render();
          const lk = await get("/reporting/parcels", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: need.slice(offset, offset + 500), refresh: !!refreshParcels }),
          });
          Object.assign(ReportsState.S.parcels, lk.parcels || {});
          ReportsState.S.parcelMissing = uniq(ReportsState.S.parcelMissing.filter((k) => !(lk.parcels || {})[k]).concat(lk.missing || []));
          if (!lk.ok) ReportsState.S.parcelNote = lk.error || "the parcel lookup did not complete";
        }
      } catch (e) {
        if (sequence !== loadSequence) return;
        ReportsState.S.parcelNote = "The parcel lookup failed (" + (e.message || e) + "). Cases not yet looked up are shown as unlocated.";
      }
    }
    ReportsState.S.msg = "Loading area outlines…";
    render();
    try {
      ReportsState.S.areas = await get("/reporting/areas");
    } catch (e) {
      if (sequence !== loadSequence) return;
      ReportsState.S.areas = { ok: false, notes: ["Area outlines could not be loaded (" + (e.message || e) + ")."] };
    }
    ReportsState.S.M = buildModel(idx.summaries, ReportsState.S.parcels, ReportsState.S.areas);
    ReportsState.S.phase = "ready";
  } catch (e) {
    if (sequence !== loadSequence) return;
    ReportsState.S.phase = "error";
    ReportsState.S.error =
      location.protocol === "file:"
        ? "This page was opened as a file. Open it from the Document Writer (Report" + "s, in the left rail) so it can read the case folder."
        : "The reporting data could not be read: " +
          (e.message || e) +
          ". Check that the Document Writer window is open and the share is reachable, then try again.";
  }
  render();
}

function buildModel(summaries, parcels, areas) {
  const zipFC = areas && areas.zips,
    zipField = zipFC ? detectField(zipFC, "zip") : "";
  const distFC = areas && areas.districts,
    distField = distFC ? detectField(distFC, "district") : "";
  const cases = [],
    versionStale = [];
  summaries.forEach((s) => {
    const k = s["case"] || {};
    if ((s.summaryVersion ?? s.version ?? 0) < SUMMARY_VERSION) {
      versionStale.push(k.number || "?");
      return;
    }
    const pk = normParcel(k.parcel),
      hist = (parcels[pk] && parcels[pk].history) || [];
    const now = hist[hist.length - 1] || null;
    // the district when the case opened: the parcel as last seen on or
    // before that date; later observations cannot establish earlier boundaries
    let at = null;
    hist.forEach((h) => {
      if (validISO(h.fetched) && h.fetched <= String(k.opened || "")) at = h;
    });
    const c = {
      caseType: k.caseType || "",
      number: String(k.number || ""),
      address: k.address || "",
      parcel: k.parcel || "",
      parcelKey: pk,
      zip: k.zip || "",
      description: k.description || "",
      inspector: k.inspector || k.inspectorId || "",
      opened: k.opened || "",
      noticeIssued: k.noticeIssued || "",
      status: k.status || "",
      noticeActive: k.noticeActive !== false,
      closedOn: k.closedOn || "",
      owner: k.owner || "",
      ownerAddr: k.ownerAddr || [],
      integrity: s.integrity || { label: "Shared integrity not checked" },
      ownerKey: k.ownerAddressKey || ownerKey(k.ownerAddr),
      alderNow: now && now.alder != null ? String(now.alder) : "",
      alderAtOpen: at && at.alder != null ? String(at.alder) : "",
      building: now && now.building != null ? String(now.building) : "",
      lat: now && now.lat != null ? now.lat : null,
      lon: now && now.lon != null ? now.lon : null,
      located: !!(now && Number.isFinite(now.lat) && Number.isFinite(now.lon) && Math.abs(now.lat) <= 90 && Math.abs(now.lon) <= 180),
      looked: !!now || (!!pk && ReportsState.S.parcelMissing.indexOf(pk) >= 0),
      summary: s,
    };
    if (!c.zip && zipField && c.located) {
      const f = (zipFC.features || []).find((ft) => polyHas(ft.geometry, c.lon, c.lat));
      if (f) c.zip = areaIdOf(f, zipField);
    }
    c.violations = (s.violations || []).map((v) => Object.assign({}, v, { c: c, sections: v.sections || [] }));
    c.citations = (s.citations || []).map((x) => Object.assign({}, x, { c: c }));
    c.referrals = (s.referrals || []).map((x) => Object.assign({}, x, { c: c, ownerKey: ownerKey(x.ownerAddr) }));
    c.visits = s.visits || [];
    c.documents = s.documents || [];
    cases.push(c);
  });
  cases.sort((a, b) => (a.opened === b.opened ? (a.number < b.number ? -1 : 1) : a.opened < b.opened ? 1 : -1));
  const byNo = {};
  cases.forEach((c) => {
    byNo[c.number] = c;
  });
  const counted = cases.filter((c) => c.noticeIssued || (c.caseType === "snow-10.28" && c.citations.length));
  const types = {};
  counted.forEach((c) =>
    c.violations.forEach((v) => {
      types[v.type] = v.typeLabel;
    }),
  );
  const ords = uniq(counted.flatMap((c) => c.violations.flatMap((v) => v.sections).concat(c.citations.map((x) => x.ordinance))).filter(Boolean)).sort(
    ordSort,
  );
  return {
    cases: cases,
    byNo: byNo,
    counted: counted,
    versionStale: versionStale,
    inspectors: uniq(
      counted
        .flatMap((c) =>
          [c.inspector].concat(
            c.citations.map((x) => x.by),
            c.referrals.map((x) => x.by),
          ),
        )
        .filter(Boolean),
    ).sort(),
    types: Object.keys(types)
      .map((k) => ({ key: k, label: types[k] }))
      .sort((a, b) => (a.label < b.label ? -1 : 1)),
    ords: ords,
    distField: distField,
    zipField: zipField,
  };
}

function ordSort(a, b) {
  const pa = String(a).match(/\d+|\D+/g) || [],
    pb = String(b).match(/\d+|\D+/g) || [];
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || "",
      y = pb[i] || "";
    if (x === y) continue;
    if (/^\d/.test(x) && /^\d/.test(y)) return +x - +y;
    return x < y ? -1 : 1;
  }
  return 0;
}

function areaKey(c, F) {
  F = F || ReportsState.S.F;
  if (F.areaType === "zip") return c.zip || "";
  return F.boundary === "atOpen" ? c.alderAtOpen : c.alderNow;
}

function areaSort(a, b) {
  if (!a) return 1;
  if (!b) return -1;
  return /^\d+$/.test(a) && /^\d+$/.test(b) ? +a - +b : a < b ? -1 : 1;
}

function caseOk(c, F, opt) {
  if (!(opt && opt.noNotice)) {
    if (c.caseType === "snow-10.28") {
      if (!c.citations.length) return false;
      if (opt && opt.asOf && !c.documents.some((d) => d.type === "citation" && versionAt(d, opt.asOf))) return false;
    } else {
      if (!c.noticeIssued) return false;
      if (opt && opt.asOf) {
        if (!noticeAt(c, opt.asOf)) return false;
      } else if (c.noticeActive === false) return false;
    }
  }
  if (F.areas.length && F.areas.indexOf(areaKey(c, F)) < 0) return false;
  if (F.inspector && !(opt && opt.noInspector) && c.inspector !== F.inspector) return false;
  if (F.owner && c.ownerKey !== F.owner) return false;
  const status = opt && opt.asOf ? statusAt(c, opt.asOf) : c.status;
  if (
    F.status &&
    (F.status === "open"
      ? ["Closed", "Withdrawn"].includes(status) || (c.caseType === "snow-10.28" && c.closedOn && c.closedOn <= (opt?.asOf || TODAY))
      : status !== F.status)
  )
    return false;
  if (
    (F.vtype || F.ord) &&
    !(opt && opt.noViol) &&
    !c.violations.some((v) => {
      const at = opt && opt.asOf ? violationAt(v, opt.asOf) : v;
      return at && !at.withdrawn && violOk(at, F);
    })
  )
    return false;
  return true;
}

function versionAt(v, date) {
  const from = v.effectiveFrom || v.issued || "",
    to = v.effectiveTo || v.voidAt || "";
  return !!from && from <= date && (!to || date < to) && (!v.void || !!v.voidAt);
}

function noticeAt(c, date) {
  return c.documents.length ? c.documents.some((d) => d.type === "notice" && versionAt(d, date)) : !!c.noticeIssued && c.noticeIssued <= date;
}

function statusAt(c, date) {
  if (!c.documents.length) return c.closedOn && c.closedOn <= date ? "Closed" : c.status === "Closed" ? "Notice" : c.status;
  const docs = c.documents.filter((d) => versionAt(d, date)),
    last = docs[docs.length - 1];
  if (!last) return "Not issued";
  if (c.caseType === "snow-10.28") return "Cited – snow";
  const restrictions = docs.filter((d) => d.type === "noOccupancy" && d.special?.mode !== "release"),
    releases = new Set(docs.filter((d) => d.type === "noOccupancy" && d.special?.mode === "release").map((d) => d.special.releases));
  if (restrictions.some((d) => !releases.has(d.id))) return "Occupancy restricted";
  if (last.allWithdrawn) return "Withdrawn";
  if (docs.some((d) => d.type === "compliance")) return "Closed";
  if (docs.some((d) => d.type === "referral")) return "Referred";
  return (
    {
      notice: "Notice",
      extension: "Extension",
      citation: "Cited",
      referral: "Referred",
      referralUpdate: "Referred",
      compliance: "Closed",
      bestInterestExtension: "Best Interest Extension",
      vacancyExtension: "Vacancy Extension",
      summaryAbatement: "Summary Abatement",
      nonSummaryAbatement: "Non-Summary Abatement",
      noOccupancy: c.status,
    }[last.type] || last.type
  );
}

function violationAt(v, date) {
  if (!Array.isArray(v.history) || !v.history.length) return v;
  const history = v.history.filter((h) => versionAt(h, date)),
    latest = history[history.length - 1];
  return latest ? Object.assign({}, v, latest, { type: latest.key || v.type, typeLabel: latest.label || v.typeLabel }) : null;
}

function violOpenAt(v, date) {
  const latest = violationAt(v, date);
  return !!latest && !latest.withdrawn && (!latest.done || (validISO(latest.doneOn) && latest.doneOn > date));
}

function groupBy(list, fn) {
  const m = new Map();
  list.forEach((x) => {
    const k = fn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  });
  return m;
}

function render() {
  const app = document.getElementById("app");
  if (!app) return;
  const ui = rememberUI(ReportsState.S);
  ReportsState.S.rep = null;
  app.innerHTML = shell();
  A11Y.enhance();
  restoreUI(ReportsState.S, ui);
  if (ReportsState.S.phase === "ready" && ReportsState.S.view === "map" && reportById(ReportsState.S.screen)) drawMap();
}

export {
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
};
