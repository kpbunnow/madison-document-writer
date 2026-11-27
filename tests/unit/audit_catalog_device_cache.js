/* Optional device review metadata cannot break language browsing or hide independent unsent review forms. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  acorn = require("acorn");
const { compile } = require("../fixtures/equivalence_harness.cjs");
(async () => {
  const api = await compile('export {catalogDeviceState} from "./catalog_state.js";export {createLanguageCatalog} from "./language_catalog.js";');
  const key = '["SYNTHETIC","GROUP",1]',
    item = { a: "Bundled action", s: ["27.01"], p: "draft" },
    form = { wording: "Unsubmitted wording", reviewer: "Synthetic reviewer" };
  const review = {
    id: "review1",
    key,
    status: "approved",
    version: 1,
    at: "2026-11-27T12:00:00Z",
    reviewer: "Synthetic reviewer",
    source: "Synthetic source",
    wording: "Reviewed action",
    ordinances: ["27.01"],
    replaces: "",
  };
  const owner = api.createLanguageCatalog({ catalogKey: () => key });
  function load(cache, forms = { [key]: form }) {
    const values = {
      "madison-catalog-events-v1": typeof cache === "string" ? cache : JSON.stringify(cache),
      "madison-catalog-forms-v1": JSON.stringify(forms),
    };
    const before = structuredClone(values),
      reads = [];
    const out = api.catalogDeviceState((k) => {
      reads.push(k);
      return values[k];
    });
    assert.deepEqual(reads, Object.keys(values));
    assert.deepEqual(values, before, "reading cache never repairs browser storage");
    Object.assign(api.WriterState, out);
    return out;
  }
  for (const bad of [
    "{",
    {},
    [],
    { events: [null] },
    { events: ["text"] },
    { events: [review, null] },
    { events: [{ ...review, ordinances: null }] },
    { events: [{ ...review, at: 42 }] },
    { events: [{ ...review, version: true }] },
    { events: [{ ...review, reviewer: "" }] },
    { events: [{ ...review, wording: "" }] },
    { events: [{ ...review, ordinances: [] }] },
    { events: [review], at: 42 },
  ]) {
    const out = load(bad);
    assert.equal(out.CATALOG_VERIFIED, false);
    assert.deepEqual(out.CATALOG_EVENTS, []);
    assert.match(out.CATALOG_ERROR, /reviews could not be read/);
    assert.deepEqual(out.CATALOG_FORMS[key], form, "unsubmitted forms survive a failed history read");
    assert.equal(owner.catalogStatus(item).code, "unknown", "unusable cache must not infer a fresh approval or standard baseline");
  }
  let out = load({ at: "2026-11-27", events: [review, { ...review, id: "review2", version: 2, status: "retired", wording: "", ordinances: [] }] });
  assert.equal(out.CATALOG_VERIFIED, true);
  assert.equal(out.CATALOG_FROM_CACHE, true);
  assert.equal(owner.catalogStatus(item).code, "retired");
  assert.equal(out.CATALOG_ERROR, "");
  assert.equal(owner.catalogForm(key, item, null), out.CATALOG_FORMS[key], "valid forms retain their original reference");
  out = load({ events: [review] }, "bad forms root");
  assert.equal(out.CATALOG_VERIFIED, true, "form damage does not erase a valid last-known review");
  assert.match(out.CATALOG_ERROR, /forms could not be read/);
  out = load({ events: [review] }, { [key]: null, other: form, broken: "unreadable original" });
  assert.deepEqual(out.CATALOG_FORMS, { [key]: null, other: form, broken: "unreadable original" });
  assert.equal(owner.catalogForm("broken", item, null).wording, item.a);
  assert.deepEqual(out.CATALOG_FORMS.other, form);
  out = api.catalogDeviceState((k) => {
    if (k.includes("events")) throw Error("Synthetic read refusal");
    return JSON.stringify({ [key]: form });
  });
  assert.deepEqual(out.CATALOG_FORMS[key], form);
  assert.equal(out.CATALOG_VERIFIED, false);
  out = load(null, {});
  assert.equal(out.CATALOG_VERIFIED, false);
  assert.equal(out.CATALOG_ERROR, "");
  const source = fs.readFileSync("app/modules/app_core.js", "utf8"),
    tree = acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" });
  const initialization = tree.body.find(
    (n) =>
      n.type === "ExpressionStatement" &&
      n.expression.callee?.object?.name === "Object" &&
      n.expression.callee.property.name === "assign" &&
      n.expression.arguments[1]?.callee?.name === "catalogDeviceState",
  );
  assert.ok(initialization, "Writer startup uses the reviewed optional-cache reader");
  assert.equal(initialization.expression.arguments[0].name, "WriterState");
  const read = initialization.expression.arguments[1].arguments[0];
  assert.equal(read.body.callee.object.name, "localStorage");
  assert.equal(read.body.callee.property.name, "getItem");
  console.log(
    "PASS damaged catalog cache is unverified, language queries stay usable, independent forms survive and original browser data stays untouched",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
