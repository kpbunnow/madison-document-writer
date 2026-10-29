/* Spreadsheet XML only; screen rendering and workbook download keep their existing owners. */
export function spreadsheetColumnName(i) {
  let s = "";
  i++;
  while (i) {
    const m = (i - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

function spreadsheetShownValue(v) {
  return v == null ? "" : typeof v === "object" ? (v.d ? "00/00/0000" : v.m != null ? "$" + v.m.toFixed(2) : String(v.f)) : String(v);
}

function spreadsheetCellXML(services, widths, opt, ri, ci, v) {
  const r = spreadsheetColumnName(ci) + (ri + 1);
  const shown = spreadsheetShownValue(v);
  widths[ci] = Math.max(widths[ci] || 8, Math.min(60, shown.length + 2));
  if (v == null || v === "") return "";
  if (typeof v === "number") return isFinite(v) ? `<c r="${r}"><v>${v}</v></c>` : "";
  if (typeof v === "object") {
    if (v.d) return services.facts.validISO(v.d) ? `<c r="${r}" s="1"><v>${services.exports.excelDate(v.d)}</v></c>` : "";
    if (v.m != null) return isFinite(v.m) ? `<c r="${r}" s="3"><v>${v.m}</v></c>` : "";
    if (v.f != null) return isFinite(v.f) ? `<c r="${r}" s="4"><v>${Math.round(v.f * 10) / 10}</v></c>` : "";
    return "";
  }
  const bold = (opt.header && ri === 0) || (opt.boldRows && opt.boldRows.indexOf(ri) >= 0);
  return `<c r="${r}" t="inlineStr"${bold ? ' s="2"' : ""}><is><t xml:space="preserve">${services.exports.xesc(v)}</t></is></c>`;
}

export function createSpreadsheetSheet(services) {
  function sheetXml(rows, opt) {
    opt = opt || {};
    const widths = [];
    const body = rows
      .map(
        (row, ri) =>
          '<row r="' + `${ri + 1}` + '">' + "".concat(row.map((v, ci) => spreadsheetCellXML(services, widths, opt, ri, ci, v)).join("")) + "</row>",
      )
      .join("");
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      (opt.header
        ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="' +
          'A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
        : "") +
      (widths.length
        ? "<cols>" + widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("") + "</cols>"
        : "") +
      "<sheetData>" +
      body +
      "</sheetData></worksheet>"
    );
  }
  return sheetXml;
}
