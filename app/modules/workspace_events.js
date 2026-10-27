import { editorState as editor } from "./editor_state.js";
import { importsState as imports } from "./imports_state.js";
import { startupState as startup } from "./startup_state.js";
/* Workspace event ownership. Construction is inert; core registers at the original startup positions. */
import { registerEventOnce } from "./event_registration.js";
import { WriterState } from "./state.js";
import { kase, doc } from "./writer_queries.js";
const workspaceActions = [
  {
    id: "t-undo",
    matches: (t, e) => t.id === "t-undo",
    run: (services, t, e, d) => {
      const f = editor.undoFn;
      editor.undoFn = null;
      document.getElementById("toast").innerHTML = "";
      if (f) f();
      return;
    },
  },
  {
    id: "exportcase",
    matches: (t, e) => t.dataset.exportcase,
    run: (services, t, e, d) => {
      if (!services.caseNumberAllowed(kase(t.dataset.exportcase))) {
        services.toast("Case number needs correction before export");
        return;
      }
      services.downloadFile(services.caseFileName(kase(t.dataset.exportcase)), JSON.stringify(services.caseFile(t.dataset.exportcase), null, 2));
      services.toast("Case record downloaded. Unfinished drafts stay on this device.");
      return;
    },
  },
  {
    id: "btn-openfile",
    matches: (t, e) => t.id === "btn-openfile" || t.hasAttribute("data-openfile"),
    run: (services, t, e, d) => {
      if (services.storageMode() === "folder") {
        services.listCaseFolder().then((fs) => {
          editor.state.folder = fs;
          editor.state.modal = "folder";
          services.render();
        });
        return;
      }
      services.pickCaseFile();
      return;
    },
  },
  {
    id: "btn-linkdir",
    matches: (t, e) => t.id === "btn-linkdir",
    run: (services, t, e, d) => {
      services.linkCaseFolder();
      return;
    },
  },
  {
    id: "btn-grantdir",
    matches: (t, e) => t.id === "btn-grantdir",
    run: (services, t, e, d) => {
      services.grantCaseFolder();
      return;
    },
  },
  {
    id: "btn-browse",
    matches: (t, e) => t.id === "btn-browse",
    run: (services, t, e, d) => {
      services.listCaseFolder().then((fs) => {
        editor.state.folder = fs;
        editor.state.modal = "folder";
        services.render();
      });
      return;
    },
  },
  {
    id: "openfolder",
    matches: (t, e) => t.dataset.openfolder,
    run: (services, t, e, d) => {
      editor.state.modal = null;
      services.openFromFolder(t.dataset.openfolder);
      return;
    },
  },
  {
    id: "discardri",
    matches: (t, e) => t.dataset.discardri,
    run: (services, t, e, d) => {
      return services.reinspectionEvents.discardVisit(t);
    },
  },
  {
    id: "discard",
    matches: (t, e) => t.dataset.discard,
    run: (services, t, e, d) => {
      return services.recoveryEvents.discardDocument(t);
    },
  },
  {
    id: "btn-flush",
    matches: (t, e) => t.id === "btn-flush",
    run: (services, t, e, d) => {
      if (WriterState.CASEDIR && WriterState.NEEDGRANT) {
        services
          .grantCaseFolder(true)
          .then(() => services.flushPending())
          .then(() => services.render());
        return;
      }
      services.flushPending().then(() => services.render());
      return;
    },
  },
  {
    id: "caseSync",
    matches: (t, e) => t.dataset.caseSync,
    run: (services, t, e, d) => {
      if (!WriterState.CASEDIR) {
        editor.state.modal = "storage";
        services.render();
        return;
      }
      if (WriterState.NEEDGRANT) {
        services.grantCaseFolder(true).then((ok) => (ok ? services.flushPending() : services.render()));
        return;
      }
      services.flushPending().then(() => services.render());
      return;
    },
  },
  {
    id: "btn-storage",
    matches: (t, e) => t.id === "btn-storage",
    run: (services, t, e, d) => {
      document.getElementById("utility-dialog")?.close();
      editor.state.modal = "storage";
      services.render();
      return;
    },
  },
  {
    id: "btn-clear",
    matches: (t, e) => t.id === "btn-clear",
    run: (services, t, e, d) => {
      editor.state.modal = "clear";
      services.render();
      return;
    },
  },
  {
    id: "btn-cc",
    matches: (t, e) => t.id === "btn-cc",
    run: (services, t, e, d) => {
      return services.contactEvents.openRecipients();
    },
  },
  {
    id: "btn-addcc",
    matches: (t, e) => t.id === "btn-addcc",
    run: (services, t, e, d) => {
      return services.contactEvents.addCopy();
    },
  },
  {
    id: "btn-addem",
    matches: (t, e) => t.id === "btn-addem",
    run: (services, t, e, d) => {
      return services.contactEvents.addRecipient();
    },
  },
  {
    id: "rmcc",
    matches: (t, e) => t.dataset.rmcc !== undefined && t.hasAttribute("data-rmcc"),
    run: (services, t, e, d) => {
      return services.contactEvents.removeCopy(t);
    },
  },
  {
    id: "rmem",
    matches: (t, e) => t.dataset.rmem !== undefined && t.hasAttribute("data-rmem"),
    run: (services, t, e, d) => {
      return services.contactEvents.removeRecipient(t);
    },
  },
  {
    id: "clearcases",
    matches: (t, e) => t.dataset.clearcases,
    run: (services, t, e, d) => {
      services.clearCases(t.dataset.clearcases);
      return;
    },
  },
  {
    id: "rmcase",
    matches: (t, e) => t.dataset.rmcase,
    run: (services, t, e, d) => {
      const k = kase(t.dataset.rmcase),
        risky = services.caseUnsaved(k);
      if (
        risky &&
        !confirm(
          k.number +
            " has " +
            risky +
            ". Removing it from this workspace loses that work. The shared case record is not deleted. Remove it from this workspace anyway?",
        )
      )
        return;
      if (services.removeCase(k.id) === false) return;
      editor.state.screen = "cases";
      services.render();
      services.toast(k.number + " removed from this workspace. The shared case record is not deleted.");
      return;
    },
  },
  {
    id: "btn-email",
    matches: (t, e) => t.id === "btn-email",
    run: (services, t, e, d) => {
      return services.contactEvents.emailDocument();
    },
  },
  {
    id: "btn-sendgo",
    matches: (t, e) => t.id === "btn-sendgo" || t.id === "btn-sendnone",
    run: (services, t, e, d) => {
      return services.contactEvents.sendDocument(t);
    },
  },
  {
    id: "btn-savecase",
    matches: (t, e) => t.id === "btn-savecase",
    run: (services, t, e, d) => {
      const dd = doc(editor.state.docId);
      if (!dd) return;
      if (WriterState.CASEDIR && WriterState.NEEDGRANT) {
        services.grantCaseFolder(true).then(() => services.saveCaseFile(dd.caseId));
        return;
      }
      services.saveCaseFile(dd.caseId);
      return;
    },
  },
  {
    id: "btn-testwrite",
    matches: (t, e) => t.id === "btn-testwrite",
    run: (services, t, e, d) => {
      services.testWrite();
      return;
    },
  },
  {
    id: "btn-reindex",
    matches: (t, e) => t.id === "btn-reindex",
    run: (services, t, e, d) => {
      services.rebuildIndex();
      return;
    },
  },
  {
    id: "btn-syncpdf",
    matches: (t, e) => t.id === "btn-syncpdf",
    run: (services, t, e, d) => {
      return services.workflowEvents.syncPdf(t);
    },
  },
  {
    id: "btn-risave",
    matches: (t, e) => t.id === "btn-risave",
    run: (services, t, e, d) => {
      return services.recoveryEvents.saveVisit();
    },
  },
  {
    id: "btn-recordri",
    matches: (t, e) => t.id === "btn-recordri",
    run: (services, t, e, d) => {
      return services.reinspectionEvents.recordVisit();
    },
  },
  {
    id: "reinsp",
    matches: (t, e) => t.dataset.reinsp,
    run: (services, t, e, d) => {
      return services.reinspectionEvents.startVisit(t);
    },
  },
  {
    id: "riwalk",
    matches: (t, e) => t.dataset.riwalk !== undefined,
    run: (services, t, e, d) => {
      return services.reinspectionEvents.toggleWalk(t);
    },
  },
  {
    id: "data-riwalk-next",
    matches: (t, e) => t.hasAttribute("data-riwalk-next"),
    run: (services, t, e, d) => {
      return services.reinspectionEvents.nextItem();
    },
  },
  {
    id: "data-riwalk-skip",
    matches: (t, e) => t.hasAttribute("data-riwalk-skip"),
    run: (services, t, e, d) => {
      return services.reinspectionEvents.skipDetails();
    },
  },
  {
    id: "data-riwalk-return",
    matches: (t, e) => t.hasAttribute("data-riwalk-return"),
    run: (services, t, e, d) => {
      return services.reinspectionEvents.returnDetails();
    },
  },
  {
    id: "data-riwalk-prev",
    matches: (t, e) => t.hasAttribute("data-riwalk-prev"),
    run: (services, t, e, d) => {
      return services.reinspectionEvents.previousItem();
    },
  },
  {
    id: "data-riwalk-undo",
    matches: (t, e) => t.hasAttribute("data-riwalk-undo"),
    run: (services, t, e, d) => {
      return services.reinspectionEvents.undoOutcome();
    },
  },
  {
    id: "rifilter",
    matches: (t, e) => t.dataset.rifilter !== undefined && t.hasAttribute("data-rifilter"),
    run: (services, t, e, d) => {
      return services.reinspectionEvents.filterItems(t);
    },
  },
  {
    id: "setoc",
    matches: (t, e) => t.dataset.setoc !== undefined && t.dataset.item,
    run: (services, t, e, d) => {
      return services.reinspectionEvents.recordOutcome(t);
    },
  },
  {
    id: "makedoc",
    matches: (t, e) => t.dataset.makedoc,
    run: (services, t, e, d) => {
      return services.reinspectionEvents.makeDocument(t);
    },
  },
  {
    id: "picker-bg",
    matches: (t, e) => t.id === "picker-bg" && e.target.id === "picker-bg",
    run: (services, t, e, d) => {
      return services.catalogEvents.closePickerBackground();
    },
  },
  {
    id: "close",
    matches: (t, e) => t.dataset.close === "picker",
    run: (services, t, e, d) => {
      return services.catalogEvents.closePicker();
    },
  },
  {
    id: "close",
    matches: (t, e) => t.dataset.close === "modal",
    run: (services, t, e, d) => {
      return services.contactEvents.closeModal();
    },
  },
  {
    id: "libcl",
    matches: (t, e) => t.dataset.libcl,
    run: (services, t, e, d) => {
      return services.catalogEvents.selectChecklist(t);
    },
  },
  {
    id: "open",
    matches: (t, e) => t.dataset.open,
    run: (services, t, e, d) => {
      return services.editorEvents.openDocument(t);
    },
  },
  {
    id: "new",
    matches: (t, e) => t.dataset.new,
    run: (services, t, e, d) => {
      return services.editorEvents.newNotice(t);
    },
  },
  {
    id: "grp",
    matches: (t, e) => t.dataset.grp,
    run: (services, t, e, d) => {
      return services.catalogEvents.selectGroup(t);
    },
  },
];
const documentActions = [
  {
    id: "adoptCatalog",
    matches: (t, e) => t.dataset.adoptCatalog,
    run: (services, t, e, d) => {
      return services.catalogEvents.adoptReview(d, t);
    },
  },
  {
    id: "resumerecord",
    matches: (t, e) => t.dataset.resumerecord,
    run: (services, t, e, d) => {
      return services.correctionEvents.resumeRecord(t);
    },
  },
  {
    id: "pick",
    matches: (t, e) => t.dataset.pick,
    run: (services, t, e, d) => {
      return services.catalogEvents.pickItem(d, t);
    },
  },
  {
    id: "btn-add-top",
    matches: (t, e) => t.id === "btn-add-top",
    run: (services, t, e, d) => {
      return services.catalogEvents.openPicker(d);
    },
  },
  {
    id: "del",
    matches: (t, e) => t.dataset.del,
    run: (services, t, e, d) => {
      return services.editorEvents.deleteItem(d, t);
    },
  },
  {
    id: "move",
    matches: (t, e) => t.dataset.move,
    run: (services, t, e, d) => {
      return services.editorEvents.moveItem(t);
    },
  },
  {
    id: "grpbtn",
    matches: (t, e) => t.dataset.grpbtn,
    run: (services, t, e, d) => {
      return services.editorEvents.toggleGroup(d, t);
    },
  },
  {
    id: "notecite",
    matches: (t, e) => t.dataset.notecite,
    run: (services, t, e, d) => {
      return services.citationEvents.toggleCitation(d, t);
    },
  },
  {
    id: "abate",
    matches: (t, e) => t.dataset.abate,
    run: (services, t, e, d) => {
      return services.editorEvents.toggleAbatement(d, t);
    },
  },
  {
    id: "btn-correct",
    matches: (t, e) => t.id === "btn-correct" || t.id === "btn-reissue",
    run: (services, t, e, d) => {
      return services.correctionEvents.startCorrection(d);
    },
  },
  {
    id: "btn-exportcorrection",
    matches: (t, e) => t.id === "btn-exportcorrection",
    run: (services, t, e, d) => {
      return services.correctionEvents.exportCorrection(d);
    },
  },
  {
    id: "btn-retrycorrection",
    matches: (t, e) => t.id === "btn-retrycorrection",
    run: (services, t, e, d) => {
      return services.correctionEvents.retryCorrection(d);
    },
  },
  {
    id: "btn-recordnote",
    matches: (t, e) =>
      t.id === "btn-recordnote" && editor.state.publicationBusy && doc(editor.state.publicationBusy)?.caseId === doc(editor.state.docId)?.caseId,
    run: (services, t, e, d) => {
      return services.correctionEvents.refuseBusyNote();
    },
  },
  {
    id: "btn-void",
    matches: (t, e) => t.id === "btn-void" || t.id === "btn-recordnote" || t.id === "btn-reconcile",
    run: (services, t, e, d) => {
      return services.correctionEvents.openRecordAction(t);
    },
  },
  {
    id: "record-action-go",
    matches: (t, e) => t.id === "record-action-go",
    run: (services, t, e, d) => {
      return services.correctionEvents.commitRecordAction(t, d);
    },
  },
  {
    id: "btn-original",
    matches: (t, e) => t.id === "btn-original",
    run: (services, t, e, d) => {
      return services.editorEvents.openOriginal(d);
    },
  },
  {
    id: "withdraw",
    matches: (t, e) => t.dataset.withdraw,
    run: (services, t, e, d) => {
      return services.correctionEvents.withdrawItem(d, t);
    },
  },
  {
    id: "btn-save",
    matches: (t, e) => t.id === "btn-save",
    run: (services, t, e, d) => {
      return services.recoveryEvents.saveDocument();
    },
  },
  {
    id: "btn-print",
    matches: (t, e) => t.id === "btn-print",
    run: (services, t, e, d) => {
      return services.editorEvents.printDocument(d);
    },
  },
  {
    id: "btn-final",
    matches: (t, e) => t.id === "btn-final" || t.id === "btn-reviewcorrection",
    run: (services, t, e, d) => {
      return services.editorEvents.reviewDocument(d);
    },
  },
  {
    id: "fin-go",
    matches: (t, e) => t.id === "fin-go",
    run: (services, t, e, d) => {
      return services.editorEvents.finalizeDocument(d, t);
    },
  },
  {
    id: "acc-pick",
    matches: (t, e) => t.id === "acc-pick",
    run: (services, t, e, d) => {
      return services.importEvents.pickWorkbook();
    },
  },
  {
    id: "acc-cancel",
    matches: (t, e) => t.id === "acc-cancel",
    run: (services, t, e, d) => {
      return services.importEvents.cancelImport();
    },
  },
  {
    id: "acc-go",
    matches: (t, e) => t.id === "acc-go",
    run: (services, t, e, d) => {
      return services.importEvents.acceptImport();
    },
  },
  {
    id: "acccase",
    matches: (t, e) => t.dataset.acccase !== undefined && editor.state.acc,
    run: (services, t, e, d) => {
      return services.importEvents.selectCase(t);
    },
  },
  {
    id: "accsel",
    matches: (t, e) => t.dataset.accsel !== undefined && editor.state.acc && !imports.LOOKUP_BUSY,
    run: (services, t, e, d) => {
      return services.importEvents.selectInspection(t);
    },
  },
];

