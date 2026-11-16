import { citationOnlyItem } from "./citation_disposition.js";
import { html, raw } from "./screen_html.js";
import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { recordDay, validCaseNumber } from "../assets/shared.js";
import { stableJSON, clone } from "./record_values.js";
import { DOC_TYPES, OUTCOMES, REFERRED_ONLY, courtTime } from "./document_types.js";
import {
  doc,
  docCase,
  doneItems,
  insp,
  isReferredCase,
  kase,
  originalNotice,
  reinsp,
  unchecked,
  openItems,
  reinspFor,
  recordHead,
} from "./writer_queries.js";
import { daysBetween } from "./calendar.js";
import { checkTarget, itemSelector, checkAttr, citSelector, markBlanks } from "./presentation_format.js";
import { ocOf, dueItems, distinctDues, itemLibraryKey, isEffective, supplemental } from "./document_rules.js";
import { isLLC } from "./mailing_rules.js";
import { INSPECTORS } from "./data/inspectors.js";
import { canonicalOrdinance } from "./citation_policy.js";

/* Explicit lazy UI/peer adapters preserve worksheet and walkthrough state at call time. */
function worksheetItemShown({ r, it }) {
  const oc = ocOf(r, it.id);
  if (editor.state.riFilter === "corrected") return oc === "corrected";
  if (editor.state.riFilter === "open") return !citationOnlyItem(it) && oc && oc !== "corrected" && oc !== "withdrawn";
  if (editor.state.riFilter === "todo") return !oc;
  return true;
}

function worksheetNextDueHTML({ open, r, it, res, services, lock, dc }) {
  return open &&
    (!r.followupIntent || r.followupIntent === "undecided" || ["extension", "bestInterestExtension", "citation"].includes(r.followupIntent))
    ? html`<label class="f"><span>Next due date</span>
          <input type="date" data-ridue="${it.id}" value="${res.due || ""}" min="${services.authoring.MINDUE()}" ${lock ? "disabled" : ""}>
          <span class="hint ${dc.ok ? (dc.warn ? "warnt" : "") : "badt"}">${dc.msg}</span></label>`
    : "<div></div>";
}

const worksheetNoteLabel = (oc, open) => (oc === "noaccess" ? "Access attempt and observations" : "Notes " + (open ? "" : "(optional)"));

function worksheetNoAccessHint(oc) {
  return oc === "noaccess"
    ? html`<span class="hint">Describe the access attempted, contact made and areas you could not inspect. No access is not a finding of compliance.</span>`
    : "";
}

function worksheetCiteHTML({ open, r, res, it, lock }) {
  return open && (r.importRule?.cite || res.cite)
    ? html`<label class="ri-cite"><input type="checkbox" data-ricite="${it.id}" ${res.cite ? "checked" : ""} ${lock ? "disabled" : ""}>
        <span>Issue a citation for this item</span></label>`
    : "";
}

function worksheetResultFieldsHTML({ oc, it, res, r, lock, open, services, dc }) {
  return oc
    ? html`<div class="ri-fields">
        <label class="f"><span>Result date</span>
          <input type="date" data-ridate="${it.id}" value="${res.on || r.date}" max="${recordDay(today)}" ${lock ? "disabled" : ""}><span class="hint">When this result was observed; no later than this visit.</span></label>
        ${raw(worksheetNextDueHTML({ open, r, it, res, services, lock, dc }))}
      </div>
      <label class="f ri-note"><span>${worksheetNoteLabel(oc, open)}</span>
        <textarea rows="2" data-rinote="${it.id}" placeholder="What you observed, who you spoke to, anything worth having on the file" ${lock ? "disabled" : ""}>${res.note || ""}</textarea>${raw(
          worksheetNoAccessHint(oc),
        )}</label>
      ${raw(worksheetCiteHTML({ open, r, res, it, lock }))}`
    : "";
}

function worksheetWalkCopyHTML({ walkOn, src, left, next }) {
  return walkOn
    ? editor.state.riWalkStage === "details"
      ? html`Complete item ${src.items.find((i) => i.id === editor.state.riWalkItem)?.no || ""} details, then choose Next item. ${left} without outcomes.`
      : next
        ? html`Next: item ${next.no || String(src.items.indexOf(next) + 1)} of ${src.items.length} · ${left} left to result.`
        : "All items have a result. Review the dates, notes and due dates before creating a document."
    : "Every item is shown. Choose One item at a time to bring the next unanswered item into focus.";
}

function worksheetWalkStepsHTML({ walkOn, walkSteps, walkStep }) {
  return walkOn
    ? html`<ol class="ri-walk-steps" aria-label="One item at a time steps">${raw(
        walkSteps
          .map(
            (label, ix) =>
              html`<li data-walk-step="${ix + 1}"${raw(walkStep === ix + 1 ? html` aria-current="step" class="current"` : "")}>${label}</li>`,
          )
          .join(""),
      )}</ol>`
    : "";
}

function worksheetWalkModesHTML(walkOn) {
  return html`<div class="ri-walk-modes" role="group" aria-label="How to review items"><button type="button" class="btn btn-sm ${walkOn ? "" : "btn-primary"}" data-riwalk="off" aria-pressed="${walkOn ? "false" : "true"}">Review all items</button><button type="button" class="btn btn-sm ${walkOn ? "btn-primary" : ""}" data-riwalk="on" aria-pressed="${walkOn ? "true" : "false"}">One item at a time</button></div>`;
}

function worksheetWalkModeHTML(walkOn) {
  return html`<label class="f"><span>After an outcome</span><select id="ri-walk-mode" ${walkOn ? "" : "disabled"}><option value="quick" ${editor.state.riWalkMode === "quick" ? "selected" : ""}>Go to next unanswered item</option><option value="details" ${editor.state.riWalkMode === "details" ? "selected" : ""}>Complete details first</option></select></label>`;
}

const worksheetHasUnfinishedDetails = ({ src, editableWalkItem, r, walkItemReady }) =>
  src.items.some((it) => editableWalkItem(r, it.id) && (!walkItemReady(r, it.id) || editor.state.riWalkSkipped.includes(it.id)));

function worksheetWalkButtonsHTML({ walkOn, src, editableWalkItem, r, walkItemReady }) {
  if (!walkOn) return "\n    \n    \n    ";
  return (
    html`<button class="btn btn-sm" data-riwalk-prev>Previous item</button>` +
    "\n    " +
    (editor.state.riWalkStage === "details"
      ? html`<button class="btn btn-primary btn-sm" data-riwalk-next>Next item</button><button class="btn btn-sm" data-riwalk-skip>Skip for now</button>`
      : "") +
    "\n    " +
    (worksheetHasUnfinishedDetails({ src, editableWalkItem, r, walkItemReady })
      ? html`<button class="btn btn-sm" data-riwalk-return>Return to unfinished details</button>`
      : "") +
    "\n    " +
    (editor.state.riWalkUndo
      ? html`<button class="btn btn-sm" data-riwalk-undo title="Undo the last walk-through result (U)">Undo last result <kbd>U</kbd></button>`
      : "")
  );
}

function worksheetWalkPanelHTML({ readOnly, walkOn, src, left, next, walkSteps, walkStep, editableWalkItem, r, walkItemReady, walkKeys }) {
  return !readOnly
    ? html`<div class="ri-walk-panel ${walkOn ? "active" : ""}" role="group" aria-label="Reinspection review mode">
    ${raw(worksheetWalkModesHTML(walkOn))}
    <div class="ri-walk-copy"><strong>${walkOn ? "One item at a time" : "Review all items"}</strong>
      <span aria-live="polite">${raw(worksheetWalkCopyHTML({ walkOn, src, left, next }))}</span>
    </div>
    ${raw(worksheetWalkStepsHTML({ walkOn, walkSteps, walkStep }))}
    ${raw(worksheetWalkModeHTML(walkOn))}
    ${raw(worksheetWalkButtonsHTML({ walkOn, src, editableWalkItem, r, walkItemReady }))}
    <details class="ri-walk-tips"><summary>Keyboard shortcuts and tips</summary><p>In One item at a time: ${raw(walkKeys)}.</p><p>Shortcuts are ignored while typing in a field. Nothing is recorded until you choose an outcome; follow-up choices stay limited to those the imported inspection result permits.</p><p>After an outcome: Go to next unanswered item moves on at once; Complete details first keeps the item open for its date, notes and any new due date.</p></details>
  </div>`
    : "";
}

