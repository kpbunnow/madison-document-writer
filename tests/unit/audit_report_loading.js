/* Reports load through their actual authenticated transport; chunk boundaries and superseded reads stay intact. */
const assert = require("node:assert/strict"),
  path = require("node:path"),
  esbuild = require("esbuild");
(async () => {
  const compiled = await esbuild.build({
    stdin: {
      contents: 'export {createReportsServices} from "./app/modules/reports_services.js";export {ReportsState} from "./app/modules/state.js";',
      resolveDir: path.resolve("."),
    },
    bundle: true,
    write: false,
    format: "cjs",
    define: { __TEST_BUILD__: "false" },
  });
  let reply,
    requests = [];
  const fetch = async (url, options) => {
    assert.equal(options.headers.get("X-DocWriter-Token"), "SYNTHETIC-TOKEN");
    requests.push({ url, options });
    return { ok: true, status: 200, json: () => reply(url, options) };
  };
  const document = { querySelector: () => ({ content: "SYNTHETIC-TOKEN" }) };
  const box = { exports: {} };
  new Function("document", "fetch", "module", "exports", compiled.outputFiles[0].text)(document, fetch, box, box.exports);
  const { createReportsServices, ReportsState: s } = box.exports;
  const api = createReportsServices({ render: () => {}, uniq: (values) => [...new Set(values)], plural: (n, label) => n + " " + label });
  const ids = Array.from({ length: 501 }, (_, i) => String(700000000000 + i));
  const summary = (id, number) => ({ summaryVersion: 6, case: { number, parcel: id }, violations: [], citations: [], referrals: [] });
  s.S = {};
  reply = (url, options) => {
    if (url === "/reporting/index") return { ok: true, summaries: ids.map((id, i) => summary(id, "QA-" + i)) };
    if (url === "/reporting/areas") return { ok: true };
    if (options.method === "POST") {
      const selected = JSON.parse(options.body).ids;
      return { ok: selected.length !== 500, error: "Partial synthetic lookup", parcels: { [ids[0]]: { history: [] } }, missing: selected.slice(1) };
    }
    return { parcels: {}, missing: [ids[0]] };
  };
  await api.loadAll(true);
  const chunks = requests.filter((r) => r.options.method === "POST").map((r) => JSON.parse(r.options.body));
  assert.deepEqual(
    chunks.map((c) => c.ids.length),
    [500, 1],
  );
  assert.ok(chunks.every((c) => c.refresh));
  assert.equal(s.S.parcelMissing.includes(ids[0]), false);
  assert.equal(s.S.parcelNote, "Partial synthetic lookup");
  assert.equal(s.S.phase, "ready");
  assert.equal(s.S.M.cases.length, 501);
  let release,
    index = 0;
  requests = [];
  reply = (url) => {
    if (url === "/reporting/index") {
      index++;
      if (index === 1) return new Promise((resolve) => (release = () => resolve({ ok: true, readAt: "old", summaries: [] })));
      return { ok: true, readAt: "new", summaries: [] };
    }
    return { ok: true, parcels: {}, missing: [] };
  };
  const old = api.loadAll(false);
  await new Promise(setImmediate);
  await api.loadAll(false);
  release();
  await old;
  assert.equal(s.S.raw.readAt, "new");
  assert.equal(s.S.phase, "ready");
  assert.ok(requests[0].options.signal.aborted);
  console.log("PASS independent authenticated Reports load: 500/1 chunks, partial result and superseded read");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