export function createWorkspaceEvents(services) {
  function registerQueueViews(target = document) {
    return registerEventOnce(target, "workspace.registerQueueViews", "click", (e) => {
      const t = e.target.closest?.("[data-queue-view],[data-queue-reset]");
      if (!t) return;
      editor.state.metric = "";
      if (t.hasAttribute("data-queue-reset")) {
        editor.state.caseQ = "";
        editor.state.caseInspector = "";
      } else {
        // Switching views keeps the workspace search and inspector filter; only the reset clears them.
        editor.state.caseFilter = t.dataset.queueView;
      }
      services.render();
      services.saveWorkflowPrefs();
      document.querySelector(t.hasAttribute("data-queue-reset") ? "#case-search" : '[data-queue-view="' + t.dataset.queueView + '"]')?.focus();
    });
  }

  function registerCaseTasks(target = document) {
    return registerEventOnce(target, "workspace.registerCaseTasks", "click", (e) => {
      const t = e.target.closest?.("[data-case-task]");
      if (!t) return;
      const cid = t.dataset.caseTask,
        st = services.caseState(kase(cid));
      if (st.draft) {
        services.preflightCase(cid, "draft", () => {
          editor.state.docId = st.draft.id;
          editor.state.screen = "write";
          services.render();
        });
        return;
      }
      if (st.visit || (st.current && !st.closed)) {
        services.preflightCase(cid, "inspection", () => services.startReinspection(cid));
        return;
      }
      if (st.current)
        services.preflightCase(cid, "case", () => {
          editor.state.docId = st.current.id;
          editor.state.screen = "write";
          services.render();
        });
    });
  }

  function registerReportReturn(target = document) {
    return registerEventOnce(target, "workspace.registerReportReturn", "click", async (e) => {
      if (!e.target.closest?.("[data-report-return]")) return;
      await services.navigation.leave((sequence) => {
        const request = services.rnd12();
        WriterState.RETURN_ACK = "";
        if (startup.WRITER_CHANNEL) startup.WRITER_CHANNEL.postMessage({ kind: "return", request });
        setTimeout(() => {
          if (services.navigation.current(sequence) && WriterState.RETURN_ACK !== request) location.href = "madison-reports.html?return=1";
        }, 700);
      });
    });
  }

  function registerWorkspaceClicks(target = document) {
    return registerEventOnce(target, "workspace.registerWorkspaceClicks", "click", async (e) => {
      const t = e.target.closest(
        "[data-nav],[data-open],[data-new],[data-pick],[data-grp],[data-libcl],[d" +
          "ata-del],[data-abate],[data-grpbtn],[data-move],[data-adopt-catalog],[da" +
          "ta-close],[data-reinsp],[data-rifilter],[data-riwalk],[data-riwalk-undo]" +
          ",[data-riwalk-next],[data-riwalk-skip],[data-riwalk-return],[data-riwalk" +
          "-prev],[data-setoc],[data-makedoc],[data-case-sync],#btn-add-to" +
          "p,#btn-bulkdue,[data-openfile],[data-exportcase],#case-showall,#t-undo,#" +
          "btn-void,#btn-correct,#btn-retrycorrection,#btn-reviewcorrection,#btn-ex" +
          "portcorrection,#btn-recordnote,#btn-reconcile,#btn-original,#record-acti" +
          "on-go,[data-resumerecord],[data-withdraw],#btn-reissue,#btn-recordri,#bt" +
          "n-linkdir,#btn-grantdir,#btn-browse,#btn-flush,#btn-storage,#btn-syncpdf" +
          ",#btn-testwrite,#btn-reindex,#btn-savecase,#btn-clear,#btn-email,#btn-cc" +
          ",#btn-addcc,#btn-addem,#btn-sendgo,#btn-sendnone,#btn-risave,[data-notec" +
          "ite],[data-clearcases],[data-rmcase],[data-rmcc],[data-rmem],[data-disca" +
          "rdri],[data-discard],[data-openfolder],#btn-print,#btn-final" +
          ",#btn-save,#btn-openfile,#fin-go,#picker-bg,#acc-pick,#acc-go,#acc-cance" +
          "l,[data-acccase],[data-accsel]",
      );
      if (!t) return;
      services.captureWork();
      if (t.id === "case-showall") {
        editor.state.metric = "";
        editor.state.caseFilter = "all";
        editor.state.caseQ = "";
        editor.state.caseInspector = "";
        services.render();
        services.saveWorkflowPrefs();
        return;
      }
      if (t.dataset.nav) {
        await services.navigation.navigate(t.dataset.nav);
        return;
      }
      const action = workspaceActions.find((action) => action.matches(t, e));
      if (action) return action.run(services, t, e);
      const d = doc(editor.state.docId);
      const documentAction = documentActions.find((action) => action.matches(t, e));
      if (documentAction) return documentAction.run(services, t, e, d);
    });
  }

  const editSearch = (el) => {
    const cursor = el.selectionStart,
      key = el.id === "case-search" ? "caseQ" : "folderQ",
      id = el.id;
    editor.state[key] = el.value;
    if (id === "case-search") {
      editor.state.metric = "";
      services.render();
    } else services.refreshOverlay();
    const next = document.getElementById(id);
    if (next) {
      next.focus();
      if (next.setSelectionRange)
        try {
          next.setSelectionRange(cursor, cursor);
        } catch (err) {
          /* Some controls cannot restore a selection range; their values and focus remain intact. */
        }
    }
    return;
  };

  const changeCaseFilter = (e) => {
    editor.state.metric = "";
    // Returning More views to its placeholder restores the default Needs attention view.
    editor.state[e.target.id === "case-filter" ? "caseFilter" : "caseInspector"] =
      e.target.id === "case-filter" ? e.target.value || "attention" : e.target.value;
    services.render();
    if (e.target.id === "case-filter") document.querySelector("#case-filter")?.focus();
    return;
  };
  return { registerQueueViews, registerCaseTasks, registerReportReturn, registerWorkspaceClicks, editSearch, changeCaseFilter };
}
