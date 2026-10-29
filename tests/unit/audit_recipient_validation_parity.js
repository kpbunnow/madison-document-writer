/* Existing public-owner assertions run unchanged against both implementations. */
require("../fixtures/retained_owner_parity.cjs").compareRetainedOwner("tests/unit/audit_recipient_workflow.js", [
  { source: "app/modules/recipient_workflow.js", reference: "tests/fixtures/recipient_workflow_reference.txt" },
]);
