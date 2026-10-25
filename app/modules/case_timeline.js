import { independentArtifact, pdfTransferState } from "./pdf_artifacts.js";
import { inspAt } from "./inspection_facts.js";
import { caseNumberKey, recordDay } from "../assets/shared.js";
import { applyDeposit, changeCharge, chargeChoices, choosesCharge, feeLines, fmtDate } from "./court_and_deposits.js";
import { caseFileFault } from "./case_file_rules.js";
import { helperJSON, loadCaseFile } from "./workspace_shell.js";
import { stableJSON, clone } from "./record_values.js";
import { render } from "./app_screens.js";
import { hasSetupWork } from "./issuance_and_corrections.js";
import {
  preflightCase,
  A11Y,
  HANDOFF_CHANNEL,
  MINDUE,
  WRITER_READY_WAIT,
  administration,
  citationPricing,
  citationPricingDate,
  depositStep,
  initialCitations,
  initialOrderCitation,
  isLocked,
  navigation,
  snow,
  structEditable,
  uid,
  unchangedCorrectionValue,
} from "./app_core.js";

import { CITFEES, DOCBODY, DOC_TYPES } from "./document_types.js";
import { parseDate, parseTime, validISO, daysBetween } from "./calendar.js";
import { checkAttr, checkTarget, citSelector, countBlanks, esc as dep_esc, itemSelector, money, validMoney } from "./presentation_format.js";
import { correctionSource, doc, docCase, docsFor, effectiveFiled, kase, reinsp } from "./writer_queries.js";

import { distinctDues, dueItems, itemLibraryKey, libraryKey } from "./document_rules.js";
import {
  CITATION_POLICY,
  canonicalOrdinance,
  cents,
  courtCents,
  formatDeposit,
  policyAt,
  resolveCitationAmount,
  resolveOrdinance,
  respondentKey,
  tierLabel,
  tierOrdinal,
} from "./citation_policy.js";
import { LIBRARY } from "./data/library.js";
import { WriterState } from "./state.js";

/* app functions; direct dependencies use explicit shared state. */

function planBulkDue(changes, value) {
  if (!validISO(value) || value < MINDUE()) throw new Error("Choose a future due date");
  if (!changes.length) throw new Error("Select at least one outstanding draft item");
  const copies = new Map();
  for (const change of changes) {
    const current = doc(change.docId);
    if (!current || !structEditable(current) || current.pendingAmendment)
      throw new Error("Only new, editable notice drafts can receive batch deadlines");
    if (!copies.has(current.id)) copies.set(current.id, clone(current));
    const copy = copies.get(current.id),
      item = dueItems(copy).find((i) => i.id === change.itemId);
    if (!item) throw new Error("Selected item is not outstanding");
    item.due = value;
  }
  for (const copy of copies.values()) {
    if (distinctDues(dueItems(copy)).length > 3) throw new Error("That would create more than three deadlines");
    if (dueDateSpacingConflicts(dueItems(copy)).length) throw new Error("Keep deadlines at least seven days apart");
  }
  return copies;
}

function showBulkDue() {
  navigation.utilityContext();
  A11Y.utility(
    "Batch draft due dates",
    "<p>Updates apply only to selected outstanding items in new editable noti" +
      "ce drafts. All selected drafts are validated together before saving.</p>" +
      '<form id="batch-due-form"><label>New due date <input type="date" name="d' +
      'ue" min="' +
      `${MINDUE()}` +
      '" required></label>' +
      "".concat(
        WriterState.DOCS.filter((d) => structEditable(d) && !d.pendingAmendment)
          .map(
            (d) =>
              "<fieldset><legend>" +
              `${dep_esc(kase(d.caseId).number)}` +
              "</legend>" +
              "".concat(
                dueItems(d)
                  .map(
                    (i) =>
                      '<label><input type="checkbox" data-batch-doc="' +
                      `${dep_esc(d.id)}` +
                      '" data-batch-item="' +
                      `${dep_esc(i.id)}` +
                      '"> Item ' +
                      `${dep_esc(i.no)}` +
                      " · " +
                      `${dep_esc(i.title)}` +
                      " · " +
                      `${dep_esc(i.due || "No deadline")}` +
                      "</label>",
                  )
                  .join(""),
              ) +
              "</fieldset>",
          )
          .join("") || "<p>No eligible notice drafts.</p>",
      ) +
      '<button class="btn" type="submit">Validate and save selected deadlines</' +
      "button></form>",
  );
}

function depositComplete(d) {
  return (
    !Object.keys(d.depositRequests || {}).length &&
    (d.items || []).filter((i) => i.cite && !i.withdrawn).every((i) => !citationDepositFault(d.cits?.[i.id] || {}, d, i))
  );
}