function worksheetPriorVisitsHTML({ prior, services }) {
  return prior.length
    ? html`<div class="card" style="margin-bottom:16px"><div class="card-h"><h2>Earlier visits</h2></div><div class="card-b"><ul class="hist">${raw(prior.map((x) => html`<li><strong>${services.inspection.fmtDate(x.date)}</strong> — ${doneItems(x).length} corrected, ${openItems(x).length} outstanding · ${insp(x.inspectorId).name}</li>`).join(""))}</ul></div></div>`
    : "";
}

function worksheetVisitHeaderHTML({ walkIdentity, r, srcLabel, services, src, readOnly }) {
  return (
    html`<div class="reinspection-workspace" data-worksheet-context="${walkIdentity(r)}"><p class="ri-source">Inspecting against the ${srcLabel.toLowerCase()} issued ${services.inspection.fmtDate(src.mailed || src.created)}. Original item numbers and wording stay with the issued document.</p>\n     ` +
    html`<div class="card ri-visit" style="margin-bottom:16px"><div class="card-b">\n       <div class="grid g2">\n         <label class="f"><span>Actual inspection date and time</span><span class="ri-when">` +
    html`<input type="date" id="ri-date" value="${r.date}" max="${recordDay(today)}" ${readOnly ? "disabled" : ""}>` +
    html`<input type="time" id="ri-time" value="${r.time || ""}" aria-label="Reinspection time" ${readOnly ? "disabled" : ""}></span>` +
    html`<span class="hint">The physical visit. Item result dates and future deadlines are separate below.</span></label>\n         ` +
    html`<label class="f"><span>Inspector</span><select id="ri-insp" ${readOnly ? "disabled" : ""}>${raw(INSPECTORS.map((x) => html`<option value="${x.id}" ${r.inspectorId === x.id ? "selected" : ""}>${x.name}</option>`).join(""))}</select></label>\n       </div>\n       `
  );
}

function worksheetProgressHTML({ recorded, activeCount, left, withdrawn }) {
  return (
    html`<div class="ri-progress" role="status"><strong>${recorded} of ${activeCount} active items have a result</strong>` +
    html`<span>${left} unresolved${withdrawn ? " · " + withdrawn + " withdrawn (excluded)" : ""}. Previously cleared items remain carried forward.</span>` +
    html`<progress value="${recorded}" max="${activeCount || 1}" aria-label="Active items with a result"></progress></div>\n       `
  );
}

const worksheetWalkLock = (attribute) => (editor.state.riWalk ? attribute : "");

function worksheetFiltersHTML({ done, open, left, cited, src }) {
  return (
    html`<div class="ri-sum" ${worksheetWalkLock("hidden")}>\n         ` +
    html`<button class="cchip ${done ? "good" : ""}" data-rifilter="corrected" aria-pressed="${editor.state.riFilter === "corrected"}" ${worksheetWalkLock("disabled")}>${done} corrected</button>\n         ` +
    html`<button class="cchip ${open ? "bad" : ""}" data-rifilter="open" aria-pressed="${editor.state.riFilter === "open"}" ${worksheetWalkLock("disabled")}>${open} outstanding</button>\n         ` +
    (left
      ? html`<button class="cchip" data-rifilter="todo" aria-pressed="${editor.state.riFilter === "todo"}" ${worksheetWalkLock("disabled")}>${left} not yet resulted</button>`
      : "") +
    html`\n         ` +
    (cited.length ? html`<span class="cchip bad">${cited.length} to cite</span>` : "") +
    html`\n         ` +
    (editor.state.riFilter ? html`<button class="lnk" data-rifilter="" ${worksheetWalkLock("disabled")}>Show all ${src.items.length}</button>` : "") +
    html`\n       </div>\n       `
  );
}

function worksheetItemsHeading(left, rowsShown, src) {
  if (editor.state.riWalk && editor.state.riWalkItem)
    return "Current item · " + (left ? "next unresolved remains in order" : "reviewing recorded details");
  return editor.state.riFilter ? rowsShown + " of " + src.items.length + " items" : "Review all " + src.items.length + " items";
}

const worksheetDueIntent = (r) => !r.followupIntent || ["undecided", "extension", "bestInterestExtension", "citation"].includes(r.followupIntent);

function worksheetBodyHTML({
  walkPanel,
  rowsShown,
  src,
  prior,
  services,
  left,
  r,
  rows,
  readOnly,
  worksheetChecks,
  worksheetCheckPanel,
  verdict,
  closed,
}) {
  return html`${raw(walkPanel)}
       ${raw(
         editor.state.riFilter
           ? html`<p class="ri-filtered">Showing ${rowsShown} of ${src.items.length} items. This only changes what you are looking at &mdash; every item still goes on the document.</p>`
           : "",
       )}
       </div></div>
     ${raw(worksheetPriorVisitsHTML({ prior, services }))}
     <h2 class="ri-items-heading">${worksheetItemsHeading(left, rowsShown, src)}</h2>
     ${raw(
       r.previousDraft
         ? html`<div class="banner info"><div>Previous document draft retained. <button class="btn" id="btn-previousdraft">Restore previous draft and inspection</button><button class="btn" id="btn-exportprevious">Download previous draft</button></div></div>`
         : "",
     )}
     ${raw(worksheetDueIntent(r) ? services.inspection.duePanel(r, true) : "")}${raw(rows)}

     ${raw(
       !readOnly
         ? html`<details class="ri-checks"><summary>Inspection checks · ${worksheetChecks(r).filter((c) => !c.soft).length} to resolve before a document</summary>${raw(worksheetCheckPanel(r))}</details>`
         : "",
     )}
     ${raw(verdict)}
     ${raw(!closed ? services.authoring.newDocuments.chooser(r) : html`<button class="btn" data-open="${r.docId}">Open the document</button>`)}
     <div class="ri-foot"><button class="btn" id="btn-risave">Save draft &amp; return to Workspace</button></div></div>`;
}

// One step for the items with no result yet; any that differ are then changed one by one.
const BATCH_BUTTONS =
  '<div class="ri-batch" role="group" aria-label="Mark every item without a result"><span>Mark the rest:</span><button type="button" class="btn btn-sm" data-ri-batch="corrected">All corrected</button><button type="button" class="btn btn-sm" data-ri-batch="none">All no change</button></div>';

const worksheetPlural = (n, one, many) => (n === 1 ? one : many);

function worksheetClosedVerdict(r, open) {
  const nd = doc(r.docId),
    ndl = (DOC_TYPES.find((t) => t.id === (nd || {}).type) || {}).label || "follow-up";
  return html`<div class="banner ok"><div><strong>${doc(r.docId) && doc(r.docId).draft ? "A follow-up document is being drafted." : "This reinspection is finished."}</strong> ${ndl} written from ${open} outstanding item${worksheetPlural(open, "", "s")}. Compatible additional scoped actions can use this same inspection.</div></div>`;
}

function worksheetOpenVerdict({ r, open, srcLabel, done, referred }) {
  return html`<div class="banner info"><div><strong>${open} item${worksheetPlural(open, "", "s")} carr${worksheetPlural(open, "ies", "y")} forward${done ? ", " + done + " corrected" : ""}.</strong> ${raw(worksheetFollowupExplanation({ referred, r }))} Item numbers stay as they are on the ${srcLabel.toLowerCase()}.</div></div>`;
}

function worksheetVerdictHTML({ closed, r, open, left, srcLabel, badDue, done, referred }) {
  if (closed) return worksheetClosedVerdict(r, open);
  if (left)
    return html`<div class="banner info"><div><strong>${left} item${worksheetPlural(left, "", "s")} still to result.</strong> Every item on the ${srcLabel.toLowerCase()} needs an outcome before you create a draft.${raw(editor.state.riWalk ? "" : BATCH_BUTTONS)}</div></div>`;
  if (!open)
    return html`<div class="banner ok"><div><strong>Everything on this ${srcLabel.toLowerCase()} was corrected.</strong> Write the compliance letter to tell the owner the case is closed. It records the visit and carries the date each item was met.</div></div>`;
  if (badDue.length && ["extension", "bestInterestExtension", "citation"].includes(r.followupIntent))
    return html`<div class="banner warn"><div><strong>${badDue.length} outstanding item${worksheetPlural(badDue.length, "", "s")} need${worksheetPlural(badDue.length, "s", "")} a due date in the future.</strong> Set one on each item that was not corrected &mdash; unless you are referring the case for prosecution, which sets no new date.</div></div>`;
  return worksheetOpenVerdict({ r, open, srcLabel, done, referred });
}

