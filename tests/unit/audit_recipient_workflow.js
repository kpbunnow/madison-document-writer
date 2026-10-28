const { serviceComposition } = require("../fixtures/deferred_service_syntax.cjs");
/* Independent postal formatting and recipient workflow; retain normalization and correction scope. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
const root = path.resolve(__dirname, "../.."),
  dir = path.join(root, "app/modules"),
  parse = (n) => acorn.parse(fs.readFileSync(path.join(dir, n + ".js"), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
function walk(n, f) {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) return n.forEach((x) => walk(x, f));
  f(n);
  Object.values(n).forEach((x) => walk(x, f));
}
const used = new Set();
walk(parse("recipient_workflow"), (n) => {
  if (n.type === "MemberExpression" && n.object.name === "services") {
    assert.equal(n.computed, false);
    used.add(n.property.name);
  }
});
assert.deepEqual([...used].sort(), ["addressParser", "render"]);
const entries = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []),
  e = entries.find((n) => n.id.name === "recipientWorkflow");
assert.equal(e.init.callee.name, "createRecipientWorkflow");
assert.deepEqual(
  serviceComposition(e.init.arguments[0]).properties.map((p) => p.key.name),
  ["addressParser", "render"],
);
assert.equal(serviceComposition(e.init.arguments[0]).properties[0].value.body.body[0].argument.name, "addressParser");
assert.equal(serviceComposition(e.init.arguments[0]).properties[1].value.body.callee.name, "render");
assert.ok(entries.indexOf(e) > entries.findIndex((n) => n.id.name === "addressParser"));
assert.ok(entries.indexOf(e) < entries.findIndex((n) => n.id.name === "reinspection"));
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents:
        "export * from './address_format.js';export {createRecipientWorkflow} from './recipient_workflow.js';export {WriterState} from './state.js';",
      resolveDir: dir,
    },
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
  const { standardStreetAddress: street, standardCityStateZip: city, addressProblem, createRecipientWorkflow, WriterState: s } = box.exports;
  assert.deepEqual(s, {});
  createRecipientWorkflow(new Proxy({}, { get: (_, k) => assert.fail("construction reads " + String(k)) }));
  assert.deepEqual(s, {});
  for (const [v, w] of [
    [" 123 north MAIN street, apartment 2 ", "123 N Main St Apt 2"],
    ["12B McFarland road", "12B McFarland Rd"],
    ["123-125 west o'brien avenue", "123-125 W O'Brien Ave"],
    ["PO BOX 12", ""],
    ["Main St", ""],
    ["123 Main St, Madison WI", ""],
    ["", ""],
  ])
    assert.equal(street(v), w);
  for (const [v, w] of [
    ["madison wisconsin 53703", "Madison, WI 53703"],
    ["madison, wi 537031234", "Madison, WI 53703-1234"],
    ["charleston west virginia 25301", "Charleston, WV 25301"],
    ["McFarland WI 53558", "McFarland, WI 53558"],
    ["Madison, W 53703", ""],
    ["Madison WI", ""],
    ["", ""],
  ])
    assert.equal(city(v), w);
  assert.equal(addressProblem("Owner", "123 Main St", "Madison WI 53703"), "");
  assert.equal(addressProblem("", "123 Main St", "Madison WI 53703"), "Enter the recipient name.");
  assert.match(addressProblem("Owner", "bad", "Madison WI 53703"), /street address/);
  assert.match(addressProblem("Owner", "123 Main St", "bad"), /complete state/);
  const copy = (x) => JSON.parse(JSON.stringify(x));
  let calls = [],
    fault = null,
    accepted = false,
    renderCalls = 0,
    parser = {
      fault: (k) => {
        calls.push(["fault", k]);
        return fault;
      },
      accepted: (meta, lines) => {
        calls.push(["accepted", meta, lines]);
        return accepted && meta?.accepted;
      },
    };
  const ui = createRecipientWorkflow({
      get addressParser() {
        return parser;
      },
      render: () => {
        renderCalls++;
        assert.equal(s.DIRTY, true);
      },
    }),
    valid = () => ({ name: "  Copy Name ", addr: " 123 north MAIN street ", city: "madison wisconsin 53703" });
  let k = {
    id: "c",
    ccList: [valid(), { name: "", addr: "", city: "" }],
    agent: { name: " Agent ", addr: "124 south main avenue", city: "madison wi 53703" },
  };
  let before = copy(k);
  assert.equal(ui.validateAndStandardizeAddresses(k, false, false), null);
  assert.deepEqual(k, before);
  assert.equal(calls[0][0], "fault");
  assert.equal(ui.validateAndStandardizeAddresses(k), null);
  assert.deepEqual(k.ccList[0], { name: "Copy Name", addr: "123 N Main St", city: "Madison, WI 53703" });
  assert.deepEqual(k.agent, { name: "Agent", addr: "124 S Main Ave", city: "Madison, WI 53703" });
  assert.deepEqual(k.ccList[1], { name: "", addr: "", city: "" });
  fault = { message: "retained parser fault", scope: "owner" };
  before = copy(k);
  assert.equal(ui.validateAndStandardizeAddresses(k), fault);
  assert.deepEqual(k, before);
  fault = null;
  for (const [entry, field] of [
    [{ name: "", addr: "123 Main St", city: "Madison WI 53703" }, "name"],
    [{ name: "Owner", addr: "bad", city: "Madison WI 53703" }, "addr"],
    [{ name: "Owner", addr: "123 Main St", city: "bad" }, "city"],
  ]) {
    k = { ccList: [valid(), entry] };
    before = copy(k);
    const f = ui.validateAndStandardizeAddresses(k);
    assert.equal(f.scope, "copy");
    assert.equal(f.index, 1);
    assert.equal(f.field, field);
    assert.equal(f.selector, '[data-cc="1|' + field + '"]');
    assert.deepEqual(k, before, "later invalid recipient must not normalize earlier copies");
  }
  k = { ccList: [valid()], agent: { name: "Agent", addr: "bad", city: "Madison WI 53703" } };
  before = copy(k);
  assert.equal(ui.validateAndStandardizeAddresses(k).scope, "agent");
  assert.deepEqual(k, before);
  k = { ccList: [] };
  assert.equal(ui.validateAndStandardizeAddresses(k), null);
  assert.equal(ui.validateAndStandardizeAddresses(k, true).field, "name");
  accepted = true;
  k = {
    ccList: [{ name: "Accepted Name", addr: "International street", city: "Foreign postal line", addressParsed: { accepted: true } }],
    agent: { name: "Accepted Agent", addr: "Foreign street", city: "Foreign city", addressParsed: { accepted: true } },
  };
  before = copy(k);
  assert.equal(ui.validateAndStandardizeAddresses(k, true), null);
  assert.deepEqual(k, before);
  assert.equal(ui.recipientPreview(k.ccList[0]), "Accepted mailing lines: International street · Foreign postal line");
  accepted = false;
  assert.equal(ui.recipientPreview(valid()), "Printed as: 123 N Main St · Madison, WI 53703");
  assert.equal(ui.recipientPreview({ addr: "bad", city: "bad" }), "");
  parser = { fault: () => ({ message: "replacement parser" }), accepted: () => false };
  assert.equal(ui.validateAndStandardizeAddresses({}).message, "replacement parser");
  s.CASES = [{ id: "c", ccList: [{ name: "keep" }], emails: [{ addr: "keep@example.test", kind: "Other" }] }];
  s.DOCS = [];
  s.state = { docId: null };
  s.DIRTY = false;
  ui.addCC("c");
  assert.deepEqual(s.CASES[0].ccList, [{ name: "keep" }, { name: "", addr: "", city: "" }]);
  ui.removeCC("c", 0);
  assert.deepEqual(s.CASES[0].ccList, [{ name: "", addr: "", city: "" }]);
  ui.addEmail("c");
  assert.deepEqual(s.CASES[0].emails.at(-1), { addr: "", kind: "Property Owner" });
  ui.removeEmail("c", 0);
  assert.equal(s.CASES[0].emails.length, 1);
  assert.equal(renderCalls, 4);
  const live = s.CASES[0],
    retained = { id: "c", ccList: [], emails: [] };
  s.DOCS = [{ id: "correction", caseId: "c", correction: { case: retained } }];
  s.state.docId = "correction";
  ui.addCC("c");
  ui.addEmail("c");
  assert.equal(retained.ccList.length, 1);
  assert.equal(retained.emails.length, 1);
  assert.equal(live.ccList.length, 1);
  assert.equal(live.emails.length, 1);
  ui.removeCC("c", 0);
  ui.removeEmail("c", 0);
  assert.equal(retained.ccList.length, 0);
  assert.equal(retained.emails.length, 0);
  s.CASES = [{ id: "other", ccList: [], emails: [] }];
  ui.addCC("other");
  assert.equal(s.CASES[0].ccList.length, 1);
  assert.equal(retained.ccList.length, 0);
  s.DOCS = [];
  s.CASES = [{ id: "c", ccList: [] }];
  ui.addCC("c");
  assert.equal(s.CASES[0].ccList.length, 1);
  console.log(
    JSON.stringify({
      passed: true,
      inputs: 2,
      inertConstruction: true,
      postalFormatting: true,
      validationBeforeNormalization: true,
      acceptedMailingLines: true,
      liveAdapters: true,
      correctionScopedRecipientEdits: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
