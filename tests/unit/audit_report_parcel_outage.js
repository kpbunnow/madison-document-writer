/* A City parcel-layer outage stops the Reports parcel batches early instead of waiting on every batch (synthetic). */
const assert = require("node:assert/strict"),
  path = require("node:path"),
  esbuild = require("esbuild");
(async () => {
  const compiled = await esbuild.build({
    stdin: {
      contents: 'export {createReportsServices} from "./reports_services.js"; export {ReportsState} from "./state.js";',
      resolveDir: path.resolve("app/modules"),
    },
    bundle: true,
    write: false,
    format: "cjs",
    define: { __TEST_BUILD__: "false" },
  });
  let reply,
    posts = [];
  const fetch = async (url, options) => {
    if (options.method === "POST") posts.push(JSON.parse(options.body).ids);
    return { ok: true, status: 200, json: () => reply(url, options) };
  };
  const document = { querySelector: () => ({ content: "SYNTHETIC-TOKEN" }) };
  const box = { exports: {} };
  new Function("document", "fetch", "module", "exports", compiled.outputFiles[0].text)(document, fetch, box, box.exports);
  const { createReportsServices, ReportsState: s } = box.exports;
  const api = createReportsServices({
    render: () => {},
    uniq: (v) => [...new Set(v)],
    plural: (n, label) => n + " " + label + (n === 1 ? "" : "s"),
    validISO: (value) => /^\d{4}-\d{2}-\d{2}$/.test(value),
  });
  const ids = Array.from({ length: 2001 }, (_, i) => String(700000000000 + i));
  const summary = (id, number) => ({ summaryVersion: 6, case: { number, parcel: id }, violations: [], citations: [], referrals: [] });
  const index = { ok: true, summaries: ids.map((id, i) => summary(id, "QA-" + i)) };
  const DOWN = "the city parcel layer could not be reached (synthetic outage)";

  async function load(post, refresh = false, cache = { parcels: {}, missing: [] }) {
    posts = [];
    s.S = {};
    reply = (url, options) =>
      url === "/reporting/index"
        ? index
        : url === "/reporting/areas"
          ? { ok: true }
          : options.method === "POST"
            ? post(JSON.parse(options.body).ids)
            : cache;
    await api.loadAll(refresh);
  }

  // Outage: two unreachable batches, then the remaining 1,001 parcels are not attempted for this load.
  await load(() => ({ ok: false, error: DOWN, partial: false, parcels: {}, missing: [] }));
  assert.deepEqual(
    posts.map((p) => p.length),
    [500, 500],
  );
  assert.equal(s.S.phase, "ready");
  assert.equal(s.S.M.cases.length, 2001);
  assert.equal(s.S.parcelNote, DOWN + ". The remaining 1001 parcels were not looked up and are shown as unlocated; refresh to try again.");

  // One failed batch between successes is retried no differently: every batch is still attempted.
  let n = 0;
  await load((batch) =>
    ++n === 2
      ? { ok: false, error: DOWN, parcels: {}, missing: [] }
      : { ok: true, parcels: Object.fromEntries(batch.map((k) => [k, { history: [] }])), missing: [] },
  );
  assert.deepEqual(
    posts.map((p) => p.length),
    [500, 500, 500, 500, 1],
  );
  assert.equal(s.S.parcelNote, DOWN);

  // Batches that confirm parcels missing, or return partial results, are answers, not an outage.
  await load((batch) => ({ ok: false, error: "Partial synthetic lookup", partial: true, parcels: {}, missing: batch }));
  assert.equal(posts.length, 5);
  // Refresh failures retain existing locations. Feedback must describe the actual model rather than claim all
  // unqueried cases are unlocated (the second cached case is beyond the two attempted batches).
  const cache = {
    parcels: Object.fromEntries([ids[0], ids[1500]].map((id) => [id, { history: [{ fetched: "2026-11-01", lat: 43.1, lon: -89.4 }] }])),
    missing: [],
  };
  await load(() => ({ ok: false, error: DOWN, partial: false, parcels: {}, missing: [] }), true, cache);
  assert.equal(posts.length, 2);
  assert.equal(s.S.M.cases.filter((c) => c.located).length, 2);
  assert.equal(s.S.M.byNo["QA-1500"].located, true);
  assert.match(s.S.parcelNote, /cached locations are retained where available/);
  assert.equal(s.S.M.cases.length, 2001);
  await load(
    () => {
      throw Error("synthetic request failure");
    },
    true,
    cache,
  );
  assert.equal(s.S.M.cases.filter((c) => c.located).length, 2);
  assert.match(s.S.parcelNote, /Cached locations are retained where available/);
  console.log("PASS Reports parcel lookup stops after two unreachable batches and keeps every answered batch");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
