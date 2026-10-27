const { serviceComposition } = require("../fixtures/deferred_service_syntax.cjs");
/* Scoped service composition must remain lazy, ordered and safe across asynchronous navigation. */
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
  snow_cases: "initSnow",
  citation_pricing: "initCitationPricing",
  deposit_step: "initDepositStep",
  initial_citations: "initInitialCitations",
  navigation: "initNavigation",
  language_actions: "createLanguageActions",
};
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
  const dom = new JSDOM('<main class="main"><div class="content"><h1>Workspace</h1></div></main>', { url: "http://localhost/" });
  dom.window.scrollTo = () => {};
  const registrations = [];
  const original = dom.window.document.addEventListener.bind(dom.window.document);
  dom.window.document.addEventListener = (type, listener, options) => {
    registrations.push([type, options === true]);
    original(type, listener, options);
  };
  const box = { exports: {} };
  new Function("module", "exports", "document", "window", compiled.outputFiles[0].text)(box, box.exports, dom.window.document, dom.window);
  const api = box.exports,
    state = api.WriterState;
  assert.deepEqual(state, {}, "importing service owners must not initialize Writer");
  const unavailable = new Proxy(
    {},
    {
      get(_, key) {
        throw new Error("eager service read: " + String(key));
      },
    },
  );
  for (const factory of Object.values(owners)) api[factory](unavailable);
  assert.deepEqual(
    registrations,
    [
      ["click", false],
      ["change", false],
      ["input", false],
      ["change", false], // snow
      ["click", false], // pricing
      ["input", false],
      ["change", false],
      ["submit", false],
      ["click", false], // deposits
    ],
    "preserve existing feature listener order and capture phases",
  );
  assert.deepEqual(state, {}, "constructing services must not initialize or restore shared state");
  Object.assign(state, { state: { screen: "cases" }, CASES: [], DOCS: [], REINSP: [], EVENTS: {}, LOCAL_CHANGED: 0 });
  let resolveReady,
    readinessReads = 0,
    captures = 0,
    cancels = 0,
    renders = 0;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });
  let save = async () => true;
  const nav = api.initNavigation({
    get WRITER_READY_WAIT() {
      readinessReads++;
      return ready;
    },
    saveDrafts: () => save(),
    captureWork: () => captures++,
    cancelCaseLookup: () => cancels++,
    render: () => renders++,
    toast: () => {},
  });
  assert.equal(readinessReads, 0);
  const waiting = nav.navigate("tools");
  assert.equal(readinessReads, 1);
  assert.equal(captures, 0, "do not capture before restoration is ready");
  state.WRITER_READY = true;
  resolveReady();
  assert.equal(await waiting, true);
  assert.equal(state.state.screen, "tools");
  assert.equal(captures, 1);
  assert.equal(cancels, 1);
  save = async () => false;
  assert.equal(await nav.navigate("library"), false);
  assert.equal(state.state.screen, "tools", "a failed device save must keep the current screen");
  assert.ok(dom.window.document.getElementById("navigation-save-failure"));
  const pending = [];
  save = () => new Promise((resolve) => pending.push(resolve));
  const stale = nav.navigate("library"),
    current = nav.navigate("cases");
  pending[1](true);
  assert.equal(await current, true);
  pending[0](true);
  assert.equal(await stale, false);
  assert.equal(state.state.screen, "cases", "a late save must not navigate to an obsolete route");
  assert.equal(renders, 2);
  let saves = 0;
  save = async () => {
    if (++saves === 1) state.LOCAL_CHANGED += 2;
    return true;
  };
  assert.equal(await nav.navigate("tools"), true);
  assert.equal(saves, 2, "save edits made while the previous save was pending");
  const context = nav.utilityContext();
  nav.invalidateUtilities();
  assert.equal(nav.utilityCurrent(context), false);
  let leaveCalls = 0;
  const language = api.createLanguageActions({
    get navigation() {
      return {
        leave: async (action) => {
          leaveCalls++;
          action();
        },
      };
    },
    render: () => renders++,
  });
  const button = dom.window.document.createElement("button");
  button.dataset.languageMode = "admin";
  await language({ target: button });
  assert.equal(leaveCalls, 1);
  assert.equal(state.state.screen, "library");
  assert.equal(state.state.languageMode, "admin");
  const initialCalls = [];
  const initial = api.initInitialCitations({
    get libraryReview() {
      return { refresh: () => initialCalls.push("review") };
    },
    get citationPricing() {
      return { refresh: () => initialCalls.push("price") };
    },
    uid: () => "initial-citation-id",
  });
  const notice = {
    type: "notice",
    draft: true,
    authoringVersion: 16,
    items: [{ id: "i", cite: true, sections: ["27.05"] }],
    depositRequests: { i: {} },
  };
  initial.prepare(notice);
  assert.deepEqual(initialCalls, ["review", "price"]);
  assert.equal(notice.initialCitationId, "initial-citation-id");
  assert.equal(notice.authoringVersion, 16);
  assert.deepEqual(notice.cits, {}, "unfinished deposit remains a request, not a blank citation");
  let pricingCalls = 0;
  const pricing = api.initCitationPricing({
    isLocked: () => false,
    libraryReview: { refresh: () => pricingCalls++ },
    snow: { prepare: () => pricingCalls++ },
  });
  pricing.refresh({ draft: false });
  pricing.refresh({ draft: true, pendingAmendment: {} });
  assert.equal(pricingCalls, 0, "issued and pending snapshots must not refresh");
  pricing.refresh({ draft: true, authoringVersion: 16, items: [], cits: {} });
  assert.equal(pricingCalls, 2);
  dom.window.close();
  console.log(
    JSON.stringify({
      passed: true,
      independentOwners: 6,
      lazyComposition: true,
      retainedListeners: 9,
      safeDelayedNavigation: true,
      retainedCitationGuards: true,
    }),
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
