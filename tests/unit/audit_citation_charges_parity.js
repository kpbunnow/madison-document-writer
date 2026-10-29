/* Preserve all original charge-change and correction-basis assertions through the public owner. */
require("../fixtures/retained_owner_parity.cjs").compareRetainedOwner("tests/unit/audit_citation_charges.js", [
  { source: "app/modules/citation_charges.js", reference: "tests/fixtures/citation_charges_reference.txt" },
]);