const worksheetWalkCurrent = (readOnly, it) => !readOnly && editor.state.riWalk && editor.state.riWalkItem === it.id;
const worksheetWalkHidden = (readOnly, walkCurrent) => !readOnly && editor.state.riWalk && editor.state.riWalkItem && !walkCurrent;
const worksheetOutcomeOpen = (oc) => oc && oc !== "corrected" && oc !== "withdrawn";

function worksheetItemContext({ src, it, r, readOnly, dueCheck }) {
  const ix = src.items.indexOf(it);
  const res = r.results[it.id] || {},
    oc = res.oc || "";
  const walkCurrent = worksheetWalkCurrent(readOnly, it);
  const late = it.due && daysBetween(it.due, r.date) > 0;
  const open = !citationOnlyItem(it) && worksheetOutcomeOpen(oc);
  const carried = !!res.carried,
    lock = readOnly || carried;
  const dc = open ? dueCheck(res.due, r.date) : null;
  const walkHidden = worksheetWalkHidden(readOnly, walkCurrent);
  return { ix, res, oc, walkCurrent, late, open, carried, lock, dc, walkHidden };
}

function worksheetCarriedHTML({ carried, oc, res, services }) {
  return carried
    ? html`<p class="ri-carried">${raw(
        oc === "withdrawn"
          ? "Withdrawn as entered in error; excluded from compliance counts."
          : html`Cleared on ${services.inspection.fmtDate(res.on)} and carried forward.`,
      )}</p>`
    : "";
}

function worksheetItemHTML({ it, src, r, readOnly, dueCheck, services }) {
  const { ix, res, oc, walkCurrent, late, open, carried, lock, dc, walkHidden } = worksheetItemContext({ src, it, r, readOnly, dueCheck });
  if (citationOnlyItem(it) && !it.withdrawn)
    return html`<div class="ri-item" data-ri-item="${it.id}"><div class="ri-top"><span class="ri-no">${it.no}.</span><span class="ri-ttl">${it.title || "Violation item"}</span></div><div class="ri-body">${raw(markBlanks(it.text || ""))}</div><p class="ri-carried">Closed by initial citation; no follow-up required. Excluded from compliance counts.</p></div>`;
  return html`<div class="ri-item ${walkCurrent ? "ri-walk-current" : ""}" data-ri-item="${it.id}" data-oc="${oc}" ${walkHidden ? "hidden" : ""} ${raw(walkCurrent ? html`data-ri-walk-current="true" aria-current="step" tabindex="-1"` : "")}>
      <div class="ri-top">
        <span class="ri-no">${it.no || String(ix + 1)}.</span>
        <span class="ri-ttl">${it.title || "Violation item"}</span>
        ${raw((it.sections || []).map((x) => html`<span class="cite-sec">${x}</span>`).join(""))}
        <span class="ri-due ${late ? "over" : ""}">Was due ${services.inspection.fmtDate(it.due)}</span>
      </div>
      <div class="ri-body">${raw(markBlanks(it.text || ""))}</div>
      <div class="seg" role="group" aria-label="Result for item ${it.no || String(ix + 1)}">
        ${raw(OUTCOMES.map((o) => html`<button data-setoc="${o.id}" data-item="${it.id}" ${lock ? "disabled" : ""} aria-pressed="${oc === o.id ? "true" : "false"}">${o.label}</button>`).join(""))}
      </div>
      ${raw(worksheetCarriedHTML({ carried, oc, res, services }))}
      ${raw(worksheetResultFieldsHTML({ oc, it, res, r, lock, open, services, dc }))}
      </div>`;
}

function worksheetWalkHTML({ r, readOnly, src, left, next, editableWalkItem, walkItemReady }) {
  const walkOn = editor.state.riWalk;
  const walkStep = !walkOn
    ? 0
    : !editor.state.riWalkItem
      ? 4
      : editor.state.riWalkStage === "details"
        ? walkItemReady(r, editor.state.riWalkItem)
          ? 3
          : 2
        : 1;
  const walkSteps = ["Record the outcome", "Complete required details", "Continue to the next item", "Review the inspection and permitted follow-up"];
  const walkKeys = OUTCOMES.map((o, ix) => html`<kbd>${ix + 1}</kbd> ${o.label}`).join(" · ") + " · <kbd>U</kbd> Undo the last outcome";
  const walkPanel = worksheetWalkPanelHTML({
    readOnly,
    walkOn,
    src,
    left,
    next,
    walkSteps,
    walkStep,
    editableWalkItem,
    r,
    walkItemReady,
    walkKeys,
  });
  return walkPanel;
}

function worksheetFollowupExplanation({ referred, r }) {
  return referred
    ? html`This case is with the City Attorney, so the only documents left are an updated referral or, once everything is put right, a compliance letter. Extensions and citations are no longer the division&rsquo;s to give.`
    : r.importRule
      ? html`The Accela status ${r.importRule.status} sets the next document: ${r.importRule.label}.${r.importRule.cite ? " Tick the items you are citing." : ""}${r.importRule.allCorrected ? " Every item must be marked Corrected." : ""}`
      : html`Choose the next action: an extension to allow more time, a referral to send the case to the City Attorney, or a citation. Citations are at your discretion for any item past its due date — tick the items you are citing.`;
}

function worksheetCheckPanelHTML(list, checkRowHTML) {
  return list.length
    ? html`<section class="card no-print"><div class="card-h"><h2>Inspection checks</h2></div><div class="card-b">${raw(list.map((c, ix) => checkRowHTML(c, ix, true)).join(""))}</div></section>`
    : "";
}

function followupItemDue(it, res, type, hasHistory, cleared) {
  // A Reinspection Notice never changes a due date: every item keeps the date it was already assigned.
  return citationOnlyItem(it)
    ? ""
    : (hasHistory && type !== "compliance") || it.withdrawn
      ? ""
      : cleared || type === "compliance" || type === "reinspectionNotice"
        ? it.due
        : res.due;
}

/* Follow-up drafting calculations consume an explicit view of lookups (reinspectionFollowupLookups). Each lookup reads
   the service binding at call time, at the same point and in the same order as before. */
function followupItemNumber(it, pos) {
  return it.no || String((pos.get(it.id) || 0) + 1);
}

function followupItemNote(res, cleared) {
  return cleared ? "" : String(res.note || "").trim();
}

function followupDraftItem(view, r, type, hasHistory, pos, it) {
  const res = r.results[it.id] || {},
    cleared = res.oc === "corrected",
    note = followupItemNote(res, cleared);
  return {
    ...it,
    id: view.uid("x"),
    no: followupItemNumber(it, pos),
    due: followupItemDue(it, res, type, hasHistory, cleared),
    done: cleared,
    doneOn: cleared ? res.on || r.date : "",
    note,
    noteOn: note ? res.on || r.date : "",
    hist: hasHistory ? view.itemHistory(r.caseId, followupItemNumber(it, pos)) : null,
    cite: type === "citation" && !cleared && !!res.cite,
    srcItemId: it.id,
  };
}

function reopenFollowupDraft(services, r) {
  // only an existing document closes the worksheet; a discarded one leaves
  // it open to write the follow-up again
  if (r.docId && !doc(r.docId)) r.docId = null;
  if (r.docId && (doc(r.docId)?.draft || !supplemental(doc(r.docId)))) {
    editor.state.docId = r.docId;
    editor.state.screen = "write";
    services.ui.render();
    return true;
  }
  return false;
}

const FOLLOWUP_TYPES = ["extension", "citation", "referral", "referralUpdate", "compliance", "reinspectionNotice"];

