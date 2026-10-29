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
        if (t.hasAttribute("data-safety-local")) {
          await services.saveDrafts();
          await services.showSafety();
        } else if (t.hasAttribute("data-sync-safety")) await services.showSafety(t.dataset.syncSafety || "");
        else if (t.hasAttribute("data-setup-health")) await services.showHealth();
        else if (t.hasAttribute("data-health-probe")) await services.showHealth(true);
        else if (t.hasAttribute("data-diagnostics-copy")) {
          const el = document.getElementById("it-diagnostics");
          el.select();
          if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(el.value);
          else document.execCommand("copy");
          services.toast("Copied IT diagnostics", { severity: "success" });
        } else if (t.hasAttribute("data-lock-inspect")) await services.inspectLock();
        else if (t.hasAttribute("data-conflict-apply")) await services.applyConflict();
        else if (t.hasAttribute("data-safety-backup")) {
          await services.backupUnfinished(services.recoveryJobs());
          await services.showSafety();
        } else if (t.hasAttribute("data-safety-catalog")) {
          await services.refreshCatalog();
          await services.showSafety();
        } else if (t.hasAttribute("data-safety-outbox")) {
          await services.showOutbox();
        } else if (t.hasAttribute("data-safety-pending")) {
          document.getElementById("utility-dialog")?.close();
          if (!workspace.CASEDIR || workspace.NEEDGRANT) {
            editor.state.modal = "storage";
            services.render();
          } else {
            await services.flushPending();
            services.render();
            await services.showSafety();
          }
        } else {
          document.getElementById("utility-dialog")?.close();
          const cid = t.dataset.safetyCase,
            st = services.caseState(kase(cid));
          if (t.dataset.safetyAction === "integrity") {
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
          } else if (t.dataset.safetyAction === "conflict") {
            editor.state.modal = "shared-change";
            services.render();
          } else if (t.dataset.safetyAction === "pending") {
            openPendingSafetyAction(services, st);
          } else if (t.dataset.safetyAction === "document") {
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
          } else if (t.dataset.safetyAction === "pdf") {
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
          } else if (t.dataset.safetyAction === "outbox") {
            await services.showOutbox();
          } else if (t.dataset.safetyAction === "storage") {
            editor.state.modal = "storage";
            services.render();
          } else if (t.dataset.safetyAction === "save") await services.saveCaseFile(cid);
          else
            await services.preflightCase(cid, "safety check", () => {
              services.render();
              services.showSafety();
            });
        }
      } catch (error) {
        services.toast(error.message, { severity: "error" });
      }
    });
  }
  return { registerLockRelease, registerSafetyActions };
}
