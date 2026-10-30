import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { importsState as imports } from "./imports_state.js";
import { inspAt, sameInspection, inspectionIdentity, inspectionUsed } from "./inspection_facts.js";
import { draftDocFor, draftReinspFor, originalNotice, isReferredCase, insp, docsFor, doc, kase, reinspFor, eventsFor } from "./writer_queries.js";
import { clone, stableJSON, caseDetails } from "./record_values.js";
import { summaryName } from "./case_file_rules.js";
import { REFERRED_ONLY } from "./document_types.js";
import { clearProhibitedCitations } from "./document_rules.js";
import { parseTime, validISO, nowISO } from "./calendar.js";
import { esc } from "./presentation_format.js";
import {
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
  accHM,
  accTime,
  accInspector,
  SQL_COLUMNS,
  accInflate,
  readXlsx,
  accSerial,
  accWhen,
  accParcel,
  hiddenRowsMessage,
  accelaTable,
} from "./accela_report.js";
import { authFetch } from "./helper_transport.js";
import { recordDay, validCaseNumber } from "../assets/shared.js";
import { html, raw } from "./screen_html.js";

/* Lazy dependencies preserve the complete import workflow without starting Writer. */
function importedCaseFields({ c, accParcel, p }) {
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
  return par;
}

function importedSourceWarnings({ c, p, ACC_LABEL, par, services }) {
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
}

function selectImportCandidate({ importCandidates, c, k, accStatusEligible, p, acc }) {
  const visible = importCandidates(c, k),
    eligible = visible.filter((x) => x.selectable && accStatusEligible(x.status, x.type));
  p.candidates = visible;
  p.usedHidden = c.rows.length - visible.length;
  const current = eligible.some((x) => x.i === acc.sel) ? acc.sel : eligible.length === 1 ? eligible[0].i : null;
  if (current !== (acc.sel ?? null)) {
    acc.sel = current;
    imports.ACC_SELECTION_SERIAL++;
  }
  const row = eligible.find((x) => x.i === acc.sel) || null;
  p.row = row;
  return { visible, eligible, row };
}

function missingImportCandidate({ p, eligible, visible, hiddenRowsMessage, accStatusEligible }) {
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
                  x.why || (accStatusEligible(x.status, x.type) ? "Missing required inspection fields" : "status " + (x.status || "not supplied")),
              ),
            ),
          ].join("; ") +
          ". Correct the source in Accela and retrieve it again.",
  );
}

