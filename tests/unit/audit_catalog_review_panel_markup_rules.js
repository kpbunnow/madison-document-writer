/* Catalog review panel against the retained module: exact markup for every review status, open and closed forms,
   rebase and error notices, replacement search and escaping, with every peer read and call in order. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { compile, prng, recorder } = require("../fixtures/equivalence_harness.cjs");

globalThis.__TEST_BUILD__ = true;
const { random, pick, chance } = prng(20261404);

function entry(n) {
  return {
    k: "k" + n,
    t: pick(["Weeds <tall>", "Siding", "Gutters & drains"]),
    a: pick(["Cut the weeds", "Repair <siding>", ""]),
    s: pick([[], ["27.05"], ["27.05", "27.06"]]),
    p: pick(["draft", "export", "", "legacy"]),
    legacyKeys: pick([undefined, [], ["old <1>", "old2"]]),
  };
}

function review(key, n) {
  return {
    id: "e" + n,
    key,
    status: pick(["approved", "approved", "approved", "retired"]),
    version: 1 + random(3),
    reviewer: pick(["Pat <R>", "Sam"]),
    at: "2026-10-1" + random(9) + "T10:00:00Z",
    source: pick(["Ord & code", "Memo"]),
    ordinances: pick([["27.05"], ["27.05", "27.06"]]),
    wording: pick(["Reviewed <text>", "Reviewed text"]),
    replaces: pick(["", "", "k2", "k0"]),
  };
}

function scenario() {
  const items = Array.from({ length: 1 + random(4) }, (_, n) => entry(n)),
    events = [];
  items.forEach((it, n) => {
    if (chance(2)) events.push(review(it.k, n));
    if (chance(5)) events.push(review(it.k, n + 10));
  });
  const target = pick(items),
    forms = {};
  if (chance(2))
    forms[target.k] = {
      reviewer: pick(["", "Lee <x>"]),
      wording: pick(["Draft <w>", ""]),
      ordinances: pick(["", "27.05; 27.07"]),
      source: pick(["", "Src & more"]),
      replaces: pick(["", "k1", "k2", "gone"]),
      baseVersion: random(4),
      open: chance(2),
      error: pick(["", "", "Could not save <now>"]),
      replacementQuery: pick([undefined, "", "weeds", "k1", "siding"]),
    };
  return { items, events, target, forms, verified: !chance(4), fail: chance(4) ? 1 + random(10) : 0 };
}

function run(api, sc) {
  const x = structuredClone(sc),
    calls = [];
  Object.assign(api.WriterState, { CATALOG_EVENTS: x.events, CATALOG_FORMS: x.forms, CATALOG_VERIFIED: x.verified });
  const returns = { catalogKey: (i) => i.k, allItems: () => x.items };
  const services = recorder(calls, returns, {}, x.fail);
  const owner = api.createLanguageCatalog(services);
  assert.deepEqual(calls, [], "construction remains inert");
  let value, error;
  try {
    value = owner.catalogReviewPanel(x.target);
  } catch (e) {
    error = [e.name, e.message];
  }
  return JSON.stringify({ value, error, calls });
}

(async () => {
  const [current, legacy] = await Promise.all([
    compile('export {createLanguageCatalog} from "./language_catalog.js";'),
    compile(fs.readFileSync("tests/fixtures/catalog_review_panel_reference.txt", "utf8")),
  ]);
  const seen = new Set(),
    wanted = [
      "Reviewed v",
      "Retired · historical only",
      "Replaced by",
      "Legacy selection",
      "Draft · division review required",
      "Missing ordinance",
      "selection paused",
      "Compare bundled",
      "Unsubmitted form",
      "save-error",
      "data-catalog-rebase",
      "Open to browse entries",
      "Preferred over",
      " open>",
      "overlaps",
      "&lt;",
      "interrupted",
      "None</option>",
      "selected",
    ];
  for (let n = 0; n < 6000; n++) {
    const sc = scenario();
    const [before, after] = [run(legacy, sc), run(current, sc)];
    assert.equal(after, before, `catalog review panel scenario ${n} differs from the retained module:\n${JSON.stringify(sc)}`);
    for (const f of wanted) if (after.includes(f)) seen.add(f);
  }
  for (const f of wanted) assert.ok(seen.has(f), "scenarios reach: " + f);
  console.log("PASS catalog review panel matches the retained module over 6000 scenarios");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
