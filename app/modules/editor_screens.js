import { html, raw } from "./screen_html.js";
import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { rememberLanguageFocus, restoreLanguageFocus } from "./language_discovery.js";
import { recordDay } from "../assets/shared.js";

import { DOC_TYPES, globalCourtCopies } from "./document_types.js";
import { checkAttr, esc } from "./presentation_format.js";
import { deliveredByCitation, frozenOf, isEffective, specialType } from "./document_rules.js";
import { doc, docCase, kase, recordHead, reinsp } from "./writer_queries.js";

import { documentSaveHTML, localSaveText } from "./saved_work.js";
/* app functions; direct dependencies use explicit shared state. */

const CARRIED_ITEMS_HINT = " Violations are carried from the earlier document; edit their due dates in the item rows.";

function editorActionsHTML({ d, locked, primary, services }) {
  const more =
    locked && !d.pendingAmendment
      ? (!d.draft && !services.record.correctionEligibility(d)
          ? html`<button class="btn" id="btn-correct">${d.void ? "Restore with correction" : "Correct document"}</button>` +
            (d.void ? "" : html`<button class="btn" id="btn-void">Withdraw…</button>`)
          : "") +
        // Without a linked shared folder saveCaseFile downloads a workspace backup instead, so say so.
        (workspace.CASEDIR
          ? html`<button class="btn" id="btn-savecase">Save case to shared folder</button>`
          : html`<button class="btn" id="btn-savecase" aria-describedby="savecase-note">Download workspace backup</button>` +
            html`<p class="hint" id="savecase-note">Shared folder not connected — this downloads a backup; it does not save the shared case record.</p>` +
            html`<button class="btn" data-safety-case="${d.caseId}" data-safety-action="storage">Connect shared folder</button>`) +
        (isEffective(d) ? html`<button class="btn" id="btn-email">Email…</button>` : "")
      : "";
  return (
    (d.draft ? html`<button class="btn" id="btn-save">Save draft &amp; return to Workspace</button>` : "") +
    html`<button class="btn btn-primary editor-primary" ${raw(primary.attrs)}>${primary.label}</button>` +
    (more ? html`<details class="editor-more"><summary>Document actions</summary><div>${raw(more)}</div></details>` : "")
  );
}

function editorMetadataHTML({ d, tyLabel, locked, services }) {
  return (
    html`<div class="editor-context no-print"><div><strong>${tyLabel}</strong><span>` +
    html`${d.pendingAmendment ? "Save confirmation needed" : d.void ? "Withdrawn" : d.superseded ? "Replaced version" : d.draft ? (locked ? "Draft · read-only" : "Draft · not issued") : "Issued " + services.record.fmtDate(d.mailed || d.created)}` +
    (d.revision ? html` · revision ${d.revision.number}` : "") +
    html`</span></div><button class="btn btn-sm" data-nav="cases">Back to Workspace</button></div>`
  );
}

function editorInspectionHTML({ reviewVisit, inspectionParts, locked }) {
  return reviewVisit || inspectionParts
    ? html`<div class="editor-taskbar no-print">` +
        (reviewVisit ? html`<button class="btn" id="btn-editvisit">Review inspection</button>` : "") +
        html`<p class="hint">${locked ? "Issued details are retained with the document." : "Edit inspection, property and mailing details on the working document below. Required checks link to the exact field."}</p></div>${raw(inspectionParts)}`
    : "";
}