function workspaceTasks(rows) {
  const task = (key, label, unit, items) => ({ key, label, unit, items, count: items.length });
  const caseTask = (x, text, action) => ({ cid: x.k.id, label: x.k.number + " · " + x.k.address + " · " + text, action });
  const open = rows.filter((x) => !x.st.closed),
    drafts = rows.filter((x) => x.st.draft || x.st.visit);
  const needsDeposit = rows.flatMap((x) =>
    docsFor(x.k.id)
      .filter((d) => d.draft && !depositComplete(d))
      .map((d) => caseTask(x, "Citation needs deposit", `data-open="${dep_esc(d.id)}"`)),
  );
  const pendingDocs = rows.flatMap((x) =>
    docsFor(x.k.id)
      .filter((d) => d.pendingAmendment)
      .map((d) => caseTask(x, "Document save confirmation", `data-open="${dep_esc(d.id)}"`)),
  );
  const pendingRecords = rows.flatMap((x) =>
    Object.entries(WriterState.RECORD_ATTEMPTS)
      .filter(([, a]) => a.cid === x.k.id)
      .map(([id]) => caseTask(x, "Record save confirmation", `data-resumerecord="${dep_esc(id)}"`)),
  );
  const unfiled = rows.flatMap((x) =>
    docsFor(x.k.id)
      .filter((d) => independentArtifact(d) && !effectiveFiled(d))
      .map((d) => caseTask(x, "File " + ((DOC_TYPES.find((t) => t.id === d.type) || {}).label || d.type) + " PDF", `data-open="${dep_esc(d.id)}"`)),
  );
  const local = rows.flatMap((x) =>
    docsFor(x.k.id)
      .filter(
        (d) =>
          independentArtifact(d) &&
          (pdfTransferState(d) === "local outbox" ||
            (pdfTransferState(d) === "last verified location; refresh unavailable" && WriterState.ARTIFACT_LOCATIONS[d.id]?.includes("local"))),
      )
      .map((d) =>
        caseTask(
          x,
          "Transfer " +
            ((DOC_TYPES.find((t) => t.id === d.type) || {}).label || d.type) +
            " PDF" +
            (WriterState.ARTIFACT_VERIFY[d.id] === "unavailable" ? " (last verified; refresh unavailable)" : ""),
          `data-outbox`,
        ),
      ),
  );
  const issues = rows.flatMap((x) =>
    docsFor(x.k.id)
      .filter(
        (d) =>
          independentArtifact(d) &&
          [
            "artifact conflict",
            "missing or unavailable",
            "location unverified",
            "historical / location unverified",
            "invalid artifact identity",
            "location verification unavailable",
            "last verified location; refresh unavailable",
          ].includes(pdfTransferState(d)),
      )
      .map((d) =>
        caseTask(
          x,
          "Check " + ((DOC_TYPES.find((t) => t.id === d.type) || {}).label || d.type) + " PDF · " + pdfTransferState(d),
          `data-open="${dep_esc(d.id)}"`,
        ),
      ),
  );
  return [
    task("deposit", "Citation needs deposit", "documents", needsDeposit),
    task(
      "open",
      "Open cases",
      "cases",
      open.map((x) => caseTask(x, x.st.due ? "Next due " + fmtDate(x.st.due) : "No applicable deadline", `data-case-task="${dep_esc(x.k.id)}"`)),
    ),
    task(
      "drafts",
      "Unfinished cases",
      "cases",
      drafts.map((x) => caseTask(x, x.st.label, x.st.draft ? `data-open="${dep_esc(x.st.draft.id)}"` : `data-reinsp="${dep_esc(x.k.id)}"`)),
    ),
    task(
      "overdue",
      "Past due",
      "cases",
      rows.filter((x) => x.st.late).map((x) => caseTask(x, "Due " + fmtDate(x.st.due), `data-reinsp="${dep_esc(x.k.id)}"`)),
    ),
    task(
      "soon",
      "Due within 7 days",
      "cases",
      rows.filter((x) => x.st.soon).map((x) => caseTask(x, "Due " + fmtDate(x.st.due), `data-reinsp="${dep_esc(x.k.id)}"`)),
    ),
    task(
      "imports",
      "Imports to review",
      "imports",
      hasSetupWork() ? [{ cid: "", label: "Saved import or case lookup", action: 'data-nav="import"' }] : [],
    ),
    task("confirm", "Save confirmations", "operations", pendingRecords.concat(pendingDocs)),
    task(
      "pending",
      "Case files to sync",
      "operations",
      WriterState.PENDING.map((p) => ({
        cid: p.cid,
        label: (kase(p.cid).number || p.name) + " · held case file from " + p.at,
        action: `data-case-sync="${dep_esc(p.cid)}"`,
      })),
    ),
    task("filing", "PDFs to file", "documents", unfiled),
    task("outbox", "PDFs in local outbox", "documents", local),
    task("artifacts", "PDF artifacts to check", "documents", issues),
  ];
}

function markWriterReady() {
  WriterState.WRITER_READY = true;
  WriterState.STARTUP_STATUS = "ready";
  WriterState.releaseWriterReady(true);
  render();
}

function markWriterFailed(error) {
  WriterState.WRITER_READY = false;
  WriterState.WORKSPACE_RESTORED = false;
  WriterState.STARTUP_STATUS = "failed";
  WriterState.STARTUP_ERROR = String(error?.message || error || "Workspace restoration failed");
  WriterState.releaseWriterReady(false);
  render();
}

async function writerOpenReportedCase(message) {
  if (!WriterState.WRITER_ACCESS) throw new Error("Another Writer tab owns this workspace");
  if (!WriterState.WRITER_READY) await WRITER_READY_WAIT;
  if (!WriterState.WRITER_READY) throw new Error("Saved workspace restoration must finish before opening a case.");
  const number = String(message.number || "");
  if (!caseNumberKey(number)) throw new Error("Invalid case number");
  const request = ++WriterState.HANDOFF_SEQ;
  const existing = WriterState.CASES.find((k) => caseNumberKey(k.number) === caseNumberKey(number));
  if (existing) {
    await preflightCase(existing.id, "report handoff", () => {
      WriterState.state.metric = "";
      WriterState.state.caseQ = number;
      WriterState.state.caseFilter = "all";
      WriterState.state.screen = "cases";
      render();
    });
    if (request !== WriterState.HANDOFF_SEQ) throw new Error("A newer case request replaced this one");
    WriterState.REPORT_RETURN = true;
    render();
    window.focus?.();
    return "Local work was kept; review the case or reconciliation panel in Writer.";
  }
  let opened;
  try {
    opened = await helperJSON("/cases/resolve?number=" + encodeURIComponent(number));
  } catch (error) {
    if (error.name === "NotFoundError") throw new Error("No shared case exists for " + number + ".");
    throw error;
  }
  if (request !== WriterState.HANDOFF_SEQ) throw new Error("A newer case request replaced this one");
  const file = opened.file;
  if (caseNumberKey(file.case?.number) !== caseNumberKey(number) || caseFileFault(file))
    throw new Error("The current shared file is invalid or belongs to a different case");
  if (!loadCaseFile(JSON.stringify(file))) throw new Error("The shared case could not be loaded");
  WriterState.REPORT_RETURN = true;
  WriterState.state.metric = "";
  WriterState.state.caseQ = number;
  WriterState.state.caseFilter = "all";
  render();
  window.focus?.();
  const count = Number(message.eventCount);
  if (Number.isFinite(count) && count !== (file.events || []).length) {
    WriterState.PREFLIGHT_NOTICE =
      "The shared case changed since this report was indexed. Writer opened the" +
      " current validated case; refresh Reports before relying on its totals.";
    render();
  }
  return "Current shared case opened in Writer.";
}

