import { startupState as startup } from "./startup_state.js";
import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { recoveryState as recovery } from "./recovery_state.js";
import { recoverySharedConflict } from "./case_recovery.js";
import { esc } from "./presentation_format.js";
import { html, raw } from "./screen_html.js";

// Recovery presentation and working controls; workflow/storage authority stays supplied.
/* Recovery dialog sections. Each builds its markup from the recovery state it is given. */
function backupList(list) {
  return (
    '<div class="folderlist">' +
    "".concat(
      list
        .map(
          (x, i) =>
            '<button data-recovery-row="' +
            `${i}` +
            '" ' +
            `${x.error ? "disabled" : ""}` +
            ">" +
            `${esc(x.number || "Unknown case")}` +
            " · " +
            `${esc(x.at || x.name)}` +
            " · " +
            `${esc((x.included || []).join(", ") || x.error || "No listed drafts")}` +
            " · workspace " +
            `${esc(x.workspace.slice(0, 8))}` +
            "</button>",
        )
        .join("") || "No backups found.",
    ) +
    "</div>"
  );
}

function sharedFieldTable(fields) {
  return fields.length
    ? html`<table><thead><tr><th>Field</th><th>Backup</th><th>Shared</th></tr></thead><tbody>${raw(
        "".concat(
          fields
            .map((f) =>
              "".concat(
                "<tr><td>",
                esc(f.field),
                "</td><td>",
                esc(JSON.stringify(f.local) ?? "(absent)"),
                "</td><td>",
                esc(JSON.stringify(f.shared) ?? "(absent)"),
                "</td></tr>",
              ),
            )
            .join(""),
        ),
      )}</tbody></table>`
    : "";
}

function selectedBackup(services, b, local) {
  return (
    '<div class="banner info"><strong>' +
    `${esc(b.number)}` +
    " · " +
    `${esc(b.at)}` +
    "</strong><p>Included: " +
    `${esc(b.included.join(", ") || "import work")}` +
    ". Local: " +
    `${esc(local ? services.caseUnsaved(local) || "case present, no unfinished work" : "case absent")}` +
    ". Shared: " +
    `${esc(recovery.RECOVERY.shared?.detail || "Checking shared record…")}` +
    "</p>\n        " +
    "".concat(recovery.RECOVERY.shared?.fields?.length ? sharedFieldTable(recovery.RECOVERY.shared.fields) : "") +
    "\n        </div>"
  );
}

function recoveryActions(k) {
  return html`<button class="btn btn-primary" data-recovery-restore ${raw(recoverySharedConflict(recovery.RECOVERY.shared) ? "disabled" : "")}>Restore selected case</button><button class="btn" data-recovery-export>Export selected backup</button>${raw(k ? `<button class="btn" data-recovery-shared>Open current shared case</button>` : "")}`;
}

export function createRecoveryUI(services) {
  function restoreWorkControls() {
    if (editor.state.screen === "import")
      services.ENTRY_IDS.forEach((id) => {
        const el = services.document.getElementById(id);
        if (el && editor.WORK.entry[id] !== undefined) el.value = editor.WORK.entry[id];
      });
    const form = editor.WORK.recordForms[services.recordFormKey()];
    if (form) {
      [
        ["record-action-text", "text"],
        ["record-action-external", "external"],
        ["record-action-inspector", "actor"],
      ].forEach(([id, key]) => {
        const el = services.document.getElementById(id);
        if (el && !el.disabled) el.value = form[key] || "";
      });
    }
  }

  async function saveAndContinue() {
    if (editor.state.screen === "import") services.cancelCaseLookup();
    services.captureWork();
    if (editor.draftTimer) {
      services.clearTimeout(editor.draftTimer);
      editor.draftTimer = null;
    }
    return services.navigation.leave(() => {
      editor.state.modal = null;
      editor.state.picker = false;
      editor.state.screen = "cases";
      editor.state.riFilter = "";
      workspace.DIRTY = false;
      services.render();
      services.toast("Work saved on this device. Continue from your workspace when ready.");
    });
  }

  function restoreWorkspaceFile() {
    const input = services.document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      try {
        const file = input.files[0];
        if (file) await services.restoreWorkspaceBackup(JSON.parse(await file.text()));
      } catch (e) {
        services.toast("Backup was not restored: " + e.message);
      }
    };
    input.click();
  }

  function renderRecoveryStatus() {
    const el = services.document.getElementById("recovery-status");
    if (el) el.innerHTML = recoveryStatusHTML();
  }

  function recoveryStatusHTML() {
    return !startup.HELPER
      ? '<span class="save-error" role="status">Automatic backup unavailable. Start the local helper; device autosave is separate. <button class="lnk" data-setup-health>Check connection</button></span>'
      : recovery.RECOVERY.error
        ? html`<div class="save-error" role="alert">Automatic backup needs attention. Device autosave is separate. <button class="lnk" data-sync-safety>Review saved work</button><details data-saved-detail="automatic-backup"><summary>Backup details</summary>${recovery.RECOVERY.error} · Last successful backup: ${recovery.RECOVERY.at || "none"}</details></div>`
        : recovery.RECOVERY.at
          ? html`<div>Automatic recovery copy available. <details data-saved-detail="automatic-backup"><summary>Backup details</summary>${recovery.RECOVERY.at}</details></div>`
          : "<span>Automatic backup waiting for its first save. Device autosave is separate.</span>";
  }

  function recoveryModal() {
    const b = recovery.RECOVERY.selected,
      k = b?.bundle?.cases?.[0],
      local = k && workspace.CASES.find((c) => c.id === k.id || c.number === k.number);
    return html`<div class="modal"><div class="modal-box" role="dialog" aria-modal="true" aria-label="Recover unfinished work">\n    <div class="modal-h"><h2>Recover unfinished work</h2></div><div class="modal-b">\n      <p>Backups are separate from issued case files. Select one case. Nothing is issued during recovery.</p>\n      <label>Import an exported individual recovery JSON <input id="recovery-import" type="file" accept=".json,application/json"></label>\n      ${raw("".concat(recovery.RECOVERY.error ? `<div class="banner alert" role="alert">${esc(recovery.RECOVERY.error)}</div>` : ""))}\n      ${raw("".concat(recovery.RECOVERY.loading ? "Reading backups…" : backupList(recovery.RECOVERY.list)))}\n      ${raw("".concat(b ? selectedBackup(services, b, local) : ""))}\n      </div><div class="modal-f">${raw("".concat(b ? recoveryActions(k) : ""))}<button class="btn" data-sync-safety>Saved work &amp; connection</button><button class="btn" data-close="modal">Close</button></div></div></div>`;
  }
  return { restoreWorkControls, saveAndContinue, restoreWorkspaceFile, renderRecoveryStatus, recoveryStatusHTML, recoveryModal };
}
