/* Utility owners load independently; formatting, randomness and catalog semantics stay intact. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  vm = require("vm"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
const root = path.resolve(__dirname, "../.."),
  dir = path.join(root, "app/modules"),
  read = (n) => fs.readFileSync(path.join(dir, n + ".js"), "utf8");
assert.equal(fs.existsSync(path.join(dir, "court_and_deposits.js")), false);
const owners = {
  rnd12: "record_ids",
  allItems: "catalog_queries",
  splitOwner: "mailing_rules",
  fmtDate: "presentation_format",
  longDate: "presentation_format",
  fmtTime: "presentation_format",
};
for (const file of fs.readdirSync(dir).filter((n) => n.endsWith(".js"))) {
  const ast = acorn.parse(fs.readFileSync(path.join(dir, file), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
  for (const n of ast.body) {
    if (n.type === "ImportDeclaration") {
      assert.notEqual(n.source.value, "./court_and_deposits.js");
      for (const s of n.specifiers)
        if (s.imported && owners[s.imported.name])
          assert.equal(n.source.value, "./" + owners[s.imported.name] + ".js", file + " imports the defining utility owner");
    }
    if (n.type === "ExportNamedDeclaration" && n.source)
      for (const s of n.specifiers) assert.ok(!owners[s.exported.name], "do not forward utility names through a barrel");
  }
}
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents:
        "export {fmtDate,longDate,fmtTime} from './presentation_format.js';export {splitOwner} from './mailing_rules.js';export {rnd12} from './record_ids.js';export {allItems} from './catalog_queries.js';export {WriterState} from './state.js';",
      resolveDir: dir,
    },
    bundle: true,
    format: "cjs",
    write: false,
    plugins: [
      {
        name: "data",
        setup(b) {
          b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.join(root, "build/generated/modules/data", path.basename(a.path)) }));
        },
      },
    ],
  });
  const oldNow = Date.now,
    oldRandom = Math.random;
  let box = { exports: {} };
  try {
    Date.now = Math.random = () => assert.fail("utility loading reads ambient clock/randomness");
    new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  } finally {
    Date.now = oldNow;
    Math.random = oldRandom;
  }
  const { fmtDate, longDate, fmtTime, splitOwner, allItems, WriterState } = box.exports;
  assert.deepEqual(WriterState, {});
  for (const [input, short, long] of [
    ["2024-02-29", "02/29/2024", "Thursday, February 29, 2024"],
    ["2026-12-31", "12/31/2026", "Thursday, December 31, 2026"],
    ["2027-01-01", "01/01/2027", "Friday, January 1, 2027"],
  ]) {
    assert.equal(fmtDate(input), short);
    assert.equal(longDate(input), long);
  }
  assert.equal(fmtDate(""), "—");
  assert.equal(fmtDate(null), "—");
  assert.equal(longDate(""), "");
  assert.equal(longDate(null), "");
  for (const [v, want] of [
    ["00:00", "12:00 AM"],
    ["12:00", "12:00 PM"],
    ["09:05", "9:05 AM"],
    ["23:59", "11:59 PM"],
    ["", ""],
  ])
    assert.equal(fmtTime(v), want);
  assert.deepEqual(splitOwner("  Owner One \n \n  Owner Two\n 123 Main St \n Madison WI 53703 \n"), {
    owner: "Owner One",
    addr: ["Owner Two", "123 Main St", "Madison WI 53703"],
  });
  assert.deepEqual(splitOwner(null), { owner: "", addr: [] });
  assert.deepEqual(splitOwner("Only owner"), { owner: "Only owner", addr: [] });
  // The historical name rnd12 still produces eight bytes / sixteen hex characters.
  const randomSource = read("record_ids").replace("export function rnd12", "function rnd12") + "\nrnd12";
  let calls = 0,
    randomCalls = 0;
  const bytes = [0, 1, 15, 16, 127, 128, 254, 255],
    crypto = {
      getRandomValues(target) {
        assert.equal(this, crypto);
        assert.equal(target.length, 8);
        calls++;
        target.set(bytes);
        return target;
      },
    };
  const native = vm.runInNewContext(randomSource, {
    crypto,
    Math: { floor: Math.floor, random: () => assert.fail("native path must not use fallback") },
  });
  assert.equal(calls, 0);
  assert.equal(native(), "00010f107f80feff");
  assert.equal(calls, 1);
  for (const environment of [{}, { crypto: undefined }, { crypto: {} }]) {
    randomCalls = 0;
    const fallback = vm.runInNewContext(randomSource, { ...environment, Math: { floor: Math.floor, random: () => bytes[randomCalls++] / 256 } });
    assert.equal(randomCalls, 0);
    assert.equal(fallback(), "00010f107f80feff");
    assert.equal(randomCalls, 8);
  }
  const broken = vm.runInNewContext(randomSource, {
    crypto: {
      getRandomValues() {
        throw Error("native refusal");
      },
    },
    Math: { floor: Math.floor, random: () => assert.fail("must not swallow native refusal") },
  });
  assert.throws(() => broken(), /native refusal/);
  const nested = ["retained"],
    library = [
      {
        name: "First",
        groups: [
          { name: "Empty", items: [] },
          { name: "Group A", items: [{ id: "a", ci: 99, gi: 99, cl: "wrong", grp: "wrong", sections: nested }, { id: "b" }] },
        ],
      },
      { name: "Second", groups: [{ name: "Group B", items: [{ id: "c" }] }] },
    ];
  const catalogSource =
    read("catalog_queries")
      .replace(/^import[^\n]+\n/, "")
      .replace("export function allItems", "function allItems") + "\nallItems";
  const query = vm.runInNewContext(catalogSource, { LIBRARY: library }),
    result = query();
  assert.deepEqual(
    Array.from(result, (x) => x.id),
    ["a", "b", "c"],
  );
  assert.deepEqual(JSON.parse(JSON.stringify(result[0])), { id: "a", ci: 0, gi: 1, cl: "First", grp: "Group A", sections: ["retained"] });
  assert.notEqual(result[0], library[0].groups[1].items[0]);
  assert.equal(result[0].sections, nested, "retain original shallow-copy semantics");
  assert.equal(library[0].groups[1].items[0].ci, 99);
  result[0].id = "private";
  assert.equal(query()[0].id, "a");
  library.push({ name: "Later", groups: [{ name: "New", items: [{ id: "later" }] }] });
  assert.equal(query().at(-1).id, "later");
  assert.notEqual(query(), query());
  const real = allItems();
  assert.ok(real.length > 100);
  assert.ok(real.every((i) => typeof i.cl === "string" && typeof i.grp === "string" && Number.isInteger(i.ci) && Number.isInteger(i.gi)));
  assert.notEqual(real, allItems());
  console.log(
    JSON.stringify({
      passed: true,
      independentLoading: true,
      definingImports: true,
      formatAndMailing: true,
      nativeAndFallbackRandomness: true,
      catalogOrderMetadataAndShallowCopies: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
