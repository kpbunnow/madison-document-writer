/* Preserve the original validation/refusal, device-write, integrity and replacement assertions. */
require("../fixtures/retained_owner_parity.cjs").compareRetainedOwner("tests/unit/audit_workspace_backup.js", [
  { source: "app/modules/workspace_backup.js", reference: "tests/fixtures/workspace_backup_reference.txt" },
]);
