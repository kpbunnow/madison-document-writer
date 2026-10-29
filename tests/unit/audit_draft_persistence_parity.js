/* Run existing public-owner assertions unchanged against maintained and retained modules. */
require("../fixtures/retained_owner_parity.cjs").compareRetainedOwner("tests/unit/audit_workspace_storage.js", [
  { source: "app/modules/draft_persistence.js", reference: "tests/fixtures/draft_persistence_reference.txt" },
]);