function followupWorksheetRefusal(r, type, view) {
  const unavailable = view.eligibility(r, type);
  if (unavailable) return { t: unavailable };
  const faults = view.worksheetFaults(r, type);
  if (faults.length) return { t: faults[0] };
  if (view.unchecked(r).length) return { t: "Choose an outcome for every item first" };
  if (!view.validISO(r.date) || r.date > view.today()) return { t: "Enter a valid inspection date" };
  return null;
}

// The refusal for a follow-up draft, in the original order, or null when it may be written.
function followupDraftRefusal(r, type, src, carry, view) {
  if (!src || !isEffective(src) || (!r.draft && !r.recordedAt)) return { t: "Open a current reinspection worksheet first" };
  if (!FOLLOWUP_TYPES.includes(type)) return { t: "Choose an available follow-up type." };
  return followupWorksheetRefusal(r, type, view) || followupCarryRefusal(type, carry);
}

function followupCarryRefusal(type, carry) {
  if (type !== "compliance" && !carry.length) return { t: "Nothing outstanding to carry forward" };
  if (type === "compliance" && carry.length) return { t: "Items are still outstanding — a compliance letter closes every item" };
  return null;
}

function followupDraftAllowed(services, r, type, src, carry) {
  const refusal = followupDraftRefusal(r, type, src, carry, reinspectionFollowupLookups(services));
  if (refusal) services.ui.toast(refusal.t);
  return !refusal;
}

function followupDraftHeader(view, r, type, hasHistory) {
  return {
    id: view.uid("d"),
    caseId: r.caseId,
    type: type,
    created: view.today(),
    status: "Draft",
    draft: true,
    mailed: view.today(),
    cc: "",
    cits: {},
    ...(hasHistory || type === "citation" || type === "reinspectionNotice" ? { authoringVersion: 16 } : {}),
  };
}

function followupDraftSource(view, r, src) {
  return {
    fromReinspId: r.id,
    fromDocId: src.id,
    expectedHead: r.draft ? r.expectedHead || view.head(r.caseId) : view.head(r.caseId),
    replaces: r.replaces || "",
    ...(r.importInspection ? { importInspection: clone(r.importInspection) } : {}),
    inspectorId: r.inspectorId || view.caseOf(r.caseId).inspectorId,
    inspDate: r.date || "",
    inspTime: r.time || "",
  };
}

// The follow-up draft as first written: header, recorded visit source and every carried item, in key order.
function followupDraftFor(view, r, type, src) {
  const pos = new Map(src.items.map((it, i) => [it.id, i]));
  const hasHistory = !!(DOC_TYPES.find((t) => t.id === type) || {}).history || type === "compliance";
  const nd = {
    ...followupDraftHeader(view, r, type, hasHistory),
    ...followupDraftSource(view, r, src),
    items: src.items.map((it) => followupDraftItem(view, r, type, hasHistory, pos, it)),
  };
  if (hasHistory) nd.items.forEach((it) => (it.hist = view.itemInspectionHistory(nd, it)));
  return nd;
}

function buildFollowupDraft(services, r, type, src) {
  return followupDraftFor(reinspectionFollowupLookups(services), r, type, src);
}

// The live reads follow-up permission and drafting use; every service is resolved when the lookup is called.
function reinspectionFollowupLookups(services) {
  return {
    eligibility: (r, type) => services.authoring.newDocuments.eligibility?.(r, type),
    worksheetFaults: (r, type) => services.inspection.worksheetFaults(r, type),
    unchecked,
    validISO: (value) => services.inspection.validISO(value),
    today: () => recordDay(today),
    uid: (prefix) => services.inspection.uid(prefix),
    itemHistory: (caseId, no) => services.inspection.itemHistory(caseId, no),
    itemInspectionHistory: (d, it) => services.inspection.itemInspectionHistory(d, it),
    head: recordHead,
    caseOf: kase,
  };
}

function prepareFollowupCitations(services, r, src, nd, narrativeFor) {
  if (!nd.items.some((i) => i.cite)) {
    workspace.DOCS = workspace.DOCS.filter((x) => x.id !== nd.id);
    services.ui.toast("Select the items to cite on the inspection worksheet.");
    return false;
  }
  nd.items
    .filter((i) => i.cite)
    .forEach((i) => {
      const sections = (i.sections || []).map(canonicalOrdinance),
        ord = sections.length === 1 ? sections[0] : "";
      nd.cits[i.id] = {
        deptId: insp(nd.inspectorId).badge || "",
        num: services.authoring.citationNumber(),
        courtTime: courtTime(),
        comment: narrativeFor(r, src.items.find((x) => x.id === i.srcItemId) || i),
        ord,
        preparedSections: sections,
        autoFilledCharge: !!ord,
        desc: String(i.title || "").toUpperCase(),
        issued: recordDay(today),
        courtDate: services.authoring.nextCourtDate(recordDay(today)),
        depositMode: "schedule",
      };
      services.authoring.applyDeposit(nd, i.id, ord);
    });

  return true;
}

const followupTypeLabel = (type) => (DOC_TYPES.find((t) => t.id === type) || {}).label;

function followupCarriedSummary(type, carry, n, cl) {
  return (
    (followupTypeLabel(type) || type) +
    " started \u2014 " +
    carry.length +
    " outstanding" +
    (cl ? ", " + cl + " shown as corrected" : "") +
    (n ? ", " + n + " citation" + (n === 1 ? "" : "s") : "")
  );
}

function followupDraftMessage(type, carry, n, cl) {
  if (type === "compliance") return "Compliance letter drafted — review and issue it to close the case";
  if (type === "referral" || type === "referralUpdate")
    return followupTypeLabel(type) + " started \u2014 " + carry.length + " item" + (carry.length === 1 ? "" : "s") + " still outstanding";
  return followupCarriedSummary(type, carry, n, cl);
}

function attachIdentityCheckTargets(d, t, add) {
  if (/registered agent/.test(t)) ["name", "addr", "city"].forEach((f) => add('[data-agent="' + f + '"]', "Registered agent " + f, "contacts"));
  else if (/mailing block/.test(t)) add('[data-case="ownerBlock"]', "Mailing block");
  else if (/case number/.test(t)) {
    if (!validCaseNumber(docCase(d).number)) add('[data-case="number"]', "Case number");
    if (!docCase(d).address) add('[data-case="address"]', "Property address");
  } else if (/signing/.test(t)) add('[data-doc="inspectorId"]', "Signing inspector");
  else if (/explain the error/.test(t)) add("#correction-reason", "Correction reason");
  else if (/amendment instructions/.test(t)) add("#correction-external", "Amendment reference");
  else if (/original action date/.test(t)) add("#correction-action-date", "Original action date");
  else return false;
  return true;
}

function attachContentCheckTargets(services, d, t, add, visit) {
  if (/mailing date|mailed date/.test(t)) add('[data-doc="mailed"]', "Mailed date");
  else if (/inspection|outcome|result date|compliance date|marked corrected/.test(t) && d.fromReinspId && !d.correction) visit();
  else if (/inspection date/.test(t)) add(d.inspDate !== undefined ? '[data-doc="inspDate"]' : '[data-case="date"]', "Inspection date");
  else if (/three distinct due dates/.test(t)) dueItems(d).forEach((i) => add(itemSelector(i.id, "due"), "Item " + i.no + " due date"));
  else if (/duplicate items|only once/.test(t)) d.items.forEach((i) => add('[data-del="' + checkAttr(i.id) + '"]', "Item " + i.no));
  else if (/citation|deposit|court|officer/.test(t)) attachCitationCheckTargets(d, t, add);
  else attachItemStateCheckTargets(services, d, t, add);
}

function depositCheckFields(cc) {
  return [
    "depositMode",
    "ord",
    ...(cc.depositMode === "total" ? ["amount"] : ["base", "cc"]),
    ...(cc.depositMode && cc.depositMode !== "schedule" ? ["depositSource"] : []),
  ];
}

// The citation fields a check message is about; an unspecific message names every empty required field.
function citationCheckFields(t, cc) {
  if (/court date/.test(t)) return ["courtDate"];
  if (/badge|officer/.test(t)) return ["deptId"];
  if (/unique citation|citation number/.test(t)) return ["num"];
  if (/issue dates/.test(t)) return ["issued"];
  if (/deposit/.test(t)) return depositCheckFields(cc);
  return ["num", "courtDate", "amount", "ord", "desc"].filter((f) => !String(cc[f] || "").trim());
}

