/* Run existing public-owner assertions unchanged against maintained and retained modules. */
require("../fixtures/retained_owner_parity.cjs").compareRetainedOwner("tests/unit/audit_shared_case_storage.js", [
  { source: "app/modules/shared_case_storage.js", reference: "tests/fixtures/shared_case_storage_reference.txt" },
]);
