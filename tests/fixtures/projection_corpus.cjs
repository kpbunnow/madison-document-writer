/* Synthetic case files and the real summarize() output for each, from the built Writer bundle.
   Usage: node tests/fixtures/projection_corpus.cjs <output.json> [count] [seed]
   audit_case_projection.py requires helper/case_projection.py to produce the same reportable fields. */
globalThis.MADISON_TEST_DATA = true;
const fs = require("fs");
const { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("./built_bundle.cjs");
const [output, count = "500", seed = "20261021"] = process.argv.slice(2);
const html = builtPage(),
  src = bundleSource(html);
const dom = new JSDOM('<!doctype html><html><head></head><body><div id="app"></div><div id="overlay"></div><div id="toast"></div></body></html>', {
  pretendToBeVisual: true,
  url: "http://127.0.0.1:8777/",
});
const w = dom.window;
global.window = w;
global.document = w.document;
global.getSelection = () => w.getSelection();
global.Blob = function () {};
global.URL = { createObjectURL: () => "b", revokeObjectURL() {} };
global.FileReader = w.FileReader;
global.confirm = () => true;
global.indexedDB = undefined;
global.fetch = async () => {
  throw 0;
};
globalThis.__CORPUS = { output, count: +count, seed: +seed };

const T = String.raw`
(async function () {
  await new Promise((resolve) => setTimeout(resolve, 30));
  let state = __CORPUS.seed >>> 0;
  const rand = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const chance = (p) => rand() < p;
  const maybe = (p, value) => (chance(p) ? value : undefined);
  const entries = [];
  LIBRARY.forEach((cl) => cl.groups.forEach((g) => g.items.forEach((it) => entries.push({ cl, g, it }))));
  const ids = ["i1", "i5", "i12", "i29", "x-retired", ""];
  const names = ["SYNTHETIC INSPECTOR A", "SYNTHETIC INSPECTOR B", undefined];
  const owners = ["José — SYNTHETIC OWNER", "SYNTHETIC OWNER LLC", "", "Zoë Ñúñez SYNTHETIC"];
  const addrs = [
    ["SYNTHETIC OWNER", "123 MAIN ST APT 4", "MADISON WI 53703-1234"],
    ["SYNTHETIC TRUST", "PO BOX 77", "MADISON, WI 53701"],
    ["NO STREET LINE", "MADISON WI 53703"],
    ["SYNTHETIC OWNER", "45 E WASHINGTON AVENUE # 2", "MADISON WI 53703"],
    [],
  ];
  const outcomes = ["corrected", "notCorrected", "partial", "withdrawn", "noAccess"];
  const days = ["2026-03-07", "2026-03-08", "2026-06-30", "2026-07-01", "2026-11-01", "2026-12-31", "2027-01-01"];
  const instant = (day, n) => {
    // Include UTC times that fall on the previous City day and DST transitions.
    const hh = pick(["03", "05", "06", "15", "23"]);
    return day + "T" + hh + ":" + String(10 + (n % 50)).padStart(2, "0") + ":0" + (n % 10) + "." + String(n % 1000).padStart(3, "0") + "Z";
  };
  const item = (i) => {
    const e = pick(entries),
      how = rand();
    const it = { id: "it" + i, no: chance(0.8) ? i + 1 : String(i + 1), title: e.it.t, sections: (e.it.s || []).slice() };
    if (how < 0.5) it.lib = { c: e.cl.code, g: e.g.code, o: e.it.o };
    else if (how < 0.7) it.title = "Unlisted synthetic condition " + i;
    else if (how < 0.8) it.sections = [];
    if (chance(0.15)) Object.assign(it, { withdrawn: true, withdrawalReason: pick(["Duplicate", ""]) });
    if (chance(0.2)) Object.assign(it, { done: true, doneOn: pick(days) });
    if (chance(0.7)) it.due = pick(days);
    if (chance(0.1)) it.dueExempt = "restriction";
    if (chance(0.6)) it.cite = true;
    return it;
  };
  for (let n = 0; n < __CORPUS.count; n++) {
    const snowCase = chance(0.12);
    const k = {
      id: "case_" + n,
      number: "QA-PROJ-" + n,
      address: chance(0.9) ? n + " SYNTHETIC ST" : "",
      siteCity: pick(["MADISON WI 53703", "MADISON, WI 53704-1234", "", "MADISON WI 5370"]),
      parcel: pick(["070812345678", "0708-123-4567-8", "", "12345"]),
      description: maybe(0.5, "Synthetic description " + n),
      inspectorId: pick(ids),
      date: maybe(0.9, pick(days)),
      owner: maybe(0.8, pick(owners)),
      ownerAddr: maybe(0.8, pick(addrs)),
      caseType: snowCase ? "snow-10.28" : maybe(0.5, pick(["housing", "zoning"])),
      historic: maybe(0.2, true),
      landmark: maybe(0.1, 1),
    };
    if (k.ownerAddr && chance(0.2)) k.ownerAddressParsed = { accepted: true, acceptedLines: k.ownerAddr.slice(), ownerKey: maybe(0.8, "SYNTHETIC KEY") };
    const inspectors = [{ id: "x-retired", name: "RETIRED SYNTHETIC INSPECTOR" }].filter(() => chance(0.7));
    const events = [],
      docs = [],
      visits = [];
    let t = 0;
    const by = () => pick(ids);
    const add = (type, payload, day) => {
      const ev = { id: "ev" + String(t).padStart(3, "0") + (chance(0.1) ? "b" : ""), type, at: instant(day || pick(days), t++), by: by(), payload };
      if (chance(0.05) && events.length) ev.at = events[events.length - 1].at; // equal instants order by id
      events.push(ev);
      return ev;
    };
    const frozen = () =>
      chance(0.9)
        ? {
            case: { ...k, owner: chance(0.3) ? "PRINTED SYNTHETIC OWNER" : k.owner, ownerAddr: chance(0.3) ? ["PRINTED", "1 PRINTED ST", "MADISON WI 53703"] : k.ownerAddr },
            inspector: chance(0.8) ? { name: pick(names) } : undefined,
            snowCloseOnFiling: maybe(0.3, chance(0.5)),
          }
        : undefined;
    const snapshot = (type, id, items, extra) => {
      const d = { id, type, caseId: chance(0.9) ? k.id : "other", items, frozen: frozen(), cits: {}, mailed: maybe(0.7, pick(days)), ...extra };
      if (chance(0.1)) d.caseType = k.caseType;
      return d;
    };
    const cite = (d) => {
      d.items.forEach((it, i) => {
        if (chance(0.8))
          d.cits[it.id] = {
            num: maybe(0.95, "QA-CIT-" + n + "-" + (chance(0.1) ? 0 : i)),
            ord: maybe(0.7, (it.sections || [])[0]),
            desc: maybe(0.8, "SYNTHETIC DEFECT"),
            courtDate: maybe(0.8, pick(days)),
            amount: pick(["197.00", "$1,234.50", "", "abc", "12.5.7", ".5", 300]),
            tier: maybe(0.8, pick(["1st", "2nd"])),
            overrideBasis: maybe(0.1, { authorizationId: "synthetic" }),
          };
      });
    };
    const steps = 1 + Math.floor(rand() * 9);
    let noticeItems = Array.from({ length: Math.floor(rand() * 5) }, (_, i) => item(i));
    if (snowCase) {
      const d = snapshot("citation", "snow" + n, noticeItems.length ? noticeItems : [item(0)], {
        caseType: maybe(0.7, "snow-10.28"),
        snow: { snowfall: pick(days), inches: 2, condition: "Snow-covered", photographed: true },
        snowInspectionId: maybe(0.9, "si" + n),
        inspDate: pick(days),
        inspTime: maybe(0.9, "08:30"),
      });
      cite(d);
      docs.push(d);
      add("citation.issued", { docId: d.id, snapshot: d });
    } else if (chance(0.9)) {
      const d = snapshot("notice", "n" + n, noticeItems);
      docs.push(d);
      add("notice.issued", { docId: d.id, snapshot: d });
    }
    for (let s = 0; s < steps && docs.length; s++) {
      const source = pick(docs),
        action = rand();
      if (action < 0.25) {
        const r = {
          id: "r" + n + "-" + s,
          date: pick(days),
          sourceDocId: source.id,
          purpose: maybe(0.5, pick(["violation", "followup"])),
          inspectorId: pick(ids),
          inspector: chance(0.5) ? { name: pick(names) } : undefined,
          results: {},
          replaces: chance(0.1) && visits.length ? pick(visits).id : undefined,
        };
        source.items.forEach((it) => {
          if (chance(0.8)) r.results[it.id] = { oc: pick(outcomes), on: maybe(0.5, pick(days)), carried: maybe(0.15, true) };
        });
        visits.push(r);
        add("reinspection.recorded", { reinspection: r });
      } else if (action < 0.5) {
        const type = pick(["extension", "citation", "compliance", "referral", "referralUpdate", "bestInterestExtension", "vacancyExtension", "summaryAbatement", "noOccupancy"]);
        const fromVisit = chance(0.5) && visits.length ? pick(visits).id : undefined;
        const its = source.items.map((it) => ({ ...it, id: it.id + "-" + s, srcItemId: it.id, done: maybe(0.3, true), doneOn: maybe(0.3, pick(days)) }));
        const special =
          type === "noOccupancy"
            ? chance(0.4) && docs.some((d) => d.type === "noOccupancy")
              ? { mode: "release", releases: pick(docs.filter((d) => d.type === "noOccupancy")).id, scope: "building" }
              : { mode: "restrict", scope: pick(["building", "unit"]), unit: maybe(0.5, "2"), effective: pick(days), posting: maybe(0.8, "Front door"), releaseConditions: maybe(0.8, "Repair heat") }
            : type === "vacancyExtension"
              ? { reviewDate: maybe(0.8, pick(days)), expiryMode: pick(["fixed", "open"]), expiryDate: maybe(0.7, pick(days)), affected: maybe(0.8, ["1", "2"]) }
              : type === "summaryAbatement"
                ? { findings: "Synthetic" }
                : undefined;
        const d = snapshot(type, type + n + "-" + s, type === "noOccupancy" || type === "summaryAbatement" ? [] : its, { special, fromReinspId: fromVisit });
        if (type === "citation") cite(d);
        docs.push(d);
        add(type + ".issued", { docId: d.id, snapshot: d });
      } else if (action < 0.62) {
        const d = snapshot(source.type, source.id + "-c" + s, source.items.map((it) => ({ ...it, title: chance(0.3) ? it.title + " corrected" : it.title })), {
          revision: chance(0.8) ? { actionDate: maybe(0.6, pick(days)), originalIssued: maybe(0.6, pick(days)) } : undefined,
          special: source.special,
        });
        if (source.type === "citation") cite(d);
        const visit = chance(0.3) && visits.length ? pick(visits) : null;
        docs.push(d);
        add("correction.issued", {
          docId: d.id,
          replaces: source.id,
          reason: maybe(0.9, "Synthetic correction"),
          changes: maybe(0.7, [{ field: "title" }]),
          caseChanges: maybe(0.3, { owner: "SYNTHETIC" }),
          snapshot: d,
          visitCorrection: visit ? { id: visit.id, date: pick(days), time: "09:00", results: {} } : undefined,
        });
      } else {
        const kind = pick(["document.voided", "document.served", "document.annotated", "document.reconciled", "document.recorded", "document.filed", "case.noted"]);
        add(kind, {
          docId: source.id,
          reason: maybe(0.7, "Synthetic"),
          replacedBy: maybe(0.2, "other"),
          method: "mail",
          text: "Synthetic note",
          reference: maybe(0.7, "REF-" + n),
          sha256: maybe(0.5, "a".repeat(64)),
          filename: maybe(0.5, "Synthetic.pdf"),
        });
      }
    }
    if (chance(0.15)) events.reverse(); // files need not be in time order
    const file = JSON.parse(JSON.stringify({ format: "madison-case-file", schema: maybe(0.9, 5), case: k, inspectors, events }));
    let summary = null,
      error = null;
    try {
      summary = JSON.parse(JSON.stringify(summarize(file)));
    } catch (e) {
      error = String((e && e.message) || e);
    }
    entries_out.push({ file, summary, error });
  }
  require("fs").writeFileSync(
    __CORPUS.output,
    JSON.stringify({
      tables: { STATUS_OF, DOC_TYPES: DOC_TYPES.map((t) => ({ id: t.id, label: t.label })), NEW_TYPES: NEW_TYPES.map((t) => ({ id: t.id, effect: t.effect })), SCHEMA, SNOW_TYPE },
      cases: entries_out,
    }),
  );
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
`;
var entries_out = [];
eval(src + "\n;;\n" + T);
