/* Classify downgrade markers independently while retaining the real cryptographic verifier. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  esbuild = require("esbuild");
global.crypto = require("node:crypto").webcrypto;
function load(file) {
  const contents = fs.readFileSync(file, "utf8"),
    built = esbuild.buildSync({ stdin: { contents }, bundle: true, write: false, format: "cjs", platform: "node" });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  return box.exports;
}
(async () => {
  const current = load("app/modules/record_integrity.js"),
    original = load("tests/fixtures/record_integrity_reference.txt");
  let checked = 0;
  async function compare(value) {
    async function run(api) {
      const x = structuredClone(value);
      try {
        return { result: await api.verifyIntegrity(x), value: x };
      } catch (e) {
        return { error: [e.name, e.message], value: x };
      }
    }
    assert.deepEqual(await run(current), await run(original), "case " + checked++);
  }
  for (const schema of [undefined, null, 0, 1, 4, 5, 6, "4", "5"])
    for (const marker of [{}, { integrity: null }, { pricedOn: "" }, { policyVersionHash: null }, { authoringVersion: 7 }, { authoringVersion: 6 }])
      for (const depth of [0, 1, 5, 20]) {
        let nested = marker;
        for (let n = 0; n < depth; n++) nested = { child: [null, false, {}, nested] };
        await compare({ schema, case: nested, events: [] });
      }
  const valid = JSON.parse(fs.readFileSync("tests/fixtures/reference/integrity-case.json", "utf8"));
  await compare(valid);
  for (const key of ["genesis", "entries", "commits", "headHash"])
    for (const value of [null, {}, [], "bad"]) {
      const x = structuredClone(valid);
      x.integrity[key] = value;
      await compare(x);
    }
  for (const change of [
    (x) => x.events.reverse(),
    (x) => x.events.pop(),
    (x) => x.events.push(x.events[0]),
    (x) => {
      x.case.owner = "Tampered";
    },
    (x) => {
      x.events.at(-1).payload.snapshot.cits.charged_item.amount = "1.00";
    },
  ]) {
    const x = structuredClone(valid);
    change(x);
    await compare(x);
  }
  console.log("PASS integrity classification equivalence " + checked + " inputs: nested downgrade markers, real chain and tamper/refusal metadata");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
