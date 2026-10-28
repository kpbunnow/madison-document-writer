/* Public Reports owner comparison pins model links, stale exclusions and lookup/service timing. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
(async () => {
  const source = fs.readFileSync("app/modules/reports_services.js", "utf8"),
    factory = acorn
      .parse(source, { ecmaVersion: 2022, sourceType: "module" })
      .body.find((n) => n.declaration?.id?.name === "createReportsServices").declaration,
    fn = factory.body.body.find((n) => n.id?.name === "buildModel"),
    reference = fs.readFileSync("tests/fixtures/report_model_reference.txt", "utf8");
  async function compile(contents) {
    const b = await esbuild.build({
      stdin: { contents: contents + '\nexport {ReportsState} from "./state.js";', resolveDir: path.resolve("app/modules") },
      bundle: true,
      write: false,
      format: "cjs",
      define: { __TEST_BUILD__: "false" },
    });
    const box = { exports: {} };
    new Function("module", "exports", b.outputFiles[0].text)(box, box.exports);
    return box.exports;
  }
  const [current, legacy] = await Promise.all([compile(source), compile(source.slice(0, fn.start) + reference + source.slice(fn.end))]);
  let seed = 20261105,
    checked = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (a) => a[random(a.length)];
  function fixture() {
    return {
      summaries: [
        {
          summaryVersion: 6,
          case: {
            number: "QA-REPORT",
            parcel: "0708-222-1910-3",
            ownerAddr: ["101 TEST ST", "MADISON WI 53703"],
            opened: "2026-01-01",
            noticeIssued: "2026-01-02",
          },
          violations: [{ type: "wall", typeLabel: "Wall", sections: ["27.05 (2) (c)"], history: [{ sections: ["27.01"] }] }],
          citations: [{ ordinance: "27.05 (2) (c)", by: "TEST INSPECTOR" }],
          referrals: [{ ownerAddr: ["101 TEST ST", "MADISON WI 53703"] }],
        },
      ],
      parcels: { "070822219103": { history: [{ fetched: "2026-01-01", alder: 1, lat: 43.1, lon: -89.4 }] } },
      areas: {},
      missing: [],
    };
  }
  function run(api, input, failAt) {
    const data = structuredClone(input),
      calls = [];
    let effects = 0;
    api.ReportsState.S = { parcelMissing: data.missing };
    const services = new Proxy(
      {},
      {
        get(_, key) {
          calls.push("get:" + String(key));
          if (key === "STREET_WORDS") return {};
          return (...args) => {
            calls.push(["call:" + String(key), ...args.map((x) => (typeof x === "object" ? "object" : x))]);
            if (++effects === failAt) throw Error("interrupted service");
            if (key === "validISO") return /^\d{4}-\d{2}-\d{2}$/.test(args[0] || "");
            if (key === "uniq") return [...new Set(args[0])];
            if (key === "areaIdOf") return String(args[0].properties[args[1]] ?? "");
          };
        },
      },
    );
    const owner = api.createReportsServices(services);
    assert.deepEqual(calls, [], "inert construction");
    let value,
      error,
      links = [];
    try {
      value = owner.buildModel(data.summaries, data.parcels, data.areas);
      links = value.cases.map((c) => ({
        summary: data.summaries.includes(c.summary),
        ownerAddr: c.ownerAddr === c.summary.case?.ownerAddr,
        violations: c.violations.every((v) => v.c === c),
        citations: c.citations.every((v) => v.c === c),
        referrals: c.referrals.every((v) => v.c === c),
        byNo: value.byNo[c.number] === c,
      }));
    } catch (e) {
      error = [e.name, e.message];
    }
    return { value, error, links, calls, data, state: api.ReportsState.S };
  }
  function compare(x, failAt) {
    assert.deepEqual(run(current, x, failAt), run(legacy, x, failAt), "scenario " + checked++);
  }
  const initial = run(current, fixture());
  assert.equal(initial.error, undefined);
  assert.equal(initial.value.counted.length, 1);
  assert.ok(initial.links[0].violations && initial.links[0].citations && initial.links[0].referrals && initial.links[0].summary);
  compare(fixture());
  const area = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { ZIP: "53703", DISTRICT: "1" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-90, 42],
              [-89, 42],
              [-89, 44],
              [-90, 44],
              [-90, 42],
            ],
          ],
        },
      },
    ],
  };
  for (let n = 0; n < 3000; n++) {
    const x = fixture();
    x.summaries = Array.from({ length: random(5) }, (_, i) => {
      const s = structuredClone(fixture().summaries[0]);
      s.summaryVersion = pick([undefined, 5, 6, 7]);
      s.case.number = pick(["QA-REPORT", "QA-" + i]);
      s.case.caseType = pick(["", "snow-10.28"]);
      s.case.noticeIssued = pick(["", "2026-01-02"]);
      s.case.noticeActive = pick([false, true, undefined]);
      s.case.zip = pick(["", "53703"]);
      s.case.opened = pick(["2026-01-01", "2026-06-01", "bad"]);
      s.case.ownerAddressKey = pick([undefined, "retained-key"]);
      if (random(3) === 0) s.citations = [];
      if (random(3) === 0) s.violations = [];
      return s;
    });
    x.parcels["070822219103"].history = Array.from({ length: random(5) }, () => ({
      fetched: pick(["2025-01-01", "2026-01-01", "2026-10-24", "bad"]),
      alder: pick([null, 1, "2"]),
      building: pick([undefined, 42, "building"]),
      lat: pick([undefined, null, 43.1, 91]),
      lon: pick([undefined, -89.4, 181]),
    }));
    x.areas = pick([{}, null, { zips: area, districts: area }]);
    x.missing = random(2) ? ["070822219103"] : [];
    compare(x);
    if (n < 100) for (const failAt of [1, 3, 5, 10]) compare(x, failAt);
  }
  console.log("PASS report model equivalence " + checked + " scenarios: stale versions, parcel history, geometry, object links and service effects");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
