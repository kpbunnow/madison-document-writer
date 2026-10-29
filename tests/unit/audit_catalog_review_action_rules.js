/* Catalog review actions against the retained module: rebase confirmation, field validation order, the recorded
   review and its cache, retained-edit detection, failures, every peer call in order, and refusal on the first
   interrupted read or call. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { compile, prng, recorder, listenerTarget } = require("../fixtures/equivalence_harness.cjs");

process.on("unhandledRejection", () => {});
const { random, pick, chance } = prng(20261203);

function scenario() {
  const values = () => ({
    reviewer: pick(["R. Reviewer", "R. Reviewer", "R. Reviewer", "", "  "]),
    wording: pick(["Approved wording", "", "w"]),
    ordinances: pick(["27.05(2)(c); 29.40(4)(b)", "", ";", "27.05"]),
    source: pick(["Source A", "Source A", "", "x"]),
    replaces: pick(["", "", "", "", "other", "k1"]),
  });
  return {
    kind: pick(["rebase", "save", "save", "save", "none", "nosave"]),
    key: pick(["k1", "k2", "gone"]),
    review: pick([null, { version: 3 }]),
    item: pick([null, { t: "Item title" }]),
    other: pick([null, { t: "Other" }]),
    form: pick([undefined, { baseVersion: 2, reviewer: "old" }, { baseVersion: 1 }]),
    values: values(),
    later: pick([
      undefined,
      undefined,
      { reviewer: "edited", open: false },
      { reviewer: "" },
      { reviewer: "  R. Reviewer  ", wording: "Approved wording " },
    ]),
    status: pick(["approved", "rejected", "pending"]),
    confirm: pick([true, true, false]),
    outcome: pick(["ok", "ok", "ok", "throw", "same", "removed"]),
    screen: pick(["library", "write"]),
    cacheFails: chance(5),
    events: pick([[], [{ id: "e1" }], [{ id: "e1" }, { id: "e2" }]]),
    fail: chance(3) ? 1 + random(14) : 0,
  };
}

async function run(api, sc) {
  const x = structuredClone(sc),
    calls = [],
    state = api.WriterState;
  Object.assign(state, {
    CATALOG_FORMS: Object.fromEntries([[x.key, x.form], ...(x.later ? [] : [])].filter(([, v]) => v)),
    CATALOG_EVENTS: x.events,
    CATALOG_VERIFIED: false,
    CATALOG_FROM_CACHE: true,
    CATALOG_AT: "",
    CATALOG_ERROR: "x",
    WORK: { entry: {} },
    state: { screen: x.screen },
  });
  const stored = {};
  globalThis.localStorage = {
    setItem: (k, v) => {
      if (x.cacheFails) throw new Error("quota");
      stored[k] = v;
    },
  };
  globalThis.confirm = (m) => (calls.push("confirm " + m), x.confirm);
  const fieldEl = (name) => (name in x.values ? { value: " " + x.values[name] + " " } : null);
  const host = { querySelector: (sel) => fieldEl(/"(\w+)"/.exec(sel)[1]) };
  const saveEl = { dataset: { catalogSave: x.key, catalogStatus: x.status }, disabled: false, closest: () => host };
  const rebaseEl = { dataset: { catalogRebase: x.key } };
  const returns = {
    catalogReview: () => x.review,
    catalogItem: (k) => (k === "other" ? x.other : k === x.key ? x.item : k === "k1" ? x.item : null),
    catalogForm: (k, i, r) => ({ baseVersion: r ? r.version : 0 }),
    keepCatalogForms: () => {
      if (x.later && state.CATALOG_FORMS[x.key] === undefined) state.CATALOG_FORMS[x.key] = structuredClone(x.later);
    },
    render: () => undefined,
    toast: () => undefined,
    helperJSON: async () => {
      if (x.outcome === "throw") throw new Error("share offline");
      if (x.later) state.CATALOG_FORMS[x.key] = structuredClone(x.later);
      const events = x.outcome === "same" ? x.events : x.outcome === "removed" ? x.events.slice(1) : [...x.events, { id: "new" }];
      return { events, event: { version: 7 } };
    },
  };
  const services = recorder(calls, returns, {}, x.fail);
  const owner = api.createCatalogEvents(services);
  assert.deepEqual(calls, [], "construction remains inert");
  const target = listenerTarget();
  owner.registerReviewActions(target);
  const hit = x.kind === "rebase" ? rebaseEl : null;
  const save = x.kind === "save" ? saveEl : x.kind === "nosave" ? null : null;
  const ev = {
    target: {
      closest: (sel) => (sel.includes("catalog-rebase") ? hit : sel.includes("catalog-save") ? save : null),
    },
  };
  let error;
  try {
    await target.listeners.click(ev);
  } catch (e) {
    error = [e.name, e.message];
  }
  const clean = (text) => text.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g, "<now>");
  return clean(
    JSON.stringify({
      error,
      forms: state.CATALOG_FORMS,
      events: state.CATALOG_EVENTS,
      flags: [state.CATALOG_VERIFIED, state.CATALOG_FROM_CACHE, state.CATALOG_ERROR],
      stored,
      disabled: saveEl.disabled,
      calls,
    }),
  );
}

(async () => {
  const [current, legacy] = await Promise.all([
    compile('export {createCatalogEvents} from "./catalog_events.js";'),
    compile(fs.readFileSync("tests/fixtures/catalog_events_reference.txt", "utf8")),
  ]);
  const seen = new Set();
  let interrupted = 0,
    recorded = 0;
  for (let n = 0; n < 10000; n++) {
    const sc = scenario();
    const [before, after] = [await run(legacy, sc), await run(current, sc)];
    assert.equal(after, before, `catalog scenario ${n} differs from the retained module:\n${JSON.stringify(sc)}`);
    const parsed = JSON.parse(after);
    if (parsed.error || parsed.calls.some((c) => c.includes("interrupted:"))) interrupted++;
    if (parsed.flags[0]) recorded++;
    for (const c of parsed.calls) seen.add(c.split("(")[0].replace(/^get /, ""));
    for (const c of parsed.calls) if (c.startsWith("toast(")) seen.add(c.slice(7, 60));
    for (const c of parsed.calls) if (c.startsWith("confirm ")) seen.add(c.slice(0, 20));
    seen.add(JSON.stringify(Object.values(parsed.forms)[0]?.error || "").slice(0, 30));
  }
  for (const name of [
    "catalogReview",
    "catalogItem",
    "catalogForm",
    "keepCatalogForms",
    "render",
    "toast",
    "helperJSON",
    "confirm Use reviewed v",
    "confirm Record ",
  ])
    assert.ok(
      [...seen].some((t) => t.startsWith(name)),
      "scenarios reach " + name,
    );
  for (const text of [
    "Reviewer is required.",
    "Source or authority is required.",
    "Approved wording and ordinance",
    "Choose a different catalog entry.",
    "Review save was not confirmed",
    "Review basis updated",
    "Catalog review v7 recorded",
  ])
    assert.ok(
      [...seen].some((t) => t.includes(text.slice(0, 25))),
      "scenarios reach: " + text,
    );
  assert.ok(interrupted > 150 && recorded > 250, `coverage: ${interrupted} interrupted, ${recorded} recorded`);
  console.log(
    "PASS catalog review actions match the retained module over 10000 scenarios (" + interrupted + " interrupted, " + recorded + " recorded)",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
