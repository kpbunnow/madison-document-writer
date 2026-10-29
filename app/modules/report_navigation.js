function dispatchReportFileAction(services, a) {
  if (a === "reload") {
    services.loadAll(false);
    return true;
  }
  if (a === "refreshParcels") {
    services.loadAll(true);
    return true;
  }
  if (a === "export") {
    services.exportWorkbook();
    return true;
  }
  if (a === "saveView") {
    services.saveReportView();
    return true;
  }
  if (a === "deleteView") {
    services.deleteReportView();
    return true;
  }
  return false;
}

function selectReportPeriod(services, d) {
  if (d.period) {
    const now = services.iso(new Date());
    services.state.F.to = now;
    services.state.F.asOf = now;
    services.state.F.from =
      d.period === "month"
        ? now.slice(0, 7) + "-01"
        : d.period === "year"
          ? now.slice(0, 4) + "-01-01"
          : services.state.M.counted
              .map((c) => c.opened)
              .filter(services.validISO)
              .sort()[0] || now;
    services.state.dateMode = d.period;
    services.state.savedId = "";
    services.state.drill = null;
    services.render();
    return true;
  }
  return false;
}

function selectReportView(services, d) {
  if (d.screen) {
    services.state.screen = d.screen;
    services.state.savedId = "";
    services.state.reportNotice = "";
    services.state.drill = null;
    services.render();
    window.scrollTo(0, 0);
    return true;
  }
  if (d.view) {
    services.state.view = d.view;
    services.state.savedId = "";
    services.render();
    return true;
  }
  if (d.basemap) {
    services.state.basemap = d.basemap;
    services.render();
    return true;
  }
  if (d.areatype) {
    if (services.state.F.areaType !== d.areatype) {
      services.state.F.areaType = d.areatype;
      services.state.F.areas = [];
      services.state.drill = null;
      services.state.savedId = "";
    }
    services.render();
    return true;
  }
  if (d.boundary) {
    if (services.state.F.boundary !== d.boundary) {
      services.state.F.boundary = d.boundary;
      services.state.F.areas = [];
      services.state.drill = null;
      services.state.savedId = "";
    }
    services.render();
    return true;
  }
  return false;
}

function selectReportDrill(services, d) {
  if (d.drill) {
    const parts = d.drill.split(":"),
      res = services.state.rep && services.state.rep.res;
    if (!res) return true;
    const row = parts[0] === "t" ? res.total : res.rows[+parts[0]].cells || res.rows[+parts[0]],
      x = row && row[+parts[1]];
    if (!x || !x.ids) return true;
    const first = typeof row[0] === "string" ? row[0] : (row[0] && row[0].text) || "";
    services.state.drill = { at: d.drill, ids: x.ids, title: res.list ? "Referred cases" : first + ", " + res.cols[+parts[1]].toLowerCase() };
    services.render();
    const p = document.getElementById("drill");
    if (p && p.scrollIntoView) p.scrollIntoView({ block: "start" });
    return true;
  }
  return false;
}

function openReportSubject(services, d) {
  if (d.case) {
    services.openCase(d.case);
    return true;
  }
  if (d.writer) {
    services.openInWriter(d.writer);
    return true;
  }
  if (d.owner) {
    services.state.screen = "owner";
    services.state.own = { q: "", key: d.owner };
    services.state.drill = null;
    services.render();
    window.scrollTo(0, 0);
    return true;
  }
  return false;
}

function dispatchReportActions(services, d) {
  const a = d.act;
  if (dispatchReportFileAction(services, a)) return true;
  if (a === "closeDrill") {
    services.state.drill = null;
    services.render();
    return true;
  }
  if (a === "clearOwner") {
    services.state.F.owner = "";
    services.render();
    return true;
  }
  if (a === "clearFilters") {
    Object.assign(services.state.F, {
      from: services.TODAY.slice(0, 4) + "-01-01",
      to: services.TODAY,
      asOf: services.TODAY,
      areaType: "district",
      boundary: "current",
      areas: [],
      inspector: "",
      vtype: "",
      ord: "",
      status: "",
      owner: "",
    });
    services.state.dateMode = "fixed";
    services.state.tableSort = null;
    services.state.savedId = "";
    services.state.drill = null;
    services.render();
    return true;
  }
  if (a === "useOwner") {
    services.state.F.owner = services.state.own.key;
    services.state.screen = "allCases";
    services.state.savedId = "";
    services.state.drill = null;
    services.render();
    window.scrollTo(0, 0);
    return true;
  }
  if (a === "propGo") {
    const q = (document.getElementById("pv-q") || {}).value || "";
    services.state.prop = { q: q, hits: services.propertyHits(q) };
    services.render();
    return true;
  }
  if (a === "ownGo") {
    const q = (document.getElementById("ow-q") || {}).value || "";
    services.state.own = { q: q, key: "" };
    services.render();
    return true;
  }
  return false;
}

/* Construction reads nothing; core retains the original listener registration position. */
export function createReportNavigation(services) {
  return (e) => {
    const t =
      e.target.closest &&
      e.target.closest(
        "[data-screen],[data-view],[data-act],[data-drill],[data-case],[data-writer],[data-owner],[data-areatype],[data-boundary],[data-basemap],[data-period]",
      );
    if (!t) return;
    const d = t.dataset;
    if (selectReportPeriod(services, d)) return;
    if (selectReportView(services, d)) return;
    if (selectReportDrill(services, d)) return;
    if (openReportSubject(services, d)) return;
    if (dispatchReportActions(services, d)) return;
  };
}
