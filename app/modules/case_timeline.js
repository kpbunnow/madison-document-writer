import { caseNumberKey as dep_caseNumberKey, recordDay as dep_recordDay } from "../assets/shared.js";
import {
  applyDeposit as dep_applyDeposit,
  feeLines as dep_feeLines,
  fmtDate as dep_fmtDate,
  inspAt as dep_inspAt,
  parseDate as dep_parseDate,
  parseTime as dep_parseTime,
  toast as dep_toast,
  validISO as dep_validISO,
} from "./court_and_deposits.js";
import {
  caseFileFault as dep_caseFileFault,
  helperJSON as dep_helperJSON,
  loadCaseFile as dep_loadCaseFile,
  sourceDocFor as dep_sourceDocFor,
  stableJSON as dep_stableJSON,
} from "./workspace_shell.js";
import { caseState as dep_caseState } from "./reinspection_walkthrough.js";
import { hasSetupWork as dep_hasSetupWork } from "./issuance_and_corrections.js";
import { preflightCase as dep_preflightCase } from "./language_catalog.js";
import { render as dep_render } from "./inspection_import.js";
import {
  A11Y as dep_A11Y,
  CITFEES as dep_CITFEES,
  DOCBODY as dep_DOCBODY,
  DOC_TYPES as dep_DOC_TYPES,
  HANDOFF_CHANNEL as dep_HANDOFF_CHANNEL,
  MINDUE as dep_MINDUE,
  WRITER_READY_WAIT as dep_WRITER_READY_WAIT,
  addDays as dep_addDays,
  administration as dep_administration,
  checkAttr as dep_checkAttr,
  checkTarget as dep_checkTarget,
  citSelector as dep_citSelector,
  citationPricing as dep_citationPricing,
  citationPricingDate as dep_citationPricingDate,
  clone as dep_clone,
  correctionSource as dep_correctionSource,
  countBlanks as dep_countBlanks,
  daysBetween as dep_daysBetween,
  deliveredByCitation as dep_deliveredByCitation,
  depositStep as dep_depositStep,
  distinctDues as dep_distinctDues,
  doc as dep_doc,
  docCase as dep_docCase,
  docsFor as dep_docsFor,
  dueItems as dep_dueItems,
  effectiveFiled as dep_effectiveFiled,
  esc as dep_esc,
  eventsFor as dep_eventsFor,
  initialCitations as dep_initialCitations,
  initialOrderCitation as dep_initialOrderCitation,
  isLocked as dep_isLocked,
  itemLibraryKey as dep_itemLibraryKey,
  itemSelector as dep_itemSelector,
  kase as dep_kase,
  libraryKey as dep_libraryKey,
  money as dep_money,
  navigation as dep_navigation,
  reinsp as dep_reinsp,
  reinspFor as dep_reinspFor,
  snow as dep_snow,
  structEditable as dep_structEditable,
  uid as dep_uid,
  unchangedCorrectionValue as dep_unchangedCorrectionValue,
  validMoney as dep_validMoney,
} from "./app_core.js";
import {
  CITATION_POLICY as dep_CITATION_POLICY,
  canonicalOrdinance as dep_canonicalOrdinance,
  cents as dep_cents,
  courtCents as dep_courtCents,
  formatDeposit as dep_formatDeposit,
  policyAt as dep_policyAt,
  resolveCitationAmount as dep_resolveCitationAmount,
  resolveOrdinance as dep_resolveOrdinance,
  respondentKey as dep_respondentKey,
  tierLabel as dep_tierLabel,
  tierOrdinal as dep_tierOrdinal,
} from "./citation_policy.js";
import { LIBRARY as dep_LIBRARY } from "./data/library.js";
import { WriterState } from "./state.js";
import { authFetch } from "./helper_transport.js";
/* app functions; direct dependencies use explicit shared state. */

function remindersDue() {
  const prefs = WriterState.WORKFLOW_PREFS.reminders,
    day = dep_recordDay(today),
    end = dep_addDays(day, prefs.days);
  if (!prefs.enabled) return [];
  const rows = [];
  for (const k of WriterState.CASES) {
    const st = dep_caseState(k);
    if (st.closed || !dep_sourceDocFor(k.id)) continue;
    const dates = dep_distinctDues(dep_dueItems(dep_sourceDocFor(k.id)));
    for (const date of dates) if (date >= day && date <= end) rows.push({ cid: k.id, kind: "Compliance due", date });
    const plan = prefs.plans[k.id];
    if (plan && plan >= day && plan <= end) rows.push({ cid: k.id, kind: "Reinspection planned", date: plan });
  }
  return rows.map((row) => ({ ...row, id: [day, row.cid, row.kind, row.date].join("|") })).filter((row) => !prefs.dismissed.includes(row.id));
}

function remindersPanel() {
  const rows = remindersDue();
  return !rows.length
    ? ""
    : '<section class="card" aria-labelledby="reminders-title"><h2 id="reminder' +
        's-title">Upcoming reminders</h2><ul>' +
        "".concat(
          rows
            .map(
              (row) =>
                "<li>" +
                `${dep_esc(dep_kase(row.cid).number)}` +
                " · " +
                `${dep_esc(row.kind)}` +
                " · " +
                `${dep_fmtDate(row.date)}` +
                ' <button class="btn btn-sm" data-reminder-draft="' +
                `${dep_esc(row.id)}` +
                '">Email draft</button> <button class="btn btn-sm" data-reminder-dismiss=' +
                '"' +
                `${dep_esc(row.id)}` +
                '">Dismiss for today</button></li>',
            )
            .join(""),
        ) +
        "</ul></section>";
}

function showReminders() {
  dep_navigation.utilityContext();
  const prefs = WriterState.WORKFLOW_PREFS.reminders;
  dep_A11Y.utility(
    "Optional reminders",
    "<p>Reminders appear when you open this workspace. Email drafts open only" +
      ' when requested, for you to review and send.</p><form id="reminder-setti' +
      'ngs"><label><input name="enabled" type="checkbox" ' +
      `${prefs.enabled ? "checked" : ""}` +
      "> Show upcoming due dates and planned reinspections</label><label>Days a" +
      'head <input name="days" type="number" min="1" max="30" value="' +
      `${prefs.days}` +
      '" required></label><table><caption>Personal reinspection plans in this b' +
      'rowser profile</caption><thead><tr><th scope="col">Case</th><th scope="c' +
      'ol">Planned date</th></tr></thead><tbody>' +
      "".concat(
        WriterState.CASES.filter((k) => !dep_caseState(k).closed)
          .map(
            (k) =>
              '<tr><th scope="row">' +
              `${dep_esc(k.number)}` +
              '</th><td><input type="date" name="plan:' +
              `${dep_esc(k.id)}` +
              '" aria-label="Planned reinspection for ' +
              `${dep_esc(k.number)}` +
              '" value="' +
              `${dep_esc(prefs.plans[k.id] || "")}` +
              '"></td></tr>',
          )
          .join(""),
      ) +
      '</tbody></table><button class="btn" type="submit">Save reminder preferen' +
      "ces</button></form>",
  );
}