function attachCitationCheckTargets(d, t, add) {
  d.items
    .filter((i) => i.cite && !i.withdrawn)
    .forEach((i) => {
      const cc = (d.cits || {})[i.id] || {};
      citationCheckFields(t, cc).forEach((f) => add(citSelector(i.id, f), "Item " + i.no + " · " + f));
    });
}

function attachItemStateCheckTargets(services, d, t, add) {
  if (/withdrawn item needs/.test(t))
    d.items
      .filter((i) => i.withdrawn && String(i.withdrawalReason || "").trim().length < 10)
      .forEach((i) => add('[data-withdraw="' + checkAttr(i.id) + '"]', "Item " + i.no + " withdrawal reason"));
  else if (/compliance dates/.test(t))
    d.items
      .filter((i) => i.done && !i.withdrawn && (!services.inspection.validISO(i.doneOn) || i.doneOn > recordDay(today) || i.doneOn < docCase(d).date))
      .forEach((i) => add(itemSelector(i.id, "doneOn"), "Item " + i.no + " compliance date"));
}

function recordedOutcomeResult(cur, outcome, r) {
  return {
    oc: outcome,
    on: cur.on || r.date,
    manualDate: !!cur.manualDate,
    due: outcome === "corrected" ? "" : cur.due || "",
    note: cur.note || "",
    cite: outcome === "corrected" ? false : !!cur.cite,
  };
}

function focusRecipientCheckTarget(services, d, target) {
  const k = d && docCase(d);
  if (!k) return;
  editor.state.ccProblem = services.authoring.validateAndStandardizeAddresses(k, d.type === "citation" && isLLC(k), false);
  editor.state.modal = "cc";
  services.ui.render();
  const parts = target.action.split(":");
  const exact = parts[1] === "agent" ? '[data-agent="' + parts[3] + '"]' : '[data-cc="' + parts[2] + "|" + parts[3] + '"]';
  const field = document.querySelector(editor.state.ccProblem?.selector || exact);
  field?.focus();
  field?.scrollIntoView?.({ block: "center" });
  return;
}

function focusAdministrativeCheckTarget(services, d, target) {
  if (target.action === "workspace") {
    services.inspection.openImportWorkspace(d?.caseId || reinsp(editor.state.reinspId)?.caseId);
    return true;
  }
  if (target.action === "catalog") {
    editor.state.screen = "library";
    editor.state.languageMode = "admin";
    editor.state.catalogAdminStatus = "review";
    const it = doc(editor.state.docId)?.items.find((i) => i.id === target.itemId);
    if (it) editor.state.catalogAdminKey = itemLibraryKey(it);
    services.ui.render();
    return true;
  }
  if (target.action?.startsWith("recipient:")) {
    focusRecipientCheckTarget(services, d, target);
    return true;
  }
  return false;
}

/* app functions; direct dependencies use explicit shared state. */

function reinspectionWalkIdentity(services, r) {
  return r && r.caseId + "|" + r.id + "|" + r.sourceDocId;
}

function reinspectionClearWalk(services) {
  editor.state.riWalk = false;
  editor.state.riWalkContext = null;
  editor.state.riWalkItem = null;
  editor.state.riWalkUndo = null;
  editor.state.riWalkSkipped = [];
  editor.state.riWalkStage = "outcome";
}

function reinspectionRestoreWalkFor(services, r) {
  const saved = editor.WORK.walk;
  if (saved?.context !== reinspectionWalkIdentity(services, r)) {
    editor.WORK.walk = null;
    return;
  }
  editor.state.riWalk = true;
  editor.state.riWalkContext = saved.context;
  editor.state.riWalkItem = saved.item;
  editor.state.riWalkUndo = saved.undo || null;
  editor.state.riWalkMode = saved.mode === "details" ? "details" : "quick";
  editor.state.riWalkSkipped = Array.isArray(saved.skipped) ? saved.skipped : [];
  editor.state.riWalkStage = saved.stage === "details" ? "details" : "outcome";
  if (!reinspectionEnsureWalkContext(services)) editor.WORK.walk = null;
}

// The walk's source document while its context still holds, or null when the walk must be cleared.
function walkContextSource(services, r) {
  if (!r || !r.draft || r.docId || editor.state.riWalkContext !== reinspectionWalkIdentity(services, r)) return null;
  const src = doc(r.sourceDocId);
  if (!src || src.caseId !== r.caseId) return null;
  if (editor.state.riWalkItem && !src.items.some((it) => it.id === editor.state.riWalkItem && !it.withdrawn && !(r.results[it.id] || {}).carried))
    return null;
  return src;
}

function reinspectionEnsureWalkContext(services) {
  const r = editor.state.screen === "reinspect" && reinsp(editor.state.reinspId);
  const src = walkContextSource(services, r);
  if (!src) {
    reinspectionClearWalk(services);
    return false;
  }
  if (editor.state.riWalkUndo && !src.items.some((it) => it.id === editor.state.riWalkUndo.itemId && !it.withdrawn)) editor.state.riWalkUndo = null;
  editor.state.riWalkSkipped = editor.state.riWalkSkipped.filter((id) =>
    src.items.some((it) => it.id === id && !it.withdrawn && !(r.results[id] || {}).carried),
  );
  return true;
}

function reinspectionNextWalkItem(services, r) {
  const src = r && doc(r.sourceDocId);
  return (src && src.items.find((it) => !it.withdrawn && !(r.results[it.id] || {}).carried && !ocOf(r, it.id))) || null;
}

function reinspectionFocusWalkItem(services) {
  const current = document.querySelector('[data-ri-walk-current="true"]');
  if (!current) {
    document.querySelector('[data-riwalk="off"]')?.focus();
    return;
  }
  const action = current.querySelector("[data-setoc]:not([disabled])");
  if (action) action.focus();
  else current.focus();
  if (current.scrollIntoView) current.scrollIntoView({ block: "center", behavior: "smooth" });
}

function reinspectionFocusWalkDetails(services) {
  const current = document.querySelector('[data-ri-walk-current="true"]');
  const el = current?.querySelector("[data-rinote], [data-ridate]");
  if (el) {
    el.focus();
    el.scrollIntoView?.({ block: "center" });
  } else reinspectionFocusWalkItem(services);
}

// The item's result date is real and between the initial inspection and this visit.
function walkResultDated(services, r, result) {
  const source = doc(r.sourceDocId),
    on = result.manualDate ? result.on : result.on || r.date;
  return services.inspection.validISO(on) && !(on < docCase(source).date) && !(on > r.date);
}

function reinspectionWalkItemReady(services, r, id) {
  if (!reinspectionEditableWalkItem(services, r, id)) return false;
  const result = r.results[id] || {},
    intent = r.followupIntent || "undecided";
  if (!result.oc || !walkResultDated(services, r, result)) return false;
  if (result.oc === "corrected") return true;
  return !["extension", "bestInterestExtension", "citation"].includes(intent) || reinspectionDueCheck(services, result.due, r.date).ok;
}

function reinspectionAdvanceWalk(services, r) {
  if (!editor.state.riWalk || !reinspectionEnsureWalkContext(services)) return false;
  if (
    editor.state.riWalkStage === "details" &&
    editor.state.riWalkItem &&
    !reinspectionWalkItemReady(services, r, editor.state.riWalkItem) &&
    !editor.state.riWalkSkipped.includes(editor.state.riWalkItem)
  ) {
    services.ui.toast("This item needs a valid date and, for an extension or citation, a new due date. Use Skip for now to continue.");
    reinspectionFocusWalkDetails(services);
    return false;
  }
  const next = reinspectionNextWalkItem(services, r);
  editor.state.riWalkItem = next?.id || null;
  editor.state.riWalkStage = "outcome";
  services.authoring.scheduleDraftSave();
  services.ui.render();
  reinspectionFocusWalkItem(services);
  return true;
}

function reinspectionSkipWalkDetails(services, r) {
  if (!editor.state.riWalk || !reinspectionEnsureWalkContext(services) || editor.state.riWalkStage !== "details") return false;
  if (!editor.state.riWalkSkipped.includes(editor.state.riWalkItem)) editor.state.riWalkSkipped.push(editor.state.riWalkItem);
  services.authoring.scheduleDraftSave();
  return reinspectionAdvanceWalk(services, r);
}

