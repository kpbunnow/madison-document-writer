/* Accela report reading against the retained module: constants, type/status rules, value readers, report-table
   parsing and workbook (zip and XML) reading, compared over seeded inputs including damaged and oversized files. */
const { retainedAccelaImport } = require("../fixtures/retained_accela_import.cjs");
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  zlib = require("node:zlib"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom");

global.DOMParser = new JSDOM("").window.DOMParser;

async function compile(contents) {
  const build = await esbuild.build({
    stdin: {
      contents: contents + '\nexport {WriterState} from "./state.js"; export {INSPECTORS} from "./data/inspectors.js";',
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

let seed = 20261105;
const random = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor((seed / 4294967296) * n);
  },
  pick = (values) => values[random(values.length)],
  chance = (n) => random(n) === 0;

const crc = (b) => {
  let c,
    cr = 0xffffffff;
  for (let i = 0; i < b.length; i++) {
    c = (cr ^ b[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    cr = (cr >>> 8) ^ c;
  }
  return (cr ^ 0xffffffff) >>> 0;
};

function zip(files, stored) {
  const locals = [],
    cds = [];
  let off = 0;
  for (const name of Object.keys(files)) {
    const data = Buffer.from(files[name], "utf8"),
      st = stored.includes(name),
      body = st ? data : zlib.deflateRawSync(data),
      nm = Buffer.from(name, "utf8");
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(st ? 0 : 8, 8);
    lh.writeUInt32LE(crc(data), 14);
    lh.writeUInt32LE(body.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nm.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(st ? 0 : 8, 10);
    ch.writeUInt32LE(crc(data), 16);
    ch.writeUInt32LE(body.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nm.length, 28);
    ch.writeUInt32LE(off, 42);
    locals.push(lh, nm, body);
    cds.push(ch, nm);
    off += 30 + nm.length + body.length;
  }
  const cd = Buffer.concat(cds),
    e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0);
  e.writeUInt16LE(Object.keys(files).length, 8);
  e.writeUInt16LE(Object.keys(files).length, 10);
  e.writeUInt32LE(cd.length, 12);
  e.writeUInt32LE(off, 16);
  return Buffer.concat(locals.concat([cd, e]));
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const colName = (i) => {
  let s = "";
  i++;
  while (i > 0) {
    const m = (i - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
};

function workbook(grid) {
  const shared = chance(2),
    sst = [],
    si = (s) => (sst.includes(s) ? sst.indexOf(s) : sst.push(s) - 1);
  const cell = (ref, v) => {
    if (v === undefined || v === null) return "";
    if (typeof v === "number") return `<c r="${ref}"><v>${v}</v></c>`;
    if (typeof v === "boolean") return `<c r="${ref}" t="b"><v>${v ? 1 : 0}</v></c>`;
    if (shared) return `<c r="${ref}" t="s"><v>${si(v)}</v></c>`;
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  };
  const rows = grid.map((r, n) => (!r ? "" : `<row r="${n + 1}">${r.map((v, i) => cell(colName(i) + (n + 1), v)).join("")}</row>`));
  const files = {
    "xl/workbook.xml": `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${chance(8) ? '<workbookPr date1904="1"/>' : ""}${chance(12) ? "<sheets></sheets>" : '<sheets><sheet name="S" sheetId="1" r:id="rId9"/></sheets>'}</workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="${chance(6) ? "rId1" : "rId9"}" Type="x" Target="worksheets/data.xml"/></Relationships>`,
    "xl/worksheets/data.xml": `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.join("")}</sheetData></worksheet>`,
  };
  if (chance(10)) delete files["xl/_rels/workbook.xml.rels"];
  if (chance(25)) files["xl/worksheets/data.xml"] = pick(["<worksheet><broken", "", '<worksheet xmlns="x"><sheetData></sheetData></worksheet>']);
  if (chance(25)) delete files["xl/workbook.xml"];
  if (shared)
    files["xl/sharedStrings.xml"] =
      '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      sst
        .map((s) =>
          s.length > 3 && chance(3)
            ? `<si><r><t>${esc(s.slice(0, 3))}</t></r><r><t>${esc(s.slice(3))}</t></r><rPh><t>X</t></rPh></si>`
            : `<si><t>${esc(s)}</t></si>`,
        )
        .join("") +
      "</sst>";
  let bytes = zip(files, chance(3) ? ["xl/worksheets/data.xml"] : []);
  if (chance(10)) bytes = bytes.subarray(0, random(bytes.length));
  if (chance(10)) {
    bytes = Buffer.from(bytes);
    bytes[random(bytes.length)] ^= 0xff;
  }
  if (chance(8)) {
    // Forge the first central-directory entry to sit exactly on a size boundary.
    bytes = Buffer.from(bytes);
    const cd = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    const first = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    if (first >= 0 && cd >= 0 && first + 46 <= bytes.length) {
      if (chance(2)) bytes.writeUInt32LE(32 * 1024 * 1024, first + 24);
      else {
        const start = bytes.readUInt32LE(first + 42) + 30 + bytes.readUInt16LE(first + 28);
        bytes.writeUInt32LE(bytes.length - start, first + 20);
      }
    }
  }
  if (chance(40)) bytes = Buffer.from("not a workbook at all");
  return bytes;
}

const TYPES = [
  "Initial Inspection",
  "Reinspection",
  "CA Reinspection",
  "CA Re-inspection",
  "Re-inspection",
  "Assist",
  "Other",
  "",
  " reinspection ",
  "INITIAL  INSPECTION",
];
const STATUSES = [
  "Official Notice",
  "Citation",
  "No Occupancy",
  "Abatement Summary",
  "Abatement Non-Summary",
  "Abatement non summary",
  "CA Referral",
  "City Attorney Referral",
  "Compliance",
  "Extension Processing",
  "No Fee Extension Processing",
  "No Fee No Occupancy",
  "Non Compliance",
  "Non-Compliance",
  "Scheduled",
  "Pending",
  "Completed",
  "Inspection",
  "No Violation",
  "Reinspection",
  "No Fee Reinspection",
  "No Entry",
  "constructor",
  "__proto__",
  "toString",
  "",
  "Citation–x",
  "non – compliance",
];
const NAMES = ["Robert Ales", "robert  ales", "Nobody Here", "", "constructor"];
const stat = () => pick([...STATUSES, ...STATUSES.map((s) => " " + s.toUpperCase() + " ")]);

function cellValue() {
  return pick([
    undefined,
    null,
    "",
    "  x  ",
    "a\r\nb",
    0,
    0.5,
    0.999999,
    46203.4513888889,
    46203,
    -1,
    NaN,
    Infinity,
    "2026-09-10",
    "2026-09-10T10:50",
    "9/10/2026",
    "bad",
    "10:50AM",
    "8:05 AM",
    "13:45",
    true,
    "081034111097",
    "0810-341-1109-7",
    "12345",
    { toString: () => "obj" },
  ]);
}

function grid() {
  const keys = [
    "Case Number",
    "Inspector Name",
    "Site Address",
    "Zoning District",
    "Historic District",
    "Landmark",
    "Parcel Number",
    "Case Description",
    "Detailed Description",
    "Owner Name",
    "Owner Address",
    "Inspection Type",
    "Inspection Date",
    "Inspection Status",
    "Inspection Time",
    "Case Type",
    "Record Category",
  ];
  let head = keys.filter(() => !chance(14));
  if (chance(4)) head = ["x", "y"];
  if (chance(4)) head = head.filter((h) => h !== pick(keys));
  head = head.map((h) => (chance(6) ? " " + h.toUpperCase() + " " : h));
  if (chance(8)) head.push("Surprise Column");
  if (chance(5)) head.splice(random(head.length), 0, pick(["Case Type Name", "CaseType", "casetypename"]));
  head.sort(() => (chance(4) ? 1 : -1) * (random(3) - 1));
  const index = (name) => head.findIndex((h) => String(h).trim().toLowerCase() === name.toLowerCase());
  const rows = Array.from({ length: random(8) }, () => {
    const row = head.map(() => cellValue());
    const set = (name, v) => {
      const i = index(name);
      if (i >= 0) row[i] = v;
    };
    set("Case Number", pick(["CB2026-1", "CB2026-1", "CB2026-2", "constructor", "", undefined]));
    set("Inspector Name", pick(NAMES));
    set("Inspection Type", pick(TYPES));
    set("Inspection Status", stat());
    set("Inspection Date", pick([46203.45, 46210.5, 46210.99999, 46225, "2026-09-10", "", undefined, "bad"]));
    set("Inspection Time", pick(["10:50AM", 0.4, "", undefined, "25:99", 0.999999]));
    set("Owner Name", pick(["Carr", "Carr", "Other"]));
    set("Site Address", pick(["1 Main", "1 Main", "2 Main"]));
    return row;
  });
  const lead = Array.from({ length: random(3) }, () => [cellValue()]);
  const all = [...lead, head, ...rows];
  if (chance(10)) all.splice(random(all.length + 1), 0, pick([null, undefined]));
  return all;
}

const show = (value) =>
  JSON.stringify(value, (_, v) => (v === undefined ? "<undefined>" : typeof v === "number" && !Number.isFinite(v) ? "<" + v + ">" : v));

async function attempt(fn) {
  try {
    return { value: await fn() };
  } catch (e) {
    return { error: [e.name, e.message] };
  }
}

async function battery(api) {
  const out = [];
  const owner = api.createAccelaImport(new Proxy({}, { get: (_, k) => assert.fail("pure surface used a peer: " + String(k)) }));
  out.push(Object.keys(owner));
  for (const key of ["ACC_MAX", "ACC_EXPANDED_MAX", "ACC_COLS", "ACC_REQUIRED", "ACC_CASEFIELDS", "SQL_COLUMNS"]) out.push(owner[key]);
  out.push(Object.keys(owner.ACC_COLS).map(owner.ACC_LABEL));
  seed = 7777;
  for (let n = 0; n < 4000; n++) {
    const type = pick(TYPES),
      status = stat();
    out.push([
      owner.inspectionKind(type),
      owner.statusRule(type, status),
      owner.hiddenImportRow(type, status),
      owner.accStatusEligible(status, type),
    ]);
  }
  for (let n = 0; n < 3000; n++) {
    const v = cellValue(),
      w = cellValue();
    out.push([
      owner.accStr(v),
      owner.accNorm(v),
      owner.accTime(v),
      owner.accSerial(v),
      owner.accWhen(v, w),
      owner.accParcel(v),
      owner.accColIx(pick(["A", "AB", "ab1", "", "7", undefined])),
      owner.accHM(pick([0, 59, 60, 725, 1439])),
      owner.accInspector(pick(NAMES)),
    ]);
  }
  const sqlRow = (number) => ({
    CaseNumber: pick([number, number, number.toLowerCase(), "CB2026-9", undefined]),
    InspectionType: pick(["Initial Inspection", "Reinspection", ...TYPES]),
    InspectionStatus: pick(["Official Notice", "Citation", "Compliance", stat()]),
    InspectionDate: pick(["2026-09-10T00:00:00", "2026-09-10T10:00:00", "2026-09-11", "", undefined]),
    InspectionTime: pick(["10:50AM", "", undefined]),
    InspectorName: pick(NAMES),
    SiteAddress: "1 Main",
    OwnerName: "Carr",
    OwnerAddress: "1 Main",
    Landmark: pick(["", "Name"]),
    IndividualLandmark: pick(["Yes", "No", ""]),
    HistoricDistrict: pick(["Yes", "No", ""]),
    HistoricDistrictName: pick(["", "District"]),
  });
  for (let n = 0; n < 1500; n++) {
    const number = pick(["CB2026-1", "CB2026-2"]);
    const good = {
      rows: Array.from({ length: 1 + random(3) }, () => ({
        ...sqlRow(number),
        ...(chance(4) ? {} : { IndividualLandmark: "No", HistoricDistrict: "No", CaseNumber: number }),
      })),
      caseNumber: number,
      source: { kind: "sql", at: "t" },
    };
    const result = chance(3) ? pick([null, {}, { rows: [] }, { ...good, caseNumber: "x" }, { ...good, source: { kind: "file" } }]) : good;
    out.push(await attempt(() => owner.sqlReport(result, number)));
  }
  for (let n = 0; n < 1500; n++) {
    const rule = pick([{ doc: "notice" }, { doc: "citation", cite: true }, { choose: ["extension"], label: "x" }, { doc: "referral" }]);
    const target = pick([
      {},
      { results: {} },
      { results: {}, type: "notice" },
      { initialAction: true, type: "citation" },
      { initialAction: false },
      { selectionCache: { citation: { a: 1 } } },
      { items: [{ cite: true }], cits: { x: 1 } },
    ]);
    const copy = structuredClone(target);
    const result = await attempt(() => owner.applyImportRule(copy, rule));
    out.push([result, copy]);
  }
  for (let n = 0; n < 200; n++) {
    Object.assign(api.WriterState, {
      LOOKUP_BUSY: chance(2),
      LOOKUP_ERROR: pick(["", "bad <b>", undefined]),
      LOOKUP_SERIAL: random(5),
      LOOKUP_CONTROLLER: chance(2) ? { abort: () => out.push("aborted") } : null,
      WORK: { entry: pick([{}, { "lookup-number": 'CB<"1' }]) },
      state: { acc: pick([null, {}]) },
    });
    out.push(owner.lookupCard());
    owner.cancelCaseLookup();
    out.push([api.WriterState.LOOKUP_BUSY, api.WriterState.LOOKUP_SERIAL, api.WriterState.LOOKUP_CONTROLLER]);
  }
  for (let n = 0; n < 2500; n++) out.push(owner.accelaTable(grid()));
  for (let n = 0; n < 500; n++) {
    const g = grid(),
      bytes = workbook(g);
    out.push(await attempt(() => owner.readXlsx(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length))));
  }
  for (let n = 0; n < 60; n++) {
    const raw = zlib.deflateRawSync(Buffer.from("x".repeat(random(5000))));
    out.push(await attempt(async () => Buffer.from(await owner.accInflate(new Uint8Array(raw), pick([10, 100, 1000, 100000]))).toString().length));
    out.push(await attempt(async () => Buffer.from(await owner.accInflate(new Uint8Array(raw.subarray(0, random(raw.length + 1)))), "utf8").length));
  }
  return out.map(show);
}

(async () => {
  const [current, legacy] = await Promise.all([compile('export {createAccelaImport} from "./accela_import.js";'), compile(retainedAccelaImport())]);
  const [before, after] = [await battery(legacy), await battery(current)];
  assert.equal(after.length, before.length);
  for (let n = 0; n < before.length; n++) assert.equal(after[n], before[n], `report reading result ${n} differs from the retained module`);
  // The generator must keep reaching every outcome family, or the comparison would silently weaken.
  const text = before.join("\n");
  for (const fragment of [
    "No Accela report table was found",
    "is missing the column",
    "is not part of the Accela report",
    "has no document rule",
    "Scheduled rows",
    "Assist rows",
    "rows without an inspection date",
    "it is not an Excel .xlsx file",
    "the file is incomplete or damaged",
    "1904 date system",
    "the workbook has no sheets",
    "The expanded workbook is too large",
    '"conflicts":[{',
    "not 12 digits",
    "Unexpected case response",
    "Several completed inspections",
    "Find Case Inspections",
    "aborted",
  ])
    assert.ok(text.includes(fragment), "scenarios reach: " + fragment);
  const parsed = before.filter((r) => r.startsWith('{"value":[['));
  assert.ok(parsed.length > 100, "workbooks that read cleanly: " + parsed.length);
  console.log("PASS report reading matches the retained module over " + before.length + " comparisons (" + parsed.length + " clean workbooks)");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
