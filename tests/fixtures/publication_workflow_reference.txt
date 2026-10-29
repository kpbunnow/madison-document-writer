import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { clone } from "./record_values.js";
import { DOC_TYPES } from "./document_types.js";
import { doc, kase } from "./writer_queries.js";
import { deliveredByCitation } from "./document_rules.js";
import { esc } from "./presentation_format.js";

// Continuation delegates preparation, confirmation and original PDF filing to their owners.
export function createPublicationWorkflow(services) {
  // R59: one issuance per draft at a time. A second click or a Confirm save during an issuance is ignored, so a
  // double submission can never prepare a second publication event.
  const PUBLISHING = new Set();

  async function publishDocument(d) {
    if (!d || PUBLISHING.has(d.id)) return false;
    PUBLISHING.add(d.id);
    try {
      return await publishOnce(d);
    } finally {
      PUBLISHING.delete(d.id);
    }
  }

  async function publishOnce(d) {
    if (d && services.recordIntegrity.blocked(d.caseId)) {
      services.toast("This record was changed outside the program. Open read-only and refer it for review.");
      return false;
    }
    if (!d || !d.draft || d.correction || editor.AMENDMENT_BUSY) return false;
    if (!d.pendingAmendment) services.commitCitationEdits(d);
    if (!workspace.CASEDIR || !workspace.CASEDIR.helper) {
      editor.state.amendmentError = "Connect the current local helper and shared case folder. The document remains a draft.";
      await services.saveDrafts();
      editor.state.modal = null;
      services.render();
      return false;
    }
    if (!d.pendingAmendment && d.type === "notice" && !(await services.refreshCatalog())) {
      editor.state.amendmentError = "Current catalog review status could not be checked. Draft retained; reconnect before issuing.";
      await services.saveDrafts();
      editor.state.modal = null;
      services.render();
      return false;
    }
    if (!d.pendingAmendment && (d.type === "citation" || services.initialCitations.enabled(d))) {
      services.initialCitations.prepare(d);
      services.citationPricing.refresh(d);
      const before = services.citationPricing.signature(d);
      if (!(await services.citationPricing.loadShared(d, true))) {
        editor.state.amendmentError = "Shared citation history could not be checked. Reconnect before issuing.";
        await services.saveDrafts();
        services.render();
        return false;
      }
      if (before !== services.citationPricing.signature(d)) {
        editor.state.amendmentError = "Citation history changed the deposit or tier. Review the updated charges before issuing.";
        await services.saveDrafts();
        editor.state.modal = null;
        services.render();
        return false;
      }
    }
    if (!d.pendingAmendment && services.blockers(d).length) {
      services.toast("Resolve the document and inspection checks before issuing.");
      services.render(); // the final confirmation lists the new blockers and keeps its Issue button disabled
      return false;
    }
    const cid = d.caseId,
      id = d.id,
      wanted = services.initialCitations.enabled(d),
      sendEmail = !!d.emailedTo && d.emailedTo.length > 0;
    const attempt = d.pendingAmendment || services.makePublication(d);
    editor.state.modal = null;
    const preparedJobs = new Map();
    if (wanted && !d.pendingAmendment) {
      try {
        for (const event of (d.publicationEvents || []).concat(attempt)) {
          const snapshot = event.payload?.snapshot;
          if (!snapshot || deliveredByCitation(snapshot)) continue;
          const job = services.printJob(snapshot);
          if (!job || !String(job.html || "").trim()) throw new Error("An initial document could not be rendered.");
          preparedJobs.set(snapshot.id, job);
        }
        const expected = (d.publicationEvents || [])
          .concat(attempt)
          .filter((e) => e.payload?.snapshot && !deliveredByCitation(e.payload.snapshot)).length;
        if (preparedJobs.size !== expected || !expected) throw new Error("The initial documents must be prepared.");
      } catch (e) {
        editor.state.amendmentError = "The initial citation could not be prepared. Draft retained; no issuance was sent. " + e.message;
        await services.saveDrafts();
        services.render();
        return false;
      }
    }
    editor.state.publicationBusy = id;
    if (!(await services.commitAmendment(cid, attempt, d))) {
      editor.state.publicationBusy = null;
      editor.state.modal = null;
      services.render();
      return false;
    }
    delete editor.WORK.recordForms[id + ":final"];
    editor.state.amendmentError = "";
    editor.state.docId = id;
    editor.state.screen = "write";
    services.render();
    const issuedDocs = [doc(id)].filter((x) => !deliveredByCitation(x));
    if (wanted) {
      const citation = doc(attempt.payload.snapshot.id);
      if (citation && citation.type === "citation") {
        issuedDocs.push(citation);
        editor.state.docId = citation.id;
      }
    }
    // Both official snapshots are committed before either PDF is filed. Each filing
    // is independent and recoverable; a lost save response retries the same pair.
    let filed = true,
      returnedToWorkspace = false;
    try {
      for (const issued of issuedDocs) {
        try {
          const job = preparedJobs.get(issued.id) || services.printJob(issued);
          if (!(await services.filePdf(issued, job))) {
            filed = false;
            services.toast("Document issued. Use File issued PDF to produce its copy.");
          } else if (sendEmail) await services.emailDocument(issued, clone(issued.emailedTo), true, job);
        } catch (e) {
          filed = false;
          services.toast("Document issued; its PDF needs a retry. Use File issued PDF.");
        }
      }
      await services.saveDrafts();
      // R59: once the shared save is confirmed and filing and email were attempted, return to Workspace with the
      // issued case highlighted. A legacy notice still waiting for its separate initial citation stays open, and
      // an inspector who has already moved on (another screen, document or dialog) is not pulled back.
      const stillHere = editor.state.screen === "write" && !editor.state.modal && [id, ...issuedDocs.map((x) => x.id)].includes(editor.state.docId);
      if (stillHere && !services.needsInitialCitation(doc(id))) {
        returnedToWorkspace = services.revealIssuedCase(cid);
        if (returnedToWorkspace && filed) {
          const labels = [...new Set(issuedDocs.map((x) => (DOC_TYPES.find((t) => t.id === x.type) || {}).label || "Document"))];
          services.toast((labels.join(" and ") || "Document") + " issued for " + (kase(cid)?.number || "this case") + ".", { severity: "success" });
        }
      }
      return true;
    } finally {
      editor.state.publicationBusy = null;
      services.render();
      if (returnedToWorkspace) services.focusIssuedCase(cid);
    }
  }

  function publicationPanel(d) {
    if (!d || !d.draft || d.correction) return "";
    const waiting = !!d.pendingAmendment;
    return (
      "" +
      "".concat(
        waiting
          ? '<div class="banner warn"><div><strong>Save confirmation needed.</strong>' +
              " Keep this draft. Retry the exact save before editing, printing or start" +
              'ing another action. <button class="btn" id="btn-retrypublish">Confirm sa' +
              "ve</button></div></div>"
          : "",
      ) +
      "" +
      "".concat(editor.state.amendmentError ? '<div class="banner alert" role="alert">' + esc(editor.state.amendmentError) + "</div>" : "") +
      ""
    );
  }
  return { publishDocument, publicationPanel };
}
