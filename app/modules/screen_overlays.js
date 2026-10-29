import { html, raw } from "./screen_html.js";
import { startupState as startup } from "./startup_state.js";
import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { doc, kase, docCase } from "./writer_queries.js";
import { iso } from "./calendar.js";
import { DOC_TYPES } from "./document_types.js";
import { emailList, ccList, isLLC, EMAIL_KINDS } from "./mailing_rules.js";
import { esc, fmtDate } from "./presentation_format.js";
import { recordDay, mailingMaxDay } from "../assets/shared.js";

function sendRecipientModal() {
  const d = doc(editor.state.sendDoc) || doc(editor.state.docId);
  if (!d) return "";
  const k = kase(d.caseId),
    list = emailList(k).filter((e) => String(e.addr || "").trim());
  return html`<div class="modal"><div class="modal-box" role="dialog" aria-modal="true">
      <div class="modal-h"><h2>Send this document to</h2></div><div class="modal-b">
      <p class="hint">Choose recipients for the email draft. Review and send it in your mail application. The issued document stays unchanged.</p>
      ${raw(
        list
          .map(
            (e, ix) => html`<label class="sendrow"><input type="checkbox" data-sendto="${String(ix)}" checked>
        <span><strong>${raw(esc(e.kind || "Other"))}</strong> ${raw(esc(e.addr))}</span></label>`,
          )
          .join(""),
      )}
      </div><div class="modal-f">
        <button class="btn" data-close="modal">Cancel</button>
        <button class="btn" id="btn-sendnone">Send without recording</button>
        <button class="btn btn-primary" id="btn-sendgo">Open the email</button>
      </div></div></div>`;
}

function recipientCopiesHTML({ cc, invalid, services }) {
  return cc.length
    ? cc
        .map(
          (c, ix) =>
            html`<div class="rec">
        <div class="rec-n">${String(ix + 1)}</div>
        <div class="rec-f">
          <input type="text" data-cc="${String(ix)}|name" value="${raw(esc(c.name || ""))}" placeholder="Name" aria-label="Copy ${String(ix + 1)} name"${raw(invalid("copy", ix, "name"))}>
          <input type="text" data-cc="${String(ix)}|addr" value="${raw(esc(c.addr || ""))}" placeholder="Street number and name (123 Main St, Apt 4)" aria-label="Copy ${String(ix + 1)} street number and name"${raw(invalid("copy", ix, "addr"))}>
          <input type="text" data-cc="${String(ix)}|city" value="${raw(esc(c.city || ""))}" placeholder="City, ST ZIP (Madison, WI 53703)" aria-label="Copy ${String(ix + 1)} city, state and ZIP"${raw(invalid("copy", ix, "city"))}>
          <p class="rec-preview" data-recipient-preview="copy|${String(ix)}">${raw(esc(services.recipientPreview(c)))}</p><button class="btn btn-sm" data-parse-address="copy|${String(ix)}">Preview standardized copy address</button>
        </div>
        <button class="btn btn-sm" data-rmcc="${String(ix)}" aria-label="Remove copy ${String(ix + 1)}">&times;</button></div>`,
        )
        .join("")
    : '<p class="hint">No copies yet.</p>';
}

function recipientEmailHTML({ em }) {
  return em.length
    ? em
        .map(
          (e, ix) =>
            html`<div class="rec">
        <div class="rec-n">${String(ix + 1)}</div>
        <div class="rec-f rec-mail">
          <select data-em="${String(ix)}|kind" aria-label="Recipient ${String(ix + 1)} type">${raw(EMAIL_KINDS.map((x) => html`<option ${raw(e.kind === x ? "selected" : "")}>${raw(esc(x))}</option>`).join(""))}</select>
          <input type="email" data-em="${String(ix)}|addr" value="${raw(esc(e.addr || ""))}" placeholder="name@example.com" aria-label="Recipient ${String(ix + 1)} email">
        </div>
        <button class="btn btn-sm" data-rmem="${String(ix)}" aria-label="Remove recipient ${String(ix + 1)}">&times;</button></div>`,
        )
        .join("")
    : '<p class="hint">No email recipients yet.</p>';
}

