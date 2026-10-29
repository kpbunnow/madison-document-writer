/* Original serialization refusals plus complete save/fallback/read-order parity. */
require("../fixtures/retained_owner_parity.cjs").compareRetainedOwner("tests/unit/audit_r50_errors.js", [
  { source: "app/modules/case_save_workflow.js", reference: "tests/fixtures/case_save_workflow_reference.txt" },
]);
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild");
(async () => {
  async function compile(contents) {
    const b = await esbuild.build({
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
    class Clock extends Date {
      constructor(...a) {
        super(...(a.length ? a : ["2026-10-28T12:00:00Z"]));
      }
    }
    new Function("Date", "module", "exports", b.outputFiles[0].text)(Clock, box, box.exports);
    return box.exports;
  }
  const [current, legacy] = await Promise.all([
    compile(fs.readFileSync("app/modules/case_save_workflow.js", "utf8")),
    compile(fs.readFileSync("tests/fixtures/case_save_workflow_reference.txt", "utf8")),
  ]);
  async function run(api, input) {
    const x = structuredClone(input),
      s = api.WriterState,
      calls = [];
    let serializations = 0,
      writes = 0,
      effects = 0;
    const k = { id: "case", number: "QA-1", address: "1 TEST ST" },
      file = { format: "madison-case-file", schema: x.schema, case: k, events: [] };
    Object.assign(s, {
      CASES: [k],
      CASEDIR: x.folder ? { helper: true } : null,
      NEEDGRANT: x.grant,
      DIRNAME: "Synthetic <&>",
      PENDING: x.pending ? [{ name: "1 TEST ST - QA-1.json", cid: "case" }] : [],
      DIRTY: true,
      LASTWRITE: null,
    });
    const values = {
      caseNumberAllowed: () => x.allowed,
      caseFile: () => {
        if (++serializations === x.serializeFailure) throw new Error("serialization interrupted");
        return file;
      },
      mergeSharedFile: () => {
        if (x.mergeFailure) throw new Error("shared merge refused");
        return x.merged;
      },
      writeToFolder: () => {
        writes++;
        return writes === 1 ? x.first : x.second;
      },
      idbSet: () => true,
      saveDrafts: () => true,
      grantCaseFolder: () => {
        s.NEEDGRANT = false;
        return true;
      },
    };
    const services = new Proxy(
      {},
      {
        get(_, key) {
          calls.push("get:" + key);
          return (...args) => {
            calls.push(["call:" + key, ...structuredClone(args)]);
            if (++effects === x.fail) throw new Error("interrupted " + key);
            return values[key]?.(...args);
          };
        },
      },
    );
    const owner = api.createCaseSaveWorkflow(services);
    assert.deepEqual(calls, []);
    let result, error;
    try {
      result = await owner.saveCaseFile("case");
    } catch (e) {
      error = [e.name, e.message];
    }
    return { result, error, calls, state: structuredClone(s) };
  }
  let seed = 20261116,
    checked = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (a) => a[random(a.length)];
  function fixture() {
    return {
      allowed: true,
      folder: true,
      grant: false,
      pending: false,
      schema: 5,
      merged: 0,
      mergeFailure: false,
      serializeFailure: 0,
      first: { ok: true },
      second: { ok: true },
      fail: 0,
    };
  }
  async function compare(x) {
    assert.deepEqual(await run(current, x), await run(legacy, x), "scenario " + checked++);
  }
  assert.equal((await run(current, fixture())).result, true);
  for (const folder of [false, true])
    for (const schema of [4, 5])
      for (const grant of [false, true])
        for (const first of [{ ok: true }, { ok: false, needGrant: true }, { ok: false, why: "offline" }])
          for (const pending of [false, true]) await compare({ ...fixture(), folder, schema, grant, first, pending });
  for (let n = 0; n < 4000; n++) {
    const x = fixture();
    for (const key of ["allowed", "folder", "grant", "pending"]) x[key] = !!random(2);
    x.schema = pick([4, 5]);
    x.merged = pick([0, 1, 2]);
    x.mergeFailure = random(5) === 0;
    x.serializeFailure = random(3);
    x.first = pick([{ ok: true }, { ok: false, needGrant: true }, { ok: false, why: "offline" }]);
    x.second = pick([{ ok: true }, { ok: false, needGrant: true }, { ok: false, why: "offline" }]);
    x.fail = random(3) ? 0 : random(20) + 1;
    await compare(x);
  }
  console.log(
    "PASS case save equivalence " +
      checked +
      " scenarios: downloads, permissions, merges, queue removal, serialization/write/refusal and service order",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
