/* Exact supported deposit form HTML and live adapter/error order through the public owner. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
(async () => {
  const source = fs.readFileSync("app/modules/deposit_step.js", "utf8"),
    tree = acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" }),
    fn = tree.body.find((n) => n.declaration?.id?.name === "initDepositStep").declaration.body.body.find((n) => n.id?.name === "form"),
    reference = fs.readFileSync("tests/fixtures/deposit_form_reference.txt", "utf8");
  async function load(contents) {
    const built = await esbuild.build({
      stdin: { contents: contents + '\nexport {chargeChoices,choosesCharge} from "./citation_charges.js";', resolveDir: path.resolve("app/modules") },
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
    new Function("document", "module", "exports", built.outputFiles[0].text)({ addEventListener() {} }, box, box.exports);
    return box.exports;
  }
  const [current, original] = await Promise.all([load(source), load(source.slice(0, fn.start) + reference + source.slice(fn.end))]);
  function run(api, x) {
    const calls = [];
    let step = 0;
    const d = { id: 'document <&> "id"' },
      i = { id: 'item <&> "id"', no: "1 <&>", sections: x.multiple ? ["27.05(2)(c)", "29.40(4)(b)"] : ["27.05(2)(c)"] },
      c = {
        ord: x.ord,
        depositMode: x.mode,
        reason: 'Reason <&> "text"',
        base: x.value,
        amount: x.value,
        depositSource: "Approved <&> source",
        measurements: { diameter: x.value, removed: x.removed },
        measurementFields: x.measured
          ? [
              { key: "removed", label: "Removed <&>", boolean: true },
              { key: "diameter", label: "Diameter <&>", min: x.minimum, max: x.maximum, whole: x.whole },
            ]
          : [],
      };
    const invoke =
      (name, fn) =>
      (...a) => {
        calls.push([name, structuredClone(a)]);
        if (++step === x.fail) throw Error("interrupted:" + name);
        return fn(...a);
      };
    const services = { chargeChoices: invoke("choices", api.chargeChoices), choosesCharge: invoke("multiple", api.choosesCharge) };
    const owner = api.initDepositStep(services);
    assert.equal(calls.length, 0);
    let value,
      error = null;
    try {
      value = owner.form(d, i, c);
    } catch (e) {
      error = [e.name, e.message];
    }
    return { value, error, calls, d, i, c };
  }
  let count = 0,
    measured = 0,
    manual = 0,
    multi = 0;
  for (let n = 0; n < 4096; n++) {
    const x = {
      multiple: !!(n & 1),
      measured: !!(n & 2),
      mode: ["base", "total", "schedule", ""][Math.floor(n / 4) % 4],
      ord: ["27.05(2)(c)", "29.40(4)(b)", "SPS321.125", ""][Math.floor(n / 16) % 4],
      value: [null, 0, 12, "1.25", ""][Math.floor(n / 64) % 5],
      removed: [true, false, undefined][Math.floor(n / 320) % 3],
      minimum: n % 3 ? 0 : 1,
      maximum: n % 5 ? 100 : null,
      whole: n % 7 === 0,
      fail: n % 19 === 0 ? (n % 2) + 1 : 0,
    };
    const result = run(current, x);
    assert.deepEqual(result, run(original, x), "form:" + n);
    if (result.value) {
      if (x.measured) measured++;
      else manual++;
      if (x.multiple) multi++;
    }
    count++;
  }
  assert.ok(measured > 1000 && manual > 1000 && multi > 1000);
  assert.equal(count, 4096);
  console.log("PASS deposit form templates " + count + " exact HTML/state/adapter/error comparisons");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
