/* Diagnostic JavaScript coverage collector (tools/measure_coverage.py). Loaded with `node --require` through
   NODE_OPTIONS in an isolated copy of the repository; never part of the gate, build or runtime.

   Writer modules are bundled by esbuild and executed through new Function, eval, jsdom or vm, so V8's own
   per-URL coverage cannot name their source files. This hook therefore:
   - forces inline source maps on every esbuild build in the process tree (including tools/build.py's builder);
   - records V8 precise block coverage through the in-process inspector;
   - at exit, writes each script's coverage ranges with its source text and source map for tools/coverage_js_report.cjs.
   Scripts without a source map (test files, node_modules, tools) are written by URL only. */
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const inspector = require("node:inspector");

const OUT = process.env.DW_JS_COVERAGE_DIR;
if (OUT) {
  const load = Module._load;
  Module._load = function (request, parent, isMain) {
    const loaded = load.apply(this, arguments);
    if (request !== "esbuild" || loaded.__dwCoverage) return loaded;
    // esbuild writes map sources relative to the output file's folder (or the working directory without one); an
    // absolute sourceRoot makes them resolvable wherever the bundle later runs.
    const withMap = (options) => ({
      ...options,
      sourcemap: "inline",
      sourcesContent: false,
      sourceRoot: path.resolve(options.absWorkingDir || process.cwd(), options.outfile ? path.dirname(options.outfile) : options.outdir || "."),
    });
    // esbuild exports getter-only properties, so the patched API is a plain copy rather than a derived object.
    return {
      ...loaded,
      build: (options) => loaded.build(withMap(options)),
      buildSync: (options) => loaded.buildSync(withMap(options)),
      __dwCoverage: true,
    };
  };
  const session = new inspector.Session();
  session.connect();
  const scripts = new Map();
  session.on("Debugger.scriptParsed", ({ params }) => scripts.set(params.scriptId, params));
  session.post("Debugger.enable");
  session.post("Profiler.enable");
  session.post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  process.on("exit", () => {
    let result;
    session.post("Profiler.takePreciseCoverage", (error, value) => (result = error ? null : value));
    if (!result) return;
    const records = [];
    for (const entry of result.result) {
      const info = scripts.get(entry.scriptId) || {};
      if (entry.url.startsWith("file:")) {
        records.push({ url: entry.url, functions: entry.functions });
        continue;
      }
      // new Function and eval wrap the text, so V8 may not see the trailing map comment: read it from the source.
      let source = null;
      session.post("Debugger.getScriptSource", { scriptId: entry.scriptId }, (e, v) => (source = e ? null : v.scriptSource));
      const map = info.sourceMapURL?.startsWith("data:") ? info.sourceMapURL : /\/\/# sourceMappingURL=(data:[^\s]+)/.exec(source || "")?.[1];
      if (map) records.push({ url: entry.url, functions: entry.functions, sourceMapURL: map, source });
    }
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, `js-${process.pid}-${Date.now()}.json`), JSON.stringify({ cwd: process.cwd(), records }));
  });
}
