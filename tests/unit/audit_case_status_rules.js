/* Independent case-fact composition pins label precedence, live reads and returned aliases. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
const clone = (value) => structuredClone(value);
(async () => {
  const dir = path.resolve("app/modules"),
    source = fs.readFileSync(path.join(dir, "case_status.js"), "utf8");
  const factory = acorn
    .parse(source, { ecmaVersion: 2022, sourceType: "module" })
    .body.find((n) => n.declaration?.id?.name === "createCaseStatus").declaration;
  const fn = factory.body.body.find((n) => n.id?.name === "caseState"),
    reference = fs.readFileSync("tests/fixtures/case_status_reference.txt", "utf8");
  async function compile(contents) {
    const build = await esbuild.build({
      stdin: { contents: contents + '\nexport {WriterState} from "./state.js";export {caseFileName} from "./case_file_rules.js";', resolveDir: dir },
      bundle: true,
      write: false,
      format: "cjs",
      define: { __TEST_BUILD__: "true" },
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
    new Function("today", "module", "exports", '"use strict";\n' + build.outputFiles[0].text)(new Date("2026-10-27T12:00:00Z"), box, box.exports);
    return box.exports;
  }
  const [actual, legacy] = await Promise.all([compile(source), compile(source.slice(0, fn.start) + reference + source.slice(fn.end))]);
  let seed = 20261028,
    checked = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed % n;
    },
    choose = (values) => values[random(values.length)];
  function fixture() {
    return {
      k: { id: "case", number: "QA-001", address: "101 TEST ST", owner: "QA OWNER" },
      docs: [],
      visits: [],
      attempts: {},
      pending: [],
      flags: {},
    };
  }
  function document(type, id) {
    return {
      id,
      caseId: "case",
      type,
      authoringVersion: 16,
      draft: false,
      items: [{ id: "item", due: "2026-10-29", done: false, withdrawn: false }],
      special: { mode: "restrict", scope: "building", reviewDate: "2026-10-28" },
    };
  }
  function run(api, input) {
    const data = clone(input),
      { k, flags } = data,
      s = api.WriterState;
    Object.assign(s, {
      CASES: [k],
      DOCS: data.docs,
      REINSP: data.visits,
      RECORD_ATTEMPTS: data.attempts,
      PENDING: data.pending,
      EVENTS: {},
      SAVE_CHECKPOINTS: {},
      ARTIFACT_IDENTITY: {},
      ARTIFACT_VERIFY: {},
      ARTIFACT_LOCATIONS: {},
    });
    for (const d of s.DOCS)
      if (d.filedArtifact) {
        s.ARTIFACT_LOCATIONS[d.id] = flags.locations || [];
        if (flags.verify) s.ARTIFACT_VERIFY[d.id] = flags.verify;
      }
    if (flags.pendingName) s.PENDING.push({ name: api.caseFileName(k) });
    const calls = [];
    let snowIndex = 0,
      dayIndex = 0;
    const snow = {
      isCase(value) {
        calls.push(["snow", clone(value)]);
        if (flags.mutate && !snowIndex) {
          s.PENDING.push({ cid: k.id });
          if (s.DOCS[0]?.items[0]) s.DOCS[0].items[0].due = "2026-10-20";
        }
        return (flags.snow || [false, false])[Math.min(snowIndex++, 1)];
      },
    };
    const services = {
      get snow() {
        calls.push(["read-snow"]);
        return snow;
      },
      get today() {
        const day = (flags.days || ["2026-10-27", "2026-10-28", "2026-11-04"])[Math.min(dayIndex++, 2)];
        calls.push(["today", day]);
        return new Date(day + "T12:00:00Z");
      },
      unissuedVisitFor(id) {
        calls.push(["unissued", id]);
        return flags.unissued ? { id: "unissued", caseId: id, draft: false } : null;
      },
    };
    const owner = api.createCaseStatus(services);
    assert.deepEqual(calls, [], "construction is inert");
    let result, status;
    try {
      result = owner.caseState(k);
      status = ["result", clone(result)];
    } catch (error) {
      status = ["error", error.name, error.message];
    }
    const aliases = result
      ? {
          current: s.DOCS.includes(result.current),
          draft: s.DOCS.includes(result.draft),
          pending: s.DOCS.includes(result.pendingDoc),
          filing: s.DOCS.includes(result.filingDoc),
          issue: s.DOCS.includes(result.artifactIssue),
          restrictions: result.restrictions.map((d) => s.DOCS.includes(d)),
          attempt: Object.values(s.RECORD_ATTEMPTS).includes(result.pendingRecord),
          visit: s.REINSP.includes(result.visit),
        }
      : null;
    return {
      status,
      calls,
      aliases,
      state: clone({ docs: s.DOCS, visits: s.REINSP, pending: s.PENDING, attempts: s.RECORD_ATTEMPTS, events: s.EVENTS }),
    };
  }
  function compare(input) {
    const got = run(actual, input);
    assert.deepEqual(got, run(legacy, input), "case status scenario " + checked++);
    return got;
  }
  assert.equal(compare(fixture()).status[1].label, "Ready to start");
  for (const kind of [
    "notice",
    "citation",
    "extension",
    "vacancyExtension",
    "noOccupancy",
    "summaryAbatement",
    "compliance",
    "referral",
    "referralUpdate",
  ])
    for (const snow of [
      [false, false],
      [true, true],
      [true, false],
      [false, true],
    ]) {
      const value = fixture();
      value.docs.push(document(kind, "issued"));
      value.flags.snow = snow;
      compare(value);
    }
  for (let index = 0; index < 3000; index++) {
    const value = fixture();
    for (let n = random(5); n; n--) {
      const d = document(
        choose(["notice", "citation", "extension", "vacancyExtension", "noOccupancy", "compliance", "referral", "referralUpdate", "unknown"]),
        "doc-" + n,
      );
      d.draft = random(5) === 0;
      d.void = random(7) === 0;
      d.superseded = random(7) === 0;
      if (random(3) === 0) d.filedAt = "2026-10-27";
      if (random(3) === 0) d.filedArtifact = { filename: "QA.pdf", sha256: "synthetic" };
      if (random(3) === 0) d.items[0].withdrawn = true;
      if (random(3) === 0) d.items[0].done = true;
      d.items[0].due = choose([null, "", "bad", "2026-10-20", "2026-10-27", "2026-10-28", "2026-11-04", "2027-01-01"]);
      if (random(5) === 0) d.items = [];
      if (random(5) === 0) d.correction = { targetId: "earlier" };
      if (random(5) === 0) d.pendingAmendment = { id: "held" };
      d.special = { mode: choose(["restrict", "release"]), releases: "doc-1", reviewDate: choose(["", "bad", "2026-10-20", "2026-11-01"]) };
      if (random(5) === 0) d.frozen = { snowCloseOnFiling: false };
      value.docs.push(d);
    }
    value.flags = {
      snow: choose([
        [false, false],
        [true, true],
        [true, false],
        [false, true],
      ]),
      mutate: index % 13 === 0,
      unissued: index % 7 === 0,
      pendingName: index % 11 === 0,
      locations: choose([[], ["shared"], ["conflict"], ["local"]]),
      verify: choose([null, "invalid", "unavailable"]),
    };
    if (index % 3 === 0) value.visits.push({ id: "visit", caseId: "case", draft: true });
    if (index % 5 === 0) value.attempts.a = { cid: "case", id: "attempt" };
    if (index % 7 === 0) value.pending.push({ cid: "case" });
    if (index % 17 === 0) value.k.number = choose(["", "legacy / number", "QA-VALID"]);
    if (index % 19 === 0) value.docs.push({ ...document("notice", "other-case"), caseId: "other" });
    compare(value);
  }
  console.log("PASS case status equivalence", checked, "scenarios: labels, live dates/state, returned aliases and query order");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
