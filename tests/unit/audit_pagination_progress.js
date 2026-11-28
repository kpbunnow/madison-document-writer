/* Native Chromium: oversized fixed row cells must not generate endless history continuations or lose notes. */
const assert = require("node:assert/strict"),
  path = require("node:path");
const { chromium } = require("playwright");
const esbuild = require("esbuild");
(async () => {
  const b = await esbuild.build({
    stdin: { contents: 'export {createDocumentPagination} from "./document_pagination.js";', resolveDir: path.resolve("app/modules") },
    bundle: true,
    write: false,
    format: "iife",
    globalName: "paging",
    plugins: [
      {
        name: "data",
        setup(b) {
          b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.resolve("build/generated/modules/data", path.basename(a.path)) }));
        },
      },
    ],
  });
  const browser = await chromium.launch({ executablePath: process.env.DW_BROWSER || undefined, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setContent(
      '<style>.desk{width:816px}.sheet{width:600px;font:14px/20px Arial}td{vertical-align:top}.c-sec{width:80px}.corr{width:250px}</style><div class="desk"></div>',
    );
    await page.addScriptTag({ content: b.outputFiles[0].text });
    const result = await page.evaluate(() => {
      const desk = document.querySelector(".desk");
      desk.innerHTML =
        '<section class="sheet"><table class="notice"><thead><tr><th>No</th><th>Sections</th><th>Action</th></tr></thead><tbody><tr><td class="c-no"><span class="num">1</span></td><td class="c-sec">' +
        "27.05(2)(c)<br>".repeat(100) +
        '</td><td class="corr">Repair wall<div data-history-note><strong>Visit note: </strong>Retained note</div></td></tr></tbody></table><footer class="n-foot">Footer</footer></section>';
      let calls = 0;
      const api = paging.createDocumentPagination({
        get PAGE_PX() {
          if (++calls > 100) throw new Error("Pagination made no progress");
          return 480;
        },
        snow: { is: () => false },
        hasItemInspectionHistory: () => true,
      });
      api.paginate(desk, { id: "d", type: "referral", authoringVersion: 16, frozen: { case: { number: "SYNTHETIC", address: "TEST" } } });
      return {
        pages: desk.querySelectorAll(".sheet").length,
        notes: [...desk.querySelectorAll("[data-history-note]")].map((n) => n.lastChild.textContent),
      };
    });
    assert.ok(result.pages <= 4, "oversized cell must terminate after bounded continuations");
    assert.deepEqual(result.notes, ["Retained note"], "remaining note prints exactly once");
    console.log("PASS native pagination terminates on oversized fixed cells and retains every history note");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
