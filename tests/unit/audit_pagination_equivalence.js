const { withHistoricalBindings } = require("../fixtures/historical_module_scope.cjs");
/* Real Chromium compares exact pages and measurement order with the original pagination algorithms. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild"),
  acorn = require("acorn");
const { chromium } = require("playwright");
(async () => {
  const dir = path.resolve("app/modules");
  let source = fs.readFileSync(path.join(dir, "document_pagination.js"), "utf8");
  const ast = acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" }),
    factory = ast.body.find((n) => n.declaration?.id.name === "createDocumentPagination").declaration,
    ret = factory.body.body.at(-1),
    reference = require("../fixtures/pagination_reference.cjs");
  const legacy =
    reference.snow.replace("function paginateSnow(", "function referencePaginateSnow(") +
    reference.regular
      .replace("function paginate(", "function referencePaginate(")
      .replace("paginateSnow(desk, src, d)", "referencePaginateSnow(desk, src, d)");
  source =
    source.slice(0, ret.start) +
    legacy +
    "\n" +
    source.slice(ret.start).replace("return { paginate, pageLimit, contHead }", "return { paginate, pageLimit, contHead, referencePaginate }");
  source +=
    '\nimport {WriterState as testState} from "./state.js";testState.CASES=[];testState.DOCS=[];window.paginationProof=createDocumentPagination;';
  const compiled = await esbuild.build({
    stdin: { contents: withHistoricalBindings(source), resolveDir: dir },
    bundle: true,
    write: false,
    format: "iife",
    plugins: [
      {
        name: "data",
        setup(b) {
          b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.resolve("build/generated/modules/data", path.basename(a.path)) }));
        },
      },
    ],
  });
  const browser = await chromium.launch({ executablePath: process.env.DW_BROWSER || undefined, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
    await page.setContent(
      '<style>.desk{width:816px}.sheet{width:600px;padding:12px;box-sizing:border-box;font:14px/20px Arial}table{width:100%;border-collapse:collapse}td{vertical-align:top}.c-no{width:45px}.corr{width:250px}.visit-list{width:240px}p{margin:4px 0}footer,.n-cont{height:20px}em{display:block}table.snow-sites td{width:300px}</style><div class="desk"></div>',
    );
    await page.addScriptTag({ content: compiled.outputFiles[0].text });
    const results = [];
    for (const scenario of [
      { length: 0, observations: 0, version: 9 },
      { length: 80, observations: 2, version: 10 },
      { length: 500, observations: 2, version: 16 },
      { length: 1500, observations: 1, version: 16 },
      { length: 1500, observations: 0, version: 16 },
      { length: 80, observations: 2, version: 16, mobile: true },
      { length: 300, rows: 6, groups: true, version: 16 },
      { length: 120, rows: 9, groups: true, version: 10, voided: true },
      { length: 200, rows: 5, aligned: true, version: 16 },
      { length: 600, rows: 3, aligned: true, groups: true, version: 16, voided: true },
      { length: 100, rows: 12, version: 10 },
      { length: 50, snow: true, version: 9 },
      { length: 400, snow: true, version: 16 },
    ]) {
      const result = await page.evaluate((scenario) => {
        const desk = document.querySelector(".desk");
        desk.style.width = scenario.mobile ? "700px" : "816px";
        const esc = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
        const text = "Synthetic words 🧱 café é ".repeat(Math.ceil(scenario.length / 25)).slice(0, scenario.length);
        const notes = scenario.length ? "<div data-history-note><strong>Visit note: </strong>" + esc(text) + "</div>" : "";
        const observations = Array.from(
          { length: scenario.observations || 0 },
          (_, i) => "<div><span>2026-10-" + (20 + i) + " · Progress</span><em>Note: " + esc(text) + "</em></div>",
        ).join("");
        const input = scenario.snow
          ? '<section class="sheet"><div>Snow header</div><div class="snow-cover"><p>' +
            esc(text) +
            '</p><table class="snow-sites"><thead><tr><th>Sites</th></tr></thead><tbody>' +
            Array.from({ length: 8 }, (_, i) => "<tr><td>Site " + i + " " + esc(text) + "</td></tr>").join("") +
            '</tbody></table><p>Closing snow paragraph</p></div><footer class="n-foot">Snow footer</footer></section>'
          : '<section class="sheet' +
            (scenario.voided ? " voided" : "") +
            '"><div>Original header</div>' +
            (scenario.aligned
              ? '<div class="n-body">' +
                Array.from({ length: 4 }, (_, i) => "<p>Language " + i + " " + esc(text) + "</p>").join("") +
                "</div><div>After the language</div><div>And more after</div>"
              : "") +
            '<table class="notice"><thead><tr><th>No</th><th>Violation</th><th>History</th></tr></thead><tbody><tr data-row="item"><td class="c-no"><span class="num">1</span></td><td class="corr">Repair wall' +
            notes +
            '</td><td><div class="visit-list">' +
            observations +
            "</div></td></tr>" +
            Array.from(
              { length: scenario.rows || 0 },
              (_, i) =>
                (scenario.groups && i % 2 ? '<tr class="grp"><td colspan="3">Group ' + i + "</td></tr>" : "") +
                '<tr data-row="item"><td class="c-no"><span class="num">' +
                (i + 2) +
                '</span></td><td class="corr">Repair ' +
                esc(text) +
                '</td><td><div class="visit-list"></div></td></tr>',
            ).join("") +
            '</tbody></table><p>Closing facts</p><div class="no-print">Editor controls</div><footer class="n-foot">Retained footer</footer></section>';
        const d = {
          id: "d",
          caseId: "c",
          type: scenario.aligned ? "vacancyExtension" : "notice",
          authoringVersion: scenario.version,
          frozen: { case: { id: "c", address: "100 TEST ST", number: "TEST-PAGES" } },
        };
        let calls = [];
        const api = window.paginationProof({
          get PAGE_PX() {
            calls.push("limit");
            return 480;
          },
          snow: { is: () => !!scenario.snow },
          hasItemInspectionHistory: () => true,
        });
        const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "scrollHeight");
        Object.defineProperty(Element.prototype, "scrollHeight", {
          configurable: true,
          get() {
            const value = descriptor.get.call(this);
            if (this.classList.contains("sheet")) calls.push(value);
            return value;
          },
        });
        function run(fn) {
          desk.innerHTML = input;
          calls = [];
          fn(desk, d);
          return {
            html: desk.innerHTML,
            calls: calls.slice(),
            pages: desk.querySelectorAll(".sheet").length,
            notes: [...desk.querySelectorAll(".corr [data-history-note]")].map((n) => n.lastChild.textContent).join(""),
            observations: [...desk.querySelectorAll(".visit-list em")].map((n) => n.textContent.slice(6)).join(""),
          };
        }
        try {
          return { old: run(api.referencePaginate), current: run(api.paginate), text };
        } finally {
          Object.defineProperty(Element.prototype, "scrollHeight", descriptor);
        }
      }, scenario);
      assert.deepEqual(result.current, result.old, JSON.stringify(scenario));
      if (!scenario.snow) {
        assert.equal(result.current.notes, scenario.length ? result.text : "");
        assert.equal(result.current.observations, result.text.repeat(scenario.observations));
      }
      results.push({ scenario, pages: result.current.pages, measurements: result.current.calls.length });
    }
    const output = path.resolve("build/test-results/pagination-equivalence.json");
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify({ passed: true, results }, null, 2));
    console.log("PASS native pagination equivalence", results);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
