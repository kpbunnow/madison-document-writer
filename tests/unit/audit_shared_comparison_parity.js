/* The catalog public-owner suite keeps its assertions against both sources. */
require("../fixtures/retained_owner_parity.cjs").compareRetainedOwner("tests/unit/audit_catalog_service.js", [
  { source: "app/modules/language_catalog.js", reference: "tests/fixtures/language_catalog_reference.txt" },
]);
