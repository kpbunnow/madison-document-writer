import { inspAt, sameInspection, inspectionIdentity, inspectionUsed } from "./inspection_facts.js";
import { draftDocFor, draftReinspFor, originalNotice, isReferredCase, insp, docsFor, doc, kase, reinspFor, eventsFor } from "./writer_queries.js";
import { clone, stableJSON, caseDetails } from "./record_values.js";
import { summaryName } from "./case_file_rules.js";
import { REFERRED_ONLY } from "./document_types.js";
import { clearProhibitedCitations } from "./document_rules.js";
import { parseTime, parseDate, validISO, nowISO, iso } from "./calendar.js";
import { esc } from "./presentation_format.js";
import { WriterState } from "./state.js";
import { authFetch } from "./helper_transport.js";
import { INSPECTORS } from "./data/inspectors.js";
import { recordDay, validCaseNumber } from "../assets/shared.js";

/* Lazy dependencies preserve the complete import workflow without starting Writer. */
export function createAccelaImport(services) {
  /* Accela inspection import: report columns, type/status rules, XLSX reading, report parsing, import candidates,
   the review plan and panel, the direct database lookup and acceptance. */

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

  const ACC_MAX = 5 * 1024 * 1024;

  const ACC_EXPANDED_MAX = 32 * 1024 * 1024;

  const ACC_COLS = {
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

  const ACC_REQUIRED = ["number", "inspector", "address", "owner", "ownerAddr", "type", "date", "status"];

  const ACC_LABEL = (k) => ACC_COLS[k].replace(/\b\w/g, (m) => m.toUpperCase());

  /* R53: the imported inspection's type and status decide the document (division rules and decisions, 10/19/2026).
   Snow cases follow the same table: Initial Inspection/Citation starts the season case and Reinspection/Citation
   records each later snow event. "Completed" has no rule and is not importable. */
  const inspectionKind = (type) => {
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
    },
    caReinspection: {
      compliance: { ...RULE.compliance, needsReferral: true },
      "non compliance": RULE.referralUpdate,
      "non-compliance": RULE.referralUpdate,
    },
  };

  function statusRule(type, status) {
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
  const HIDDEN_STATUSES = new Set(["scheduled", "pending", "completed", "inspection", "no violation", "reinspection", "no fee reinspection"]);

  function hiddenImportRow(type, status) {
    if (/^assist$/.test(accNorm(type))) return "assist";
    const key = statusKey(status);
    if (HIDDEN_STATUSES.has(key)) return key === "scheduled" ? "scheduled" : "notDone";
    if (inspectionKind(type) === "initial" && key === "no entry") return "noEntry";
    return "";
  }

  const accStatusEligible = (status, type) => !statusRule(type, status).error;

  const ACC_CASEFIELDS = ["caseType", "address", "historic", "landmark", "parcel", "description", "owner", "ownerAddr"];

  const accXml = (t) => {
    const x = new DOMParser().parseFromString(t, "application/xml");
    if (x.getElementsByTagName("parsererror").length) throw new Error("the workbook is damaged");
    return x;
  };

  const accAll = (n, tag) => Array.prototype.slice.call(n.getElementsByTagNameNS("*", tag));

  const accKids = (n, tag) => Array.prototype.filter.call(n.childNodes, (c) => c.localName === tag);

  /* text of a string item: every run's <t>, not the phonetic guide */
  const accText = (n) =>
    accAll(n, "t")
      .filter((t) => !(t.parentNode && t.parentNode.localName === "rPh"))
      .map((t) => t.textContent)
      .join("");

  const accColIx = (ref) => {
    const m = /^([A-Z]+)/i.exec(ref || "");
    if (!m) return -1;
    let n = 0;
    for (const ch of m[1].toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  };

  const accStr = (v) => (v === undefined || v === null ? "" : String(v).replace(/\r\n?/g, "\n").trim());

  const accNorm = (v) => accStr(v).replace(/\s+/g, " ").toLowerCase();

  const accHM = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");

  const accTime = (v) => {
    if (typeof v === "number" && v >= 0 && v < 1) return accHM(Math.round(v * 1440) % 1440);
    return parseTime(accStr(v));
  };

  const accInspector = (name) => {
    const n = accNorm(name).toUpperCase();
    return n ? INSPECTORS.find((i) => accNorm(i.name).toUpperCase() === n) || null : null;
  };

  const LOOKUP_READY = new WeakSet();

  const SQL_COLUMNS = {
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

  async function accInflate(bytes, limit = ACC_EXPANDED_MAX) {
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

  async function accUnzip(buf, want) {
    const u8 = new Uint8Array(buf),
      dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const fail = (m) => {
      throw new Error(m);
    };
    if (u8.length < 22 || dv.getUint32(0, true) !== 0x04034b50) fail("it is not an Excel .xlsx file");
    let e = -1;
    for (let p = u8.length - 22; p >= Math.max(0, u8.length - 65557); p--)
      if (dv.getUint32(p, true) === 0x06054b50) {
        e = p;
        break;
      }
    if (e < 0) fail("the file is incomplete or damaged");
    const count = dv.getUint16(e + 10, true),
      cdOff = dv.getUint32(e + 16, true);
    if (cdOff === 0xffffffff || cdOff >= u8.length) fail("the file is incomplete or damaged");
    const dec = new TextDecoder("utf-8"),
      out = {};
    let p = cdOff,
      total = 0;
    for (let n = 0; n < count; n++) {
      if (p + 46 > u8.length || dv.getUint32(p, true) !== 0x02014b50) fail("the file is incomplete or damaged");
      const method = dv.getUint16(p + 10, true),
        csize = dv.getUint32(p + 20, true),
        usize = dv.getUint32(p + 24, true);
      const nlen = dv.getUint16(p + 28, true),
        xlen = dv.getUint16(p + 30, true),
        clen = dv.getUint16(p + 32, true);
      const lho = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + xlen + clen;
      if (!want(name)) continue;
      if (usize > ACC_EXPANDED_MAX - total) fail("The expanded workbook is too large. Export a report for one case.");
      if (lho + 30 > u8.length || dv.getUint32(lho, true) !== 0x04034b50) fail("the file is incomplete or damaged");
      const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
      if (start + csize > u8.length) fail("the file is incomplete or damaged");
      const raw = u8.subarray(start, start + csize);
      let bytes;
      if (method === 0) bytes = raw;
      else if (method === 8) {
        try {
          bytes = await accInflate(raw, ACC_EXPANDED_MAX - total);
        } catch (err) {
          fail(/expanded workbook/.test(err.message) ? err.message : "the file is incomplete or damaged");
        }
      } else fail("the file uses a compression this program cannot read");
      total += bytes.length;
      if (total > ACC_EXPANDED_MAX) fail("The expanded workbook is too large. Export a report for one case.");
      out[name] = dec.decode(bytes);
    }
    return out;
  }

  async function readXlsx(buf) {
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

  function accSerial(v) {
    if (typeof v !== "number" || !isFinite(v) || v <= 0) return null;
    let days = Math.floor(v),
      mins = Math.round((v - days) * 1440);
    if (mins >= 1440) {
      days++;
      mins -= 1440;
    }
    return { date: iso(new Date(Date.UTC(1899, 11, 30 + days, 12))), mins: mins };
  }

  function accWhen(dv, tv) {
    let date = null;
    // R36: the Inspection Time column is authoritative. Any time carried in the date column is ignored, with no comparison warning.
    const s = accSerial(dv);
    if (s) date = s.date;
    else if (accStr(dv)) date = parseDate(accStr(dv).split(/[\sT]+/)[0]);
    const textTime = accStr(tv) || typeof tv === "number" ? accTime(tv) : null;
    return { date: date, time: textTime || "", warn: "" };
  }

  function accParcel(v) {
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

  function hiddenRowsMessage(excluded, used = 0) {
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

  function accelaTable(grid) {
    const res = { cases: [], errors: [], notes: [], excluded: { scheduled: 0, assist: 0, notDone: 0, noEntry: 0, noDate: 0 } };
    const known = Object.keys(ACC_COLS).map((k) => ACC_COLS[k]);
    const hr = grid.findIndex((r) => r && r.some((v) => accNorm(v) === "case number") && r.filter((v) => known.indexOf(accNorm(v)) >= 0).length >= 4);
    if (hr < 0) {
      res.errors.push("No Accela report table was found — the file has no Case Number header row");
      return res;
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
      return res;
    }
    Object.keys(ACC_COLS)
      .filter(
        (k) => ACC_REQUIRED.indexOf(k) < 0 && k !== "detail" && k !== "zoning" && k !== "caseType" && k !== "recordCategory" && col[k] === undefined,
      )
      .forEach((k) => res.notes.push("The report has no " + ACC_LABEL(k) + " column"));
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
    });
    if (!res.cases.length) res.errors.push(hiddenRowsMessage(res.excluded) || "The report has a header row but no case rows");
    res.cases.forEach((c) => {
      c.rows.sort((a, b) => !a.date - !b.date || (a.date + a.time < b.date + b.time ? -1 : a.date + a.time > b.date + b.time ? 1 : 0));
      const done = c.rows.filter((r) => r.selectable && accStatusEligible(r.status, r.type));
      c.sel = done.length === 1 ? done[0].i : null;
    });
    return res;
  }

  /* R62: the rows offered for import. A row already used on the case is hidden, except the R53 refresh of an
   unissued draft or worksheet's own inspection, which updates that work instead of creating new work. */
  function refreshImportPending(k, row) {
    const pending = k && row ? (row.typeKey === "initial" ? draftDocFor(k.id) : draftReinspFor(k.id)) : null;
    return pending?.draft &&
      !pending.correction &&
      !pending.pendingAmendment &&
      pending.importInspection &&
      sameInspection(pending.importInspection, inspectionIdentity(row))
      ? pending
      : null;
  }

  function importCandidates(c, k) {
    if (!k) return c.rows;
    return c.rows.filter((row) => {
      if (refreshImportPending(k, row)) return true;
      return !inspectionUsed(k, row);
    });
  }

  const INITIAL_EXISTS = "An Initial Inspection result can only start a new case, and this case already exists.";

  const NO_CASE = "No case exists for this inspection. Import its Initial Inspection first.";

  function baseLookupPlan(acc) {
    const p = { blockers: [], warnings: [], diff: [], notes: (acc && acc.notes) || [] };
    if (!acc) {
      p.blockers.push("No report loaded");
      return p;
    }
    if (acc.errors && acc.errors.length) {
      p.blockers = acc.errors.slice();
      return p;
    }
    const c = acc.cases[acc.caseIx || 0];
    if (!c) {
      p.blockers.push("Choose a case");
      return p;
    }
    p.c = c;
    const r = c.raw,
      par = accParcel(r.parcel),
      cut = r.address.indexOf(",");
    const hist = r.historic && !/^no$/i.test(r.historic),
      lm = r.landmark && !/^no$/i.test(r.landmark) ? r.landmark : "";
    p.f = {
      address: (cut < 0 ? r.address : r.address.slice(0, cut)).trim().toUpperCase(),
      siteCity:
        cut < 0
          ? ""
          : r.address
              .slice(cut + 1)
              .trim()
              .toUpperCase(),
      parcel: par.v,
      historic: !!hist,
      historicDistrict: hist ? r.historic : "",
      landmark: lm,
      description: r.description,
      owner: r.owner,
      ownerAddr: r.ownerAddr
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean),
    };
    c.conflicts.forEach((x) =>
      p.blockers.push("The report gives two different values for " + ACC_LABEL(x.f) + ' on this case: "' + x.a + '" and "' + x.b + '"'),
    );
    if (!p.f.address) p.blockers.push("The report has no site address for this case");
    if (!/^CB\d{4}-\d{3}-\d{5}$/.test(c.number)) p.warnings.push("Case number " + c.number + " does not follow the usual CB2026-000-00000 pattern");
    if (par.warn) p.warnings.push(par.warn);
    const inits = c.rows.filter((x) => x.typeKey === "initial" && x.date);
    p.initial = inits[0] || null;
    if (inits.length > 1)
      p.warnings.push("The report lists " + inits.length + " initial inspections — the earliest, " + services.fmtDate(inits[0].date) + ", is used");
    const k = WriterState.CASES.find((x) => accStr(x.number).toUpperCase() === accStr(c.number).toUpperCase()) || null;
    p.existing = k;
    // R62: an inspection already used on this case is hidden. The shared record can arrive after selection,
    // so a selection that became hidden is cleared; when exactly one eligible result remains it is the selection,
    // as when the report lists only one (it is shown as the selected result, with nothing to choose).
    const visible = importCandidates(c, k),
      eligible = visible.filter((x) => x.selectable && accStatusEligible(x.status, x.type));
    p.candidates = visible;
    p.usedHidden = c.rows.length - visible.length;
    const current = eligible.some((x) => x.i === acc.sel) ? acc.sel : eligible.length === 1 ? eligible[0].i : null;
    if (current !== (acc.sel ?? null)) {
      acc.sel = current;
      WriterState.ACC_SELECTION_SERIAL++;
    }
    const row = eligible.find((x) => x.i === acc.sel) || null;
    p.row = row;
    const snowCase = services.snow.isCase(k) || services.snow.matchesImport(row);
    if (!row)
      p.blockers.push(
        eligible.length
          ? "Choose the inspection result you are documenting."
          : !visible.length
            ? hiddenRowsMessage(null, p.usedHidden)
            : "No eligible inspection result is available: " +
              [
                ...new Set(
                  visible.map(
                    (x) =>
                      x.why ||
                      (accStatusEligible(x.status, x.type) ? "Missing required inspection fields" : "status " + (x.status || "not supplied")),
                  ),
                ),
              ].join("; ") +
              ". Correct the source in Accela and retrieve it again.",
      );
    else {
      if (!row.selectable) p.blockers.push("That inspection cannot be written from — " + row.why);
      else if (row.rule?.error) p.blockers.push(row.rule.error + ". Set the specific result in Accela and retrieve it again.");
      if (row.date && row.date > recordDay(today)) p.blockers.push("The selected inspection date is in the future.");
      if (!row.inspectorId)
        p.blockers.push(
          row.inspectorName
            ? 'Inspector "' + row.inspectorName + '" is not on the roster — nothing can be signed in that name'
            : "The report names no inspector for that inspection",
        );
      row.warn.forEach((w) => p.warnings.push(w));
    }
    // the case keeps the initial inspection; a follow-up carries its own
    if (snowCase && row) {
      p.date = k?.date || row.date;
      p.time = k?.time || row.time;
    } else if (k && originalNotice(k.id)) {
      p.date = k.date;
      p.time = k.time || "";
      if (p.initial && (p.initial.date !== k.date || p.initial.time !== (k.time || "")))
        p.warnings.push(
          "The issued case keeps its initial inspection date/time. Correct a record" +
            "ing error through document correction so reporting retains its audit tra" +
            "il.",
        );
    } else if (p.initial) {
      p.date = p.initial.date;
      p.time = p.initial.time;
    } else if (k && validISO(k.date)) {
      p.date = k.date;
      p.time = k.time || "";
      p.warnings.push("The report has no Initial Inspection row — the case keeps its initial inspection of " + services.fmtDate(k.date));
    } else {
      p.needDate = true;
      p.date = validISO(acc.manualDate) ? acc.manualDate : "";
      p.time = parseTime(acc.manualTime || "") || "";
      if (!p.date) p.blockers.push("The report has no Initial Inspection row — enter the initial inspection date below");
    }
    const src = k ? services.sourceDocFor(k.id) : null;
    p.next = k && src ? "reinspect" : "notice";
    // R53 Refresh from Accela: importing the same inspection again while its draft or worksheet is unissued
    // updates the stored Accela status instead of being refused as already used.
    p.refresh = refreshImportPending(k, row);
    if (k && !p.refresh) {
      // A used inspection is never a candidate (importCandidates), so it cannot be the selected row here.
      const unfinished = draftDocFor(k.id) || draftReinspFor(k.id) || services.unissuedVisitFor(k.id);
      if (unfinished) p.blockers.push("This case has unfinished work. Choose Continue existing case before importing another inspection.");
      else if (!src) p.blockers.push("This case already exists. Choose Continue existing case to finish and issue its Official Notice first.");
      else if (services.caseState(k).closed)
        p.blockers.push("This case is completed. Choose Continue existing case; new observations require a new case.");
      else if (row) {
        if (row.typeKey === "initial") p.blockers.push(INITIAL_EXISTS);
        const at = inspAt(src);
        if (row.date < at.date || (row.date === at.date && row.time && at.time && row.time < at.time))
          p.blockers.push("Select a reinspection on or after the latest issued document’s inspection.");
      }
    } else if (row && row.typeKey !== "initial") p.blockers.push(NO_CASE);
    // R53 referral rules: Reinspection/CA Referral is the case's first referral; CA Reinspection requires one.
    if (k && !p.refresh && row?.rule && !row.rule.error) {
      const referred = isReferredCase(k.id);
      if (row.rule.firstReferral && referred) p.blockers.push("This case is already with the City Attorney. Use a CA Reinspection.");
      // R62: a referred case allows only an Update for Case Referral or a Compliance Letter.
      else if (referred && !(row.rule.choose || [row.rule.doc]).some((t) => REFERRED_ONLY.includes(t)))
        p.blockers.push(
          "This case is with the City Attorney. Only an Update for Case Referral or a Compliance Letter can be written; the Accela status " +
            row.rule.status +
            " calls for " +
            row.rule.label +
            ".",
        );
      if (row.rule.needsReferral && !referred)
        p.blockers.push("This case has not been referred to the City Attorney. Use a Reinspection with status CA Referral for the first referral.");
    }
    if (k && !p.refresh && row?.typeKey === "initial" && !p.blockers.includes(INITIAL_EXISTS)) p.blockers.push(INITIAL_EXISTS);
    p.rule = row?.rule || null;
    if (snowCase) {
      p.next = "snow";
      if (k && src && !services.snow.is(src)) p.blockers.push("Snow removal cases cite only MGO 10.28. Create a separate case for other violations.");
      else
        p.blockers = p.blockers.filter(
          (t) =>
            !t.startsWith("This case is completed.") &&
            !t.startsWith("This case already exists.") &&
            !t.startsWith("The initial inspection belongs") &&
            !t.startsWith("No existing case was found."),
        );
      if (row?.rule && !row.rule.error && !row.rule.cite)
        p.blockers.push("Snow removal inspections are imported with status Citation (" + row.type + " status " + row.status + " has no snow rule).");
      if (row) {
        p.date = k?.date || row.date;
        p.time = k?.time || row.time;
      }
    }
    if (k) {
      if (k.address !== p.f.address)
        p.warnings.push(
          "The case is on file as " +
            k.address +
            "; the report reads " +
            p.f.address +
            ". The address on file is kept so the case keeps writing to its own case file.",
        );
      const show = (v) => (Array.isArray(v) ? v.join(" / ") : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v || ""));
      const cmp = [
        ["siteCity", "City, state, ZIP"],
        ["parcel", "Parcel"],
        ["description", "Case description"],
        ["owner", "Owner"],
        ["ownerAddr", "Owner mailing address"],
        ["historic", "Historic district"],
        ["historicDistrict", "District name"],
        ["landmark", "Landmark"],
      ];
      cmp.forEach(([f, l]) => {
        if (show(k[f]) !== show(p.f[f])) p.diff.push({ l: l, was: show(k[f]), now: show(p.f[f]) });
      });
      if (p.date && (k.date !== p.date || (k.time || "") !== p.time))
        p.diff.push({
          l: "Initial inspection",
          was: services.fmtDate(k.date) + " " + services.fmtTime(k.time || ""),
          now: services.fmtDate(p.date) + " " + services.fmtTime(p.time),
        });
      if (row && row.inspectorId && row.inspectorId !== k.inspectorId)
        p.diff.push({ l: "Case inspector", was: insp(k.inspectorId).name || "", now: insp(row.inspectorId).name || "" });
      // where Accela and the record disagree
      const live = docsFor(k.id).filter((d) => !d.draft && !d.void && !d.superseded);
      [
        ["citation", "Citation", "citation"],
        ["official notice", "Official Notice", "notice"],
      ].forEach(([s, label, ty]) => {
        const a = c.rows.filter((x) => accNorm(x.status) === s).length,
          m = live.filter((d) => d.type === ty).length;
        if (a > m) p.warnings.push("Accela shows " + a + " " + label + (a === 1 ? "" : "s") + " on this case; the case file has " + m);
      });
    }
    return p;
  }

  async function readAccelaFile(file) {
    if (!file || WriterState.state.screen !== "import") return;
    cancelCaseLookup();
    const serial = WriterState.LOOKUP_SERIAL;
    const active = () => serial === WriterState.LOOKUP_SERIAL && WriterState.state.screen === "import";
    WriterState.LOOKUP_ERROR = "";
    WriterState.LOOKUP_BUSY = true;
    services.render();
    try {
      if (file.size > ACC_MAX) throw new Error("That file is " + Math.round(file.size / 1048576) + " MB — an Accela report is a few KB.");
      const grid = await readXlsx(await file.arrayBuffer());
      if (!active()) return;
      const t = accelaTable(grid);
      const acc = {
        fileName: file.name,
        errors: t.errors,
        notes: t.notes,
        cases: t.cases,
        caseIx: 0,
        sel: t.cases.length ? t.cases[0].sel : null,
        manualDate: "",
        manualTime: "",
      };
      WriterState.state.acc = acc;
      await accelaFromShare(active);
      if (!active()) return;
      services.scheduleDraftSave();
      services.toast(t.errors.length ? "The report could not be imported" : "Report read — review the inspection");
    } catch (err) {
      if (active()) {
        WriterState.state.acc = {
          fileName: file.name,
          errors: ["That file could not be read — " + (err.message || "it is not an Excel .xlsx file") + ". Nothing was imported."],
          cases: [],
        };
        services.scheduleDraftSave();
      }
    } finally {
      if (serial === WriterState.LOOKUP_SERIAL) {
        WriterState.LOOKUP_BUSY = false;
        if (WriterState.state.screen === "import") services.render();
      }
    }
  }

  async function accelaFromShare(isCurrent = () => true) {
    const acc = WriterState.state.acc;
    if (!acc || !acc.cases || !acc.cases.length) return;
    const caseIx = acc.caseIx || 0,
      serial = WriterState.LOOKUP_SERIAL;
    const active = () =>
      isCurrent() &&
      serial === WriterState.LOOKUP_SERIAL &&
      WriterState.state.screen === "import" &&
      WriterState.state.acc === acc &&
      (acc.caseIx || 0) === caseIx;
    if (WriterState.CASEDIR?.helper) {
      try {
        await checkLookupShared(acc, active);
      } catch (e) {
        if (active()) acc.shareError = e.message;
      }
      return;
    }
    if (!WriterState.CASEDIR) return;
    if (WriterState.NEEDGRANT) {
      acc.shareError = "Reconnect the shared case folder before importing.";
      return;
    }
    acc.shareError = "";
    const c = acc.cases[caseIx],
      tail = (" - " + c.number + ".json").toLowerCase();
    const hits = (await services.listCaseFolder()).filter((f) => f.name.toLowerCase().endsWith(tail));
    if (!active()) return;
    if (hits.length > 1) {
      acc.shareError = "More than one shared file has this case number. Resolve the duplicate records before importing.";
      return;
    }
    const hit = hits[0];
    if (!hit) return;
    try {
      const f = await (await WriterState.CASEDIR.getFileHandle(hit.name)).getFile();
      const text = await f.text();
      if (!active()) return;
      const keep = { screen: WriterState.state.screen, dirty: WriterState.DIRTY, docId: WriterState.state.docId };
      try {
        if (!services.loadCaseFile(text))
          acc.shareError = "The existing case could not be merged. Open the existing record and resolve the conflict.";
      } finally {
        WriterState.state.screen = keep.screen;
        WriterState.DIRTY = keep.dirty;
        WriterState.state.docId = keep.docId;
      }
    } catch (err) {
      if (active()) {
        acc.shareError = "The existing case file could not be read. Reconnect the share and retry.";
        services.toast(acc.shareError);
      }
    }
  }

  /* R53: record the Accela status rule on a draft or worksheet. Initial No Occupancy and Abatement statuses use the
   established initial-action document; reinspection worksheets show the status card instead of Choose next action. */
  function applyImportRule(target, rule) {
    target.importRule = rule;
    clearProhibitedCitations(target);
    if (target.results) {
      target.followupIntent = rule.choose ? "" : rule.doc;
      return;
    }
    if (rule.doc !== "notice") {
      target.selectionCache = target.selectionCache || {};
      target.special = clone(target.selectionCache[rule.doc] || {});
      target.type = rule.doc;
      target.initialAction = true;
    } else if (target.initialAction) {
      target.type = "notice";
      target.initialAction = false;
    }
  }

  function baseLookupAccept() {
    const acc = WriterState.state.acc,
      p = accelaPlan(acc);
    // the guard is here, not only on the button
    if (p.blockers.length) {
      services.toast(p.blockers[0]);
      services.render();
      return null;
    }
    const c = p.c,
      row = p.row,
      f = p.f;
    let k = p.existing;
    const fields = {
      siteCity: f.siteCity,
      parcel: f.parcel,
      description: f.description,
      owner: f.owner,
      ownerAddr: f.ownerAddr.slice(),
      historic: f.historic,
      historicDistrict: f.historicDistrict,
      landmark: f.landmark,
      date: p.date,
      time: p.time,
      inspectorId: row.inspectorId,
      accela: {
        pulled: nowISO(),
        file: acc.fileName || "",
        ...(acc.source ? { source: clone(acc.source) } : {}),
        inspections: c.rows.map((x) => ({ type: x.type, date: x.date, time: x.time, status: x.status, inspector: x.inspectorName })),
      },
    };
    // the address on file is kept: the case-file name is built from it
    if (k) Object.assign(k, fields);
    else {
      k = { id: services.uid("k"), number: c.number, address: f.address, ...fields };
      WriterState.CASES.push(k);
    }
    services.snow.imported(k, row);
    const importRule = row.rule && !row.rule.error ? clone(row.rule) : null;
    if (p.refresh && importRule) {
      WriterState.state.acc = null;
      WriterState.WORK.acc = null;
      applyImportRule(p.refresh, importRule);
      WriterState.DIRTY = true;
      services.saveDrafts();
      services.render();
      services.toast("Accela status refreshed: " + importRule.status + " \u2192 " + importRule.label);
      return k;
    }
    WriterState.state.acc = null;
    WriterState.WORK.acc = null;
    WriterState.DIRTY = true;
    if (p.next === "snow") {
      k.caseType = "snow-10.28";
      services.newDoc(k.id, "citation");
      const d = doc(WriterState.state.docId);
      d.inspDate = row.date;
      d.inspTime = row.time;
      d.importInspection = inspectionIdentity(row);
      services.snow.prepare(d);
      services.citationPricing.refresh(d);
      services.saveDrafts();
      services.render();
      return k;
    }
    if (p.next === "reinspect") {
      const open = draftReinspFor(k.id);
      if (open) {
        services.startReinspection(k.id, row);
        services.saveDrafts();
        services.render();
        services.toast("Case updated — the open worksheet of " + services.fmtDate(row.date) + " is on screen");
        return k;
      }
      services.startReinspection(k.id, row);
      const worksheet = draftReinspFor(k.id);
      if (worksheet && importRule) applyImportRule(worksheet, importRule);
      services.saveDrafts();
      services.render();
      services.toast("Reinspection of " + services.fmtDate(row.date) + " opened from the Accela report");
      return k;
    }
    if (p.next === "notice") {
      const dd = draftDocFor(k.id);
      if (dd) {
        WriterState.state.docId = dd.id;
        WriterState.state.screen = "write";
        services.saveDrafts();
        services.render();
        services.toast("Case updated — its draft is on screen");
        return k;
      }
      services.newDoc(k.id, "notice");
      const created = doc(WriterState.state.docId);
      if (created) {
        created.importInspection = inspectionIdentity(row);
        if (importRule) applyImportRule(created, importRule);
        services.saveDrafts();
      }
      return k;
    }
    WriterState.state.screen = "cases";
    services.saveDrafts();
    services.render();
    services.toast("Case " + k.number + " updated from the Accela report");
    return k;
  }

  function accelaPanel() {
    const acc = WriterState.state.acc,
      p = accelaPlan(acc);
    const cancel = '<button class="btn" id="acc-cancel">Clear import</button>';
    if (acc.errors?.length)
      return (
        '<section class="card acc"><div class="card-h"><h2>Import review</h2></di' +
        'v><div class="card-b">' +
        `${acc.errors.map((e) => `<p class="banner alert">${esc(e)}</p>`).join("")}` +
        "" +
        `${cancel}` +
        "</div></section>"
      );
    const c = p.c,
      k = p.existing;
    if (!c) return "";
    const choices = p.candidates.filter((x) => x.selectable && accStatusEligible(x.status, x.type)),
      unavailable = p.candidates.filter((x) => !(x.selectable && accStatusEligible(x.status, x.type)));
    const pick =
      acc.cases.length > 1
        ? '<div class="f"><span>Choose a case from this report</span><div class="ch' +
          'ipbar">' +
          "".concat(
            acc.cases
              .map(
                (x, ix) =>
                  '<button class="cchip" data-acccase="' +
                  `${ix}` +
                  '" aria-pressed="' +
                  `${ix === (acc.caseIx || 0)}` +
                  '" ' +
                  `${WriterState.LOOKUP_BUSY ? "disabled" : ""}` +
                  ">" +
                  `${esc(x.number)}` +
                  "</button>",
              )
              .join(""),
          ) +
          "</div></div>"
        : "";
    // R59: four labelled facts per candidate; selection is shown by the highlighted, pressed state only.
    const when = (x) => (x.date ? services.fmtDate(x.date) + (x.time ? " at " + services.fmtTime(x.time) : " · time not supplied") : "not supplied");
    const summary = (x) =>
      [
        ["Inspection type", x.type],
        ["Date", when(x)],
        ["Inspector", x.inspectorName],
        ["Status", x.status],
      ]
        .map(
          ([label, value]) => '<span data-import-field="' + label + '">' + label + ": <strong>" + esc(value || "not supplied") + "</strong></span>",
        )
        .join("");
    const blockerId = "acc-blockers";
    const visibleBlockers = p.blockers.filter((b) => !(choices.length > 1 && b === "Choose the inspection result you are documenting."));
    const inspections =
      choices.length > 1
        ? '<fieldset class="import-choices"><legend>Choose the inspection result yo' +
          'u are documenting</legend><p class="hint">Several eligible inspection re' +
          "sults are available; choose one to continue.</p>" +
          "".concat(
            choices
              .map(
                (x) =>
                  '<button type="button" class="import-inspection ' +
                  `${x.i === acc.sel ? "is-selected" : ""}` +
                  '" data-accsel="' +
                  `${x.i}` +
                  '" aria-pressed="' +
                  `${x.i === acc.sel}` +
                  '" ' +
                  `${x.i === acc.sel && visibleBlockers.length ? 'aria-describedby="' + blockerId + '"' : ""}` +
                  " " +
                  `${WriterState.LOOKUP_BUSY ? "disabled" : ""}` +
                  ">" +
                  `${summary(x)}` +
                  "</button>",
              )
              .join(""),
          ) +
          "</fieldset>"
        : choices.length === 1
          ? `<div class="import-selected">${summary(choices[0])}</div>`
          : "";
    // R62: results that cannot be used are listed, greyed and not selectable, each with its reason.
    const notAvailable = unavailable.length
      ? '<div class="import-unavailable-list"><h3>Not available for import</h3>' +
        unavailable
          .map(
            (x) =>
              '<div class="import-selected import-unavailable" aria-disabled="true">' +
              summary(x) +
              '<span class="import-why">Not available: ' +
              esc(x.why || "status " + (x.status || "not supplied") + " has no document rule") +
              "</span></div>",
          )
          .join("") +
        "</div>"
      : "";
    const unfinished = k && (draftDocFor(k.id) || draftReinspFor(k.id) || services.unissuedVisitFor(k.id));
    const label = k ? "Import inspection" : p.next === "snow" ? "Start snow citation" : "Start Official Notice";
    return (
      '<section class="card acc import-review"><div class="card-h"><div><h2>' +
      `${esc(c.number)}` +
      "</h2><p>" +
      `${esc(k?.address || p.f.address)}` +
      '</p></div><span class="pill">' +
      `${k ? "Existing case" : "New case"}` +
      '</span></div><div class="card-b">\n    ' +
      `${pick}` +
      "\n    " +
      "".concat(
        k
          ? '<div class="import-continuity"><h3>Continue existing case</h3><p>' +
              "".concat(unfinished ? "Keep working on the saved draft or worksheet." : "Open the current case and its document history.") +
              ' This does not import these inspection details.</p><button class="btn ' +
              `${unfinished ? "btn-primary" : ""}` +
              '" data-import-workspace="' +
              `${esc(k.id)}` +
              '">Continue existing case</button></div><h3>Inspection to import</h3><' +
              'p class="hint">Use an unused completed inspection to start ' +
              `${p.next === "snow" ? "a snow citation" : "a reinspection worksheet"}` +
              ". Existing issued documents stay unchanged.</p>"
          : "",
      ) +
      "\n    " +
      `${inspections}` +
      `${notAvailable}` +
      "\n    " +
      "".concat(
        p.needDate
          ? '<div class="grid g2"><label class="f"><span>Initial inspection date</spa' +
              'n><input type="date" id="acc-date" value="' +
              `${esc(acc.manualDate || "")}` +
              '"></label><label class="f"><span>Initial inspection time</span><input ty' +
              'pe="time" id="acc-time" value="' +
              `${esc(acc.manualTime || "")}` +
              '"></label></div>'
          : "",
      ) +
      "\n    " +
      `${p.warnings.map((w) => `<p class="banner warn">${esc(w)}</p>`).join("")}` +
      "\n    " +
      "".concat(
        visibleBlockers.length
          ? '<div class="banner alert" id="' +
              blockerId +
              '"><div><strong>' +
              `${esc(visibleBlockers[0])}` +
              "</strong>" +
              "".concat(
                visibleBlockers.length > 1
                  ? `<ul>${visibleBlockers
                      .slice(1)
                      .map((b) => `<li>${esc(b)}</li>`)
                      .join("")}</ul>`
                  : "",
              ) +
              "</div></div>"
          : "",
      ) +
      "\n    " +
      "".concat(acc.shareError ? '<button class="btn" id="lookup-recheck">Check shared record and retry</button>' : "") +
      "\n    " +
      "".concat(
        k && p.diff.length
          ? '<details class="import-changes"><summary>Case detail changes (' +
              `${p.diff.length}` +
              ")</summary><dl>" +
              "".concat(
                p.diff
                  .map(
                    (x) =>
                      "<dt>" +
                      `${esc(x.l)}` +
                      "</dt><dd><span>On file: " +
                      `${esc(x.was || "Not supplied")}` +
                      "</span><strong>After import: " +
                      `${esc(x.now || "Not supplied")}` +
                      "</strong></dd>",
                  )
                  .join(""),
              ) +
              "</dl></details>"
          : "",
      ) +
      '\n    <details class="import-source"><summary>Source and import details</' +
      "summary><p>" +
      `${esc(acc.fileName || "SSRS Excel report")}` +
      "</p>" +
      "".concat(
        acc.source?.kind === "sql"
          ? "<p>Retrieved " +
              `${esc(new Date(acc.source.retrievedAt).toLocaleString())}` +
              ". This is a saved snapshot; use Find Accela inspection again to refresh it.</p>"
          : "",
      ) +
      "" +
      `${(p.notes || []).map((n) => `<p>${esc(n)}</p>`).join("")}` +
      "<p>The inspection type and its result status decide the document: an In" +
      "itial Inspection with Official Notice, Citation, No Occupancy or an Abat" +
      "ement result; a Reinspection with CA Referral (City Attorney Referral), " +
      "Compliance, Citation, Extension Processing, No Fee Extension Processing, " +
      "No Occupancy or No Fee No Occupancy; a CA Reinspection with Compliance or " +
      "Non Compliance. Results that are not inspection outcomes (Scheduled, Pending, " +
      "Completed, Inspection, No Violation, Reinspection, No Fee Reinspection, an " +
      "Initial Inspection with No Entry), Assist inspections, undated rows and " +
      "inspections already used on the case are not listed; other combinations are " +
      "listed as not available. Blank inspection times stay blank until explicitly" +
      " corrected.</p></det" +
      'ails>\n    <p class="hint">Case details change only when you confirm. Sav' +
      "e draft &amp; return to Workspace keeps this review on this device when saving succee" +
      'ds.</p>\n    <div class="acc-go"><button class="btn ' +
      `${unfinished ? "" : "btn-primary"}` +
      '" id="acc-go" ' +
      `${p.blockers.length || WriterState.LOOKUP_BUSY ? "disabled" : ""}` +
      ">" +
      `${label}` +
      "</button>" +
      `${cancel}` +
      "</div>\n  </div></section>"
    );
  }

  function pickAccelaFile() {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    inp.onchange = () => {
      const file = inp.files && inp.files[0];
      if (file) readAccelaFile(file);
    };
    inp.click();
  }

  function screenImport() {
    const caseTypeChoice =
      '<label class="f no-print"><span>Case workflow for a new case</span><sele' +
      'ct id="new-case-type"><option value="">Standard code violation</option><' +
      'option value="snow-10.28" ' +
      (WriterState.WORK.entry?.["new-case-type"] === "snow-10.28" ? "selected" : "") +
      ">Snow removal (MGO 10.28)</option></select></label>";
    return services.shell(
      "Import inspection",
      "Bring in case details",
      '<button class="btn" id="btn-savework">Save draft &amp; return to Workspace</button>',
      '<div style="max-width:980px">\n      ' +
        `${lookupCard()}` +
        "\n      " +
        `${WriterState.state.acc ? accelaPanel() : ""}` +
        '\n      <details class="card import-alternative"><summary>Import an SSRS ' +
        'Excel report instead</summary><div class="card-b"><div class="acc-drop" ' +
        'id="acc-drop"><p>Load or drop the Accela case report exported as .xlsx.<' +
        '/p><button class="btn" id="acc-pick" ' +
        `${WriterState.LOOKUP_BUSY ? "disabled" : ""}` +
        ">Load Accela report</button></div></div></details>\n      <details class=" +
        '"import-workflow"><summary>New-case workflow</summary>' +
        `${caseTypeChoice}` +
        '<p class="hint">Snow Removal records select the snow workflow automatica' +
        "lly. Use this setting only when the source does not identify the workflo" +
        "w.</p></details>\n      </div>",
    );
  }

  function openImportWorkspace(cid) {
    const k = kase(cid);
    if (!k) return;
    cancelCaseLookup();
    services.captureWork();
    services.preflightCase(cid, "continue existing case", () => {
      const draft = draftDocFor(cid),
        visit = draftReinspFor(cid) || services.unissuedVisitFor(cid),
        current = services.sourceDocFor(cid);
      WriterState.state.modal = null;
      WriterState.state.picker = false;
      if (draft) {
        WriterState.state.docId = draft.id;
        WriterState.state.screen = "write";
      } else if (visit) {
        WriterState.state.reinspId = visit.id;
        WriterState.state.screen = "reinspect";
      } else if (current) {
        WriterState.state.docId = current.id;
        WriterState.state.screen = "write";
      } else {
        WriterState.state.screen = "cases";
        WriterState.state.caseQ = k.number;
        WriterState.state.caseFilter = "all";
        WriterState.state.caseInspector = "";
      }
      services.saveDrafts();
      services.render();
    });
  }

  function lookupCard() {
    return (
      '<div class="card lookup-card"><div class="card-h"><h2>Find Accela inspection</h2><s' +
      'pan class="pill">City database</span></div><div class="card-b">\n  <p>Ent' +
      "er the case number to retrieve its property, owner and inspection detail" +
      's.</p>\n  <form id="lookup-form" class="lookup-row" aria-busy="' +
      `${WriterState.LOOKUP_BUSY}` +
      '">\n    <label class="f"><span>Case number</span><input type="text" id="l' +
      'ookup-number" maxlength="80" autocomplete="off" spellcheck="false" place' +
      'holder="CB2026-000-00000" value="' +
      `${esc(WriterState.WORK.entry["lookup-number"] || "")}` +
      '" ' +
      `${WriterState.LOOKUP_BUSY ? "readonly" : ""}` +
      '></label>\n    <button class="btn btn-primary" type="submit" ' +
      `${WriterState.LOOKUP_BUSY ? "disabled" : ""}` +
      ">" +
      `${WriterState.LOOKUP_BUSY ? "Finding inspection…" : "Find Accela inspection"}` +
      "</button>\n    " +
      "".concat(
        WriterState.LOOKUP_BUSY
          ? '<button class="btn" type="button" id="lookup-cancel">Cancel lookup</button>'
          : !WriterState.state.acc
            ? '<button class="btn" type="button" id="acc-cancel">Clear search</button>'
            : "",
      ) +
      '\n  </form>\n  <p class="hint">Uses your Windows account. A single eligibl' +
      "e initial inspection opens a draft notice when all checks pass. Multiple" +
      " or later results open for review. Your search and review can be saved f" +
      'or later.</p>\n  <div role="status" aria-live="polite">' +
      "".concat(WriterState.LOOKUP_ERROR ? `<div class="banner alert"><div>${esc(WriterState.LOOKUP_ERROR)}</div></div>` : "") +
      "</div>\n  </div></div>"
    );
  }

  function cancelCaseLookup() {
    ++WriterState.LOOKUP_SERIAL;
    if (WriterState.LOOKUP_CONTROLLER) WriterState.LOOKUP_CONTROLLER.abort();
    WriterState.LOOKUP_CONTROLLER = null;
    WriterState.LOOKUP_BUSY = false;
  }

  function sqlReport(result, number) {
    if (!result || !Array.isArray(result.rows) || result.rows.length > 1000 || result.caseNumber !== number || result.source?.kind !== "sql")
      throw new Error("Unexpected case response. Nothing was imported.");
    if (!result.rows.length) throw new Error("No case was found for " + number + ". Check the complete case number and try again.");
    const keys = Object.keys(ACC_COLS);
    const grid = [keys.map((k) => ACC_LABEL(k))];
    const warnings = [];
    result.rows.forEach((row) => {
      if (!row || accStr(row.CaseNumber).toUpperCase() !== number) throw new Error("The database returned a different case. Nothing was imported.");
      if (/^yes$/i.test(accStr(row.IndividualLandmark)) && !accStr(row.Landmark))
        throw new Error(
          "The database marks this property as an individual landmark but supplies " +
            "no landmark name. Correct the source record before importing.",
        );
      if (/^yes$/i.test(accStr(row.HistoricDistrict)) && !accStr(row.HistoricDistrictName))
        throw new Error(
          "The database marks this property as historic but supplies no district na" + "me. Correct the source record before importing.",
        );
      grid.push(
        keys.map((k) =>
          k === "number"
            ? number
            : k === "detail" || k === "zoning"
              ? ""
              : k === "date" && /T00:00:00$/.test(row.InspectionDate || "")
                ? row.InspectionDate.slice(0, 10)
                : (row[SQL_COLUMNS[k]] ?? ""),
        ),
      );
    });
    const table = accelaTable(grid);
    if (table.errors.length) throw new Error(table.errors.join(" "));
    if (table.cases.length !== 1) throw new Error("More than one case was returned. Nothing was imported.");
    const c = table.cases[0],
      eligible = c.rows.filter((r) => r.selectable && accStatusEligible(r.status, r.type));
    // No arbitrary choice when several completed inspections are available.
    const sel = eligible.length === 1 ? eligible[0].i : null;
    if (eligible.length > 1) warnings.push("Several completed inspections are available. Select the inspection you are documenting.");
    return {
      fileName: "Case lookup · " + number,
      source: clone(result.source),
      errors: [],
      notes: table.notes.concat(warnings),
      cases: table.cases,
      caseIx: 0,
      sel,
      manualDate: "",
      manualTime: "",
    };
  }

  async function checkLookupShared(acc, isCurrent = () => true) {
    const number = accStr(acc.cases[acc.caseIx || 0].number).toUpperCase();
    const listing = await services.helperJSON("/cases/list");
    if (!isCurrent()) return false;
    if (!Array.isArray(listing.files)) throw new Error("The shared case list could not be checked. Retry when the shared folder is available.");
    const tail = (" - " + number + ".json").toLowerCase();
    const hits = listing.files.filter((f) => typeof f.name === "string" && f.name.toLowerCase().endsWith(tail));
    if (hits.length > 1)
      throw new Error("More than one shared file has this case number. Ask the record administrator to resolve the duplicate files.");
    const locals = WriterState.CASES.filter((k) => accStr(k.number).toUpperCase() === number);
    if (locals.length > 1 || locals.some((k) => k.number !== number))
      throw new Error(
        "The local workspace has duplicate or differently capitalized case number" + "s. Resolve the existing record before importing.",
      );
    if (hits.length) {
      const result = await services.helperJSON("/cases/open?name=" + encodeURIComponent(hits[0].name));
      if (!isCurrent()) return false;
      if (accStr(result.file?.case?.number).toUpperCase() !== number)
        throw new Error("The shared filename and case number disagree. The existing record has been kept.");
      const keep = { screen: WriterState.state.screen, docId: WriterState.state.docId, dirty: WriterState.DIRTY };
      let loaded;
      try {
        loaded = services.loadCaseFile(JSON.stringify(result.file));
      } finally {
        WriterState.state.screen = keep.screen;
        WriterState.state.docId = keep.docId;
        WriterState.DIRTY = keep.dirty;
      }
      if (!loaded) throw new Error("The existing shared case could not be merged. Resolve the case-file or local-edit conflict before importing.");
      services.COMMITTED.set(summaryName(result.file.case), result);
    }
    acc.shareError = "";
    return true;
  }

  function lookupPlanSignature(acc) {
    const p = accelaPlan(acc);
    return stableJSON({
      caseNumber: p.c?.number,
      documents: p.existing ? docsFor(p.existing.id) : [],
      visits: p.existing ? reinspFor(p.existing.id) : [],
      sel: acc.sel,
      date: p.date,
      time: p.time,
      next: p.next,
      existing: p.existing ? caseDetails(p.existing) : null,
      diff: p.diff,
      blockers: p.blockers,
      warnings: p.warnings,
      head: p.existing ? eventsFor(p.existing.id) : [],
    });
  }

  function lookupCanOpen(acc) {
    const p = accelaPlan(acc),
      c = acc.cases[0];
    // R37: a Record Category of "Snow Removal" advances a new case directly to the 10.28 snow citation draft.
    return (
      !p.existing &&
      (p.next === "notice" || (p.next === "snow" && services.snow.matchesImport(p.row))) &&
      !p.blockers.length &&
      !p.warnings.length &&
      c.rows.filter((r) => r.selectable && accStatusEligible(r.status, r.type)).length === 1 &&
      p.row?.typeKey === "initial" &&
      accStatusEligible(p.row.status, p.row.type)
    );
  }

  async function findDatabaseCase() {
    if (WriterState.LOOKUP_BUSY) return;
    services.captureWork();
    const number = accStr(WriterState.WORK.entry["lookup-number"]).toUpperCase();
    WriterState.WORK.entry["lookup-number"] = number;
    if (!validCaseNumber(number)) {
      WriterState.LOOKUP_ERROR = "Enter a complete case number using letters, numbers and hyphens.";
      services.render();
      return;
    }
    WriterState.LOOKUP_ERROR = "";
    WriterState.LOOKUP_BUSY = true;
    const serial = ++WriterState.LOOKUP_SERIAL;
    const controller = new AbortController();
    WriterState.LOOKUP_CONTROLLER = controller;
    const active = () => serial === WriterState.LOOKUP_SERIAL && WriterState.state.screen === "import";
    services.render();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      if (!(await services.saveDrafts()))
        throw new Error("Your search could not be saved on this device. Keep this screen open or download a workspace backup.");
      if (!active()) return;
      const response = await authFetch("/case-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseNumber: number }),
        signal: controller.signal,
      });
      const result = await response.json();
      if (!active()) return;
      if (!response.ok || !result.ok) throw new Error(result.error || "The case lookup could not be completed.");
      const acc = sqlReport(result, number);
      try {
        if (!(await checkLookupShared(acc, active))) return;
      } catch (e) {
        acc.shareError = e.message;
      }
      if (!active()) return;
      WriterState.state.acc = acc;
      WriterState.WORK.acc = clone(acc);
      if (!(await services.saveDrafts()))
        throw new Error("Case retrieved, but this device could not save the review. Keep the page open or download a workspace backup.");
      if (active() && !acc.shareError && lookupCanOpen(acc)) {
        LOOKUP_READY.add(acc);
        try {
          acceptAccela();
        } finally {
          LOOKUP_READY.delete(acc);
        }
      } else if (active()) services.toast("Case retrieved — review the inspection and details");
    } catch (error) {
      if (active())
        WriterState.LOOKUP_ERROR =
          error.name === "AbortError"
            ? "The lookup timed out. Your work is kept; retry when the network is available."
            : error.message || "The lookup failed. Your work is kept.";
    } finally {
      clearTimeout(timer);
      if (serial === WriterState.LOOKUP_SERIAL) {
        WriterState.LOOKUP_BUSY = false;
        WriterState.LOOKUP_CONTROLLER = null;
        await services.saveDrafts();
        services.render();
      }
    }
  }

  /* R59: any eligible listed candidate of the current case can be chosen. R62: an inspection already used on the
   case is not listed, so it cannot be chosen. Each change bumps the selection token. */
  function selectImportInspection(index) {
    const acc = WriterState.state.acc,
      c = acc?.cases?.[acc.caseIx || 0];
    if (!c || !(accelaPlan(acc).candidates || []).some((r) => r.i === index && r.selectable && accStatusEligible(r.status, r.type))) return false;
    acc.sel = index;
    WriterState.ACC_SELECTION_SERIAL++;
    return true;
  }

  async function confirmDatabaseCase() {
    const acc = WriterState.state.acc;
    if (WriterState.LOOKUP_BUSY || !acc) return;
    WriterState.LOOKUP_ERROR = "";
    acc.shareError = "";
    const before = lookupPlanSignature(acc);
    WriterState.LOOKUP_BUSY = true;
    const serial = ++WriterState.LOOKUP_SERIAL,
      selection = WriterState.ACC_SELECTION_SERIAL,
      selected = acc.sel;
    // A shared-record result started for an earlier selection never confirms the current one.
    const sameSelection = () => selection === WriterState.ACC_SELECTION_SERIAL && acc.sel === selected;
    const active = () =>
      serial === WriterState.LOOKUP_SERIAL && WriterState.state.screen === "import" && WriterState.state.acc === acc && sameSelection();
    services.render();
    try {
      if (WriterState.CASEDIR?.helper || acc.source?.kind === "sql") {
        if (!(await checkLookupShared(acc, active)) || !active()) return;
      } else {
        await accelaFromShare(active);
        if (!active()) return;
      }
      if (before !== lookupPlanSignature(acc)) {
        services.toast("The shared record changed. Review the refreshed details and confirm again.");
        return;
      }
      LOOKUP_READY.add(acc);
      try {
        acceptAccela();
      } finally {
        LOOKUP_READY.delete(acc);
      }
    } catch (e) {
      if (active()) acc.shareError = e.message;
    } finally {
      if (serial === WriterState.LOOKUP_SERIAL) {
        WriterState.LOOKUP_BUSY = false;
        if (!sameSelection() && WriterState.state.acc === acc) services.toast("The selected inspection changed. Review it and confirm again.");
        await services.saveDrafts();
        services.render();
      }
    }
  }

  function accelaPlan(acc) {
    const p = baseLookupPlan(acc);
    if (acc) {
      if (acc.shareError) p.blockers.push(acc.shareError);
      if (p.existing && docsFor(p.existing.id).some((d) => d.pendingIssue || d.pendingAmendment))
        p.blockers.push("Confirm the pending document save on this case before importing new details.");
    }
    return p;
  }

  function acceptAccela() {
    if ((WriterState.state.acc?.source?.kind === "sql" || WriterState.CASEDIR?.helper) && !LOOKUP_READY.has(WriterState.state.acc)) {
      services.toast("Check the shared record before confirming this lookup.");
      return null;
    }
    const direct = WriterState.state.acc?.source?.kind === "sql";
    const result = baseLookupAccept();
    if (result && direct) {
      delete WriterState.WORK.entry["lookup-number"];
      services.scheduleDraftSave();
    }
    return result;
  }
  return {
    ACC_MAX,
    ACC_EXPANDED_MAX,
    ACC_COLS,
    ACC_REQUIRED,
    ACC_LABEL,
    inspectionKind,
    statusRule,
    hiddenImportRow,
    accStatusEligible,
    ACC_CASEFIELDS,
    accXml,
    accAll,
    accKids,
    accText,
    accColIx,
    accStr,
    accNorm,
    accTime,
    accInspector,
    LOOKUP_READY,
    SQL_COLUMNS,
    accelaTable,
    baseLookupPlan,
    readAccelaFile,
    accelaFromShare,
    baseLookupAccept,
    pickAccelaFile,
    screenImport,
    openImportWorkspace,
    lookupCard,
    cancelCaseLookup,
    checkLookupShared,
    findDatabaseCase,
    selectImportInspection,
    confirmDatabaseCase,
    accelaPlan,
    acceptAccela,
    accHM,
    accInflate,
    readXlsx,
    accSerial,
    accWhen,
    accParcel,
    applyImportRule,
    accelaPanel,
    sqlReport,
    lookupPlanSignature,
    lookupCanOpen,
  };
}
