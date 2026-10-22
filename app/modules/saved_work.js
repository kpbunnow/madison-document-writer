/* R44 presentation only. Storage, publication, lock and PDF owners stay unchanged. */
export function localSaveText(R) {
  return R.LOCAL_SAVE.saving
    ? "Saving on this device…"
    : !R.LOCAL_SAVE.ok
      ? "Not saved — keep this tab open"
      : R.draftTimer
        ? "Device save pending…"
        : R.LOCAL_SAVE.at
          ? "Saved on this device"
          : "Device save not yet confirmed";
}

export function savedCaseState(R, k, available = !!R.CASEDIR && !R.NEEDGRANT) {
  const st = R.caseState(k),
    proof = R.recordIntegrity.status(k),
    connected = available;
  const result = (status, label, action, detail) => ({ status, label, action, detail });
  if (proof.valid === false)
    return result(
      "Record review needed",
      "View verification details",
      "integrity",
      "Keep this case read-only. Ask an administrator to review its retained evidence.",
    );
  if (R.PREFLIGHT_CONFLICT?.cid === k.id)
    return result(
      "Shared changes need review",
      "Review differences",
      "conflict",
      "Local work is retained. Compare the changed shared record before continuing.",
    );
  if (st.pendingRecord || st.pendingDoc)
    return result(
      "Save confirmation needed",
      "Confirm original save",
      "pending",
      "The original attempt is retained. Confirmation does not create another issued action.",
    );
  if (proof.pendingTransaction)
    return result("Save confirmation needed", "Complete pending save", "save", "Continue the retained migration. No new baseline is created.");
  if (st.draft || st.visit)
    return result(
      localSaveText(R),
      st.draft ? "Continue draft" : "Continue inspection",
      "document",
      "Unfinished work is separate from the shared issued record. Device status is shown above.",
    );
  if (st.pendingSync || R.PENDING.some((p) => p.cid === k.id || p.name === R.caseFileName(k)))
    return result(
      connected ? "Shared save needed" : "Waiting for connection",
      connected ? "Save case to shared folder" : "Connect shared folder",
      connected ? "save" : "storage",
      connected
        ? "The queued case file is retained. Shared history will be checked before saving."
        : "The queued case file is retained on this device only if device saving succeeded.",
    );
  const docs = R.docsFor(k.id).filter((d) => !d.draft && !d.void && !d.superseded && !R.deliveredByCitation(d));
  const needsPDF = docs.find((d) => !d.filedAt || !["shared", "local outbox"].includes(R.pdfTransferState(d)));
  if (needsPDF)
    return result(
      "PDF filing needed",
      "Review issued PDF",
      "pdf",
      "Open the issued document to verify the original or continue its exact filing attempt.",
    );
  if (docs.some((d) => R.pdfTransferState(d) === "local outbox"))
    return result(
      "PDF filing needed",
      "Transfer saved PDF",
      "outbox",
      "Verified PDF bytes are in the local outbox. Transfer does not confirm delivery.",
    );
  if (R.caseUnsaved(k))
    return result(
      connected ? "Shared save needed" : "Waiting for connection",
      connected ? "Save case to shared folder" : "Connect shared folder",
      connected ? "save" : "storage",
      connected
        ? "Case details or recorded actions differ from the last confirmed shared save."
        : "Check the shared connection before saving case records.",
    );
  if (!connected)
    return result(
      "Waiting for connection",
      "Connect shared folder",
      "storage",
      "Last confirmed shared save is retained; its current availability has not been checked.",
    );
  if (R.CASEDIR.helper && !R.COMMITTED.has(R.summaryName(k)))
    return result(
      "Shared copy needs check",
      "Check shared record",
      "check",
      "The retained workspace has no confirmed shared read in this session. Che" + "ck the shared case before treating its copy as current.",
    );
  return result(
    "Shared copy current",
    "Check shared record",
    "check",
    "Matches the last confirmed shared save in this workspace. Check for later changes on the share.",
  );
}

function caseButton(R, k, s) {
  const action = `data-safety-case="${R.esc(k.id)}" data-safety-action="${s.action}"`;
  return `<button class="btn" ${action}>${R.esc(s.label)}</button>`;
}

function deviceSaveHTML(R) {
  const localBad = !R.LOCAL_SAVE.ok;
  return (
    "<strong>" +
    `${R.esc(localSaveText(R))}` +
    "</strong>" +
    "".concat(
      localBad
        ? "<p>Keep this tab open. Download a workspace backup before closing it.</p" +
            '><button class="btn" data-workbackup>Download workspace backup</button><' +
            'button class="btn" data-safety-local>Retry device save</button>'
        : "<p>Unfinished edits stay in this browser profile. Shared saving and automatic recovery copies are separate.</p>",
    ) +
    ""
  );
}

