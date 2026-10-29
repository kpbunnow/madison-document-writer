/* Complete retained screens protect markup, search/selection decisions and ordered scoped callbacks. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
(async () => {
  const source = fs.readFileSync("app/modules/language_discovery.js", "utf8"),
    ast = acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" });
  let old = source;
  for (const name of ["languageScreen", "languagePicker"]
    .map((name) => ast.body.find((n) => n.declaration?.id?.name === name))
    .sort((a, b) => b.start - a.start)) {
    const reference = name.declaration.id.name === "languageScreen" ? "language_screen" : "language_picker";
    old = old.slice(0, name.start) + fs.readFileSync("tests/fixtures/" + reference + "_reference.txt", "utf8") + old.slice(name.end);
  }
  async function compile(contents) {
    const b = await esbuild.build({
      stdin: {
        contents: contents + '\nexport {esc,markBlanks} from "./presentation_format.js";export {itemLibraryKey} from "./document_rules.js";',
        resolveDir: path.resolve("app/modules"),
      },
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
    new Function("module", "exports", b.outputFiles[0].text)(box, box.exports);
    return box.exports;
  }
  const [current, legacy] = await Promise.all([compile(source), compile(old)]);
  function run(api, input, picker) {
    const x = structuredClone(input),
      calls = [];
    let step = 0;
    const items = x.items,
      library = x.library;
    function effect(name, args = []) {
      calls.push([name, structuredClone(args)]);
      if (++step === x.fail) throw Error("interrupted:" + name);
      if (step === x.mutate) {
        x.state.keepAdding = !x.state.keepAdding;
        x.state.libCl = -1;
      }
    }
    const methods = {
      allItems() {
        return items;
      },
      catalogKey(i) {
        return i.key;
      },
      catalogItem(key) {
        return items.find((i) => i.key === key);
      },
      catalogVisible(i, filter) {
        return (
          filter === "all" ||
          (filter === "approved"
            ? i.status === "ready"
            : filter === "usable"
              ? ["ready", "legacy"].includes(i.status)
              : filter === "review"
                ? ["review", "incomplete"].includes(i.status)
                : ["legacy", "retired", "superseded"].includes(i.status))
        );
      },
      effectiveCatalog(i) {
        return { a: i.a, s: i.s };
      },
      catalogStatus(i) {
        return {
          code: i.status,
          label: "Status <&>",
          review:
            i.status === "ready" ? { status: "approved", version: 3, reviewer: "Reviewer <&>", at: "2026-10-29", source: "Approved source" } : null,
          replacement: i.status === "superseded" ? { key: items[0].key } : null,
        };
      },
      catalogReviewPanel(i) {
        return "<form>" + api.esc(i.t) + "</form>";
      },
      doc() {
        return x.doc;
      },
      itemLibraryKey: api.itemLibraryKey,
      esc: api.esc,
      markBlanks: api.markBlanks,
      shell(title, lede, actions, body) {
        return "<header>" + api.esc(title) + api.esc(lede) + actions + "</header>" + body;
      },
    };
    const values = { state: x.state, LIBRARY: library, CATALOG_ERROR: x.error, CATALOG_FROM_CACHE: x.cache, CATALOG_AT: x.at };
    for (const [key, fn] of Object.entries(methods))
      values[key] = (...args) => {
        effect(key, args);
        return fn(...args);
      };
    const R = new Proxy(values, {
      get(o, k) {
        effect("get:" + String(k));
        return o[k];
      },
    });
    let result, error;
    try {
      result = picker ? api.languagePicker(R) : api.languageScreen(R);
    } catch (e) {
      error = [e.name, e.message];
    }
    return { result, error, calls, input: x };
  }
  let seed = 20261204,
    count = 0,
    nonempty = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (a) => a[random(a.length)];
  function fixture() {
    const library = Array.from({ length: 2 }, (_, ci) => ({
      code: "C" + ci,
      name: "Checklist <&> " + ci,
      groups: Array.from({ length: 2 }, (_, gi) => ({ name: "Group " + gi, code: "G" + gi })),
    }));
    const items = library.flatMap((c, ci) =>
      c.groups.flatMap((g, gi) =>
        Array.from({ length: 2 }, (_, j) => ({
          ci,
          gi,
          o: j + 1,
          key: JSON.stringify([c.code, g.code, j + 1]),
          cl: c.name,
          grp: g.name,
          t: j ? "Handrail <&>" : "Garbage and refuse",
          a: "Repair ( ) <&>.",
          s: ["27.05"],
          fillIn: "Insert facts",
          guidance: "Keep private text",
          status: j ? "legacy" : "ready",
        })),
      ),
    );
    return {
      library,
      items,
      state: {
        screen: "library",
        languageMode: "browse",
        libFilter: "",
        libStatus: "all",
        libCl: -1,
        catalogAdminQ: "",
        catalogAdminStatus: "all",
        catalogAdminKey: items[0].key,
        picker: true,
        docId: "draft",
        q: "",
        pickerStatus: "all",
        cl: -1,
        grp: 0,
        keepAdding: false,
      },
      doc: { type: "notice", items: [{ id: "retained", libraryKey: items[0].key, text: "Draft <&>", sections: ["27.05"] }], selectionCache: {} },
      error: "",
      cache: false,
      at: "2026-10-29",
      fail: 0,
      mutate: 0,
    };
  }
  function compare(x, picker) {
    const a = run(current, x, picker),
      b = run(legacy, x, picker);
    assert.deepEqual(a, b, "scenario " + count++);
    if (a.result?.includes("language-row") || a.result?.includes("language-pick-row") || a.result?.includes("language-entry")) nonempty++;
  }
  for (const mode of ["browse", "admin"])
    for (const filter of ["all", "approved", "usable", "review", "legacy", "selected"])
      for (const q of ["", "trash", "handrail", "missing"]) {
        const x = fixture();
        x.state.languageMode = mode;
        x.state.libStatus = x.state.catalogAdminStatus = x.state.pickerStatus = filter;
        x.state.libFilter = x.state.catalogAdminQ = x.state.q = q;
        compare(x, false);
        compare(x, true);
      }
  for (let i = 0; i < 1500; i++) {
    const x = fixture();
    x.state.languageMode = pick(["browse", "admin"]);
    x.state.picker = random(10) !== 0;
    x.state.libFilter = x.state.catalogAdminQ = x.state.q = pick(["", "trash", "garbage", "railings", "27.05", "<&>", "missing"]);
    x.state.libStatus = x.state.catalogAdminStatus = x.state.pickerStatus = pick(["all", "approved", "usable", "review", "legacy", "selected"]);
    x.state.libCl = x.state.cl = pick([-1, 0, 1]);
    x.state.grp = random(2);
    x.state.keepAdding = !!random(2);
    x.state.catalogAdminKey = pick([x.items[0].key, "missing"]);
    x.error = pick(["", "Offline <&>"]);
    x.cache = !!random(2);
    x.fail = random(3) ? 0 : random(140) + 1;
    x.mutate = random(2) ? 0 : random(80) + 1;
    for (const item of x.items) item.status = pick(["ready", "legacy", "review", "retired", "superseded", "incomplete", "unknown"]);
    if (random(8) === 0) x.doc = null;
    else {
      x.doc.type = pick(["notice", "citation"]);
      if (random(2)) x.doc.selectionCache[x.items[1].key] = { text: "Cached wording", sections: [] };
    }
    compare(x, !!random(2));
  }
  assert.ok(nonempty > 150, "render real entries beyond empty or refused states");
  console.log(
    "PASS language presentation equivalence " +
      count +
      " screens: exact HTML, catalog/search/selection scopes, retained drafts and ordered callback failures",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
