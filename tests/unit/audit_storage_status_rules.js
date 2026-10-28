/* Retain exact diagnostic HTML and lazy reads while separating row formatting. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild");
(async () => {
  const source = fs.readFileSync("app/modules/storage_status.js", "utf8");
  async function compile(contents) {
    const built = await esbuild.build({
      stdin: { contents: contents + '\nexport {WriterState} from "./state.js";', resolveDir: path.resolve("app/modules") },
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
    new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
    return box.exports;
  }
  const [current, legacy] = await Promise.all([
    compile(source),
    compile(source.slice(0, source.indexOf("export function")) + fs.readFileSync("tests/fixtures/storage_status_reference.txt", "utf8")),
  ]);
  let seed = 20261108,
    checked = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (a) => a[random(a.length)];
  function run(api, input) {
    const reads = [],
      s = api.WriterState;
    function observed(value, label) {
      if (!value || typeof value !== "object") return value;
      return new Proxy(value, {
        get(o, k) {
          if (typeof k !== "symbol") reads.push(label + "." + k);
          return Reflect.get(o, k);
        },
      });
    }
    for (const [k, v] of Object.entries(structuredClone(input.state)))
      Object.defineProperty(s, k, {
        configurable: true,
        get() {
          reads.push("state." + k);
          return observed(v, k);
        },
      });
    const services = new Proxy(input.services, {
      get(o, k) {
        reads.push("service." + k);
        return k === "storageMode"
          ? () => {
              reads.push("call:mode");
              return input.mode;
            }
          : o[k];
      },
    });
    const owner = api.createStorageStatus(services);
    assert.deepEqual(reads, [], "inert construction");
    let html, error;
    try {
      html = owner.storageReport();
    } catch (e) {
      error = [e.name, e.message];
    }
    return { html, error, reads };
  }
  const entry = () => ({
    ok: !!random(2),
    name: pick(["case.json", '<>&"', "", null]),
    why: pick(["", "refused <&>", null]),
    bytes: pick([0, 1, 4096, null]),
    at: pick(["2026-10-28T12:00:00Z", "", null]),
  });
  for (let n = 0; n < 4000; n++) {
    const input = {
      state: {
        HELPER: random(2)
          ? { caseStore: !!random(2), caseDir: "shared<&", chrome: !!random(2), out: pick(["pdf<&", null]), outlook: !!random(2) }
          : null,
        CASEDIR: random(2) ? {} : null,
        DIRNAME: pick(["Case JSON Files", "different<&", "", null]),
        NEEDGRANT: !!random(2),
        PENDING: Array.from({ length: random(4) }, (_, i) => ({ name: "pending<&" + i })),
        LASTWRITE: random(2) ? entry() : null,
        LASTINDEX: random(2) ? entry() : null,
      },
      services: {
        window: pick([
          undefined,
          {},
          { location: { protocol: "file:" } },
          { location: { protocol: "https:", origin: "https://synthetic<&" } },
          { location: { href: "http://local" } },
        ]),
        FS_OK: !!random(2),
        IDB_OK: !!random(2),
        CASEDIR_EXPECT: "Case JSON Files",
      },
      mode: pick(["local<&", "shared", "pending"]),
    };
    assert.deepEqual(run(current, input), run(legacy, input), "scenario " + checked++);
  }
  console.log("PASS storage diagnostic equivalence " + checked + " scenarios: exact HTML, escaping, field and service read order");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