function showReminderDraft(id) {
  dep_navigation.utilityContext();
  const row = remindersDue().find((r) => r.id === id);
  if (!row) return;
  const k = dep_kase(row.cid),
    subject = row.kind + " — " + k.number,
    body =
      "Case " +
      k.number +
      "\nProperty: " +
      k.address +
      "\n" +
      row.kind +
      ": " +
      dep_fmtDate(row.date) +
      "\n\nPlease contact Building Inspection with any questions.";
  dep_A11Y.utility(
    "Review reminder email draft",
    '<form id="reminder-email"><label>Recipient <input type="email" name="to"' +
      ' required list="reminder-recipients" value="' +
      `${dep_esc(k.emails?.[0]?.addr || "")}` +
      '"><datalist id="reminder-recipients">' +
      `${(k.emails || []).map((e) => `<option value="${dep_esc(e.addr)}">`).join("")}` +
      '</datalist></label><label>Subject <input name="subject" maxlength="200" ' +
      'required value="' +
      `${dep_esc(subject)}` +
      '"></label><label>Message <textarea name="body" required maxlength="12000' +
      '" rows="8">' +
      `${dep_esc(body)}` +
      '</textarea></label><button class="btn" type="submit">Open Outlook draft<' +
      "/button></form>",
  );
}

function timelineCategory(type) {
  return type.endsWith(".issued")
    ? type === "correction.issued"
      ? "corrected"
      : "issued"
    : type.includes("withdraw")
      ? "withdrawn"
      : type.includes("filed")
        ? "filed"
        : type.includes("record")
          ? "recorded"
          : "other";
}

function timelineRows() {
  return dep_eventsFor(WriterState.TIMELINE_CASE)
    .filter((e) => WriterState.TIMELINE_FILTER === "all" || timelineCategory(e.type) === WriterState.TIMELINE_FILTER)
    .slice()
    .sort((a, b) => String(a.at).localeCompare(String(b.at)) || a.id.localeCompare(b.id));
}

function showTimeline(cid, filter = WriterState.TIMELINE_FILTER) {
  dep_navigation.utilityContext();
  WriterState.TIMELINE_CASE = cid;
  WriterState.TIMELINE_FILTER = filter;
  const rows = timelineRows(),
    k = dep_kase(cid);
  dep_A11Y.utility(
    "Case timeline — " + k.number,
    '<label>Event filter <select id="timeline-filter">' +
      "".concat(
        ["all", "issued", "corrected", "withdrawn", "filed", "recorded", "other"]
          .map((value) => `<option value="${value}" ${value === filter ? "selected" : ""}>${value}</option>`)
          .join(""),
      ) +
      '</select></label><button class="btn" data-timeline-csv>Export filtered C' +
      'SV</button> <button class="btn" data-timeline-json>Export full event log' +
      "</button><table><caption>Read-only case event log</caption><thead><tr><t" +
      'h scope="col">Time (Chicago)</th><th scope="col">Event</th><th scope="co' +
      'l">Recorded by</th><th scope="col">Details</th></tr></thead><tbody>' +
      "".concat(
        rows
          .map(
            (e) =>
              '<tr><th scope="row">' +
              `${dep_esc(new Date(e.at).toLocaleString("en-US", { timeZone: "America/Chicago" }))}` +
              "</th><td>" +
              `${dep_esc(e.type)}` +
              "</td><td>" +
              `${dep_esc(e.by || e.payload?.snapshot?.frozen?.inspector?.name || "")}` +
              "</td><td>" +
              "".concat(dep_esc(e.payload?.reason || e.payload?.snapshot?.revision?.reason || e.payload?.snapshot?.type || e.payload?.docId || "")) +
              "</td></tr>",
          )
          .join("") || '<tr><td colspan="4">No matching events.</td></tr>',
      ) +
      "</tbody></table>",
  );
}

function planBulkDue(changes, value) {
  if (!dep_validISO(value) || value < dep_MINDUE()) throw new Error("Choose a future due date");
  if (!changes.length) throw new Error("Select at least one outstanding draft item");
  const copies = new Map();
  for (const change of changes) {
    const current = dep_doc(change.docId);
    if (!current || !dep_structEditable(current) || current.pendingAmendment)
      throw new Error("Only new, editable notice drafts can receive batch deadlines");
    if (!copies.has(current.id)) copies.set(current.id, dep_clone(current));
    const copy = copies.get(current.id),
      item = dep_dueItems(copy).find((i) => i.id === change.itemId);
    if (!item) throw new Error("Selected item is not outstanding");
    item.due = value;
  }
  for (const copy of copies.values()) {
    if (dep_distinctDues(dep_dueItems(copy)).length > 3) throw new Error("That would create more than three deadlines");
    if (dueDateSpacingConflicts(dep_dueItems(copy)).length) throw new Error("Keep deadlines at least seven days apart");
  }
  return copies;
}

