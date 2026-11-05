import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { nowISO } from "./calendar.js";
import { html, raw } from "./screen_html.js";

/* Owner request 2026-11-05: the workspace is cleared every time Document Writer closes. Exit Document Writer clears it
   after the helper stops; a session that ended without Exit (window closed, PC shut down) is cleared at the next start.
   Unfinished work is never cleared silently: the inspector is warned and confirms first. Shared case records are not
   touched, and queued shared saves and PDF transfers are not workspace work: they stay queued and are retried. A case
   whose save confirmation is still pending cannot be removed and is kept. */

const SESSION_KEY = "session";

/* Each piece of work on this device that is not in the shared folder, as text for the warning. */
export function unfinishedWork(caseUnsaved) {
  const items = workspace.CASES.map((k) => [k, caseUnsaved(k)])
    .filter(([, reason]) => reason)
    .map(([k, reason]) => (k.number || "A case") + ": " + reason);
  if (editor.state.acc || editor.WORK?.acc || String(editor.WORK?.entry?.["lookup-number"] || "").trim())
    items.push("An inspection import in progress");
  return items;
}

const hasWorkspace = () => workspace.CASES.length > 0 || !!editor.state.acc || !!editor.WORK?.acc || Object.keys(editor.WORK?.entry || {}).length > 0;

/* Remove every case from the workspace (removeCase keeps one with a pending save confirmation), and the import work. */
export async function clearWorkspace({ removeCase, saveDrafts }) {
  workspace.CASES.slice().forEach((k) => removeCase(k.id));
  editor.state.acc = null;
  editor.WORK.acc = null;
  editor.WORK.entry = {};
  editor.state.docId = null;
  editor.state.reinspId = null;
  await saveDrafts();
  return workspace.CASES.length;
}

export async function markSessionClosed(idbSet) {
  await idbSet(SESSION_KEY, { open: false, at: nowISO() });
}

/* At start: did the last session end without Exit? A session belongs to one run of the helper (its instance, served in
   the page), so reloading the page while Document Writer keeps running is not a close. This session is recorded as open
   either way. Without a helper instance nothing can be told apart, and nothing is cleared. */
async function previousSessionOpen({ idbGet, idbSet, instance }) {
  const current = instance();
  let previous = null;
  try {
    previous = await idbGet(SESSION_KEY);
  } catch (error) {
    previous = null;
  }
  await idbSet(SESSION_KEY, { open: true, instance: current, at: nowISO() });
  return !!(current && previous?.open && previous.instance !== current);
}

function warningHTML(items, action) {
  return html`<section aria-labelledby="clear-unfinished-title" data-clear-unfinished><h3 id="clear-unfinished-title">This work is not in the shared folder</h3><ul>${raw(
    items.map((item) => html`<li>${item}</li>`).join(""),
  )}</ul><p>Download a workspace backup first if you may need it. Clearing removes it from this device; shared case records are not deleted.</p><button class="btn" type="button" data-workbackup>Download workspace backup</button><label><input type="checkbox" name="clearUnfinished" required> ${action}</label></section>`;
}

/* The Exit dialog's section about clearing, and whether the request may proceed. */
export function exitClearHTML(caseUnsaved) {
  if (!hasWorkspace()) return "";
  const items = unfinishedWork(caseUnsaved);
  return (
    '<section aria-labelledby="exit-clear-title" data-exit-clear><h3 id="exit-clear-title">The workspace is cleared</h3><p>Exit removes the cases, drafts, worksheets and notes from this workspace. Open a case again from Import inspection next time.</p></section>' +
    (items.length ? warningHTML(items, "Clear this unfinished work when Document Writer exits.") : "")
  );
}

export const exitClearConfirmed = (form, caseUnsaved) => !unfinishedWork(caseUnsaved).length || !!form.elements.clearUnfinished?.checked;

/* At start, after the drafts are restored: clear what a session left behind when it ended without Exit. Saved work is
   cleared at once; unfinished work waits for the inspector's confirmation in a dialog. */
export async function startSession(services) {
  if (!(await previousSessionOpen(services)) || !hasWorkspace()) return;
  const items = unfinishedWork(services.caseUnsaved);
  if (!items.length) {
    await clearWorkspace(services);
    return;
  }
  setTimeout(() => offerStartupClear(services, items), 0);
}

function offerStartupClear(services, items) {
  services.A11Y.utility(
    "Document Writer was not exited last time",
    html`<form data-startup-clear-form><p>The workspace is cleared each time Document Writer closes. It was closed without Exit Document Writer, so the work below is still on this device.</p>${raw(
      warningHTML(items, "Clear this unfinished work now."),
    )}<p role="alert" data-startup-clear-error></p><button class="btn btn-primary" type="submit">Clear the workspace</button></form><p class="hint">Close keeps the work for now; it is offered for clearing again when Document Writer next starts after it was not exited.</p>`,
  );
  const form = document.querySelector("[data-startup-clear-form]");
  if (!form) return;
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (!form.elements.clearUnfinished?.checked) return;
    const kept = await clearWorkspace(services);
    document.getElementById("utility-dialog")?.close();
    editor.state.screen = "cases";
    services.render();
    services.toast(kept ? kept + " case(s) with a pending save confirmation were kept." : "The workspace was cleared.");
  };
}