function initWriterHandoff() {
  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(HANDOFF_CHANNEL);
    WriterState.WRITER_CHANNEL = channel;
    channel.onmessage = async (e) => {
      if (!WriterState.WRITER_ACCESS || WriterState.WRITER_CHANNEL !== channel) return;
      const m = e.data;
      if (m?.kind === "return-ack") {
        WriterState.RETURN_ACK = m.request;
        return;
      }
      if (m?.kind !== "open" || !m.request) return;
      channel.postMessage({ kind: "accepted", request: m.request });
      try {
        const detail = await writerOpenReportedCase(m);
        if (WriterState.WRITER_ACCESS && WriterState.WRITER_CHANNEL === channel)
          channel.postMessage({ kind: "result", request: m.request, ok: true, detail });
      } catch (err) {
        if (WriterState.WRITER_ACCESS && WriterState.WRITER_CHANNEL === channel)
          channel.postMessage({ kind: "result", request: m.request, ok: false, error: err.message });
      }
    };
  }
  const number = new URLSearchParams(globalThis.location?.search || "").get("case");
  if (number)
    writerOpenReportedCase({ number }).catch((e) => {
      WriterState.PREFLIGHT_NOTICE = "Report handoff could not open the case: " + e.message;
      render();
    });
}

function initialCitationBody(d) {
  // R35: an initial-inspection citation replaces the Official Notice, so its letter carries the notice's order language.
  if (initialOrderCitation(d)) return DOCBODY.initialCitation;
  return DOCBODY.citation
    .replace(
      "<p>A reinspection found that the work on one or more items is incomplete" +
        ". Below is a list of items that need further work and your new due date." +
        "</p>",
      "<p>An inspection documented the violations listed below. The compliance " + "deadlines remain those in the Official Notice.</p>",
    )
    .replace("We are issuing a citation for the unfinished work.", "We are issuing a citation for the documented violation.")
    .replace(
      " We may also charge a $75.00 reinspection fee since the work is incomple" + "te. The $75.00 fee is separate from the citation amount.",
      "",
    );
}

function updateDueIndicators(d) {
  const count = document.querySelector("[data-due-count]");
  if (count) count.textContent = distinctDues(dueItems(d)).length + " of 3 dates used";
  dueItems(d).forEach((i) => {
    const label = document.querySelector('[data-due-label="' + i.id + '"]');
    if (label) label.textContent = i.due ? fmtDate(i.due) : "Date needed";
  });
}

function toggleLibraryItem(d, ci, gi, src) {
  const lib = { c: LIBRARY[ci].code, g: LIBRARY[ci].groups[gi].code, o: src.o },
    key = libraryKey(lib);
  d.selectionCache = d.selectionCache || {};
  const found = d.items.find((i) => itemLibraryKey(i) === key);
  if (found) {
    d.selectionCache[key] = clone(found);
    d.items = d.items.filter((i) => itemLibraryKey(i) !== key);
    snow.removed(d);
    return false;
  }
  if (!snow.canAdd(d, key)) return false;
  const restored = d.selectionCache[key];
  delete d.selectionCache[key];
  d.items.push(
    restored || {
      id: uid("x"),
      group: "",
      sections: [...src.s],
      title: src.t,
      abate: false,
      due: "",
      text: src.a,
      prov: src.p || "export",
      lib,
      libraryKey: key,
      catalogVersion: src.catalogVersion || 0,
      catalogReviewId: src.catalogReviewId || "",
    },
  );
  snow.added(d, d.items[d.items.length - 1]);
  return true;
}

function dueDateSpacingConflicts(items) {
  const byDate = new Map();
  items.forEach((i) => {
    if (validISO(i.due)) {
      if (!byDate.has(i.due)) byDate.set(i.due, []);
      byDate.get(i.due).push(i);
    }
  });
  const dates = [...byDate.keys()].sort(),
    conflicts = [];
  for (let ix = 1; ix < dates.length; ix++)
    if (daysBetween(dates[ix - 1], dates[ix]) < 7)
      conflicts.push({ dates: [dates[ix - 1], dates[ix]], items: [...byDate.get(dates[ix - 1]), ...byDate.get(dates[ix])] });
  return conflicts;
}

function dueContext(target, visit) {
  if (visit) {
    const src = doc(target.sourceDocId);
    return (src ? src.items : [])
      .filter(
        (i) =>
          !i.done &&
          !i.withdrawn &&
          target.results[i.id] &&
          target.results[i.id].oc &&
          target.results[i.id].oc !== "corrected" &&
          target.results[i.id].oc !== "withdrawn" &&
          !target.results[i.id].carried,
      )
      .map((i) => ({ id: i.id, no: i.no, title: i.title, due: target.results[i.id].due || "" }));
  }
  return dueItems(target);
}

function duePanel(target, visit) {
  if (snow.is(target)) return "";
  // R53: also on an open reinspection worksheet, for the items still outstanding.
  if (visit ? !target.draft || target.docId : isLocked(target) || target.type !== "notice" || target.correction) return "";
  const items = dueContext(target, visit);
  if (!items.length) return "";
  const work = target.dueWork || {},
    selected = new Set(work.selected || []),
    dates = distinctDues(items);
  /* A notice draft selects items in the items table (data-due-select beside each due date), so its panel is a compact
     bar; the reinspection worksheet keeps its item list. Both apply through assignDue. */
  return (
    '<section class="card no-print authoring-panel' +
    `${visit ? "" : " due-compact"}` +
    '" aria-label="Assign due dates"><div class="card-h"><h2>Assign due dates' +
    "</h2><span data-due-count>" +
    `${dates.length}` +
    ' of 3 dates used</span></div><div class="card-b"><p class="hint">' +
    (visit
      ? "Select items that share a deadline and apply a date. Up to three distinct deadlines are allowed."
      : "Select items in the table above, then apply one date to them. Up to three distinct due dates are allowed.") +
    "</p>" +
    (visit
      ? '<div class="deadline-items">' +
        items
          .map(
            (i) =>
              '<label class="deadline-item"><input type="checkbox" data-due-select="' +
              `${dep_esc(i.id)}` +
              '" ' +
              `${selected.has(i.id) ? "checked" : ""}` +
              "><span><strong>Item " +
              `${dep_esc(i.no)}` +
              "</strong> · " +
              `${dep_esc(i.title || "Violation")}` +
              '<small data-due-label="' +
              `${dep_esc(i.id)}` +
              '">' +
              `${i.due ? dep_esc(fmtDate(i.due)) : "Date needed"}` +
              "</small></span></label>",
          )
          .join("") +
        "</div>"
      : "") +
    '<div class="editor-tools">' +
    ("<span data-due-selected>" + dueSelectedText(items, selected) + "</span>") +
    '<button class="btn btn-sm" data-due-all="1">Select all</button><button class="btn btn-sm" data-due-all="0">Clear' +
    ' selection</button><label for="bulk-due">Date for selected items</label>' +
    '<input type="date" id="bulk-due" value="' +
    `${dep_esc(work.date || "")}` +
    '" min="' +
    `${MINDUE()}` +
    '"><button class="btn btn-primary" id="btn-bulkdue">Apply date to selected items</bu' +
    "tton></div></div></section>"
  );
}

