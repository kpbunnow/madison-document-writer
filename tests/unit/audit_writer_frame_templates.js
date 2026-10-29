/* Keep complete frame bytes and live adapter read/call/failure order. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild");
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
  const [actual, old] = await Promise.all([
    load(fs.readFileSync("app/modules/workspace_shell.js", "utf8")),
    load(fs.readFileSync("tests/fixtures/writer_frame_reference.txt", "utf8")),
  ]);
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
    assert.deepEqual(result, run(old, x), "frame:" + i);
    if (result.value) complete++;
    count++;
  }
  assert.ok(complete > 300);
  assert.equal(count, 512);
  console.log("PASS Writer frame templates " + count + " exact HTML/adapter/failure comparisons");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