function recipientModal({ services }) {
  const d = doc(editor.state.docId);
  if (!d) return "";
  const k = docCase(d),
    cc = ccList(k),
    em = emailList(k),
    needAgent = d.type === "citation" && isLLC(k),
    problem = editor.state.ccProblem;
  const invalid = (scope, index, field) =>
    problem && problem.scope === scope && problem.index === index && problem.field === field
      ? ' aria-invalid="true" aria-describedby="cc-address-error"'
      : "";
  return html`<div class="modal"><div class="modal-box" role="dialog" aria-modal="true">
      <div class="modal-h"><h2>Copies, email and registered agent</h2></div><div class="modal-b">
      <div class="banner info"><div>${raw(
        d.correction
          ? "These edits belong to this correction. Select the case-details option on the correction panel to also use them for future documents."
          : "Anything entered here appears on future documents for " + esc(k.number) + ". Issued copies stay unchanged.",
      )}</div></div>
      ${raw(
        problem
          ? html`<div class="banner alert" id="cc-address-error" role="alert"><div><strong>Check this address:</strong> ${raw(esc(problem.message))}</div></div>`
          : "",
      )}

      <h3 class="rec-h">Copies</h3>
      <p class="hint">Printed at the foot of the document under &ldquo;CC:&rdquo;. Enter a numbered street address and city, state and ZIP; the print preview below shows the standardized lines.</p>
      ${raw(recipientCopiesHTML({ cc, invalid, services }))}
      <button class="btn btn-sm" id="btn-addcc">Add a copy</button>

      <h3 class="rec-h">Email recipients</h3>
      <p class="hint">Offered when you email a document. Recipients selected when finalizing are listed on that document.</p>
      ${raw(recipientEmailHTML({ em }))}
      <button class="btn btn-sm" id="btn-addem">Add an email recipient</button>

      <h3 class="rec-h">Registered agent${raw(needAgent ? ' <span class="req">required</span>' : "")}</h3>
      <p class="hint">${raw(
        needAgent
          ? esc(k.owner) + " reads as a company, so a citation cannot be served without an agent."
          : "Only needed when the owner is a company. Printed on the citation.",
      )}</p>
      <div class="rec"><div class="rec-n">&nbsp;</div><div class="rec-f">
        <input type="text" data-agent="name" value="${raw(esc((k.agent || {}).name || ""))}" placeholder="Agent name" aria-label="Registered agent name"${raw(invalid("agent", 0, "name"))}>
        <input type="text" data-agent="addr" value="${raw(esc((k.agent || {}).addr || ""))}" placeholder="Street number and name (123 Main St, Apt 4)" aria-label="Registered agent street number and name"${raw(invalid("agent", 0, "addr"))}>
        <input type="text" data-agent="city" value="${raw(esc((k.agent || {}).city || ""))}" placeholder="City, ST ZIP (Madison, WI 53703)" aria-label="Registered agent city, state and ZIP"${raw(invalid("agent", 0, "city"))}>
        <p class="rec-preview" data-recipient-preview="agent|0">${raw(esc(services.recipientPreview(k.agent || {})))}</p><button class="btn btn-sm" data-parse-address="agent|0">Preview standardized agent address</button>
      </div><div style="width:34px"></div></div>
      </div><div class="modal-f"><button class="btn btn-primary" data-close="modal">Done</button></div></div></div>`;
}

function clearWorkspaceModal({ services }) {
  const risky = workspace.CASES.filter((k) => services.caseUnsaved(k)),
    safe = workspace.CASES.filter((k) => !services.caseUnsaved(k));
  return html`<div class="modal"><div class="modal-box" role="dialog" aria-modal="true">
      <div class="modal-h"><h2>Remove cases from this workspace</h2></div><div class="modal-b">
      <div class="banner info"><div>This workspace is your working desk, not the record. Removing a case from this workspace does not delete its shared case record &mdash; <strong>Open saved case</strong> brings it straight back.</div></div>
      ${raw(
        safe.length
          ? html`<p class="hint"><strong>${String(safe.length)} case${raw(safe.length === 1 ? "" : "s")} safe to remove</strong> &mdash; all current case details and issued history are saved to the share; no unfinished work remains.</p>
        <ul class="clearlist">${raw(
          safe
            .slice(0, 12)
            .map((k) => html`<li>${raw(esc(k.number))} &middot; ${raw(esc(k.address))}</li>`)
            .join(""),
        )}${raw(safe.length > 12 ? html`<li class="muted">and ${String(safe.length - 12)} more</li>` : "")}</ul>`
          : "",
      )}
      ${raw(
        risky.length
          ? html`<div class="banner warn" style="margin-top:14px"><div><strong>${String(risky.length)} case${raw(risky.length === 1 ? " has" : "s have")} work that has not reached the share.</strong> Removing ${raw(risky.length === 1 ? "it" : "them")} would lose that work.</div></div>
        <ul class="clearlist">${raw(
          risky
            .map(
              (k) =>
                html`<li>${raw(esc(k.number))} &middot; ${raw(esc(k.address))} <span class="muted">&mdash; ${raw(esc(services.caseUnsaved(k)))}</span></li>`,
            )
            .join(""),
        )}</ul>`
          : "",
      )}
      </div><div class="modal-f">
        <button class="btn" data-close="modal">Cancel</button>
        ${raw(
          safe.length
            ? html`<button class="btn btn-primary" data-clearcases="safe">Remove the ${String(safe.length)} safe case${raw(safe.length === 1 ? "" : "s")}</button>`
            : "",
        )}
        ${raw(
          risky.length
            ? html`<button class="btn" data-clearcases="all">Remove all ${String(workspace.CASES.length)}, losing that unsaved work</button>`
            : "",
        )}
      </div></div></div>`;
}

