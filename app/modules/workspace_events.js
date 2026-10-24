/* Workspace event ownership. Construction is inert; core registers at the original startup positions. */
import { registerEventOnce } from "./event_registration.js";
import { WriterState } from "./state.js";
import { kase, doc } from "./writer_queries.js";
export function createWorkspaceEvents(services) {
  function registerQueueViews(target = document) {
    return registerEventOnce(target, "workspace.registerQueueViews", "click", (e) => {
      const t = e.target.closest?.("[data-queue-view],[data-queue-reset]");
      if (!t) return;
      WriterState.state.metric = "";
      if (t.hasAttribute("data-queue-reset")) {
        WriterState.state.caseQ = "";
        WriterState.state.caseInspector = "";
      } else {
        // Switching views keeps the workspace search and inspector filter; only the reset clears them.
        WriterState.state.caseFilter = t.dataset.queueView;
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
          WriterState.state.docId = st.draft.id;
          WriterState.state.screen = "write";
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
          WriterState.state.docId = st.current.id;
          WriterState.state.screen = "write";
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
        if (WriterState.WRITER_CHANNEL) WriterState.WRITER_CHANNEL.postMessage({ kind: "return", request });
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
        WriterState.state.metric = "";
        WriterState.state.caseFilter = "all";
        WriterState.state.caseQ = "";
        WriterState.state.caseInspector = "";
        services.render();
        services.saveWorkflowPrefs();
        return;
      }
      if (t.dataset.nav) {
        await services.navigation.navigate(t.dataset.nav);
        return;
      }

      if (t.id === "t-undo") {
        const f = WriterState.undoFn;
        WriterState.undoFn = null;
        document.getElementById("toast").innerHTML = "";
        if (f) f();
        return;
      }
      if (t.dataset.exportcase) {
        if (!services.caseNumberAllowed(kase(t.dataset.exportcase))) {
          services.toast("Case number needs correction before export");
          return;
        }
        services.downloadFile(services.caseFileName(kase(t.dataset.exportcase)), JSON.stringify(services.caseFile(t.dataset.exportcase), null, 2));
        services.toast("Case record downloaded. Unfinished drafts stay on this device.");
        return;
      }
      if (t.id === "btn-openfile" || t.hasAttribute("data-openfile")) {
        if (services.storageMode() === "folder") {
          services.listCaseFolder().then((fs) => {
            WriterState.state.folder = fs;
            WriterState.state.modal = "folder";
            services.render();
          });
          return;
        }
        services.pickCaseFile();
        return;
      }
      if (t.id === "btn-linkdir") {
        services.linkCaseFolder();
        return;
      }
      if (t.id === "btn-grantdir") {
        services.grantCaseFolder();
        return;
      }
      if (t.id === "btn-browse") {
        services.listCaseFolder().then((fs) => {
          WriterState.state.folder = fs;
          WriterState.state.modal = "folder";
          services.render();
        });
        return;
      }
      if (t.dataset.openfolder) {
        WriterState.state.modal = null;
        services.openFromFolder(t.dataset.openfolder);
        return;
      }
      if (t.dataset.discardri) {
        return services.reinspectionEvents.discardVisit(t);
      }
      if (t.dataset.discard) {
        return services.recoveryEvents.discardDocument(t);
      }
      if (t.id === "btn-flush") {
        if (WriterState.CASEDIR && WriterState.NEEDGRANT) {
          services
            .grantCaseFolder(true)
            .then(() => services.flushPending())
            .then(() => services.render());
          return;
        }
        services.flushPending().then(() => services.render());
        return;
      }
      if (t.dataset.caseSync) {
        if (!WriterState.CASEDIR) {
          WriterState.state.modal = "storage";
          services.render();
          return;
        }
        if (WriterState.NEEDGRANT) {
          services.grantCaseFolder(true).then((ok) => (ok ? services.flushPending() : services.render()));
          return;
        }
        services.flushPending().then(() => services.render());
        return;
      }
      if (t.id === "btn-storage") {
        document.getElementById("utility-dialog")?.close();
        WriterState.state.modal = "storage";
        services.render();
        return;
      }
      if (t.id === "btn-clear") {
        WriterState.state.modal = "clear";
        services.render();
        return;
      }
      if (t.id === "btn-cc") {
        return services.contactEvents.openRecipients();
      }
      if (t.id === "btn-addcc") {
        return services.contactEvents.addCopy();
      }
      if (t.id === "btn-addem") {
        return services.contactEvents.addRecipient();
      }
      if (t.dataset.rmcc !== undefined && t.hasAttribute("data-rmcc")) {
        return services.contactEvents.removeCopy(t);
      }
      if (t.dataset.rmem !== undefined && t.hasAttribute("data-rmem")) {
        return services.contactEvents.removeRecipient(t);
      }
      if (t.dataset.clearcases) {
        services.clearCases(t.dataset.clearcases);
        return;
      }
      if (t.dataset.rmcase) {
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
        WriterState.state.screen = "cases";
        services.render();
        services.toast(k.number + " removed from this workspace. The shared case record is not deleted.");
        return;
      }
      if (t.id === "btn-email") {
        return services.contactEvents.emailDocument();
      }
      if (t.id === "btn-sendgo" || t.id === "btn-sendnone") {
        return services.contactEvents.sendDocument(t);
      }
      if (t.id === "btn-savecase") {
        const dd = doc(WriterState.state.docId);
        if (!dd) return;
        if (WriterState.CASEDIR && WriterState.NEEDGRANT) {
          services.grantCaseFolder(true).then(() => services.saveCaseFile(dd.caseId));
          return;
        }
        services.saveCaseFile(dd.caseId);
        return;
      }
      if (t.id === "btn-testwrite") {
        services.testWrite();
        return;
      }
      if (t.id === "btn-reindex") {
        services.rebuildIndex();
        return;
      }
      if (t.id === "btn-syncpdf") {
        return services.workflowEvents.syncPdf(t);
      }
      if (t.id === "btn-risave") {
        return services.recoveryEvents.saveVisit();
      }
      if (t.id === "btn-recordri") {
        return services.reinspectionEvents.recordVisit();
      }

      /* reinspection worksheet */
      if (t.dataset.reinsp) {
        return services.reinspectionEvents.startVisit(t);
      }
      if (t.dataset.riwalk !== undefined) {
        return services.reinspectionEvents.toggleWalk(t);
      }
      if (t.hasAttribute("data-riwalk-next")) {
        return services.reinspectionEvents.nextItem();
      }
      if (t.hasAttribute("data-riwalk-skip")) {
        return services.reinspectionEvents.skipDetails();
      }
      if (t.hasAttribute("data-riwalk-return")) {
        return services.reinspectionEvents.returnDetails();
      }
      if (t.hasAttribute("data-riwalk-prev")) {
        return services.reinspectionEvents.previousItem();
      }
      if (t.hasAttribute("data-riwalk-undo")) {
        return services.reinspectionEvents.undoOutcome();
      }
      if (t.dataset.rifilter !== undefined && t.hasAttribute("data-rifilter")) {
        return services.reinspectionEvents.filterItems(t);
      }
      if (t.dataset.setoc !== undefined && t.dataset.item) {
        return services.reinspectionEvents.recordOutcome(t);
      }
      if (t.dataset.makedoc) {
        return services.reinspectionEvents.makeDocument(t);
      }
      if (t.id === "picker-bg" && e.target.id === "picker-bg") {
        return services.catalogEvents.closePickerBackground();
      }
      if (t.dataset.close === "picker") {
        return services.catalogEvents.closePicker();
      }
      if (t.dataset.close === "modal") {
        return services.contactEvents.closeModal();
      }
      if (t.dataset.libcl) {
        return services.catalogEvents.selectChecklist(t);
      }
      if (t.dataset.open) {
        return services.editorEvents.openDocument(t);
      }
      if (t.dataset.new) {
        return services.editorEvents.newNotice(t);
      }
      if (t.dataset.grp) {
        return services.catalogEvents.selectGroup(t);
      }

      const d = doc(WriterState.state.docId);
      if (t.dataset.adoptCatalog) {
        return services.catalogEvents.adoptReview(d, t);
      }
      if (t.dataset.resumerecord) {
        return services.correctionEvents.resumeRecord(t);
      }

      if (t.dataset.pick) {
        return services.catalogEvents.pickItem(d, t);
      }
      if (t.id === "btn-add-top") {
        return services.catalogEvents.openPicker(d);
      }
      if (t.dataset.del) {
        return services.editorEvents.deleteItem(d, t);
      }
      if (t.dataset.move) {
        return services.editorEvents.moveItem(t);
      }
      if (t.dataset.grpbtn) {
        return services.editorEvents.toggleGroup(d, t);
      }
      if (t.dataset.notecite) {
        return services.citationEvents.toggleCitation(d, t);
      }
      if (t.dataset.abate) {
        return services.editorEvents.toggleAbatement(d, t);
      }
      if (t.id === "btn-correct" || t.id === "btn-reissue") {
        return services.correctionEvents.startCorrection(d);
      }
      if (t.id === "btn-exportcorrection") {
        return services.correctionEvents.exportCorrection(d);
      }
      if (t.id === "btn-retrycorrection") {
        return services.correctionEvents.retryCorrection(d);
      }
      if (
        t.id === "btn-recordnote" &&
        WriterState.state.publicationBusy &&
        doc(WriterState.state.publicationBusy)?.caseId === doc(WriterState.state.docId)?.caseId
      ) {
        return services.correctionEvents.refuseBusyNote();
      }
      if (t.id === "btn-void" || t.id === "btn-recordnote" || t.id === "btn-reconcile") {
        return services.correctionEvents.openRecordAction(t);
      }
      if (t.id === "record-action-go") {
        return services.correctionEvents.commitRecordAction(t, d);
      }
      if (t.id === "btn-original") {
        return services.editorEvents.openOriginal(d);
      }
      if (t.dataset.withdraw) {
        return services.correctionEvents.withdrawItem(d, t);
      }
      if (t.id === "btn-save") {
        return services.recoveryEvents.saveDocument();
      }
      if (t.id === "btn-print") {
        return services.editorEvents.printDocument(d);
      }
      if (t.id === "btn-final" || t.id === "btn-reviewcorrection") {
        return services.editorEvents.reviewDocument(d);
      }
      if (t.id === "fin-go") {
        return services.editorEvents.finalizeDocument(d, t);
      }

      if (t.id === "acc-pick") {
        return services.importEvents.pickWorkbook();
      }
      if (t.id === "acc-cancel") {
        return services.importEvents.cancelImport();
      }
      if (t.id === "acc-go") {
        return services.importEvents.acceptImport();
      }
      if (t.dataset.acccase !== undefined && WriterState.state.acc) {
        return services.importEvents.selectCase(t);
      }
      if (t.dataset.accsel !== undefined && WriterState.state.acc && !WriterState.LOOKUP_BUSY) {
        return services.importEvents.selectInspection(t);
      }
    });
  }

  const editSearch = (el) => {
    const cursor = el.selectionStart,
      key = el.id === "case-search" ? "caseQ" : "folderQ",
      id = el.id;
    WriterState.state[key] = el.value;
    if (id === "case-search") {
      WriterState.state.metric = "";
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
    WriterState.state.metric = "";
    // Returning More views to its placeholder restores the default Needs attention view.
    WriterState.state[e.target.id === "case-filter" ? "caseFilter" : "caseInspector"] =
      e.target.id === "case-filter" ? e.target.value || "attention" : e.target.value;
    services.render();
    if (e.target.id === "case-filter") document.querySelector("#case-filter")?.focus();
    return;
  };
  return { registerQueueViews, registerCaseTasks, registerReportReturn, registerWorkspaceClicks, editSearch, changeCaseFilter };
}
