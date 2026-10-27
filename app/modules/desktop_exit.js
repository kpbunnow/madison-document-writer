import { editorState as editor } from "./editor_state.js";
import { recoveryState as recovery } from "./recovery_state.js";
import { startupState as startup } from "./startup_state.js";
/* Exit Document Writer: save this device's drafts, review unresolved work, then ask the helper to stop.
   The helper refuses (409) while it is doing work it knows about; this review adds what only this window
   knows. Queued items stay queued on this device; they are never described as being in the shared folder. */

import { app_savedworkContext, captureWork, saveDrafts, backupUnfinished, recoveryJobs } from "./app_core.js";
import { savedCaseState } from "./saved_work.js";
import { authFetch } from "./helper_transport.js";
import { announceStop, helperStop, listenForStop, showStopped } from "./helper_stopped.js";
import { WriterState } from "./state.js";

const plural = (n, word) => n + " " + word + (n === 1 ? "" : "s");

/* Pure review of existing state. blocking: refuse to exit. unresolved: exit only with acknowledgment. */
export function exitReview(R, busy = {}) {
  const blocking = [],
    unresolved = [];
  if (busy.publication)
    blocking.push({ text: "A document is being issued.", guidance: "Wait until its confirmation appears, then choose Exit Document Writer again." });
  if (busy.filing)
    blocking.push({
      text: "A PDF is being filed or an email is being prepared.",
      guidance: "Wait until the filing or email message appears, then choose Exit Document Writer again.",
    });
  if (!R.LOCAL_SAVE.ok)
    blocking.push({
      text: "Your work could not be saved on this device.",
      guidance: "Open Saved work & connection, download a workspace backup and retry device saving before exiting.",
    });
  else if (R.LOCAL_SAVE.saving || R.draftTimer)
    blocking.push({ text: "Device saving has not finished.", guidance: "Wait a moment, then choose Exit Document Writer again." });
  for (const k of R.CASES || []) {
    const st = R.caseState(k),
      proof = R.recordIntegrity.status(k),
      label = (k.number || "A case") + ": ";
    if (st.pendingRecord || st.pendingDoc || proof.pendingTransaction) {
      unresolved.push({
        text: label + "save confirmation needed.",
        guidance:
          "The original attempt is kept on this device and has not been confirmed in the shared folder. Use Confirm original save in Saved work & connection now if you can; otherwise confirm it after Document Writer starts again.",
      });
      continue;
    }
    const s = savedCaseState(R, k);
    if (s.action === "conflict")
      unresolved.push({
        text: label + "shared changes need review.",
        guidance: "Your local work stays on this device. Review the differences after Document Writer starts again.",
      });
    else if (s.action === "pdf")
      unresolved.push({
        text: label + "issued PDF not yet filed.",
        guidance: "Open the issued document after Document Writer starts again to finish its exact filing attempt.",
      });
    else if (!st.pendingSync && (s.action === "save" || (s.action === "storage" && R.caseUnsaved(k))))
      unresolved.push({
        text: label + "changes have not reached the shared folder.",
        guidance: "They stay on this device. Use Save case to shared folder now, or after Document Writer starts again.",
      });
  }
  if (R.PENDING.length)
    unresolved.push({
      text: plural(R.PENDING.length, "shared save") + " queued on this device.",
      guidance: "They have not reached the shared folder. They stay queued on this device and are retried when Document Writer starts again.",
    });
  if (!Number.isInteger(R.HELPER?.outbox) || R.HELPER.outbox < 0)
    unresolved.push({
      text: "The local PDF outbox has not been checked.",
      guidance: "Its transfer status is unknown. Check Saved work & connection before exiting, or review it after Document Writer starts again.",
    });
  else if (R.HELPER.outbox)
    unresolved.push({
      text: plural(R.HELPER.outbox, "PDF") + " waiting in the local outbox.",
      guidance:
        "They have not reached the shared folder. They stay on this device; transfer them from Saved work & connection after Document Writer starts again.",
    });
  return { blocking, unresolved };
}

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
  if (!WriterState.HELPER || recovery.RECOVERY_BUSY) return;
  try {
    await backupUnfinished(recoveryJobs());
  } catch (error) {
    /* Device drafts are the primary copy; a recovery copy is written again after the next start. */
  }
}

function stoppedDetails() {
  const details = ["Drafts saved on this device stay on this device."];
  const queued = [];
  if (WriterState.PENDING.length) queued.push(plural(WriterState.PENDING.length, "shared save"));
  if (WriterState.HELPER?.outbox) queued.push(plural(WriterState.HELPER.outbox, "PDF transfer"));
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
  WriterState.HANDOFF_SEQ++;
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
  WriterState.HELPER = null;
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

async function requestExit(form) {
  const alert = form.querySelector("[data-exit-error]"),
    button = form.querySelector("[data-exit-confirm]");
  button.disabled = true;
  const kept = await flushDrafts();
  if (!form.isConnected || !form.closest("dialog")?.open) return false;
  const review = currentReview();
  // Work may have started or appeared after the dialog opened: show the current review instead of exiting.
  if (!kept || review.blocking.length || (review.unresolved.length && !form.elements.acknowledged?.checked)) {
    await openExit(false);
    return false;
  }
  alert.textContent = "Stopping Document Writer…";
  await settleRecoveryCopy();
  // Cancel/Escape or a different dialog may have superseded this request while device/recovery saving ran.
  if (!form.isConnected || !form.closest("dialog")?.open) return false;
  const finalReview = currentReview();
  if (finalReview.blocking.length || JSON.stringify(finalReview.unresolved) !== JSON.stringify(review.unresolved)) {
    await openExit(false);
    return false;
  }
  form.dataset.shutdownRequested = "true";
  const cancel = form.closest("dialog")?.querySelector("[data-utility-close]");
  if (cancel) cancel.disabled = true;
  try {
    const response = await authFetch("/helper/shutdown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: review.unresolved.length > 0 }),
    });
    let data = {};
    try {
      data = await response.json();
    } catch (error) {
      data = {};
    }
    if (response.ok && data.ok) {
      stopped();
      return true;
    }
    alert.textContent =
      (data.error || "Document Writer did not stop.") + (Array.isArray(data.reasons) && data.reasons.length ? " " + data.reasons.join(" ") : "");
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
  WriterState.HELPER = null;
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
