/* Shared pieces of the frozen-original equivalence suites: compile a module (or its retained copy) with the
   generated data folder, a seeded generator, a peer recorder that logs every read and call in order and can
   interrupt the nth one, and a target that captures the listener a module registers. */
const path = require("node:path"),
  esbuild = require("esbuild");

async function compile(contents, extraExports = "") {
  const build = await esbuild.build({
    stdin: {
      contents: contents + '\nexport {WriterState} from "./state.js"; export {INSPECTORS} from "./data/inspectors.js";' + extraExports,
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
  new Function("today", "module", "exports", build.outputFiles[0].text)(new Date("2026-10-27T12:00:00Z"), box, box.exports);
  return box.exports;
}

function prng(seed) {
  const random = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor((seed / 4294967296) * n);
  };
  return { random, pick: (values) => values[random(values.length)], chance: (n) => random(n) === 0 };
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

/* A fresh target per run: the module registers once and the listener is kept for the test to drive. */
function listenerTarget() {
  const listeners = {};
  return { listeners, addEventListener: (type, fn) => (listeners[type] = fn) };
}

module.exports = { compile, prng, recorder, listenerTarget };
