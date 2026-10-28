/* Actual authenticated loading compares retained/current behavior without changing await boundaries. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
(async () => {
  const source = fs.readFileSync("app/modules/reports_services.js", "utf8");
  const factory = acorn
    .parse(source, { ecmaVersion: 2022, sourceType: "module" })
    .body.find((n) => n.declaration?.id?.name === "createReportsServices").declaration;
  const fn = factory.body.body.find((n) => n.id?.name === "loadAll"),
    reference = fs.readFileSync("tests/fixtures/report_loading_reference.txt", "utf8");
  const retained = source.slice(0, fn.start) + reference + source.slice(fn.end);
  let reply,
    requests = [];
  const fetch = async (url, options) => {
    assert.equal(options.headers.get("X-DocWriter-Token"), "SYNTHETIC-TOKEN");
    requests.push({ url, options });
    return { ok: true, status: 200, json: () => reply(url, options) };
  };
  const document = { querySelector: () => ({ content: "SYNTHETIC-TOKEN" }) };

  const requestSnapshot = ({ url, options }) => ({ url, method: options.method, body: options.body, aborted: options.signal?.aborted });
  async function runSuite(contents) {
    requests = [];
    const frames = [];
    const compiled = await esbuild.build({
      stdin: { contents: contents + "\nexport {ReportsState};", resolveDir: path.resolve("app/modules") },
      bundle: true,
      write: false,
      format: "cjs",
      define: { __TEST_BUILD__: "false" },
    });
    const box = { exports: {} };
    new Function("document", "fetch", "module", "exports", compiled.outputFiles[0].text)(document, fetch, box, box.exports);
    const { createReportsServices, ReportsState: s } = box.exports;
    const api = createReportsServices({
      render: () => frames.push({ phase: s.S.phase, msg: s.S.msg, error: s.S.error }),
      uniq: (values) => [...new Set(values)],
      plural: (n, label) => n + " " + label,
    });
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
    const firstState = structuredClone(s.S),
      firstRequests = requests.map(requestSnapshot);
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
    return { firstState, firstRequests, finalState: structuredClone(s.S), finalRequests: requests.map(requestSnapshot), frames };
  }
  const actual = await runSuite(source),
    legacy = await runSuite(retained);
  assert.deepEqual(actual, legacy, "cache state, authenticated requests, aborts and render order match retained loading");
  console.log("PASS retained/current authenticated Reports loading: 500/1 chunks, partial results, superseded reads and render order");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
