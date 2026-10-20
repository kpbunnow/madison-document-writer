import { SUMMARY_DIR as dep_SUMMARY_DIR, normParcel as dep_normParcel, recordDay as dep_recordDay } from "../assets/shared.js";
import { BUILD as dep_BUILD, LOGO as dep_LOGO } from "./data/build_identity.js";
import {
  areaKey as dep_areaKey,
  areaSort as dep_areaSort,
  caseOk as dep_caseOk,
  daysBetween as dep_daysBetween,
  groupBy as dep_groupBy,
  humanCorrectionValue as dep_humanCorrectionValue,
  normStreet as dep_normStreet,
  render as dep_render,
} from "./reports_services.js";
import {
  A11Y as dep_A11Y,
  CRC_T as dep_CRC_T,
  D as dep_D,
  DEFINITIONS as dep_DEFINITIONS,
  REPORTS as dep_REPORTS,
  STATUSES as dep_STATUSES,
  STATUS_COL as dep_STATUS_COL,
  STYLES as dep_STYLES,
  TILE as dep_TILE,
  actions as dep_actions,
  activeFilters as dep_activeFilters,
  areaIdOf as dep_areaIdOf,
  areaLabel as dep_areaLabel,
  depositSchedule as dep_depositSchedule,
  esc as dep_esc,
  excelDate as dep_excelDate,
  fmtDate as dep_fmtDate,
  fmtDays as dep_fmtDays,
  fmtMoney as dep_fmtMoney,
  fmtNum as dep_fmtNum,
  inPeriod as dep_inPeriod,
  iso as dep_iso,
  numOr as dep_numOr,
  ownerKeyLabel as dep_ownerKeyLabel,
  plural as dep_plural,
  reportById as dep_reportById,
  uniq as dep_uniq,
  validISO as dep_validISO,
  violOk as dep_violOk,
  xesc as dep_xesc,
} from "./reports_core.js";
import { reports_reportpresentationContext } from "./reports_view_contexts.js";
import { ReportsState } from "./state.js";
/* reports functions; direct dependencies use explicit shared state. */
import { orderedRows, validSort, reportNavigation, reportActions as compactActions, appliedFilters, coverage } from "./report_presentation.js";

function shell() {
  const nav = reportNavigation(reports_reportpresentationContext());
  const more = [
    ["property", "Property"],
    ["owner", "Owner"],
    ["data", "Data and definitions"],
    ["deposit", "Deposit schedule"],
  ]
    .map(
      ([k, l]) =>
        '<button class="rail-item" data-screen="' +
        `${k}` +
        '" ' +
        `${ReportsState.S.screen === k ? 'aria-current="page"' : ""}` +
        "><span>" +
        `${dep_esc(l)}` +
        "</span></button>",
    )
    .join("");
  return (
    '<div class="app">\n    <aside class="rail">\n      <div class="rail-brand"' +
    '><img class="rail-logo" src="' +
    `${dep_LOGO}` +
    '" alt="City of Madison Building Inspection"><div class="rail-sub">Report' +
    's</div></div>\n      <nav><a class="rail-item" href="madison-document-wri' +
    'ter.html">← Document Writer</a>' +
    `${nav}` +
    '<div class="rail-group">Look up</div>' +
    `${more}` +
    '</nav>\n      <div class="rail-foot">Read-only. Nothing here changes a ca' +
    'se.<span class="build">Build ' +
    `${dep_esc(dep_BUILD)}` +
    '</span></div>\n    </aside>\n    <div class="main">' +
    "".concat(
      ReportsState.S.phase === "loading"
        ? `<div class="loading">${dep_esc(ReportsState.S.msg)}</div>`
        : ReportsState.S.phase === "error"
          ? '<div class="content"><div class="banner alert">' +
            `${dep_esc(ReportsState.S.error)}` +
            '</div><div><button class="btn btn-primary" data-act="reload">Try again</' +
            "button></div></div>"
          : screenFrame(),
    ) +
    "</div></div>"
  );
}

function screenFrame() {
  if (ReportsState.S.screen === "deposit")
    return (
      topbar("Deposit schedule", "Read the reviewed law in force on a selected date.") +
      '<div class="content">' +
      dep_depositSchedule.html() +
      "</div>"
    );
  const r = dep_reportById(ReportsState.S.screen);
  if (r) return reportScreen(r);
  if (ReportsState.S.screen === "property")
    return (
      topbar(
        "Property",
        "Every case at a parcel or address, with its documents, visits and items.",
        '<button class="btn" data-act="reload">Refresh data</button>',
      ) + `<div class="content">${freshness()}${propertyView()}</div>`
    );
  if (ReportsState.S.screen === "owner")
    return (
      topbar(
        "Owner",
        "Every case under one mailing address, and every owner name seen there.",
        '<button class="btn" data-act="reload">Refresh data</button>',
      ) + `<div class="content">${freshness()}${ownerView()}</div>`
    );
  return (
    topbar(
      "Data and definitions",
      "What the reports are built from, and how each term is counted.",
      '<button class="btn" data-act="reload">Refresh data</button><button class' + '="btn" data-act="refreshParcels">Check parcels again</button>',
    ) + `<div class="content">${dataView()}</div>`
  );
}

function reportActions() {
  return compactActions(reports_reportpresentationContext());
}

function topbar(title, lede, acts) {
  return (
    '<header class="topbar"><div><h1>' +
    `${dep_esc(title)}` +
    '</h1><div class="lede">' +
    `${dep_esc(lede)}` +
    '</div></div><div class="topbar-actions">' +
    `${acts || ""}` +
    "</div></header>"
  );
}