function showBulkDue() {
  dep_navigation.utilityContext();
  dep_A11Y.utility(
    "Batch draft due dates",
    "<p>Updates apply only to selected outstanding items in new editable noti" +
      "ce drafts. All selected drafts are validated together before saving.</p>" +
      '<form id="batch-due-form"><label>New due date <input type="date" name="d' +
      'ue" min="' +
      `${dep_MINDUE()}` +
      '" required></label>' +
      "".concat(
        WriterState.DOCS.filter((d) => dep_structEditable(d) && !d.pendingAmendment)
          .map(
            (d) =>
              "<fieldset><legend>" +
              `${dep_esc(dep_kase(d.caseId).number)}` +
              "</legend>" +
              "".concat(
                dep_dueItems(d)
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

async function showOutbox() {
  const context = dep_navigation.utilityContext(),
    result = await dep_helperJSON("/outbox/list");
  if (!dep_navigation.utilityCurrent(context)) return false;
  WriterState.OUTBOX_FILES = result.files;
  if (WriterState.HELPER) WriterState.HELPER.outbox = result.files.length;
  dep_A11Y.utility(
    "PDF outbox",
    "<p>Select existing PDFs to file or open for printing. Conflicting shared" +
      " copies stay in the outbox for review. Transferring or printing does not" +
      ' confirm mailing, email delivery or Accela recording.</p><button class="' +
      'btn" data-sync-safety>Back to saved work &amp; connection</button><form ' +
      'id="outbox-form"><table><caption>Local PDFs awaiting shared filing</capt' +
      'ion><thead><tr><th scope="col">Select</th><th scope="col">PDF</th><th sc' +
      'ope="col">Bytes</th></tr></thead><tbody>' +
      "".concat(
        WriterState.OUTBOX_FILES.map(
          (file, n) =>
            '<tr><td><input type="checkbox" name="pdf" value="' +
            `${n}` +
            '" aria-label="Select ' +
            `${dep_esc(file.name)}` +
            '"></td><th scope="row">' +
            `${dep_esc(file.name)}` +
            "</th><td>" +
            `${file.size}` +
            "</td></tr>",
        ).join("") || '<tr><td colspan="3">No local outbox PDFs.</td></tr>',
      ) +
      '</tbody></table><button class="btn" type="submit">Transfer selected PDFs' +
      '</button> <button class="btn" type="button" data-outbox-print>Print sele' +
      "cted PDFs</button></form>",
  );
}

function selectedOutbox() {
  const form = document.getElementById("outbox-form");
  return [...form.querySelectorAll("[name=pdf]:checked")]
    .map((el) => WriterState.OUTBOX_FILES[Number(el.value)])
    .filter(Boolean)
    .map(({ name, sha256 }) => ({ name, sha256 }));
}

async function printOutbox() {
  const items = selectedOutbox();
  if (!items.length || items.length > 20) throw new Error("Select 1–20 PDFs to print");
  const viewers = items.map(() => window.open("about:blank", "_blank"));
  for (let n = 0; n < items.length; n++) {
    const item = items[n];
    try {
      const response = await authFetch("/outbox/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (!response.ok) throw new Error((await response.json()).error || "Could not read PDF");
      const blob = await response.blob(),
        url = URL.createObjectURL(blob),
        viewer = viewers[n];
      if (viewer) {
        viewer.addEventListener(
          "load",
          () => {
            setTimeout(() => {
              try {
                if (!viewer.closed) {
                  viewer.focus();
                  viewer.print();
                }
              } catch (error) {
                dep_toast("Use the opened PDF viewer’s Print control.", { severity: "warning" });
              }
            }, 1200);
          },
          { once: true },
        );
        viewer.location.href = url;
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = item.name;
        link.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch (error) {
      viewers[n]?.close();
      throw error;
    }
  }
  dep_toast("Opened selected PDF copies. Use each PDF viewer’s Print control.", { severity: "success" });
}

async function refreshArtifactLocations() {
  const token = ++WriterState.ARTIFACT_SEQ;
  const items = WriterState.DOCS.filter((d) => !d.draft && d.filedArtifact?.filename && d.filedArtifact?.sha256).map((d) => ({
    filename: d.filedArtifact.filename,
    sha256: d.filedArtifact.sha256,
    docId: d.id,
  }));
  const ids = Object.fromEntries(items.map((x) => [x.docId, x.filename + "|" + x.sha256]));
  for (const id of Object.keys(WriterState.ARTIFACT_LOCATIONS))
    if (ids[id] !== WriterState.ARTIFACT_IDENTITY[id]) delete WriterState.ARTIFACT_LOCATIONS[id];
  WriterState.ARTIFACT_IDENTITY = ids;
  if (!WriterState.HELPER) {
    for (const x of items) WriterState.ARTIFACT_VERIFY[x.docId] = "unavailable";
    if (WriterState.state.screen === "cases") dep_render();
    return;
  }

  const batches = [];
  for (let i = 0; i < items.length; i += 100) batches.push(items.slice(i, i + 100));
  const next = { ...WriterState.ARTIFACT_LOCATIONS },
    status = {};
  for (const id of Object.keys(next)) if (!ids[id]) delete next[id];
  async function check(group) {
    try {
      const result = await dep_helperJSON("/artifact/status", { items: group });
      const wanted = new Map(group.map((x) => [x.docId, x]));
      for (const row of result.items || []) {
        const source = wanted.get(row.docId);
        if (!source || !Array.isArray(row.locations) || (row.sha256 && row.sha256 !== source.sha256)) continue;
        next[row.docId] = row.locations;
        status[row.docId] = "verified";
      }
      for (const x of group) if (!status[x.docId]) status[x.docId] = "incomplete";
    } catch (e) {
      if (group.length > 1 && /invalid|limit|checksum|filename|item/i.test(e.message || "")) {
        const middle = Math.floor(group.length / 2);
        await check(group.slice(0, middle));
        await check(group.slice(middle));
      } else
        for (const x of group) status[x.docId] = group.length === 1 && /invalid|checksum|filename/i.test(e.message || "") ? "invalid" : "unavailable";
    }
  }
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, batches.length) }, async () => {
      while (cursor < batches.length) {
        const batch = batches[cursor++];
        await check(batch);
      }
    }),
  );
  if (token !== WriterState.ARTIFACT_SEQ) return;
  for (const x of items) {
    const current = WriterState.DOCS.find((d) => d.id === x.docId)?.filedArtifact;
    if (!current || current.filename + "|" + current.sha256 !== ids[x.docId]) {
      delete next[x.docId];
      status[x.docId] = "incomplete";
      delete WriterState.ARTIFACT_IDENTITY[x.docId];
    }
  }
  WriterState.ARTIFACT_LOCATIONS = next;
  WriterState.ARTIFACT_VERIFY = status;
  if (WriterState.state.screen === "cases") dep_render();
}

function pdfTransferState(d) {
  if (dep_deliveredByCitation(d)) return "included in citation PDF";
  if (!dep_effectiveFiled(d)) return "unfiled";
  if (!d.filedArtifact) return "historical / location unverified";
  if (WriterState.ARTIFACT_IDENTITY[d.id] && WriterState.ARTIFACT_IDENTITY[d.id] !== d.filedArtifact.filename + "|" + d.filedArtifact.sha256)
    return "location unverified";
  if (WriterState.ARTIFACT_VERIFY[d.id] === "invalid") return "invalid artifact identity";
  if (WriterState.ARTIFACT_VERIFY[d.id] === "unavailable" || WriterState.ARTIFACT_VERIFY[d.id] === "incomplete")
    return WriterState.ARTIFACT_LOCATIONS[d.id] ? "last verified location; refresh unavailable" : "location verification unavailable";
  const places = WriterState.ARTIFACT_LOCATIONS[d.id];
  if (!places) return "location unverified";
  if (places.some((x) => x.includes("conflict"))) return "artifact conflict";
  if (places.includes("shared")) return "shared";
  if (places.includes("local")) return "local outbox";
  return "missing or unavailable";
}

function depositComplete(d) {
  return (
    !Object.keys(d.depositRequests || {}).length &&
    (d.items || []).filter((i) => i.cite && !i.withdrawn).every((i) => !citationDepositFault(d.cits?.[i.id] || {}, d, i))
  );
}
function independentArtifact(d) {
  return !d.draft && !d.void && !d.superseded && !dep_deliveredByCitation(d);
}

function workspaceTasks(rows) {
  const task = (key, label, unit, items) => ({ key, label, unit, items, count: items.length });
  const caseTask = (x, text, action) => ({ cid: x.k.id, label: x.k.number + " · " + x.k.address + " · " + text, action });
  const open = rows.filter((x) => !x.st.closed),
    drafts = rows.filter((x) => x.st.draft || x.st.visit);
  const needsDeposit = rows.flatMap((x) =>
    dep_docsFor(x.k.id)
      .filter((d) => d.draft && !depositComplete(d))
      .map((d) => caseTask(x, "Citation needs deposit", `data-open="${dep_esc(d.id)}"`)),
  );
  const pendingDocs = rows.flatMap((x) =>
    dep_docsFor(x.k.id)
      .filter((d) => d.pendingAmendment)
      .map((d) => caseTask(x, "Document save confirmation", `data-open="${dep_esc(d.id)}"`)),
  );
  const pendingRecords = rows.flatMap((x) =>
    Object.entries(WriterState.RECORD_ATTEMPTS)
      .filter(([, a]) => a.cid === x.k.id)
      .map(([id]) => caseTask(x, "Record save confirmation", `data-resumerecord="${dep_esc(id)}"`)),
  );
  const unfiled = rows.flatMap((x) =>
    dep_docsFor(x.k.id)
      .filter((d) => independentArtifact(d) && !dep_effectiveFiled(d))
      .map((d) =>
        caseTask(x, "File " + ((dep_DOC_TYPES.find((t) => t.id === d.type) || {}).label || d.type) + " PDF", `data-open="${dep_esc(d.id)}"`),
      ),
  );
  const local = rows.flatMap((x) =>
    dep_docsFor(x.k.id)
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
            ((dep_DOC_TYPES.find((t) => t.id === d.type) || {}).label || d.type) +
            " PDF" +
            (WriterState.ARTIFACT_VERIFY[d.id] === "unavailable" ? " (last verified; refresh unavailable)" : ""),
          `data-outbox`,
        ),
      ),
  );
  const issues = rows.flatMap((x) =>
    dep_docsFor(x.k.id)
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
          "Check " + ((dep_DOC_TYPES.find((t) => t.id === d.type) || {}).label || d.type) + " PDF · " + pdfTransferState(d),
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
      open.map((x) => caseTask(x, x.st.due ? "Next due " + dep_fmtDate(x.st.due) : "No applicable deadline", `data-case-task="${dep_esc(x.k.id)}"`)),
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
      rows.filter((x) => x.st.late).map((x) => caseTask(x, "Due " + dep_fmtDate(x.st.due), `data-reinsp="${dep_esc(x.k.id)}"`)),
    ),
    task(
      "soon",
      "Due within 7 days",
      "cases",
      rows.filter((x) => x.st.soon).map((x) => caseTask(x, "Due " + dep_fmtDate(x.st.due), `data-reinsp="${dep_esc(x.k.id)}"`)),
    ),
    task(
      "imports",
      "Imports to review",
      "imports",
      dep_hasSetupWork() ? [{ cid: "", label: "Saved import or case lookup", action: 'data-nav="import"' }] : [],
    ),
    task("confirm", "Save confirmations", "operations", pendingRecords.concat(pendingDocs)),
    task(
      "pending",
      "Case files to sync",
      "operations",
      WriterState.PENDING.map((p) => ({
        cid: p.cid,
        label: (dep_kase(p.cid).number || p.name) + " · held case file from " + p.at,
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
  WriterState.releaseWriterReady();
}

async function writerOpenReportedCase(message) {
  if (!WriterState.WRITER_ACCESS) throw new Error("Another Writer tab owns this workspace");
  if (!WriterState.WRITER_READY) await dep_WRITER_READY_WAIT;
  const number = String(message.number || "");
  if (!dep_caseNumberKey(number)) throw new Error("Invalid case number");
  const request = ++WriterState.HANDOFF_SEQ;
  const existing = WriterState.CASES.find((k) => dep_caseNumberKey(k.number) === dep_caseNumberKey(number));
  if (existing) {
    await dep_preflightCase(existing.id, "report handoff", () => {
      WriterState.state.metric = "";
      WriterState.state.caseQ = number;
      WriterState.state.caseFilter = "all";
      WriterState.state.screen = "cases";
      dep_render();
    });
    if (request !== WriterState.HANDOFF_SEQ) throw new Error("A newer case request replaced this one");
    WriterState.REPORT_RETURN = true;
    dep_render();
    window.focus?.();
    return "Local work was kept; review the case or reconciliation panel in Writer.";
  }
  let opened;
  try {
    opened = await dep_helperJSON("/cases/resolve?number=" + encodeURIComponent(number));
  } catch (error) {
    if (error.name === "NotFoundError") throw new Error("No shared case exists for " + number + ".");
    throw error;
  }
  if (request !== WriterState.HANDOFF_SEQ) throw new Error("A newer case request replaced this one");
  const file = opened.file;
  if (dep_caseNumberKey(file.case?.number) !== dep_caseNumberKey(number) || dep_caseFileFault(file))
    throw new Error("The current shared file is invalid or belongs to a different case");
  if (!dep_loadCaseFile(JSON.stringify(file))) throw new Error("The shared case could not be loaded");
  WriterState.REPORT_RETURN = true;
  WriterState.state.metric = "";
  WriterState.state.caseQ = number;
  WriterState.state.caseFilter = "all";
  dep_render();
  window.focus?.();
  const count = Number(message.eventCount);
  if (Number.isFinite(count) && count !== (file.events || []).length) {
    WriterState.PREFLIGHT_NOTICE =
      "The shared case changed since this report was indexed. Writer opened the" +
      " current validated case; refresh Reports before relying on its totals.";
    dep_render();
  }
  return "Current shared case opened in Writer.";
}

function initWriterHandoff() {
  if ("BroadcastChannel" in window) {
    WriterState.WRITER_CHANNEL = new BroadcastChannel(dep_HANDOFF_CHANNEL);
    WriterState.WRITER_CHANNEL.onmessage = async (e) => {
      const m = e.data;
      if (m?.kind === "return-ack") {
        WriterState.RETURN_ACK = m.request;
        return;
      }
      if (m?.kind !== "open" || !m.request) return;
      WriterState.WRITER_CHANNEL.postMessage({ kind: "accepted", request: m.request });
      try {
        const detail = await writerOpenReportedCase(m);
        WriterState.WRITER_CHANNEL.postMessage({ kind: "result", request: m.request, ok: true, detail });
      } catch (err) {
        WriterState.WRITER_CHANNEL.postMessage({ kind: "result", request: m.request, ok: false, error: err.message });
      }
    };
  }
  const number = new URLSearchParams(globalThis.location?.search || "").get("case");
  if (number)
    writerOpenReportedCase({ number }).catch((e) => {
      WriterState.PREFLIGHT_NOTICE = "Report handoff could not open the case: " + e.message;
      dep_render();
    });
}

function initialCitationBody(d) {
  // R35: an initial-inspection citation replaces the Official Notice, so its letter carries the notice's order language.
  if (dep_initialOrderCitation(d)) return dep_DOCBODY.initialCitation;
  return dep_DOCBODY.citation
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
  if (count) count.textContent = dep_distinctDues(dep_dueItems(d)).length + " of 3 dates used";
  dep_dueItems(d).forEach((i) => {
    const label = document.querySelector('[data-due-label="' + i.id + '"]');
    if (label) label.textContent = i.due ? dep_fmtDate(i.due) : "Date needed";
  });
}

function toggleLibraryItem(d, ci, gi, src) {
  const lib = { c: dep_LIBRARY[ci].code, g: dep_LIBRARY[ci].groups[gi].code, o: src.o },
    key = dep_libraryKey(lib);
  d.selectionCache = d.selectionCache || {};
  const found = d.items.find((i) => dep_itemLibraryKey(i) === key);
  if (found) {
    d.selectionCache[key] = dep_clone(found);
    d.items = d.items.filter((i) => dep_itemLibraryKey(i) !== key);
    dep_snow.removed(d);
    return false;
  }
  if (!dep_snow.canAdd(d, key)) return false;
  const restored = d.selectionCache[key];
  delete d.selectionCache[key];
  d.items.push(
    restored || {
      id: dep_uid("x"),
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
  dep_snow.added(d, d.items[d.items.length - 1]);
  return true;
}

function dueDateSpacingConflicts(items) {
  const byDate = new Map();
  items.forEach((i) => {
    if (dep_validISO(i.due)) {
      if (!byDate.has(i.due)) byDate.set(i.due, []);
      byDate.get(i.due).push(i);
    }
  });
  const dates = [...byDate.keys()].sort(),
    conflicts = [];
  for (let ix = 1; ix < dates.length; ix++)
    if (dep_daysBetween(dates[ix - 1], dates[ix]) < 7)
      conflicts.push({ dates: [dates[ix - 1], dates[ix]], items: [...byDate.get(dates[ix - 1]), ...byDate.get(dates[ix])] });
  return conflicts;
}

function dueContext(target, visit) {
  if (visit) {
    const src = dep_doc(target.sourceDocId);
    return (src ? src.items : [])
      .filter((i) => !i.done && !i.withdrawn && target.results[i.id] && target.results[i.id].oc && target.results[i.id].oc !== "corrected")
      .map((i) => ({ id: i.id, no: i.no, title: i.title, due: target.results[i.id].due || "" }));
  }
  return dep_dueItems(target);
}

function duePanel(target, visit) {
  if (dep_snow.is(target)) return "";
  // R53: also on an open reinspection worksheet, for the items still outstanding.
  if (visit ? !target.draft || target.docId : dep_isLocked(target) || target.type !== "notice" || target.correction) return "";
  const items = dueContext(target, visit);
  if (!items.length) return "";
  const work = target.dueWork || {},
    selected = new Set(work.selected || []),
    dates = dep_distinctDues(items);
  return (
    '<section class="card no-print authoring-panel' +
    `${visit ? "" : " due-compact"}` +
    '" aria-label="Assign due dates"><div class="card-h"><h2>Assign due dates' +
    "</h2><span data-due-count>" +
    `${dates.length}` +
    ' of 3 dates used</span></div><div class="card-b"><p class="hint">Select ' +
    "items that share a deadline and apply a date. Up to three distinct deadl" +
    'ines are allowed.</p><div class="deadline-items">' +
    "".concat(
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
            `${i.due ? dep_esc(dep_fmtDate(i.due)) : "Date needed"}` +
            "</small></span></label>",
        )
        .join(""),
    ) +
    '</div><div class="editor-tools"><button class="btn btn-sm" data-due-all=' +
    '"1">Select all</button><button class="btn btn-sm" data-due-all="0">Clear' +
    ' selection</button><label for="bulk-due">Date for selected items</label>' +
    '<input type="date" id="bulk-due" value="' +
    `${dep_esc(work.date || "")}` +
    '" min="' +
    `${dep_MINDUE()}` +
    '"><button class="btn btn-primary" id="btn-bulkdue">Apply to selected</bu' +
    "tton></div></div></section>"
  );
}

function assignDue(target, visit, value, ids) {
  if (visit ? !target.draft || target.docId : target.type !== "notice" || target.correction)
    return "Assign due dates is available on a new Official Notice or an open reinspection worksheet.";
  const items = dueContext(target, visit),
    selected = new Set(ids || []);
  if (!items.some((i) => selected.has(i.id))) return "Select at least one outstanding item.";
  if (!dep_validISO(value) || value < dep_MINDUE()) return "Choose a future due date.";
  const proposed = items.map((i) => ({ ...i, due: selected.has(i.id) ? value : i.due }));
  if (dep_distinctDues(proposed).length > 3) return "That would create more than three due dates. Select a larger group or use an existing date.";
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

function scheduledEntry(hit) {
  return dep_resolveOrdinance(hit.ordinance || hit.o, "", hit.id);
}

function citationDepositFault(c, d = null, i = null) {
  if (!dep_canonicalOrdinance(c.ord)) return "Choose one complete citation ordinance.";
  if (c.issued && !dep_validISO(c.issued)) return "Enter a valid citation issue date.";
  if (c.pricedOn && !dep_validISO(c.pricedOn)) return "Enter a valid pricing date.";
  if (c.depositEditInvalid) return "Correct the deposit field before confirming.";
  if (c.reconfirmDeposit) return "Re-confirm deposit after the charge or basis changed.";
  if (dep_canonicalOrdinance(c.ord) === "27.05(2)(s)" && /noxious\s+weeds/i.test(c.desc || ""))
    return "27.05(2)(s) is Removal of Debris; it cannot print the stale weeds description.";
  const mode = c.depositMode || "schedule";
  if (!["schedule", "base", "total"].includes(mode)) return "Choose a deposit method.";
  if (mode !== "schedule" && String(c.depositSource || "").trim().length < 10)
    return "Record the approved schedule, court instruction or other authority (at least 10 characters).";
  if (c.mandatoryAppearance && d?.authoringVersion >= 8) {
    const f = dep_resolveOrdinance(c.ord, i ? dep_itemLibraryKey(i) : "", c.scheduleEntryId, c.pricedOn || c.issued);
    return f?.rule?.kind === "mandatory" && !c.amount ? "" : "Mandatory appearance permits no deposit.";
  }
  if (!dep_validMoney(c.amount) || +c.amount <= 0) return "Enter a positive cash deposit with at most two decimal places.";
  const original = d && i && dep_citationPricing.unchangedCorrection(d, i, c);
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
      ].every((k) => dep_stableJSON(original[k]) === dep_stableJSON(c[k]))
    )
      return "";
    return "An unchanged charge retains its original deposit and pricing basis.";
  }
  if (d?.authoringVersion >= 9 && c.overrideBasis) {
    const fault = dep_administration.overrideFault(c, d);
    if (fault) return fault;
  }
  if (
    d?.authoringVersion >= 8 &&
    mode !== "schedule" &&
    !c.overrideBasis &&
    dep_resolveCitationAmount({
      ordinance: c.ord,
      libraryItem: i ? dep_itemLibraryKey(i) : "",
      entryId: c.scheduleEntryId,
      tier: c.tier || 1,
      date: c.pricedOn || c.issued,
      measurements: c.measurements || {},
    }).kind === "priced"
  )
    return "This charge has a calculated deposit. Use Scheduled deposit.";
  if (d?.authoringVersion >= 7 && !dep_validISO(c.pricedOn)) return "Enter a valid pricing date.";
  if (!dep_validISO(c.pricedOn || c.issued)) return "Enter a valid pricing date.";
  if (d?.authoringVersion >= 8 && mode !== "total" && dep_cents(c.base) === 0 && !dep_CITATION_POLICY.allowZeroBaseDeposits)
    return "A zero forfeiture needs City Attorney approval";
  if (mode === "total")
    return c.assessments ? "An approved total must not retain a calculated assessment breakdown. Choose the deposit method again." : "";
  if (
    !dep_validMoney(c.base) ||
    !dep_validMoney(c.cc) ||
    +c.cc < dep_CITFEES.ccMin ||
    +c.cc > dep_policyAt(c.pricedOn || c.issued).fees.ccMaxCents / 100
  )
    return "Enter a valid base deposit and court costs between $15 and $48.";
  if (dep_money(dep_feeLines(c.base, c.cc, c.pricedOn || c.issued).total) !== dep_money(c.amount))
    return "The deposit does not match its recorded base and assessments.";
  if (mode === "schedule") {
    if (c.tierOverrideSource && String(c.tierOverrideSource).trim().length >= 10 && !/^[1-9]\d*$/.test(String(c.tierOverride || "")))
      return "An approved offense tier must be a positive whole number.";
    if ((c.tierOverride && !String(c.tierOverrideSource || "").trim()) || (c.tierOverrideSource && String(c.tierOverrideSource).trim().length < 10))
      return "An approved tier override requires its recorded source (at least 10 characters).";
    const f = dep_resolveOrdinance(c.ord, i ? dep_itemLibraryKey(i) : "", c.scheduleEntryId, c.pricedOn || c.issued),
      ordinal = dep_tierOrdinal(c.tier),
      pick = f?.tiers?.[Math.min(ordinal, f.tiers.length) - 1];
    if (d && f && f.window !== "site" && f.window?.kind !== "site-season" && !dep_respondentKey(dep_docCase(d)))
      return "Scheduled pricing needs the respondent name and mailing address, or an approved manual basis.";
    if (
      (f?.rule
        ? (() => {
            const r = dep_resolveCitationAmount({
              ordinance: c.ord,
              libraryItem: i ? dep_itemLibraryKey(i) : "",
              entryId: c.scheduleEntryId,
              tier: ordinal,
              date: c.pricedOn || c.issued,
              measurements: c.measurements || {},
            });
            return r.kind !== "priced" || dep_money(r.base) !== dep_money(c.base);
          })()
        : !pick || dep_money(pick.a) !== dep_money(c.base)) ||
      dep_cents(c.cc) !== dep_courtCents(c.pricedOn || c.issued)
    )
      return "No matching scheduled deposit. Correct the ordinance or enter an approved deposit and source.";
    if (c.computedTier && ordinal !== c.computedTier && !c.tierOverrideSource)
      return "Expected tier " + dep_tierLabel(c.computedTier) + ". Review the counted citations.";
  }
  return "";
}

function editCitation(d, id, field, value, phase = "commit") {
  const c = d.cits[id];
  if (!c) return;
  if (["courtDate", "issued", "violDate"].includes(field)) value = dep_parseDate(value) || String(value || "").trim();
  if (["courtTime", "violTime"].includes(field)) value = dep_parseTime(value) || String(value || "").trim();
  if (field === "ord") {
    const canonical = (v) => dep_canonicalOrdinance(v) || String(v || "").trim();
    if (phase === "input") {
      if (!Object.prototype.hasOwnProperty.call(c, "ordEditingFrom")) c.ordEditingFrom = c.ord;
      c.ord = String(value || "");
      if (d.correction) d.correction.reviewed = false;
      return;
    }
    const previous = Object.prototype.hasOwnProperty.call(c, "ordEditingFrom") ? c.ordEditingFrom : c.ord;
    delete c.ordEditingFrom;
    value = canonical(value);
    if (canonical(previous) === value) {
      c.ord = value;
      return;
    }
    c.ord = value;
    c.autoFilledCharge = false;
    delete c.chargeStale;
    delete c.scheduleEntryId;
    dep_applyDeposit(d, id, c.ord);
    if (d.correction) d.correction.reviewed = false;
    return;
  }
  if (c[field] === value) return;
  if (["tierOverride", "tierOverrideSource"].includes(field) && !String(value || "").trim()) {
    delete c[field];
    dep_citationPricing.refresh(d);
    return;
  }
  if (field === "amount" && !(dep_cents(value) > 0)) {
    c.depositEditInvalid = true;
    c.reconfirmDeposit = true;
    return;
  }
  c[field] = value;
  if (field === "amount") delete c.depositEditInvalid;
  if (field === "issued") delete c.issuedAutomatic;
  if (field === "desc") c.descEdited = true;
  if (["violDate", "issued", "scheduleEntryId", "tierOverride", "tierOverrideSource"].includes(field)) dep_citationPricing.refresh(d);
  if (field === "depositMode") {
    if (value !== "schedule" && c.resolvedVia && !c.resolvedVia.startsWith("approved-")) delete c.depositSource;
    delete c.assessments;
    if (value === "schedule") dep_applyDeposit(d, id, c.ord);
    else {
      if (value === "base" && dep_validMoney(c.base) && dep_validMoney(c.cc)) {
        const lines = dep_feeLines(c.base, c.cc, c.pricedOn || c.issued);
        c.amount = dep_money(lines.total);
        c.assessments = lines.cents;
      }
      c.reconfirmDeposit = String(c.depositSource || "").trim().length < 10;
    }
  }
  if (["base", "cc"].includes(field) && c.depositMode !== "total") {
    const lines = dep_validMoney(c.base) && dep_validMoney(c.cc) ? dep_feeLines(c.base, c.cc, c.pricedOn || c.issued) : null;
    if (lines) {
      c.amount = dep_money(lines.total);
      c.assessments = lines.cents;
    } else c.reconfirmDeposit = true;
  }
  if (
    ["base", "cc", "amount", "depositSource"].includes(field) &&
    c.depositMode !== "schedule" &&
    !c.depositEditInvalid &&
    dep_validMoney(c.amount) &&
    String(c.depositSource || "").trim().length >= 10 &&
    (c.depositMode === "total" || (dep_validMoney(c.base) && dep_validMoney(c.cc)))
  ) {
    delete c.reconfirmDeposit;
    c.resolvedVia = "approved-" + c.depositMode;
    c.pricedOn = dep_citationPricingDate(c, d);
    c.policyVersionHash = dep_CITATION_POLICY.versionHash;
  }
  if (d.correction) d.correction.reviewed = false;
}

function commitCitationEdits(d) {
  for (const [id, c] of Object.entries(d?.cits || {}))
    if (Object.prototype.hasOwnProperty.call(c, "ordEditingFrom")) editCitation(d, id, "ord", c.ord);
}

function authoringChecks(d) {
  dep_citationPricing.refresh(d);
  const out = [];
  let targetItem = null;
  const check = (ok, t, fields = []) =>
    out.push({
      ok,
      t,
      ...(targetItem && fields.length
        ? { targets: fields.map((f) => dep_checkTarget(dep_citSelector(targetItem.id, f), "Item " + targetItem.no + " · " + f)) }
        : {}),
    });
  if (["notice", "extension", "citation"].includes(d.type))
    check(dep_distinctDues(dep_dueItems(d)).length <= 3, "Use no more than three distinct due dates for outstanding items.");
  if (["notice", "extension", "citation"].includes(d.type)) {
    const close = dueDateSpacingConflicts(dep_dueItems(d)).filter(
      (pair) => !d.correction || pair.items.some((i) => !dep_unchangedCorrectionValue(d, i.id, "due")),
    );
    const items = [...new Map(close.flatMap((pair) => pair.items).map((i) => [i.id, i])).values()];
    out.push({
      ok: close.length === 0,
      t: close.length ? "Keep distinct due dates at least seven days apart." : "Distinct due dates are at least seven days apart.",
      ...(items.length ? { targets: items.map((i) => dep_checkTarget(dep_itemSelector(i.id, "due"), "Item " + i.no + " · due date")) } : {}),
    });
  }
  if (d.type === "notice" && !d.correction) {
    const keys = d.items.map(dep_itemLibraryKey).filter(Boolean);
    check(new Set(keys).size === keys.length, "Each library item can appear only once on an original notice. Remove duplicate items.");
  }
  if (d.type === "citation") check(depositComplete(d), "Citation needs deposit. Complete the required deposit step.");
  if (d.type === "citation")
    check(!dep_citationPricing.historyFault(d), dep_citationPricing.historyFault(d) || "Shared citation history has been checked.");
  if (d.type === "citation")
    d.items
      .filter((i) => i.cite && !i.withdrawn)
      .forEach((i) => {
        const c = (d.cits || {})[i.id] || {},
          prefix = "Citation for item " + i.no + ": ",
          old = dep_correctionSource(d),
          original = old && (old.cits || {})[i.id];
        targetItem = i;
        const request = d.depositRequests?.[i.id];
        if (request) {
          out.push({
            ok: false,
            t:
              prefix +
              (!dep_canonicalOrdinance(request.ord)
                ? "choose one complete ordinance and complete the approved deposit basis in Citation review."
                : request.measurementFields?.length
                  ? "complete the required measurements in Citation review."
                  : "complete the approved deposit basis in Citation review."),
            targets: [
              dep_checkTarget(
                '[data-deposit-form="' + dep_checkAttr(i.id) + '"] ' + (request.measurementFields?.length ? '[name^="measure-"]' : '[name="ord"]'),
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
        check(!!dep_canonicalOrdinance(c.ord), prefix + "enter one complete ordinance number, not a list of sections.", ["ord"]);
        check(!dep_citationPricing.chargeFault(d, i, c), prefix + (dep_citationPricing.chargeFault(d, i, c) || "charge matches the current item."), [
          "ord",
          "differentChargeSource",
        ]);
        check(
          !["desc", "comment", "statute", "deptId"].some((k) => dep_countBlanks(String(c[k] || ""))),
          prefix + "complete all placeholder details in the citation fields.",
          ["desc", "comment"],
        );
        check(!citationDepositFault(c, d, i), prefix + (citationDepositFault(c, d, i) || "deposit and its basis agree."), [
          "depositMode",
          "ord",
          ...(c.depositMode === "total" ? ["amount"] : c.depositMode === "base" ? ["base", "cc"] : []),
          ...(c.depositMode && c.depositMode !== "schedule" ? ["depositSource"] : []),
        ]);
        check(!!dep_parseTime(c.courtTime), prefix + "enter a valid court time in Citation review.", ["courtTime"]);
        check(!!dep_parseTime(c.violTime || dep_inspAt(d).time), prefix + "enter the inspection/violation time.", ["violTime"]);
        check(
          dep_validISO(c.violDate || dep_inspAt(d).date) &&
            (c.violDate || dep_inspAt(d).date) >= (dep_docCase(d).date || "") &&
            (c.violDate || dep_inspAt(d).date) <= (c.issued || ""),
          prefix + "the violation date must be on or before issuance.",
          ["violDate"],
        );
        check(dep_validISO(c.issued) && c.issued <= dep_recordDay(today), prefix + "the issue date must be no later than today.", ["issued"]);
        check(
          dep_validISO(c.issued) &&
            c.issued === (d.correction ? d.correction.actionDate : d.authoringVersion >= 9 ? d.revision?.actionDate || d.mailed : d.mailed),
          prefix +
            (d.correction
              ? "the issue date must match the original action date used in reports."
              : "the issue date must match this document’s mailed date."),
          ["issued"],
        );
        check(dep_validISO(c.courtDate) && c.courtDate > c.issued, prefix + "the court date must follow issuance.", ["courtDate"]);
        check(/^[A-Za-z0-9-]+$/.test(c.num || ""), prefix + "use a citation number containing letters, numbers or hyphens.", ["num"]);
        if (original) check(c.num === original.num, prefix + "a correction retains the original citation number.", ["num"]);
      });
  return out;
}

/* R43: the charge card owns review; pricing and publication retain their existing owners. */
function citationReview(d) {
  dep_citationPricing.refresh(d);
  dep_citationPricing.ensureShared(d);
  if (dep_initialCitations.enabled(d)) d = dep_initialCitations.preview(d);
  if (d.type !== "citation" || dep_isLocked(d)) return "";
  dep_citationPricing.refresh(d);
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
        determined = !request && dep_citationPricing.determined(d, i, c);
      const held = !!c.mandatoryAppearance,
        status = request ? "Completion required" : held ? "Wording approval required" : fault ? "Review required" : "Deposit ready";
      const result = request ? "Deposit incomplete" : held ? "Mandatory appearance" : dep_formatDeposit(c.amount);
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
        `${esc(c.courtDate ? dep_fmtDate(c.courtDate) : "Date required")}` +
        " · " +
        `${esc(c.courtTime || "Time required")}` +
        '</strong><span class="hint">Suggested session; confirm the court-approve' +
        "d schedule.</span></div></div>";
      let body = "";
      if (request) {
        body = dep_depositStep.form(d, i, request);
      } else {
        const entries = dep_CITATION_POLICY.entries.filter((e) => e.ordinance === dep_canonicalOrdinance(c.ord));
        const chargeFields =
          "" +
          "".concat(
            (i.sections || []).length > 1
              ? '<p class="hint">Item sections: ' + esc(i.sections.join(", ")) + ". Confirm the one ordinance charged.</p>"
              : "",
          ) +
          '<div class="grid g2">' +
          `${field(i, c, "ord", "Ordinance", "text", dep_snow.is(d) ? "readonly" : "")}` +
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
          "".concat(field(i, c, "comment", "Violation comment / inspection history", "text", dep_snow.is(d) ? "readonly" : "")) +
          "" +
          `${field(i, c, "statute", "Adopted state statute (if applicable)")}` +
          "" +
          `${field(i, c, "deptId", "Officer ID")}` +
          "" +
          `${field(i, c, "courtDate", "Court date", "date")}` +
          "" +
          `${field(i, c, "courtTime", "Court time", "time")}` +
          "" +
          `${field(i, c, "issued", "Citation issue date", "date", 'max="' + dep_recordDay(today) + '"')}` +
          "" +
          `${field(i, { ...c, violDate: c.violDate || dep_inspAt(d).date }, "violDate", "Violation date", "date")}` +
          "" +
          `${field(i, { ...c, violTime: c.violTime || dep_inspAt(d).time }, "violTime", "Violation time", "time")}` +
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
          `${esc(dep_citationPricing.hint(d, i, c))}` +
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
            mode !== "total" && dep_validMoney(c.base)
              ? dep_feeLines(c.base, c.cc, c.pricedOn || c.issued)
                  .rows.map((row) => esc(row.k) + ": $" + dep_money(row.v))
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
                  esc(held ? "Mandatory appearance · wording approval required" : fault || "Total cash deposit: " + dep_formatDeposit(c.amount)),
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
    '">Save &amp; continue later</button></div></div><div class="card-b"><p c' +
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
    target = visit ? dep_reinsp(WriterState.state.reinspId) : dep_doc(WriterState.state.docId);
  return { target, visit };
}

function inspectionIdentity(row) {
  return { type: row.typeKey, date: row.date, time: dep_parseTime(row.time || "") || "" };
}

function sameInspection(a, b) {
  return !!a && !!b && a.date === b.date && a.type === b.type && (!a.time || !b.time || a.time === b.time);
}

function inspectionUsed(k, row) {
  const key = inspectionIdentity(row),
    documents = dep_docsFor(k.id);
  // Retain evidence even after correction or withdrawal; never recycle an inspection.
  if (documents.some((d) => sameInspection(d.importInspection, key))) return true;
  if (key.type === "initial" && documents.some((d) => d.type === "notice")) return true;
  if (dep_reinspFor(k.id).some((r) => sameInspection(r.importInspection || { type: "reinspection", date: r.date, time: r.time || "" }, key)))
    return true;
  return documents.some(
    (d) =>
      d.type !== "notice" &&
      d.fromReinspId &&
      sameInspection({ type: "reinspection", date: dep_inspAt(d).date, time: dep_inspAt(d).time || "" }, key),
  );
}

export {
  depositComplete,
  independentArtifact,
  remindersDue,
  remindersPanel,
  showReminders,
  showReminderDraft,
  timelineCategory,
  timelineRows,
  showTimeline,
  planBulkDue,
  showBulkDue,
  showOutbox,
  selectedOutbox,
  printOutbox,
  refreshArtifactLocations,
  pdfTransferState,
  workspaceTasks,
  markWriterReady,
  writerOpenReportedCase,
  initWriterHandoff,
  initialCitationBody,
  updateDueIndicators,
  toggleLibraryItem,
  dueDateSpacingConflicts,
  dueContext,
  duePanel,
  assignDue,
  scheduledEntry,
  citationDepositFault,
  editCitation,
  commitCitationEdits,
  authoringChecks,
  citationReview,
  activeDueTarget,
  inspectionIdentity,
  sameInspection,
  inspectionUsed,
};