export function savedWorkHTML(R, cid = "", health = {}) {
  const esc = R.esc,
    connected = !!R.CASEDIR && !R.NEEDGRANT && !health.error && health.ok !== false && health.caseReachable !== false;
  const cases = R.CASES.filter((k) => !cid || k.id === cid);
  const status = health.checking
    ? "Checking connection…"
    : health.error || health.ok === false
      ? "Waiting for connection"
      : connected
        ? "Shared folder connected"
        : "Waiting for connection";
  const outbox = Number.isFinite(health.outbox)
    ? `${health.outbox} PDF${health.outbox === 1 ? "" : "s"} reported in the local outbox.`
    : "Outbox count not checked. Open the outbox to verify its contents.";
  const entries = cases.map((k) => ({ k, s: savedCaseState(R, k, connected) }));
  const rank = { integrity: 0, conflict: 1, pending: 2, save: 3, storage: 4, pdf: 5, outbox: 6, document: 7, check: 8 };
  entries.sort((a, b) => (rank[a.s.action] ?? 9) - (rank[b.s.action] ?? 9));
  const caseRow = ({ k, s }) => {
    return (
      '<li class="saved-case"><div><strong>' +
      `${esc(k.number)}` +
      "</strong><span>" +
      `${esc(k.address)}` +
      "</span><strong>" +
      `${esc(s.status)}` +
      '</strong><p class="hint">' +
      `${esc(s.detail)}` +
      "</p></div>" +
      `${caseButton(R, k, s)}` +
      "</li>"
    );
  };
  const rows = entries.slice(0, 5).map(caseRow).join("");
  const remaining = entries.slice(5);
  return (
    '<div data-saved-work-panel class="saved-work"><p>Device drafts, shared c' +
    "ase records and issued PDFs are saved separately. Saving a draft does no" +
    't issue a document.</p>\n    <section aria-labelledby="saved-device-title' +
    '"><h3 id="saved-device-title">This device</h3><div class="saved-device" ' +
    "data-device-save>" +
    `${deviceSaveHTML(R)}` +
    '</div></section>\n    <section aria-labelledby="saved-shared-title"><h3 i' +
    'd="saved-shared-title">Shared cases</h3><p>' +
    `${esc(status)}` +
    "" +
    `${!connected ? " · New originals need a shared connection." : ""}` +
    "</p>" +
    `${cid ? '<button class="btn" data-sync-safety>Show all saved work</button>' : ""}` +
    '<ul class="saved-cases">' +
    `${rows || "<li>No cases in this workspace.</li>"}` +
    "</ul>" +
    "".concat(
      remaining.length
        ? '<details data-saved-detail="more-cases"><summary>' +
            `${remaining.length}` +
            " more case" +
            `${remaining.length === 1 ? "" : "s"}` +
            '</summary><ul class="saved-cases">' +
            `${remaining.map(caseRow).join("")}` +
            "</ul></details>"
        : "",
    ) +
    "\n    " +
    "".concat(
      !cid && R.PENDING.length
        ? '<details data-saved-detail="queued"><summary>' +
            `${R.PENDING.length}` +
            " queued shared save" +
            `${R.PENDING.length === 1 ? "" : "s"}` +
            ", including cases outside this list</summary><ul>" +
            `${R.PENDING.map((p) => `<li>${esc(p.name || R.kase(p.cid).number || "Queued case file")}</li>`).join("")}` +
            '</ul><button class="btn" data-safety-pending>' +
            `${connected ? "Review and retry queued shared saves" : "Connect storage for queued saves"}` +
            "</button></details>"
        : "",
    ) +
    '</section>\n    <section aria-labelledby="saved-pdf-title"><h3 id="saved-' +
    'pdf-title">PDF filing</h3><p>' +
    `${esc(outbox)}` +
    '</p><button class="btn" data-outbox>Review PDF outbox</button><details d' +
    'ata-saved-detail="pdf"><summary>Originals and retries</summary><p>A new ' +
    "original needs shared coordination. An already prepared exact retry may " +
    "finish in the local outbox while offline. The program keeps the original" +
    " bytes; it does not render a replacement. Open the affected issued docum" +
    "ent for its available action. A filed marker alone does not prove that t" +
    "he PDF still exists.</p><p>Printing or opening Outlook does not confirm " +
    "mailing, delivery or Accela recording.</p></details></section>\n    <deta" +
    'ils data-saved-detail="recovery"><summary>Backups and recovery</summary>' +
    "<p>Restoring either kind of copy does not issue a document.</p>" +
    '<section data-recovery-group="device" aria-labelledby="saved-recovery-device-title">' +
    '<h4 id="saved-recovery-device-title">Recovery on this device</h4>' +
    "<p>Recovery copies keep unfinished cases on this computer. Recovering a case does not issue a document or save to the shared folder.</p>" +
    '<div id="saved-recovery-status">' +
    `${R.recoveryStatusHTML()}` +
    '</div><div class="saved-actions"><button class="btn" id="btn-recovery">R' +
    'ecover an unfinished case</button><button class="btn" data-safety-backup' +
    ">Create recovery copy on this device</button></div><p>Case recovery checks shared changes and preserv" +
    "es a recovery copy before replacing differing local work.</p></section>" +
    '<section data-recovery-group="workspace" aria-labelledby="saved-recovery-workspace-title">' +
    '<h4 id="saved-recovery-workspace-title">Download or restore a workspace</h4>' +
    "<p>A workspace backup is a downloaded file of the whole workspace. Restoring one requires an empty workspace.</p>" +
    '<div class="saved-actions"><button class="btn" id="btn-workbac' +
    'kup">Download workspace backup</button><button class="btn" id="btn-workr' +
    'estore">Restore workspace backup</button></div></section><p>Program ' +
    "update rollback restores installed program files. It is separate from re" +
    'storing workspace data.</p></details>\n    <details data-saved-detail="di' +
    'agnostics"><summary>Connection checks and technical details</summary>' +
    `${health.error ? `<p>${esc(health.error)}</p>` : ""}` +
    '<div class="saved-actions"><button class="btn" data-setup-health>Open co' +
    'nnection checks</button><button class="btn" id="btn-storage">Storage dia' +
    'gnostics</button><button class="btn" data-lock-inspect>Inspect a case lo' +
    'ck</button><button class="btn" data-safety-catalog>Check catalog</button' +
    "></div><p>Lock age alone never authorizes release. An administrator must" +
    " verify ownership; an active operating-system lock cannot be released he" +
    "re.</p><p>Catalog last checked: " +
    `${esc(R.CATALOG_AT || "Not yet checked")}` +
    "</p></details></div>"
  );
}

