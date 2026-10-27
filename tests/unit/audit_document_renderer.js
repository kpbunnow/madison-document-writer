const { serviceComposition } = require("../fixtures/deferred_service_syntax.cjs");
/* Rendering must load without Writer, use only explicit services and preserve retained document facts. */
const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const acorn = require("acorn");
const walk = {
  simple(node, visitors) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((child) => walk.simple(child, visitors));
      return;
    }
    visitors[node.type]?.(node);
    Object.values(node).forEach((child) => walk.simple(child, visitors));
  },
};
const esbuild = require("esbuild");
const { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "../..");
const directory = path.join(root, "app/modules");
const owners = { document_render: "createDocumentRenderer" };
const parse = (name) => acorn.parse(fs.readFileSync(path.join(directory, name + ".js"), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
const core = parse("app_core");
const composition = new Map();
for (const statement of core.body) {
  const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
  for (const d of declaration?.declarations || []) {
    if (Object.values(owners).includes(d.init?.callee?.name)) composition.set(d.init.callee.name, d.init);
  }
}
assert.deepEqual([...composition.keys()], Object.values(owners), "preserve service initialization order");
for (const [owner, factory] of Object.entries(owners)) {
  const required = new Set();
  walk.simple(parse(owner), {
    MemberExpression(n) {
      if (n.object.name === "services") {
        assert.equal(n.computed, false, "service dependencies are statically named");
        required.add(n.property.name);
      }
    },
  });
  const call = composition.get(factory);
  assert.equal(call.arguments.length, 1);
  const properties = serviceComposition(call.arguments[0]).properties;
  assert.deepEqual(new Set(properties.map((p) => p.key.name)), required, owner + " has exactly its required interface");
  for (const p of properties) {
    assert.equal(p.type, "Property", "no spread registry");
    if (p.kind === "get") {
      assert.equal(p.value.body.body.length, 1);
      assert.equal(p.value.body.body[0].argument.name, p.key.name);
    } else {
      assert.equal(p.value.type, "ArrowFunctionExpression", "do not capture dependencies during construction");
      assert.equal(p.value.body.type, "CallExpression");
      assert.equal(p.value.body.callee.name, p.key.name);
    }
  }
}
(async () => {
  const compiled = await esbuild.build({
    stdin: {
      contents: "export { createDocumentRenderer } from './document_render.js'; export { WriterState } from './state.js';",
      resolveDir: directory,
    },
    bundle: true,
    format: "cjs",
    write: false,
    plugins: [
      {
        name: "data",
        setup(build) {
          build.onResolve({ filter: /\/data\// }, (args) => ({ path: path.join(root, "build/generated/modules/data", path.basename(args.path)) }));
        },
      },
    ],
  });
  const box = { exports: {} };
  new Function("module", "exports", compiled.outputFiles[0].text)(box, box.exports);
  const { createDocumentRenderer, WriterState } = box.exports;
  assert.deepEqual(WriterState, {}, "importing renderers must not start Writer");
  const unavailable = new Proxy(
    {},
    {
      get(_, key) {
        throw new Error("eager render dependency: " + String(key));
      },
    },
  );
  createDocumentRenderer(unavailable);
  assert.deepEqual(WriterState, {}, "constructing renderers must not read workspace or browser globals");
  const deepFreeze = (value) => {
    if (value && typeof value === "object") {
      Object.values(value).forEach(deepFreeze);
      Object.freeze(value);
    }
    return value;
  };
  const k = {
    id: "case",
    number: "QA-RENDER",
    address: "123 RETAINED ROAD",
    owner: "RETAINED OWNER",
    ownerAddr: ["123 MAILING ROAD", "MADISON WI 53703"],
    date: "2026-10-01",
    time: "09:00",
  };
  let liveCase = { ...k },
    bodies = "<p>Retained body</p>";
  const renderer = createDocumentRenderer({
    fmtDate: (v) => v || "",
    fmtTime: (v) => v || "",
    longDate: (v) => v || "",
    parseTime: (v) => v,
    validISO: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || ""),
    inspAt: () => ({ date: k.date, time: k.time }),
    documentItemHistory: (_, it) => it.hist || [],
    revisionPrintNote: () => "",
    hasItemInspectionHistory: () => false,
    catalogDraftNotice: () => "",
    newDocuments: { rowAffectedSelection: () => false },
    MINDUE: () => "2026-10-01",
    agentLines: () => [],
    ccLines: () => [],
    docBlocks: () => [],
    docBody: () => bodies,
    initialCitations: { enabled: () => false },
    isLocked: (d) => !d.draft,
    snow: { is: () => false },
    structEditable: () => false,
    docCase: (d) => d.frozen?.case || liveCase,
    docInsp: (d) => d.frozen?.inspector || {},
    eventsFor: () => [],
  });
  const citation = deepFreeze({
    id: "citation",
    caseId: k.id,
    type: "citation",
    authoringVersion: 16,
    mailed: "2026-10-02",
    items: [{ id: "item", no: "1", cite: true, sections: ["27.05"], title: "Retained item", text: "Repair retained item.", due: "2026-10-15" }],
    cits: {
      item: {
        num: "B12345678901",
        amount: "100.00",
        ord: "27.05",
        issued: "2026-10-02",
        courtDate: "2026-11-18",
        courtTime: "09:00",
        comment: "Retained observation",
      },
    },
    frozen: { case: { ...k }, inspector: { name: "RETAINED INSPECTOR", badge: "42" } },
  });
  const before = JSON.stringify(citation),
    packet = renderer.citationFaces(citation, false);
  const dom = new JSDOM(packet),
    pages = [...dom.window.document.querySelectorAll("section.cit")];
  assert.equal(pages.length, 4);
  for (const label of ["COURT COPY", "AGENCY COPY", "INSPECTOR COPY", "DEFENDANT'S COPY"])
    assert.ok(dom.window.document.body.textContent.toUpperCase().includes(label), label);
  assert.equal(new Set(pages.map((p) => p.innerHTML)).size, 4, "court copies retain distinct content");
  assert.equal(dom.window.document.querySelector('[contenteditable="true"]'), null, "citation copies remain locked");
  assert.equal(renderer.citAmount(citation, citation.items[0]), "$100.00");
  const authored = renderer.documentHTML(citation);
  liveCase = { ...liveCase, owner: "LATER OWNER", address: "999 LATER ROAD" };
  assert.equal(renderer.documentHTML(citation), authored, "later live facts do not replace supplied frozen facts");
  assert.equal(JSON.stringify(citation), before, "rendering never changes issued evidence");
  const held = { ...citation, draft: true, cits: { item: { ...citation.cits.item, mandatoryAppearance: true } } };
  assert.match(renderer.citationFaces(held, true), /on hold until the division approves defendant instructions/);
  const missing = { ...citation, cits: { item: { ...citation.cits.item, amount: "" } } };
  assert.match(renderer.citationFaces(missing, true), /Citation needs deposit/);
  const notice = { ...citation, type: "notice", draft: true, frozen: null };
  bodies = "<p>First draft wording</p>";
  assert.ok(renderer.documentHTML(notice).includes(bodies));
  bodies = "<p>Updated draft wording</p>";
  assert.ok(renderer.documentHTML(notice).includes(bodies), "services are read at render time");
  const historyItem = {
    done: true,
    doneOn: "2026-10-08",
    hist: [
      { on: "2026-10-01", oc: "none" },
      { on: "2026-10-08", oc: "corrected" },
    ],
  };
  assert.match(renderer.referralHistoryHTML({}, historyItem), /Days Outstanding: 7/);
  assert.match(renderer.referralHistoryHTML({}, { ...historyItem, doneOn: "2026-10-09" }), /Days Outstanding: Unavailable/);
  assert.deepEqual(WriterState, {});
  dom.window.close();
  console.log(
    JSON.stringify({
      passed: true,
      isolatedRenderer: true,
      lazyComposition: true,
      fourDistinctCopies: true,
      immutableIssuedFacts: true,
      retainedRefusals: true,
    }),
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
