/* Existing recovery assertions run unchanged against both owners. */
require("../fixtures/retained_owner_parity.cjs").compareRetainedOwner("tests/unit/audit_case_recovery.js", [
  { source: "app/modules/case_recovery.js", reference: "tests/fixtures/case_recovery_reference.txt" },
]);