function editorWorkHTML({ d, editable, services }) {
  return (
    html`<div class="editor-taskbar no-print"><p class="hint">${editable ? "Edit the working document directly. Fill-in bubbles mark details that still need an entry." : "Read-only retained document."}` +
    html`${editable && !services.edit.structEditable(d) ? CARRIED_ITEMS_HINT : ""} ${d.items.filter((x) => !x.done && !x.withdrawn).length} outstanding${d.items.some((x) => x.done) ? ", " + d.items.filter((x) => x.done).length + " corrected" : ""}.</p></div>` +
    html`${raw(services.record.citationReview(d))}` +
    (services.record.initialCitations.enabled(d) && d.authoringVersion >= 11
      ? html`<div class="banner info no-print" id="initial-citation-replaces"><div><strong>This inspection will be issued as a citation.</strong> The owner receives only the citation letter and its court copies. The letter carries the items, due dates, appeal and rent-abatement language shown on this working paper, which is not mailed as a separate Official Notice.</div></div>`
      : "") +
    html`<div class="editor-preview-tools no-print"><span>Working document${d.type === "citation" || services.record.initialCitations.enabled(d) ? " · four copies per charge in the issued PDF" : ""}</span>` +
    (d.type === "citation" || services.record.initialCitations.enabled(d)
      ? html`<button type="button" class="btn no-print" data-citation-copies aria-expanded="${editor.state.compactCitationCopies !== d.id}">${editor.state.compactCitationCopies !== d.id ? "Show representative court copies" : "Show all four citation copies"}</button>`
      : "") +
    html`</div><div class="desk">${raw(services.record.documentHTML(d))}</div>` +
    (services.record.initialCitations.enabled(d)
      ? html`<div class="initial-citation-previews no-print" aria-label="Initial citation previews">${raw(services.record.citationFaces(services.record.initialCitations.preview(d), true))}</div>`
      : "") +
    html`${raw(specialType(d.type) ? "" : services.record.duePanel(d, false))}`
  );
}

