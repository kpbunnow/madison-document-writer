/* Public line formatting retains normalization fallbacks, blank filtering and access/error order. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
const source = fs.readFileSync("app/modules/address_format.js", "utf8"),
  reference = fs.readFileSync("tests/fixtures/recipient_lines_reference.txt", "utf8");
const ast = (s) => acorn.parse(s, { ecmaVersion: 2022, sourceType: "module" }),
  clean = (n) => JSON.parse(JSON.stringify(n, (k, v) => (["start", "end", "raw"].includes(k) ? undefined : v)));
for (const node of ast(reference).body) {
  const name = node.declaration.declarations[0].id.name;
  assert.deepEqual(
    clean(ast(source).body.find((n) => n.declaration?.declarations?.[0]?.id.name === name)),
    clean(node),
    "retained " + name + " declaration",
  );
}
const compiled = esbuild.buildSync({ entryPoints: ["app/modules/address_format.js"], bundle: true, format: "cjs", write: false }).outputFiles[0].text,
  box = { exports: {} };
new Function("module", "exports", compiled)(box, box.exports);
const api = box.exports;
const old = new Function(
  "standardStreetAddress",
  "standardCityStateZip",
  reference.replaceAll("export const ", "const ") + ";return {ccLines,agentLines};",
)(api.standardStreetAddress, api.standardCityStateZip);
function result(fn, input, normalize, fail) {
  const trace = [];
  let step = 0;
  const wrap = (values) =>
    new Proxy(values, {
      get(t, k) {
        trace.push(String(k));
        if (++step === fail) throw Error("interrupted:" + String(k));
        return t[k];
      },
    });
  const record = wrap({ ...input, agent: wrap(input.agent || {}) });
  try {
    return { value: fn(record, normalize), trace };
  } catch (e) {
    return { error: [e.name, e.message], trace };
  }
}
let count = 0;
const values = [
  "",
  null,
  undefined,
  0,
  "  Name <&>  ",
  "123 north MAIN street, apartment 2",
  "madison wi 53703",
  "Ambiguous text",
  "12B McFarland road",
];
for (let i = 0; i < 4096; i++) {
  const fields = { name: values[i % 9], addr: values[Math.floor(i / 9) % 9], city: values[Math.floor(i / 81) % 9] },
    input = { ...fields, agent: fields },
    normalize = [true, false, undefined][i % 3],
    fail = i % 11 === 0 ? (i % 7) + 1 : 0;
  for (const name of ["ccLines", "agentLines"]) {
    assert.deepEqual(result(api[name], input, normalize, fail), result(old[name], input, normalize, fail), name + ":" + i);
    count++;
  }
}
assert.deepEqual(api.ccLines({ name: " Jane Doe ", addr: "123 north Main Street", city: "madison wi 53703" }), [
  "Jane Doe",
  "123 N Main St",
  "Madison, WI 53703",
]);
assert.deepEqual(api.agentLines({ agent: { name: " ", addr: " Ambiguous text ", city: " Nowhere " } }), ["Ambiguous text", "Nowhere"]);
console.log("PASS recipient lines " + count + " exact retained output/access/error comparisons");