function selectedImportWarnings({ row, p }) {
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

function importCandidateWarnings({ row, p, eligible, visible, hiddenRowsMessage, accStatusEligible }) {
  if (!row) {
    missingImportCandidate({ p, eligible, visible, hiddenRowsMessage, accStatusEligible });
  } else {
    selectedImportWarnings({ row, p });
  }
}

function snowInspectionDate({ p, k, row }) {
  p.date = k?.date || row.date;
  p.time = k?.time || row.time;
}

function issuedInspectionDate({ p, k }) {
  p.date = k.date;
  p.time = k.time || "";
  if (p.initial && (p.initial.date !== k.date || p.initial.time !== (k.time || "")))
    p.warnings.push(
      "The issued case keeps its initial inspection date/time. Correct a recording error through document correction so reporting retains its audit trail.",
    );
}

function initialInspectionDate({ p }) {
  p.date = p.initial.date;
  p.time = p.initial.time;
}

function retainedInspectionDate({ p, k, services }) {
  p.date = k.date;
  p.time = k.time || "";
  p.warnings.push("The report has no Initial Inspection row — the case keeps its initial inspection of " + services.fmtDate(k.date));
}

function manualInspectionDate({ p, acc }) {
  p.needDate = true;
  p.date = validISO(acc.manualDate) ? acc.manualDate : "";
  p.time = parseTime(acc.manualTime || "") || "";
  if (!p.date) p.blockers.push("The report has no Initial Inspection row — enter the initial inspection date below");
}

const importDateRules = [
  { id: "snowInspectionDate", applies: ({ snowCase, row }) => snowCase && row, apply: (context) => snowInspectionDate(context) },
  { id: "issuedInspectionDate", applies: ({ k }) => k && originalNotice(k.id), apply: (context) => issuedInspectionDate(context) },
  { id: "initialInspectionDate", applies: ({ p }) => p.initial, apply: (context) => initialInspectionDate(context) },
  { id: "retainedInspectionDate", applies: ({ k }) => k && validISO(k.date), apply: (context) => retainedInspectionDate(context) },
  { id: "manualInspectionDate", applies: () => true, apply: (context) => manualInspectionDate(context) },
];

function selectImportDate({ p, k, row, snowCase, acc, services }) {
  for (const rule of importDateRules) {
    if (rule.applies({ p, k, row, snowCase, acc, services })) {
      rule.apply({ p, k, row, snowCase, acc, services });
      return;
    }
  }
}

function issuedInspectionChronology({ row, p, INITIAL_EXISTS, src }) {
  if (row.typeKey === "initial") p.blockers.push(INITIAL_EXISTS);
  const at = inspAt(src);
  if (row.date < at.date || (row.date === at.date && row.time && at.time && row.time < at.time))
    p.blockers.push("Select a reinspection on or after the latest issued document’s inspection.");
}

function existingImportWork({ k, services, p, src, row, INITIAL_EXISTS }) {
  // A used inspection is never a candidate (importCandidates), so it cannot be the selected row here.
  const unfinished = draftDocFor(k.id) || draftReinspFor(k.id) || services.unissuedVisitFor(k.id);
  if (unfinished) p.blockers.push("This case has unfinished work. Choose Continue existing case before importing another inspection.");
  else if (!src) p.blockers.push("This case already exists. Choose Continue existing case to finish and issue its Official Notice first.");
  else if (services.caseState(k).closed)
    p.blockers.push("This case is completed. Choose Continue existing case; new observations require a new case.");
  else if (row) {
    issuedInspectionChronology({ row, p, INITIAL_EXISTS, src });
  }
}

function importWorkReadiness({ k, p, services, src, row, INITIAL_EXISTS, NO_CASE }) {
  if (k && !p.refresh) {
    existingImportWork({ k, services, p, src, row, INITIAL_EXISTS });
  } else if (row && row.typeKey !== "initial") p.blockers.push(NO_CASE);
}

function importReferralRules({ k, row, p }) {
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

function importReferralReadiness({ k, p, row }) {
  if (k && !p.refresh && row?.rule && !row.rule.error) {
    importReferralRules({ k, row, p });
  }
}

function importInitialReadiness({ k, p, row, INITIAL_EXISTS }) {
  if (k && !p.refresh && row?.typeKey === "initial" && !p.blockers.includes(INITIAL_EXISTS)) p.blockers.push(INITIAL_EXISTS);
}

function snowImportOrigin({ k, src, services, p }) {
  if (k && src && !services.snow.is(src)) p.blockers.push("Snow removal cases cite only MGO 10.28. Create a separate case for other violations.");
  else
    p.blockers = p.blockers.filter(
      (t) =>
        !t.startsWith("This case is completed.") &&
        !t.startsWith("This case already exists.") &&
        !t.startsWith("The initial inspection belongs") &&
        !t.startsWith("No existing case was found."),
    );
}

function snowImportStatus({ row, p }) {
  if (row?.rule && !row.rule.error && !row.rule.cite)
    p.blockers.push("Snow removal inspections are imported with status Citation (" + row.type + " status " + row.status + " has no snow rule).");
}

function snowImportDate({ row, p, k }) {
  if (row) {
    p.date = k?.date || row.date;
    p.time = k?.time || row.time;
  }
}

function snowImportReadiness({ snowCase, p, k, src, services, row }) {
  if (snowCase) {
    p.next = "snow";
    snowImportOrigin({ k, src, services, p });
    snowImportStatus({ row, p });
    snowImportDate({ row, p, k });
  }
}

function importInspectionDifferences({ p, k, services, row }) {
  if (p.date && (k.date !== p.date || (k.time || "") !== p.time))
    p.diff.push({
      l: "Initial inspection",
      was: services.fmtDate(k.date) + " " + services.fmtTime(k.time || ""),
      now: services.fmtDate(p.date) + " " + services.fmtTime(p.time),
    });
  importInspectorDifference({ row, k, p });
}

function importInspectorDifference({ row, k, p }) {
  if (row && row.inspectorId && row.inspectorId !== k.inspectorId)
    p.diff.push({ l: "Case inspector", was: insp(k.inspectorId).name || "", now: insp(row.inspectorId).name || "" });
}

function existingImportDifferences({ k, p, services, row, c, accNorm }) {
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

  // where Accela and the record disagree
  importInspectionDifferences({ p, k, services, row });
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

function importCaseDifferences({ k, p, services, row, c, accNorm }) {
  if (k) {
    existingImportDifferences({ k, p, services, row, c, accNorm });
  }
}

function newImportPlan(acc) {
  return { blockers: [], warnings: [], diff: [], notes: (acc && acc.notes) || [] };
}
function importPlanCase(acc, p) {
  if (!acc) {
    p.blockers.push("No report loaded");
    return null;
  }
  if (acc.errors && acc.errors.length) {
    p.blockers = acc.errors.slice();
    return null;
  }
  const c = acc.cases[acc.caseIx || 0];
  if (!c) {
    p.blockers.push("Choose a case");
    return null;
  }
  return c;
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

function lookupCard() {
  return html`<div class="card lookup-card"><div class="card-h"><h2>Find Accela inspection</h2><span class="pill">City database</span></div><div class="card-b">\n  <p>Enter the case number to retrieve its property, owner and inspection details.</p>\n  <form id="lookup-form" class="lookup-row" aria-busy="${raw(imports.LOOKUP_BUSY)}">\n    <label class="f"><span>Case number</span><input type="text" id="lookup-number" maxlength="80" autocomplete="off" spellcheck="false" placeholder="CB2026-000-00000" value="${editor.WORK.entry["lookup-number"] || ""}" ${raw(imports.LOOKUP_BUSY ? "readonly" : "")}></label>\n    <button class="btn btn-primary" type="submit" ${raw(imports.LOOKUP_BUSY ? "disabled" : "")}>${raw(imports.LOOKUP_BUSY ? "Finding inspection…" : "Find Accela inspection")}</button>\n    ${raw(
    "".concat(
      imports.LOOKUP_BUSY
        ? '<button class="btn" type="button" id="lookup-cancel">Cancel lookup</button>'
        : !editor.state.acc
          ? '<button class="btn" type="button" id="acc-cancel">Clear search</button>'
          : "",
    ),
  )}\n  </form>\n  <p class="hint">Uses your Windows account. A single eligible initial inspection opens a draft notice when all checks pass. Multiple or later results open for review. Your search and review can be saved for later.</p>\n  <div role="status" aria-live="polite">${raw("".concat(imports.LOOKUP_ERROR ? `<div class="banner alert"><div>${esc(imports.LOOKUP_ERROR)}</div></div>` : ""))}</div>\n  </div></div>`;
}

function cancelCaseLookup() {
  ++imports.LOOKUP_SERIAL;
  if (imports.LOOKUP_CONTROLLER) imports.LOOKUP_CONTROLLER.abort();
  imports.LOOKUP_CONTROLLER = null;
  imports.LOOKUP_BUSY = false;
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
        "The database marks this property as an individual landmark but supplies no landmark name. Correct the source record before importing.",
      );
    if (/^yes$/i.test(accStr(row.HistoricDistrict)) && !accStr(row.HistoricDistrictName))
      throw new Error("The database marks this property as historic but supplies no district name. Correct the source record before importing.");
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

/* Direct lookup phases. Each takes the owner's `services` and runs in the order the single lookup used to. */
function beginLookup(services) {
  if (imports.LOOKUP_BUSY) return null;
  services.captureWork();
  const number = accStr(editor.WORK.entry["lookup-number"]).toUpperCase();
  editor.WORK.entry["lookup-number"] = number;
  if (!validCaseNumber(number)) {
    imports.LOOKUP_ERROR = "Enter a complete case number using letters, numbers and hyphens.";
    services.render();
    return null;
  }
  imports.LOOKUP_ERROR = "";
  imports.LOOKUP_BUSY = true;
  const serial = ++imports.LOOKUP_SERIAL;
  const controller = new AbortController();
  imports.LOOKUP_CONTROLLER = controller;
  const active = () => serial === imports.LOOKUP_SERIAL && editor.state.screen === "import";
  services.render();
  const timer = setTimeout(() => controller.abort(), 45000);
  return { number, serial, controller, active, timer };
}

async function requestCase(number, controller) {
  const response = await authFetch("/case-lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseNumber: number }),
    signal: controller.signal,
  });
  return { response, result: await response.json() };
}

function lookupFailureMessage(error) {
  return error.name === "AbortError"
    ? "The lookup timed out. Your work is kept; retry when the network is available."
    : error.message || "The lookup failed. Your work is kept.";
}

async function endLookup(services, serial, timer) {
  clearTimeout(timer);
  if (serial !== imports.LOOKUP_SERIAL) return;
  imports.LOOKUP_BUSY = false;
  imports.LOOKUP_CONTROLLER = null;
  await services.saveDrafts();
  services.render();
}

/* Acceptance phases. Each takes the owner's `services` and runs in the order the single acceptance used to. */
function importedCaseValues(p, acc) {
  const c = p.c,
    row = p.row,
    f = p.f;
  return {
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
}

// the address on file is kept: the case-file name is built from it
function upsertImportedCase(services, p, fields) {
  const k = p.existing;
  if (k) return Object.assign(k, fields);
  const created = { id: services.uid("k"), number: p.c.number, address: p.f.address, ...fields };
  workspace.CASES.push(created);
  return created;
}

function clearImportReview() {
  editor.state.acc = null;
  editor.WORK.acc = null;
}

function refreshImportedStatus(services, k, p, importRule) {
  clearImportReview();
  applyImportRule(p.refresh, importRule);
  workspace.DIRTY = true;
  services.saveDrafts();
  services.render();
  services.toast("Accela status refreshed: " + importRule.status + " → " + importRule.label);
  return k;
}

function startSnowCitation(services, k, row) {
  k.caseType = "snow-10.28";
  services.newDoc(k.id, "citation");
  const d = doc(editor.state.docId);
  d.inspDate = row.date;
  d.inspTime = row.time;
  d.importInspection = inspectionIdentity(row);
  services.snow.prepare(d);
  services.citationPricing.refresh(d);
  services.saveDrafts();
  services.render();
  return k;
}

function startImportedReinspection(services, k, row, importRule) {
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

function startImportedNotice(services, k, row, importRule) {
  const dd = draftDocFor(k.id);
  if (dd) {
    editor.state.docId = dd.id;
    editor.state.screen = "write";
    services.saveDrafts();
    services.render();
    services.toast("Case updated — its draft is on screen");
    return k;
  }
  services.newDoc(k.id, "notice");
  const created = doc(editor.state.docId);
  if (created) {
    created.importInspection = inspectionIdentity(row);
    if (importRule) applyImportRule(created, importRule);
    services.saveDrafts();
  }
  return k;
}

function acceptImportPlan(services, acc, p) {
  const row = p.row;
  const k = upsertImportedCase(services, p, importedCaseValues(p, acc));
  services.snow.imported(k, row);
  const importRule = row.rule && !row.rule.error ? clone(row.rule) : null;
  if (p.refresh && importRule) return refreshImportedStatus(services, k, p, importRule);
  clearImportReview();
  workspace.DIRTY = true;
  if (p.next === "snow") return startSnowCitation(services, k, row);
  if (p.next === "reinspect") return startImportedReinspection(services, k, row, importRule);
  if (p.next === "notice") return startImportedNotice(services, k, row, importRule);
  editor.state.screen = "cases";
  services.saveDrafts();
  services.render();
  services.toast("Case " + k.number + " updated from the Accela report");
  return k;
}

/* Import review panel builders. Each takes what it renders from; services are read only for dates and drafts. */
const CANCEL_IMPORT = '<button class="btn" id="acc-cancel">Clear import</button>';

function importErrorPanel(acc) {
  return html`<section class="card acc"><div class="card-h"><h2>Import review</h2></div><div class="card-b">${raw(acc.errors.map((e) => `<p class="banner alert">${esc(e)}</p>`).join(""))}${raw(CANCEL_IMPORT)}</div></section>`;
}

function reportCasePicker(acc) {
  return acc.cases.length > 1
    ? html`<div class="f"><span>Choose a case from this report</span><div class="chipbar">${raw(
        "".concat(
          acc.cases
            .map(
              (x, ix) =>
                '<button class="cchip" data-acccase="' +
                `${ix}` +
                '" aria-pressed="' +
                `${ix === (acc.caseIx || 0)}` +
                '" ' +
                `${imports.LOOKUP_BUSY ? "disabled" : ""}` +
                ">" +
                `${esc(x.number)}` +
                "</button>",
            )
            .join(""),
        ),
      )}</div></div>`
    : "";
}

// R59: four labelled facts per candidate; selection is shown by the highlighted, pressed state only.
function inspectionSummary(services, x) {
  const when = x.date ? services.fmtDate(x.date) + (x.time ? " at " + services.fmtTime(x.time) : " · time not supplied") : "not supplied";
  return [
    ["Inspection type", x.type],
    ["Date", when],
    ["Inspector", x.inspectorName],
    ["Status", x.status],
  ]
    .map(([label, value]) => '<span data-import-field="' + label + '">' + label + ": <strong>" + esc(value || "not supplied") + "</strong></span>")
    .join("");
}

const BLOCKERS_ID = "acc-blockers";

function inspectionChoices(services, acc, choices, visibleBlockers) {
  if (choices.length > 1)
    return html`<fieldset class="import-choices"><legend>Choose the inspection result you are documenting</legend><p class="hint">Several eligible inspection results are available; choose one to continue.</p>${raw(
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
              `${x.i === acc.sel && visibleBlockers.length ? 'aria-describedby="' + BLOCKERS_ID + '"' : ""}` +
              " " +
              `${imports.LOOKUP_BUSY ? "disabled" : ""}` +
              ">" +
              `${inspectionSummary(services, x)}` +
              "</button>",
          )
          .join(""),
      ),
    )}</fieldset>`;
  return choices.length === 1 ? `<div class="import-selected">${inspectionSummary(services, choices[0])}</div>` : "";
}

// R62: results that cannot be used are listed, greyed and not selectable, each with its reason.
function unavailableInspections(services, unavailable) {
  return unavailable.length
    ? '<div class="import-unavailable-list"><h3>Not available for import</h3>' +
        unavailable
          .map(
            (x) =>
              '<div class="import-selected import-unavailable" aria-disabled="true">' +
              inspectionSummary(services, x) +
              '<span class="import-why">Not available: ' +
              esc(x.why || "status " + (x.status || "not supplied") + " has no document rule") +
              "</span></div>",
          )
          .join("") +
        "</div>"
    : "";
}

function existingCaseContinuity(p, k, unfinished) {
  return k
    ? html`<div class="import-continuity"><h3>Continue existing case</h3><p>${raw("".concat(unfinished ? "Keep working on the saved draft or worksheet." : "Open the current case and its document history."))} This does not import these inspection details.</p><button class="btn ${raw(unfinished ? "btn-primary" : "")}" data-import-workspace="${k.id}">Continue existing case</button></div><h3>Inspection to import</h3><p class="hint">Use an unused completed inspection to start ${raw(p.next === "snow" ? "a snow citation" : "a reinspection worksheet")}. Existing issued documents stay unchanged.</p>`
    : "";
}

function manualDateFields(p, acc) {
  return p.needDate
    ? html`<div class="grid g2"><label class="f"><span>Initial inspection date</span><input type="date" id="acc-date" value="${acc.manualDate || ""}"></label><label class="f"><span>Initial inspection time</span><input type="time" id="acc-time" value="${acc.manualTime || ""}"></label></div>`
    : "";
}

function blockerBanner(visibleBlockers) {
  return visibleBlockers.length
    ? '<div class="banner alert" id="' +
        BLOCKERS_ID +
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
    : "";
}

function caseChangeDetails(k, p) {
  return k && p.diff.length
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
    : "";
}

function importSourceDetails(acc, p) {
  return html`<details class="import-source"><summary>Source and import details</summary><p>${acc.fileName || "SSRS Excel report"}</p>${raw(
    "".concat(
      acc.source?.kind === "sql"
        ? "<p>Retrieved " +
            `${esc(new Date(acc.source.retrievedAt).toLocaleString())}` +
            ". This is a saved snapshot; use Find Accela inspection again to refresh it.</p>"
        : "",
    ),
  )}${raw((p.notes || []).map((n) => `<p>${esc(n)}</p>`).join(""))}<p>The inspection type and its result status decide the document: an Initial Inspection with Official Notice, Citation, No Occupancy or an Abatement result; a Reinspection with CA Referral (City Attorney Referral), Compliance, Citation, Extension Processing, No Fee Extension Processing, No Occupancy or No Fee No Occupancy; a CA Reinspection with Compliance or Non Compliance. Results that are not inspection outcomes (Scheduled, Pending, Completed, Inspection, No Violation, Reinspection, No Fee Reinspection, an Initial Inspection with No Entry), Assist inspections, undated rows and inspections already used on the case are not listed; other combinations are listed as not available. Blank inspection times stay blank until explicitly corrected.</p></details>`;
}

function importPanelHTML(services, acc, p) {
  if (acc.errors?.length) return importErrorPanel(acc);
  const c = p.c,
    k = p.existing;
  if (!c) return "";
  const choices = p.candidates.filter((x) => x.selectable && accStatusEligible(x.status, x.type)),
    unavailable = p.candidates.filter((x) => !(x.selectable && accStatusEligible(x.status, x.type)));
  const pick = reportCasePicker(acc);
  const visibleBlockers = p.blockers.filter((b) => !(choices.length > 1 && b === "Choose the inspection result you are documenting."));
  const inspections = inspectionChoices(services, acc, choices, visibleBlockers);
  const notAvailable = unavailableInspections(services, unavailable);
  const unfinished = k && (draftDocFor(k.id) || draftReinspFor(k.id) || services.unissuedVisitFor(k.id));
  const label = k ? "Import inspection" : p.next === "snow" ? "Start snow citation" : "Start Official Notice";
  return html`<section class="card acc import-review"><div class="card-h"><div><h2>${c.number}</h2><p>${k?.address || p.f.address}</p></div><span class="pill">${raw(k ? "Existing case" : "New case")}</span></div><div class="card-b">\n    ${raw(pick)}\n    ${raw(existingCaseContinuity(p, k, unfinished))}\n    ${raw(inspections)}${raw(notAvailable)}\n    ${raw(manualDateFields(p, acc))}\n    ${raw(p.warnings.map((w) => `<p class="banner warn">${esc(w)}</p>`).join(""))}\n    ${raw(blockerBanner(visibleBlockers))}\n    ${raw("".concat(acc.shareError ? '<button class="btn" id="lookup-recheck">Check shared record and retry</button>' : ""))}\n    ${raw(caseChangeDetails(k, p))}\n    ${raw(importSourceDetails(acc, p))}\n    <p class="hint">Case details change only when you confirm. Save draft &amp; return to Workspace keeps this review on this device when saving succeeds.</p>\n    <div class="acc-go"><button class="btn ${raw(unfinished ? "" : "btn-primary")}" id="acc-go" ${raw(p.blockers.length || imports.LOOKUP_BUSY ? "disabled" : "")}${raw(visibleBlockers.length ? ' aria-describedby="' + BLOCKERS_ID + '"' : "")}>${raw(label)}</button>${raw(CANCEL_IMPORT)}</div>\n  </div></section>`;
}

export function createAccelaImport(services) {
  /* Accela inspection import: report columns, type/status rules, XLSX reading, report parsing, import candidates,
   the review plan and panel, the direct database lookup and acceptance. */

  const LOOKUP_READY = new WeakSet();

  function baseLookupPlan(acc) {
    const p = newImportPlan(acc);
    const c = importPlanCase(acc, p);
    if (!c) return p;
    p.c = c;
    const par = importedCaseFields({ c, accParcel, p });
    importedSourceWarnings({ c, p, ACC_LABEL, par, services });
    const k = workspace.CASES.find((x) => accStr(x.number).toUpperCase() === accStr(c.number).toUpperCase()) || null;
    p.existing = k;
    const { visible, eligible, row } = selectImportCandidate({ importCandidates, c, k, accStatusEligible, p, acc });
    const snowCase = services.snow.isCase(k) || services.snow.matchesImport(row);
    importCandidateWarnings({ row, p, eligible, visible, hiddenRowsMessage, accStatusEligible });
    selectImportDate({ p, k, row, snowCase, acc, services });
    const src = k ? services.sourceDocFor(k.id) : null;
    p.next = k && src ? "reinspect" : "notice";
    // R53 Refresh from Accela: importing the same inspection again while its draft or worksheet is unissued
    // updates the stored Accela status instead of being refused as already used.
    p.refresh = refreshImportPending(k, row);
    importWorkReadiness({ k, p, services, src, row, INITIAL_EXISTS, NO_CASE });
    importReferralReadiness({ k, p, row });
    importInitialReadiness({ k, p, row, INITIAL_EXISTS });
    p.rule = row?.rule || null;
    snowImportReadiness({ snowCase, p, k, src, services, row });
    importCaseDifferences({ k, p, services, row, c, accNorm });
    return p;
  }

  async function readAccelaFile(file) {
    if (!file || editor.state.screen !== "import") return;
    cancelCaseLookup();
    const serial = imports.LOOKUP_SERIAL;
    const active = () => serial === imports.LOOKUP_SERIAL && editor.state.screen === "import";
    imports.LOOKUP_ERROR = "";
    imports.LOOKUP_BUSY = true;
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
      editor.state.acc = acc;
      await accelaFromShare(active);
      if (!active()) return;
      services.scheduleDraftSave();
      services.toast(t.errors.length ? "The report could not be imported" : "Report read — review the inspection");
    } catch (err) {
      if (active()) {
        editor.state.acc = {
          fileName: file.name,
          errors: ["That file could not be read — " + (err.message || "it is not an Excel .xlsx file") + ". Nothing was imported."],
          cases: [],
        };
        services.scheduleDraftSave();
      }
    } finally {
      if (serial === imports.LOOKUP_SERIAL) {
        imports.LOOKUP_BUSY = false;
        if (editor.state.screen === "import") services.render();
      }
    }
  }

  async function accelaFromShare(isCurrent = () => true) {
    const acc = editor.state.acc;
    if (!acc || !acc.cases || !acc.cases.length) return;
    const caseIx = acc.caseIx || 0,
      serial = imports.LOOKUP_SERIAL;
    const active = () =>
      isCurrent() && serial === imports.LOOKUP_SERIAL && editor.state.screen === "import" && editor.state.acc === acc && (acc.caseIx || 0) === caseIx;
    if (workspace.CASEDIR?.helper) {
      try {
        await checkLookupShared(acc, active);
      } catch (e) {
        if (active()) acc.shareError = e.message;
      }
      return;
    }
    if (!workspace.CASEDIR) return;
    if (workspace.NEEDGRANT) {
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
      const f = await (await workspace.CASEDIR.getFileHandle(hit.name)).getFile();
      const text = await f.text();
      if (!active()) return;
      const keep = { screen: editor.state.screen, dirty: workspace.DIRTY, docId: editor.state.docId };
      try {
        if (!services.loadCaseFile(text))
          acc.shareError = "The existing case could not be merged. Open the existing record and resolve the conflict.";
      } finally {
        editor.state.screen = keep.screen;
        workspace.DIRTY = keep.dirty;
        editor.state.docId = keep.docId;
      }
    } catch (err) {
      if (active()) {
        acc.shareError = "The existing case file could not be read. Reconnect the share and retry.";
        services.toast(acc.shareError);
      }
    }
  }

  function baseLookupAccept() {
    const acc = editor.state.acc,
      p = accelaPlan(acc);
    // the guard is here, not only on the button
    if (p.blockers.length) {
      services.toast(p.blockers[0]);
      services.render();
      return null;
    }
    return acceptImportPlan(services, acc, p);
  }

  function accelaPanel() {
    const acc = editor.state.acc;
    return importPanelHTML(services, acc, accelaPlan(acc));
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
    const caseTypeChoice = html`<label class="f no-print"><span>Case workflow for a new case</span><select id="new-case-type"><option value="">Standard code violation</option><option value="snow-10.28" ${raw(editor.WORK.entry?.["new-case-type"] === "snow-10.28" ? "selected" : "")}>Snow removal (MGO 10.28)</option></select></label>`;
    return services.shell(
      "Import inspection",
      "Bring in case details",
      '<button class="btn" id="btn-savework">Save draft &amp; return to Workspace</button>',
      html`<div style="max-width:980px">\n      ${raw(lookupCard())}\n      ${raw(editor.state.acc ? accelaPanel() : "")}\n      <details class="card import-alternative"><summary>Import an SSRS Excel report instead</summary><div class="card-b"><div class="acc-drop" id="acc-drop"><p>Load or drop the Accela case report exported as .xlsx.</p><button class="btn" id="acc-pick" ${raw(imports.LOOKUP_BUSY ? "disabled" : "")}>Load Accela report</button></div></div></details>\n      <details class="import-workflow"><summary>New-case workflow</summary>${raw(caseTypeChoice)}<p class="hint">Snow Removal records select the snow workflow automatically. Use this setting only when the source does not identify the workflow.</p></details>\n      </div>`,
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
      editor.state.modal = null;
      editor.state.picker = false;
      if (draft) {
        editor.state.docId = draft.id;
        editor.state.screen = "write";
      } else if (visit) {
        editor.state.reinspId = visit.id;
        editor.state.screen = "reinspect";
      } else if (current) {
        editor.state.docId = current.id;
        editor.state.screen = "write";
      } else {
        editor.state.screen = "cases";
        editor.state.caseQ = k.number;
        editor.state.caseFilter = "all";
        editor.state.caseInspector = "";
      }
      services.saveDrafts();
      services.render();
    });
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
    const locals = workspace.CASES.filter((k) => accStr(k.number).toUpperCase() === number);
    if (locals.length > 1 || locals.some((k) => k.number !== number))
      throw new Error("The local workspace has duplicate or differently capitalized case numbers. Resolve the existing record before importing.");
    if (hits.length) {
      const result = await services.helperJSON("/cases/open?name=" + encodeURIComponent(hits[0].name));
      if (!isCurrent()) return false;
      if (accStr(result.file?.case?.number).toUpperCase() !== number)
        throw new Error("The shared filename and case number disagree. The existing record has been kept.");
      const keep = { screen: editor.state.screen, docId: editor.state.docId, dirty: workspace.DIRTY };
      let loaded;
      try {
        loaded = services.loadCaseFile(JSON.stringify(result.file));
      } finally {
        editor.state.screen = keep.screen;
        editor.state.docId = keep.docId;
        workspace.DIRTY = keep.dirty;
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

  // Shows the retrieved case, or accepts it directly when it is a single eligible new case.
  async function openLookupResult(acc, active) {
    editor.state.acc = acc;
    editor.WORK.acc = clone(acc);
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
  }

  async function findDatabaseCase() {
    const lookup = beginLookup(services);
    if (!lookup) return;
    const { number, serial, controller, active, timer } = lookup;
    try {
      if (!(await services.saveDrafts()))
        throw new Error("Your search could not be saved on this device. Keep this screen open or download a workspace backup.");
      if (!active()) return;
      const { response, result } = await requestCase(number, controller);
      if (!active()) return;
      if (!response.ok || !result.ok) throw new Error(result.error || "The case lookup could not be completed.");
      const acc = sqlReport(result, number);
      try {
        if (!(await checkLookupShared(acc, active))) return;
      } catch (e) {
        acc.shareError = e.message;
      }
      if (!active()) return;
      await openLookupResult(acc, active);
    } catch (error) {
      if (active()) imports.LOOKUP_ERROR = lookupFailureMessage(error);
    } finally {
      await endLookup(services, serial, timer);
    }
  }

  /* R59: any eligible listed candidate of the current case can be chosen. R62: an inspection already used on the
   case is not listed, so it cannot be chosen. Each change bumps the selection token. */
  function selectImportInspection(index) {
    const acc = editor.state.acc,
      c = acc?.cases?.[acc.caseIx || 0];
    if (!c || !(accelaPlan(acc).candidates || []).some((r) => r.i === index && r.selectable && accStatusEligible(r.status, r.type))) return false;
    acc.sel = index;
    imports.ACC_SELECTION_SERIAL++;
    return true;
  }

  async function confirmDatabaseCase() {
    const acc = editor.state.acc;
    if (imports.LOOKUP_BUSY || !acc) return;
    imports.LOOKUP_ERROR = "";
    acc.shareError = "";
    const before = lookupPlanSignature(acc);
    imports.LOOKUP_BUSY = true;
    const serial = ++imports.LOOKUP_SERIAL,
      selection = imports.ACC_SELECTION_SERIAL,
      selected = acc.sel;
    // A shared-record result started for an earlier selection never confirms the current one.
    const sameSelection = () => selection === imports.ACC_SELECTION_SERIAL && acc.sel === selected;
    const active = () => serial === imports.LOOKUP_SERIAL && editor.state.screen === "import" && editor.state.acc === acc && sameSelection();
    services.render();
    try {
      if (workspace.CASEDIR?.helper || acc.source?.kind === "sql") {
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
      if (serial === imports.LOOKUP_SERIAL) {
        imports.LOOKUP_BUSY = false;
        if (!sameSelection() && editor.state.acc === acc) services.toast("The selected inspection changed. Review it and confirm again.");
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
    if ((editor.state.acc?.source?.kind === "sql" || workspace.CASEDIR?.helper) && !LOOKUP_READY.has(editor.state.acc)) {
      services.toast("Check the shared record before confirming this lookup.");
      return null;
    }
    const direct = editor.state.acc?.source?.kind === "sql";
    const result = baseLookupAccept();
    if (result && direct) {
      delete editor.WORK.entry["lookup-number"];
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
