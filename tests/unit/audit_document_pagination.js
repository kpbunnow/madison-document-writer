const { serviceComposition } = require("../fixtures/deferred_service_syntax.cjs");
/* Pagination owns physical layout, with unchanged historical limits and explicit lazy services. */
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
const owners = { document_pagination: "createDocumentPagination" };
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
      contents: "export { createDocumentPagination } from './document_pagination.js'; export { WriterState } from './state.js';",
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
  const unavailable = new Proxy(
    {},
    {
      get(_, key) {
        throw new Error("premature dependency: " + String(key));
      },
    },
  );
  const cold = { exports: {} };
  new Function("module", "exports", "document", compiled.outputFiles[0].text)(cold, cold.exports, unavailable);
  cold.exports.createDocumentPagination(unavailable);
  assert.deepEqual(cold.exports.WriterState, {}, "loading and construction must not initialize Writer or read DOM/services");
  const dom = new JSDOM('<div class="desk"></div>'),
    document = dom.window.document,
    box = { exports: {} };
  new Function("module", "exports", "document", compiled.outputFiles[0].text)(box, box.exports, document);
  const api = box.exports,
    state = api.WriterState,
    desk = document.querySelector(".desk");
  let width = 816,
    pageSize = 600,
    snow = false;
  Object.defineProperty(desk, "clientWidth", { get: () => width });
  // A controlled height model tests grouping/order/footers. Actual geometry stays covered by the full Chromium print suite.
  Object.defineProperty(dom.window.HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get() {
      if (!this.classList.contains("sheet")) return 0;
      return 100 + this.querySelectorAll("table.notice tbody > tr").length * 240 + this.querySelectorAll(".snow-cover > p").length * 350;
    },
  });
  const layout = api.createDocumentPagination({
    get PAGE_PX() {
      return pageSize;
    },
    get snow() {
      return { is: () => snow };
    },
    hasItemInspectionHistory: () => false,
  });
  assert.equal(layout.pageLimit({ authoringVersion: 9 }), 600);
  assert.equal(layout.pageLimit({ authoringVersion: 10 }), 584);
  assert.equal(layout.pageLimit({ authoringVersion: 16 }), 584);
  pageSize = 1056;
  assert.equal(layout.pageLimit({ authoringVersion: 9 }), 1056);
  assert.equal(layout.pageLimit({ authoringVersion: 10 }), 1040);
  pageSize = 600;
  const d = Object.freeze({
    id: "document",
    caseId: "case",
    type: "notice",
    authoringVersion: 10,
    frozen: { case: { id: "case", number: "QA-PAGES", address: "123 RETAINED ROAD" } },
  });
  const header = layout.contHead(d);
  assert.ok(header.textContent.includes("123 RETAINED ROAD"));
  assert.ok(header.textContent.includes("QA-PAGES"));
  const notice = (count) =>
    '<section class="sheet"><div class="n-head">Original header</div><table class="notice"><thead><tr><th>Items</th></tr></thead><tbody>' +
    Array.from({ length: count }, (_, i) => '<tr data-row="item-' + i + '"><td>Item ' + i + "</td></tr>").join("") +
    '</tbody></table><div class="closing">Closing facts</div><div class="controls no-print">Editor controls</div><footer class="n-foot">Retained footer</footer></section><section class="cit">Citation sentinel</section>';
  desk.innerHTML = notice(3);
  layout.paginate(desk, d);
  let pages = [...desk.querySelectorAll(".sheet")];
  assert.equal(pages.length, 2);
  assert.deepEqual(
    [...desk.querySelectorAll("[data-row]")].map((r) => r.dataset.row),
    ["item-0", "item-1", "item-2"],
  );
  assert.equal(pages[0].querySelector(".n-head").textContent, "Original header");
  assert.ok(pages[1].querySelector(".n-cont").textContent.includes("123 RETAINED ROAD"));
  assert.deepEqual(
    pages.map((p) => p.querySelector(".pg").textContent),
    ["Page 1 of 2", "Page 2 of 2"],
  );
  assert.equal(pages[0].querySelector(".controls"), null);
  assert.ok(pages[1].querySelector(".controls"));
  assert.ok(pages[1].querySelector(".closing"));
  assert.equal(desk.lastElementChild.className, "cit", "citation packet order is unchanged");
  desk.innerHTML = notice(1);
  layout.paginate(desk, d);
  assert.equal(desk.querySelectorAll(".sheet").length, 1);
  assert.equal(desk.querySelector(".n-foot"), null, "single-page regular order retains its footer rule");
  width = 700;
  desk.innerHTML = notice(3);
  layout.paginate(desk, d);
  assert.equal(desk.querySelectorAll(".sheet").length, 1);
  assert.ok(desk.querySelector(".sheet").classList.contains("flow"));
  assert.equal(desk.querySelectorAll("[data-row]").length, 3);
  width = 816;
  snow = true;
  desk.innerHTML =
    '<section class="sheet"><div class="n-head">Snow header</div><div class="snow-cover"><p>First retained paragraph</p><p>Second retained paragraph</p></div><footer class="n-foot">Snow footer</footer></section><section class="cit">Citation sentinel</section>';
  layout.paginate(desk, { ...d, authoringVersion: 9 });
  pages = [...desk.querySelectorAll(".snow-sheet")];
  assert.equal(pages.length, 2);
  assert.deepEqual(
    [...desk.querySelectorAll(".snow-cover p")].map((p) => p.textContent),
    ["First retained paragraph", "Second retained paragraph"],
  );
  assert.deepEqual(
    pages.map((p) => p.querySelector(".pg").textContent),
    ["Page 1 of 2", "Page 2 of 2"],
  );
  assert.equal(desk.lastElementChild.className, "cit");
  snow = false;
  Object.assign(state, { state: { docId: d.id }, DOCS: [d] });
  desk.innerHTML = notice(1);
  layout.paginate();
  assert.equal(desk.querySelectorAll(".sheet").length, 1);
  assert.equal(state.DOCS[0], d, "default live-document lookup remains call-time and does not replace the record");
  dom.window.close();
  console.log(
    JSON.stringify({
      passed: true,
      isolatedPagination: true,
      lazyServices: true,
      historicalLimits: true,
      retainedOrderAndFooters: true,
      snowAndMobile: true,
    }),
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