function dueSelectedText(items, selected) {
  const n = items.filter((i) => selected.has(i.id)).length;
  return n + " of " + items.length + " item" + (items.length === 1 ? "" : "s") + " selected";
}

function assignDue(target, visit, value, ids) {
  if (
    visit
      ? // An empty or missing intent is "not yet decided" (an import rule that asks for a choice sets "").
        !target.draft ||
        target.docId ||
        (target.followupIntent && !["undecided", "extension", "bestInterestExtension", "citation"].includes(target.followupIntent))
      : isLocked(target) || target.type !== "notice" || target.correction
  )
    return "Assign due dates is available on a new Official Notice or an open reinspection worksheet.";
  const items = dueContext(target, visit),
    selected = new Set(ids || []);
  if (!selected.size) return "Select at least one outstanding item.";
  if ([...selected].some((id) => !items.some((i) => i.id === id))) return "The selection changed. Select only current outstanding items.";
  if (!validISO(value) || value < MINDUE()) return "Choose a future due date.";
  const proposed = items.map((i) => ({ ...i, due: selected.has(i.id) ? value : i.due }));
  if (distinctDues(proposed).length > 3) return "That would create more than three due dates. Select a larger group or use an existing date.";
  if (dueDateSpacingConflicts(proposed).length) return "Keep distinct due dates at least seven days apart.";
  items
    .filter((i) => selected.has(i.id))
    .forEach((i) => {
      if (visit) target.results[i.id].due = value;
      else target.items.find((x) => x.id === i.id).due = value;
    });
  if (target.correction) target.correction.reviewed = false;
  return "";
}

function citationDepositFault(c, d = null, i = null) {
  if (!canonicalOrdinance(c.ord)) return "Choose one complete citation ordinance.";
  if (c.issued && !validISO(c.issued)) return "Enter a valid citation issue date.";
  if (c.pricedOn && !validISO(c.pricedOn)) return "Enter a valid pricing date.";
  if (c.depositEditInvalid) return "Correct the deposit field before confirming.";
  if (c.reconfirmDeposit) return "Re-confirm deposit after the charge or basis changed.";
  if (canonicalOrdinance(c.ord) === "27.05(2)(s)" && /noxious\s+weeds/i.test(c.desc || ""))
    return "27.05(2)(s) is Removal of Debris; it cannot print the stale weeds description.";
  const mode = c.depositMode || "schedule";
  if (!["schedule", "base", "total"].includes(mode)) return "Choose a deposit method.";
  if (mode !== "schedule" && String(c.depositSource || "").trim().length < 10)
    return "Record the approved schedule, court instruction or other authority (at least 10 characters).";
  if (c.mandatoryAppearance && d?.authoringVersion >= 8) {
    const f = resolveOrdinance(c.ord, i ? itemLibraryKey(i) : "", c.scheduleEntryId, c.pricedOn || c.issued);
    return f?.rule?.kind === "mandatory" && !c.amount ? "" : "Mandatory appearance permits no deposit.";
  }
  if (!validMoney(c.amount) || +c.amount <= 0) return "Enter a positive cash deposit with at most two decimal places.";
  const original = d && i && citationPricing.unchangedCorrection(d, i, c);
  if (original) {
    if (
      [
        "amount",
        "base",
        "cc",
        "depositMode",
        "tier",
        "scheduleEntryId",
        "assessments",
        "pricedOn",
        "policyVersionHash",
        "depositSource",
        "measurements",
        "mandatoryAppearance",
        "overrideBasis",
      ].every((k) => stableJSON(original[k]) === stableJSON(c[k]))
    )
      return "";
    return "An unchanged charge retains its original deposit and pricing basis.";
  }
  if (d?.authoringVersion >= 9 && c.overrideBasis) {
    const fault = administration.overrideFault(c, d);
    if (fault) return fault;
  }
  if (
    d?.authoringVersion >= 8 &&
    mode !== "schedule" &&
    !c.overrideBasis &&
    resolveCitationAmount({
      ordinance: c.ord,
      libraryItem: i ? itemLibraryKey(i) : "",
      entryId: c.scheduleEntryId,
      tier: c.tier || 1,
      date: c.pricedOn || c.issued,
      measurements: c.measurements || {},
    }).kind === "priced"
  )
    return "This charge has a calculated deposit. Use Scheduled deposit.";
  if (d?.authoringVersion >= 7 && !validISO(c.pricedOn)) return "Enter a valid pricing date.";
  if (!validISO(c.pricedOn || c.issued)) return "Enter a valid pricing date.";
  if (d?.authoringVersion >= 8 && mode !== "total" && cents(c.base) === 0 && !CITATION_POLICY.allowZeroBaseDeposits)
    return "A zero forfeiture needs City Attorney approval";
  if (mode === "total")
    return c.assessments ? "An approved total must not retain a calculated assessment breakdown. Choose the deposit method again." : "";
  if (!validMoney(c.base) || !validMoney(c.cc) || +c.cc < CITFEES.ccMin || +c.cc > policyAt(c.pricedOn || c.issued).fees.ccMaxCents / 100)
    return "Enter a valid base deposit and court costs between $15 and $48.";
  if (money(feeLines(c.base, c.cc, c.pricedOn || c.issued).total) !== money(c.amount))
    return "The deposit does not match its recorded base and assessments.";
  if (mode === "schedule") {
    if (c.tierOverrideSource && String(c.tierOverrideSource).trim().length >= 10 && !/^[1-9]\d*$/.test(String(c.tierOverride || "")))
      return "An approved offense tier must be a positive whole number.";
    if ((c.tierOverride && !String(c.tierOverrideSource || "").trim()) || (c.tierOverrideSource && String(c.tierOverrideSource).trim().length < 10))
      return "An approved tier override requires its recorded source (at least 10 characters).";
    const f = resolveOrdinance(c.ord, i ? itemLibraryKey(i) : "", c.scheduleEntryId, c.pricedOn || c.issued),
      ordinal = tierOrdinal(c.tier),
      pick = f?.tiers?.[Math.min(ordinal, f.tiers.length) - 1];
    if (d && f && f.window !== "site" && f.window?.kind !== "site-season" && !respondentKey(docCase(d)))
      return "Scheduled pricing needs the respondent name and mailing address, or an approved manual basis.";
    if (
      (f?.rule
        ? (() => {
            const r = resolveCitationAmount({
              ordinance: c.ord,
              libraryItem: i ? itemLibraryKey(i) : "",
              entryId: c.scheduleEntryId,
              tier: ordinal,
              date: c.pricedOn || c.issued,
              measurements: c.measurements || {},
            });
            return r.kind !== "priced" || money(r.base) !== money(c.base);
          })()
        : !pick || money(pick.a) !== money(c.base)) ||
      cents(c.cc) !== courtCents(c.pricedOn || c.issued)
    )
      return "No matching scheduled deposit. Correct the ordinance or enter an approved deposit and source.";
    if (c.computedTier && ordinal !== c.computedTier && !c.tierOverrideSource)
      return "Expected tier " + tierLabel(c.computedTier) + ". Review the counted citations.";
  }
  return "";
}