export function createEditorScreens(services) {
  function editorReadiness(d) {
    const list = d.draft ? services.record.checks(d) : [],
      required = list.filter((c) => !c.ok && !c.soft),
      advice = list.filter((c) => !c.ok && c.soft);
    return { list, required, advice, held: !!d.draft && d.items.some((i) => i.cite && !i.withdrawn && d.cits?.[i.id]?.mandatoryAppearance) };
  }

  // One readiness summary: the counts of required fixes and advisories for the editor's top line.
  function readinessText(required, advice) {
    const fixes = required.length ? required.length + " required fix" + (required.length === 1 ? "" : "es") : "",
      notes = advice.length ? advice.length + " advisor" + (advice.length === 1 ? "y" : "ies") : "";
    return required.length ? [fixes, notes].filter(Boolean).join(" · ") : ["Ready for review", notes].filter(Boolean).join(" · ");
  }

  function checkChip(d, readiness = editorReadiness(d)) {
    const { required, advice } = readiness;
    return (
      '<span class="cchip ' +
      `${required.length ? "bad" : "good"}` +
      '" id="chk-chip" data-editor-readiness>' +
      readinessText(required, advice) +
      "</span>"
    );
  }

  // The first unresolved required check (or, with none, advisory) that names a field, as its index in checks(d).
  function readinessFirst(readiness) {
    const at = (soft) => readiness.list.findIndex((c) => !c.ok && !!c.soft === soft && c.targets?.length);
    const required = at(false);
    if (required >= 0) return { index: required, label: "Go to first required field" };
    if (readiness.required.length) return null;
    const advisory = at(true);
    return advisory >= 0 ? { index: advisory, label: "Go to first advisory" } : null;
  }

  function readinessActionsHTML(readiness) {
    const first = readinessFirst(readiness);
    return (
      // The existing check-link path (data-check-index) focuses the field through focusCheckTarget.
      (first
        ? '<button type="button" class="btn btn-sm" data-readiness-first data-check-index="' +
          first.index +
          '" data-check-target="0">' +
          first.label +
          "</button>"
        : "") + '<button type="button" class="lnk" data-open-checklist aria-haspopup="dialog">Open full checklist</button>'
    );
  }

  // Narrow-screen task bar: next required field, Review and the primary action (which clicks the toolbar's own button).
  function mobileBarActionsHTML(d, readiness = editorReadiness(d)) {
    const first = readinessFirst(readiness),
      primary = editorPrimary(d, readiness);
    return (
      (first && readiness.required.length
        ? '<button type="button" class="btn btn-sm" data-mobile-next data-check-index="' +
          first.index +
          '" data-check-target="0">Next required field</button>'
        : "") +
      '<button type="button" class="btn btn-sm" data-mobile-review>Review</button>' +
      '<button type="button" class="btn btn-primary btn-sm" data-mobile-primary ' +
      (primary.attrs === "disabled" ? "disabled" : "") +
      ">" +
      primary.label +
      "</button>"
    );
  }

  function mobileBarKey(d, readiness) {
    const primary = editorPrimary(d, readiness);
    return readinessKey(readiness) + "|" + readiness.required.length + "|" + primary.label + "|" + primary.attrs;
  }

  function mobileBarHTML(d, readiness) {
    return (
      '<div class="editor-mobile-bar no-print" role="region" aria-label="Document task actions">' +
      '<span class="editor-mobile-save" data-document-device-save>' +
      esc(localSaveText(services.record.app_savedworkContext())) +
      '</span><div class="editor-mobile-actions" data-bar-key="' +
      esc(mobileBarKey(d, readiness)) +
      '">' +
      mobileBarActionsHTML(d, readiness) +
      "</div></div>"
    );
  }

  function readinessKey(readiness) {
    const first = readinessFirst(readiness);
    return first ? first.index + ":" + first.label : "none";
  }

  function readinessLineHTML(d, readiness) {
    return (
      checkChip(d, readiness) +
      '<span class="readiness-actions" data-readiness-key="' +
      esc(readinessKey(readiness)) +
      '">' +
      readinessActionsHTML(readiness) +
      "</span>"
    );
  }

  /* R59: the Review dialog is the one review presentation. Blocking concerns come first, then advisories; each keeps
   its check-link to the exact field (the link closes the dialog). Passed checks stay collapsed. */
  function reviewConcernsHTML(d, readiness = editorReadiness(d)) {
    if (services.edit.isLocked(d))
      return (
        "<p data-review-readonly>This document is read-only. Issued text and history are retained. Use Document actions for a " +
        "correction, or Print issued PDF for the archived original.</p>"
      );
    const { list, required, advice } = readiness,
      rows = (soft) => list.map((c, ix) => (!c.ok && !!c.soft === soft ? services.record.checkRowHTML(c, ix) : "")).join(""),
      passed = list.filter((c) => c.ok).length;
    return (
      (!required.length && !advice.length
        ? '<div class="banner ok" data-review-clear><div>No concerns. This document is ready to issue.</div></div>'
        : "") +
      (required.length
        ? '<section data-review-blocking aria-labelledby="review-blocking-title"><h3 id="review-blocking-title">Must fix before issuing</h3>' +
          rows(false) +
          "</section>"
        : "") +
      (advice.length
        ? '<section data-review-advisories aria-labelledby="review-advisories-title"><h3 id="review-advisories-title">Advisories</h3>' +
          rows(true) +
          "</section>"
        : "") +
      (passed
        ? '<details class="passed-checks"><summary>' +
          passed +
          " check" +
          (passed === 1 ? "" : "s") +
          " passed</summary>" +
          list.map((c, ix) => (c.ok ? services.record.checkRowHTML(c, ix) : "")).join("") +
          "</details>"
        : "")
    );
  }

  function reviewModalHTML() {
    const d = doc(editor.state.docId);
    if (!d) return "";
    return (
      '<div class="modal"><div class="modal-box" role="dialog" aria-modal="true" data-review-dialog><div class="modal-h"><h2>Review</h2></div>' +
      '<div class="modal-b">' +
      reviewConcernsHTML(d) +
      '</div><div class="modal-f"><button class="btn" data-close="modal">Close</button></div></div></div>'
    );
  }

  // Fields keep their aria-describedby text for unresolved checks now that the checklist lives in the Review dialog.
  function editorCheckMessagesHTML(readiness) {
    return readiness.list.map((c, ix) => (!c.ok ? '<span id="editor-check-msg-doc-' + ix + '">' + esc(c.t) + "</span>" : "")).join("");
  }

  function editorPrimary(d, ready = editorReadiness(d)) {
    const locked = services.edit.isLocked(d);
    if (services.record.recordIntegrity.status(kase(d.caseId)).valid === false)
      return { label: "Review record problem", attrs: `data-sync-safety="${esc(d.caseId)}"` };
    const pending = Object.values(editor.RECORD_ATTEMPTS).find((x) => x.cid === d.caseId && x.pendingAmendment?.payload?.docId === d.id);
    if (pending) return { label: "Confirm saved action", attrs: `data-resumerecord="${esc(pending.recordKey)}"` };
    if (d.pendingAmendment)
      return { label: "Confirm save", attrs: 'data-editor-command="' + (d.correction ? "btn-retrycorrection" : "btn-retrypublish") + '"' };
    if (editor.state.publicationBusy && doc(editor.state.publicationBusy)?.caseId === d.caseId)
      return { label: "Finishing document save…", attrs: "disabled" };
    if (d.draft && locked) return { label: "Review saved work", attrs: `data-sync-safety="${esc(d.caseId)}"` };
    if (!locked)
      // R59: Issue always opens the final confirmation, which re-runs blockers() and lists anything still to fix.
      return { label: ready.held ? "Review held draft" : "Issue", attrs: 'id="btn-final"' };
    if (!d.void && !d.superseded && !d.filedAt && !deliveredByCitation(d))
      return { label: "File issued PDF", attrs: 'data-editor-command="btn-retryfiling"' };
    return { label: "Print issued PDF", attrs: 'id="btn-print"' };
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-citation-copies]")) return;
    const d = doc(editor.state.docId);
    if (!d || editor.state.screen !== "write") return;
    editor.state.compactCitationCopies = editor.state.compactCitationCopies === d.id ? null : d.id;
    services.ui.render();
    document.querySelector("[data-citation-copies]")?.focus();
  });

  function editorEnhance() {
    const d = doc(editor.state.docId);
    if (!d || editor.state.screen !== "write") return;
    const count = ((frozenOf(d) || {}).courtCopies || globalCourtCopies()).length || 1;
    for (const parent of document.querySelectorAll(".document-workspace .desk,.document-workspace .initial-citation-previews")) {
      parent
        .querySelectorAll(".cit")
        .forEach((face, index) => face.toggleAttribute("data-editor-extra-copy", editor.state.compactCitationCopies === d.id && index % count !== 0));
    }
  }

  function editorSync() {
    const d = doc(editor.state.docId);
    if (!d || !document.querySelector(".document-workspace")) return;
    const readiness = editorReadiness(d);
    const chip = document.getElementById("chk-chip");
    if (chip) chip.outerHTML = checkChip(d, readiness);
    const actions = document.querySelector(".editor-readiness .readiness-actions"),
      key = readinessKey(readiness);
    // Replace the actions only when they change, so a focused summary button keeps its focus.
    if (actions && actions.dataset.readinessKey !== key) {
      actions.innerHTML = readinessActionsHTML(readiness);
      actions.dataset.readinessKey = key;
    }
    const messages = document.querySelector("[data-editor-check-messages]");
    if (messages) messages.innerHTML = editorCheckMessagesHTML(readiness);
    const button = document.getElementById("btn-final");
    if (button) button.innerHTML = editorPrimary(d, readiness).label;
    const bar = document.querySelector(".editor-mobile-actions"),
      barKey = mobileBarKey(d, readiness);
    // Replace only on change, so a focused bar button keeps its focus.
    if (bar && bar.dataset.barKey !== barKey) {
      bar.innerHTML = mobileBarActionsHTML(d, readiness);
      bar.dataset.barKey = barKey;
    }
    const review = document.getElementById("btn-review"),
      required = services.edit.isLocked(d) ? 0 : readiness.required.length;
    if (review) review.textContent = "Review" + (required ? " · " + required : "");
    editorEnhance();
  }

  function editorSection(id, title, body) {
    return body
      ? '<section class="editor-section" id="' +
          `${id}` +
          '" aria-labelledby="' +
          `${id}` +
          '-title"><h2 class="no-print" tabindex="-1" id="' +
          `${id}` +
          '-title">' +
          `${title}` +
          "</h2>" +
          `${body}` +
          "</section>"
      : "";
  }

  function editorWorkspaceHTML({ d, meta, inspection, work, record, editable, locked, ready }) {
    return (
      '<div class="document-workspace" data-editor-doc="' +
      `${esc(d.id)}` +
      '">' +
      `${meta}` +
      "" +
      `${documentSaveHTML(services.record.app_savedworkContext(), d)}` +
      "" +
      `${services.record.publicationPanel(d)}` +
      "" +
      `${services.record.filingPanel(d)}` +
      "" +
      `${services.record.citationRecoveryPanel(d)}` +
      "" +
      "".concat(
        d.superseded
          ? '<div class="banner warn no-print"><div><strong>This is a replaced versio' +
              'n.</strong> <button class="lnk" data-open="' +
              `${esc(d.superseded.replacedBy)}` +
              '">Open the corrected document</button></div></div>'
          : "",
      ) +
      '<nav class="editor-sections no-print" aria-label="Document tasks">' +
      // Recipients opens the copies and email dialog itself rather than moving to a section.
      `${editable ? '<button id="btn-cc" aria-haspopup="dialog">Recipients</button>' : ""}` +
      // R59: Violation Items opens the violation picker (only where violations may be added); Review opens the
      // Review dialog. Neither scrolls the page.
      `${services.edit.structEditable(d) ? '<button id="btn-add-top" aria-haspopup="dialog">Violation Items</button>' : ""}` +
      '<button id="btn-review" data-editor-review aria-haspopup="dialog">Review' +
      `${!locked && ready.required.length ? " · " + ready.required.length : ""}` +
      "</button></nav>" +
      "".concat(!locked ? '<div class="editor-readiness no-print">' + readinessLineHTML(d, ready) + "</div>" : "") +
      "" +
      `${editorSection("editor-inspection", "Inspection", inspection)}` +
      "" +
      `${editorSection("editor-items", "Violation items", work)}` +
      "" +
      `${record}` +
      `${!locked ? "<div hidden data-editor-check-messages>" + editorCheckMessagesHTML(ready) + "</div>" : ""}` +
      `${mobileBarHTML(d, ready)}` +
      "</div>"
    );
  }
  function screenWrite() {
    const d = doc(editor.state.docId);
    if (!d) {
      editor.state.screen = "cases";
      return services.ui.screenCases();
    }
    services.record.snow.prepare(d);
    const k = docCase(d),
      locked = services.edit.isLocked(d),
      ready = editorReadiness(d),
      primary = editorPrimary(d, ready);
    const actions = editorActionsHTML({ d, locked, primary, services });
    const tyLabel = (DOC_TYPES.find((t) => t.id === d.type) || {}).label || d.type;
    const fr = d.fromReinspId ? reinsp(d.fromReinspId) : null;
    const editable = !locked;
    const meta = editorMetadataHTML({ d, tyLabel, locked, services });
    // The Inspection section appears only when it holds something to act on; ordinary inspection, property and
    // mailing details are edited on the working document, where required checks link to the exact field.
    const reviewVisit = fr && fr.draft && !d.correction && !d.pendingAmendment,
      inspectionParts = `${services.record.newDocuments.details(d)}${services.record.snow.factsForm(d)}${services.record.correctionPanel(d)}`;
    const inspection = editorInspectionHTML({ reviewVisit, inspectionParts, locked });
    const work = editorWorkHTML({ d, editable, services });
    // R59: the checklist is in the Review dialog; the issued record and next actions stay on the page.
    const record = `${services.record.recordHistoryHTML(d)}${services.record.newDocuments.actionPanel(d)}`;
    return services.ui.shell(
      k.address,
      `${k.number} · ${tyLabel}`,
      actions,
      editorWorkspaceHTML({ d, meta, inspection, work, record, editable, locked, ready }),
    );
  }

  function renumber(d) {
    d.items.forEach((it, ix) => {
      it.no = String(ix + 1);
    });
  }

  function moveItem(id, direction, grip = false) {
    const d = doc(editor.state.docId);
    if (!d || !services.edit.structEditable(d)) return false;
    const ix = d.items.findIndex((it) => it.id === id),
      to = ix + (direction === "up" ? -1 : 1);
    if (ix < 0 || to < 0 || to >= d.items.length) return false;
    [d.items[ix], d.items[to]] = [d.items[to], d.items[ix]];
    renumber(d);
    workspace.DIRTY = true;
    refreshSheet();
    const target = document.querySelector(
      grip ? '[data-grip="' + checkAttr(id) + '"]' : '[data-move="' + checkAttr(id) + '"][data-direction="' + direction + '"]',
    );
    (target || document.querySelector('[data-grip="' + checkAttr(id) + '"]'))?.focus();
    services.ui.toast("Item " + (to + 1) + " moved " + direction);
    return true;
  }

  function newDoc(caseId, type) {
    if (services.record.snow.isCase(kase(caseId)) && type !== "notice" && type !== "citation") {
      services.ui.toast("Snow cases offer only the snow citation.");
      return;
    }
    if (services.record.snow.isCase(kase(caseId))) type = "citation";
    if (services.record.recordIntegrity.blocked(caseId)) {
      services.ui.toast("This record was changed outside the program. Read-only.");
      return;
    }
    const nd = {
      id: services.edit.uid("d"),
      caseId: caseId,
      type: type,
      created: recordDay(today),
      status: "Draft",
      draft: true,
      mailed: recordDay(today),
      authoringVersion: 16,
      items: [],
      cc: "",
      cits: {},
      expectedHead: recordHead(caseId),
    };
    workspace.DOCS.unshift(nd);
    if (services.record.snow.isCase(kase(caseId))) services.record.snow.addDefault(nd);
    editor.state.docId = nd.id;
    editor.state.screen = "write";
    workspace.DIRTY = true;
    services.edit.saveDrafts();
    services.ui.render();
    services.ui.toast(((DOC_TYPES.find((t) => t.id === type) || {}).label || type) + " started");
  }

  function refreshSheet() {
    const d = doc(editor.state.docId),
      desk = document.querySelector(".desk");
    if (d && desk) {
      desk.innerHTML = services.record.documentHTML(d);
      services.ui.paginate();
      syncChip();
      services.edit.scheduleDraftSave();
    }
  }

  function syncChip() {
    editorSync();
    services.ui.highlightOpenChecks();
  }

  function refreshOverlay() {
    const languageFocus = rememberLanguageFocus(services.record.app_languagediscoveryContext());
    services.ui.A11Y.rememberFocus();
    document.getElementById("overlay").innerHTML = services.ui.overlayHTML();
    enhanceDialog();
    services.ui.A11Y.enhance();
    const q = document.getElementById("pk-q");
    if (q) {
      q.focus();
      q.setSelectionRange(q.value.length, q.value.length);
    }
    restoreLanguageFocus(services.record.app_languagediscoveryContext(), languageFocus);
  }

  function enhanceDialog() {
    const box = document.querySelector('[role="dialog"]');
    const app = document.getElementById("app");
    if (app) app.inert = !!box;
    if (!box) return;
    const heading = box.querySelector("h2");
    if (heading) {
      heading.id = "dialog-title";
      box.setAttribute("aria-labelledby", "dialog-title");
    }
    box.tabIndex = -1;
    if (editor.state.modal === "final" || editor.state.modal === "review") {
      box.focus({ preventScroll: true });
      const body = box.querySelector(".modal-b");
      if (body) body.scrollTop = 0;
      return;
    }
    if (!box.contains(document.activeElement)) {
      const target = box.querySelector("#pk-q,button:not([disabled]),input:not([disabled])");
      (target || box).focus();
    }
  }

  return {
    editorSync,
    renumber,
    moveItem,
    newDoc,
    reviewModalHTML,
    screenWrite,
    editorEnhance,
    refreshSheet,
    syncChip,
    refreshOverlay,
    enhanceDialog,
    editorReadiness,
    readinessText,
    readinessFirst,
    reviewConcernsHTML,
  };
}