export function connectionBanner(R) {
  const mode = R.storageMode(),
    problems = [];
  if (!R.LOCAL_SAVE.ok) problems.push("Device save failed — keep this tab open");
  if (R.PENDING.length) problems.push(`${R.PENDING.length} shared save${R.PENDING.length === 1 ? "" : "s"} waiting`);
  if (R.HELPER?.outbox) problems.push(`${R.HELPER.outbox} PDF${R.HELPER.outbox === 1 ? "" : "s"} awaiting transfer`);
  if (["folder-locked", "folder-not-linked", "download"].includes(mode)) problems.push("Waiting for connection");
  if (mode === "folder" && R.DIRNAME !== R.CASEDIR_EXPECT) problems.push("Check shared folder destination");
  if (!problems.length) return "";
  return (
    '<div class="saved-connection banner warn no-print"><div><strong>' +
    `${R.esc(problems.join(" · "))}` +
    '.</strong> <button class="lnk" data-sync-safety>Review saved work &amp; ' +
    "connection</button></div></div>"
  );
}

export function documentSaveHTML(R, d) {
  return (
    '<div class="document-save no-print"><span data-document-device-save>' +
    `${R.esc(localSaveText(R))}` +
    '</span><button class="lnk" data-sync-safety="' +
    `${R.esc(d.caseId)}` +
    '">Saved work &amp; connection</button></div>'
  );
}

export function updateLocalPresentation(R) {
  for (const el of document.querySelectorAll("[data-document-device-save]")) el.textContent = localSaveText(R);
  const device = document.querySelector("[data-device-save]");
  if (device) {
    const html = deviceSaveHTML(R);
    if (device.innerHTML !== html) {
      const focused = device.contains(document.activeElement);
      device.innerHTML = html;
      if (focused) (device.querySelector("button") || document.querySelector("[data-utility-close]"))?.focus({ preventScroll: true });
    }
  }
  const failure = document.getElementById("navigation-save-failure");
  if (R.LOCAL_SAVE.ok && !R.LOCAL_SAVE.saving && !R.draftTimer) {
    failure?.remove();
    R.A11Y.resolve?.("device-save");
  }
}