// R59: an ordinance with several schedule rows needs its scheduled offense before it can be priced.
const scheduledOffenseNeeded = (c) =>
  !c.scheduleEntryId && CITATION_POLICY.entries.filter((e) => e.ordinance === canonicalOrdinance(c.ord)).length > 1;

function editCitation(d, id, field, value, phase = "commit") {
  // R59: the different-charge ordinance input edits the same stored charge as the section select, and a
  // charge awaiting its deposit basis keeps an editable ordinance.
  if (field === "ordOther") field = "ord";
  const c = d.cits[id] || (field === "ord" ? d.depositRequests?.[id] : null);
  if (!c) return;
  if (["courtDate", "issued", "violDate"].includes(field)) value = parseDate(value) || String(value || "").trim();
  if (["courtTime", "violTime"].includes(field)) value = parseTime(value) || String(value || "").trim();
  if (field === "ord") {
    if (phase === "input") {
      if (!Object.prototype.hasOwnProperty.call(c, "ordEditingFrom")) c.ordEditingFrom = c.ord;
      c.ord = String(value || "");
      if (d.correction) d.correction.reviewed = false;
      return;
    }
    if (Object.prototype.hasOwnProperty.call(c, "ordEditingFrom")) c.ord = c.ordEditingFrom;
    delete c.ordEditingFrom;
    // Nothing priced, measured or approved for the previous charge carries over to the new one.
    if (changeCharge(d, id, value) && d.correction) d.correction.reviewed = false;
    return;
  }
  if (c[field] === value) return;
  if (["tierOverride", "tierOverrideSource"].includes(field) && !String(value || "").trim()) {
    delete c[field];
    citationPricing.refresh(d);
    return;
  }
  if (field === "amount" && !(cents(value) > 0)) {
    c.depositEditInvalid = true;
    c.reconfirmDeposit = true;
    return;
  }
  c[field] = value;
  if (field === "amount") delete c.depositEditInvalid;
  if (field === "issued") delete c.issuedAutomatic;
  if (field === "desc") c.descEdited = true;
  if (["violDate", "issued", "scheduleEntryId", "tierOverride", "tierOverrideSource"].includes(field)) citationPricing.refresh(d);
  if (field === "depositMode") {
    if (value !== "schedule" && c.resolvedVia && !c.resolvedVia.startsWith("approved-")) delete c.depositSource;
    delete c.assessments;
    if (value === "schedule") applyDeposit(d, id, c.ord);
    else {
      if (value === "base" && validMoney(c.base) && validMoney(c.cc)) {
        const lines = feeLines(c.base, c.cc, c.pricedOn || c.issued);
        c.amount = money(lines.total);
        c.assessments = lines.cents;
      }
      c.reconfirmDeposit = String(c.depositSource || "").trim().length < 10;
    }
  }
  if (["base", "cc"].includes(field) && c.depositMode !== "total") {
    const lines = validMoney(c.base) && validMoney(c.cc) ? feeLines(c.base, c.cc, c.pricedOn || c.issued) : null;
    if (lines) {
      c.amount = money(lines.total);
      c.assessments = lines.cents;
    } else c.reconfirmDeposit = true;
  }
  if (
    ["base", "cc", "amount", "depositSource"].includes(field) &&
    c.depositMode !== "schedule" &&
    !c.depositEditInvalid &&
    validMoney(c.amount) &&
    String(c.depositSource || "").trim().length >= 10 &&
    (c.depositMode === "total" || (validMoney(c.base) && validMoney(c.cc)))
  ) {
    delete c.reconfirmDeposit;
    c.resolvedVia = "approved-" + c.depositMode;
    c.pricedOn = citationPricingDate(c, d);
    c.policyVersionHash = CITATION_POLICY.versionHash;
  }
  if (d.correction) d.correction.reviewed = false;
}

function commitCitationEdits(d) {
  for (const [id, c] of Object.entries(d?.cits || {}))
    if (Object.prototype.hasOwnProperty.call(c, "ordEditingFrom")) editCitation(d, id, "ord", c.ord);
}