function filtersBar(dateMode) {
  const F = ReportsState.S.F,
    M = ReportsState.S.M;
  const allAreas = dep_uniq(M.counted.map((c) => dep_areaKey(c, F))).sort(dep_areaSort);
  const dates =
    dateMode === "asOf"
      ? `<label class="f"><span>As of</span><input type="date" id="f-asOf" value="${dep_esc(F.asOf)}"></label>`
      : `<label class="f"><span>From</span><input type="date" id="f-from" value="${dep_esc(F.from)}"></label>
      <label class="f"><span>To</span><input type="date" id="f-to" value="${dep_esc(F.to)}"></label>`;
  const sel = (id, label, val, opts) =>
    '<label class="f"><span>' +
    `${dep_esc(label)}` +
    '</span><select id="' +
    `${id}` +
    '">' +
    "".concat(opts.map((o) => `<option value="${dep_esc(o[0])}" ${o[0] === val ? "selected" : ""}>${dep_esc(o[1])}</option>`).join("")) +
    "</select></label>";
  return (
    '<div class="filters">\n    ' +
    `${dates}` +
    '<div class="quickdates"><span>Quick range</span><button data-period="mon' +
    'th">This month</button><button data-period="year">This year</button><but' +
    'ton data-period="all">All dates</button></div>\n    <div class="f"><span>' +
    'Area</span><div class="seg" role="group" aria-label="Area type">\n      <' +
    'button data-areatype="district" aria-pressed="' +
    `${F.areaType === "district"}` +
    '">Alder district</button>\n      <button data-areatype="zip" aria-pressed' +
    '="' +
    `${F.areaType === "zip"}` +
    '">ZIP code</button></div></div>\n    ' +
    "".concat(sel("f-inspector", "Inspector", F.inspector, [["", "All inspectors"]].concat(M.inspectors.map((n) => [n, n])))) +
    '\n    <div class="f"><span>Areas</span><details class="areas" ' +
    `${ReportsState.S.areasOpen ? "open" : ""}` +
    ' id="f-areas"><summary>' +
    `${F.areas.length ? dep_esc(F.areas.map((a) => dep_areaLabel(a)).join(", ")) : "All areas"}` +
    '</summary>\n      <div class="pop">' +
    "".concat(
      allAreas
        .map(
          (a) =>
            '<label><input type="checkbox" data-area="' +
            `${dep_esc(a)}` +
            '" ' +
            `${F.areas.indexOf(a) >= 0 ? "checked" : ""}` +
            ">" +
            `${dep_esc(dep_areaLabel(a))}` +
            "</label>",
        )
        .join("") || '<div class="small">No areas yet</div>',
    ) +
    '</div></details></div>\n    <details id="report-more-filters" class="more' +
    '-filters"><summary>More filters</summary><div class="advanced-filters">\n' +
    "    " +
    "".concat(
      F.areaType === "district"
        ? '<div class="f"><span>Boundaries</span><div class="seg" role="group" aria' +
            '-label="District boundaries">\n      <button data-boundary="current" aria' +
            '-pressed="' +
            `${F.boundary === "current"}` +
            '">Current</button>\n      <button data-boundary="atOpen" aria-pressed="' +
            `${F.boundary === "atOpen"}` +
            '" title="Only available if a parcel lookup was saved on or before the in' +
            'spection date">When opened</button></div></div>'
        : "",
    ) +
    "\n    " +
    "".concat(sel("f-vtype", "Violation type", F.vtype, [["", "All types"]].concat(M.types.map((t) => [t.key, t.label])))) +
    "\n    " +
    `${sel("f-ord", "Ordinance", F.ord, [["", "All ordinances"]].concat(M.ords.map((o) => [o, o])))}` +
    "\n    " +
    "".concat(
      sel(
        "f-status",
        "Status",
        F.status,
        [
          ["", "Any status"],
          ["open", "Open (not closed)"],
        ].concat(dep_STATUSES.map((s) => [s, s])),
      ),
    ) +
    "\n    </div></details>\n    " +
    `${appliedFilters(reports_reportpresentationContext(), dateMode)}` +
    "\n  </div>"
  );
}

function freshness() {
  return coverage(reports_reportpresentationContext());
}

function reportScreen(r) {
  if (r.date === "period" && ReportsState.S.F.from > ReportsState.S.F.to) {
    ReportsState.S.rep = null;
    return (
      topbar(r.label, r.lede, dep_actions()) +
      filtersBar(r.date) +
      '<div class="content"><div class="banner alert">The start date must be on or before the end date.</div></div>'
    );
  }

  const res = r.run(ReportsState.S.M, ReportsState.S.F);
  ReportsState.S.rep = { r: r, res: res };
  const dateTxt =
    r.date === "asOf"
      ? "As of " + dep_fmtDate(ReportsState.S.F.asOf)
      : dep_fmtDate(ReportsState.S.F.from) + " to " + dep_fmtDate(ReportsState.S.F.to);
  const body = ReportsState.S.view === "map" ? mapPanel(r, res) : tablePanel(res, dateTxt);
  const primary = res.total && res.total.find((x) => x && typeof x === "object" && x.fmt === "int");
  return (
    topbar(r.n + ". " + r.label, r.lede, dep_actions()) +
    filtersBar(r.date) +
    ('<div class="content">' +
      "".concat(ReportsState.S.reportNotice ? `<div class="banner info" role="status">${dep_esc(ReportsState.S.reportNotice)}</div>` : "") +
      "" +
      `${freshness()}` +
      "" +
      "".concat(
        primary
          ? '<div class="report-kpi"><strong>' +
              `${dep_fmtNum(primary.n)}` +
              "</strong><span>" +
              `${dep_esc(res.cols[1] || "matching records")}` +
              " · " +
              `${dep_esc(dateTxt)}` +
              "</span></div>"
          : "",
      ) +
      '\n      <div class="panel"><div class="panel-h"><div><h2>' +
      `${dep_esc(r.label)}` +
      '</h2><div class="sub">' +
      `${dep_esc(dateTxt)}` +
      "" +
      `${dep_esc(filterSummary())}` +
      '</div></div>\n        <div class="seg" role="group" aria-label="View"><bu' +
      'tton data-view="table" aria-pressed="' +
      `${ReportsState.S.view === "table"}` +
      '">Table</button><button data-view="map" aria-pressed="' +
      `${ReportsState.S.view === "map"}` +
      '">Map</button></div></div>\n        ' +
      `${body}` +
      "</div>\n      " +
      `${ReportsState.S.drill ? drillPanel() : ""}` +
      "</div>")
  );
}

function filterSummary() {
  const F = ReportsState.S.F,
    p = [];
  if (F.areas.length) p.push(F.areas.map((a) => dep_areaLabel(a)).join(", "));
  if (F.inspector) p.push(F.inspector);
  if (F.vtype) p.push((ReportsState.S.M.types.find((t) => t.key === F.vtype) || {}).label || F.vtype);
  if (F.ord) p.push(F.ord);
  if (F.status) p.push(F.status === "open" ? "open cases" : F.status);
  if (F.owner) p.push(dep_ownerKeyLabel(F.owner));
  if (F.areaType === "district" && F.boundary === "atOpen") p.push("districts as they were when each case opened");
  return p.length ? ". Filtered to " + p.join("; ") : "";
}

