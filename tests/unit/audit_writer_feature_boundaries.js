/* Feature services retain explicit acceptance, authority and historical document guards. */
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
const owners = {
  administration: "initAdministration",
  new_documents: "initNewDocuments",
  address_parser: "initAddressParser",
  test_fixtures: "initTestFixtures",
};
const parse = (name) => acorn.parse(fs.readFileSync(path.join(directory, name + ".js"), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
const core = parse("app_core");
const composition = new Map();
for (const statement of core.body) {
  const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
  for (const d of declaration?.declarations || []) {
    const call = d.init?.type === "ConditionalExpression" ? d.init.consequent : d.init;
    if (Object.values(owners).includes(call?.callee?.name)) composition.set(call.callee.name, call);
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
  const properties = call.arguments[0].properties;
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
      contents:
        Object.entries(owners)
          .map(([file, factory]) => `export { ${factory} } from './${file}.js';`)
          .join("\n") + "\nexport { WriterState } from './state.js';",
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
  const dom = new JSDOM("<main></main>", { url: "http://localhost/" }),
    calls = [];
  const document = dom.window.document,
    register = document.addEventListener.bind(document);
  document.addEventListener = (type, listener, options) => {
    calls.push([type, options === true]);
    register(type, listener, options);
  };
  const box = { exports: {} };
  new Function("module", "exports", "document", "window", compiled.outputFiles[0].text)(box, box.exports, document, dom.window);
  const api = box.exports,
    state = api.WriterState;
  assert.deepEqual(state, {}, "imports must not start Writer or read storage");
  const unavailable = new Proxy(
    {},
    {
      get(_, key) {
        throw new Error("premature dependency: " + String(key));
      },
    },
  );
  for (const factory of Object.values(owners)) api[factory](unavailable);
  assert.deepEqual(state, {});
  assert.deepEqual(
    calls,
    [
      ["click", false],
      ["click", false],
    ],
    "retain administrator/address listener order and phases",
  );
  const fixtureCall = core.body.find((s) => s.declarations?.some((d) => d.id.name === "$testFixtures")).declarations[0].init;
  assert.equal(fixtureCall.test.name, "__TEST_BUILD__");
  assert.equal(fixtureCall.alternate.value, null, "test services stay behind the fixture build flag");
  const k = { id: "case", number: "CB2026-TEST", ownerAddr: ["123 ORIGINAL RD", "MADISON WI 53703"] };
  const d = { id: "draft", caseId: k.id, draft: true, items: [] };
  Object.assign(state, { CASES: [k], DOCS: [d], REINSP: [], EVENTS: {}, state: { docId: d.id, caseId: k.id } });
  let helperCalls = 0,
    saveCalls = 0,
    renderCalls = 0,
    dialogs = [],
    parsedResolve,
    blocked = true;
  const parser = api.initAddressParser({
    recordIntegrity: { blocked: () => blocked },
    helperJSON: () => {
      helperCalls++;
      return new Promise((resolve) => {
        parsedResolve = resolve;
      });
    },
    uid: () => "preview-token",
    toast: () => {},
    saveDrafts: () => saveCalls++,
    render: () => renderCalls++,
    A11Y: { utility: (title, html) => dialogs.push({ title, html }) },
  });
  assert.equal(await parser.preview("owner"), false);
  assert.equal(helperCalls, 0, "blocked records cannot request a preview");
  blocked = false;
  const result = {
    available: true,
    raw: k.ownerAddr.join("\n"),
    type: "street",
    recipientLine: "",
    standardized: ["123 ORIGINAL ROAD", "MADISON WI 53703"],
  };
  const late = parser.preview("owner");
  k.ownerAddr = ["456 EDITED RD", "MADISON WI 53703"];
  parsedResolve(result);
  assert.equal(await late, false);
  assert.equal(dialogs.length, 0);
  assert.equal(saveCalls, 0, "late parsing cannot replace newly typed text");
  k.ownerAddr = ["123 ORIGINAL RD", "MADISON WI 53703"];
  const preview = parser.preview("owner");
  parsedResolve(result);
  assert.equal(await preview, true);
  assert.deepEqual(k.ownerAddr, ["123 ORIGINAL RD", "MADISON WI 53703"], "preview does not accept standardized lines");
  assert.ok(dialogs[0].html.includes('data-accept-address="preview-token"'));
  k.ownerAddr[0] = "789 NEW TEXT";
  assert.equal(parser.accept("preview-token"), false, "acceptance refuses an obsolete raw address");
  k.ownerAddr[0] = "123 ORIGINAL RD";
  assert.equal(parser.accept("preview-token"), true);
  assert.deepEqual(k.ownerAddr, result.standardized);
  assert.equal(saveCalls, 2);
  assert.equal(renderCalls, 1);
  assert.equal(parser.accepted(k.ownerAddressParsed, k.ownerAddr), true);
  assert.equal(parser.accept("preview-token"), false, "an accepted token is spent");
  const admin = api.initAdministration({
    toast: () => {},
    helperJSON: () => {
      throw new Error("no authority request expected");
    },
  });
  await admin.openOverride();
  await admin.openLetter();
  assert.equal(admin.overrideFault({}, d), "");
  const c = {
    num: "B123",
    ord: "27.05",
    issued: "2026-10-01",
    pricedOn: "2026-10-01",
    depositMode: "total",
    amount: "100.00",
    policyVersionHash: "policy",
    tier: 1,
    computedTier: 1,
  };
  c.overrideBasis = {
    version: 1,
    confirmed: true,
    administrator: "QA Administrator",
    reason: "Reviewed source for this exceptional deposit",
    sourceReference: "QA division instruction",
    authorizationId: "a".repeat(32),
    authorizationHash: "b".repeat(64),
    caseNumber: k.number,
    citationNumber: c.num,
    ordinance: c.ord,
    pricingDate: c.pricedOn,
    mode: c.depositMode,
    totalCents: 10000,
    policyVersionHash: c.policyVersionHash,
    approvedTier: 1,
  };
  assert.equal(admin.overrideFault(c, d), "");
  assert.match(admin.overrideFault({ ...c, amount: "101.00" }, d), /no longer matches/);
  assert.match(admin.overrideFault({ ...c, computedTier: 2 }, d), /history changed/);
  assert.match(admin.overrideFault({ ...c, overrideBasis: { ...c.overrideBasis, authorizationHash: "" } }, d), /helper authorization/);
  let locked = false;
  const documents = api.initNewDocuments({ isLocked: () => locked });
  const legacy = { type: "bestInterestExtension", authoringVersion: 13 };
  assert.equal(documents.rowAffectedSelection(legacy), true);
  locked = true;
  assert.equal(documents.rowAffectedSelection(legacy), false);
  locked = false;
  assert.equal(documents.rowAffectedSelection({ ...legacy, correction: {} }), false);
  for (const authoringVersion of [11, 12, 16]) assert.equal(documents.rowAffectedSelection({ ...legacy, authoringVersion }), false);
  const source = { id: "source", caseId: k.id, items: [{ id: "i", no: "1", due: "2026-10-05" }] };
  state.REINSP = [{ id: "visit", sourceDocId: source.id, caseId: k.id, date: "2026-10-10", results: { i: { oc: "corrected" } } }];
  assert.equal(documents.continuingItems(source)[0].doneOn, "2026-10-10");
  state.REINSP = [];
  assert.equal(documents.continuingItems(source)[0].done, undefined, "visit replacement is read at call time");
  assert.equal(source.items[0].done, undefined);
  let minDue = "2026-10-20";
  const fixtures = api.initTestFixtures({ MINDUE: () => minDue });
  assert.equal(fixtures.futureDue("2026-10-01", 7), "2026-10-20");
  minDue = "2026-10-02";
  assert.equal(fixtures.futureDue("2026-10-01", 7), "2026-10-08");
  dom.window.close();
  console.log(
    JSON.stringify({
      passed: true,
      independentFeatures: 4,
      lazyComposition: true,
      retainedListeners: 2,
      explicitAddressAcceptance: true,
      overrideBinding: true,
      historicalSelection: true,
    }),
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
