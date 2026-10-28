/* Policy-row and malformed-input comparison against retained amount resolution. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
(async () => {
  const source = fs.readFileSync("app/modules/citation_policy.js", "utf8"),
    fn = acorn
      .parse(source, { ecmaVersion: 2022, sourceType: "module" })
      .body.find((n) => n.declaration?.id?.name === "resolveCitationAmount").declaration,
    reference = fs.readFileSync("tests/fixtures/citation_resolution_reference.txt", "utf8");
  async function compile(contents) {
    const built = await esbuild.build({
      stdin: { contents: contents + "\nexport {ruleBase};", resolveDir: path.resolve("app/modules") },
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
    return box.exports;
  }
  const baseFn = acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" }).body.find((n) => n.id?.name === "ruleBase");
  const baseReference = fs.readFileSync("tests/fixtures/citation_rule_base_reference.txt", "utf8");
  const ordinanceFn = acorn
    .parse(source, { ecmaVersion: 2022, sourceType: "module" })
    .body.find((n) => n.declaration?.id?.name === "resolveOrdinance").declaration;
  const ordinanceReference = fs.readFileSync("tests/fixtures/citation_ordinance_reference.txt", "utf8");
  let retained = source;
  for (const [node, text] of [
    [fn, reference],
    [baseFn, baseReference],
  ].sort((a, b) => b[0].start - a[0].start))
    retained = retained.slice(0, node.start) + text + retained.slice(node.end);
  const [current, legacy] = await Promise.all([compile(source), compile(retained)]);
  let seed = 20261031,
    checked = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (a) => a[random(a.length)];
  function run(api, input, failAt) {
    const data = structuredClone(input),
      reads = [];
    let result, error;
    const proxies = new WeakMap(),
      originals = new WeakMap();
    function proxy(value) {
      if (!value || typeof value !== "object") return value;
      if (proxies.has(value)) return proxies.get(value);
      const wrapped = new Proxy(value, {
        get(target, key, receiver) {
          if (typeof key === "string") {
            reads.push(key);
            if (reads.length === failAt) throw Error("interrupted input read");
          }
          return proxy(Reflect.get(target, key, receiver));
        },
      });
      proxies.set(value, wrapped);
      originals.set(wrapped, value);
      return wrapped;
    }
    function snapshot(value) {
      if (!value || typeof value !== "object") return value;
      if (originals.has(value)) return structuredClone(originals.get(value));
      if (Array.isArray(value)) return value.map(snapshot);
      return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, snapshot(v)]));
    }
    try {
      result = api.resolveCitationAmount(proxy(data));
    } catch (e) {
      error = [e.name, e.message];
    }
    return { result: snapshot(result), error, data, reads };
  }
  function compare(input, failAt) {
    assert.deepEqual(run(current, input, failAt), run(legacy, input, failAt), "scenario " + checked);
    checked++;
  }
  const rows = current.policyAt("2026-10-24").entries;
  for (const row of rows)
    for (const tier of [1, 2, 3, 8])
      for (const date of ["2026-06-30", "2026-10-24"]) {
        const measurements = Object.fromEntries((row.measurements || []).map((f) => [f.key, f.boolean ? true : (f.min ?? 1)]));
        compare({ ordinance: row.ordinance, entryId: row.id, tier, date, measurements });
      }
  const dates = [undefined, null, "", "invalid", "2026-02-30", "2026-06-30", "2026-07-01", "2026-10-24", "1950-01-01"];
  for (let n = 0; n < 4000; n++) {
    const row = pick(rows),
      input = {
        ordinance: pick([row.ordinance, "", null, "SPS321.125", "29.40(4)(b)"]),
        entryId: pick([row.id, "", "missing"]),
        tier: pick([undefined, null, 0, 1, 3, 5, "2", "bad"]),
        date: pick(dates),
        measurements: pick([
          undefined,
          null,
          {},
          { area: pick([0, 99999, 100000, Infinity]), days: pick([0, 1, 30, 60]), diameter: pick([0, 1, 8, 16, NaN]), removed: !!random(2) },
        ]),
      };
    compare(input);
    if (n < 100) for (const failAt of [1, 5, 10, 15]) compare(input, failAt);
  }
  for (const input of [undefined, null, false, {}, { date: "2026-10-24" }]) compare(input);
  let resolved = 0;
  const resolve = (api, args) => {
    try {
      return { value: api.resolveOrdinance(...args) };
    } catch (e) {
      return { error: [e.name, e.message] };
    }
  };
  for (const [key, mappings] of Object.entries(current.CITATION_POLICY.itemMappings))
    for (const mapping of mappings)
      for (const date of [undefined, "2026-06-30", "2026-10-24"])
        for (const entryId of ["", "missing"]) {
          const args = [mapping.chargedOrdinance, key, entryId, date];
          assert.deepEqual(resolve(current, args), resolve(legacy, args), "mapped ordinance " + resolved++);
        }
  for (const row of rows)
    for (const entryId of [row.id, "", "missing"]) {
      const args = [row.ordinance, "", entryId, "2026-10-24"];
      assert.deepEqual(resolve(current, args), resolve(legacy, args), "scheduled ordinance " + resolved++);
    }
  let measured = 0;
  for (const row of rows)
    for (const field of row.measurements || [{ key: "unused" }])
      for (const value of [undefined, null, false, true, -1, 0, 1, 15, 99999, 100000, Infinity, NaN, "1"])
        for (const tier of [1, 2, 8]) {
          const measurements = Object.fromEntries((row.measurements || []).map((f) => [f.key, f.boolean ? true : (f.min ?? 1)]));
          measurements[field.key] = value;
          const outcome = (api) => {
            try {
              return { value: api.ruleBase(row, tier, measurements) };
            } catch (e) {
              return { error: [e.name, e.message] };
            }
          };
          assert.deepEqual(outcome(current), outcome(legacy), "measurement scenario " + measured++);
        }
  console.log(
    "PASS citation resolution equivalence " +
      checked +
      " scenarios and " +
      measured +
      " direct measurement cases and " +
      resolved +
      " ordinance selections: policy rows, boundaries, dates, property reads and exceptions",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
