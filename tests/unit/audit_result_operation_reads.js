/* Per-operation presentation work stays bounded and never survives draft/catalog/report mutations. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");
const { compile } = require("../fixtures/equivalence_harness.cjs");
(async () => {
  const picker = await compile('export {languagePicker} from "./language_discovery.js"; export {esc,markBlanks} from "./presentation_format.js";');
  const all = Array.from({ length: 300 }, (_, o) => ({ ci: 0, gi: 0, o, t: "Entry " + o, a: "Stock " + o, s: ["27.05"] }));
  let reads = 0,
    status = "legacy";
  const draft = {
    items: Array.from({ length: 200 }, (_, n) => ({ key: String(n % 100), text: "Edit " + n, sections: ["EDIT"] })),
    selectionCache: {},
  };
  const R = {
    LIBRARY: [{ code: "ENF_ORDER_CATALOG", name: "Categories", groups: [{ code: "G", name: "Group" }] }],
    state: { picker: true, docId: "draft", q: "", pickerStatus: "all", cl: -1, grp: 0 },
    doc: () => draft,
    allItems: () => all,
    catalogKey: (i) => String(i.o),
    itemLibraryKey: (i) => {
      reads++;
      return i.key;
    },
    catalogVisible: () => true,
    effectiveCatalog: (i) => ({ a: i.a, s: i.s }),
    catalogStatus: () => ({ code: status }),
    catalogItem: () => null,
    esc: picker.esc,
    markBlanks: picker.markBlanks,
  };
  const page = () => {
    reads = 0;
    const dom = new JSDOM(picker.languagePicker(R));
    assert.equal(reads, draft.items.length, "one key read per selected item, independent of result count");
    return dom.window.document;
  };
  let p = page();
  assert.equal(p.querySelectorAll(".language-pick-row").length, 300);
  assert.match(p.querySelector('[data-language-key="0"] h4').textContent, /×2/);
  assert.equal(p.querySelector('[data-language-key="0"] .language-preview').textContent, "Edit 0", "first copy wins");
  draft.items[0].text = "Changed";
  p = page();
  assert.equal(p.querySelector('[data-language-key="0"] .language-preview').textContent, "Changed");
  draft.items = [];
  draft.selectionCache["0"] = { text: "Cached edit", sections: ["CACHE"] };
  status = "retired";
  p = page();
  assert.ok(p.querySelector('[data-pick="0:0:0"]').disabled, "fresh policy blocks a new selection");
  assert.equal(p.querySelector('[data-language-key="0"] .language-preview').textContent, "Cached edit");
  assert.equal(p.querySelector('[data-pick="0:0:0"]').getAttribute("aria-pressed"), "false");

  const reports = await compile(
    fs.readFileSync("app/modules/reports_screens.js", "utf8") +
      '\nexport {reportsScreenTablePanel}; export {ReportsState} from "./state.js"; export {esc} from "./presentation_format.js";',
  );
  reports.ReportsState.S = { screen: "sample", tableSort: null, drill: null };
  let cellReads = 0;
  const rows = Array.from({ length: 500 }, (_, n) => {
    const cells = ["Case " + n, { fmt: "int", n: n + 1, ids: ["case"] }, { fmt: "money", n: 2 }, null];
    return {
      get cells() {
        cellReads++;
        return cells;
      },
    };
  });
  const services = {
    esc: reports.esc,
    fmtNum: String,
    fmtMoney: (n) => "$" + n,
    fmtDays: String,
    activeFilters: () => false,
    A11Y: {
      notify() {
        throw Error("unexpected sort failure");
      },
    },
  };
  const res = { cols: ["Case", "Count", "Amount", "Empty"], rows };
  const render = () => new JSDOM(reports.reportsScreenTablePanel(services, res, "Today")).window.document;
  p = render();
  assert.equal(cellReads, 1000, "one row read for column facts plus one for output");
  assert.equal(p.querySelectorAll("tbody tr").length, 500);
  assert.equal(p.querySelectorAll("thead th.n").length, 2);
  assert.equal(p.querySelector('[data-drill="499:1"]').parentElement.style.backgroundSize, "100% 70%");
  rows.splice(0, rows.length, ["Replacement", { fmt: "int", n: 2, ids: ["new"] }]);
  p = render();
  assert.equal(p.querySelectorAll("tbody tr").length, 1);
  assert.equal(p.querySelector('[data-drill="0:1"]').parentElement.style.backgroundSize, "100% 70%", "scale recalculates after replacing rows");
  console.log("PASS bounded picker/report operation reads, duplicate/first-copy preservation and current edits, cache, policy and report scale");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