function cellHTML(x, ri, ci, max, isTotal) {
  if (x == null) return "<td></td>";
  if (typeof x === "string") return `<td>${dep_esc(x)}</td>`;
  if (x.kase)
    return (
      '<td><button class="linkish" data-case="' +
      `${dep_esc(x.kase)}` +
      '">' +
      `${dep_esc(x.kase)}` +
      '</button> <button class="linkish" data-writer="' +
      `${dep_esc(x.kase)}` +
      '">Open in Writer</button></td>'
    );
  if (x.owner !== undefined)
    return (
      "<td>" +
      "".concat(x.owner ? `<button class="linkish" data-owner="${dep_esc(x.owner)}">${dep_esc(x.text || "—")}</button>` : dep_esc(x.text || "—")) +
      "</td>"
    );
  const txt = x.fmt === "days" ? dep_fmtDays(x.n) : x.fmt === "money" ? dep_fmtMoney(x.n) : dep_fmtNum(x.n);
  // the bar behind a count scales against the largest count in its column
  const bar =
    !isTotal && x.fmt === "int" && max > 0 && x.n > 0 ? ` bar" style="background-size:${Math.max(3, Math.round((x.n / max) * 100))}% 70%` : "";
  const inner =
    x.ids && x.ids.length && x.n
      ? `<button data-drill="${ri}:${ci}" aria-label="${dep_esc(txt)}, show the cases">${dep_esc(txt)}</button>`
      : dep_esc(txt);
  return `<td class="n${x.n ? "" : " zero"}${bar}">${inner}</td>`;
}

function tablePanel(res, dateTxt) {
  if (!res.rows.length)
    return (
      '<div class="empty">Nothing matches ' +
      `${dep_esc(dateTxt.charAt(0).toLowerCase() + dateTxt.slice(1))}` +
      "" +
      `${dep_activeFilters() ? " with these filters" : ""}` +
      ".</div>"
    );
  const cellsOf = (row) => row.cells || row;
  const isNum = (ci) =>
    res.rows.some((row) => {
      const c = cellsOf(row)[ci];
      return c && typeof c === "object" && c.fmt;
    });
  const max = res.cols.map((_, ci) =>
    Math.max(
      0,
      ...res.rows.map((row) => {
        const c = cellsOf(row)[ci];
        return c && c.fmt === "int" ? c.n || 0 : 0;
      }),
    ),
  );
  const sel = ReportsState.S.drill && ReportsState.S.drill.at,
    sort = validSort(ReportsState.S.tableSort, ReportsState.S.screen);
  const rows = orderedRows(res, sort, (message) => {
    ReportsState.S.reportNotice = message;
    dep_A11Y.notify(message);
  });
  return (
    '<div class="tw"><table class="rep"><caption class="sr-only">' +
    `${dep_esc(ReportsState.S.rep?.r?.label || "Report")}` +
    " · " +
    `${dep_esc(dateTxt)}` +
    "</caption><thead><tr>" +
    "".concat(
      res.cols
        .map(
          (h, ci) =>
            '<th scope="col" aria-sort="' +
            `${sort?.ci === ci ? (sort.dir === 1 ? "ascending" : "descending") : "none"}` +
            '" class="' +
            `${isNum(ci) ? "n" : ""}` +
            '"><button class="sort-button" data-report-sort="' +
            `${ci}` +
            '">' +
            `${dep_esc(h)}` +
            "" +
            `${sort?.ci === ci ? (sort.dir === 1 ? " ↑" : " ↓") : ""}` +
            "</button></th>",
        )
        .join(""),
    ) +
    "</tr></thead><tbody>\n    " +
    "".concat(
      rows
        .map(
          ({ row, ri }) =>
            '<tr class="' +
            `${row.dim ? "dim" : ""}` +
            "" +
            `${sel && sel.split(":")[0] === String(ri) ? " sel" : ""}` +
            '">' +
            "".concat(
              cellsOf(row)
                .map((x, ci) => {
                  const cell = cellHTML(x, ri, ci, max[ci], false);
                  return ci === 0 ? cell.replace("<td", '<th scope="row"').replace("</td>", "</th>") : cell;
                })
                .join(""),
            ) +
            "</tr>",
        )
        .join(""),
    ) +
    "\n    " +
    "".concat(res.total ? `<tr class="total">${res.total.map((x, ci) => cellHTML(x, "t", ci, 0, true)).join("")}</tr>` : "") +
    "\n  </tbody></table></div>" +
    `${res.note ? `<div class="panel-b small">${dep_esc(res.note)}</div>` : ""}` +
    ""
  );
}

function drillPanel() {
  const d = ReportsState.S.drill,
    list = d.ids.map((n) => ReportsState.S.M.byNo[n]).filter(Boolean);
  return (
    '<div class="panel" id="drill"><div class="panel-h"><div><h2>' +
    `${dep_esc(d.title)}` +
    '</h2><div class="sub">' +
    `${dep_plural(list.length, "case")}` +
    '</div></div>\n    <button class="btn" data-act="closeDrill">Close</button' +
    "></div>" +
    `${caseTable(list)}` +
    "</div>"
  );
}

function caseTable(list) {
  return (
    '<div class="tw"><table class="rep"><thead><tr><th>Case</th><th>Address</' +
    "th><th>Area</th><th>Status</th><th>Opened</th><th>Inspector</th><th>Owne" +
    "r</th><th>Integrity</th></tr></thead><tbody>\n    " +
    "".concat(
      list
        .map(
          (c) =>
            '<tr><td><button class="linkish" data-case="' +
            `${dep_esc(c.number)}` +
            '">' +
            `${dep_esc(c.number)}` +
            '</button> <button class="linkish" data-writer="' +
            `${dep_esc(c.number)}` +
            '">Open in Writer</button></td><td>' +
            `${dep_esc(c.address)}` +
            "</td>\n      <td>" +
            `${dep_esc(dep_areaLabel(dep_areaKey(c)))}` +
            '</td><td><span class="st st-' +
            `${dep_esc(c.status)}` +
            '">' +
            `${dep_esc(c.status)}` +
            '</span></td><td class="n">' +
            `${dep_esc(dep_fmtDate(c.opened))}` +
            "</td>\n      <td>" +
            `${dep_esc(c.inspector)}` +
            "</td><td>" +
            "".concat(c.ownerKey ? `<button class="linkish" data-owner="${dep_esc(c.ownerKey)}">${dep_esc(c.owner)}</button>` : dep_esc(c.owner)) +
            "</td><td>" +
            `${dep_esc(c.integrity?.label || "Shared integrity not checked")}` +
            "</td></tr>",
        )
        .join(""),
    ) +
    "\n  </tbody></table></div>"
  );
}

