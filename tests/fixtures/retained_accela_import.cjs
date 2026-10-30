/* The retained pre-change Accela import module with the one intentional change applied: a Reinspection or No Fee
   Reinspection result of a Reinspection is a listed outcome with a Reinspection Notice rule (it stays hidden on every
   other inspection type), and the import notes list it. Each substitution must match exactly once, so nothing else in
   the retained comparison is loosened. */
const assert = require("node:assert/strict"),
  fs = require("node:fs");

function retainedAccelaImport() {
  let source = fs.readFileSync("tests/fixtures/accela_import_reference.txt", "utf8");
  const change = (from, to) => {
    assert.equal(source.split(from).length, 2, "retained original carries exactly once: " + from.slice(0, 80));
    source = source.replace(from, to);
  };
  change(
    '    referralUpdate: { doc: "referralUpdate", label: "Update for Case Referral", needsReferral: true },\n  };',
    '    referralUpdate: { doc: "referralUpdate", label: "Update for Case Referral", needsReferral: true },\n    reinspectionNotice: { doc: "reinspectionNotice", label: "Reinspection Notice" },\n  };',
  );
  change(
    '      "no fee no occupancy": RULE.noOccupancy,\n    },\n    caReinspection',
    '      "no fee no occupancy": RULE.noOccupancy,\n      reinspection: RULE.reinspectionNotice,\n      "no fee reinspection": RULE.reinspectionNotice,\n    },\n    caReinspection',
  );
  change(
    'new Set(["scheduled", "pending", "completed", "inspection", "no violation", "reinspection", "no fee reinspection"]);',
    'new Set(["scheduled", "pending", "completed", "inspection", "no violation"]);\n  const REINSPECTION_RESULTS = new Set(["reinspection", "no fee reinspection"]);',
  );
  change(
    '    if (HIDDEN_STATUSES.has(key)) return key === "scheduled" ? "scheduled" : "notDone";',
    '    if (HIDDEN_STATUSES.has(key) || (REINSPECTION_RESULTS.has(key) && inspectionKind(type) !== "reinspection"))\n      return key === "scheduled" ? "scheduled" : "notDone";',
  );
  change(
    "No Occupancy or No Fee No Occupancy; a CA Reinspection",
    "No Occupancy, No Fee No Occupancy, Reinspection or No Fee Reinspection (a Reinspection Notice); a CA Reinspection",
  );
  change(
    '"Completed, Inspection, No Violation, Reinspection, No Fee Reinspection, an " +',
    '"Completed, Inspection, No Violation, Reinspection or No Fee Reinspection on any type other than a Reinspection, an " +',
  );
  return source;
}

module.exports = { retainedAccelaImport };