function storageModal({ services }) {
  return html`<div class="modal"><div class="modal-box" role="dialog" aria-modal="true">
      <div class="modal-h"><h2>Where documents are going</h2></div><div class="modal-b">
      ${raw(services.storageReport())}
      ${raw(
        workspace.CASEDIR && workspace.DIRNAME !== services.CASEDIR_EXPECT
          ? html`<div class="banner warn" style="margin-top:14px"><div><strong>Case files are going to a folder called &ldquo;${raw(esc(workspace.DIRNAME))}&rdquo;, not &ldquo;${raw(esc(services.CASEDIR_EXPECT))}&rdquo;.</strong>
        If that is not where they belong, relink below. Anything already written stays where it is &mdash; move those files across by hand.</div></div>`
          : "",
      )}
      <p class="hint" style="margin-top:14px">${raw(
        workspace.CASEDIR && workspace.CASEDIR.helper
          ? "Case files are saved through the local helper with a shared lock and a recoverable previous copy. Drafts stay on this device."
          : "The browser only supplies the folder name. Write a test file to verify the destination.",
      )}</p>
      ${raw(services.reindexReport())}<p><button class="btn" data-sync-safety>Back to saved work &amp; connection</button></p>
      </div><div class="modal-f">
        ${raw(
          workspace.CASEDIR
            ? html`<button class="btn" id="btn-reindex" ${raw(editor.state.reindex && editor.state.reindex.running ? "disabled" : "")}>Rebuild reporting index</button>${raw(
                workspace.CASEDIR.helper
                  ? ""
                  : html`<button class="btn" id="btn-testwrite">Write a test file</button><button class="btn" id="btn-linkdir">Link a different folder…</button>`,
              )}`
            : html`<button class="btn" id="btn-linkdir">Link the case folder…</button>`,
        )}
        <button class="btn btn-primary" data-close="modal">Close</button></div></div></div>`;
}

function folderModal() {
  const fs = (editor.state.folder || []).filter((f) => f.name.toLowerCase().includes((editor.state.folderQ || "").toLowerCase()));
  return html`<div class="modal"><div class="modal-box" role="dialog" aria-modal="true">
      <div class="modal-h"><h2>Open a saved case</h2></div><div class="modal-b"><label class="f"><span>Search saved cases</span><input type="search" id="folder-search" value="${raw(esc(editor.state.folderQ || ""))}" placeholder="Address or case number…"></label>${raw(editor.state.folderError ? html`<div class="banner warn">${raw(esc(editor.state.folderError))}</div>` : "")}
      ${raw(
        fs.length
          ? html`<div class="folderlist">${raw(
              fs
                .map(
                  (f) =>
                    html`<button data-openfolder="${raw(esc(f.name))}">${raw(esc(f.name.replace(/\.json$/i, "")))}
        <span>${String((f.size / 1024).toFixed(0))} KB &middot; ${raw(f.mod ? fmtDate(iso(new Date(f.mod))) : "")}</span></button>`,
                )
                .join(""),
            )}</div>`
          : '<div class="banner info"><div>No case files in that folder yet.</div></div>',
      )}
      </div><div class="modal-f"><button class="btn" data-close="modal">Close</button></div></div></div>`;
}

function finalRecipientsHTML({ d }) {
  if (!startup.HELPER || !startup.HELPER.chrome) return "";
  const list = emailList(d.correction ? docCase(d) : kase(d.caseId)).filter((e) => String(e.addr || "").trim());
  if (!list.length)
    return html`<p class="hint" style="margin-top:14px">No email recipients on this case. Add them under <strong>Recipients</strong> if you want this sent as well as filed.</p>`;
  return html`<div class="fin-send"><div class="flab">Email this document to</div>
          ${raw(
            list
              .map(
                (e, ix) =>
                  html`<label class="sendrow"><input type="checkbox" data-finsend="${String(ix)}" ${raw(
                    (Array.isArray(d.emailSelection) ? d.emailSelection.includes(e.addr + "|" + (e.kind || "Other")) : e.on !== false)
                      ? "checked"
                      : "",
                  )}>
            <span><strong>${raw(esc(e.kind || "Other"))}</strong> ${raw(esc(e.addr))}</span></label>`,
              )
              .join(""),
          )}
          <p class="hint">Selected recipients are listed on the document. An email draft opens for you to review and send.${raw(startup.HELPER.outlook === false ? " Outlook was not found, so your default mail program will open without the attachment." : "")}</p></div>`;
}

