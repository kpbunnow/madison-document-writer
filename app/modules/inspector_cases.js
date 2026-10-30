/* Open cases by inspector: picker, result list and the "import a new inspection" prompt. Markup builders and
   one decision are pure; the owner that wires them to the helper and navigation is workflow_events.js. */
import { INSPECTORS } from "./data/inspectors.js";
import { editorState as editor } from "./editor_state.js";
import { caseNumberKey } from "../assets/shared.js";
import { fmtDate } from "./presentation_format.js";
import { html, raw } from "./screen_html.js";

export const UNASSIGNED = "unassigned";
const UNASSIGNED_LABEL = "Unassigned or former inspector";

export function inspectorName(id) {
  return id === UNASSIGNED ? UNASSIGNED_LABEL : INSPECTORS.find((i) => i.id === id)?.name || "";
}

export function inspectorPickerHTML() {
  return html`<form id="inspector-cases-form"><h3>Open cases by inspector</h3><label>Inspector <select name="inspector" required><option value="">Choose an inspector</option>${raw(
    INSPECTORS.map((i) => html`<option value="${i.id}">${i.name}</option>`).join(""),
  )}<option value="${UNASSIGNED}">${UNASSIGNED_LABEL}</option></select></label><button class="btn" type="submit">Show open cases</button></form><div id="inspector-case-prompt" aria-live="polite"></div><div id="inspector-case-results" aria-live="polite"></div>`;
}

function dueText(day) {
  return day ? "Next due " + fmtDate(day) : "No open deadline";
}

export function inspectorResultsHTML(result, inspector) {
  const who = inspectorName(inspector),
    cases = result.cases || [];
  const notes = [];
  if (result.incomplete)
    notes.push(
      html`<p role="status">${result.incomplete} case ${result.incomplete === 1 ? "file was" : "files were"} not included because ${result.incomplete === 1 ? "its" : "their"} summary is missing, out of date or unreadable. This list may be incomplete.</p>`,
    );
  if (result.partial) notes.push(html`<p role="status">Showing the first ${cases.length} of ${result.total} open cases.</p>`);
  const rows = cases.map(
    (c) =>
      html`<li><strong>${c.number}</strong> · ${c.address} · ${c.owner} · ${c.status} · ${dueText(c.nextDue)} <button class="btn" type="button" data-inspector-case="${c.number}">Continue case</button></li>`,
  );
  return (
    html`<p>${result.total} open ${result.total === 1 ? "case" : "cases"} for ${who}.</p>` +
    notes.join("") +
    (rows.length ? "<ul>" + rows.join("") + "</ul>" : "")
  );
}

/* What "import a new inspection" can do right now. An import already awaiting review for this case is continued;
   one for a different case must be finished first, because opening Import inspection would show it instead. */
export function importTarget(number, acc = editor.state.acc || editor.WORK.acc) {
  if (!acc) return { kind: "search" };
  const awaiting = acc.cases && acc.cases[acc.caseIx || 0];
  if (awaiting && caseNumberKey(awaiting.number) === caseNumberKey(number)) return { kind: "continue" };
  return { kind: "blocked", number: awaiting?.number || "", label: awaiting?.number || acc.fileName || "another inspection" };
}

/* Import inspection reads this saved entry for its case-number box. */
export function prefillLookup(number) {
  editor.WORK.entry["lookup-number"] = number;
}

export function importPromptHTML(number) {
  const target = importTarget(number);
  const open = html`<button class="btn" type="button" data-global-open="${number}">Open case without importing</button> <button class="btn" type="button" data-inspector-cancel>Back to list</button>`;
  if (target.kind === "blocked")
    return html`<div class="banner warn" role="alert"><div><strong>Finish the current import first.</strong><p>An import for ${target.label} is waiting for review. Finish or cancel it from Import inspection, then continue ${number}.</p></div></div><p>${raw(open)} <button class="btn" type="button" data-nav="import">Go to the import in progress</button></p>`;
  if (target.kind === "continue")
    return html`<div class="banner info" role="alert"><div><strong>An inspection for ${number} is already imported.</strong><p>Continue with it, or open the case without importing.</p></div></div><p><button class="btn btn-primary" type="button" data-inspector-import="${number}">Continue the imported inspection</button> ${raw(open)}</p>`;
  return html`<div class="banner info" role="alert"><div><strong>Import a new inspection result to continue ${number}.</strong><p>Import inspection opens with this case number ready to look up in the City database.</p></div></div><p><button class="btn btn-primary" type="button" data-inspector-import="${number}">Import inspection</button> ${raw(open)}</p>`;
}