function reinspectionReturnWalkDetails(services, r) {
  if (!editor.state.riWalk || !reinspectionEnsureWalkContext(services)) return false;
  const src = doc(r.sourceDocId),
    item = src.items.find(
      (it) =>
        reinspectionEditableWalkItem(services, r, it.id) &&
        (!reinspectionWalkItemReady(services, r, it.id) || editor.state.riWalkSkipped.includes(it.id)),
    );
  if (!item) return false;
  editor.state.riWalkItem = item.id;
  editor.state.riWalkStage = ocOf(r, item.id) ? "details" : "outcome";
  editor.state.riWalkSkipped = editor.state.riWalkSkipped.filter((id) => id !== item.id);
  services.authoring.scheduleDraftSave();
  services.ui.render();
  editor.state.riWalkStage === "details" ? reinspectionFocusWalkDetails(services) : reinspectionFocusWalkItem(services);
  return true;
}

function reinspectionPreviousWalk(services, r) {
  if (!editor.state.riWalk || !reinspectionEnsureWalkContext(services)) return false;
  const src = doc(r.sourceDocId),
    eligible = src.items.filter((i) => reinspectionEditableWalkItem(services, r, i.id));
  const ix = eligible.findIndex((i) => i.id === editor.state.riWalkItem),
    prior = eligible[ix < 0 ? eligible.length - 1 : ix - 1];
  if (!prior) return false;
  editor.state.riWalkItem = prior.id;
  editor.state.riWalkStage = ocOf(r, prior.id) ? "details" : "outcome";
  services.authoring.scheduleDraftSave();
  services.ui.render();
  editor.state.riWalkStage === "details" ? reinspectionFocusWalkDetails(services) : reinspectionFocusWalkItem(services);
  return true;
}

function walkSourceItem(r, id) {
  const src = r && doc(r.sourceDocId);
  return src && src.caseId === r.caseId && src.items.find((x) => x.id === id);
}

const walkVisitOpen = (r) => editor.state.screen === "reinspect" && r && r.id === editor.state.reinspId && r.draft && !r.docId;

function reinspectionEditableWalkItem(services, r, id) {
  const it = walkSourceItem(r, id);
  return !!(walkVisitOpen(r) && it && !it.withdrawn && !(r.results[id] || {}).carried);
}

// An outcome may be recorded only on an editable item, with a known outcome, inside a still-valid walk.
function walkOutcomeRefused(services, r, id, outcome) {
  if (!reinspectionEditableWalkItem(services, r, id) || !OUTCOMES.some((o) => o.id === outcome)) return true;
  return editor.state.riWalk && (!reinspectionEnsureWalkContext(services) || !editor.state.riWalk);
}

// In a walk, the item stays open for its details or the next unanswered item comes into focus.
function advanceWalkAfterOutcome(services, r, id) {
  if (editor.state.riWalkMode === "details") {
    editor.state.riWalkItem = id;
    editor.state.riWalkStage = "details";
  } else {
    const next = reinspectionNextWalkItem(services, r);
    editor.state.riWalkItem = (next && next.id) || null;
    editor.state.riWalkStage = "outcome";
  }
}

function repaintAfterOutcome(services) {
  if (editor.state.riWalk) {
    services.ui.render();
    editor.state.riWalkStage === "details" ? reinspectionFocusWalkDetails(services) : reinspectionFocusWalkItem(services);
  } else services.ui.renderKeep();
}

function reinspectionRecordReinspectionOutcome(services, id, outcome) {
  const r = reinsp(editor.state.reinspId);
  if (walkOutcomeRefused(services, r, id, outcome)) return false;
  const cur = r.results[id] || {};
  if (cur.oc === outcome) return false;
  const before = Object.prototype.hasOwnProperty.call(r.results, id) ? clone(cur) : null;
  const result = recordedOutcomeResult(cur, outcome, r);
  if (editor.state.riWalk) editor.state.riWalkUndo = { context: reinspectionWalkIdentity(services, r), itemId: id, before, after: clone(result) };
  else editor.state.riWalkUndo = null;
  r.results[id] = result;
  editor.state.riWalkSkipped = editor.state.riWalkSkipped.filter((x) => x !== id);
  if (editor.state.riWalk) advanceWalkAfterOutcome(services, r, id);
  workspace.DIRTY = true;
  services.authoring.scheduleDraftSave();
  repaintAfterOutcome(services);
  return true;
}

function walkUndoUnavailable(services, r, undo) {
  return (
    !editor.state.riWalk ||
    !reinspectionEnsureWalkContext(services) ||
    !undo ||
    undo.context !== reinspectionWalkIdentity(services, r) ||
    !reinspectionEditableWalkItem(services, r, undo.itemId)
  );
}

// An untouched result returns to its earlier state; one edited since keeps its later details and loses only the outcome.
function restoreWalkUndo(services, r, undo, current) {
  if (stableJSON(current) === stableJSON(undo.after)) {
    if (undo.before) r.results[undo.itemId] = clone(undo.before);
    else delete r.results[undo.itemId];
  } else {
    r.results[undo.itemId] = { ...clone(current), oc: undo.before?.oc || "" };
    services.ui.toast("Outcome undone; later note, date and due details were kept on this item.");
  }
}

function reinspectionUndoWalkOutcome(services) {
  const r = reinsp(editor.state.reinspId),
    undo = editor.state.riWalkUndo;
  if (walkUndoUnavailable(services, r, undo)) return false;
  const current = r.results[undo.itemId];
  if (!current || current.oc !== undo.after.oc) {
    services.ui.toast("The outcome changed since Undo was recorded. Review the item before changing it.");
    return false;
  }
  restoreWalkUndo(services, r, undo, current);
  editor.state.riWalkUndo = null;
  editor.state.riWalkItem = undo.itemId;
  editor.state.riWalkStage = "outcome";
  workspace.DIRTY = true;
  services.authoring.scheduleDraftSave();
  services.ui.render();
  reinspectionFocusWalkItem(services);
  return true;
}

const narrativeFirstDate = (k, first) => (first && k.date) || k.date || (first || {}).created;
const narrativeSourceLabel = (src) => (DOC_TYPES.find((t) => t.id === (src || {}).type) || {}).label || "notice";
const narrativeFinding = (oc) => (OUTCOMES.find((o) => o.id === oc) || {}).found || "the violation uncorrected";

function reinspectionNarrativeFor(services, r, it) {
  const k = kase(r.caseId),
    src = doc(r.sourceDocId),
    oc = ocOf(r, it.id),
    res = r.results[it.id] || {};
  const firstDate = narrativeFirstDate(k, originalNotice(r.caseId));
  const what = String(it.title || "the violation").replace(/\.$/, "");
  const label = narrativeSourceLabel(src);
  const art = /^[AEIOU]/i.test(label) ? "An " : "A ";
  return (
    "Initial inspection on " +
    services.inspection.fmtDate(firstDate) +
    " documented the following violation: " +
    what +
    ". " +
    art +
    label.toLowerCase() +
    " was issued with a compliance date of " +
    services.inspection.fmtDate(it.due) +
    ". Re-inspection on " +
    services.inspection.fmtDate(res.on || r.date) +
    " found " +
    narrativeFinding(oc) +
    "." +
    (res.note ? " " + String(res.note).trim().replace(/\s+/g, " ") : "")
  );
}

function reinspectionAttachCheckTargets(services, d, c) {
  if (c.ok || c.targets?.length) return c;
  const t = c.t.toLowerCase(),
    targets = [],
    add = (s, l, a) => targets.push(checkTarget(s, l, a));
  const visit = () => add("#btn-editvisit", "Review inspection", "visit");
  // The parcel comes only from the Accela import; its check names that correction instead of a field.
  if (/parcel/.test(t)) return c;
  if (!attachIdentityCheckTargets(d, t, add)) attachContentCheckTargets(services, d, t, add, visit);
  // Record conflicts have no editable field. Direct the inspector to the existing case.
  if (!targets.length) add('[data-nav="cases"]', "Open case in Workspace", "workspace");
  return { ...c, targets };
}

