/* Public owner composition compares complete draft/alias effects and service order with frozen refresh. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
const clone = (value) => structuredClone(value);
(async () => {
  const dir = path.resolve("app/modules"),
    source = fs.readFileSync(path.join(dir, "citation_pricing.js"), "utf8"),
    factory = acorn
      .parse(source, { ecmaVersion: 2022, sourceType: "module" })
      .body.find((n) => n.declaration?.id?.name === "initCitationPricing").declaration,
    fn = factory.body.body.find((n) => n.type === "FunctionDeclaration" && n.id.name === "refresh"),
    reference = fs.readFileSync("tests/fixtures/citation_refresh_reference.txt", "utf8");
  async function compile(contents) {
    const built = await esbuild.build({
      stdin: {
        contents:
          contents +
          '\nexport {WriterState} from "./state.js";export {CITATION_POLICY,citationPricingDate} from "./citation_policy.js";export {lookupForf} from "./citation_charges.js";',
        resolveDir: dir,
      },
      bundle: true,
      write: false,
      format: "cjs",
      define: { __TEST_BUILD__: "true" },
      plugins: [
        {
          name: "data",
          setup(build) {
            build.onResolve({ filter: /\/data\// }, (args) => ({ path: path.resolve("build/generated/modules/data", path.basename(args.path)) }));
          },
        },
      ],
    });
    const box = { exports: {} },
      context = { calls: [], remote: [] };
    const document = {
      addEventListener: (name) => context.calls.push(["listen", name]),
      querySelector: (selector) => {
        context.calls.push(["query", selector]);
        return null;
      },
    };
    const fetch = async (url, options) => {
      context.calls.push(["fetch", url, options.cache]);
      return { ok: true, status: 200, json: async () => ({ ok: true, history: clone(context.remote) }) };
    };
    new Function("today", "document", "fetch", "module", "exports", '"use strict";\n' + built.outputFiles[0].text)(
      new Date("2026-10-27T12:00:00Z"),
      document,
      fetch,
      box,
      box.exports,
    );
    return { api: box.exports, context };
  }
  const [actual, legacy] = await Promise.all([compile(source), compile(source.slice(0, fn.start) + reference + source.slice(fn.end))]);
  let seed = 20261028;
  const random = (count) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % count;
  };
  const choose = (items) => items[random(items.length)];
  function fixture(entry) {
    const k = {
      id: "case",
      number: "QA-CURRENT",
      address: "101 TEST ST",
      parcel: "070913125237",
      owner: "SYNTHETIC OWNER",
      ownerAddr: ["101 TEST ST", "MADISON WI 53703"],
      date: "2026-10-11",
      time: "10:00",
    };
    const d = {
      id: "draft",
      caseId: k.id,
      draft: true,
      type: "citation",
      authoringVersion: 16,
      mailed: "2026-10-11",
      inspDate: "2026-10-11",
      inspTime: "10:00",
      items: [{ id: "a", cite: true, title: "QA item", sections: [entry.ordinance] }],
      cits: {
        a: {
          num: "QA-1",
          ord: entry.ordinance,
          issued: "2026-10-11",
          pricedOn: "2026-10-11",
          scheduleEntryId: entry.id,
          tier: "1st",
          base: "50",
          cc: "48",
          amount: "125.00",
          depositMode: "schedule",
          measurements: { diameter: 12, removed: true, area: 200000, days: 400, percent: 20.01, fee: 60, tons: 2.01 },
        },
      },
    };
    return { k, d, flags: {} };
  }
  function run(composed, input, retain = false) {
    const { api, context } = composed,
      data = clone(input),
      { k, flags } = data,
      d = data.d;
    const s = api.WriterState;
    Object.assign(s, { CASES: [k], DOCS: [], REINSP: [], EVENTS: [], state: { docId: "draft" }, HELPER: { ok: true }, CASEDIR: { helper: true } });
    if (d) s.DOCS.push(d);
    if (flags.correction && d) {
      const original = clone(d);
      original.id = "original";
      original.draft = false;
      d.correction = { targetId: original.id };
      s.DOCS.push(original);
    }
    if (flags.history && d) {
      const issued = clone(d);
      issued.id = "history";
      issued.draft = false;
      issued.eventId = "issued-event";
      issued.frozen = { case: { ...k, number: "QA-PRIOR", owner: flags.differentOwner ? "OTHER OWNER" : k.owner } };
      for (const c of Object.values(issued.cits || {})) c.num = "QA-PRIOR-1";
      s.DOCS.push(issued);
    }
    const held = { cits: Object.entries(d?.cits || {}), requests: Object.entries(d?.depositRequests || {}) };
    if (flags.readonly && d?.cits?.a) Object.defineProperty(d.cits.a, "pricedOn", { writable: false });
    context.calls = [];
    let count = 0,
      services;
    const effect = (name, args, fn) => {
      context.calls.push([name, clone(args)]);
      if (++count === flags.throwAt) throw Error("Synthetic " + name + " failure");
      return fn();
    };
    const review = {
      refresh(value) {
        return effect("review", [value], () => {
          if (flags.reviewVersion) value.authoringVersion = 6;
        });
      },
    };
    const snow = {
      prepare(value) {
        return effect("prepare", [value], () => {
          if (flags.prepareWithdrawal && value.items?.[0]) value.items[0].withdrawn = true;
        });
      },
      is(value) {
        return effect("snow", [value], () => !!flags.snow);
      },
    };
    services = new Proxy(
      {
        libraryReview: review,
        snow,
        isLocked(value) {
          return effect("locked", [value], () => !!flags.locked);
        },
        lookupForf(...args) {
          return effect("lookup", args, () => api.lookupForf(...args));
        },
        citationPricingDate(...args) {
          return effect("date", args, () => api.citationPricingDate(...args));
        },
        inspAt(value) {
          return effect("inspection", [value], () => ({ date: value.inspDate || k.date }));
        },
        toast(message) {
          context.calls.push(["toast", message]);
        },
        renderKeep() {
          context.calls.push(["render"]);
        },
      },
      {
        get(target, name) {
          context.calls.push(["service", name]);
          return target[name];
        },
      },
    );
    const owner = api.initCitationPricing(services);
    assert.deepEqual(context.calls, [["listen", "click"]], "construction registers only the retained listener and reads no service");
    context.calls = [];
    let result;
    try {
      result = ["result", owner.refresh(d)];
    } catch (error) {
      result = ["error", error.name, error.message];
    }
    const aliases = Object.fromEntries(
      Object.entries(held).map(([name, values]) => [
        name,
        values.map(([id, value]) => [id, clone(value), d.cits?.[id] === value, d.depositRequests?.[id] === value]),
      ]),
    );
    const snapshot = { result, state: clone({ d, cases: s.CASES, docs: s.DOCS }), aliases, calls: clone(context.calls) };
    return retain ? { owner, d, s, context } : snapshot;
  }
  let checked = 0;
  function compare(input) {
    assert.deepEqual(run(actual, input), run(legacy, input), "refresh scenario " + checked);
    checked++;
  }
  const entries = actual.api.CITATION_POLICY.entries;
  for (const entry of entries)
    for (const mode of ["schedule", "base", "total"]) {
      const input = fixture(entry);
      input.d.cits.a.depositMode = mode;
      compare(input);
    }
  const values = [undefined, null, "", false, true, "0", "bad", "2026-10-11", "12.345", {}, []];
  for (let index = 0; index < 3000; index++) {
    const input = fixture(choose(entries)),
      { d, flags } = input;
    flags.locked = index % 23 === 0;
    flags.correction = index % 7 === 0;
    flags.history = index % 5 === 0;
    flags.differentOwner = index % 11 === 0;
    flags.reviewVersion = index % 17 === 0;
    flags.prepareWithdrawal = index % 29 === 0;
    flags.readonly = index % 31 === 0;
    if (index % 3)
      for (let n = random(4) + 1; n; n--)
        d.cits.a[
          choose([
            "ord",
            "issued",
            "pricedOn",
            "tier",
            "tierOverride",
            "tierOverrideSource",
            "depositMode",
            "amount",
            "descEdited",
            "measurements",
            "scheduleEntryId",
          ])
        ] = clone(choose(values));
    if (index % 13 === 0) {
      d.depositRequests = { a: clone(d.cits.a) };
      delete d.cits.a;
    }
    if (index % 19 === 0) {
      const c = d.cits.a || d.depositRequests.a;
      c.ordEditingFrom = undefined;
    }
    if (index % 37 === 0) {
      d.items.push({ ...clone(d.items[0]), id: "b" });
      if (d.cits.a) d.cits.b = { ...clone(d.cits.a), num: "QA-2" };
    }
    if (index % 41 === 0) flags.throwAt = random(8) + 1;
    if (index % 43 === 0) d.pendingAmendment = {};
    if (index % 47 === 0) d.draft = false;
    if (index % 53 === 0) input.d = null;
    compare(input);
  }
  const nativeNow = Date.now;
  let clock = 1000000;
  Date.now = () => clock;
  try {
    async function cachedHistory(composed) {
      clock = 1000000;
      const input = fixture(entries.find((entry) => entry.ordinance === "27.05(2)(c)"));
      const { owner, d, s, context } = run(composed, input, true);
      const results = [await owner.loadShared(d, true)];
      const fetches = () => context.calls.filter((call) => call[0] === "fetch").length;
      assert.equal(fetches(), 1);
      clock += 1000;
      results.push(await owner.loadShared(d));
      assert.equal(fetches(), 1, "unchanged local history uses the retained shared-history cache");
      s.DOCS = s.DOCS.concat({ id: "history-change", draft: false, type: "notice", eventId: "first", items: [] });
      owner.refresh(d);
      assert.ok(owner.historyFault(d), "a changed local history invalidates loaded shared history");
      results.push(await owner.loadShared(d));
      assert.equal(fetches(), 2);
      s.DOCS.at(-1).title = "non-signature field";
      owner.refresh(d);
      results.push(await owner.loadShared(d));
      assert.equal(fetches(), 2, "non-signature fields keep the cache");
      s.DOCS.at(-1).eventId = "second";
      owner.refresh(d);
      results.push(await owner.loadShared(d));
      assert.equal(fetches(), 3);
      return { results, calls: clone(context.calls), state: clone({ d, docs: s.DOCS }), fault: owner.historyFault(d) };
    }
    assert.deepEqual(await cachedHistory(actual), await cachedHistory(legacy), "live shared-history invalidation and reload sequence");
  } finally {
    Date.now = nativeNow;
  }
  console.log(
    "PASS citation refresh equivalence",
    checked,
    "policy/generated scenarios plus cache reloads: mutations, aliases, exceptions and lazy service order",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