function authoringChecks(d) {
  citationPricing.refresh(d);
  const out = [];
  let targetItem = null;
  const check = (ok, t, fields = []) =>
    out.push({
      ok,
      t,
      ...(targetItem && fields.length
        ? { targets: fields.map((f) => checkTarget(citSelector(targetItem.id, f), "Item " + targetItem.no + " · " + f)) }
        : {}),
    });
  if (["notice", "extension", "citation"].includes(d.type))
    check(distinctDues(dueItems(d)).length <= 3, "Use no more than three distinct due dates for outstanding items.");
  if (["notice", "extension", "citation"].includes(d.type)) {
    const close = dueDateSpacingConflicts(dueItems(d)).filter(
      (pair) => !d.correction || pair.items.some((i) => !unchangedCorrectionValue(d, i.id, "due")),
    );
    const items = [...new Map(close.flatMap((pair) => pair.items).map((i) => [i.id, i])).values()];
    out.push({
      ok: close.length === 0,
      t: close.length ? "Keep distinct due dates at least seven days apart." : "Distinct due dates are at least seven days apart.",
      ...(items.length ? { targets: items.map((i) => checkTarget(itemSelector(i.id, "due"), "Item " + i.no + " · due date")) } : {}),
    });
  }
  if (d.type === "notice" && !d.correction) {
    const keys = d.items.map(itemLibraryKey).filter(Boolean);
    check(new Set(keys).size === keys.length, "Each library item can appear only once on an original notice. Remove duplicate items.");
  }
  if (d.type === "citation") check(depositComplete(d), "Citation needs deposit. Complete the required deposit step.");
  if (d.type === "citation") check(!citationPricing.historyFault(d), citationPricing.historyFault(d) || "Shared citation history has been checked.");
  if (d.type === "citation")
    d.items
      .filter((i) => i.cite && !i.withdrawn)
      .forEach((i) => {
        const c = (d.cits || {})[i.id] || {},
          prefix = "Citation for item " + i.no + ": ",
          old = correctionSource(d),
          original = old && (old.cits || {})[i.id];
        targetItem = i;
        const request = d.depositRequests?.[i.id];
        if (request) {
          out.push({
            ok: false,
            t:
              prefix +
              (choosesCharge(i) && !String(request.ord || "").trim()
                ? "choose the charged ordinance from its sections."
                : scheduledOffenseNeeded(request)
                  ? "choose the scheduled offense in Citation review."
                  : !canonicalOrdinance(request.ord)
                    ? "choose one complete ordinance and complete the approved deposit basis in Citation review."
                    : request.measurementFields?.length
                      ? "complete the required measurements in Citation review."
                      : "complete the approved deposit basis in Citation review."),
            targets: [
              checkTarget(
                '[data-deposit-form="' +
                  checkAttr(i.id) +
                  '"] ' +
                  (request.measurementFields?.length
                    ? '[name^="measure-"]'
                    : canonicalOrdinance(request.ord) && scheduledOffenseNeeded(request)
                      ? '[name="scheduleEntryId"]'
                      : '[name="ord"]'),
                "Item " + i.no + " · complete charge",
              ),
            ],
          });
          return;
        }
        check(
          !c.mandatoryAppearance,
          prefix +
            ("mandatory-appearance citations need division-approved defendant instruct" +
              "ions. Your draft is retained; ask the division to approve the wording be" +
              "fore issuance."),
          ["ord"],
        );
        check(!i.done, prefix + "only outstanding violations may be cited.");
        const unchosen = choosesCharge(i) && !String(c.ord || "").trim();
        check(
          !unchosen && !!canonicalOrdinance(c.ord),
          prefix + (unchosen ? "choose the charged ordinance from its sections." : "enter one complete ordinance number, not a list of sections."),
          ["ord"],
        );
        check(!citationPricing.chargeFault(d, i, c), prefix + (citationPricing.chargeFault(d, i, c) || "charge matches the current item."), [
          "ord",
          "differentChargeSource",
        ]);
        check(
          !["desc", "comment", "statute", "deptId"].some((k) => countBlanks(String(c[k] || ""))),
          prefix + "complete all placeholder details in the citation fields.",
          ["desc", "comment"],
        );
        check(!citationDepositFault(c, d, i), prefix + (citationDepositFault(c, d, i) || "deposit and its basis agree."), [
          "depositMode",
          "ord",
          ...(c.depositMode === "total" ? ["amount"] : c.depositMode === "base" ? ["base", "cc"] : []),
          ...(c.depositMode && c.depositMode !== "schedule" ? ["depositSource"] : []),
        ]);
        check(!!parseTime(c.courtTime), prefix + "enter a valid court time in Citation review.", ["courtTime"]);
        check(!!parseTime(c.violTime || inspAt(d).time), prefix + "enter the inspection/violation time.", ["violTime"]);
        check(
          validISO(c.violDate || inspAt(d).date) &&
            (c.violDate || inspAt(d).date) >= (docCase(d).date || "") &&
            (c.violDate || inspAt(d).date) <= (c.issued || ""),
          prefix + "the violation date must be on or before issuance.",
          ["violDate"],
        );
        check(validISO(c.issued) && c.issued <= recordDay(today), prefix + "the issue date must be no later than today.", ["issued"]);
        check(
          validISO(c.issued) &&
            c.issued === (d.correction ? d.correction.actionDate : d.authoringVersion >= 9 ? d.revision?.actionDate || d.mailed : d.mailed),
          prefix +
            (d.correction
              ? "the issue date must match the original action date used in reports."
              : "the issue date must match this document’s mailed date."),
          ["issued"],
        );
        check(validISO(c.courtDate) && c.courtDate > c.issued, prefix + "the court date must follow issuance.", ["courtDate"]);
        check(/^[A-Za-z0-9-]+$/.test(c.num || ""), prefix + "use a citation number containing letters, numbers or hyphens.", ["num"]);
        if (original) check(c.num === original.num, prefix + "a correction retains the original citation number.", ["num"]);
      });
  return out;
}