function mapPanel(r, res) {
  const pts = res.points.filter((c) => c.located),
    off = res.points.length - pts.length;
  const z = ReportsState.S.F.areaType === "zip",
    shade = z
      ? ReportsState.S.areas && ReportsState.S.areas.zips && ReportsState.S.M.zipField
      : ReportsState.S.areas && ReportsState.S.areas.districts && ReportsState.S.M.distField;
  return (
    '<div class="legend">' +
    "".concat(dep_STATUSES.map((s) => `<span><i style="background:${dep_STATUS_COL[s]}"></i>${s}</span>`).join("")) +
    "\n      <span>" +
    `${dep_plural(pts.length, "case")}` +
    " on the map" +
    `${off ? ", " + dep_fmtNum(off) + " not located" : ""}` +
    ".</span>\n      <span>" +
    "".concat(
      res.area && shade
        ? "Shading is this report’s count by " + (z ? "ZIP code" : "district") + ". Click an area to filter to it."
        : res.area
          ? "No " + (z ? "ZIP" : "district") + " outlines are available, so areas are not shaded (see Data and definitions)."
          : "",
    ) +
    '</span>\n      <span class="seg" role="group" aria-label="Basemap"><butto' +
    'n data-basemap="labels" aria-pressed="' +
    `${ReportsState.S.basemap === "labels"}` +
    '">Street names</button><button data-basemap="plain" aria-pressed="' +
    `${ReportsState.S.basemap === "plain"}` +
    '">No labels</button></span></div>\n    <div id="map" role="region" aria-l' +
    'abel="Map of ' +
    `${dep_esc(r.label)}` +
    '"></div><details class="map-table-alternative"><summary>Table alternativ' +
    "e: all matching records, including unlocated cases</summary>" +
    `${tablePanel(res, r.label)}` +
    "</details>"
  );
}

function drawMap() {
  const el = document.getElementById("map");
  if (ReportsState.MAP) {
    try {
      ReportsState.MAP.remove();
    } catch (e) {
      /* An already removed map needs no further cleanup; its reference is cleared below. */
    }
    ReportsState.MAP = null;
  }
  const LF = window.L;
  if (!el || !LF || !ReportsState.S.rep) return;
  try {
    const res = ReportsState.S.rep.res,
      F = ReportsState.S.F;
    ReportsState.MAP = LF.map(el, { preferCanvas: true }).setView([43.0747, -89.3842], 12);
    LF.tileLayer(dep_TILE[ReportsState.S.basemap], { maxZoom: 19, minZoom: 3, attribution: "City of Madison" }).addTo(ReportsState.MAP);
    const fc = F.areaType === "district" ? ReportsState.S.areas && ReportsState.S.areas.districts : ReportsState.S.areas && ReportsState.S.areas.zips;
    const field = F.areaType === "district" ? ReportsState.S.M.distField : ReportsState.S.M.zipField;
    if (fc && field && res.area) {
      const mx = Math.max(
        1,
        ...Object.keys(res.area)
          .filter((k) => k)
          .map((k) => res.area[k]),
      );
      LF.geoJSON(fc, {
        style: (f) => {
          const id = dep_areaIdOf(f, field),
            n = res.area[id] || 0,
            picked = F.areas.indexOf(id) >= 0;
          return {
            color: picked ? "#0E3F5E" : "#14567F",
            weight: picked ? 2.5 : 1,
            fillColor: "#14567F",
            fillOpacity: n ? 0.08 + 0.47 * (n / mx) : 0.02,
          };
        },
        onEachFeature: (f, l) => {
          const id = dep_areaIdOf(f, field);
          l.bindTooltip(dep_esc(dep_areaLabel(id) + ": " + dep_fmtNum(res.area[id] || 0)), { sticky: true });
          l.on("click", () => {
            toggleArea(id);
          });
        },
      }).addTo(ReportsState.MAP);
    }
    const pts = res.points.filter((c) => c.located);
    pts.forEach((c) => {
      LF.circleMarker([c.lat, c.lon], { radius: 6, color: "#fff", weight: 1.5, fillColor: dep_STATUS_COL[c.status] || "#4E6376", fillOpacity: 0.95 })
        .bindTooltip(dep_esc(c.number + ", " + c.address + " (" + c.status + ")"))
        .on("click", () => {
          openCase(c.number);
        })
        .addTo(ReportsState.MAP);
    });
    if (pts.length) ReportsState.MAP.fitBounds(LF.latLngBounds(pts.map((c) => [c.lat, c.lon])).pad(0.15), { maxZoom: 16 });
  } catch (e) {
    el.innerHTML = '<div class="empty">The map could not be drawn (' + dep_esc(e.message || e) + ").</div>";
  }
}

function propertyHits(q) {
  const t = String(q || "")
    .trim()
    .toUpperCase();
  if (!t) return [];
  const pk = dep_normParcel(t);
  return ReportsState.S.M.cases.filter(
    (c) => (pk && c.parcelKey === pk) || c.number.toUpperCase() === t || (t.length >= 3 && c.address.toUpperCase().indexOf(t) >= 0),
  );
}

function openCase(no) {
  const c = ReportsState.S.M.byNo[no];
  if (!c) return;
  const q = c.parcelKey ? c.parcel : c.address;
  ReportsState.S.screen = "property";
  ReportsState.S.prop = { q: q, hits: propertyHits(q) };
  ReportsState.S.drill = null;
  dep_render();
  window.scrollTo(0, 0);
}

function propertyView() {
  const p = ReportsState.S.prop,
    hits = p.hits;
  return (
    '<div class="panel"><div class="panel-b"><div class="search">\n      <inpu' +
    't id="pv-q" type="search" value="' +
    `${dep_esc(p.q)}` +
    '" placeholder="Parcel number, address or case number" aria-label="Parcel' +
    ' number, address or case number">\n      <button class="btn btn-primary" ' +
    'data-act="propGo">Find</button></div></div></div>\n    ' +
    "".concat(
      hits == null ? "" : !hits.length ? `<div class="empty">No case matches &ldquo;${dep_esc(p.q)}&rdquo;.</div>` : hits.map(caseCard).join(""),
    ) +
    ""
  );
}