function finalDocumentModal({ services }) {
  const d = doc(editor.state.docId),
    ch = services.checks(d),
    bad = services.blockers(d);
  const notes = ch.filter((c) => !c.ok && c.soft);
  const ty = (DOC_TYPES.find((t) => t.id === d.type) || {}).label || "document";
  return html`<div class="modal"><div class="modal-box" role="dialog" aria-modal="true">
    <div class="modal-h"><h2>${raw(d.correction ? "Review correction" : "Finalize this " + esc(ty.toLowerCase()))}</h2></div><div class="modal-b">
      ${raw(
        d.correction
          ? html`<p><strong>Reason:</strong> ${raw(esc(d.correction.reason))}</p>${raw(services.correctionDiffHTML(d))}<p class="hint">Changed case details will also update future documents and current reports. No new visit or enforcement action is counted. The previous version remains in history.</p><label class="correction-option"><input type="checkbox" id="correction-reviewed" ${raw(d.correction.reviewed ? "checked" : "")}> I reviewed the changes, dates and affected recipients.</label>`
          : "",
      )}
      ${raw(
        bad.length
          ? html`<div class="banner alert"><div><strong>${String(bad.length)} thing${raw(bad.length === 1 ? "" : "s")} to fix before this can be issued.</strong> Select a check below to go directly to the field that needs attention.</div></div>`
          : notes.length
            ? html`<div class="banner warn"><div><strong>Ready to issue.</strong> One thing worth a second look, noted below.</div></div>`
            : '<div class="banner ok"><div>Every check passed.</div></div>',
      )}
      ${raw(ch.map((c, ix) => (!c.ok ? services.checkRowHTML(c, ix) : "")).join(""))}
      <label class="f" style="margin-top:16px"><span>Mailed date</span><input type="date" id="fin-mailed" value="${raw(esc(d.mailed || recordDay(services.today)))}" max="${String(mailingMaxDay(services.initialCitations.enabled(d) ? "citation" : d.type))}" ${raw(d.correction ? "disabled" : "")}></label>
      ${raw(finalRecipientsHTML({ d }))}
      <p class="hint">Finalizing locks the item text, wording and numbering. Two things come out of it: the printable copy for the owner, and the case file you reopen on your next visit, saved as <span class="mono">${raw(esc((kase(d.caseId).address || "PROPERTY") + " - " + (kase(d.caseId).number || "CASE")))}.json</span>.</p></div>
    <div class="modal-f"><button class="btn" data-close="modal">${raw(bad.length ? "Back to the document" : "Cancel")}</button><button class="btn" id="btn-savework">Save draft &amp; return to Workspace</button>
      <button class="btn btn-primary" id="fin-go" ${raw(bad.length ? 'disabled title="Clear the outstanding checks first"' : editor.AMENDMENT_BUSY || editor.state.publicationBusy ? 'disabled title="The save is in progress"' : "")}>${raw(d.correction ? "Save &amp; issue correction" : services.initialCitations.enabled(d) ? "Issue citation" : "Issue document")}</button></div></div></div>`;
}

export function createScreenOverlays(services) {
  function modalHTML() {
    if (editor.state.modal === "shared-change") return services.sharedChangeModal();
    if (editor.state.modal === "review") return services.reviewModalHTML();
    if (editor.state.modal === "recovery") return services.recoveryModal();
    if (["void", "recordnote", "reconcile"].includes(editor.state.modal)) return services.recordActionModal();
    if (editor.state.modal === "sendto") return sendRecipientModal();
    if (editor.state.modal === "cc") return recipientModal({ services });
    if (editor.state.modal === "clear") return clearWorkspaceModal({ services });
    if (editor.state.modal === "storage") return storageModal({ services });
    if (editor.state.modal === "folder") return folderModal();
    if (editor.state.modal !== "final") return "";
    return finalDocumentModal({ services });
  }

  function overlayHTML() {
    return editor.state.modal ? modalHTML() : editor.state.picker ? services.pickerHTML() : "";
  }
  return { overlayHTML };
}
