/* Test-only report-grid loading. Keep the original screen/cancel/table/share/return order and live state lookup. */
function createReportGridLoader({ getState, cancelLookup, readTable, readShare }) {
  return async function loadGrid(b, name) {
    getState().screen = "import";
    cancelLookup();
    const t = readTable(b.grid);
    getState().acc = {
      fileName: name || "",
      errors: t.errors,
      notes: t.notes,
      cases: t.cases,
      caseIx: 0,
      sel: t.cases.length ? t.cases[0].sel : null,
      manualDate: "",
      manualTime: "",
    };
    await readShare();
    return getState().acc;
  };
}
module.exports = { createReportGridLoader };
