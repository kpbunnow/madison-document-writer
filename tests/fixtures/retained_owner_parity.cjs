/* Run an existing public-owner suite unchanged against maintained and retained modules. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "../.."),
  key = "DW_RETAINED_OWNER_SET";
if (process.env[key]) {
  const entries = JSON.parse(process.env[key]);
  const sources = new Map(
    entries.map(({ source, reference }) => {
      assert.match(source, /^app\/modules\/[a-z_]+\.js$/);
      assert.match(reference, /^tests\/fixtures\/[a-z_]+\.txt$/);
      return [path.resolve(root, source), fs.readFileSync(path.resolve(root, reference), "utf8")];
    }),
  );
  const loaded = new Set();
  process.on("exit", (code) => {
    if (code === 0) for (const source of sources.keys()) assert.ok(loaded.has(source), "retained owner was not exercised: " + source);
  });
  const id = require.resolve("esbuild"),
    esbuild = require(id);
  require.cache[id].exports = {
    ...esbuild,
    build(options) {
      return esbuild.build({
        ...options,
        plugins: [
          {
            name: "retained-public-owner",
            setup(build) {
              build.onLoad({ filter: /\.js$/ }, (args) =>
                sources.has(args.path)
                  ? (loaded.add(args.path), { contents: sources.get(args.path), loader: "js", resolveDir: path.dirname(args.path) })
                  : undefined,
              );
            },
          },
          ...(options.plugins || []),
        ],
      });
    },
  };
}
function compareRetainedOwner(suite, entries) {
  assert.match(suite, /^tests\/unit\/audit_[a-z_0-9]+\.js$/);
  const clean = { ...process.env };
  delete clean[key];
  const run = (retained) =>
    spawnSync(process.execPath, [...(retained ? ["--require", __filename] : []), path.resolve(root, suite)], {
      cwd: root,
      env: retained ? { ...clean, [key]: JSON.stringify(entries) } : clean,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      timeout: 65000,
    });
  const actual = run(false),
    original = run(true);
  for (const [label, result] of [
    ["maintained", actual],
    ["retained", original],
  ]) {
    assert.equal(result.status, 0, `${label} owner suite failed: ${result.error || ""}\n${result.stdout}\n${result.stderr}`);
    assert.ok(result.stdout.trim(), `${label} owner suite produced no evidence`);
  }
  assert.equal(actual.stdout, original.stdout, "public-owner suite output must remain byte-identical");
  assert.equal(actual.stderr, original.stderr, "public-owner suite diagnostics must remain byte-identical");
  console.log("PASS retained public-owner parity: " + suite);
}
module.exports = { compareRetainedOwner };
