const { serviceComposition } = require("../fixtures/deferred_service_syntax.cjs");
/* Reports owners load independently, preserve lazy state/context and retain deposit listener order. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
const root = path.resolve(__dirname, "../.."),
  directory = path.join(root, "app/modules");
const parse = (n) => acorn.parse(fs.readFileSync(path.join(directory, n + ".js"), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
const owners = {
  reports_services: "createReportsServices",
  reports_screens: "createReportsScreens",
  reports_view_contexts: "createReportsViewContext",
};
function walk(n, visit) {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) return n.forEach((c) => walk(c, visit));
  visit(n);
  Object.values(n).forEach((c) => walk(c, visit));
}
const core = parse("reports_core"),
  constructors = new Map();
walk(core, (n) => {
  if (n.type === "VariableDeclarator" && Object.values(owners).includes(n.init?.callee?.name)) constructors.set(n.init.callee.name, n.init);
});
assert.deepEqual([...constructors.keys()], Object.values(owners));
for (const [name, factory] of Object.entries(owners)) {
  if (name === "reports_screens") {
    const call = constructors.get(factory);
    assert.equal(call.arguments.length, 1);
    require("../fixtures/scoped_service_contract.cjs").assertScopedServices(parse(name), call.arguments[0], name);
    continue;
  }
  const required = new Set();
  walk(parse(name), (n) => {
    if (n.type === "MemberExpression" && n.object.name === "services") {
      assert.equal(n.computed, false);
      required.add(n.property.name);
    }
  });
  const call = constructors.get(factory);
  assert.equal(call.arguments.length, 1);
  const props = serviceComposition(call.arguments[0]).properties;
  assert.deepEqual(new Set(props.map((p) => p.key.name)), required, "exact scoped interface");
  for (const p of props) {
    assert.equal(p.kind, "get");
    assert.equal(p.value.body.body.length, 1);
    assert.equal(p.value.body.body[0].type, "ReturnStatement");
    assert.equal(p.value.body.body[0].argument.name, p.key.name.replace(/^ctx_reports_/, ""));
  }
}
(async () => {
  const compiled = await esbuild.build({
    stdin: {
      contents:
        Object.entries(owners)
          .map(([n, f]) => `export {${f}} from './${n}.js';`)
          .join("\n") + "export {initDepositSchedule} from './deposit_schedule.js'; export {ReportsState} from './state.js';",
      resolveDir: directory,
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
  new Function("module", "exports", compiled.outputFiles[0].text)(box, box.exports);
  const api = box.exports,
    state = api.ReportsState,
    unavailable = new Proxy(
      {},
      {
        get(_, k) {
          throw Error("premature " + String(k));
        },
      },
    );
  assert.deepEqual(state, {});
  for (const name of Object.values(owners)) api[name](unavailable);
  assert.deepEqual(state, {}, "constructors leave Reports uninitialized and require no DOM");
  const first = { screen: "first" },
    second = { screen: "second" },
    saved = [];
  state.S = first;
  state.SAVED_VIEWS = saved;
  const fn = () => {},
    reportList = [];
  const contextServices = {
    ctx_reports_REPORTS: reportList,
    ctx_reports_areaKey: fn,
    ctx_reports_areaLabel: fn,
    ctx_reports_esc: fn,
    ctx_reports_fmtDate: fn,
    ctx_reports_fmtNum: fn,
    ctx_reports_ownerKeyLabel: fn,
    ctx_reports_plural: fn,
    ctx_reports_reportById: fn,
  };
  const build = api.createReportsViewContext(contextServices).reports_reportpresentationContext;
  const before = build();
  state.S = second;
  state.SAVED_VIEWS = ["new"];
  const after = build();
  assert.equal(before.S, first);
  assert.equal(after.S, second);
  assert.equal(before.SAVED_VIEWS, saved);
  assert.deepEqual(after.SAVED_VIEWS, ["new"]);
  assert.equal(after.areaKey, fn);
  assert.equal(after.REPORTS, reportList);
  const events = [],
    oldDocument = global.document;
  global.document = { addEventListener: (...args) => events.push(args), getElementById: () => null };
  try {
    let renders = 0;
    const deposit = api.initDepositSchedule({ render: () => ++renders, esc: (s) => String(s) });
    assert.equal(typeof deposit.html, "function");
    assert.deepEqual(
      events.map((x) => [x[0], x[2]]),
      [
        ["change", undefined],
        ["input", undefined],
        ["click", undefined],
      ],
    );
    assert.equal(renders, 0);
    events[0][1]({ target: { id: "deposit-schedule-date", value: "2026-10-25" } });
    events[1][1]({ target: { id: "deposit-schedule-search", value: "tree" } });
    assert.equal(renders, 2);
  } finally {
    if (oldDocument === undefined) delete global.document;
    else global.document = oldDocument;
  }
  console.log(JSON.stringify({ passed: true, independentOwners: 3, reportsCycleRemoved: true, lazyContextAndDepositOrder: true }));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
