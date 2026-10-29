/* Compare the standalone XML owner and Reports composition against retained sheet serialization. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild"),
  { bridgesFor } = require("../fixtures/lifted_splice.cjs");
const referenceText = fs.readFileSync("tests/fixtures/report_sheet_xml_reference.txt", "utf8");
(async () => {
  const source = fs.readFileSync("app/modules/reports_screens.js", "utf8"),
    factory = acorn
      .parse(source, { ecmaVersion: 2022, sourceType: "module" })
      .body.find((n) => n.declaration?.id?.name === "createReportsScreens").declaration,
    decl = factory.body.body.find((n) => n.declarations?.some((d) => d.id.name === "sheetXml"));
  async function compile(contents) {
    const b = await esbuild.build({
      stdin: {
        contents: contents + '\nexport {createSpreadsheetSheet,spreadsheetColumnName} from "./report_spreadsheet_sheet.js";',
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
  const [current, legacy] = await Promise.all([
    compile(source),
    compile(source.slice(0, decl.start) + bridgesFor(source, "reportsScreen", referenceText) + "\n" + referenceText + source.slice(decl.end)),
  ]);
  for (const [i, name] of [
    [0, "A"],
    [25, "Z"],
    [26, "AA"],
    [701, "ZZ"],
    [702, "AAA"],
    [16383, "XFD"],
  ])
    assert.equal(current.spreadsheetColumnName(i), name);
  function run(api, input, standalone = false) {
    const reads = [],
      x = structuredClone(input);
    let steps = 0;
    function observed(v, label) {
      if (!v || typeof v !== "object") return v;
      return new Proxy(v, {
        get(o, k) {
          if (typeof k !== "symbol") reads.push(label + "." + k);
          return o[k];
        },
      });
    }
    const facts = observed(
      {
        validISO(value) {
          assert.equal(this, facts);
          reads.push(["valid", value]);
          return /^\d{4}-\d{2}-\d{2}$/.test(value);
        },
      },
      "facts",
    );
    const exports = observed(
      {
        excelDate(value) {
          assert.equal(this, exports);
          reads.push(["date", value]);
          if (++steps === x.fail) throw new Error("date conversion interrupted");
          return Math.round((Date.parse(value) - Date.parse("1899-12-30")) / 86400000);
        },
        xesc(value) {
          assert.equal(this, exports);
          reads.push(["escape", value]);
          if (++steps === x.fail) throw new Error("escape interrupted");
          return String(value).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);
        },
      },
      "exports",
    );
    const services = observed({ facts, exports }, "services"),
      sheet = standalone ? api.createSpreadsheetSheet(services) : api.createReportsScreens(services).sheetXml;
    assert.deepEqual(reads, [], "construction must not read supplied services");
    const rows = x.rows.map((row, ri) => row.map((v, ci) => observed(v, "cell" + ri + "," + ci))),
      opt = observed(x.opt, "options");
    let xml, error;
    try {
      xml = sheet(rows, opt);
    } catch (e) {
      error = [e.name, e.message];
    }
    return { xml, error, reads };
  }
  let seed = 20261111,
    checked = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (a) => a[random(a.length)];
  const values = [
    null,
    undefined,
    "",
    0,
    1,
    -3,
    NaN,
    Infinity,
    'text<&>"',
    true,
    false,
    { d: "2026-10-28" },
    { d: "invalid" },
    { d: "" },
    { m: 0 },
    { m: 1.234 },
    { m: Infinity },
    { m: "bad" },
    { f: 3.14159 },
    { f: NaN },
    { f: null },
    { d: "2026-10-28", m: 4, f: 5 },
    {},
  ];
  function compare(x) {
    const expected = run(legacy, x);
    assert.deepEqual(run(current, x), expected, "composed " + checked);
    assert.deepEqual(run(current, x, true), expected, "standalone " + checked++);
  }
  compare({ rows: [], opt: null });
  compare({ rows: [values], opt: { header: true, boldRows: [1] }, fail: 0 });
  for (let n = 0; n < 4000; n++)
    compare({
      rows: Array.from({ length: random(5) }, () => Array.from({ length: random(35) }, () => pick(values))),
      opt: pick([undefined, null, {}, { header: true }, { header: false, boldRows: [0, 2] }, { header: true, boldRows: [1] }]),
      fail: random(5),
    });
  console.log(
    "PASS spreadsheet sheet equivalence " +
      checked +
      " inputs through composed/standalone owners: exact XML, widths, styles, service receivers and read/exception order",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
