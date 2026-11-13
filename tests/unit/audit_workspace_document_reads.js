/* Large Workspace calculations must share one operation-local document grouping, without retaining stale facts. */
const assert = require("node:assert/strict"),
  path = require("node:path"),
  esbuild = require("esbuild");

(async () => {
  const root = path.resolve(__dirname, "../.."),
    built = await esbuild.build({
      stdin: {
        contents: [
          'export {WriterState} from "./state.js";',
          'export {createWorkspaceScreen} from "./workspace_screen.js";',
          'export {createWorkspaceTasks} from "./workspace_tasks.js";',
          'export {createCaseStatus} from "./case_status.js";',
          'export {createWorksheetWorkflow} from "./worksheet_workflow.js";',
          'export {docsFor,sourceDocFor,groupCaseDocuments} from "./writer_queries.js";',
          'export {caseNumberAllowed} from "./case_records.js";',
          'export {pdfTransferState} from "./pdf_artifacts.js";',
          'export {esc} from "./presentation_format.js";',
        ].join("\n"),
        resolveDir: path.join(root, "app/modules"),
      },
      bundle: true,
      write: false,
      format: "cjs",
      plugins: [
        {
          name: "data",
          setup(build) {
            build.onResolve({ filter: /\/data\// }, (a) => ({ path: path.join(root, "build/generated/modules/data", path.basename(a.path)) }));
          },
        },
      ],
    });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const api = box.exports,
    s = api.WriterState,
    snow = { isCase: () => false };
  Object.assign(s, {
    CASES: [],
    DOCS: [],
    REINSP: [],
    EVENTS: {},
    PENDING: [],
    RECORD_ATTEMPTS: {},
    SAVE_CHECKPOINTS: {},
    WORK: { entry: {}, recordForms: {} },
    ARTIFACT_LOCATIONS: {},
    ARTIFACT_VERIFY: {},
    ARTIFACT_IDENTITY: {},
    state: { screen: "cases", caseFilter: "all", caseQ: "", caseInspector: "", metric: "" },
  });
  let reads = 0;
  for (let n = 0; n < 500; n++) {
    const id = "large-" + n;
    s.CASES.push({
      id,
      number: "CB2026-100-" + String(n).padStart(5, "0"),
      address: n + " EXAMPLE ST",
      owner: "SYNTHETIC",
      inspectorId: "i4",
      date: "2026-01-02",
    });
    for (let q = 0; q < 4; q++) {
      let cid = id;
      s.DOCS.push({
        id: id + "-doc-" + q,
        get caseId() {
          reads++;
          return cid;
        },
        set caseId(value) {
          cid = value;
        },
        type: "notice",
        draft: q === 0,
        mailed: "2026-01-03",
        filedAt: "2026-01-04",
        cits: {},
        items: [{ id: id + "-item-" + q, no: "1", title: "Retained wording", due: "2027-01-01", sections: [] }],
      });
    }
  }
  const worksheets = api.createWorksheetWorkflow({ sourceDocFor: api.sourceDocFor }),
    status = api.createCaseStatus({ snow, today: new Date("2026-11-06T12:00:00Z"), unissuedVisitFor: worksheets.unissuedVisitFor }),
    tasks = api.createWorkspaceTasks({ fmtDate: (d) => d, hasSetupWork: () => false, depositComplete: () => true }),
    context = {
      ...api,
      snow,
      recordIntegrity: { status: () => ({ valid: true, label: "Unchecked shared proof" }) },
      ARTIFACT_LOCATIONS: s.ARTIFACT_LOCATIONS,
    },
    screen = api.createWorkspaceScreen({
      caseState: status.caseState,
      workspaceTasks: tasks.workspaceTasks,
      app_workspacequeueContext: () => context,

      shell: (title, sub, actions, body) => body,
      openCasesCard: () => "",
      recoveryStatusHTML: () => "",
      remindersPanel: () => "",
    });
  const first = screen.screenCases(),
    firstReads = reads;
  assert.equal((first.match(/data-queue-case=/g) || []).length, 500);
  assert.equal((first.match(/data-open="large-/g) || []).length >= 2000, true);
  assert.ok(firstReads <= s.DOCS.length * 8, "Workspace must group documents once, rather than scan the full document list per case: " + firstReads);
  assert.deepEqual(
    api
      .groupCaseDocuments(s.DOCS)("large-0")
      .map((d) => d.id),
    ["large-0-doc-0", "large-0-doc-1", "large-0-doc-2", "large-0-doc-3"],
    "operation grouping preserves source document order; the read-only history presenter owns display sorting",
  );
  assert.ok(first.includes('aria-label="Issued documents for 0 EXAMPLE ST'), "each case exposes its full document history");
  const original = s.DOCS;
  s.DOCS = [{ ...original[0], id: "replacement-draft", pendingAmendment: { recordKey: "new-attempt" } }];
  reads = 0;
  const replaced = screen.screenCases();
  assert.ok(replaced.includes('data-open="replacement-draft"'));
  assert.ok(!replaced.includes('data-open="large-0-doc-3"'), "a new render cannot retain removed documents");
  assert.ok(replaced.includes("Confirm document save"), "new save holds reach queue precedence immediately");
  assert.ok(reads <= 8, "replaced arrays do not reuse the previous grouping");
  s.DOCS[0].caseId = "large-1";
  s.DOCS[0].id = "moved-draft";
  const moved = screen.screenCases();
  assert.ok(moved.includes('data-open="moved-draft"'));
  assert.ok(!moved.includes('data-open="replacement-draft"'), "in-place edits are read on the next calculation");
  assert.equal(api.docsFor("large-0").length, 0);
  assert.equal(status.caseState(s.CASES[1]).pendingDoc.id, "moved-draft", "standalone queries retain live defaults");
  const failed = api.createWorkspaceScreen({
    caseState() {
      throw Error("synthetic interrupted calculation");
    },
  });
  assert.throws(() => failed.screenCases(), /interrupted calculation/);
  s.DOCS = original;
  reads = 0;
  assert.equal(screen.screenCases(), first, "failed/intervening calculations cannot leave a cached grouping");
  assert.ok(reads <= s.DOCS.length * 8);
  console.log(
    JSON.stringify({
      passed: true,
      cases: 500,
      documents: 2000,
      documentIdentityReads: firstReads,
      boundedReads: true,
      liveReplacementAndMutation: true,
      failureIsolation: true,
    }),
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
