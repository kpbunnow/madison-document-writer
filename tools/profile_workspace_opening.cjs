/* Profile real production IndexedDB restoration and Workspace rendering with synthetic data only.
   Build first: python3 tools/build.py. Run serially: node tools/profile_workspace_opening.cjs <label>
   PROFILE_SIZES=100,1000,3000; DW_PROFILE_OUTPUT selects an evidence folder; DW_PROFILE_HTML selects a control build.
   This diagnostic is not gate/release evidence and does not measure City, SQL, SMB or native Windows performance. */
const fs = require("fs"),
  http = require("http"),
  path = require("path"),
  assert = require("assert/strict");
const root = path.resolve(__dirname, "..");
const { chromium } = require("playwright");
const out = path.resolve(process.env.DW_PROFILE_OUTPUT || path.join(root, "build/workspace-profile")),
  label = process.argv[2] || "workspace";
assert.match(label, /^[a-zA-Z0-9_][a-zA-Z0-9_-]*$/, "Use a plain output label");
fs.mkdirSync(out, { recursive: true });
for (const extension of ["json", "cpuprofile"]) fs.rmSync(path.join(out, label + "." + extension), { force: true });
const htmlFile = path.resolve(process.env.DW_PROFILE_HTML || path.join(root, "build/dist/madison-document-writer.html"));
const html = Buffer.from(require("../tests/fixtures/built_bundle.cjs").assertProductionPage(htmlFile));
const hash = require("crypto").createHash("sha256").update(html).digest("hex");
const harnessHash = () =>
  require("crypto")
    .createHash("sha256")
    .update(
      JSON.stringify(
        ["tools/profile_workspace_opening.cjs", "tools/compare_workspace_opening.cjs", "tests/fixtures/built_bundle.cjs", "package-lock.json"].map(
          (name) => [
            name,
            require("crypto")
              .createHash("sha256")
              .update(fs.readFileSync(path.join(root, name)))
              .digest("hex"),
          ],
        ),
      ),
    )
    .digest("hex");
const harnessSha256 = harnessHash();
const sizes = process.env.PROFILE_SIZES ? process.env.PROFILE_SIZES.split(",").map(Number) : [100, 1000, 3000];
assert.ok(sizes.length && sizes.every((n) => Number.isInteger(n) && n > 0 && n <= 10000), "Profile sizes must be whole numbers from 1 to 10000");
const trialCount = Number(process.env.PROFILE_TRIALS || 3),
  warmups = Number(process.env.PROFILE_WARMUP || 0);
