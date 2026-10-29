import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
/* Safety event ownership. Construction is inert; core registers at the original startup positions. */
import { registerEventOnce } from "./event_registration.js";
import { kase, docsFor } from "./writer_queries.js";
import { esc } from "./presentation_format.js";
import { deliveredByCitation } from "./document_rules.js";
function openPendingSafetyAction(services, st) {
  if (st.pendingDoc) {
    editor.state.docId = st.pendingDoc.id;
    editor.state.screen = "write";
    services.render();
  } else {
    const holder = editor.RECORD_ATTEMPTS[st.pendingRecord.recordKey];
    if (holder) services.commitAmendment(holder.cid, holder.pendingAmendment, holder);
  }
}

async function copyDiagnostics(services) {
  const el = document.getElementById("it-diagnostics");
  el.select();
  if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(el.value);
  else document.execCommand("copy");
  services.toast("Copied IT diagnostics", { severity: "success" });
}

async function backupUnfinishedWork(services) {
  await services.backupUnfinished(services.recoveryJobs());
  await services.showSafety();
}

async function refreshCatalogThenShow(services) {
  await services.refreshCatalog();
  await services.showSafety();
}

async function flushPendingThenShow(services) {
  document.getElementById("utility-dialog")?.close();
  if (!workspace.CASEDIR || workspace.NEEDGRANT) {
    editor.state.modal = "storage";
    services.render();
  } else {
    await services.flushPending();
    services.render();
    await services.showSafety();
  }
}

/* Buttons that act on the whole workspace, in priority order. */
const SAFETY_BUTTONS = [
  [
    "data-safety-local",
    async (services) => {
      await services.saveDrafts();
      await services.showSafety();
    },
  ],
  ["data-sync-safety", (services, t) => services.showSafety(t.dataset.syncSafety || "")],
  ["data-setup-health", (services) => services.showHealth()],
  ["data-health-probe", (services) => services.showHealth(true)],
  ["data-diagnostics-copy", copyDiagnostics],
  ["data-lock-inspect", (services) => services.inspectLock()],
  ["data-conflict-apply", (services) => services.applyConflict()],
  ["data-safety-backup", backupUnfinishedWork],
  ["data-safety-catalog", refreshCatalogThenShow],
  ["data-safety-outbox", (services) => services.showOutbox()],
  ["data-safety-pending", flushPendingThenShow],
];

function showIntegrityEvidence(services, cid) {
  const proof = services.recordIntegrity.status(kase(cid));
  services.A11Y.utility(
    "Record verification details",
    "<p>" +
      `${esc(kase(cid).number)}` +
      " · " +
      `${esc(proof.label)}` +
      "</p><p>Keep this case read-only and ask an administrator to review the r" +
      "etained evidence. No automatic repair is performed.</p><details><summary" +
      ">Technical evidence</summary><p>Event: " +
      `${esc(proof.eventId || "Unavailable")}` +
      " · expected: " +
      `${esc(proof.expected || "Unavailable")}` +
      " · actual: " +
      `${esc(proof.actual || "Unavailable")}` +
      " · last good commit: " +
      `${esc(proof.lastGoodCommitTime || "Unavailable")}` +
      "</p></details>",
  );
}

async function openCaseDocument(services, cid, st) {
  const d = docsFor(cid).find((x) => x.draft) || st.current;
  if (d) {
    await services.preflightCase(cid, "draft", () => {
      editor.state.docId = d.id;
      editor.state.screen = "write";
      services.render();
    });
  } else if (st.visit) {
    await services.preflightCase(cid, "inspection", () => services.startReinspection(cid));
  }
}

function openUnfiledPdf(services, cid) {
  const d = docsFor(cid).find(
    (x) =>
      !x.draft &&
      !x.void &&
      !x.superseded &&
      !deliveredByCitation(x) &&
      (!x.filedAt || !["shared", "local outbox"].includes(services.pdfTransferState(x))),
  );
  if (d) {
    editor.state.docId = d.id;
    editor.state.screen = "write";
    services.render();
  }
}

/* Per-case actions chosen by data-safety-action; anything else runs the safety check. */
const SAFETY_CASE_ACTIONS = {
  integrity: (services, cid) => showIntegrityEvidence(services, cid),
  conflict: (services) => {
    editor.state.modal = "shared-change";
    services.render();
  },
  pending: (services, cid, st) => openPendingSafetyAction(services, st),
  document: openCaseDocument,
  pdf: (services, cid) => openUnfiledPdf(services, cid),
  outbox: (services) => services.showOutbox(),
  storage: (services) => {
    editor.state.modal = "storage";
    services.render();
  },
  save: (services, cid) => services.saveCaseFile(cid),
};

function runSafetyCheck(services, cid) {
  return services.preflightCase(cid, "safety check", () => {
    services.render();
    services.showSafety();
  });
}

async function runCaseSafetyAction(services, t) {
  document.getElementById("utility-dialog")?.close();
  const cid = t.dataset.safetyCase,
    st = services.caseState(kase(cid));
  const action = t.dataset.safetyAction;
  await (Object.hasOwn(SAFETY_CASE_ACTIONS, action) ? SAFETY_CASE_ACTIONS[action] : runSafetyCheck)(services, cid, st);
}

export function createSafetyEvents(services) {
  function registerLockRelease(target = document) {
    return registerEventOnce(target, "safety.registerLockRelease", "submit", async (e) => {
      if (e.target.id !== "lock-release-form") return;
      e.preventDefault();
      const form = e.target;
      form.querySelector("button").disabled = true;
      try {
        const data = new FormData(form);
        await services.helperJSON("/locks/release", {
          number: editor.SAFETY_LOCK.number,
          resource: editor.SAFETY_LOCK.resource,
          token: editor.SAFETY_LOCK.token,
          administrator: data.get("administrator"),
          reason: data.get("reason"),
          confirmed: data.get("confirmed") === "on",
        });
        editor.SAFETY_LOCK.present = false;
        services.showLock();
        services.toast("Released verified lock; audit note saved", { severity: "success" });
      } catch (error) {
        form.querySelector("button").disabled = false;
        services.toast(error.message, { severity: "error" });
      }
    });
  }

  function registerSafetyActions(target = document) {
    return registerEventOnce(target, "safety.registerSafetyActions", "click", async (e) => {
      const t = e.target.closest?.(
        "[data-sync-safety],[data-setup-health],[data-health-probe],[data-diagnos" +
          "tics-copy],[data-lock-inspect],[data-safety-case],[data-safety-backup],[" +
          "data-safety-catalog],[data-safety-outbox],[data-safety-pending],[data-co" +
          "nflict-apply],[data-safety-local]",
      );
      if (!t) return;
      try {
        const button = SAFETY_BUTTONS.find(([attribute]) => t.hasAttribute(attribute));
        if (button) await button[1](services, t);
        else await runCaseSafetyAction(services, t);
      } catch (error) {
        services.toast(error.message, { severity: "error" });
      }
    });
  }
  return { registerLockRelease, registerSafetyActions };
}
