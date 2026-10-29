import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { recoveryState as recovery } from "./recovery_state.js";
import { startupState as startup } from "./startup_state.js";
/* Exit Document Writer: save this device's drafts, review unresolved work, then ask the helper to stop.
   The helper refuses (409) while it is doing work it knows about; this review adds what only this window
   knows. Queued items stay queued on this device; they are never described as being in the shared folder. */

import { app_savedworkContext, captureWork, saveDrafts, backupUnfinished, recoveryJobs } from "./app_core.js";
import { exitReview, plural } from "./exit_review.js";
import { authFetch } from "./helper_transport.js";
import { announceStop, helperStop, listenForStop, showStopped } from "./helper_stopped.js";

function currentReview() {
  return exitReview(app_savedworkContext(), {
    publication: !!(editor.state.publicationBusy || editor.AMENDMENT_BUSY),
    filing: (editor.FILING_ACTIVE || 0) > 0,
  });
}

function itemsHTML(R, items) {
  return "<ul>" + items.map((item) => "<li><strong>" + R.esc(item.text) + "</strong> " + R.esc(item.guidance) + "</li>").join("") + "</ul>";
}

function exitDialogHTML(R, review) {
  const blocked = review.blocking.length > 0;
  return (
    '<form id="exit-writer-form" data-exit-writer-form><p>Exit stops Document Writer on this computer. This window and any other ' +
    "open Writer or Reports windows lose their connection until Document Writer is started again.</p><ul>" +
    "<li>Drafts saved on this device stay on this device.</li>" +
    "<li>Queued shared saves and PDF transfers stay queued on this device and resume when Document Writer starts again. " +
    "They are not in the shared folder until then.</li>" +
    "<li>To start again, double-click Document Writer on the desktop.</li></ul>" +
    (blocked
      ? '<section aria-labelledby="exit-blocking-title" data-exit-blocking><h3 id="exit-blocking-title">Finish this first</h3>' +
        itemsHTML(R, review.blocking) +
        "<p>Document Writer cannot exit while this work is in progress.</p></section>"
      : "") +
    (review.unresolved.length
      ? '<section aria-labelledby="exit-unresolved-title" data-exit-unresolved><h3 id="exit-unresolved-title">Not yet in the shared folder</h3>' +
        itemsHTML(R, review.unresolved) +
        (blocked
          ? ""
          : '<label><input type="checkbox" name="acknowledged" required> I understand these items stay on this device until Document Writer starts again.</label>') +
        "</section>"
      : "") +
    '<p role="alert" data-exit-error></p>' +
    (blocked
      ? '<button class="btn" type="button" data-exit-recheck>Check again</button>'
      : '<button class="btn btn-primary" type="submit" data-exit-confirm>Exit Document Writer</button>') +
    "</form>"
  );
}

async function flushDrafts() {
  try {
    captureWork();
    return await saveDrafts();
  } catch (error) {
    return false;
  }
}

/* The recovery copy normally follows a device save after a short delay; write it now, then nothing else starts. */
async function settleRecoveryCopy() {
  clearTimeout(recovery.RECOVERY_TIMER);
  for (let n = 0; recovery.RECOVERY_BUSY && n < 150; n++) await new Promise((resolve) => setTimeout(resolve, 100));
  if (!startup.HELPER || recovery.RECOVERY_BUSY) return;
  try {
    await backupUnfinished(recoveryJobs());
  } catch (error) {
    /* Device drafts are the primary copy; a recovery copy is written again after the next start. */
  }
}

function stoppedDetails() {
  const details = ["Drafts saved on this device stay on this device."];
  const queued = [];
  if (workspace.PENDING.length) queued.push(plural(workspace.PENDING.length, "shared save"));
  if (startup.HELPER?.outbox) queued.push(plural(startup.HELPER.outbox, "PDF transfer"));
  if (queued.length)
    details.push(
      queued.join(" and ") + " remain queued on this device. They have not reached the shared folder; they resume when Document Writer starts again.",
    );
  return details;
}

function releaseStoppedWorkspace() {
  // A stopped page cannot edit again. Keeping its lifetime Web Lock would block the next icon launch
  // until the old window is closed, and its Reports channel must not compete with the new Writer.
  startup.WRITER_ACCESS = false;
  startup.releaseWorkspaceLock?.();
  startup.releaseWorkspaceLock = null;
  startup.HANDOFF_SEQ++;
  if (startup.WRITER_CHANNEL) {
    startup.WRITER_CHANNEL.onmessage = null;
    startup.WRITER_CHANNEL.close?.();
    startup.WRITER_CHANNEL = null;
  }
}

