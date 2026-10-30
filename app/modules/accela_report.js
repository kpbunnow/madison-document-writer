import { INSPECTORS } from "./data/inspectors.js";
import { parseTime, parseDate, iso } from "./calendar.js";

/* ---------- import ---------- */
/* ---------- Accela report import ----------
 The SSRS report exports one .xlsx per case, one row per inspection, with
 the case columns repeated on every row. It is read here in the browser with
 no library: the ZIP is walked by hand, entries are inflated with the
 browser's own DecompressionStream, and the sheet is parsed with DOMParser.
 The table is found by its header text, never by position — adding the
 Inspector Name column moved every later column. An Excel re-save turns the
 report's inline strings into shared strings and may turn dates into text,
 so both forms read the same. The Detailed Description and Zoning District
 columns are recognised and never read (division, 09/18/2026). */

export const ACC_MAX = 5 * 1024 * 1024;

export const ACC_EXPANDED_MAX = 32 * 1024 * 1024;

export const ACC_COLS = {
  number: "case number",
  inspector: "inspector name",
  address: "site address",
  zoning: "zoning district",
  historic: "historic district",
  landmark: "landmark",
  parcel: "parcel number",
  description: "case description",
  detail: "detailed description",
  owner: "owner name",
  ownerAddr: "owner address",
  type: "inspection type",
  date: "inspection date",
  status: "inspection status",
  time: "inspection time",
  caseType: "case type",
  recordCategory: "record category",
};

export const ACC_REQUIRED = ["number", "inspector", "address", "owner", "ownerAddr", "type", "date", "status"];

export const ACC_LABEL = (k) => ACC_COLS[k].replace(/\b\w/g, (m) => m.toUpperCase());

/* R53: the imported inspection's type and status decide the document (division rules and decisions, 10/19/2026).
 Snow cases follow the same table: Initial Inspection/Citation starts the season case and Reinspection/Citation
 records each later snow event. "Completed" has no rule and is not importable. */
export const inspectionKind = (type) => {
  const t = accNorm(type);
  return /^initial inspection$/.test(t)
    ? "initial"
    : /^re-?inspection$/.test(t)
      ? "reinspection"
      : /^ca re-?inspection$/.test(t)
        ? "caReinspection"
        : null;
};

const statusKey = (s) =>
  accNorm(s)
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s*-\s*/g, "-");

const RULE = {
  notice: { doc: "notice", label: "Official Notice" },
  initialCitation: { doc: "notice", cite: true, label: "Citation" },
  noOccupancy: { doc: "noOccupancy", label: "No Occupancy" },
  summary: { doc: "summaryAbatement", label: "Summary Abatement" },
  nonSummary: { doc: "nonSummaryAbatement", label: "Non-Summary Abatement" },
  referral: { doc: "referral", label: "Referral for Prosecution", firstReferral: true },
  compliance: { doc: "compliance", allCorrected: true, label: "Compliance Letter" },
  citation: { doc: "citation", cite: true, label: "Citation" },
  extension: {
    choose: ["extension", "bestInterestExtension", "vacancyExtension"],
    label: "Extension, Best Interest Extension or Vacancy Extension",
  },
  referralUpdate: { doc: "referralUpdate", label: "Update for Case Referral", needsReferral: true },
  reinspectionNotice: { doc: "reinspectionNotice", label: "Reinspection Notice" },
};

const STATUS_RULES = {
  initial: {
    "official notice": RULE.notice,
    citation: RULE.initialCitation,
    "no occupancy": RULE.noOccupancy,
    "abatement summary": RULE.summary,
    "abatement non-summary": RULE.nonSummary,
    "abatement non summary": RULE.nonSummary,
  },
  reinspection: {
    "ca referral": RULE.referral,
    "city attorney referral": RULE.referral,
    compliance: RULE.compliance,
    citation: RULE.citation,
    "extension processing": RULE.extension,
    "no fee extension processing": RULE.extension,
    "no occupancy": RULE.noOccupancy,
    "no fee no occupancy": RULE.noOccupancy,
    reinspection: RULE.reinspectionNotice,
    "no fee reinspection": RULE.reinspectionNotice,
  },
  caReinspection: {
    compliance: { ...RULE.compliance, needsReferral: true },
    "non compliance": RULE.referralUpdate,
    "non-compliance": RULE.referralUpdate,
  },
};

