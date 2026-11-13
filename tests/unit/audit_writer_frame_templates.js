/* Frame behavior, escaping, live slots, connection warnings and exact adapter/failure order. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom");
(async () => {
  async function load(contents) {
    const b = await esbuild.build({
      stdin: { contents, resolveDir: path.resolve("app/modules") },
      bundle: true,
      write: false,
      format: "cjs",
      plugins: [
        {
          name: "data",
          setup(b) {
            b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.resolve("build/generated/modules/data", path.basename(a.path)) }));
          },
        },
      ],
    });
    const box = { exports: {} };
    new Function("module", "exports", b.outputFiles[0].text)(box, box.exports);
    return box.exports.createWorkspaceShell;
  }
  const actual = await load(fs.readFileSync("app/modules/workspace_shell.js", "utf8"));
  const dom = new JSDOM(""),
    template = dom.window.document.createElement("template");
  function run(factory, input) {
    let steps = 0;
    const trace = [];
    const effect = (name, value) => {
      trace.push(name);
      if (++steps === input.fail) throw Error("interrupted:" + name);
      return value;
    };
    const context = {
      LOCAL_SAVE: { ok: input.local },
      PENDING: input.pending ? [{}, {}] : [],
      HELPER: input.outbox ? { outbox: 3 } : null,
      storageMode: () => effect("storageMode", input.mode),
      esc: (x) => effect("storageEscape", String(x).replaceAll("&", "&amp;").replaceAll("<", "&lt;")),
    };
    const services = {
      get navigation() {
        return effect("navigation", { rail: () => effect("rail", input.nav) });
      },
      get recordIntegrity() {
        return effect("integrity", { banner: () => effect("banner", input.banner) });
      },
      app_savedworkContext: () => effect("context", context),
    };
    const owner = factory(services);
    assert.equal(trace.length, 0, "inert construction");
    let value,
      error = null;
    try {
      value = owner.shell(input.title, input.crumb, input.actions, input.body);
    } catch (e) {
      error = [e.name, e.message];
    }
    return { value, error, trace };
  }
  let count = 0,
    complete = 0;
  for (let i = 0; i < 512; i++) {
    const x = {
      title: ['Text <&> "title"', null, undefined, 0][i % 4],
      crumb: ["A & B", "<img src=x>", null, ""][Math.floor(i / 4) % 4],
      nav: "<button>Navigate</button>",
      banner: i % 3 ? "" : "<p>Proof</p>",
      actions: i % 2 ? "" : "<button>Act</button>",
      body: i % 5 ? "<article>Body &amp; facts</article>" : undefined,
      local: !!(i & 1),
      pending: !!(i & 2),
      outbox: !!(i & 4),
      mode: ["download", "helper", "folder-not-linked"][Math.floor(i / 16) % 3],
      fail: i % 3 === 0 ? (i % 9) + 1 : 0,
    };
    const result = run(actual, x);
    const warning = !x.local || x.pending || x.outbox || x.mode !== "helper";
    const order = ["navigation", "rail", "integrity", "banner", "context", "storageMode", ...(warning ? ["storageEscape"] : [])];
    const interrupted = x.fail > 0 && x.fail <= order.length;
    assert.deepEqual(result.trace, order.slice(0, interrupted ? x.fail : order.length), "independent adapter order: " + i);
    if (interrupted) {
      assert.deepEqual(result.error, ["Error", "interrupted:" + order[x.fail - 1]]);
      assert.equal(result.value, undefined);
    } else {
      assert.equal(result.error, null);
      assert.deepEqual(result, run(actual, x), "repeat rendering is deterministic");
      template.innerHTML = result.value;
      const view = template.content;
      assert.equal(view.querySelectorAll("h1").length, 1);
      assert.equal(view.querySelector("h1").textContent, String(x.title ?? ""));
      assert.equal(view.querySelector(".crumb").textContent, String(x.crumb ?? ""));
      assert.equal(view.querySelector(".crumb img"), null, "untrusted crumb is text");
      assert.equal(view.querySelector("nav[aria-label='Main navigation'] button").textContent, "Navigate");
      assert.equal(view.querySelector("img").alt, "City of Madison Building Inspection");
      assert.equal(view.querySelector("#save-status[role='status'][aria-live='polite']").textContent, "Drafts save on this device");
      assert.equal(view.querySelectorAll(".topbar-actions button").length, x.actions ? 1 : 0);
      assert.equal(view.querySelectorAll(".content > article").length, x.body ? 1 : 0);
      if (!x.body) assert.match(view.querySelector(".content").textContent, /undefined/);
      assert.equal(view.querySelectorAll(".content > p").length, x.banner ? 1 : 0);
      assert.equal(view.querySelectorAll("[data-sync-safety]").length, warning ? 1 : 0);
      if (!x.local) assert.match(view.textContent, /Device save failed/);
      if (x.pending) assert.match(view.textContent, /2 shared saves waiting/);
      if (x.outbox) assert.match(view.textContent, /3 PDFs awaiting transfer/);
      if (x.mode !== "helper") assert.match(view.textContent, /Waiting for connection/);
    }
    if (result.value) complete++;
    count++;
  }
  assert.ok(complete > 300);
  assert.equal(count, 512);
  dom.window.close();
  console.log("PASS Writer frame behavior " + count + " slot/escaping/warning/adapter/failure scenarios");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
