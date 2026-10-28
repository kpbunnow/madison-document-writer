/* Refusal precedence and observable input reads against the retained validator. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
(async () => {
  const source = fs.readFileSync("app/modules/case_file_rules.js", "utf8"),
    fn = acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" }).body.find((n) => n.declaration?.id?.name === "caseFileFault").declaration,
    reference = fs.readFileSync("tests/fixtures/case_file_fault_reference.txt", "utf8");
  async function compile(contents) {
    const built = await esbuild.build({
      stdin: { contents, resolveDir: path.resolve("app/modules") },
      bundle: true,
      write: false,
      format: "cjs",
      plugins: [
        {
          name: "data",
          setup(build) {
            build.onResolve({ filter: /\/data\// }, (args) => ({ path: path.resolve("build/generated/modules/data", path.basename(args.path)) }));
          },
        },
      ],
    });
    const box = { exports: {} };
    new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
    return box.exports.caseFileFault;
  }
  const [current, legacy] = await Promise.all([compile(source), compile(source.slice(0, fn.start) + reference + source.slice(fn.end))]);
  let seed = 20261029,
    checked = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed % n;
    },
    pick = (values) => values[random(values.length)];
  const fixture = () => ({ format: "madison-case-file", case: { id: "case", number: "QA-001" }, events: [] });
  function observe(validate, input, failAt) {
    const data = structuredClone(input),
      reads = [],
      seen = new WeakMap();
    function track(value, location) {
      if (!value || typeof value !== "object") return value;
      if (seen.has(value)) return seen.get(value);
      const proxy = new Proxy(value, {
        get(target, key, receiver) {
          if (typeof key === "string") {
            reads.push(location + "." + key);
            if (reads.length === failAt) throw new Error("read interruption");
          }
          return track(Reflect.get(target, key, receiver), location + "." + String(key));
        },
      });
      seen.set(value, proxy);
      return proxy;
    }
    let result, error;
    try {
      result = validate(track(data, "file"));
    } catch (e) {
      error = [e.name, e.message];
    }
    return { result, error, reads, data };
  }
  function compare(input, failAt) {
    assert.deepEqual(observe(current, input, failAt), observe(legacy, input, failAt), "scenario " + checked);
    checked++;
  }
  assert.equal(current(fixture()), "");
  for (const invalid of [null, undefined, false, 0, "file", [], {}, { format: "other" }]) compare(invalid);
  for (let n = 0; n < 3000; n++) {
    const f = fixture();
    if (random(6) === 0) f.case = pick([null, [], "case", {}, { id: "", number: "QA" }]);
    if (f.case && typeof f.case === "object") {
      for (const field of ["ownerAddr", "emails", "ccList"]) if (random(3) === 0) f.case[field] = pick([null, "bad", [], [1], ["line"]]);
    }
    if (random(3) === 0) f.inspectors = pick([null, {}, [], [null], [{ id: "i1" }], [{ id: "" }]]);
    f.events = Array.from({ length: random(5) }, (_, i) => {
      const e = {
        id: "event" + i,
        at: "2026-10-28T12:00:00Z",
        type: pick(["notice.issued", "correction.issued", "reinspection.recorded", "case.updated"]),
        payload: {},
      };
      if (random(3) === 0) e.id = pick(["", "event0", "bad id", null]);
      if (random(4) === 0) e.at = pick(["", "bad", null]);
      if (random(4) === 0) e.type = "";
      e.payload.snapshot = pick([
        undefined,
        null,
        {},
        { id: "doc" + i, caseId: "case", type: "notice", items: [{ id: "item", sections: ["27.01"] }] },
      ]);
      if (e.payload.snapshot?.items && random(3) === 0) e.payload.snapshot.items = pick([null, [null], [{ id: "item", sections: [1] }], []]);
      if (e.payload.snapshot && random(3) === 0) e.payload.snapshot.frozen = { case: { ownerAddr: pick(["bad", [], null]) } };
      e.payload.reinspection = pick([null, {}, "bad"]);
      e.payload.replaces = "doc0";
      e.payload.baseEventId = "event0";
      e.payload.reason = "correction";
      if (random(8) === 0) e.payload = pick([null, "bad", []]);
      return random(15) === 0 ? null : e;
    });
    if (random(10) === 0) f.events = pick([null, {}, "bad"]);
    compare(f);
    if (n < 100) for (const failAt of [1, 5, 15, 30]) compare(f, failAt);
  }
  for (let failAt = 1; failAt <= 60; failAt++) compare(fixture(), failAt);
  console.log("PASS case file validator equivalence " + checked + " scenarios: refusals, input reads, exceptions and unchanged input");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
