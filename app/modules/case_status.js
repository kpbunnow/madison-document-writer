import { editorState as editor } from "./editor_state.js";
import { caseNumberAllowed } from "./case_records.js";
import { independentArtifact, pdfTransferState } from "./pdf_artifacts.js";
import { caseFileName } from "./case_file_rules.js";
import { sourceDocFor, draftDocFor, draftReinspFor, docsFor, effectiveFiled } from "./writer_queries.js";
import { isHistoryDoc, activeRestrictions } from "./document_rules.js";
import { validISO, addDays, daysBetween } from "./calendar.js";
import { STATUS_OF } from "./document_types.js";
import { WriterState } from "./state.js";
import { recordDay } from "../assets/shared.js";

export function createCaseStatus(services) {
  function caseState(k) {
    const current = sourceDocFor(k.id),
      draft = draftDocFor(k.id),
      visit = draftReinspFor(k.id) || services.unissuedVisitFor(k.id),
      last = docsFor(k.id).find((d) => !d.draft && !d.superseded);
    const live = docsFor(k.id).filter((d) => !d.draft && !d.void && !d.superseded);
    const withdrawn = !!current && current.items.length > 0 && current.items.every((i) => i.withdrawn);
    const restrictions = activeRestrictions(live),
      vacancy = live.find((d) => d.type === "vacancyExtension"),
      reviewDue = vacancy?.special?.reviewDate || "";
    const closed = services.snow.isCase(k)
      ? !!current && !!current.filedAt && current.frozen?.snowCloseOnFiling !== false
      : !restrictions.length && (withdrawn || (!!current && current.type === "compliance") || (!current && !!last && !!last.void));
    const dates =
      current && !isHistoryDoc(current)
        ? (current.items || [])
            .filter((i) => !i.done && !i.withdrawn && validISO(i.due))
            .map((i) => i.due)
            .sort()
        : [];
    const due = dates[0] || "",
      days = due ? daysBetween(recordDay(services.today), due) : null;
    const late = !closed && !!due && due < recordDay(services.today),
      soon = !closed && !!due && !late && days >= 0 && days <= 7;
    const pendingRecord = Object.values(editor.RECORD_ATTEMPTS).find((x) => x.cid === k.id) || null;
    const pendingDoc = docsFor(k.id).find((d) => d.pendingAmendment) || null;
    const pendingSync = WriterState.PENDING.some((p) => p.cid === k.id || (!!caseFileName(k) && p.name === caseFileName(k)));
    const filingDoc = live.find((d) => independentArtifact(d) && !effectiveFiled(d)) || null;
    const artifactIssue = live.find((d) => ["artifact conflict", "missing or unavailable"].includes(pdfTransferState(d))) || null;
    const numberIssue = !caseNumberAllowed(k);
    const attention = !!(
      restrictions.length ||
      (reviewDue && reviewDue <= addDays(recordDay(services.today), 7)) ||
      numberIssue ||
      draft ||
      visit ||
      late ||
      soon ||
      pendingRecord ||
      pendingDoc ||
      pendingSync ||
      filingDoc ||
      artifactIssue
    );
    return {
      restrictions,
      reviewDue,
      current: current || last,
      draft,
      visit,
      closed,
      due,
      days,
      late,
      soon,
      pendingRecord,
      pendingDoc,
      pendingSync,
      filingDoc,
      artifactIssue,
      attention,
      label:
        services.snow.isCase(k) && current
          ? "Cited – snow"
          : restrictions.length
            ? "Occupancy restricted"
            : numberIssue
              ? "Case number needs correction"
              : draft
                ? draft.correction
                  ? "Correction draft"
                  : "Document draft"
                : visit
                  ? visit.draft
                    ? "Reinspection draft"
                    : "Visit needs document"
                  : withdrawn || (!current && last && last.void)
                    ? "Withdrawn"
                    : closed
                      ? "Closed"
                      : current
                        ? STATUS_OF[current.type] || "Issued"
                        : last?.special?.mode === "release"
                          ? "Restriction released"
                          : last
                            ? STATUS_OF[last.type] || "Issued"
                            : "Ready to start",
    };
  }
  return { caseState };
}
