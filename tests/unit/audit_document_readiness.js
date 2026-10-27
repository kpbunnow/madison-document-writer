/* Independently composed readiness: existing rules and actionable target ordering. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
const root = path.resolve(__dirname, "../.."),
  dir = path.join(root, "app/modules"),
  parse = (n) => acorn.parse(fs.readFileSync(path.join(dir, n + ".js"), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
function walk(n, f) {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) return n.forEach((x) => walk(x, f));
  f(n);
  Object.values(n).forEach((x) => walk(x, f));
}
const fields = [
    "addressProblem",
    "validateAndStandardizeAddresses",
    "correctionChecks",
    "lifecycleChecks",
    "authoringChecks",
    "citationDepositFault",
    "catalogDraftBlocked",
    "initialCitations",
    "newDocuments",
    "snow",
    "unchangedCorrectionValue",
    "unchangedCourtDate",
    "attachCheckTargets",
    "today",
  ],
  used = new Set();
walk(parse("document_readiness"), (n) => {
  if (n.type === "MemberExpression" && n.object.name === "services") {
    assert.equal(n.computed, false);
    used.add(n.property.name);
  }
});
assert.deepEqual([...used].sort(), fields.slice().sort());
const entries = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []),
  e = entries.find((n) => n.id.name === "documentReadiness");
assert.equal(e.init.callee.name, "createDocumentReadiness");
assert.deepEqual(new Set(e.init.arguments[0].properties.map((p) => p.key.name)), used);
assert.ok(entries.indexOf(e) > entries.findIndex((n) => n.id.name === "documentDelivery"));
assert.ok(entries.indexOf(e) < entries.findIndex((n) => n.id.name === "documentFeedback"));
for (const p of e.init.arguments[0].properties)
  if (p.kind === "get") assert.equal(p.value.body.body[0].argument.name, p.key.name);
  else assert.equal(p.value.body.callee.name, p.key.name);
(async () => {
  const built = await esbuild.build({
    stdin: { contents: "export {createDocumentReadiness} from './document_readiness.js';export {WriterState} from './state.js';", resolveDir: dir },
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
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const { createDocumentReadiness, WriterState: s } = box.exports;
  assert.deepEqual(s, {});
  createDocumentReadiness(new Proxy({}, { get: (_, k) => assert.fail("construction reads " + String(k)) }));
  assert.deepEqual(s, {});
  let today = "2026-10-27",
    calls = [],
    snowMode = false,
    recipient = null,
    badLanguage = false,
    retainDue = false,
    retainCourt = false,
    depositFault = "",
    agentProblem = "",
    priceCalls = [];
  let snow = {
      is: () => snowMode,
      checks: () => {
        calls.push("snow");
        return [{ ok: true, t: "snow delegated" }];
      },
    },
    initial = {
      prepare: (d) => calls.push("prepare"),
      checks: () => {
        calls.push("initial");
        return [{ ok: true, t: "initial delegated" }];
      },
    };
  const services = {
    addressProblem: (...args) => {
      calls.push(["agent", ...args]);
      return agentProblem;
    },
    validateAndStandardizeAddresses: (...args) => {
      calls.push(["recipients", ...args]);
      return recipient;
    },
    correctionChecks: () => {
      calls.push("correction");
      return [{ ok: true, t: "correction delegated" }];
    },
    lifecycleChecks: () => {
      calls.push("lifecycle");
      return [{ ok: true, t: "lifecycle delegated" }];
    },
    authoringChecks: () => {
      calls.push("authoring");
      return [{ ok: true, t: "authoring delegated" }];
    },
    citationDepositFault: (...args) => {
      priceCalls.push(args);
      return depositFault;
    },
    catalogDraftBlocked: () => badLanguage,
    get initialCitations() {
      return initial;
    },
    get newDocuments() {
      return {
        specialChecks: () => {
          calls.push("special");
          return [{ ok: true, t: "special delegated" }];
        },
      };
    },
    get snow() {
      return snow;
    },
    unchangedCorrectionValue: () => retainDue,
    unchangedCourtDate: () => retainCourt,
    attachCheckTargets: (d, c) => {
      calls.push("target:" + c.t);
      return c;
    },
    get today() {
      return today;
    },
  };
  const { checks } = createDocumentReadiness(services),
    copy = (x) => JSON.parse(JSON.stringify(x));
  const kase = () => ({
    id: "c",
    number: "BI-123",
    address: "123 Main St",
    owner: "Test Owner",
    ownerAddr: ["123 Main St", "Madison WI 53703"],
    parcel: "070912345678",
    date: "2026-10-20",
    time: "10:00",
  });
  s.CASES = [kase()];
  s.DOCS = [];
  s.REINSP = [];
  const item = () => ({ id: "i", no: 1, text: "Repair siding", sections: ["27.05(2)(c)"], due: "2026-11-12" });
  const doc = () => ({
    id: "d",
    caseId: "c",
    type: "notice",
    draft: true,
    mailed: "2026-10-27",
    authoringVersion: 16,
    items: [item()],
    frozen: { inspector: { name: "Inspector" } },
  });
  const find = (rows, re) => {
    const hit = rows.find((c) => re.test(c.t));
    assert.ok(hit, String(re));
    return hit;
  };
  assert.deepEqual(checks(null), [{ ok: false, t: "Open a document first" }]);
  assert.deepEqual(calls, []);
  assert.deepEqual(checks({}), [{ ok: false, t: "Open a document first" }]);
  let d = doc(),
    before = copy(d),
    rows = checks(d);
  assert.deepEqual(d, before);
  assert.equal(calls[0], "prepare");
  assert.deepEqual(
    calls.filter((c) => typeof c === "string" && !c.startsWith("target:")),
    ["prepare", "snow", "initial", "special", "authoring", "lifecycle"],
  );
  assert.deepEqual(
    rows.slice(-5).map((c) => c.t),
    ["snow delegated", "initial delegated", "special delegated", "authoring delegated", "lifecycle delegated"],
  );
  assert.ok(calls.find((c) => Array.isArray(c) && c[0] === "recipients" && c[2] === false && c[3] === false));
  assert.ok(rows.every((c) => c.ok));
  calls = [];
  d = doc();
  d.correction = { case: kase() };
  checks(d);
  assert.ok(calls.includes("correction"));
  assert.ok(!calls.includes("lifecycle"));
  d = doc();
  d.items[0].due = "2026-10-27";
  rows = checks(d);
  assert.equal(find(rows, /today or in the past/).ok, false);
  assert.equal(find(rows, /today or in the past/).targets[0].selector, '[data-id="i"][data-field="due"]');
  today = "2026-10-26";
  rows = checks(d);
  assert.equal(find(rows, /Due dates are in the future/).ok, true);
  assert.equal(find(rows, /less than a week/).soft, true);
  today = "2026-10-27";
  retainDue = true;
  assert.equal(find(checks(d), /Due dates are in the future/).ok, true);
  retainDue = false;
  d = doc();
  d.items[0].due = "2026-02-30";
  assert.equal(find(checks(d), /not a real calendar date/).ok, false);
  d = doc();
  d.items[0].due = "2027-06-01";
  assert.equal(find(checks(d), /more than six months/).ok, false);
  d = doc();
  d.items[0].due = "";
  assert.equal(find(checks(d), /no due date/).ok, false);
  badLanguage = true;
  assert.equal(find(checks(doc()), /draft language or retired/).ok, false);
  badLanguage = false;
  recipient = { message: "bad recipient", scope: "cc", index: 2, field: "city" };
  rows = checks(doc());
  assert.equal(find(rows, /bad recipient/).ok, false);
  assert.equal(find(rows, /bad recipient/).targets[0].action, "recipient:cc:2:city");
  recipient = null;
  s.CASES = [{ ...kase(), owner: "", ownerAddr: [], parcel: "" }];
  rows = checks(doc());
  assert.equal(find(rows, /No defendant name/).ok, false);
  assert.equal(find(rows, /No parcel number/).ok, false);
  s.CASES = [kase()];
  d = doc();
  d.inspDate = "2026-10-20";
  d.inspTime = "";
  assert.equal(find(checks(d), /Enter the inspection time/).ok, false);
  d.inspTime = "14:15";
  assert.equal(find(checks(d), /Inspection time recorded/).ok, true);
  d.inspDate = "2026-10-28";
  assert.equal(find(checks(d), /No inspection date/).ok, false);
  d = doc();
  d.type = "compliance";
  d.items[0].done = true;
  d.items[0].doneOn = "2026-10-22";
  d.items[0].due = "";
  rows = checks(d);
  assert.ok(!rows.some((c) => /due date/i.test(c.t)));
  assert.equal(find(rows, /Every item is corrected/).ok, true);
  assert.equal(find(rows, /Every item carries its date/).ok, true);
  d.items[0].doneOn = "2026-10-29";
  assert.equal(find(checks(d), /no date of compliance/).ok, false);
  d.items[0].withdrawn = true;
  assert.ok(!checks(d).some((c) => /no date of compliance/.test(c.t)));
  d = doc();
  d.type = "bestInterestExtension";
  d.items[0].due = "";
  d.items[0].sections = [];
  rows = checks(d);
  assert.ok(!rows.some((c) => /no due date|no ordinance section|outstanding/.test(c.t)));
  snowMode = true;
  rows = checks({ ...doc(), items: [{ ...item(), due: "" }] });
  assert.ok(!rows.some((c) => /due date/i.test(c.t)));
  snowMode = false;
  d = doc();
  d.importRule = { kind: "initial", cite: true, status: "Citation" };
  assert.equal(find(checks(d), /status is Citation/).ok, false);
  d.items[0].cite = true;
  assert.equal(find(checks(d), /Matches the Accela status/).ok, true);
  d.importRule = { kind: "initial", cite: false, doc: "notice", status: "Official Notice" };
  assert.equal(find(checks(d), /status is Official Notice/).ok, false);
  d.items[0].withdrawn = true;
  assert.equal(find(checks(d), /Matches the Accela status/).ok, true);
  d.correction = { case: kase() };
  assert.ok(!checks(d).some((c) => /Accela status/.test(c.t)));
  d = doc();
  d.type = "citation";
  d.items[0].cite = true;
  d.cits = { i: { num: "B00000000100", courtDate: "2026-12-16", amount: "197", ord: "27.05(2)(c)", desc: "repair", deptId: "123" } };
  rows = checks(d);
  assert.equal(find(rows, /Court citation fields complete/).ok, true);
  assert.equal(find(rows, /Officer I.D. number present/).ok, true);
  assert.equal(find(rows, /Court dates are in the future/).ok, true);
  assert.ok(priceCalls.some((a) => a[0] === d.cits.i && a[1] === d && a[2] === d.items[0]));
  d.cits.i.deptId = "";
  assert.equal(find(checks(d), /no badge number/).ok, false);
  d.cits.i.amount = "";
  assert.equal(find(checks(d), /still blank/).ok, false);
  d.cits.i.mandatoryAppearance = true;
  assert.equal(find(checks(d), /Court citation fields complete/).ok, true);
  depositFault = "unapproved";
  assert.equal(find(checks(d), /unresolved deposit/).ok, false);
  depositFault = "";
  d.cits.i.courtDate = "2026-10-27";
  assert.equal(find(checks(d), /not a real date in the future/).ok, false);
  retainCourt = true;
  assert.equal(find(checks(d), /Court dates are in the future/).ok, true);
  retainCourt = false;
  s.CASES = [{ ...kase(), owner: "Company LLC", agent: { name: "Agent", addr: "Street", city: "City" } }];
  agentProblem = "missing agent address";
  rows = checks(d);
  assert.equal(find(rows, /company/).ok, false);
  assert.ok(calls.some((c) => Array.isArray(c) && c[0] === "agent" && c[1] === "Agent" && c[2] === "Street"));
  agentProblem = "";
  s.CASES = [kase()];
  initial = {
    prepare: (d) => {
      d.items.push({ ...item(), id: "prepared", no: 2, due: "" });
    },
    checks: () => [],
  };
  d = doc();
  rows = checks(d);
  assert.equal(d.items.length, 2);
  assert.equal(find(rows, /no due date/).ok, false);
  console.log(
    JSON.stringify({
      passed: true,
      inputs: 14,
      inertConstruction: true,
      preparationAndRuleOrder: true,
      liveDayAndCorrectionExceptions: true,
      actionableTargets: true,
      complianceSpecialAndSnow: true,
      importAndCitationRefusals: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
