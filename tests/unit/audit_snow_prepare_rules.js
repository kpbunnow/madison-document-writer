/* Retained check routing protects message precedence, targets, lazy case/date reads and alias behavior. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
(async () => {
  let active;
  const dom = {
    addEventListener(type) {
      active.calls.push("listener:" + type);
    },
  };

  const source = fs.readFileSync("app/modules/snow_cases.js", "utf8"),
    factory = acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" }).body.find((n) => n.declaration?.id?.name === "initSnow").declaration,
    fn = factory.body.body.find((n) => n.id?.name === "prepare"),
    reference = fs.readFileSync("tests/fixtures/snow_prepare_reference.txt", "utf8");
  async function compile(contents) {
    const b = await esbuild.build({
      stdin: {
        contents:
          contents +
          '\nexport {WriterState} from "./state.js";export {validISO} from "./calendar.js";export {fmtDate} from "./presentation_format.js";export {DEFAULT_SNOW_LETTER} from "./data/snow_letter.js";',
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
    new Function("today", "document", "module", "exports", b.outputFiles[0].text)(new Date("2026-10-29T12:00:00Z"), dom, box, box.exports);
    return box.exports;
  }
  const [current, legacy] = await Promise.all([compile(source), compile(source.slice(0, fn.start) + reference + source.slice(fn.end))]);
  async function run(api, input) {
    const x = structuredClone(input),
      calls = [],
      s = api.WriterState;
    active = { calls };
    let steps = 0;
    Object.assign(s, {
      CASES: [x.k],
      DOCS: [x.d],
      HELPER: x.helper ? { ok: true } : null,
      CASEDIR: x.folder ? { helper: true } : null,
      state: { docId: x.d.id },
      DIRTY: false,
    });
    function event(key, args = []) {
      calls.push([key, structuredClone(args), structuredClone(x.d)]);
      if (++steps === x.fail && key !== "renderKeep" && key !== "helperJSON") throw Error("interrupted:" + key);
    }
    const owner = api.initSnow({
      helperJSON(url) {
        event("helperJSON", [url]);
        if (x.mutate) x.k.date = "2026-10-25";
        return x.unavailable ? Promise.reject(Error("offline")) : Promise.resolve({ letter: api.DEFAULT_SNOW_LETTER });
      },
      citationNumber() {
        event("number");
        return "QA-SNOW";
      },
      nextCourtDate(day) {
        event("courtDate", [day]);
        if (x.switchDoc) s.state.docId = "other";
        return "2026-12-02";
      },
      validISO(day) {
        event("validISO", [day]);
        return api.validISO(day);
      },
      fmtDate(day) {
        event("fmtDate", [day]);
        return api.fmtDate(day);
      },
      renderKeep() {
        event("renderKeep");
      },
    });
    assert.equal(
      calls.some((c) => Array.isArray(c)),
      false,
      "construction registers listeners without reading services",
    );
    let result, error;
    try {
      result = owner.prepare(x.d);
    } catch (e) {
      error = [e.name, e.message];
    }
    await new Promise(setImmediate);
    if (x.repeat) {
      try {
        owner.prepare(x.d);
      } catch (e) {
        error = [e.name, e.message];
      }
      await new Promise(setImmediate);
    }
    return { result, error, calls, input: x, state: structuredClone(s) };
  }
  let seed = 20261202,
    count = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (a) => a[random(a.length)];
  const key = '["ENF_PM_PROPMAINT","SNOW",1]';
  function fixture() {
    return {
      k: { id: "case", caseType: "snow-10.28", date: "2026-10-28", time: "09:30", inspectorId: "i4" },
      d: {
        id: "draft",
        caseId: "case",
        type: "citation",
        draft: true,
        mailed: "2026-10-28",
        inspectorId: "i4",
        items: [{ id: "one", no: "1", libraryKey: key, due: "2026-11-10" }],
        snow: { snowfallDate: "2026-10-20", inches: 2, condition: "snow covered", cornerNotCleared: false },
      },
      helper: false,
      folder: false,
      unavailable: false,
      mutate: false,
      switchDoc: false,
      repeat: false,
      fail: 0,
    };
  }
  async function compare(x) {
    assert.deepEqual(await run(current, x), await run(legacy, x), "scenario " + count++);
  }
  for (const helper of [true, false])
    for (const folder of [true, false])
      for (const repeat of [true, false])
        for (const length of [0, 1, 2]) {
          const x = fixture();
          Object.assign(x, { helper, folder, repeat });
          x.d.items = Array.from({ length }, (_, i) => ({ ...x.d.items[0], id: "item" + i }));
          await compare(x);
        }
  for (let i = 0; i < 1800; i++) {
    const x = fixture();
    Object.assign(x, {
      helper: !!random(2),
      folder: !!random(2),
      unavailable: !!random(2),
      mutate: !!random(2),
      switchDoc: !!random(2),
      repeat: !!random(2),
      fail: random(9),
    });
    x.d.draft = random(10) !== 0;
    if (random(10) === 0) x.d.pendingAmendment = { id: "pending" };
    x.k.caseType = pick(["snow-10.28", "snow-10.28", ""]);
    x.d.authoringVersion = pick([6, 9, 16]);
    x.d.inspDate = pick(["", null, "2026-10-27"]);
    x.d.inspTime = pick(["", null, "10:15"]);
    if (random(6) === 0) delete x.d.snow;
    else
      Object.assign(x.d.snow, {
        snowfallDate: pick(["", "bad", "2026-10-20"]),
        inches: pick([0, 1, 2, 1e-8, "2", null]),
        condition: pick(["snow covered", "ice covered", "snow and ice covered", "bad"]),
        cornerNotCleared: !!random(2),
      });
    if (random(8) === 0) x.d.items[0].libraryKey = "other";
    if (random(2)) x.d.cits = { one: { num: "RETAINED", depositMode: "base", amount: "197", ord: "10.28", comment: "Earlier" } };
    await compare(x);
  }
  console.log(
    "PASS snow preparation equivalence " +
      count +
      " inputs: retained identity/inspection, citation defaults, asynchronous letter reads, repeat preparation and failures",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