export function statusRule(type, status) {
  const kind = inspectionKind(type);
  if (!kind) return { kind: null, error: 'Inspection type "' + (accStr(type) || "not supplied") + '" has no document rule' };
  // Own properties only: a status such as "constructor" or "__proto__" must not resolve to an inherited value.
  const rules = STATUS_RULES[kind],
    key = statusKey(status),
    rule = Object.hasOwn(rules, key) ? rules[key] : null;
  if (!rule)
    return {
      kind,
      error: accStr(type) + ' status "' + (accStr(status) || "not supplied") + '" has no document rule',
    };
  return { kind, status: accStr(status), ...rule };
}

/* R62: rows that never appear among import candidates (owner, Development 3). Statuses apply to every inspection
 type; No Entry is hidden only on an Initial Inspection and is otherwise a listed pair without a rule. */
const HIDDEN_STATUSES = new Set(["scheduled", "pending", "completed", "inspection", "no violation"]);
/* A Reinspection or No Fee Reinspection result is a listed outcome of a Reinspection and stays hidden on other types. */
const REINSPECTION_RESULTS = new Set(["reinspection", "no fee reinspection"]);

export function hiddenImportRow(type, status) {
  if (/^assist$/.test(accNorm(type))) return "assist";
  const key = statusKey(status);
  if (HIDDEN_STATUSES.has(key) || (REINSPECTION_RESULTS.has(key) && inspectionKind(type) !== "reinspection"))
    return key === "scheduled" ? "scheduled" : "notDone";
  if (inspectionKind(type) === "initial" && key === "no entry") return "noEntry";
  return "";
}

export const accStatusEligible = (status, type) => !statusRule(type, status).error;

export const ACC_CASEFIELDS = ["caseType", "address", "historic", "landmark", "parcel", "description", "owner", "ownerAddr"];

export const accXml = (t) => {
  const x = new DOMParser().parseFromString(t, "application/xml");
  if (x.getElementsByTagName("parsererror").length) throw new Error("the workbook is damaged");
  return x;
};

export const accAll = (n, tag) => Array.prototype.slice.call(n.getElementsByTagNameNS("*", tag));

export const accKids = (n, tag) => Array.prototype.filter.call(n.childNodes, (c) => c.localName === tag);

/* text of a string item: every run's <t>, not the phonetic guide */
export const accText = (n) =>
  accAll(n, "t")
    .filter((t) => !(t.parentNode && t.parentNode.localName === "rPh"))
    .map((t) => t.textContent)
    .join("");