function reinspectionCheckRowHTML(services, c, ix, worksheet = false) {
  return html`<div class="check ${c.ok ? "pass" : c.soft ? "note" : "fail"}"><span class="m">${c.ok ? "✓" : c.soft ? "·" : "!"}</span><div><span id="check-msg-${worksheet ? "visit" : "doc"}-${ix}">${c.t}</span>${raw(
    !c.ok
      ? html`<div class="check-links">${raw(
          (c.targets || [])
            .map(
              (target, n) =>
                html`<button type="button" class="check-link" data-check-index="${ix}" data-check-target="${n}" ${raw(worksheet === true ? html`data-check-worksheet="1"` : "")}>${target.label}</button>`,
            )
            .join(""),
        )}</div>`
      : "",
  )}</div></div>`;
}

/* Worksheet checks are calculated from the visit and an explicit view of lookups (reinspectionWorksheetLookups),
   each read at the original point and in the original order. */
const worksheetDueTarget = (i) => checkTarget('[data-ridue="' + checkAttr(i.id) + '"]', "Item " + i.no + " new due date");

function worksheetDateChecks(r, src, view, add) {
  const initial = view.caseOf(src).date || "",
    earliest = view.inspectionOf(src).date || initial;
  if (!view.validISO(r.date) || r.date > view.today() || r.date < earliest)
    add("Inspection date must be between the source inspection and today.", "#ri-date", "Reinspection date");
  if (!view.parseTime(r.time)) add("Enter the reinspection time before generating a document.", "#ri-time", "Reinspection time");
  if (!view.inspectorOf(r.inspectorId).name) add("Select the inspector who performed this inspection.", "#ri-insp", "Inspector");
  return initial;
}

function worksheetItemCheck({ r, i, initial, dueRelevant, view, add, out }) {
  const res = r.results[i.id] || {},
    on = res.manualDate ? res.on : res.on || r.date;
  if (i.done || i.withdrawn || citationOnlyItem(i)) return;
  if (!OUTCOMES.some((o) => o.id === res.oc)) {
    add("Item " + i.no + ": choose an outcome.", '[data-setoc][data-item="' + checkAttr(i.id) + '"]', "Item " + i.no + " outcome");
    return;
  }
  if (!view.validISO(on) || on < initial || on > r.date)
    add(
      "Item " + i.no + ": result date must be between the initial inspection and this visit.",
      '[data-ridate="' + checkAttr(i.id) + '"]',
      "Item " + i.no + " result date",
    );
  worksheetItemDueCheck({ i, res, dueRelevant, view, out });
}

function worksheetItemDueCheck({ i, res, dueRelevant, view, out }) {
  if (dueRelevant && res.oc !== "corrected" && !view.dueCheck(res.due, view.today()).ok)
    out.push({
      ok: false,
      soft: true,
      t: "Item " + i.no + ": set a future due date for an extension or citation. Referrals need no due date.",
      targets: [worksheetDueTarget(i)],
    });
}

function worksheetDueChecks(r, dueRelevant, view, out) {
  if (dueRelevant && distinctDues(view.dueContext(r, true)).length > 3)
    out.push({
      ok: false,
      t: "Use no more than three distinct due dates for an extension or citation.",
      targets: view.dueContext(r, true).map(worksheetDueTarget),
    });
  const spacing = view.dueSpacing(r);
  if (dueRelevant && spacing.length) {
    const items = [...new Map(spacing.flatMap((x) => x.items).map((i) => [i.id, i])).values()];
    out.push({ ok: false, t: "Keep distinct due dates at least seven days apart.", targets: items.map(worksheetDueTarget) });
  }
}

// Every worksheet check for a recorded visit, in display order; [] when its source document is gone.
function worksheetCheckList(r, view) {
  const src = view.documentOf(r.sourceDocId);
  if (!src) return [];
  const out = [],
    add = (t, selector, label) => out.push({ ok: false, t, targets: [checkTarget(selector, label)] });
  const dueRelevant =
    !r.followupIntent || r.followupIntent === "undecided" || ["extension", "bestInterestExtension", "citation"].includes(r.followupIntent);
  const initial = worksheetDateChecks(r, src, view, add);
  src.items.forEach((i) => worksheetItemCheck({ r, i, initial, dueRelevant, view, add, out }));
  worksheetDueChecks(r, dueRelevant, view, out);
  for (const t of view.worksheetFaults(r))
    if (!out.some((c) => c.t === t) && !/outcome|Result dates/.test(t))
      out.push({ ok: false, t, targets: [checkTarget('[data-nav="cases"]', "Open case in Workspace", "workspace")] });
  return out;
}

// The live reads worksheet checks use; every service is resolved when the lookup is called.
function reinspectionWorksheetLookups(services) {
  return {
    documentOf: doc,
    caseOf: docCase,
    inspectorOf: insp,
    inspectionOf: (d) => services.inspection.inspAt(d),
    validISO: (value) => services.inspection.validISO(value),
    parseTime: (value) => services.inspection.parseTime(value),
    dueContext: (r, all) => services.inspection.dueContext(r, all),
    // The spacing service is resolved before its due context, exactly as the original expression did.
    dueSpacing: (r) => services.inspection.dueDateSpacingConflicts(services.inspection.dueContext(r, true)),
    worksheetFaults: (r) => services.inspection.worksheetFaults(r),
    dueCheck: (due, from) => reinspectionDueCheck(services, due, from),
    today: () => recordDay(today),
  };
}

function reinspectionWorksheetChecks(services, r) {
  return worksheetCheckList(r, reinspectionWorksheetLookups(services));
}

function reinspectionWorksheetCheckPanel(services, r) {
  return worksheetCheckPanelHTML(reinspectionWorksheetChecks(services, r), (...args) => reinspectionCheckRowHTML(services, ...args));
}

function reinspectionHighlightOpenChecks(services) {
  document.querySelectorAll(".check-open").forEach((el) => {
    el.classList.remove("check-open");
    el.removeAttribute("data-open-check");
    if (el.dataset.checkDesc) {
      el.removeAttribute("data-check-desc");
      el.removeAttribute("aria-describedby");
    }
    el.removeAttribute("aria-invalid");
  });
  const d = doc(editor.state.docId),
    r = reinsp(editor.state.reinspId);
  const list =
    editor.state.screen === "write" && d && !services.inspection.isLocked(d)
      ? services.inspection.checks(d)
      : editor.state.screen === "reinspect" && r && r.draft && !r.docId
        ? reinspectionWorksheetChecks(services, r)
        : [];
  list.forEach((c, ix) => {
    if (c.ok) return;
    (c.targets || []).forEach((t) => {
      if (t.action && !["contacts"].includes(t.action) && !t.action.startsWith("recipient:")) return;
      document.querySelectorAll(t.selector).forEach((el) => {
        el.classList.add("check-open");
        el.setAttribute("data-open-check", c.t);
        const id =
          (editor.state.screen === "write" && !editor.state.modal ? "editor-" : "") +
          "check-msg-" +
          (editor.state.screen === "reinspect" ? "visit" : "doc") +
          "-" +
          ix;
        if (document.getElementById(id) && !el.getAttribute("aria-describedby")) {
          el.setAttribute("aria-describedby", id);
          el.dataset.checkDesc = id;
        }
        if (!c.soft) el.setAttribute("aria-invalid", "true");
      });
    });
  });
}

function reinspectionFocusCheckTarget(services, target, message) {
  const d = doc(editor.state.docId);
  services.inspection.captureWork();
  editor.state.modal = null;
  editor.state.picker = false;
  if (focusAdministrativeCheckTarget(services, d, target)) return;
  if (target.action === "visit") {
    target = worksheetVisitCheckTarget(services, d);
    if (!target) return;
  } else showCheckTargetScreen(services, target);
  if (target.action === "guidance") {
    services.ui.toast(message);
    return;
  }
  revealCheckTarget(services, target, message);
}

// Returns to the recorded visit's worksheet and targets its first blocking check; null when there is none to open.
function worksheetVisitCheckTarget(services, d) {
  if (!d || !services.inspection.returnToWorksheet(d)) {
    services.ui.toast("Open the existing case in Workspace to review its recorded inspection.");
    return null;
  }
  const r = reinsp(editor.state.reinspId);
  editor.state.riFilter = "";
  reinspectionClearWalk(services);
  editor.WORK.walk = null;
  services.ui.render();
  const check = reinspectionWorksheetChecks(services, r).find((c) => !c.soft) || reinspectionWorksheetChecks(services, r)[0];
  return check?.targets[0] || checkTarget("#ri-date", "Reinspection date");
}

