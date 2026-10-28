import { editorState as editor } from "./editor_state.js";
/* Workspace task presentation consumes existing record and artifact facts; no action or persistence authority. */
import { DOC_TYPES } from "./document_types.js";
import { docsFor, effectiveFiled, kase } from "./writer_queries.js";
import { independentArtifact, pdfTransferState } from "./pdf_artifacts.js";
import { esc as dep_esc } from "./presentation_format.js";
import { WriterState } from "./state.js";

/* Construction reads no services or workspace state and registers no listeners. */
export function createWorkspaceTasks(services) {
  function workspaceTasks(rows) {
    const task = (key, label, unit, items) => ({ key, label, unit, items, count: items.length });
    const caseTask = (x, text, action) => ({ cid: x.k.id, label: x.k.number + " · " + x.k.address + " · " + text, action });
    const open = rows.filter((x) => !x.st.closed),
      drafts = rows.filter((x) => x.st.draft || x.st.visit);
    const needsDeposit = rows.flatMap((x) =>
      docsFor(x.k.id)
        .filter((d) => d.draft && !services.depositComplete(d))
        .map((d) => caseTask(x, "Citation needs deposit", `data-open="${dep_esc(d.id)}"`)),
    );
    const pendingDocs = rows.flatMap((x) =>
      docsFor(x.k.id)
        .filter((d) => d.pendingAmendment)
        .map((d) => caseTask(x, "Document save confirmation", `data-open="${dep_esc(d.id)}"`)),
    );
    const pendingRecords = rows.flatMap((x) =>
      Object.entries(editor.RECORD_ATTEMPTS)
        .filter(([, a]) => a.cid === x.k.id)
        .map(([id]) => caseTask(x, "Record save confirmation", `data-resumerecord="${dep_esc(id)}"`)),
    );
    const unfiled = rows.flatMap((x) =>
      docsFor(x.k.id)
        .filter((d) => independentArtifact(d) && !effectiveFiled(d))
        .map((d) => caseTask(x, "File " + ((DOC_TYPES.find((t) => t.id === d.type) || {}).label || d.type) + " PDF", `data-open="${dep_esc(d.id)}"`)),
    );
    const local = rows.flatMap((x) =>
      docsFor(x.k.id)
        .filter(
          (d) =>
            independentArtifact(d) &&
            (pdfTransferState(d) === "local outbox" ||
              (pdfTransferState(d) === "last verified location; refresh unavailable" && WriterState.ARTIFACT_LOCATIONS[d.id]?.includes("local"))),
        )
        .map((d) =>
          caseTask(
            x,
            "Transfer " +
              ((DOC_TYPES.find((t) => t.id === d.type) || {}).label || d.type) +
              " PDF" +
              (WriterState.ARTIFACT_VERIFY[d.id] === "unavailable" ? " (last verified; refresh unavailable)" : ""),
            `data-outbox`,
          ),
        ),
    );
    const issues = rows.flatMap((x) =>
      docsFor(x.k.id)
        .filter(
          (d) =>
            independentArtifact(d) &&
            [
              "artifact conflict",
              "missing or unavailable",
              "location unverified",
              "historical / location unverified",
              "invalid artifact identity",
              "location verification unavailable",
              "last verified location; refresh unavailable",
            ].includes(pdfTransferState(d)),
        )
        .map((d) =>
          caseTask(
            x,
            "Check " + ((DOC_TYPES.find((t) => t.id === d.type) || {}).label || d.type) + " PDF · " + pdfTransferState(d),
            `data-open="${dep_esc(d.id)}"`,
          ),
        ),
    );
    return [
      task("deposit", "Citation needs deposit", "documents", needsDeposit),
      task(
        "open",
        "Open cases",
        "cases",
        open.map((x) =>
          caseTask(x, x.st.due ? "Next due " + services.fmtDate(x.st.due) : "No applicable deadline", `data-case-task="${dep_esc(x.k.id)}"`),
        ),
      ),
      task(
        "drafts",
        "Unfinished cases",
        "cases",
        drafts.map((x) => caseTask(x, x.st.label, x.st.draft ? `data-open="${dep_esc(x.st.draft.id)}"` : `data-reinsp="${dep_esc(x.k.id)}"`)),
      ),
      task(
        "overdue",
        "Past due",
        "cases",
        rows.filter((x) => x.st.late).map((x) => caseTask(x, "Due " + services.fmtDate(x.st.due), `data-reinsp="${dep_esc(x.k.id)}"`)),
      ),
      task(
        "soon",
        "Due within 7 days",
        "cases",
        rows.filter((x) => x.st.soon).map((x) => caseTask(x, "Due " + services.fmtDate(x.st.due), `data-reinsp="${dep_esc(x.k.id)}"`)),
      ),
      task(
        "imports",
        "Imports to review",
        "imports",
        services.hasSetupWork() ? [{ cid: "", label: "Saved import or case lookup", action: 'data-nav="import"' }] : [],
      ),
      task("confirm", "Save confirmations", "operations", pendingRecords.concat(pendingDocs)),
      task(
        "pending",
        "Case files to sync",
        "operations",
        WriterState.PENDING.map((p) => ({
          cid: p.cid,
          label: (kase(p.cid).number || p.name) + " · held case file from " + p.at,
          action: `data-case-sync="${dep_esc(p.cid)}"`,
        })),
      ),
      task("filing", "PDFs to file", "documents", unfiled),
      task("outbox", "PDFs in local outbox", "documents", local),
      task("artifacts", "PDF artifacts to check", "documents", issues),
    ];
  }

  return { workspaceTasks };
}