function caseCard(c) {
  const outc = { corrected: "Corrected", progress: "Progress made", none: "No change", noaccess: "No access" };
  const ev = c.documents
    .map((d) => ({
      d: d.effectiveFrom || d.issued,
      t:
        '<span class="' +
        `${d.void ? "void" : ""}` +
        '">' +
        `${dep_esc(d.label)}` +
        "" +
        `${d.revision ? " · revision " + dep_esc(d.revision.number) : ""}` +
        "</span>" +
        `${d.superseded ? " (replaced)" : ""}` +
        "" +
        `${d.revision ? " — " + dep_esc(d.revision.reason) : ""}` +
        "" +
        `${d.void ? " (void" + (d.voidReason ? ": " + dep_esc(d.voidReason) : "") + ")" : ""}` +
        "" +
        `${d.by ? ' <span class="small">' + dep_esc(d.by) + "</span>" : ""}` +
        "",
    }))
    .concat(c.documents.flatMap((d) => (d.annotations || []).map((n) => ({ d: dep_recordDay(n.at), t: "Record note: " + dep_esc(n.text) }))))
    .concat(c.visits.map((v) => ({ d: v.date, t: "Reinspection" + (v.inspector ? ' <span class="small">' + dep_esc(v.inspector) + "</span>" : "") })))
    .sort((a, b) => (a.d === b.d ? 0 : a.d < b.d ? -1 : 1));
  return (
    '<div class="card-case"><div class="cc-h"><div><h3>' +
    `${dep_esc(c.address)}` +
    '</h3><div class="small">Case ' +
    `${dep_esc(c.number)}` +
    ' <button class="linkish" data-writer="' +
    `${dep_esc(c.number)}` +
    '">Open in Writer</button>' +
    `${c.description ? ", " + dep_esc(c.description) : ""}` +
    '</div></div>\n      <div><span class="st st-' +
    `${dep_esc(c.status)}` +
    '">' +
    `${dep_esc(c.status)}` +
    '</span></div></div>\n    <div class="cc-meta">\n      <div><span>Parcel</s' +
    "pan>" +
    `${dep_esc(c.parcel || "—")}` +
    "" +
    `${c.parcelKey && !c.located && c.looked ? ' <span class="small">(not on the city layer)</span>' : ""}` +
    "</div>\n      <div><span>Alder district</span>" +
    `${dep_esc(c.alderNow || "—")}` +
    "" +
    "".concat(c.alderAtOpen && c.alderAtOpen !== c.alderNow ? ' <span class="small">(was ' + dep_esc(c.alderAtOpen) + " when opened)</span>" : "") +
    "</div>\n      <div><span>ZIP</span>" +
    `${dep_esc(c.zip || "—")}` +
    "</div>\n      <div><span>Building district</span>" +
    `${dep_esc(c.building || "—")}` +
    "</div>\n      <div><span>Inspector</span>" +
    `${dep_esc(c.inspector || "—")}` +
    "</div>\n      <div><span>Opened</span>" +
    `${dep_esc(dep_fmtDate(c.opened))}` +
    "</div>\n      <div><span>Closed</span>" +
    `${dep_esc(dep_fmtDate(c.closedOn))}` +
    "</div>\n      <div><span>Owner</span>" +
    "".concat(
      c.ownerKey ? `<button class="linkish" data-owner="${dep_esc(c.ownerKey)}">${dep_esc(c.owner || "—")}</button>` : dep_esc(c.owner || "—"),
    ) +
    "</div>\n      <div><span>Mailing address</span>" +
    `${dep_esc(c.ownerAddr.join(", ") || "—")}` +
    '</div>\n    </div>\n    <ul class="timeline">' +
    "".concat(
      ev.map((e) => `<li><span class="d">${dep_esc(dep_fmtDate(e.d))}</span><span>${e.t}</span></li>`).join("") ||
        '<li><span class="d"></span><span class="small">No documents issued</span></li>',
    ) +
    '</ul>\n    <div class="tw"><table class="rep"><thead><tr><th class="n">It' +
    'em</th><th>Violation</th><th>Type</th><th>Status</th><th class="n">Visit' +
    "s</th><th>Citations</th></tr></thead><tbody>\n      " +
    "".concat(
      c.violations
        .map((v) => {
          const cits = c.citations.filter((x) => x.no === v.no);
          return (
            '<tr><td class="n">' +
            `${dep_esc(v.no)}` +
            "</td><td>" +
            `${dep_esc(v.title)}` +
            '<div class="muted">' +
            `${dep_esc(v.sections.join(", "))}` +
            "</div></td><td>" +
            `${dep_esc(v.typeLabel)}` +
            "</td>\n        <td>" +
            "".concat(
              v.withdrawn
                ? "Withdrawn — entered in error"
                : v.done
                  ? "Corrected " + dep_esc(dep_fmtDate(v.doneOn))
                  : v.lastOutcome
                    ? dep_esc(outc[v.lastOutcome] || v.lastOutcome)
                    : "Open",
            ) +
            '</td><td class="n">' +
            `${dep_fmtNum(v.visits)}` +
            "</td>\n        <td>" +
            "".concat(
              cits
                .map(
                  (x) =>
                    "" +
                    `${dep_esc(x.num)}` +
                    ' <span class="muted">' +
                    `${dep_esc(dep_fmtDate(x.issued))}` +
                    ", " +
                    `${dep_esc(x.ordinance)}` +
                    ", " +
                    `${dep_esc(dep_fmtMoney(x.amount))}` +
                    "</span>",
                )
                .join("<br>") || "—",
            ) +
            "</td></tr>"
          );
        })
        .join("") || '<tr><td colspan="6" class="small">No violation items on an issued notice</td></tr>',
    ) +
    "\n    </tbody></table></div></div>"
  );
}

function ownerView() {
  const o = ReportsState.S.own,
    g = dep_groupBy(
      ReportsState.S.M.cases.filter((c) => c.ownerKey),
      (c) => c.ownerKey,
    );
  const q = String(o.q || "")
    .trim()
    .toUpperCase();
  const matches = q
    ? Array.from(g.keys()).filter((k) => k.indexOf(dep_normStreet(q)) >= 0 || g.get(k).some((c) => c.owner.toUpperCase().indexOf(q) >= 0))
    : [];
  const sel = o.key && g.get(o.key);
  return (
    '<div class="panel"><div class="panel-b"><div class="search">\n      <inpu' +
    't id="ow-q" type="search" value="' +
    `${dep_esc(o.q)}` +
    '" placeholder="Owner name or mailing address" aria-label="Owner name or ' +
    'mailing address">\n      <button class="btn btn-primary" data-act="ownGo"' +
    ">Find</button></div>\n    " +
    "".concat(
      q && !sel
        ? matches.length
          ? '<div class="tw" style="margin-top:12px"><table class="rep"><thead><tr><t' +
            'h>Mailing address</th><th>Owner names seen</th><th class="n">Cases</th><' +
            "/tr></thead><tbody>\n      " +
            "".concat(
              matches
                .map(
                  (k) =>
                    '<tr><td><button class="linkish" data-owner="' +
                    `${dep_esc(k)}` +
                    '">' +
                    `${dep_esc(dep_ownerKeyLabel(k))}` +
                    "</button></td><td>" +
                    `${dep_esc(dep_uniq(g.get(k).map((c) => c.owner)).join("; "))}` +
                    '</td><td class="n">' +
                    `${dep_fmtNum(g.get(k).length)}` +
                    "</td></tr>",
                )
                .join(""),
            ) +
            "\n      </tbody></table></div>"
          : `<div class="empty">No owner matches &ldquo;${dep_esc(o.q)}&rdquo;.</div>`
        : "",
    ) +
    "\n    </div></div>\n    " +
    "".concat(
      sel
        ? '<div class="panel"><div class="panel-h"><div><h2>' +
            `${dep_esc(dep_ownerKeyLabel(o.key))}` +
            '</h2>\n        <div class="sub">' +
            `${dep_plural(sel.length, "case")}` +
            " at " +
            `${dep_plural(dep_uniq(sel.map((c) => c.parcelKey || c.address)).length, "property", "properties")}` +
            ". Owner names seen: " +
            `${dep_esc(dep_uniq(sel.map((c) => c.owner)).join("; "))}` +
            '</div></div>\n        <button class="btn" data-act="useOwner">Filter the ' +
            "reports to this owner</button></div>\n      " +
            `${caseTable(sel)}` +
            "</div>"
        : "",
    ) +
    ""
  );
}

