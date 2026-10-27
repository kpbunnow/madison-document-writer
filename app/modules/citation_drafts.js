import { canonicalOrdinance } from "./citation_policy.js";
import { recordDay } from "../assets/shared.js";
import { inspAt } from "./inspection_facts.js";
import { isEffective } from "./document_rules.js";
import { courtTime } from "./document_types.js";
import { doc, docInsp, docsFor, draftDocFor, draftReinspFor, recordHead } from "./writer_queries.js";
import { workspaceState } from "./workspace_state.js";

export function createCitationDrafts(services) {
  function citationTier(caseId, no) {
    const n = services.priorCitations(caseId, no);
    return n === 0 ? "1st" : n === 1 ? "2nd" : "3rd+";
  }

  function citationFromNotice(noticeId) {
    const src = doc(noticeId);
    if (!src) return null;
    const existing = docsFor(src.caseId).find((d) => d.type === "citation" && d.fromDocId === src.id && !d.fromReinspId);
    if (existing) return existing;
    const cited = src.items.filter((i) => i.cite && !i.done && !i.withdrawn);
    if (!cited.length) return null;
    const nd = {
      id: services.uid("d"),
      caseId: src.caseId,
      type: "citation",
      created: recordDay(services.today),
      status: "Draft",
      draft: true,
      mailed: recordDay(services.today),
      cc: "",
      cits: {},
      fromDocId: src.id,
      expectedHead: recordHead(src.caseId),
      inspectorId: docInsp(src).id,
      inspDate: inspAt(src).date,
      inspTime: inspAt(src).time || "",
      items: src.items.map((it) => ({
        ...it,
        id: services.uid("x"),
        srcItemId: it.id,
        done: !!it.done,
        doneOn: it.doneOn || "",
        cite: !!it.cite && !it.done && !it.withdrawn,
        hist: null,
      })),
    };
    workspaceState.DOCS.unshift(nd);
    nd.items
      .filter((i) => i.cite)
      .forEach((i) => {
        const sections = (i.sections || []).map(canonicalOrdinance),
          ord = sections.length === 1 ? sections[0] : "";
        nd.cits[i.id] = {
          deptId: docInsp(src).badge || "",
          num: services.citationNumber(),
          courtTime: courtTime(),
          comment:
            "Inspection on " +
            services.fmtDate(inspAt(src).date) +
            " documented the following violation: " +
            String(i.title || "").replace(/\.$/, "") +
            ". This citation relates to the Official Notice dated " +
            services.fmtDate(src.mailed) +
            ".",
          ord,
          preparedSections: sections,
          autoFilledCharge: !!ord,
          desc: String(i.title || "").toUpperCase(),
          issued: nd.mailed,
          courtDate: services.nextCourtDate(nd.mailed),
          depositMode: "schedule",
        };
        services.applyDeposit(nd, i.id, ord);
      });
    workspaceState.DIRTY = true;
    services.saveDrafts();
    services.depositStep.openNext(nd);
    return nd;
  }

  function needsInitialCitation(d) {
    return (
      !!d &&
      isEffective(d) &&
      d.type === "notice" &&
      services.sourceDocFor(d.caseId)?.id === d.id &&
      d.items.some((i) => i.cite && !i.withdrawn) &&
      !draftDocFor(d.caseId) &&
      !draftReinspFor(d.caseId) &&
      !services.unissuedVisitFor(d.caseId) &&
      !docsFor(d.caseId).some((x) => x.type === "citation" && x.fromDocId === d.id && !x.fromReinspId)
    );
  }

  function citationRecoveryPanel(d) {
    return needsInitialCitation(d)
      ? '<div class="banner info no-print"><div><strong>This notice has items sel' +
          'ected for citation.</strong> <button class="btn" id="btn-continuecitatio' +
          'n">Create citation draft</button></div></div>'
      : "";
  }
  return { citationTier, citationFromNotice, needsInitialCitation, citationRecoveryPanel };
}
