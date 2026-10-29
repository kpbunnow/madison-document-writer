/* Tools & settings screen against the retained module: exact markup for every theme, with the shell and icon
   peers recorded in order. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { compile, prng, recorder } = require("../fixtures/equivalence_harness.cjs");

const { pick, chance, random } = prng(20261304);

function run(api, sc) {
  const calls = [];
  globalThis.document = { documentElement: { dataset: sc.theme === null ? {} : { theme: sc.theme } } };
  const returns = {
    shell: (...args) => JSON.stringify(args),
    uiIcon: (name) => "[icon:" + name + "]",
  };
  const services = recorder(calls, returns, {}, sc.fail);
  const owner = api.initNavigation(services);
  assert.deepEqual(calls, [], "construction remains inert");
  let value, error;
  try {
    value = owner.screen();
  } catch (e) {
    error = [e.name, e.message];
  }
  return JSON.stringify({ value, error, calls });
}

(async () => {
  const [current, legacy] = await Promise.all([
    compile('export {initNavigation} from "./navigation.js";'),
    compile(fs.readFileSync("tests/fixtures/navigation_reference.txt", "utf8")),
  ]);
  const seen = new Set();
  for (let n = 0; n < 400; n++) {
    const sc = { theme: pick([null, "system", "light", "dark", "high", "other"]), fail: chance(3) ? 1 + random(12) : 0 };
    const [before, after] = [run(legacy, sc), run(current, sc)];
    assert.equal(after, before, `tools screen scenario ${n} differs from the retained module:\n${JSON.stringify(sc)}`);
    const parsed = JSON.parse(after);
    if (parsed.value)
      for (const f of [
        "selected",
        "Search shared case records",
        "Exit Document Writer",
        "Administrator tools",
        "Program instructions",
        "Color theme",
        "Keyboard shortcuts",
        "[icon:search]",
        "[icon:tools]",
      ])
        if (parsed.value.includes(f)) seen.add(f);
    if (parsed.error) seen.add("interrupted");
  }
  for (const f of [
    "selected",
    "Search shared case records",
    "Exit Document Writer",
    "Administrator tools",
    "Program instructions",
    "Color theme",
    "Keyboard shortcuts",
    "[icon:search]",
    "[icon:tools]",
    "interrupted",
  ])
    assert.ok(seen.has(f), "scenarios reach: " + f);
  console.log("PASS tools screen matches the retained module over 400 scenarios");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