const cpuSampling = process.env.PROFILE_CPU !== "0";
assert.ok(Number.isInteger(trialCount) && trialCount >= 3 && trialCount <= 25);
assert.ok(Number.isInteger(warmups) && warmups >= 0 && warmups <= 5);
assert.equal(new Set(sizes).size, sizes.length, "Duplicate workload sizes are not comparable");
(async () => {
  const server = http.createServer((req, res) => {
    if (req.url !== "/" && req.url !== "/madison-document-writer.html") {
      res.writeHead(404);
      return res.end("{}");
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(html);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  let browser;
  const results = [];
  try {
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    for (const count of sizes) {
      const context = await browser.newContext({ timezoneId: "America/Chicago", viewport: { width: 1400, height: 1000 } });
      await context.addInitScript(() => {
        window.profileDigest = async (value) =>
          [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))]
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("http://127.0.0.1:" + server.address().port + "/");
      await page.waitForFunction(() => WriterState.WRITER_READY === true);
      const seeded = await page.evaluate(async (count) => {
        const cases = [],
          docs = [],
          reinsp = [],
          events = {};
        for (let n = 0; n < count; n++) {
          const id = "large-" + n;
          cases.push({
            id,
            number: "CB2026-100-" + String(n).padStart(5, "0"),
            address: 100 + n + " SYNTHETIC ST",
            owner: "SYNTHETIC OWNER " + n,
            ownerAddr: ["400 EXAMPLE ST", "MADISON WI 53703"],
            inspectorId: "i4",
            date: "2026-01-02",
            time: "09:00",
            emails: [],
          });
          events[id] = [];
          for (let q = 0; q < 3; q++) {
            const d = {
              id: id + "-issued-" + q,
              caseId: id,
              type: "notice",
              created: "2026-01-03",
              mailed: "2026-01-03",
              draft: false,
              items: [
                { id: id + "-item", no: "1", title: "Wall", text: "Retain synthetic case wording.", sections: ["27.05(2)(c)"], due: "2027-01-05" },
              ],
              cits: {},
            };
            events[id].push({
              id: id + "-event-" + q,
              type: "notice.issued",
              at: "2026-01-0" + (q + 3) + "T12:00:00Z",
              by: "i4",
              payload: { snapshot: d },
            });
          }
          docs.push({
            id: id + "-draft",
            caseId: id,
            type: "notice",
            created: "2026-01-05",
            mailed: "2026-01-05",
            draft: true,
            items: [{ id: id + "-draft-item", no: "1", title: "Repair", text: "Private wording " + n, sections: ["27.05(2)(c)"] }],
            cits: {},
          });
          if (n % 5 === 0) reinsp.push({ id: id + "-walk", caseId: id, draft: true, sourceDocId: id + "-issued-2", date: "2026-01-05", results: {} });
        }
        const bundle = {
          cases,
          docs,
          reinsp,
          events,
          work: { entry: {}, acc: null, recordForms: {}, walk: {} },
          recordAttempts: {},
          integrityRecords: [],
          checkpoints: {},
          seq: count * 10,
        };
        if (!(await idbSet("drafts", bundle))) throw Error("Seed write failed");
        const raw = JSON.stringify(bundle);
        return { cases: count, drafts: docs.length, events: count * 3, bytes: raw.length, fixtureSha256: await window.profileDigest(raw) };
      }, count);
      const client = await context.newCDPSession(page),
        trials = [];
      for (let run = -warmups; run < trialCount; run++) {
        if (cpuSampling && count === sizes.at(-1) && run === 1) {
          await client.send("Profiler.enable");
          await client.send("Profiler.start");
        }
        const started = performance.now();
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => WriterState.WRITER_READY === true, {}, { timeout: 120000 });
        const ready = performance.now() - started;
        const observed = await page.evaluate(async () => {
          const start = performance.now();
          render();
          const renderMs = performance.now() - start;
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          return {
            cases: WriterState.CASES.length,
            docs: WriterState.DOCS.length,
            visits: WriterState.REINSP.length,
            rows: document.querySelectorAll("[data-queue-case]").length,
            renderMs,
            firstText: WriterState.DOCS.find((d) => d.draft)?.items[0].text,
            durableSha256: await window.profileDigest(JSON.stringify(await idbGet("drafts", true))),
            resultSha256: await window.profileDigest(JSON.stringify([WriterState.CASES, WriterState.DOCS, WriterState.REINSP, WriterState.EVENTS])),
          };
        });
        assert.equal(observed.cases, count);
        assert.equal(observed.docs, count * 4);
        assert.equal(observed.rows, count);
        assert.equal(observed.firstText, "Private wording " + (count - 1));
        assert.equal(observed.durableSha256, seeded.fixtureSha256, "Opening must preserve all durable fixture bytes");
        if (run >= 0) trials.push({ readyMs: ready, ...observed });
        if (cpuSampling && count === sizes.at(-1) && run === 1) {
          const { profile } = await client.send("Profiler.stop");
          fs.writeFileSync(out + "/" + label + ".cpuprofile", JSON.stringify(profile));
        }
      }
      assert.deepEqual(errors, []);
      results.push({ ...seeded, trials });
      console.log(label, count, JSON.stringify(trials));
      await context.close();
    }
    assert.equal(harnessHash(), harnessSha256, "Profiling harness changed during the run");
    fs.writeFileSync(
      out + "/" + label + ".json",
      JSON.stringify(
        {
          label,
          fixture:
            "Synthetic retained IndexedDB drafts + three issued snapshots per case; helper unavailable; real production Chromium startup/render, no City/SMB timing",
          harnessSource: require("child_process").execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
          harnessSourceClean: require("child_process").execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim() === "",
          htmlSha256: hash,
          harnessSha256,
          htmlFile,
          cpuSampling,
          trialCount,
          warmups,
          platform: process.platform,
          architecture: process.arch,
          playwright: require("playwright/package.json").version,
          viewport: { width: 1400, height: 1000 },
          timezone: "America/Chicago",
          node: process.version,
          browser: browser.version(),
          results,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser?.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
