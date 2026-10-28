import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { caseNumberAllowed } from "./case_records.js";
import { independentArtifact, pdfTransferState } from "./pdf_artifacts.js";
import { caseFileName } from "./case_file_rules.js";
import { sourceDocFor, draftDocFor, draftReinspFor, docsFor, effectiveFiled } from "./writer_queries.js";
import { isHistoryDoc, activeRestrictions } from "./document_rules.js";
import { validISO, addDays, daysBetween } from "./calendar.js";
import { STATUS_OF } from "./document_types.js";
import { recordDay } from "../assets/shared.js";

function caseIsClosed(services, k, { current, last, restrictions, withdrawn }) {
  return services.snow.isCase(k)
    ? !!current && !!current.filedAt && current.frozen?.snowCloseOnFiling !== false
    : !restrictions.length && (withdrawn || (!!current && current.type === "compliance") || (!current && !!last && !!last.void));
}

function caseDeadlineFacts(services, current, closed) {
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
  return { due, days, late, soon };
}

function caseNeedsAttention(
  services,
  { restrictions, reviewDue, numberIssue, draft, visit, late, soon, pendingRecord, pendingDoc, pendingSync, filingDoc, artifactIssue },
) {
  return !!(
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
}

function issuedCaseLabel(current, last) {
  if (current) return STATUS_OF[current.type] || "Issued";
  if (last?.special?.mode === "release") return "Restriction released";
  return last ? STATUS_OF[last.type] || "Issued" : "Ready to start";
}

function caseStatusLabel(services, k, { current, last, restrictions, numberIssue, draft, visit, withdrawn, closed }) {
  if (services.snow.isCase(k) && current) return "Cited – snow";
  if (restrictions.length) return "Occupancy restricted";
  if (numberIssue) return "Case number needs correction";
  if (draft) return draft.correction ? "Correction draft" : "Document draft";
  if (visit) return visit.draft ? "Reinspection draft" : "Visit needs document";
  if (withdrawn || (!current && last && last.void)) return "Withdrawn";
  if (closed) return "Closed";
  return issuedCaseLabel(current, last);
}

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
    const closed = caseIsClosed(services, k, { current, last, restrictions, withdrawn });
    const { due, days, late, soon } = caseDeadlineFacts(services, current, closed);
    const pendingRecord = Object.values(editor.RECORD_ATTEMPTS).find((x) => x.cid === k.id) || null;
    const pendingDoc = docsFor(k.id).find((d) => d.pendingAmendment) || null;
    const pendingSync = workspace.PENDING.some((p) => p.cid === k.id || (!!caseFileName(k) && p.name === caseFileName(k)));
    const filingDoc = live.find((d) => independentArtifact(d) && !effectiveFiled(d)) || null;
    const artifactIssue = live.find((d) => ["artifact conflict", "missing or unavailable"].includes(pdfTransferState(d))) || null;
    const numberIssue = !caseNumberAllowed(k);
    const attention = caseNeedsAttention(services, {
      restrictions,
      reviewDue,
      numberIssue,
      draft,
      visit,
      late,
      soon,
      pendingRecord,
      pendingDoc,
      pendingSync,
      filingDoc,
      artifactIssue,
    });
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
      label: caseStatusLabel(services, k, { current, last, restrictions, numberIssue, draft, visit, withdrawn, closed }),
    };
  }
  return { caseState };
}