/* R43: the charge card owns review; pricing and publication retain their existing owners. */
function citationReview(d) {
  citationPricing.refresh(d);
  citationPricing.ensureShared(d);
  if (initialCitations.enabled(d)) d = initialCitations.preview(d);
  if (d.type !== "citation" || isLocked(d)) return "";
  citationPricing.refresh(d);
  const esc = dep_esc;
  const field = (i, c, key, label, type = "text", extra = "") =>
    '<label class="f"><span>' +
    `${label}` +
    '</span><input type="' +
    `${type}` +
    '" data-review-cit="' +
    `${esc(i.id)}` +
    "|" +
    `${key}` +
    '" aria-label="' +
    `${label}` +
    " for item " +
    `${esc(i.no)}` +
    '" value="' +
    `${esc(c[key] ?? "")}` +
    '" ' +
    `${extra}` +
    "></label>";
  // R59: several sections → a select of exactly those sections with no default; the different-charge path stays secondary.
  const chargeSelect = (i, c, readonly) => {
    const choices = chargeChoices(i),
      chosen = canonicalOrdinance(c.ord) || String(c.ord || "").trim(),
      listed = choices.some((x) => x.value === chosen);
    return (
      '<label class="f"><span>Ordinance</span><select data-review-cit="' +
      esc(i.id) +
      '|ord" aria-label="Ordinance for item ' +
      esc(i.no) +
      '" ' +
      (readonly ? "disabled" : "") +
      '><option value="">Choose the charged ordinance</option>' +
      choices
        .map((x) => '<option value="' + esc(x.value) + '" ' + (listed && x.value === chosen ? "selected" : "") + ">" + esc(x.label) + "</option>")
        .join("") +
      "</select></label>" +
      field(
        i,
        { ordOther: listed ? "" : c.ord || "" },
        "ordOther",
        "Different charge — ordinance outside the item’s sections",
        "text",
        readonly ? "readonly" : "",
      )
    );
  };
  const detail = (key, label, body, open = false) =>
    '<details data-review-details="' +
    `${key}` +
    '" ' +
    `${open ? "open" : ""}` +
    "><summary>" +
    `${label}` +
    '</summary><div class="charge-detail-body">' +
    `${body}` +
    "</div></details>";
  const cards = d.items
    .filter((i) => i.cite && !i.withdrawn)
    .map((i) => {
      const request = d.depositRequests?.[i.id],
        c = d.cits?.[i.id] || request;
      if (!c) return "";
      const mode = c.depositMode || "schedule",
        fault = request ? request.reason : citationDepositFault(c, d, i),
        determined = !request && citationPricing.determined(d, i, c);
      const held = !!c.mandatoryAppearance,
        status = request ? "Completion required" : held ? "Wording approval required" : fault ? "Review required" : "Deposit ready";
      const result = request ? "Deposit incomplete" : held ? "Mandatory appearance" : formatDeposit(c.amount);
      const summary =
        '<div class="charge-overview"><div><span class="charge-ordinance">' +
        `${esc(c.ord || "Choose an ordinance")}` +
        '</span><p class="charge-description">' +
        `${esc(c.desc || i.title || "Citation")}` +
        '</p><span class="hint">' +
        `${esc(c.num || "Citation number pending")}` +
        " · " +
        `${esc(c.tier || "1st")}` +
        ' offense</span></div><div class="charge-result"><strong>' +
        `${esc(result)}` +
        "</strong><span>" +
        `${esc(status)}` +
        '</span></div><div class="charge-session"><span class="hint">Court sessio' +
        "n</span><strong>" +
        `${esc(c.courtDate ? fmtDate(c.courtDate) : "Date required")}` +
        " · " +
        `${esc(c.courtTime || "Time required")}` +
        '</strong><span class="hint">Suggested session; confirm the court-approve' +
        "d schedule.</span></div></div>";
      let body = "";
      if (request) {
        body = depositStep.form(d, i, request);
      } else {
        const entries = CITATION_POLICY.entries.filter((e) => e.ordinance === canonicalOrdinance(c.ord));
        const chargeFields =
          "" +
          "".concat(
            choosesCharge(i)
              ? '<p class="hint">Item sections: ' +
                  esc(i.sections.join(", ")) +
                  ". Choose the one ordinance charged; a charge outside these sections needs its approved source.</p>"
              : "",
          ) +
          '<div class="grid g2">' +
          `${choosesCharge(i) ? chargeSelect(i, c, snow.is(d)) : field(i, c, "ord", "Ordinance", "text", snow.is(d) ? "readonly" : "")}` +
          "" +
          `${field(i, c, "differentChargeSource", "Different charge — approved source / confirmation")}` +
          "" +
          "".concat(
            entries.length > 1
              ? '<label class="f"><span>Scheduled offense</span><select data-review-cit="' +
                  `${esc(i.id)}` +
                  '|scheduleEntryId" aria-label="Scheduled offense for item ' +
                  `${esc(i.no)}` +
                  '"><option value="">Choose the charged offense</option>' +
                  "".concat(
                    entries
                      .map((e) => `<option value="${esc(e.id)}" ${c.scheduleEntryId === e.id ? "selected" : ""}>${esc(e.description)}</option>`)
                      .join(""),
                  ) +
                  "</select></label>"
              : "",
          ) +
          "" +
          `${field(i, c, "desc", "Violation description")}` +
          "" +
          `${field(i, c, "num", "Citation number", "text", d.correction ? "readonly" : "")}` +
          "" +
          "".concat(field(i, c, "comment", "Violation comment / inspection history", "text", snow.is(d) ? "readonly" : "")) +
          "" +
          `${field(i, c, "statute", "Adopted state statute (if applicable)")}` +
          "" +
          `${field(i, c, "deptId", "Officer ID")}` +
          "" +
          `${field(i, c, "courtDate", "Court date", "date")}` +
          "" +
          `${field(i, c, "courtTime", "Court time", "time")}` +
          "" +
          `${field(i, c, "issued", "Citation issue date", "date", 'max="' + recordDay(today) + '"')}` +
          "" +
          `${field(i, { ...c, violDate: c.violDate || inspAt(d).date }, "violDate", "Violation date", "date")}` +
          "" +
          `${field(i, { ...c, violTime: c.violTime || inspAt(d).time }, "violTime", "Violation time", "time")}` +
          '</div><p class="hint">Issue date must match the document’s mailed date' +
          `${d.correction ? " retained from the original action" : ""}` +
          ". Violation date records the inspection; court date follows issuance.</p" +
          ">";
        body += detail("charge", "Edit charge and dates", chargeFields);
        const pricing =
          '<p class="hint">' +
          "".concat(
            c.historicalDeposit
              ? "The original deposit is retained for this correction."
              : c.overrideBasis
                ? "This amount has a recorded administrator authorization."
                : determined
                  ? "The approved schedule determines this amount."
                  : "Use a court-approved amount and record its source.",
          ) +
          " " +
          `${mode === "total" ? "This total includes assessments; they are not added again." : ""}` +
          '</p><div class="grid g2"><label class="f"><span>Deposit method</span><se' +
          'lect data-review-cit="' +
          `${esc(i.id)}` +
          '|depositMode" aria-label="Deposit method for item ' +
          `${esc(i.no)}` +
          '" ' +
          `${c.overrideBasis ? "disabled" : ""}` +
          ">" +
          "".concat(
            [
              ["schedule", "Scheduled deposit"],
              ["base", "Approved base + assessments"],
              ["total", "Approved total (assessments included)"],
            ]
              .map(
                ([v, l]) => `<option value="${v}" ${mode === v ? "selected" : ""} ${determined && v !== "schedule" ? "disabled" : ""}>${l}</option>`,
              )
              .join(""),
          ) +
          "</select></label>" +
          "".concat(
            mode === "total"
              ? field(i, c, "amount", "Approved total", "number", 'min="0.01" step="0.01" ' + (determined ? "readonly" : ""))
              : field(i, c, "base", "Base deposit", "number", 'min="0" step="0.01" ' + (mode === "schedule" || determined ? "readonly" : "")) +
                  field(
                    i,
                    c,
                    "cc",
                    "Court costs",
                    "number",
                    'min="15" max="48" step="0.01" ' + (mode === "schedule" || determined ? "readonly" : ""),
                  ),
          ) +
          "" +
          "".concat(
            mode === "schedule"
              ? field(i, c, "tier", "Computed offense tier", "text", "readonly") +
                  field(i, c, "tierOverride", "Approved tier override", "number", 'min="1" step="1"') +
                  field(i, c, "tierOverrideSource", "Tier override — approved source")
              : '<label class="f"><span>Offense tier</span><select data-review-cit="' +
                  `${esc(i.id)}` +
                  '|tier" aria-label="Offense tier for item ' +
                  `${esc(i.no)}` +
                  '">' +
                  "".concat(["1st", "2nd", "3rd+"].map((t) => `<option value="${t}" ${c.tier === t ? "selected" : ""}>${t}</option>`).join("")) +
                  "</select></label>" +
                  field(i, c, "depositSource", "Approved source / reason"),
          ) +
          "</div>" +
          "".concat(
            c.reconfirmDeposit
              ? '<button class="btn" data-confirm-deposit="' + esc(d.id) + "|" + esc(i.id) + '">Confirm current approved deposit</button>'
              : "",
          ) +
          '<p class="hint" data-deposit-schedule="' +
          `${esc(i.id)}` +
          '">' +
          `${esc(citationPricing.hint(d, i, c))}` +
          "</p>" +
          "".concat(
            c.measurements
              ? '<dl class="charge-factors">' +
                  Object.entries(c.measurements)
                    .map(
                      ([key, value]) =>
                        "<div><dt>" +
                        esc(
                          {
                            area: "Building area (square feet)",
                            days: "Days of noncompliance",
                            diameter: "Tree diameter (inches)",
                            removed: "Tree removed",
                          }[key] || key,
                        ) +
                        "</dt><dd>" +
                        esc(value === true ? "Yes" : value === false ? "No" : value) +
                        "</dd></div>",
                    )
                    .join("") +
                  "</dl>"
              : "",
          ) +
          '<p class="hint" data-deposit-breakdown="' +
          `${esc(i.id)}` +
          '">' +
          "".concat(
            mode !== "total" && validMoney(c.base)
              ? feeLines(c.base, c.cc, c.pricedOn || c.issued)
                  .rows.map((row) => esc(row.k) + ": $" + money(row.v))
                  .join(" · ")
              : "",
          ) +
          "</p>";
        body += detail("pricing", "Pricing details and authorization", pricing, !!fault && !held);
      }
      return (
        '<fieldset class="citation-editor charge-card" data-charge="' +
        `${esc(i.id)}` +
        '" ' +
        `${request ? 'data-deposit-request="' + esc(i.id) + '"' : ""}` +
        "><legend>Item " +
        `${esc(i.no)}` +
        " · " +
        `${esc(i.title || "Citation")}` +
        "</legend>" +
        `${summary}` +
        "" +
        "".concat(
          held
            ? '<p class="banner alert charge-hold">Issuance on hold. Division-approved ' +
                "defendant instructions are required. Save this draft and request wording" +
                " approval.</p>"
            : "",
        ) +
        "" +
        "".concat(
          !request
            ? '<p class="deposit-summary ' +
                `${fault ? "charge-fault" : ""}` +
                '" data-deposit-summary="' +
                `${esc(i.id)}` +
                '">' +
                "".concat(
                  esc(held ? "Mandatory appearance · wording approval required" : fault || "Total cash deposit: " + formatDeposit(c.amount)),
                ) +
                "</p>"
            : "",
        ) +
        "" +
        `${body}` +
        "</fieldset>"
      );
    })
    .join("");
  return (
    '<section class="card no-print authoring-panel" id="citation-review"><div' +
    ' class="card-h"><h2>' +
    `${d.initialPreview ? "Initial-inspection citations · complete before issuance" : "Citation review"}` +
    '</h2><div><button class="btn btn-sm" data-refresh-citation-history>Refre' +
    'sh citation history</button> <button class="btn btn-sm" id="btn-savework' +
    '">Save draft &amp; return to Workspace</button></div></div><div class="card-b"><p c' +
    'lass="hint">Review each charge, deposit and court session. ' +
    "".concat(d.initialPreview ? "All selected citations and the inspection are saved together after every check passes." : "") +
    " Each completed charge produces four matching court copies. Expand a cha" +
    "rge to edit its facts or inspect its pricing basis.</p>" +
    `${cards}` +
    "</div></section>"
  );
}

function activeDueTarget() {
  const visit = WriterState.state.screen === "reinspect",
    target = visit ? reinsp(WriterState.state.reinspId) : doc(WriterState.state.docId);
  return { target, visit };
}

export {
  planBulkDue,
  showBulkDue,
  workspaceTasks,
  markWriterReady,
  markWriterFailed,
  writerOpenReportedCase,
  initWriterHandoff,
  initialCitationBody,
  updateDueIndicators,
  toggleLibraryItem,
  dueDateSpacingConflicts,
  dueContext,
  duePanel,
  dueSelectedText,
  assignDue,
  citationDepositFault,
  editCitation,
  commitCitationEdits,
  authoringChecks,
  citationReview,
  activeDueTarget,
};
