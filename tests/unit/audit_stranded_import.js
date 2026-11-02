/* A case that exists only as saved details (no document, draft or recorded event), for example after the notice draft
   of a new import was discarded, can start its notice again by importing its Initial Inspection. A case with
   anything issued, drafted or recorded still refuses an Initial Inspection, as before. */
const assert = require("node:assert/strict"),
  path = require("node:path"),
  esbuild = require("esbuild");

async function compile() {
  const build = await esbuild.build({
    stdin: {
      contents: 'export * from "./accela_import.js"; export {WriterState} from "./state.js"; export {INSPECTORS} from "./data/inspectors.js";',
      resolveDir: path.resolve("app/modules"),
    },
    bundle: true,
    write: false,
    format: "cjs",
    plugins: [
      {
        name: "data",
        setup(b) {
          b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.resolve("build/generated/modules/data", path.basename(a.path)) }));
        },
      },
    ],
  });
  const box = { exports: {} };
  new Function("today", "module", "exports", build.outputFiles[0].text)(new Date("2026-10-27T12:00:00Z"), box, box.exports);
  return box.exports;
}

const HEAD = [
  "Case Number",
  "Inspector Name",
  "Site Address",
  "Historic District",
  "Landmark",
  "Parcel Number",
  "Case Description",
  "Owner Name",
  "Owner Address",
  "Inspection Type",
  "Inspection Date",
  "Inspection Status",
  "Inspection Time",
];

(async () => {
  const api = await compile();
  const state = api.WriterState;
  const quiet = (name) => new Proxy(function () {}, { get: () => quiet(name), apply: () => undefined });
  let issued = null;
  const services = new Proxy(
    {
      sourceDocFor: () => issued,
      unissuedVisitFor: () => null,
      caseState: () => ({ closed: false }),
      snow: { isCase: () => false, is: () => false, matchesImport: () => false },
    },
    { get: (target, key) => (key in target ? target[key] : quiet(String(key))) },
  );
  const owner = api.createAccelaImport(services);
  const number = "CB2026-100-00001";
  const plan = (type, status, setup) => {
    const k = {
      id: "c",
      number,
      address: "100 TEST ST",
      owner: "OWNER",
      ownerAddr: ["100 TEST ST", "MADISON WI"],
      date: "2026-10-20",
      time: "09:05",
      inspectorId: api.INSPECTORS[0].id,
    };
    issued = null;
    Object.assign(state, {
      CASES: [k],
      DOCS: [],
      REINSP: [],
      EVENTS: {},
      WORK: { entry: {}, acc: null },
      LOOKUP_BUSY: false,
      ACC_SELECTION_SERIAL: 0,
      DIRTY: false,
    });
    setup?.(state, k);
    const table = owner.accelaTable([
      HEAD,
      [
        number,
        api.INSPECTORS[0].name,
        "100 TEST ST",
        "No",
        "",
        "070913125237",
        "Complaint",
        "OWNER",
        "100 TEST ST\nMADISON WI",
        type,
        46300,
        status,
        "09:05",
      ],
    ]);
    const acc = { fileName: "", cases: table.cases, caseIx: 0, sel: null, manualDate: "", manualTime: "", notes: table.notes, errors: table.errors };
    state.state = { screen: "import", docId: "", acc };
    return owner.baseLookupPlan(acc).blockers;
  };

  assert.deepEqual(plan("Initial Inspection", "Official Notice"), [], "a stranded case can start its notice again");
  assert.ok(
    plan("Reinspection", "Extension Processing").includes("This case has no notice yet. Import its Initial Inspection result to start the notice."),
    "a later inspection points the user to the Initial Inspection",
  );
  const withIssued = (s) => {
    issued = { id: "issued", caseId: "c", type: "notice", draft: false, date: "2026-10-20", items: [], frozen: { case: s.CASES[0] } };
    s.DOCS.push(issued);
  };
  assert.ok(plan("Initial Inspection", "Official Notice", withIssued).length > 0, "an issued document still refuses an Initial Inspection");
  const withDraft = (s) => s.DOCS.push({ id: "dd", caseId: "c", type: "notice", draft: true, items: [] });
  assert.match(plan("Initial Inspection", "Official Notice", withDraft).join(" "), /unfinished work/);
  const withEvent = (s) => {
    s.EVENTS = { c: [{ id: "e1", type: "notice.issued", at: "2026-10-20T10:00:00.000Z" }] };
  };
  assert.ok(plan("Initial Inspection", "Official Notice", withEvent).length > 0, "a recorded event still refuses an Initial Inspection");
  console.log("PASS stranded import case");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
