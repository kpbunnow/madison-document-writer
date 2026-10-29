/* Filtering preserves current/as-of notice rules, historical violations and lazy reads. */
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
    fn = factory.body.body.find((n) => n.id?.name === "caseOk"),
    reference = fs.readFileSync("tests/fixtures/report_filter_reference.txt", "utf8");
  async function compile(contents) {
    const b = await esbuild.build({
      stdin: { contents, resolveDir: path.resolve("app/modules") },
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
  let seed = 20261106,
    checked = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (a) => a[random(a.length)];
  function fixture() {
    return {
      c: {
        caseType: "",
        noticeIssued: "2026-01-01",
        noticeActive: true,
        documents: [],
        citations: [],
        violations: [{ type: "wall", sections: ["27.01"], withdrawn: false }],
        status: "Notice",
        closedOn: "",
        zip: "53703",
        alderAtOpen: "1",
        alderNow: "2",
        inspector: "TEST",
        ownerKey: "owner",
      },
      F: { areas: [], areaType: "zip", boundary: "now", inspector: "", owner: "", status: "", vtype: "", ord: "" },
      opt: undefined,
    };
  }
  function run(api, input, failAt) {
    const data = structuredClone(input),
      reads = [],
      cache = new WeakMap();
    function track(value, at) {
      if (!value || typeof value !== "object") return value;
      if (cache.has(value)) return cache.get(value);
      const p = new Proxy(value, {
        get(t, k, r) {
          if (typeof k === "string") {
            reads.push(at + "." + k);
            if (reads.length === failAt) throw Error("interrupted read");
          }
          return track(Reflect.get(t, k, r), at + "." + String(k));
        },
      });
      cache.set(value, p);
      return p;
    }
    const services = new Proxy(
      {},
      {
        get(_, key) {
          // The day is asked for when it is used (currentDay); the retained original read it as TODAY. Same read, same day.
          reads.push("services." + String(key === "currentDay" ? "TODAY" : key));
          if (key === "TODAY") return "2026-10-28";
          if (key === "currentDay") return () => "2026-10-28";
          if (key === "violOk")
            return (v, F) => {
              reads.push("call:violOk");
              return (!F.vtype || v.type === F.vtype) && (!F.ord || v.sections.includes(F.ord));
            };
          throw Error("unexpected service " + String(key));
        },
      },
    );
    const owner = api.createReportsServices(services);
    assert.deepEqual(reads, [], "inert construction");
    let value, error;
    try {
      value = owner.caseOk(track(data.c, "case"), track(data.F, "filters"), track(data.opt, "options"));
    } catch (e) {
      error = [e.name, e.message];
    }
    return { value, error, reads, data };
  }
  function compare(input, failAt) {
    assert.deepEqual(run(current, input, failAt), run(legacy, input, failAt), "scenario " + checked++);
  }
  assert.equal(run(current, fixture()).value, true);
  compare(fixture());
  for (let n = 0; n < 4000; n++) {
    const x = fixture();
    x.c.caseType = pick(["", "snow-10.28"]);
    x.c.noticeIssued = pick(["", "2026-01-01", "2026-11-01"]);
    x.c.noticeActive = pick([true, false, undefined]);
    x.c.status = pick(["Notice", "Closed", "Withdrawn", "Cited – snow", "Referred"]);
    x.c.closedOn = pick(["", "2026-01-01", "2026-11-01"]);
    x.c.citations = random(2) ? [{ id: "citation" }] : [];
    x.c.documents = Array.from({ length: random(4) }, (_, i) => ({
      id: "d" + i,
      type: pick(["notice", "citation", "compliance", "referral", "noOccupancy"]),
      effectiveFrom: pick(["2026-01-01", "2026-11-01"]),
      effectiveTo: pick(["", "2026-09-01"]),
      void: random(5) === 0,
      voidAt: pick(["", "2026-09-01"]),
      special: { mode: pick(["restrict", "release"]), releases: "d0" },
    }));
    x.c.violations[0].withdrawn = !!random(2);
    x.c.violations[0].history = random(2)
      ? [{ effectiveFrom: "2026-01-01", effectiveTo: "", type: "wall", sections: ["27.01"], withdrawn: !!random(2) }]
      : [];
    x.F.areas = pick([[], ["53703"], ["1"], ["other"]]);
    x.F.areaType = pick(["zip", "district"]);
    x.F.boundary = pick(["now", "atOpen"]);
    x.F.inspector = pick(["", "TEST", "OTHER"]);
    x.F.owner = pick(["", "owner", "other"]);
    x.F.status = pick(["", "open", "Notice", "Closed"]);
    x.F.vtype = pick(["", "wall", "other"]);
    x.F.ord = pick(["", "27.01", "27.05"]);
    x.opt = pick([
      undefined,
      null,
      { noNotice: !!random(2), noInspector: !!random(2), noViol: !!random(2), asOf: pick(["", "2026-10-01", "2025-01-01"]) },
    ]);
    compare(x);
    if (n < 100) for (const failAt of [1, 5, 15, 30, 50]) compare(x, failAt);
  }
  console.log("PASS Reports filter equivalence " + checked + " scenarios: notice/status precedence, as-of fields, input and service reads");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