function dataView() {
  const x = ReportsState.S.raw,
    M = ReportsState.S.M,
    a = ReportsState.S.areas || {};
  const unlocated = M.counted.filter((c) => !c.located);
  const li = (l) =>
    l.length
      ? '<ul class="list" tabindex="0" aria-label="Reported files or cases">' + `${l.map((s) => `<li>${dep_esc(s)}</li>`).join("")}` + "</ul>"
      : "";
  const why = (c) =>
    !c.parcel
      ? "no parcel on the case"
      : !c.parcelKey
        ? "parcel " + c.parcel + " is not 12 digits"
        : c.looked
          ? "parcel " + c.parcel + " is not on the city parcel layer"
          : "parcel " + c.parcel + " has not been looked up yet";
  return (
    '<div class="panel"><div class="panel-h"><h2>Coverage and next actions</h' +
    '2></div><div class="panel-b"><p>For missing, stale or excluded summaries' +
    ": open Document Writer → Tools &amp; settings → Saved work and connectio" +
    "n → Connection checks and technical details → Storage diagnostics → Rebu" +
    "ild reporting index. Resolve unreadable or integrity errors in the affec" +
    "ted case before rebuilding; rebuilding does not repair history. Refresh " +
    'Reports afterward.</p><details id="report-proof"><summary>Record proof a' +
    'nd excluded files</summary>\n    <ul class="defs">\n      <li><b>' +
    `${dep_plural(x.summaries.length, "case summary", "case summaries")}` +
    "</b> from " +
    `${dep_esc(x.caseDir)}` +
    "\\" +
    `${dep_esc(dep_SUMMARY_DIR)}` +
    ", read " +
    `${dep_esc(dep_fmtDate(String(x.readAt).slice(0, 10)))}` +
    " " +
    `${dep_esc(String(x.readAt).slice(11, 16))}` +
    ".\n        " +
    `${dep_fmtNum(M.cases.length - M.counted.length)}` +
    " of them have no issued notice yet and are not counted.</li>\n      <li><" +
    "b>" +
    `${dep_plural(x.missing.length, "case file")}` +
    " with no summary.</b> " +
    `${x.missing.length ? "Rebuild the reporting index in Writer using the steps above." : ""}` +
    "" +
    `${li(x.missing)}` +
    "</li>\n      <li><b>" +
    `${dep_plural(x.stale.length + M.versionStale.length, "stale summary", "stale summaries")}` +
    ".</b> Different from the exact case revision, missing its revision, or w" +
    "ritten in an earlier summary format. Excluded from current totals; rebui" +
    "ld the reporting index in Writer." +
    `${li(x.stale.concat(M.versionStale.map((n) => n + " (earlier summary format)")))}` +
    "</li>\n      " +
    "".concat(
      x.unreadable.length
        ? "<li><b>" + `${dep_plural(x.unreadable.length, "unreadable summary", "unreadable summaries")}` + ".</b>" + `${li(x.unreadable)}` + "</li>"
        : "",
    ) +
    "\n      <li><b>" +
    `${dep_plural(unlocated.length, "case")}` +
    " not located on the map.</b>" +
    `${li(unlocated.map((c) => c.number + ", " + c.address + ": " + why(c)))}` +
    "</li>\n      " +
    "".concat(ReportsState.S.parcelNote ? `<li><b>Parcel lookup.</b> ${dep_esc(ReportsState.S.parcelNote)}</li>` : "") +
    "\n      <li><b>District outlines:</b> " +
    "".concat(
      a.districts
        ? M.distField
          ? "loaded" +
            (a.districtsDate ? " (file dated " + dep_esc(dep_fmtDate(a.districtsDate)) + ")" : "") +
            "; the district number is read from the " +
            dep_esc(M.distField) +
            " field"
          : "loaded, but no field reads as a district number, so districts are not shaded"
        : "not available",
    ) +
    ".\n        <b>ZIP outlines:</b> " +
    "".concat(
      a.zips
        ? M.zipField
          ? "loaded; used for cases whose ZIP was not imported from Accela"
          : "loaded, but no field reads as a ZIP code"
        : "not provided (optional)",
    ) +
    ".\n        " +
    `${(a.notes || []).map((n) => `<div class="small" style="margin-top:6px">${dep_esc(n)}</div>`).join("")}` +
    '</li>\n    </ul></details></div></div>\n  <div class="panel"><div class="p' +
    'anel-b"><details id="report-definitions"><summary>Data definitions</summ' +
    'ary><ul class="defs">\n    ' +
    `${dep_DEFINITIONS.map((d) => `<li><b>${dep_esc(d[0])}.</b> ${dep_esc(d[1])}</li>`).join("")}` +
    "\n  </ul></details></div></div>"
  );
}

function crc32(u) {
  let c = 0xffffffff;
  for (let i = 0; i < u.length; i++) c = dep_CRC_T[(c ^ u[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zipStore(files) {
  const enc = new TextEncoder(),
    parts = [],
    central = [];
  let off = 0;
  files.forEach((f) => {
    const nm = enc.encode(f.name),
      d = typeof f.data === "string" ? enc.encode(f.data) : f.data,
      crc = crc32(d);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(6, 0x0800, true);
    h.setUint16(8, 0, true);
    h.setUint16(10, 0, true);
    h.setUint16(12, 0x21, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, d.length, true);
    h.setUint32(22, d.length, true);
    h.setUint16(26, nm.length, true);
    h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), nm, d);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, 0, true);
    c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, d.length, true);
    c.setUint32(24, d.length, true);
    c.setUint16(28, nm.length, true);
    c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nm);
    off += 30 + nm.length + d.length;
  });
  const size = central.reduce((n, p) => n + p.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(12, size, true);
  e.setUint32(16, off, true);
  const all = parts.concat(central, [new Uint8Array(e.buffer)]);
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let o = 0;
  all.forEach((p) => {
    out.set(p, o);
    o += p.length;
  });
  return out;
}