function stopped() {
  const details = stoppedDetails();
  helperStop.stopped = true;
  clearTimeout(recovery.RECOVERY_TIMER);
  startup.HELPER = null;
  releaseStoppedWorkspace();
  announceStop();
  showStopped(details);
}

let exiting = false;
async function confirmExit(form) {
  if (exiting) return false; // One Exit request at a time; a second click waits for the first answer.
  exiting = true;
  try {
    return await requestExit(form);
  } finally {
    exiting = false;
  }
}

const superseded = (form) => !form.isConnected || !form.closest("dialog")?.open;

const refusalText = (data) =>
  (data.error || "Document Writer did not stop.") + (Array.isArray(data.reasons) && data.reasons.length ? " " + data.reasons.join(" ") : "");

async function readShutdownReply(response) {
  try {
    return await response.json();
  } catch (error) {
    return {};
  }
}

async function sendShutdown(form, alert, button, review) {
  form.dataset.shutdownRequested = "true";
  const cancel = form.closest("dialog")?.querySelector("[data-utility-close]");
  if (cancel) cancel.disabled = true;
  try {
    const response = await authFetch("/helper/shutdown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: review.unresolved.length > 0 }),
    });
    const data = await readShutdownReply(response);
    if (response.ok && data.ok) {
      stopped();
      return true;
    }
    alert.textContent = refusalText(data);
  } catch (error) {
    alert.textContent =
      "Document Writer did not answer, so it may already have stopped. Drafts saved on this device are kept. " +
      "To start again, double-click Document Writer on the desktop.";
  }
  delete form.dataset.shutdownRequested;
  if (cancel) cancel.disabled = false;
  button.disabled = false;
  return false;
}

async function requestExit(form) {
  const alert = form.querySelector("[data-exit-error]"),
    button = form.querySelector("[data-exit-confirm]");
  button.disabled = true;
  const kept = await flushDrafts();
  if (superseded(form)) return false;
  const review = currentReview();
  // Work may have started or appeared after the dialog opened: show the current review instead of exiting.
  if (!kept || review.blocking.length || (review.unresolved.length && !form.elements.acknowledged?.checked)) {
    await openExit(false);
    return false;
  }
  alert.textContent = "Stopping Document Writer…";
  await settleRecoveryCopy();
  // Cancel/Escape or a different dialog may have superseded this request while device/recovery saving ran.
  if (superseded(form)) return false;
  const finalReview = currentReview();
  if (finalReview.blocking.length || JSON.stringify(finalReview.unresolved) !== JSON.stringify(review.unresolved)) {
    await openExit(false);
    return false;
  }
  return sendShutdown(form, alert, button, review);
}

export async function openExit(save = true) {
  if (save) await flushDrafts();
  const R = app_savedworkContext();
  R.A11Y.utility("Exit Document Writer", exitDialogHTML(R, currentReview()));
  const dialog = document.getElementById("utility-dialog");
  const close = dialog?.querySelector("[data-utility-close]");
  if (close) close.textContent = "Cancel";
  const form = document.getElementById("exit-writer-form");
  if (!form) return;
  // Preparation is cancellable; after the shutdown POST is sent it cannot be recalled.
  close?.addEventListener("click", (event) => {
    if (form.dataset.shutdownRequested) return;
    event.preventDefault();
    event.stopPropagation();
    dialog.close();
  });
  dialog.addEventListener(
    "cancel",
    (event) => {
      if (form.dataset.shutdownRequested) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      dialog.close();
    },
    true,
  );
  form.onsubmit = (event) => {
    event.preventDefault();
    confirmExit(form);
  };
  form.querySelector("[data-exit-recheck]")?.addEventListener("click", () => openExit(true));
}

/* Exit from another window: keep this window's device drafts, then show the stopped state. */
async function stoppedElsewhere() {
  if (startup.WRITER_ACCESS) await flushDrafts();
  helperStop.stopped = true;
  startup.HELPER = null;
  clearTimeout(recovery.RECOVERY_TIMER);
  releaseStoppedWorkspace();
  showStopped(["Exit Document Writer was used in another Writer window.", "Drafts saved on this device stay on this device."]);
}

document.addEventListener("click", (event) => {
  if (!event.target.closest?.("[data-exit-writer]")) return;
  event.preventDefault();
  openExit(true);
});
listenForStop(stoppedElsewhere);