function showCheckTargetScreen(services, target) {
  if (editor.state.screen === "reinspect") {
    editor.state.riFilter = "";
    reinspectionClearWalk(services);
    editor.WORK.walk = null;
  }
  if (target.action === "contacts") editor.state.modal = "cc";
  services.ui.render();
}

function revealCheckTarget(services, target, message) {
  const el = document.querySelector(target.selector);
  if (!el) {
    services.ui.toast(message + " Open the existing case to review the retained record.");
    return;
  }
  for (let parent = el.parentElement; parent; parent = parent.parentElement) if (parent.tagName === "DETAILS") parent.open = true;
  el.classList.add("check-focus");
  el.setAttribute("tabindex", el.getAttribute("tabindex") || "0");
  el.scrollIntoView?.({ behavior: "smooth", block: "center" });
  el.focus({ preventScroll: true });
  setTimeout(() => el.classList.remove("check-focus"), 2200);
}

function reinspectionDueCheck(services, due, from) {
  if (!due) return { ok: false, msg: "Needs a new due date" };
  if (!services.inspection.validISO(due) || !services.inspection.validISO(from || recordDay(today)))
    return { ok: false, msg: "Enter a real calendar date" };
  const n = daysBetween(from || recordDay(today), due);
  if (n < 1) return { ok: false, msg: "Must be a future date" };
  if (n < 7) return { ok: true, warn: true, msg: n + " day" + (n === 1 ? "" : "s") + " — unusually short" };
  if (n > 180) return { ok: true, warn: true, msg: n + " days — unusually long" };
  return { ok: true, msg: n + " days" };
}

function reinspectionScreenReinspect(services) {
  const r = reinsp(editor.state.reinspId);
  if (!r) {
    editor.state.screen = "cases";
    return services.ui.screenCases();
  }
  const k = kase(r.caseId),
    src = doc(r.sourceDocId);
  if (!src) {
    editor.state.screen = "cases";
    return services.ui.screenCases();
  }
  const srcLabel = (DOC_TYPES.find((t) => t.id === src.type) || {}).label || src.type;
  const closed = !!r.docId,
    readOnly = closed || !r.draft;
  const shown = (it) => worksheetItemShown({ r, it });
  const rows = src.items
    .filter(shown)
    .map((it) => worksheetItemHTML({ it, src, r, readOnly, dueCheck: (...args) => reinspectionDueCheck(services, ...args), services }))
    .join("");
  const done = doneItems(r).length,
    open = openItems(r).length,
    left = unchecked(r).length;
  const activeCount = src.items.filter((it) => !it.withdrawn).length;
  const recorded = activeCount - left,
    withdrawn = src.items.length - activeCount;
  const next = editor.state.riWalk ? reinspectionNextWalkItem(services, r) : null;
  const rowsShown = src.items.filter((it) => worksheetItemShown({ r, it })).length;
  const cited = openItems(r).filter((i) => (r.results[i.id] || {}).cite);
  const badDue = openItems(r).filter((i) => !reinspectionDueCheck(services, (r.results[i.id] || {}).due, r.date).ok);
  const prior = reinspFor(r.caseId).filter((x) => x.id !== r.id && x.docId);
  const referred = isReferredCase(r.caseId);
  const walkPanel = worksheetWalkHTML({
    r,
    readOnly,
    src,
    left,
    next,
    editableWalkItem: (...args) => reinspectionEditableWalkItem(services, ...args),
    walkItemReady: (...args) => reinspectionWalkItemReady(services, ...args),
  });
  const verdict = worksheetVerdictHTML({ closed, r, open, left, srcLabel, badDue, done, referred });

  return services.ui.shell(
    k.address,
    `${k.number} · Reinspection · working off the ${srcLabel.toLowerCase()}`,
    '<button class="btn" id="btn-savework">Save draft &amp; return to Workspace</button>',
    worksheetVisitHeaderHTML({ walkIdentity: (...args) => reinspectionWalkIdentity(services, ...args), r, srcLabel, services, src, readOnly }) +
      worksheetProgressHTML({ recorded, activeCount, left, withdrawn }) +
      worksheetFiltersHTML({ done, open, left, cited, src }) +
      worksheetBodyHTML({
        walkPanel,
        rowsShown,
        src,
        prior,
        services,
        left,
        r,
        rows,
        readOnly,
        worksheetChecks: (...args) => reinspectionWorksheetChecks(services, ...args),
        worksheetCheckPanel: (...args) => reinspectionWorksheetCheckPanel(services, ...args),
        verdict,
        closed,
      }),
  );
}

function reinspectionDocFromReinspection(services, r, type) {
  if (reopenFollowupDraft(services, r)) return;
  const src = doc(r.sourceDocId),
    carry = openItems(r);
  if (!followupDraftAllowed(services, r, type, src, carry)) return;
  const nd = buildFollowupDraft(services, r, type, src);
  workspace.DOCS.unshift(nd);
  if (REFERRED_ONLY.indexOf(type) < 0 && isReferredCase(r.caseId)) {
    workspace.DOCS = workspace.DOCS.filter((x) => x.id !== nd.id);
    services.ui.toast("This case is with the City Attorney — only an updated referral or a compliance letter can be written now");
    return;
  }
  if (type === "citation" && !prepareFollowupCitations(services, r, src, nd, (...args) => reinspectionNarrativeFor(services, ...args))) return;
  r.docId = nd.id;
  editor.state.docId = nd.id;
  editor.state.screen = "write";
  workspace.DIRTY = true;
  services.authoring.saveDrafts();
  services.ui.render();
  if (type === "citation") services.authoring.depositStep.openNext(nd);
  const n = nd.items.filter((i) => i.cite).length,
    cl = nd.items.filter((i) => i.done).length;
  services.ui.toast(followupDraftMessage(type, carry, n, cl));
}

export function createReinspection(services) {
  return {
    walkIdentity: (...args) => reinspectionWalkIdentity(services, ...args),
    clearWalk: (...args) => reinspectionClearWalk(services, ...args),
    restoreWalkFor: (...args) => reinspectionRestoreWalkFor(services, ...args),
    ensureWalkContext: (...args) => reinspectionEnsureWalkContext(services, ...args),
    nextWalkItem: (...args) => reinspectionNextWalkItem(services, ...args),
    focusWalkItem: (...args) => reinspectionFocusWalkItem(services, ...args),
    walkItemReady: (...args) => reinspectionWalkItemReady(services, ...args),
    advanceWalk: (...args) => reinspectionAdvanceWalk(services, ...args),
    skipWalkDetails: (...args) => reinspectionSkipWalkDetails(services, ...args),
    returnWalkDetails: (...args) => reinspectionReturnWalkDetails(services, ...args),
    previousWalk: (...args) => reinspectionPreviousWalk(services, ...args),
    editableWalkItem: (...args) => reinspectionEditableWalkItem(services, ...args),
    recordReinspectionOutcome: (...args) => reinspectionRecordReinspectionOutcome(services, ...args),
    undoWalkOutcome: (...args) => reinspectionUndoWalkOutcome(services, ...args),
    narrativeFor: (...args) => reinspectionNarrativeFor(services, ...args),
    attachCheckTargets: (...args) => reinspectionAttachCheckTargets(services, ...args),
    worksheetChecks: (...args) => reinspectionWorksheetChecks(services, ...args),
    highlightOpenChecks: (...args) => reinspectionHighlightOpenChecks(services, ...args),
    focusCheckTarget: (...args) => reinspectionFocusCheckTarget(services, ...args),
    dueCheck: (...args) => reinspectionDueCheck(services, ...args),
    checkRowHTML: (...args) => reinspectionCheckRowHTML(services, ...args),
    screenReinspect: (...args) => reinspectionScreenReinspect(services, ...args),
    docFromReinspection: (...args) => reinspectionDocFromReinspection(services, ...args),
    focusWalkDetails: (...args) => reinspectionFocusWalkDetails(services, ...args),
    worksheetCheckPanel: (...args) => reinspectionWorksheetCheckPanel(services, ...args),
  };
}
