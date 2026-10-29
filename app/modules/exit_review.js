import { savedCaseState } from "./saved_work.js";

export const plural = (n, word) => n + " " + word + (n === 1 ? "" : "s");

/* Pure review of existing state. blocking: refuse to exit. unresolved: exit only with acknowledgment. */
function busyItems(busy) {
  const items = [];
  if (busy.publication)
    items.push({ text: "A document is being issued.", guidance: "Wait until its confirmation appears, then choose Exit Document Writer again." });
  if (busy.filing)
    items.push({
      text: "A PDF is being filed or an email is being prepared.",
      guidance: "Wait until the filing or email message appears, then choose Exit Document Writer again.",
    });
  return items;
}

function deviceSaveItems(R) {
  if (!R.LOCAL_SAVE.ok)
    return [
      {
        text: "Your work could not be saved on this device.",
        guidance: "Open Saved work & connection, download a workspace backup and retry device saving before exiting.",
      },
    ];
  if (R.LOCAL_SAVE.saving || R.draftTimer)
    return [{ text: "Device saving has not finished.", guidance: "Wait a moment, then choose Exit Document Writer again." }];
  return [];
}

function caseItem(R, k) {
  const st = R.caseState(k),
    proof = R.recordIntegrity.status(k),
    label = (k.number || "A case") + ": ";
  if (st.pendingRecord || st.pendingDoc || proof.pendingTransaction)
    return {
      text: label + "save confirmation needed.",
      guidance:
        "The original attempt is kept on this device and has not been confirmed in the shared folder. Use Confirm original save in Saved work & connection now if you can; otherwise confirm it after Document Writer starts again.",
    };
  const s = savedCaseState(R, k);
  if (s.action === "conflict")
    return {
      text: label + "shared changes need review.",
      guidance: "Your local work stays on this device. Review the differences after Document Writer starts again.",
    };
  if (s.action === "pdf")
    return {
      text: label + "issued PDF not yet filed.",
      guidance: "Open the issued document after Document Writer starts again to finish its exact filing attempt.",
    };
  if (!st.pendingSync && (s.action === "save" || (s.action === "storage" && R.caseUnsaved(k))))
    return {
      text: label + "changes have not reached the shared folder.",
      guidance: "They stay on this device. Use Save case to shared folder now, or after Document Writer starts again.",
    };
  return null;
}

function queueItems(R) {
  if (!R.PENDING.length) return [];
  return [
    {
      text: plural(R.PENDING.length, "shared save") + " queued on this device.",
      guidance: "They have not reached the shared folder. They stay queued on this device and are retried when Document Writer starts again.",
    },
  ];
}

function outboxItems(R) {
  if (!Number.isInteger(R.HELPER?.outbox) || R.HELPER.outbox < 0)
    return [
      {
        text: "The local PDF outbox has not been checked.",
        guidance: "Its transfer status is unknown. Check Saved work & connection before exiting, or review it after Document Writer starts again.",
      },
    ];
  if (R.HELPER.outbox)
    return [
      {
        text: plural(R.HELPER.outbox, "PDF") + " waiting in the local outbox.",
        guidance:
          "They have not reached the shared folder. They stay on this device; transfer them from Saved work & connection after Document Writer starts again.",
      },
    ];
  return [];
}

export function exitReview(R, busy = {}) {
  const blocking = [...busyItems(busy), ...deviceSaveItems(R)],
    unresolved = [];
  for (const k of R.CASES || []) {
    const item = caseItem(R, k);
    if (item) unresolved.push(item);
  }
  unresolved.push(...queueItems(R), ...outboxItems(R));
  return { blocking, unresolved };
}
