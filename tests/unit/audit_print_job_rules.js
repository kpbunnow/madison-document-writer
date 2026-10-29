/* Print job assembly against the retained module: refusals, the frame and document writes in order, packet
   completeness checks, snow and standard pagination paths, the returned job, and refusal on the first interrupted
   read or call, over a scripted print frame. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild");

async function compile(contents) {
  const build = await esbuild.build({
    stdin: {
      contents: contents + '\nexport {WriterState} from "./state.js"; export {CIT_COPIES} from "./document_types.js";',
      resolveDir: path.resolve("app/modules"),
    },
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
  new Function("module", "exports", build.outputFiles[0].text)(box, box.exports);
  return box.exports;
}

let seed = 20261103;
const random = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor((seed / 4294967296) * n);
  },
  pick = (values) => values[random(values.length)],
  chance = (n) => random(n) === 0;

function scenario() {
  const type = pick(["citation", "citation", "citation", "notice", "extension", "snow"]),
    cited = 1 + random(3);
  const items = Array.from({ length: cited + random(2) }, (_, n) => ({
    id: "i" + n,
    no: String(n + 1),
    cite: n < cited ? !chance(8) : chance(2),
    withdrawn: chance(8),
  }));
  const live = items.filter((i) => i.cite && !i.withdrawn);
  const cits = {};
  for (const i of items) cits[i.id] = { num: pick(["B9001", "B9002"]), ...(chance(15) ? { mandatoryAppearance: true } : {}) };
  const labels = pick([null, ["Court", "Agency", "Inspector", "Defendant"], ["A", "B", "C"]]);
  return {
    d: {
      id: pick(["abcdef123456789", "doc-1", ""]),
      caseId: "case",
      type,
      draft: !chance(3),
      authoringVersion: pick([9, 14, 15, 16]),
      mailed: pick(["2026-10-21", ""]),
      void: chance(10) || undefined,
      items,
      cits,
      depositRequests: chance(8) ? { i0: {} } : {},
      frozen: labels ? { courtCopies: labels.map((label) => ({ label })) } : undefined,
    },
    nullDoc: chance(20),
    depositFault: chance(8),
    snow: type === "snow" || chance(10),
    frameKind: pick(["full", "full", "full", "noOpen", "noDocument"]),
    badFaces: chance(4) ? pick(["count", "label", "number"]) : "",
    liveCount: live.length,
    screenDoc: pick(["match", "other"]),
    stylesheet: pick(["", "body{}"]),
    fail: chance(3) ? 1 + random(60) : 0,
  };
}

function recorder(calls, returns, data, fail) {
  let count = 0;
  const tick = (label) => {
    if (++count === fail) throw new Error("interrupted:" + label);
  };
  const show = (value) => JSON.stringify(value, (_, v) => (v === undefined ? "<undefined>" : v));
  const make = (trail) =>
    new Proxy(function () {}, {
      get(_, key) {
        const next = trail.concat(String(key)),
          name = next.join(".");
        calls.push("get " + name);
        tick("get " + name);
        return name in data ? data[name] : make(next);
      },
      apply(_, __, args) {
        const name = trail.join(".");
        calls.push(name + "(" + show(args) + ")");
        tick(name);
        const result = returns[name];
        return typeof result === "function" ? result(...args) : result;
      },
    });
  return make([]);
}

function run(api, sc) {
  const x = structuredClone(sc),
    calls = [],
    log = (entry) => calls.push(entry);
  const labels = ((x.d.frozen || {}).courtCopies || api.CIT_COPIES).map((c) => c.label);
  const cited = x.d.items.filter((i) => i.cite && !i.withdrawn);
  const faceCount = cited.length * 4 + (x.badFaces === "count" ? 1 : 0);
  const faces = Array.from({ length: faceCount }, (_, index) => ({
    querySelector: (selector) => {
      log("face.querySelector(" + selector + ")");
      if (selector === ".cit-foot span:last-child") return { textContent: x.badFaces === "label" && index === 2 ? "Other" : labels[index % 4] };
      return { textContent: " " + (x.badFaces === "number" && index === 5 ? "wrong" : (x.d.cits[cited[Math.floor(index / 4)]?.id] || {}).num) + " " };
    },
  }));
  const picks = [{ remove: () => log("pick.remove") }, { remove: () => log("pick.remove") }];
  const stage = {
    querySelectorAll: (selector) => {
      log("stage.querySelectorAll(" + selector + ")");
      return selector === ".cit" ? faces : picks;
    },
  };
  let written = "";
  const fd = {
    open: () => log("fd.open"),
    write: (html) => {
      written = html;
      log("fd.write(" + html + ")");
    },
    close: () => log("fd.close"),
    querySelector: (selector) => {
      log("fd.querySelector(" + selector + ")");
      return stage;
    },
    documentElement: { outerHTML: "<html>snow</html>" },
  };
  if (x.frameKind === "noOpen") delete fd.open;
  const frame = {
    setAttribute: (k, v) => log("frame.setAttribute(" + k + "," + v + ")"),
    style: new Proxy({}, { set: (_, k, v) => (log("frame.style." + String(k) + "=" + v), true) }),
    remove: () => log("frame.remove"),
  };
  Object.defineProperty(frame, "tabIndex", { set: (v) => log("frame.tabIndex=" + v) });
  Object.defineProperty(frame, "contentDocument", {
    get: () => {
      log("frame.contentDocument");
      return x.frameKind === "noDocument" ? null : fd;
    },
  });
  Object.assign(api.WriterState, {
    CASES: [{ id: "case", address: "1 Main St", number: "BLD2026-00001" }],
    DOCS: [],
    state: { docId: x.screenDoc === "match" ? x.d.id : "other" },
  });
  const returns = {
    "document.createElement": (tag) => (log("createElement(" + tag + ")"), frame),
    "document.body.appendChild": (node) => log("body.appendChild(" + (node === frame ? "frame" : "?") + ")"),
    "document.querySelector": (selector) => (log("querySelector(" + selector + ")"), x.stylesheet ? { textContent: x.stylesheet } : null),
    citationDepositFault: () => x.depositFault,
    documentHTML: () => "<section>" + x.d.id + "</section>",
    "snow.is": () => x.snow,
    printableHTML: (d, s) => "<printable " + (d ? "d" : "none") + (s === stage ? " stage" : "") + ">",
    paginate: (s, d) => log("paginate(" + (s === stage ? "stage" : "desk") + "," + d.id + ")"),
    fmtDate: (v) => v.replace(/-/g, "/"),
  };
  const services = recorder(calls, returns, { today: new Date("2026-10-29T12:00:00Z") }, x.fail);
  const owner = api.createDocumentPrinting(services);
  assert.deepEqual(calls, [], "construction remains inert");
  let result, error;
  try {
    result = owner.printJob(x.nullDoc ? null : x.d);
  } catch (e) {
    error = [e.name, e.message];
  }
  return JSON.stringify({ result, error, d: x.d, written, calls });
}

(async () => {
  const [current, legacy] = await Promise.all([
    compile(fs.readFileSync("app/modules/document_printing.js", "utf8")),
    compile(fs.readFileSync("tests/fixtures/document_printing_reference.txt", "utf8")),
  ]);
  const seen = new Set();
  let interrupted = 0,
    jobs = 0,
    snow = 0;
  for (let n = 0; n < 8000; n++) {
    const sc = scenario();
    const [before, after] = [run(legacy, sc), run(current, sc)];
    assert.equal(after, before, `print job scenario ${n} differs from the retained module:\n${JSON.stringify(sc)}`);
    const parsed = JSON.parse(after);
    if (parsed.error && /^interrupted/.test(parsed.error[1])) interrupted++;
    else if (parsed.error) seen.add(parsed.error[1].slice(0, 60));
    if (parsed.result) jobs++;
    if (parsed.calls.some((c) => c.startsWith("fd.querySelector") && parsed.result && parsed.result.html.includes("snow"))) snow++;
    for (const c of parsed.calls) seen.add(c.split("(")[0].replace(/^get /, ""));
  }
  for (const text of [
    "Mandatory-appearance",
    "Complete and confirm every",
    "The citation packet is incomplete",
    "paginate",
    "pick.remove",
    "frame.remove",
    "stage.querySelectorAll",
  ])
    assert.ok(
      [...seen].some((t) => t.includes(text)),
      "scenarios reach: " + text,
    );
  assert.ok(interrupted > 100 && jobs > 1500 && snow > 50, `coverage: ${interrupted} interrupted, ${jobs} jobs, ${snow} snow`);
  console.log("PASS print jobs match the retained module over 8000 scenarios (" + interrupted + " interrupted, " + jobs + " jobs)");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
