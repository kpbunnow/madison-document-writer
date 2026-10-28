const { withHistoricalState } = require("../fixtures/historical_module_scope.cjs");
/* Exact modal HTML snapshots protect recipient, storage, workspace removal and finalization sections. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild"),
  acorn = require("acorn"),
  fc = require("fast-check");
(async () => {
  const dir = path.resolve("app/modules");
  let source = fs.readFileSync(path.join(dir, "screen_overlays.js"), "utf8");
  const ast = acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" }),
    factory = ast.body.find((n) => n.declaration?.id.name === "createScreenOverlays").declaration,
    ret = factory.body.body.at(-1);
  const reference = require("../fixtures/overlay_screen_reference.cjs").replace("function modalHTML(", "function referenceModal(");
  source =
    source.slice(0, ret.start) +
    reference +
    "\n" +
    source.slice(ret.start).replace("return { overlayHTML }", "return { overlayHTML,actualModal:modalHTML,referenceModal }");
  source += '\nexport {WriterState} from "./state.js";';
  const compiled = await esbuild.build({
    stdin: { contents: withHistoricalState(source), resolveDir: dir },
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
  new Function("module", "exports", compiled.outputFiles[0].text)(box, box.exports);
  const { createScreenOverlays, WriterState: s } = box.exports;
  let flags = {},
    calls = [];
  const methods = {
    sharedChangeModal: () => "<p>Shared</p>",
    reviewModalHTML: () => "<p>Review</p>",
    recoveryModal: () => "<p>Recovery</p>",
    recordActionModal: () => "<p>Record action</p>",
    caseUnsaved: (k) => (flags.risky && Number(k.id.slice(1)) % 2 === 0 ? "Unfinished <&>" : ""),
    recipientPreview: (c) => [c.name, c.addr, c.city].join(" <&> "),
    storageReport: () => "<p>Storage</p>",
    reindexReport: () => "<p>Index</p>",
    CASEDIR_EXPECT: "Case JSON Files",
    today: "2026-10-27",
    checks: () =>
      flags.bad
        ? [
            { ok: false, t: "Blocking <&>" },
            { ok: false, soft: true, t: "Advisory <&>" },
          ]
        : [{ ok: true, t: "Passed" }],
    blockers: () => (flags.bad ? [{ ok: false, t: "Blocking <&>" }] : []),
    correctionDiffHTML: () => "<p>Correction</p>",
    checkRowHTML: (c, ix) => '<p data-check="' + ix + '">' + c.t + "</p>",
    initialCitations: { enabled: () => flags.initial },
  };
  const api = createScreenOverlays(
    new Proxy(methods, {
      get(target, key) {
        calls.push(key);
        return target[key];
      },
    }),
  );
  function reset() {
    const kase = {
      id: "c0",
      number: "CB2026-100-00001",
      address: "100 TEST <&> ST",
      owner: flags.company ? "SYNTHETIC LLC" : "SYNTHETIC OWNER",
      ccList: flags.recipients ? [{ name: "COPY <&>", addr: "100 TEST ST", city: "MADISON WI 53703" }] : [],
      emails: flags.recipients
        ? [
            { kind: "Owner", addr: "synthetic@example.invalid", on: false },
            { kind: "Agent", addr: "agent@example.invalid" },
          ]
        : [],
      agent: { name: "AGENT <&>", addr: "100 TEST ST", city: "MADISON WI 53703" },
    };
    Object.assign(s, {
      state: {
        docId: "d",
        sendDoc: "d",
        modal: flags.modal,
        ccProblem: flags.bad ? { scope: "copy", index: 0, field: "addr", message: "Check <&>" } : null,
        folder: flags.recipients ? [{ name: "TEST <&>.json", size: 100, lastModified: 0 }] : [],
        folderQ: flags.query,
        folderError: flags.bad ? "Error <&>" : "",
        reindex: { running: flags.busy },
        publicationBusy: flags.busy,
      },
      DOCS: [
        {
          id: "d",
          caseId: "c0",
          type: flags.company ? "citation" : "notice",
          items: [],
          mailed: "2026-10-27",
          emailSelection: [],
          correction: flags.correction ? { case: kase, reason: "Correct <&>", reviewed: flags.bad } : null,
        },
      ],
      CASES: Array.from({ length: flags.count }, (_, i) => ({ ...kase, id: "c" + i })),
      HELPER: flags.helper ? { chrome: true, outlook: flags.outlook } : null,
      CASEDIR: flags.folder ? { helper: flags.helper } : null,
      DIRNAME: "Other <&>",
      AMENDMENT_BUSY: false,
    });
  }
  let checked = 0;
  function run(fn) {
    reset();
    calls = [];
    try {
      return { html: fn(), state: JSON.stringify(s), calls: calls.slice() };
    } catch (error) {
      return { error: { name: error.name, message: error.message }, state: JSON.stringify(s), calls: calls.slice() };
    }
  }
  function compare(options) {
    flags = options;
    const expected = run(api.referenceModal),
      actual = run(api.actualModal);
    assert.deepEqual(actual, expected, JSON.stringify(flags));
    assert.equal(typeof actual.html, "string", "each modal snapshot renders successfully");
    checked++;
  }
  const modals = [
      "shared-change",
      "review",
      "recovery",
      "void",
      "recordnote",
      "reconcile",
      "sendto",
      "cc",
      "clear",
      "storage",
      "folder",
      "final",
      "unknown",
    ],
    defaults = {
      modal: "final",
      company: false,
      recipients: false,
      bad: false,
      busy: false,
      correction: false,
      count: 1,
      risky: false,
      folder: false,
      helper: false,
      outlook: false,
      initial: false,
      query: "",
    };
  for (const modal of modals) for (const recipients of [false, true]) compare({ ...defaults, modal, recipients });
  fc.assert(
    fc.property(
      fc.record({
        modal: fc.constantFrom(...modals),
        company: fc.boolean(),
        recipients: fc.boolean(),
        bad: fc.boolean(),
        busy: fc.boolean(),
        correction: fc.boolean(),
        count: fc.integer({ min: 1, max: 20 }),
        risky: fc.boolean(),
        folder: fc.boolean(),
        helper: fc.boolean(),
        outlook: fc.boolean(),
        initial: fc.boolean(),
        query: fc.constantFrom("", "TEST", "missing"),
      }),
      compare,
    ),
    { seed: 20261027, numRuns: 1000 },
  );
  console.log("PASS exact overlay HTML snapshots", checked, "recipient/storage/final/correction states");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
