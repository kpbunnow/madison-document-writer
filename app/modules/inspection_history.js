import { inspAt } from "./inspection_facts.js";
import { isHistoryDoc } from "./document_rules.js";
import { doc, docsFor, reinsp, reinspFor } from "./writer_queries.js";

export function itemHistory(caseId, no) {
  // every citation raised on this item, with the visit it came from
  const cits = [];
  docsFor(caseId).forEach((x) => {
    if (x.draft || x.void || x.superseded || x.type !== "citation") return;
    const ci = x.items.find((i) => String(i.no) === String(no) && i.cite && !i.withdrawn);
    if (!ci) return;
    const c = (x.cits || {})[ci.id] || {};
    if (c.num) cits.push({ num: c.num, from: String(x.fromReinspId || ""), issued: c.issued || x.mailed || "" });
  });
  const used = {};
  const out = [];
  reinspFor(caseId)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .forEach((r) => {
      const src = doc(r.sourceDocId);
      if (!src) return;
      const it = src.items.find((x) => String(x.no) === String(no));
      if (!it) return;
      const res = r.results[it.id];
      if (!res || !res.oc) return;
      const hit = cits.find((c) => c.from === String(r.id) && !used[c.num]);
      if (hit) used[hit.num] = 1;
      out.push({ visitId: r.id, on: res.on || r.date, oc: res.oc, note: String(res.note || "").trim(), cit: hit ? hit.num : "" });
    });
  // a citation issued with the original notice has no visit behind it, so it
  // is listed on its own line rather than dropped
  cits
    .filter((c) => !used[c.num])
    .forEach((c) => {
      out.unshift({ on: c.issued || "", oc: "cited", note: "", cit: c.num });
    });
  return out;
}

function inspectionLineage(d, it) {
  const lineage = new Map(),
    seen = new Set();
  let source = d,
    item = it,
    initial = null,
    rootId = "";
  while (source && item && !seen.has(source.id)) {
    seen.add(source.id);
    lineage.set(source.id, item.id);
    const previous = doc(source.fromDocId || reinsp(source.fromReinspId)?.sourceDocId);
    if (!previous) {
      if (!source.fromDocId && !source.fromReinspId) {
        initial = { on: inspAt(source).date, oc: "initial", note: "", cit: "" };
        rootId = source.id;
      }
      break;
    }
    const prior = previous.items.find((x) => x.id === item.srcItemId);
    if (!prior) {
      if (!item.srcItemId) {
        initial = { on: inspAt(source).date, oc: "initial", note: "", cit: "" };
        rootId = source.id;
      }
      break;
    }
    source = previous;
    item = prior;
  }
  return { lineage, initial, rootId };
}

function appendInspectionVisits(d, lineage, rows) {
  for (const visit of reinspFor(d.caseId)) {
    if (visit.draft && visit.id !== d.fromReinspId) continue;
    const id = lineage.get(visit.sourceDocId),
      result = id && visit.results?.[id];
    if (!result?.oc || result.carried || result.oc === "withdrawn") continue;
    rows.push({
      visitId: visit.id,
      on: result.manualDate ? result.on : result.on || visit.date,
      oc: result.oc,
      note: String(result.note || "").trim(),
      cit: "",
    });
  }
}

// Citation metadata may annotate an observed visit, but issue dates never create inspection observations.
// A citation issued with (or in place of) the original notice annotates the first observation; its
// number would otherwise be lost from the referral, as earlier history formats retain it.
function annotateInitialCitation(d, lineage, initial, rootId) {
  if (initial && rootId) {
    const rootItem = lineage.get(rootId);
    for (const citation of docsFor(d.caseId)) {
      if (citation.draft || citation.void || citation.superseded || citation.type !== "citation" || citation.fromReinspId) continue;
      const cited =
        citation.id === rootId
          ? citation.items.find((x) => x.id === rootItem && x.cite && !x.withdrawn)
          : citation.fromDocId === rootId && citation.items.find((x) => x.srcItemId === rootItem && x.cite && !x.withdrawn);
      if (cited && citation.cits?.[cited.id]?.num) initial.cit = citation.cits[cited.id].num;
    }
  }
}

function annotateVisitCitations(d, lineage, rows) {
  for (const row of rows) {
    if (!row.visitId) continue;
    for (const citation of docsFor(d.caseId)) {
      if (citation.draft || citation.void || citation.superseded || citation.type !== "citation" || citation.fromReinspId !== row.visitId) continue;
      const observedId = lineage.get(citation.fromDocId);
      const cited = citation.items.find((x) => x.srcItemId === observedId && x.cite && !x.withdrawn);
      if (cited && citation.cits?.[cited.id]?.num) row.cit = citation.cits[cited.id].num;
    }
  }
}

export function itemInspectionHistory(d, it) {
  const { lineage, initial, rootId } = inspectionLineage(d, it);
  const rows = [initial || { on: "", oc: "initial", note: "", cit: "" }];
  appendInspectionVisits(d, lineage, rows);
  annotateInitialCitation(d, lineage, initial, rootId);
  annotateVisitCitations(d, lineage, rows);
  return rows.sort((a, b) => String(a.on || "").localeCompare(String(b.on || "")) || String(a.visitId || "").localeCompare(String(b.visitId || "")));
}

export const hasItemInspectionHistory = (d) =>
  !!d && ((isHistoryDoc(d) && d.authoringVersion >= 14) || (d.type === "compliance" && d.authoringVersion >= 15));

export function createInspectionHistory(services) {
  function documentItemHistory(d, it) {
    if (!d.correction || (!isHistoryDoc(d) && !hasItemInspectionHistory(d))) return it.hist || [];
    const patch = services.correctionVisitPatch(d),
      r = patch && reinsp(patch.id);
    if (!r) return it.hist || [];
    const res = patch.results[it.srcItemId] || r.results[it.srcItemId];
    return (d.authoringVersion >= 14 ? it.hist || [] : itemHistory(d.caseId, it.no)).map((x) =>
      x.visitId === r.id && res ? { ...x, on: res.on || patch.date, oc: res.oc, note: res.note || "" } : x,
    );
  }

  return { documentItemHistory };
}