export const accColIx = (ref) => {
  const m = /^([A-Z]+)/i.exec(ref || "");
  if (!m) return -1;
  let n = 0;
  for (const ch of m[1].toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

export const accStr = (v) => (v === undefined || v === null ? "" : String(v).replace(/\r\n?/g, "\n").trim());

export const accNorm = (v) => accStr(v).replace(/\s+/g, " ").toLowerCase();

export const accHM = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");

export const accTime = (v) => {
  if (typeof v === "number" && v >= 0 && v < 1) return accHM(Math.round(v * 1440) % 1440);
  return parseTime(accStr(v));
};

export const accInspector = (name) => {
  const n = accNorm(name).toUpperCase();
  return n ? INSPECTORS.find((i) => accNorm(i.name).toUpperCase() === n) || null : null;
};

export const SQL_COLUMNS = {
  caseType: "CaseType",
  number: "CaseNumber",
  inspector: "InspectorName",
  address: "SiteAddress",
  zoning: "ZoningDistrict",
  historic: "HistoricDistrictName",
  landmark: "Landmark",
  parcel: "ParcelNumber",
  description: "CaseDescription",
  detail: "DetailedDescription",
  owner: "OwnerName",
  ownerAddr: "OwnerAddress",
  type: "InspectionType",
  date: "InspectionDate",
  status: "InspectionStatus",
  time: "InspectionTime",
  recordCategory: "RecordCategory",
};

export async function accInflate(bytes, limit = ACC_EXPANDED_MAX) {
  const ds = new DecompressionStream("deflate-raw");
  const w = ds.writable.getWriter();
  w.write(bytes).catch(() => {});
  w.close().catch(() => {});
  const rd = ds.readable.getReader(),
    parts = [];
  let n = 0;
  for (;;) {
    const x = await rd.read();
    if (x.done) break;
    n += x.value.length;
    if (n > limit) {
      await rd.cancel();
      throw new Error("The expanded workbook is too large. Export a report for one case.");
    }
    parts.push(x.value);
  }
  const out = new Uint8Array(n);
  let o = 0;
  parts.forEach((p) => {
    out.set(p, o);
    o += p.length;
  });
  return out;
}

const zipFail = (m) => {
  throw new Error(m);
};

function zipDirectory(u8, dv) {
  if (u8.length < 22 || dv.getUint32(0, true) !== 0x04034b50) zipFail("it is not an Excel .xlsx file");
  let e = -1;
  for (let p = u8.length - 22; p >= Math.max(0, u8.length - 65557); p--)
    if (dv.getUint32(p, true) === 0x06054b50) {
      e = p;
      break;
    }
  if (e < 0) zipFail("the file is incomplete or damaged");
  const count = dv.getUint16(e + 10, true),
    cdOff = dv.getUint32(e + 16, true);
  if (cdOff === 0xffffffff || cdOff >= u8.length) zipFail("the file is incomplete or damaged");
  return { count, cdOff };
}

function zipHeader(u8, dv, dec, p) {
  if (p + 46 > u8.length || dv.getUint32(p, true) !== 0x02014b50) zipFail("the file is incomplete or damaged");
  const method = dv.getUint16(p + 10, true),
    csize = dv.getUint32(p + 20, true),
    usize = dv.getUint32(p + 24, true);
  const nlen = dv.getUint16(p + 28, true),
    xlen = dv.getUint16(p + 30, true),
    clen = dv.getUint16(p + 32, true);
  const lho = dv.getUint32(p + 42, true);
  const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
  return { method, csize, usize, lho, name, next: p + 46 + nlen + xlen + clen };
}

async function zipContent(u8, dv, h, total) {
  if (h.usize > ACC_EXPANDED_MAX - total) zipFail("The expanded workbook is too large. Export a report for one case.");
  if (h.lho + 30 > u8.length || dv.getUint32(h.lho, true) !== 0x04034b50) zipFail("the file is incomplete or damaged");
  const start = h.lho + 30 + dv.getUint16(h.lho + 26, true) + dv.getUint16(h.lho + 28, true);
  if (start + h.csize > u8.length) zipFail("the file is incomplete or damaged");
  const raw = u8.subarray(start, start + h.csize);
  if (h.method === 0) return raw;
  if (h.method !== 8) zipFail("the file uses a compression this program cannot read");
  try {
    return await accInflate(raw, ACC_EXPANDED_MAX - total);
  } catch (err) {
    return zipFail(/expanded workbook/.test(err.message) ? err.message : "the file is incomplete or damaged");
  }
}

async function accUnzip(buf, want) {
  const u8 = new Uint8Array(buf),
    dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const { count, cdOff } = zipDirectory(u8, dv);
  const dec = new TextDecoder("utf-8"),
    out = {};
  let p = cdOff,
    total = 0;
  for (let n = 0; n < count; n++) {
    const h = zipHeader(u8, dv, dec, p);
    p = h.next;
    if (!want(h.name)) continue;
    const bytes = await zipContent(u8, dv, h, total);
    total += bytes.length;
    if (total > ACC_EXPANDED_MAX) zipFail("The expanded workbook is too large. Export a report for one case.");
    out[h.name] = dec.decode(bytes);
  }
  return out;
}

export async function readXlsx(buf) {
  const files = await accUnzip(buf, (n) => /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/i.test(n));
  const key = (n) => Object.keys(files).find((k) => k.toLowerCase() === n.toLowerCase());
  if (!key("xl/workbook.xml")) throw new Error("it is not an Excel workbook");
  const wb = accXml(files[key("xl/workbook.xml")]);
  if (accAll(wb, "workbookPr").some((p) => /^(1|true)$/i.test(p.getAttribute("date1904") || "")))
    throw new Error("This workbook uses the 1904 date system. Export the SSRS report again using the standard 1900 date system.");
  const sheet = accAll(wb, "sheet")[0];
  if (!sheet) throw new Error("the workbook has no sheets");
  let rid = "";
  Array.prototype.forEach.call(sheet.attributes, (a) => {
    if (a.localName === "id" && a.name !== "sheetId") rid = a.value;
  });
  let target = "";
  if (key("xl/_rels/workbook.xml.rels")) {
    const rel = accAll(accXml(files[key("xl/_rels/workbook.xml.rels")]), "Relationship").find((r) => r.getAttribute("Id") === rid);
    if (rel) target = rel.getAttribute("Target") || "";
  }
  let path = target.charAt(0) === "/" ? target.slice(1) : "xl/" + target.replace(/^\.\//, "");
  if (!target || !key(path))
    path =
      Object.keys(files)
        .filter((n) => /^xl\/worksheets\//i.test(n))
        .sort()[0] || "";
  if (!path || !key(path)) throw new Error("the workbook has no readable sheet");
  const sst = key("xl/sharedStrings.xml") ? accAll(accXml(files[key("xl/sharedStrings.xml")]), "si").map(accText) : [];
  const ws = accXml(files[key(path)]);
  const rows = [];
  accAll(ws, "row").forEach((rw) => {
    const row = [];
    let next = 0;
    accKids(rw, "c").forEach((c) => {
      const r = c.getAttribute("r"),
        ix = r ? accColIx(r) : next;
      next = ix + 1;
      const t = c.getAttribute("t") || "",
        v = accKids(c, "v")[0],
        vt = v ? v.textContent : "";
      let val;
      if (t === "s") val = sst[+vt] !== undefined ? sst[+vt] : "";
      else if (t === "inlineStr") {
        const is = accKids(c, "is")[0];
        val = is ? accText(is) : "";
      } else if (t === "str" || t === "e") val = vt;
      else if (t === "b") val = vt === "1" ? "TRUE" : "FALSE";
      else val = vt === "" ? "" : Number(vt);
      if (ix >= 0) row[ix] = val;
    });
    rows.push(row);
  });
  return rows;
}

export function accSerial(v) {
  if (typeof v !== "number" || !isFinite(v) || v <= 0) return null;
  let days = Math.floor(v),
    mins = Math.round((v - days) * 1440);
  if (mins >= 1440) {
    days++;
    mins -= 1440;
  }
  return { date: iso(new Date(Date.UTC(1899, 11, 30 + days, 12))), mins: mins };
}

export function accWhen(dv, tv) {
  let date = null;
  // R36: the Inspection Time column is authoritative. Any time carried in the date column is ignored, with no comparison warning.
  const s = accSerial(dv);
  if (s) date = s.date;
  else if (accStr(dv)) date = parseDate(accStr(dv).split(/[\sT]+/)[0]);
  const textTime = accStr(tv) || typeof tv === "number" ? accTime(tv) : null;
  return { date: date, time: textTime || "", warn: "" };
}

export function accParcel(v) {
  const raw = accStr(v);
  if (/^\d{12}$/.test(raw)) return { v: raw.slice(0, 4) + "-" + raw.slice(4, 7) + "-" + raw.slice(7, 11) + "-" + raw.slice(11), warn: "" };
  if (/^\d{4}-\d{3}-\d{4}-\d$/.test(raw)) return { v: raw, warn: "" };
  return { v: raw, warn: raw ? "Parcel number " + raw + " is not 12 digits — imported as delivered" : "" };
}

/* R62: why nothing could be listed, naming each hidden category that occurred. */
const HIDDEN_ROW_TEXT = {
  scheduled: "Scheduled rows (the inspection has not been completed)",
  notDone: "rows whose status is not an inspection result (such as Pending, Completed or No Violation)",
  noEntry: "Initial Inspection rows with status No Entry",
  assist: "Assist rows",
  noDate: "rows without an inspection date",
};

export function hiddenRowsMessage(excluded, used = 0) {
  const parts = Object.keys(HIDDEN_ROW_TEXT)
    .filter((k) => excluded?.[k])
    .map((k) => HIDDEN_ROW_TEXT[k]);
  if (used && !parts.length)
    return "Every inspection returned for this case has already been used to generate a document. Choose Continue existing case to continue or correct that work.";
  if (!parts.length) return "";
  return (
    "No eligible completed inspection: the report returned only " +
    (parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts.at(-1) : parts[0]) +
    ". Choose a completed Initial Inspection or Reinspection."
  );
}

// The header row is found by its text; every recognised column keeps its first position.
function tableColumns(grid, res) {
  const known = Object.keys(ACC_COLS).map((k) => ACC_COLS[k]);
  const hr = grid.findIndex((r) => r && r.some((v) => accNorm(v) === "case number") && r.filter((v) => known.indexOf(accNorm(v)) >= 0).length >= 4);
  if (hr < 0) {
    res.errors.push("No Accela report table was found — the file has no Case Number header row");
    return null;
  }
  const col = {};
  grid[hr].forEach((v, ix) => {
    let h = accNorm(v);
    if (h === "case type name" || h === "casetype" || h === "casetypename") h = "case type";
    if (!h) return;
    const k = Object.keys(ACC_COLS).find((k) => ACC_COLS[k] === h);
    if (k) {
      if (col[k] === undefined) col[k] = ix;
    } else res.notes.push('Column "' + accStr(v) + '" is not part of the Accela report and was ignored');
  });
  const miss = ACC_REQUIRED.filter((k) => col[k] === undefined);
  if (miss.length) {
    res.errors.push(
      "The report is missing the column" + (miss.length === 1 ? "" : "s") + " " + miss.map(ACC_LABEL).join(", ") + " — nothing was imported",
    );
    return null;
  }
  Object.keys(ACC_COLS)
    .filter(
      (k) => ACC_REQUIRED.indexOf(k) < 0 && k !== "detail" && k !== "zoning" && k !== "caseType" && k !== "recordCategory" && col[k] === undefined,
    )
    .forEach((k) => res.notes.push("The report has no " + ACC_LABEL(k) + " column"));
  return { hr, col };
}

function tableCase(by, res, num, get, r) {
  let c = by.get(num);
  if (!c) {
    c = { number: num, raw: {}, conflicts: [], rows: [] };
    by.set(num, c);
    res.cases.push(c);
    ACC_CASEFIELDS.forEach((f) => {
      c.raw[f] = accStr(get(r, f));
    });
  } else
    ACC_CASEFIELDS.forEach((f) => {
      const v = accStr(get(r, f));
      if (v !== c.raw[f] && !c.conflicts.some((x) => x.f === f)) c.conflicts.push({ f: f, a: c.raw[f], b: v });
    });
  return c;
}

function tableRow(c, get, r) {
  const w = accWhen(get(r, "date"), get(r, "time"));
  const type = accStr(get(r, "type")),
    status = accStr(get(r, "status"));
  const kind = inspectionKind(type),
    tk = kind || "other",
    rule = statusRule(type, status);
  const name = accStr(get(r, "inspector")),
    ins = accInspector(name);
  const row = {
    caseType: accStr(get(r, "caseType")),
    recordCategory: accStr(get(r, "recordCategory")),
    i: c.rows.length,
    type: type,
    typeKey: tk,
    date: w.date || "",
    time: w.time,
    status: status,
    rule: rule,
    inspectorName: name,
    inspectorId: ins ? ins.id : "",
    selectable: true,
    why: "",
    warn: [],
  };
  if (w.warn) row.warn.push(w.warn);
  if (rule.error) {
    row.selectable = false;
    row.why = rule.error;
  }
  c.rows.push(row);
}

// Rows run oldest first; a case preselects its only importable inspection.
function orderCases(res) {
  res.cases.forEach((c) => {
    c.rows.sort((a, b) => !a.date - !b.date || (a.date + a.time < b.date + b.time ? -1 : a.date + a.time > b.date + b.time ? 1 : 0));
    const done = c.rows.filter((r) => r.selectable && accStatusEligible(r.status, r.type));
    c.sel = done.length === 1 ? done[0].i : null;
  });
}

export function accelaTable(grid) {
  const res = { cases: [], errors: [], notes: [], excluded: { scheduled: 0, assist: 0, notDone: 0, noEntry: 0, noDate: 0 } };
  const header = tableColumns(grid, res);
  if (!header) return res;
  const { hr, col } = header;
  const get = (r, k) => (col[k] === undefined ? "" : r[col[k]]);
  // Keyed by report text, so a Map: a case number such as "constructor" must not find an inherited value.
  const by = new Map();
  grid.slice(hr + 1).forEach((r) => {
    if (!r) return;
    const num = accStr(get(r, "number"));
    if (!num) return;
    // R62: hidden rows never appear among candidates and are not retained in the import history.
    const hidden = hiddenImportRow(get(r, "type"), get(r, "status")) || (accWhen(get(r, "date"), get(r, "time")).date ? "" : "noDate");
    if (hidden) {
      res.excluded[hidden]++;
      return;
    }
    tableRow(tableCase(by, res, num, get, r), get, r);
  });
  if (!res.cases.length) res.errors.push(hiddenRowsMessage(res.excluded) || "The report has a header row but no case rows");
  orderCases(res);
  return res;
}
