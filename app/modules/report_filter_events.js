/* Filter changes retain live state reads and original refusal/dispatch order. */
export function createReportFilterChange(services) {
  return function reportFilterChange(e) {
    const t = e.target,
      F = services.state.F;
    if (t.id === "saved-view") {
      services.applyReportView(t.value);
      return;
    }
    if (t.dataset && t.dataset.area !== undefined) {
      services.state.areasOpen = true;
      services.toggleArea(t.dataset.area);
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
    if ((k === "from" || k === "to" || k === "asOf") && !services.validISO(t.value)) return; // a half-typed date is not a filter
    F[k] = t.value;
    if (["from", "to", "asOf"].includes(k)) services.state.dateMode = "fixed";
    services.state.savedId = "";
    services.state.drill = null;
    services.render();
  };
}
