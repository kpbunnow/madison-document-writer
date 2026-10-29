/* Preserve every existing Workspace task assertion through the actual public owner. */
require("../fixtures/retained_owner_parity.cjs").compareRetainedOwner("tests/unit/audit_workspace_tasks.js", [
  { source: "app/modules/workspace_tasks.js", reference: "tests/fixtures/workspace_tasks_reference.txt" },
]);
