/* Read-only report presentation. All output paths share this stable row ordering. */
import { reportSort } from "./contracts.js";
const reportValue = (x) => (x == null ? "" : typeof x === "object" ? (x.n ?? x.text ?? x.kase ?? "") : x);
export function orderedRows(res, sort, onFailure = () => {}) {
  const rows = res.rows.map((row, ri) => ({ row, ri }));
  try {
    if (sort)
      rows.sort((a, b) => {
        const x = reportValue((a.row.cells || a.row)[sort.ci]),
          y = reportValue((b.row.cells || b.row)[sort.ci]);
        return (
          (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * sort.dir ||
          a.ri - b.ri
        );
      });
  } catch (error) {
    onFailure("The report could not be sorted. Showing the default order.");
    return res.rows.map((row, ri) => ({ row, ri }));
  }
  return rows;
}
export const validSort = reportSort;
export function reportNavigation(R) {
  const primary = ["openCases", "allCases", "citations"];
  const buttons = (list) =>
    list
      .map(
        (r) =>
          '<button class="rail-item" data-screen="' +
          `${r.id}` +
          '" ' +
          `${R.S.screen === r.id ? 'aria-current="page"' : ""}` +
          ">" +
          `${R.esc(r.label)}` +
          "</button>",
      )
      .join("");
  return (
    '<div class="rail-group">Case reports</div>' +
    buttons(primary.map((id) => R.reportById(id)).filter(Boolean)) +
    '<details id="report-menu" class="report-menu" ' +
    (!primary.includes(R.S.screen) && R.reportById(R.S.screen) ? "open" : "") +
    "><summary>More reports</summary>" +
    buttons(R.REPORTS.filter((r) => !primary.includes(r.id))) +
    "</details>"
  );
}
export function reportActions(R) {
  return (
    '<button class="btn" data-act="reload">Refresh data</button><details id="' +
    'report-exports" class="report-actions"><summary>Export and print</summar' +
    'y><div><button class="btn" data-report-csv>Export this report CSV</butto' +
    'n><button class="btn" data-report-print>Print report</button><button cla' +
    'ss="btn btn-primary" data-act="export">Export to Excel</button><p class=' +
    '"small">The current report sheet keeps the table filters and sort. Other' +
    " sheets use their named report definitions.</p></div></details><details " +
    'id="report-views" class="report-actions"><summary>Saved views</summary><' +
    'div><label class="f">Saved views<select id="saved-view"><option value=""' +
    ">Choose a view</option>" +
    "".concat(
      R.SAVED_VIEWS.map(
        (v) =>
          '<option value="' +
          `${R.esc(v.id)}` +
          '" ' +
          `${R.S.savedId === v.id ? "selected" : ""}` +
          ">" +
          `${R.esc(v.name)}` +
          " · " +
          `${R.esc(v.dateMode)}` +
          "</option>",
      ).join(""),
    ) +
    '</select></label><button class="btn" data-act="saveView">Save view</butt' +
    "on>" +
    `${R.S.savedId ? '<button class="btn" data-act="deleteView">Delete view</button>' : ""}` +
    '<button class="btn" data-share-report-view>Share view</button><button cl' +
    'ass="btn" data-shared-report-views>Shared views</button><p class="small"' +
    ">Shared views retain filters, date mode and table/map choice. Sort is sa" +
    "ved in local views only.</p></div></details>"
  );
}
export function appliedFilters(R, dateMode) {
  const F = R.S.F,
    labels = [
      dateMode === "asOf" ? "As of " + R.fmtDate(F.asOf) : R.fmtDate(F.from) + " to " + R.fmtDate(F.to),
      F.areaType === "zip" ? "ZIP code" : F.boundary === "atOpen" ? "District when opened" : "Current district",
    ];
  if (F.areas.length) labels.push(F.areas.map((a) => R.areaLabel(a, F)).join(", "));
  if (F.inspector) labels.push("Inspector: " + F.inspector);
  if (F.vtype) labels.push("Type: " + (R.S.M.types.find((t) => t.key === F.vtype)?.label || F.vtype));
  if (F.ord) labels.push("Ordinance: " + F.ord);
  if (F.status) labels.push("Status: " + F.status);
  if (F.owner) labels.push("Owner: " + R.ownerKeyLabel(F.owner));
  return (
    '<div class="applied-filters" aria-label="Applied filters">' +
    labels.map((l) => '<span class="chip">' + R.esc(l) + "</span>").join("") +
    '<button class="btn" data-act="clearFilters">Reset filters</button></div>'
  );
}
export function coverage(R) {
  const x = R.S.raw,
    M = R.S.M,
    missing = x.missing || [],
    stale = x.stale || [],
    bad = x.unreadable || [],
    mismatched = x.mismatched || [],
    old = M.versionStale || [],
    incomplete = missing.length || stale.length || bad.length || mismatched.length || old.length,
    unlocated = M.counted.filter((c) => !R.areaKey(c, R.S.F)).length;
  return (
    '<div class="report-coverage"><p><b>Shared reporting: ' +
    `${R.fmtNum(M.counted.length)}` +
    " issued cases</b> · verified against case bytes at " +
    `${R.esc(String(x.readAt).replace("T", " "))}` +
    ". Workspace queue counts cover this device and may differ. Refresh to ch" +
    "eck for later changes.</p>" +
    "".concat(
      incomplete
        ? '<p class="warn"><b>Coverage incomplete.</b> ' +
            R.plural(missing.length, "case file") +
            " without a usable summary; " +
            R.plural(stale.length, "revision mismatch", "revision mismatches") +
            "; " +
            R.plural(old.length, "earlier-format summary", "earlier-format summaries") +
            "; " +
            R.plural(bad.length, "unreadable/duplicate summary entry", "unreadable/duplicate summary entries") +
            "; " +
            R.plural(mismatched.length, "summary not matching its verified case", "summaries not matching their verified cases") +
            ('. These categories can overlap. <button class="linkish" data-screen="dat' +
              'a">Review excluded records and rebuild instructions</button></p>')
        : "",
    ) +
    "" +
    "".concat(
      unlocated
        ? "<p>" +
            R.plural(unlocated, "case") +
            " without a matching " +
            (R.S.F.areaType === "zip" ? "ZIP" : "district") +
            '; included as Unlocated. <button class="linkish" data-screen="data">Review location coverage</button></p>'
        : "",
    ) +
    "</div>"
  );
}
export function rememberUI(S) {
  const app = document.getElementById("app"),
    a = document.activeElement,
    selectors = [
      "data-screen",
      "data-view",
      "data-act",
      "data-period",
      "data-areatype",
      "data-boundary",
      "data-report-sort",
      "data-area",
      "data-schedule-page",
    ];
  let focus = null;
  if (app?.contains(a)) {
    if (a.id) focus = { id: a.id };
    else if (a.tagName === "SUMMARY") focus = { summary: a.parentElement.id };
    else {
      const key = selectors.find((k) => a.hasAttribute(k));
      if (key) focus = { key, value: a.getAttribute(key) };
    }
  }
  return {
    screen: app?.dataset.screen,
    caret: a && typeof a.selectionStart === "number" ? { start: a.selectionStart, end: a.selectionEnd } : null,
    open: [...document.querySelectorAll("#app details[id][open]")].map((el) => el.id),
    focus,
  };
}
export function restoreUI(S, u) {
  const app = document.getElementById("app");
  if (!app) return;
  app.dataset.screen = S.screen;
  if (u.screen === S.screen) {
    for (const id of u.open) {
      const el = document.getElementById(id);
      if (el?.tagName === "DETAILS") el.open = true;
    }
    const f = u.focus,
      el = f?.id
        ? document.getElementById(f.id)
        : f?.summary
          ? document.getElementById(f.summary)?.querySelector("summary")
          : f?.key
            ? [...document.querySelectorAll("[" + f.key + "]")].find((el) => el.getAttribute(f.key) === f.value)
            : null;
    if (el) {
      for (let p = el.parentElement; p; p = p.parentElement) if (p.tagName === "DETAILS") p.open = true;
      el.focus({ preventScroll: true });
      if (u.caret && el.setSelectionRange) el.setSelectionRange(u.caret.start, u.caret.end);
    }
  } else {
    const h = document.querySelector("h1");
    if (h) {
      h.tabIndex = -1;
      h.focus({ preventScroll: true });
    }
  }
}
