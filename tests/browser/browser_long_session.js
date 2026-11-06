/* Repeated production editing/preview lifecycles with real Chromium GC and resource counts.
   Synthetic private drafts only; no publication or City/network performance claim. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");

module.exports = async function (browser, hostPage, OUT, axeScreen) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 }, timezoneId: "America/Chicago" });
  const errors = [],
    samples = [];
  try {
    await context.route("**/dw-status", (route) => route.fulfill({ status: 503, json: { error: "Synthetic disconnected helper" } }));
    await context.addInitScript(() => {
      const timers = new Set(),
        intervals = new Set(),
        urls = new Set();
      const timeout = window.setTimeout,
        clear = window.clearTimeout,
        interval = window.setInterval,
        clearInterval = window.clearInterval;
      window.setTimeout = (callback, delay, ...args) => {
        const id = timeout(() => {
          timers.delete(id);
          callback(...args);
        }, delay);
        timers.add(id);
        return id;
      };
      window.clearTimeout = (id) => {
        timers.delete(id);
        clear(id);
      };
      window.setInterval = (...args) => {
        const id = interval(...args);
        intervals.add(id);
        return id;
      };
      window.clearInterval = (id) => {
        intervals.delete(id);
        clearInterval(id);
      };
      const create = URL.createObjectURL.bind(URL),
        revoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (...args) => {
        const url = create(...args);
        urls.add(url);
        return url;
      };
      URL.revokeObjectURL = (url) => {
        urls.delete(url);
        revoke(url);
      };
      window.sessionResources = () => ({ timers: timers.size, intervals: intervals.size, urls: urls.size });
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(new URL("/", hostPage.url()).href);
    await page.waitForFunction(() => typeof WriterState !== "undefined" && WriterState.WRITER_READY === true);
    await page.evaluate(() => {
      WriterState.CASES = [
        {
          id: "session-case",
          number: "QA-SESSION",
          address: "100 SYNTHETIC ST",
          owner: "SYNTHETIC OWNER",
          ownerAddr: ["100 EXAMPLE ST", "MADISON WI 53703"],
          inspectorId: "i4",
          date: "2026-01-02",
          time: "09:00",
          emails: [],
        },
      ];
      WriterState.CASES = [0, 1].map((n) => ({ ...WriterState.CASES[0], id: "session-case-" + n, number: "QA-SESSION-" + n }));
      WriterState.DOCS = [];
      WriterState.REINSP = [];
      WriterState.EVENTS = {};
      WriterState.PENDING = [];
      WriterState.WORK = { entry: {}, recordForms: {} };
      for (let n = 0; n < 2; n++) {
        newDoc("session-case-" + n, "notice");
        const d = doc(WriterState.state.docId);
        d.id = "session-doc-" + n;
        d.items = Array.from({ length: 6 + n * 6 }, (_, i) => ({
          id: "item-" + i,
          no: String(i + 1),
          title: "Repair",
          text: "Repair the synthetic wall. ".repeat(5),
          sections: ["27.05(2)(c)"],
          due: "2027-01-15",
        }));
      }
      WriterState.state.docId = null;
      WriterState.state.screen = "cases";
      render();
    });
    const client = await context.newCDPSession(page);
    await client.send("Performance.enable");
    async function sample(cycles) {
      await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
      await client.send("HeapProfiler.collectGarbage");
      await client.send("HeapProfiler.collectGarbage");
      const dom = await client.send("Memory.getDOMCounters"),
        metrics = await client.send("Performance.getMetrics");
      const state = await page.evaluate(() => ({
        ...window.sessionResources(),
        frames: document.querySelectorAll("iframe").length,
        dialogs: document.querySelectorAll('[role="dialog"],dialog').length,
        drafts: WriterState.DOCS.length,
        cases: WriterState.CASES.length,
        pending: WriterState.PENDING.length,
      }));
      const value = { cycles, ...dom, heapBytes: metrics.metrics.find((m) => m.name === "JSHeapUsedSize").value, ...state };
      samples.push(value);
      assert.equal(value.frames, 0, "print layout iframe removed after every preview");
      assert.equal(value.dialogs, 0, "review dialogs close completely");
      assert.equal(value.urls, 0, "inline preview must not allocate retained blobs");
      assert.equal(value.drafts, 2);
      assert.equal(value.cases, 2);
      assert.equal(value.pending, 0);
      return value;
    }
    const cycles = Number(process.env.DW_SESSION_CYCLES || 120);
    assert.ok(Number.isInteger(cycles) && cycles >= 120 && cycles <= 2000);
    for (let i = 0; i < cycles; i++) {
      await page.evaluate(async (i) => {
        const id = "session-doc-" + (i % 2),
          button = document.querySelector('[data-open="' + id + '"]');
        if (!button) throw Error("Missing workspace document action");
        button.click();
        // Navigation awaits the real device save; do not bypass its completion barrier.
      }, i);
      await page.waitForFunction((id) => WriterState.state.screen === "write" && WriterState.state.docId === id, "session-doc-" + (i % 2));
      await page.evaluate((i) => {
        const field = document.querySelector('[data-field="text"][contenteditable="true"]');
        if (!field) throw Error("Missing editable item");
        const changed = WriterState.LOCAL_CHANGED;
        field.focus();
        field.textContent = "Synthetic session edit " + i;
        field.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
        if (WriterState.LOCAL_CHANGED !== changed + 1) throw Error("Edit dispatched more or less than once");
        const d = doc(WriterState.state.docId),
          preview = printJob(d);
        if (!preview.html.includes("Synthetic session edit " + i)) throw Error("Preview lost the current edit");
        if (document.querySelector("iframe")) throw Error("Preview retained its layout iframe");
        document.getElementById("btn-final").click();
        if (!document.querySelector('#overlay [role="dialog"]')) throw Error("Review failed to open");
        document.querySelector('#overlay [data-close="modal"]').click();
        if (document.querySelector('#overlay [role="dialog"]')) throw Error("Review failed to close");
        document.querySelector('[data-nav="cases"]').click();
      }, i);
      await page.waitForFunction(() => WriterState.state.screen === "cases");
      if ((i + 1) % 20 === 0) await sample(i + 1);
    }
    const first = samples[0],
      last = samples.at(-1);
    assert.ok(last.nodes <= first.nodes + 100, "DOM nodes must plateau after warmup");
    assert.ok(last.documents <= first.documents + 1, "detached preview documents must be collected");
    assert.ok(last.jsEventListeners <= first.jsEventListeners + 12, "listeners must plateau after warmup");
    assert.ok(last.heapBytes <= first.heapBytes + 4 * 1024 * 1024, "post-GC retained heap must plateau within 4 MiB");
    assert.ok(
      samples.every((s) => s.timers <= first.timers + 3 && s.intervals === first.intervals),
      "timer ownership stays bounded",
    );
    await page.evaluate(async () => {
      if (!(await saveDrafts())) throw Error("Final device save failed");
    });
    await page.reload();
    await page.waitForFunction(() => WriterState.WRITER_READY === true);
    assert.equal(await page.evaluate(() => WriterState.DOCS.length), 2);
    const texts = await page.evaluate(() => WriterState.DOCS.map((d) => d.items[0].text).sort());
    assert.deepEqual(texts, ["Synthetic session edit " + (cycles - 2), "Synthetic session edit " + (cycles - 1)].sort());
    await axeScreen(page, "long-session-restored-workspace");
    assert.deepEqual(errors, []);
    const results = { passed: true, cycles, samples, editsExactlyOnce: true, previewFramesRemoved: true, persistedEditsRestored: true, errors };
    fs.writeFileSync(path.join(OUT, "long-session-results.json"), JSON.stringify(results, null, 2));
    return results;
  } finally {
    await context.close();
  }
};