function colName(i) {
  let s = "";
  i++;
  while (i) {
    const m = (i - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

function sheetXml(rows, opt) {
  opt = opt || {};
  const widths = [];
  const body = rows
    .map(
      (row, ri) =>
        '<row r="' +
        `${ri + 1}` +
        '">' +
        "".concat(
          row
            .map((v, ci) => {
              const r = colName(ci) + (ri + 1);
              const shown =
                v == null ? "" : typeof v === "object" ? (v.d ? "00/00/0000" : v.m != null ? "$" + v.m.toFixed(2) : String(v.f)) : String(v);
              widths[ci] = Math.max(widths[ci] || 8, Math.min(60, shown.length + 2));
              if (v == null || v === "") return "";
              if (typeof v === "number") return isFinite(v) ? `<c r="${r}"><v>${v}</v></c>` : "";
              if (typeof v === "object") {
                if (v.d) return dep_validISO(v.d) ? `<c r="${r}" s="1"><v>${dep_excelDate(v.d)}</v></c>` : "";
                if (v.m != null) return isFinite(v.m) ? `<c r="${r}" s="3"><v>${v.m}</v></c>` : "";
                if (v.f != null) return isFinite(v.f) ? `<c r="${r}" s="4"><v>${Math.round(v.f * 10) / 10}</v></c>` : "";
                return "";
              }
              const bold = (opt.header && ri === 0) || (opt.boldRows && opt.boldRows.indexOf(ri) >= 0);
              return `<c r="${r}" t="inlineStr"${bold ? ' s="2"' : ""}><is><t xml:space="preserve">${dep_xesc(v)}</t></is></c>`;
            })
            .join(""),
        ) +
        "</row>",
    )
    .join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    (opt.header
      ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="' +
        'A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
      : "") +
    (widths.length ? "<cols>" + widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("") + "</cols>" : "") +
    "<sheetData>" +
    body +
    "</sheetData></worksheet>"
  );
}

function sheetName(s, used) {
  let n =
    String(s)
      .replace(/[\[\]:*?\/\\]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 31) || "Sheet";
  const b = n;
  let i = 2;
  while (used[n.toLowerCase()]) {
    n = b.slice(0, 28) + " " + i++;
  }
  used[n.toLowerCase()] = 1;
  return n;
}

function workbook(sheets) {
  const used = {},
    named = sheets.map((s) => Object.assign({}, s, { name: sheetName(s.name, used) }));
  const x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const files = [
    {
      name: "[Content_Types].xml",
      data:
        x +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        ('<Default Extension="rels" ContentType="application/vnd.openxmlformats-pa' +
          'ckage.relationships+xml"/><Default Extension="xml" ContentType="applicat' +
          'ion/xml"/>') +
        ('<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openx' + 'mlformats-officedocument.spreadsheetml.sheet.main+xml"/>') +
        ('<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxml' + 'formats-officedocument.spreadsheetml.styles+xml"/>') +
        named
          .map(
            (s, i) =>
              '<Override PartName="/xl/worksheets/sheet' +
              `${i + 1}` +
              '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreads' +
              'heetml.worksheet+xml"/>',
          )
          .join("") +
        "</Types>",
    },
    {
      name: "_rels/.rels",
      data:
        x +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        ('<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDo' +
          'cument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Re' +
          "lationships>"),
    },
    {
      name: "xl/workbook.xml",
      data:
        x +
        ('<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/ma' +
          'in" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relat' +
          'ionships"><sheets>') +
        named.map((s, i) => `<sheet name="${dep_xesc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
        "</sheets></workbook>",
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data:
        x +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        named
          .map(
            (s, i) =>
              '<Relationship Id="rId' +
              `${i + 1}` +
              '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationsh' +
              'ips/worksheet" Target="worksheets/sheet' +
              `${i + 1}` +
              '.xml"/>',
          )
          .join("") +
        ('<Relationship Id="rId' +
          `${named.length + 1}` +
          '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationsh' +
          'ips/styles" Target="styles.xml"/></Relationships>'),
    },
    { name: "xl/styles.xml", data: dep_STYLES },
  ].concat(named.map((s, i) => ({ name: "xl/worksheets/sheet" + (i + 1) + ".xml", data: sheetXml(s.rows, s.opt) })));
  return { bytes: zipStore(files), names: named.map((s) => s.name) };
}

function exportSheets() {
  const M = ReportsState.S.M,
    F = ReportsState.S.F;
  const cases = M.counted.filter((c) => dep_caseOk(c, F) && dep_inPeriod(c.opened, F));
  const A = (c) => dep_areaLabel(dep_areaKey(c));
  const casesRows = [
    [
      "Case number",
      "Address",
      "Parcel",
      "ZIP",
      "Alder district (current)",
      "Alder district (when opened)",
      "Building district",
      "Inspector",
      "Opened",
      "Notice issued",
      "Status",
      "Closed",
      "Owner",
      "Owner mailing address",
      "Owner key",
      "Violations",
      "Open violations",
      "Citations",
      "Referrals",
      "Latitude",
      "Longitude",
    ],
  ].concat(
    cases.map((c) => [
      c.number,
      c.address,
      c.parcel,
      c.zip,
      c.alderNow ? +c.alderNow : null,
      c.alderAtOpen ? +c.alderAtOpen : null,
      c.building ? +c.building : null,
      c.inspector,
      dep_D(c.opened),
      dep_D(c.noticeIssued),
      c.status,
      dep_D(c.closedOn),
      c.owner,
      c.ownerAddr.join(", "),
      dep_ownerKeyLabel(c.ownerKey),
      c.violations.filter((v) => !v.withdrawn).length,
      c.violations.filter((v) => !v.done && !v.withdrawn).length,
      c.citations.length,
      c.referrals.length,
      c.lat,
      c.lon,
    ]),
  );
  const vRows = [
    [
      "Case number",
      "Address",
      "Area",
      "Item",
      "Title",
      "Violation type",
      "Classified by",
      "Sections",
      "Opened",
      "Due",
      "Corrected",
      "Corrected on",
      "Days to compliance",
      "Last outcome",
      "Visits",
      "Times cited",
      "Inspector",
      "Owner key",
    ],
  ];
  cases.forEach((c) =>
    c.violations
      .filter((v) => dep_violOk(v, F))
      .forEach((v) =>
        vRows.push([
          c.number,
          c.address,
          A(c),
          dep_numOr(v.no),
          v.title,
          v.typeLabel,
          v.typeHow,
          v.sections.join(", "),
          dep_D(c.opened),
          dep_D(v.due),
          v.withdrawn ? "Withdrawn" : v.done ? "Yes" : "No",
          dep_D(v.doneOn),
          c.caseType !== "snow-10.28" && v.done ? dep_daysBetween(c.opened, v.doneOn) : null,
          v.lastOutcome,
          v.visits,
          v.cited,
          c.inspector,
          dep_ownerKeyLabel(c.ownerKey),
        ]),
      ),
  );
  const visitRows = [["Case number", "Address", "Area", "Visit date", "Inspector", "Item", "Outcome"]];
  cases.forEach((c) =>
    c.visits.forEach((vi) =>
      (vi.results || []).forEach((r) => visitRows.push([c.number, c.address, A(c), dep_D(vi.date), vi.inspector, dep_numOr(r.no), r.oc])),
    ),
  );
  const citRows = [
    [
      "Citation number",
      "Case number",
      "Address",
      "Area",
      "Item",
      "Ordinance",
      "Description",
      "Issued",
      "Court date",
      "Cash deposit",
      "Tier",
      "Issued by",
      "Case workflow",
      "Override administrator",
      "Override reason",
      "Override source",
      "Override authorized (UTC)",
    ],
  ];
  M.counted
    .filter((c) => dep_caseOk(c, F, { noViol: true, noInspector: true }))
    .forEach((c) =>
      c.citations.forEach((x) => {
        if (!dep_inPeriod(x.issued, F) || (F.inspector && x.by !== F.inspector) || (F.ord && x.ordinance !== F.ord)) return;
        citRows.push([
          x.num,
          c.number,
          c.address,
          A(c),
          dep_numOr(x.no),
          x.ordinance,
          x.desc,
          dep_D(x.issued),
          dep_D(x.courtDate),
          x.amount == null ? null : { m: x.amount },
          x.tier,
          x.by,
          c.caseType || "",
          x.overrideBasis?.administrator || "",
          x.overrideBasis?.reason || "",
          x.overrideBasis?.sourceReference || "",
          x.overrideBasis?.approvedAt || "",
        ]);
      }),
    );
  const refRows = [["Case number", "Address", "Area", "Referred", "Referred by", "Owner", "Owner mailing address", "Owner key"]];
  M.counted
    .filter((c) => dep_caseOk(c, F, { noInspector: true }))
    .forEach((c) =>
      c.referrals.forEach((r) => {
        if (!dep_inPeriod(r.issued, F) || (F.inspector && r.by !== F.inspector)) return;
        refRows.push([c.number, c.address, A(c), dep_D(r.issued), r.by, r.owner, (r.ownerAddr || []).join(", "), dep_ownerKeyLabel(r.ownerKey)]);
      }),
    );
  const about = [
    ["Building Inspection reports"],
    [],
    ["Exported", dep_iso(new Date()) + " " + new Date().toTimeString().slice(0, 5)],
    ["Build", dep_BUILD],
    ["Index read", String(ReportsState.S.raw.readAt).replace("T", " ")],
    ["Period", dep_fmtDate(F.from) + " to " + dep_fmtDate(F.to) + " (case opening date; issue date for citations and referrals)"],
    ["As of (open-case reports)", dep_fmtDate(F.asOf)],
    [
      "Area",
      F.areaType === "zip" ? "ZIP code" : "Alder district, " + (F.boundary === "atOpen" ? "as it read when each case opened" : "current boundaries"),
    ],
    ["Filters", filterSummary().replace(/^\. Filtered to /, "") || "none"],
    ["Cases in the period", cases.length],
    ["Case files without a summary", ReportsState.S.raw.missing.length],
    ["Stale summaries", ReportsState.S.raw.stale.length + M.versionStale.length],
    ["Cases not located", M.counted.filter((c) => !c.located).length],
    [],
    ["Definitions"],
  ].concat(dep_DEFINITIONS.map((d) => [d[0], d[1]]));
  const correctionRows = [
    ["Case number", "Recorded at (UTC)", "Inspector", "New document", "Replaces", "Reason", "Field", "Previously issued", "Corrected value"],
  ];
  M.cases
    .filter((c) => dep_caseOk(c, F))
    .forEach((c) =>
      (c.summary.corrections || [])
        .filter((r) => dep_inPeriod(dep_recordDay(r.at), F))
        .forEach((r) =>
          (r.changes || []).forEach((x) =>
            correctionRows.push([
              c.number,
              r.at,
              r.by,
              r.docId,
              r.replaces,
              r.reason,
              x.label,
              dep_humanCorrectionValue(x.before),
              dep_humanCorrectionValue(x.after),
            ]),
          ),
        ),
    );
  const sheets = [
    { name: "About", rows: about, opt: { boldRows: [0, 14] } },
    { name: "Cases", rows: casesRows, opt: { header: true } },
    { name: "Violations", rows: vRows, opt: { header: true } },
    { name: "Visits", rows: visitRows, opt: { header: true } },
    { name: "Citations", rows: citRows, opt: { header: true } },
    { name: "Referrals", rows: refRows, opt: { header: true } },
    { name: "Corrections", rows: correctionRows, opt: { header: true } },
  ];
  const conv = (x) =>
    x == null
      ? null
      : typeof x === "string"
        ? x
        : x.kase
          ? x.kase
          : x.owner !== undefined
            ? x.text || ""
            : x.n == null || isNaN(x.n)
              ? null
              : x.fmt === "money"
                ? { m: x.n }
                : x.fmt === "days"
                  ? { f: x.n }
                  : x.n;
  dep_REPORTS.forEach((r) => {
    const res = r.run(M, F);
    sheets.push({
      name: r.n + " " + r.label,
      opt: { header: true },
      rows: [res.cols].concat(
        orderedRows(res, validSort(ReportsState.S.tableSort, r.id), (message) => {
          ReportsState.S.reportNotice = message;
          dep_A11Y.notify(message);
        }).map(({ row }) => (row.cells || row).map(conv)),
        res.total ? [res.total.map(conv)] : [],
      ),
    });
  });
  return sheets;
}

function exportWorkbook() {
  if (ReportsState.S.F.from > ReportsState.S.F.to) {
    alert("Choose a start date on or before the end date.");
    return null;
  }
  const wb = workbook(exportSheets());
  const blob = new Blob([wb.bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "Building Inspection reports " + dep_iso(new Date()) + ".xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return wb;
}

function toggleArea(a) {
  const i = ReportsState.S.F.areas.indexOf(a);
  if (i >= 0) ReportsState.S.F.areas.splice(i, 1);
  else ReportsState.S.F.areas.push(a);
  ReportsState.S.savedId = "";
  ReportsState.S.drill = null;
  dep_render();
}

export {
  reportActions,
  shell,
  screenFrame,
  topbar,
  filtersBar,
  freshness,
  reportScreen,
  filterSummary,
  cellHTML,
  tablePanel,
  drillPanel,
  caseTable,
  mapPanel,
  drawMap,
  propertyHits,
  openCase,
  propertyView,
  caseCard,
  ownerView,
  dataView,
  crc32,
  zipStore,
  colName,
  sheetXml,
  sheetName,
  workbook,
  exportSheets,
  exportWorkbook,
  toggleArea,
};
