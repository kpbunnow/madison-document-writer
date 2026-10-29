/* Full HTML and callback-order comparisons for the actual shared Reports presentation functions. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild");
(async () => {
  async function load(source) {
    const b = await esbuild.build({
        stdin: { contents: source + '\nexport {esc} from "./presentation_format.js";', resolveDir: path.resolve("app/modules") },
        bundle: true,
        write: false,
        format: "cjs",
      }),
      box = { exports: {} };
    new Function("module", "exports", b.outputFiles[0].text)(box, box.exports);
    return box.exports;
  }
  const [current, original] = await Promise.all([
    load(fs.readFileSync("app/modules/report_presentation.js", "utf8")),
    load(fs.readFileSync("tests/fixtures/report_presentation_templates_reference.txt", "utf8")),
  ]);
  function run(api, method, x) {
    const calls = [],
      reports = [
        { id: "openCases", label: "Open <&> cases" },
        { id: "allCases", label: "All cases" },
        { id: "citations", label: "Citations" },
        { id: "other", label: "Other reports" },
      ],
      R = {
        REPORTS: reports,
        SAVED_VIEWS: x.saved ? [{ id: "view-1", name: "View <&>", dateMode: "fixed" }] : [],
        S: {
          screen: x.screen,
          savedId: x.saved ? "view-1" : "",
          F: {
            from: "2026-01-01",
            to: "2026-10-29",
            asOf: "2026-10-29",
            areaType: x.zip ? "zip" : "district",
            boundary: x.boundary ? "atOpen" : "current",
            areas: x.filter ? ["1", "2"] : [],
            inspector: x.filter ? "QA <&>" : "",
            vtype: x.filter ? "type" : "",
            ord: x.filter ? "27.05" : "",
            status: x.filter ? "open" : "",
            owner: x.filter ? "owner" : "",
          },
          raw: {
            readAt: "2026-10-29T12:00:00Z",
            missing: x.missing ? ["missing"] : [],
            stale: x.stale ? ["stale"] : [],
            unreadable: x.bad ? ["bad"] : [],
            mismatched: x.mismatch ? ["mismatch"] : [],
          },
          M: {
            types: [{ key: "type", label: "Type <&>" }],
            versionStale: x.old ? ["old"] : [],
            counted: [{ area: x.unlocated ? "" : "1" }, { area: "2" }],
          },
        },
      };
    let n = 0;
    const callbacks = {
      esc: api.esc,
      fmtDate: (v) => v,
      areaLabel: (a) => "Area " + a,
      ownerKeyLabel: (v) => "Owner " + v,
      fmtNum: (n) => String(n),
      plural: (n, s, p) => n + " " + (n === 1 ? s : p || s + "s"),
      areaKey: (c) => c.area,
      reportById: (id) => reports.find((r) => r.id === id),
    };
    for (const [key, fn] of Object.entries(callbacks))
      R[key] = (...args) => {
        calls.push([key, structuredClone(args)]);
        if (++n === x.fail) throw Error("interrupted:" + key);
        if (x.mutate) R.S.F.inspector = "Replacement";
        return fn(...args);
      };
    let value,
      error = null;
    try {
      value = api[method](R, x.asOf ? "asOf" : "period");
    } catch (e) {
      error = [e.name, e.message];
    }
    return { value, error, calls, state: R.S };
  }
  let count = 0;
  for (let i = 0; i < 512; i++)
    for (const method of ["reportNavigation", "reportActions", "appliedFilters", "coverage"]) {
      const x = {
        screen: ["openCases", "other", "property"][i % 3],
        saved: !!(i & 1),
        zip: !!(i & 2),
        boundary: !!(i & 4),
        filter: !!(i & 8),
        missing: !!(i & 16),
        stale: !!(i & 32),
        bad: !!(i & 64),
        mismatch: !!(i & 128),
        old: !!(i & 256),
        unlocated: !!(i & 4),
        asOf: !!(i & 8),
        fail: i % 7 === 0 ? (i % 17) + 1 : 0,
        mutate: i % 11 === 0,
      };
      assert.deepEqual(run(current, method, x), run(original, method, x), method + ":" + i);
      count++;
    }
  const hostile = '\" data-injected=\"yes',
    encoded = current.reportNavigation({
      S: { screen: "other" },
      REPORTS: [{ id: hostile, label: "Literal <&>" }],
      reportById: () => null,
      esc: current.esc,
    });
  assert.ok(encoded.includes('data-screen="&quot; data-injected=&quot;yes"'));
  assert.ok(encoded.includes("Literal &lt;&amp;&gt;"));
  assert.equal(count, 2048);
  console.log("PASS Reports presentation templates " + count + " exact HTML/state/callback comparisons");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
