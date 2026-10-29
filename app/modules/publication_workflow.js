import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { clone } from "./record_values.js";
import { DOC_TYPES } from "./document_types.js";
import { doc, kase } from "./writer_queries.js";
import { deliveredByCitation } from "./document_rules.js";
import { esc } from "./presentation_format.js";

/* Issuance phases. Each takes the owner's `services` and runs in the order the single flow used to. */
async function retainDraft(services, message, clearModal) {
  editor.state.amendmentError = message;
  await services.saveDrafts();
  if (clearModal) editor.state.modal = null;
  services.render();
  return false;
}

// Integrity, draft and busy guards; true when the issuance must not continue.
function refusedOutright(services, d) {
  if (d && services.recordIntegrity.blocked(d.caseId)) {
    services.toast("This record was changed outside the program. Open read-only and refer it for review.");
    return true;
  }
  return !d || !d.draft || !!d.correction || !!editor.AMENDMENT_BUSY;
}

async function refusedBeforeCitations(services, d) {
  if (!workspace.CASEDIR || !workspace.CASEDIR.helper) {
    await retainDraft(services, "Connect the current local helper and shared case folder. The document remains a draft.", true);
    return true;
  }
  if (!d.pendingAmendment && d.type === "notice" && !(await services.refreshCatalog())) {
    await retainDraft(services, "Current catalog review status could not be checked. Draft retained; reconnect before issuing.", true);
    return true;
  }
  return false;
}

async function refusedByCitationHistory(services, d) {
  if (d.pendingAmendment || !(d.type === "citation" || services.initialCitations.enabled(d))) return false;
  services.initialCitations.prepare(d);
  services.citationPricing.refresh(d);
  const before = services.citationPricing.signature(d);
  if (!(await services.citationPricing.loadShared(d, true))) {
    await retainDraft(services, "Shared citation history could not be checked. Reconnect before issuing.", false);
    return true;
  }
  if (before !== services.citationPricing.signature(d)) {
    await retainDraft(services, "Citation history changed the deposit or tier. Review the updated charges before issuing.", true);
    return true;
  }
  return false;
}

function refusedByBlockers(services, d) {
  if (d.pendingAmendment || !services.blockers(d).length) return false;
  services.toast("Resolve the document and inspection checks before issuing.");
  services.render(); // the final confirmation lists the new blockers and keeps its Issue button disabled
  return true;
}

// Every initial document is rendered before anything is sent; a failure keeps the draft untouched.
function prepareInitialJobs(services, d, attempt) {
  const jobs = new Map();
  for (const event of (d.publicationEvents || []).concat(attempt)) {
    const snapshot = event.payload?.snapshot;
    if (!snapshot || deliveredByCitation(snapshot)) continue;
    const job = services.printJob(snapshot);
    if (!job || !String(job.html || "").trim()) throw new Error("An initial document could not be rendered.");
    jobs.set(snapshot.id, job);
  }
  const expected = (d.publicationEvents || []).concat(attempt).filter((e) => e.payload?.snapshot && !deliveredByCitation(e.payload.snapshot)).length;
  if (jobs.size !== expected || !expected) throw new Error("The initial documents must be prepared.");
  return jobs;
}

function issuedDocuments(id, attempt, wanted) {
  const issued = [doc(id)].filter((x) => !deliveredByCitation(x));
  if (wanted) {
    const citation = doc(attempt.payload.snapshot.id);
    if (citation && citation.type === "citation") {
      issued.push(citation);
      editor.state.docId = citation.id;
    }
  }
  return issued;
}

// Both official snapshots are committed before either PDF is filed. Each filing
// is independent and recoverable; a lost save response retries the same pair.
async function fileIssued(services, issuedDocs, preparedJobs, sendEmail) {
  let filed = true;
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
  return filed;
}

// R59: once the shared save is confirmed and filing and email were attempted, return to Workspace with the
// issued case highlighted. A legacy notice still waiting for its separate initial citation stays open, and
// an inspector who has already moved on (another screen, document or dialog) is not pulled back.
function revealIssued(services, run) {
  const { cid, id, issuedDocs } = run;
  const stillHere = editor.state.screen === "write" && !editor.state.modal && [id, ...issuedDocs.map((x) => x.id)].includes(editor.state.docId);
  if (!stillHere || services.needsInitialCitation(doc(id))) return;
  run.returned = services.revealIssuedCase(cid);
  if (run.returned && run.filed) {
    const labels = [...new Set(issuedDocs.map((x) => (DOC_TYPES.find((t) => t.id === x.type) || {}).label || "Document"))];
    services.toast((labels.join(" and ") || "Document") + " issued for " + (kase(cid)?.number || "this case") + ".", { severity: "success" });
  }
}

async function commitIssuance(services, d, attempt) {
  editor.state.publicationBusy = d.id;
  if (await services.commitAmendment(d.caseId, attempt, d)) return true;
  editor.state.publicationBusy = null;
  editor.state.modal = null;
  services.render();
  return false;
}

async function continueIssuance(services, d, attempt, run) {
  const { id } = run;
  delete editor.WORK.recordForms[id + ":final"];
  editor.state.amendmentError = "";
  editor.state.docId = id;
  editor.state.screen = "write";
  services.render();
  run.issuedDocs = issuedDocuments(id, attempt, run.wanted);
  try {
    run.filed = await fileIssued(services, run.issuedDocs, run.preparedJobs, run.sendEmail);
    await services.saveDrafts();
    revealIssued(services, run);
    return true;
  } finally {
    editor.state.publicationBusy = null;
    services.render();
    if (run.returned) services.focusIssuedCase(run.cid);
  }
}

async function publishOnce(services, d) {
  if (refusedOutright(services, d)) return false;
  if (!d.pendingAmendment) services.commitCitationEdits(d);
  if (await refusedBeforeCitations(services, d)) return false;
  if (await refusedByCitationHistory(services, d)) return false;
  if (refusedByBlockers(services, d)) return false;
  const run = {
    cid: d.caseId,
    id: d.id,
    wanted: services.initialCitations.enabled(d),
    sendEmail: !!d.emailedTo && d.emailedTo.length > 0,
    preparedJobs: new Map(),
    issuedDocs: [],
    filed: true,
    returned: false,
  };
  const attempt = d.pendingAmendment || services.makePublication(d);
  editor.state.modal = null;
  if (run.wanted && !d.pendingAmendment) {
    try {
      run.preparedJobs = prepareInitialJobs(services, d, attempt);
    } catch (e) {
      await retainDraft(services, "The initial citation could not be prepared. Draft retained; no issuance was sent. " + e.message, false);
      return false;
    }
  }
  if (!(await commitIssuance(services, d, attempt))) return false;
  return continueIssuance(services, d, attempt, run);
}

// Continuation delegates preparation, confirmation and original PDF filing to their owners.
export function createPublicationWorkflow(services) {
  // R59: one issuance per draft at a time. A second click or a Confirm save during an issuance is ignored, so a
  // double submission can never prepare a second publication event.
  const PUBLISHING = new Set();

  async function publishDocument(d) {
    if (!d || PUBLISHING.has(d.id)) return false;
    PUBLISHING.add(d.id);
    try {
      return await publishOnce(services, d);
    } finally {
      PUBLISHING.delete(d.id);
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
