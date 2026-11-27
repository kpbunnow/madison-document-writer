/* A due date on or before a future mailing date is flagged before issuance (code review 2026-11-27). The helper refuses
   an outstanding due date that is not after the mailing date ("Outstanding items require a future due date",
   publication_validation.py); readiness compared due dates only with today, so a notice mailed up to five days ahead
   with an item due before then passed every check and was refused at save. A document mailed today keeps exactly its
   earlier checks; corrections, Reinspection Notices and undated documents are unchanged. */
const assert = require("node:assert/strict"),
  path = require("node:path"),
  esbuild = require("esbuild");
const root = path.resolve(__dirname, "../.."),
  dir = path.join(root, "app/modules");

(async () => {
  const built = await esbuild.build({
    stdin: { contents: "export {createDocumentReadiness} from './document_readiness.js';export {WriterState} from './state.js';", resolveDir: dir },
    bundle: true,
    format: "cjs",
    write: false,
    plugins: [
      {
        name: "data",
        setup(b) {
          b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.join(root, "build/generated/modules/data", path.basename(a.path)) }));
        },
      },
    ],
  });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const { createDocumentReadiness, WriterState: s } = box.exports;
  let today = "2026-10-26";
  const none = () => [];
  const services = {
    addressProblem: () => "",
    validateAndStandardizeAddresses: () => null,
    correctionChecks: none,
    lifecycleChecks: none,
    authoringChecks: none,
    citationDepositFault: () => "",
    catalogDraftBlocked: () => false,
    initialCitations: { prepare() {}, checks: none },
    newDocuments: { specialChecks: none },
    snow: { is: () => false, checks: none },
    unchangedCorrectionValue: () => false,
    unchangedCourtDate: () => false,
    attachCheckTargets: (d, c) => c,
    get today() {
      return today;
    },
  };
  s.CASES = [
    { id: "c", number: "BI-123", address: "123 Main St", owner: "Test Owner", ownerAddr: ["123 Main St", "Madison WI 53703"], date: "2026-10-20" },
  ];
  s.DOCS = [];
  s.REINSP = [];
  const { checks } = createDocumentReadiness(services);
  const doc = (due, mailed, extra = {}) => ({
    id: "d",
    caseId: "c",
    type: "notice",
    draft: true,
    mailed,
    authoringVersion: 16,
    items: [{ id: "i", no: 1, text: "Repair siding", sections: ["27.05(2)(c)"], due }],
    frozen: { inspector: { name: "Inspector" } },
    ...extra,
  });
  const flagged = (d) => checks(d).find((c) => /on or before the mailing date/.test(c.t));

  // Mailed ahead of today: an item due after today but not after the mailing date is flagged, with its due field.
  for (const due of ["2026-10-28", "2026-10-30"]) {
    const row = flagged(doc(due, "2026-10-30"));
    assert.ok(row && row.ok === false, due);
    assert.equal(row.t, "1 due date is on or before the mailing date (10/30/2026); a due date must come after the date the document is mailed");
    assert.equal(row.targets[0].selector, '[data-id="i"][data-field="due"]');
  }
  assert.equal(flagged(doc("2026-10-31", "2026-10-30")), undefined, "a due date after the mailing date is accepted");
  // Mailed today: the earlier checks are unchanged and no new row appears.
  today = "2026-10-30";
  assert.equal(flagged(doc("2026-10-30", "2026-10-30")), undefined);
  assert.ok(checks(doc("2026-10-30", "2026-10-30")).some((c) => /today or in the past/.test(c.t) && !c.ok));
  today = "2026-10-26";
  // Documents the helper rule does not cover keep their checks.
  assert.equal(flagged(doc("2026-10-28", "2026-10-30", { correction: { case: {} } })), undefined, "a correction keeps its dates");
  assert.equal(flagged(doc("2026-10-28", "2026-10-30", { type: "reinspectionNotice" })), undefined, "a Reinspection Notice keeps its dates");
  assert.equal(flagged(doc("2026-10-28", "2026-10-30", { type: "compliance" })), undefined, "a compliance letter has no due dates");
  console.log("PASS due dates on or before a future mailing date are flagged before issuance");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
