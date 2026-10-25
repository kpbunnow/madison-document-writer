/* Existing private Reports diagnostics, supplied only to eval-based test harnesses. */
const { bundleSource } = require("./built_bundle.cjs");
function reportsBundleSource(page) {
  return (
    bundleSource(page) +
    "\n" +
    "var { reportCellValue, currentReportRows, reportHelper, ownerKey, ringHas, polyHas, detectField, reportsChannel, getJSON, buildModel } = reportsServices;\nvar { screenFrame, topbar, filtersBar, freshness, reportScreen, filterSummary, cellHTML, tablePanel, drillPanel, caseTable, mapPanel, propertyView, caseCard, ownerView, dataView, crc32, zipStore, colName, sheetXml, sheetName, workbook, exportSheets } = reportsScreens;\n"
  );
}
module.exports = { reportsBundleSource };
