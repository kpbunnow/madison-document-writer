import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
/* Editor event ownership. Construction is inert; core registers at the original startup positions. */
import { registerEventOnce } from "./event_registration.js";
import { doc, draftDocFor, docsFor, docCase, kase, eventsFor, reinsp, docInsp } from "./writer_queries.js";
import { itemLibraryKey, alignedExtension } from "./document_rules.js";
import { clone } from "./record_values.js";
import { emailList } from "./mailing_rules.js";
import { validCaseNumber } from "../assets/shared.js";
import { countBlanks } from "./presentation_format.js";
export function createEditorEvents(services) {
  function registerBlankClicks(target = document) {
    return registerEventOnce(target, "editor.registerBlankClicks", "click", (e) => {
      const el = e.target.closest(".blank-edit");
      if (el) {
        e.preventDefault();
        services.fillBlank(el);
      }
    });
  }

  function registerBlankKeys(target = document) {
    return registerEventOnce(target, "editor.registerBlankKeys", "keydown", (e) => {
      if (e.target.matches(".blank-edit") && ["Enter", " "].includes(e.key)) {
        e.preventDefault();
        services.fillBlank(e.target);
      }
    });
  }

  function registerPointerStart(target = document) {
    return registerEventOnce(target, "editor.registerPointerStart", "pointerdown", (e) => {
      const g = e.target.closest && e.target.closest("[data-grip]");
      if (!g) return;
      const tr = g.closest("tr");
      if (!tr) return;
      e.preventDefault();
      editor.dragging = { tr: tr, body: tr.parentNode };
      tr.classList.add("dragging");
      try {
        g.setPointerCapture(e.pointerId);
      } catch (err) {
        /* Pointer capture is optional; ordinary pointer movement still supports this interaction. */
      }
    });
  }

  function registerPointerMove(target = document) {
    return registerEventOnce(target, "editor.registerPointerMove", "pointermove", (e) => {
      if (!editor.dragging) return;
      const rows = Array.prototype.slice.call(editor.dragging.body.querySelectorAll("tr[data-row]"));
      for (let n = 0; n < rows.length; n++) {
        const r = rows[n];
        if (r === editor.dragging.tr) continue;
        const b = r.getBoundingClientRect();
        if (e.clientY >= b.top && e.clientY <= b.bottom) {
          editor.dragging.body.insertBefore(editor.dragging.tr, e.clientY < b.top + b.height / 2 ? r : r.nextSibling);
          break;
        }
      }
    });
  }

  function registerPointerEnd(target = document) {
    return registerEventOnce(target, "editor.registerPointerEnd", "pointerup", () => {
      if (!editor.dragging) return;
      const body = editor.dragging.body;
      editor.dragging.tr.classList.remove("dragging");
      editor.dragging = null;
      const d = doc(editor.state.docId);
      if (!d || !services.structEditable(d)) return;
      const order = Array.prototype.slice.call(body.querySelectorAll("tr[data-row]")).map((r) => r.getAttribute("data-row"));
      d.items.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      services.renumber(d);
      workspace.DIRTY = true;
      services.refreshSheet();
    });
  }

  function registerPointerCancel(target = document) {
    return registerEventOnce(target, "editor.registerPointerCancel", "pointercancel", () => {
      if (editor.dragging) {
        editor.dragging.tr.classList.remove("dragging");
        editor.dragging = null;
        services.refreshSheet();
      }
    });
  }

  function registerReorderKeys(target = document) {
    return registerEventOnce(target, "editor.registerReorderKeys", "keydown", (e) => {
      const grip = e.target.closest?.("[data-grip]");
      if (!grip || !["ArrowUp", "ArrowDown"].includes(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      services.moveItem(grip.dataset.grip, e.key === "ArrowUp" ? "up" : "down", true);
    });
  }

  function registerGroupFocus(target = document) {
    return registerEventOnce(target, "editor.registerGroupFocus", "focusin", (e) => {
      if (e.target.dataset && e.target.dataset.field === "group") editor.groupOld = e.target.innerText.trim();
    });
  }

  function registerDatePicker(target = document) {
    return registerEventOnce(target, "editor.registerDatePicker", "click", (e) => {
      const el = e.target.closest && e.target.closest(".hdr-in");
      if (!el || el.disabled) return;
      if (typeof el.showPicker === "function") {
        try {
          el.showPicker();
        } catch (err) {
          /* The browser can refuse its optional picker; typed dates remain available. */
        }
      }
    });
  }

  function registerPlainPaste(target = document) {
    return registerEventOnce(target, "editor.registerPlainPaste", "paste", (e) => {
      const el = e.target.closest && e.target.closest("[contenteditable]");
      if (!el) return;
      e.preventDefault();
      document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain"));
    });
  }

  function registerReviewCommands(target = document) {
    return registerEventOnce(target, "editor.registerReviewCommands", "click", (e) => {
      const button = e.target.closest("[data-editor-review],[data-editor-command],[data-open-checklist],[data-mobile-review],[data-mobile-primary]");
      if (!button) return;
      e.preventDefault();
      services.captureWork();
      if (button.hasAttribute("data-mobile-primary")) {
        // The narrow-screen bar repeats the toolbar's primary action; the toolbar button keeps its own handler and checks.
        const primary = document.querySelector(".topbar .editor-primary");
        if (primary && !primary.disabled) primary.click();
        return;
      }
      if (button.matches("[data-editor-review],[data-open-checklist],[data-mobile-review]")) {
        // R59: one Review dialog; it lists the current checks() each time it opens and returns focus on close.
        if (!doc(editor.state.docId)) return;
        editor.state.picker = false;
        editor.state.modal = "review";
        services.render();
        return;
      }
      const target = document.getElementById(button.dataset.editorCommand);
      if (target && !target.disabled) {
        button.disabled = true;
        target.click();
      }
    });
  }

  const openDocument = (t) => {
    const id = t.dataset.open,
      d = doc(id);
    if (!d) return;
    services.preflightCase(d.caseId, "document", () => {
      editor.state.docId = id;
      editor.state.screen = "write";
      services.render();
      window.scrollTo(0, 0);
    });
    return;
  };

  const newNotice = (t) => {
    const dd = draftDocFor(t.dataset.new);
    if (dd) {
      services.preflightCase(dd.caseId, "document draft", () => {
        editor.state.docId = dd.id;
        editor.state.screen = "write";
        services.render();
      });
      return;
    }
    if (docsFor(t.dataset.new).length) {
      services.toast("This case already has an official notice");
      return;
    }
    const cid = t.dataset.new;
    services.preflightCase(cid, "new notice", () => services.newDoc(cid, "notice"));
    return;
  };

  const deleteItem = (d, t) => {
    if (!services.structEditable(d)) {
      services.toast("This notice has been issued — its items are fixed");
      return;
    }
    const ix = d.items.findIndex((i) => i.id === t.dataset.del);
    if (ix < 0) return;
    const gone = d.items.splice(ix, 1)[0];
    if (itemLibraryKey(gone)) {
      d.selectionCache = d.selectionCache || {};
      d.selectionCache[itemLibraryKey(gone)] = clone(gone);
    }
    services.renumber(d);
    workspace.DIRTY = true;
    services.refreshSheet();
    services.toastUndo("Removed item — " + (gone.title || "untitled"), () => {
      if (!itemLibraryKey(gone) || !d.items.some((i) => itemLibraryKey(i) === itemLibraryKey(gone))) {
        d.items.splice(ix, 0, gone);
        services.renumber(d);
        workspace.DIRTY = true;
        services.saveDrafts();
        services.refreshSheet();
      }
    });
    return;
  };

  const moveItem = (t) => {
    services.moveItem(t.dataset.move, t.dataset.direction);
    return;
  };

  const toggleGroup = (d, t) => {
    if (!services.structEditable(d)) return;
    const it = d.items.find((i) => i.id === t.dataset.grpbtn);
    if (!it) return;
    it.group = it.group ? "" : "GENERAL EXTERIOR";
    services.refreshSheet();
    if (it.group) {
      const h = document.querySelector('[data-field="group"][data-id="' + it.id + '"]');
      if (h) {
        h.focus();
        const r = document.createRange();
        r.selectNodeContents(h);
        const s = getSelection();
        s.removeAllRanges();
        s.addRange(r);
      }
    }
    return;
  };

  const toggleAbatement = (d, t) => {
    if (services.isLocked(d) || d.type !== "notice") return;
    const it = d.items.find((i) => i.id === t.dataset.abate);
    if (!it || it.done) return;
    it.abate = !it.abate;
    t.dataset.on = it.abate ? 1 : 0;
    t.textContent = it.abate ? "Y" : "N";
    workspace.DIRTY = true;
    services.scheduleDraftSave();
    return;
  };

  const openOriginal = (d) => {
    services.openIssuedCopy(d);
    return;
  };

  const printDocument = (d) => {
    if (d.pendingAmendment) {
      services.toast("Confirm the pending save before distributing this document.");
      return;
    }
    if (!d.draft) services.openIssuedCopy(d);
    else services.printNotice(services.printJob(d));
    return;
  };

  const reviewDocument = (d) => {
    if (services.isLocked(d)) {
      services.toast("This document has already been issued");
      return;
    }
    if (workspace.CASEDIR && workspace.NEEDGRANT) services.grantCaseFolder(true); // reconnect while the click still counts
    editor.state.picker = false;
    editor.state.modal = "final";
    services.render();
    services.refreshCatalog();
    return;
  };

  const finalizeDocument = (d, t) => {
    // a document with an open check never gets issued, whatever the click path
    if (!d || !d.draft || t.disabled || editor.AMENDMENT_BUSY || editor.state.publicationBusy) return;
    const mailedEl = document.getElementById("fin-mailed");
    if (mailedEl) services.initialCitations.mailed(d, mailedEl.value);
    if (d.correction) {
      d.correction.reviewed = !!(document.getElementById("correction-reviewed") || {}).checked;
      if (!d.correction.reviewed) {
        services.toast("Review and confirm the listed changes.");
        return;
      }
    }
    if (services.blockers(d).length) {
      services.toast("Clear the outstanding checks before finalizing");
      return;
    }
    if (d.correction) {
      const list = emailList(docCase(d)).filter((e) => String(e.addr || "").trim());
      const picked = list.filter((_, ix) => {
        const b = document.querySelector('[data-finsend="' + ix + '"]');
        return b && b.checked;
      });
      d.emailedTo = picked.map((e) => ({ addr: e.addr, kind: e.kind || "Other" }));
      services.issueCorrection(d);
      return;
    }
    // ask for folder permission here, on the click itself, while the browser
    // still counts it as one; asking later gets refused without explanation
    // record who it goes to before it is frozen, so the filed copy, the
    // attachment and the record all say the same thing
    const list = emailList(kase(d.caseId)).filter((e) => String(e.addr || "").trim());
    const picked = list.filter((_, ix) => {
      const b = document.querySelector('[data-finsend="' + ix + '"]');
      return b && b.checked;
    });
    editor.state.emailOnIssue = picked.length > 0;
    d.emailedTo = picked.map((e) => ({ addr: e.addr, kind: e.kind || "Other" }));
    // R59: one submission; publishDocument also refuses a second concurrent issuance of the same draft.
    t.disabled = true;
    if (workspace.CASEDIR && workspace.NEEDGRANT) {
      services.grantCaseFolder(true).then(() => services.runFinalize(d));
      return;
    }
    services.runFinalize(d);
    return;
  };

  function registerDocumentInput(target = document) {
    return registerEventOnce(target, "editor.registerDocumentInput", "input", (e) => {
      const el = e.target;
      if (el.id === "correction-action-date") {
        return services.correctionEvents.editActionDate(el);
      }
      if (el.id === "correction-reason" || el.id === "correction-external") {
        return services.correctionEvents.editCorrectionReason(el);
      }
      if (el.id === "case-search" || el.id === "folder-search") {
        return services.workspaceEvents.editSearch(el);
      }
      if (el.id === "pk-q") {
        return services.catalogEvents.editPickerSearch(el);
      }
      // notes must not redraw on every keystroke or the caret jumps
      if (el.dataset && (el.dataset.cc || el.dataset.em || el.dataset.agent)) {
        return services.contactEvents.editRecipient(el);
      }
      if (el.dataset && el.dataset.rinote) {
        return services.reinspectionEvents.editItemNote(el);
      }
      if (el.id === "lib-filter") {
        return services.catalogEvents.editLibrarySearch(el);
      }

      const d = doc(editor.state.docId);
      if (!d || services.isLocked(d)) return;
      if (d.correction && el.id !== "correction-reviewed") {
        d.correction.reviewed = false;
        const reviewed = document.getElementById("correction-reviewed");
        if (reviewed) reviewed.checked = false;
      }
      workspace.DIRTY = true;
      services.scheduleDraftSave();
      const val = el.dataset.case === "number" ? el.textContent.trim() : el.isContentEditable ? el.innerText : el.value;

      if (el.dataset.case) {
        const k = docCase(d),
          f = el.dataset.case;
        if (f === "number" && !validCaseNumber(el.textContent.trim())) {
          el.setAttribute("aria-invalid", "true");
          el.title = "Case number must use 3–80 letters, numbers or hyphens";
          services.toast(el.title);
          return;
        }
        if (f === "number") {
          el.removeAttribute("aria-invalid");
          el.removeAttribute("title");
        }
        if (f === "number" && eventsFor(d.caseId).length) {
          el.textContent = k.number;
          services.toast("The case number is fixed after the record starts");
          return;
        }
        if (f === "ownerBlock") {
          const o = services.splitOwner(val);
          k.owner = o.owner;
          k.ownerAddr = o.addr;
          services.syncChip();
        } else if (el.dataset.fmt === "date") {
          k[f] = services.parseDate(val) || String(val || "").trim();
        } else if (el.dataset.fmt === "time") {
          k[f] = services.parseTime(val) || String(val || "").trim();
        } else k[f] = val;
        if (f === "number")
          document.querySelectorAll(".document-workspace .n-foot .mono,.document-workspace .n-cont .r").forEach((foot) => (foot.textContent = val));
        services.syncChip();
        return;
      }
      if (el.dataset.doc) {
        if (el.dataset.fmt === "date") {
          d[el.dataset.doc] = services.parseDate(val) || String(val || "").trim();
        } else d[el.dataset.doc] = val;
        services.syncChip();
        return;
      }
      if (el.dataset.cit) {
        return services.citationEvents.editCitationInput(el, d, val);
      }

      const f = el.dataset.field;
      if (!f) return;
      const it = d.items.find((i) => i.id === el.dataset.id);
      if (!it) return;
      if (alignedExtension(d)) services.newDocuments.invalidateItemReview(d);

      if (f === "due") {
        if (alignedExtension(d)) {
          services.newDocuments.setSpecialDue(d, it, val);
          return;
        }
        const m = services.MINDUE();
        it.due = val;
        services.updateDueIndicators(d);
        if (val && val < m && !services.unchangedCorrectionValue(d, it.id, "due"))
          services.toast("Check this past due date before issuing. Your entry has been kept.");
        services.syncChip();
        return;
      }
      if (f === "sections") {
        if (!it.libraryKey) it.libraryKey = itemLibraryKey(it);
        it.sections = val
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
        delete it.lib;
        services.syncChip();
        return;
      }
      if (f === "group") {
        // rename only the contiguous run that shared the old heading, never
        // every ungrouped item just because the old value was blank
        const old = editor.groupOld,
          ix = d.items.indexOf(it);
        it.group = val;
        if (old) {
          for (let n = ix + 1; n < d.items.length && d.items[n].group === old; n++) d.items[n].group = val;
          for (let n = ix - 1; n >= 0 && d.items[n].group === old; n--) d.items[n].group = val;
        }
        editor.groupOld = val;
        return;
      }
      if (f === "text") {
        it.text = val;
        const b = countBlanks(val),
          badge = document.querySelector('[data-blanks="' + it.id + '"]');
        if (badge) {
          badge.style.display = b ? "" : "none";
          badge.textContent = b + " blank" + (b === 1 ? "" : "s");
        }
        services.syncChip();
        return;
      }
      it[f] = val;
      services.syncChip();
    });
  }

  function registerDocumentChange(target = document) {
    return registerEventOnce(target, "editor.registerDocumentChange", "change", (e) => {
      if (e.target.id === "ri-walk-mode") {
        return services.reinspectionEvents.changeWalkMode(e);
      }
      if (e.target.id === "ri-followup-intent") {
        return services.reinspectionEvents.changeFollowup(e);
      }
      if (e.target.id === "lib-status" || e.target.id === "pk-status") {
        return services.catalogEvents.changeLibraryStatus(e);
      }
      if (e.target.id === "correction-type" || (e.target.dataset || {}).correctionOutcome) {
        return services.correctionEvents.changeCorrection(e);
      }
      if (e.target.id === "keep-adding") {
        return services.catalogEvents.changeKeepAdding(e);
      }
      if (e.target.id === "case-filter" || e.target.id === "case-inspector") {
        return services.workspaceEvents.changeCaseFilter(e);
      }
      if ((e.target.id === "acc-date" || e.target.id === "acc-time") && editor.state.acc) {
        return services.importEvents.changeInspectionDateTime(e);
      }
      if (e.target.dataset && e.target.dataset.em) {
        return services.contactEvents.changeEmail(e);
      }
      const rr = reinsp(editor.state.reinspId),
        ds = e.target.dataset || {};
      if (rr && rr.draft && !rr.docId && (ds.ridate || ds.ridue || (ds.ricite && (rr.importRule?.cite || !e.target.checked)))) {
        return services.reinspectionEvents.changeOutcomeDetails(ds, rr, e);
      }
      if (e.target.id === "ri-date") {
        return services.reinspectionEvents.changeVisitDate(e);
      }
      if (e.target.id === "ri-time") {
        return services.reinspectionEvents.changeVisitTime(e);
      }
      if (e.target.id === "ri-insp") {
        return services.reinspectionEvents.changeInspector(e);
      }
      if (e.target.id === "pk-grp") {
        return services.catalogEvents.changePickerGroup(e);
      }
      const d = doc(editor.state.docId);
      if (!d) return;
      if (e.target.dataset && e.target.dataset.doc === "inspectorId" && !services.isLocked(d)) {
        d.inspectorId = e.target.value;
        Object.values(d.cits || {}).forEach((c) => (c.deptId = docInsp(d).badge || ""));
        workspace.DIRTY = true;
        services.refreshSheet();
      }
    });
  }
  return {
    registerBlankClicks,
    registerBlankKeys,
    registerPointerStart,
    registerPointerMove,
    registerPointerEnd,
    registerPointerCancel,
    registerReorderKeys,
    registerGroupFocus,
    registerDatePicker,
    registerPlainPaste,
    registerReviewCommands,
    openDocument,
    newNotice,
    deleteItem,
    moveItem,
    toggleGroup,
    toggleAbatement,
    openOriginal,
    printDocument,
    reviewDocument,
    finalizeDocument,
    registerDocumentInput,
    registerDocumentChange,
  };
}
