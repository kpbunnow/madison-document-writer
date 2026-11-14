import { inspAt } from "./inspection_facts.js";
import { isHistoryDoc } from "./document_rules.js";
import { doc, docsFor, reinsp, reinspFor } from "./writer_queries.js";

// An issued, effective citation document.
const isIssuedCitation = (x) => !x.draft && !x.void && !x.superseded && x.type === "citation";

// The numbered citation an issued citation document raised on item `no`, with the visit it came from.
function issuedItemCitation(x, no) {
  if (!isIssuedCitation(x)) return null;
  const ci = x.items.find((i) => String(i.no) === String(no) && i.cite && !i.withdrawn);
  if (!ci) return null;
  const c = (x.cits || {})[ci.id] || {};
  return c.num ? { num: c.num, from: String(x.fromReinspId || ""), issued: c.issued || x.mailed || "" } : null;
}

export function itemHistory(caseId, no) {
  // every citation raised on this item, with the visit it came from
  const cits = [];
  docsFor(caseId).forEach((x) => {
    const entry = issuedItemCitation(x, no);
    if (entry) cits.push(entry);
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

// The document a source was written from: its notice, or the document its visit inspected.
const previousSource = (source) => doc(source.fromDocId || reinsp(source.fromReinspId)?.sourceDocId);

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
    const previous = previousSource(source);
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
    const row = visitObservation(d, lineage, visit);
    if (row) rows.push(row);
  }
}

// The observation a recorded (or this document's own) visit made of the traced item; null when it made none.
function tracedResult(lineage, visit) {
  const id = lineage.get(visit.sourceDocId);
  return id && visit.results?.[id];
}

const observedOn = (result, visit) => (result.manualDate ? result.on : result.on || visit.date);

function visitObservation(d, lineage, visit) {
  if (visit.draft && visit.id !== d.fromReinspId) return null;
  const result = tracedResult(lineage, visit);
  if (!result?.oc || result.carried || result.oc === "withdrawn") return null;
  return {
    visitId: visit.id,
    on: observedOn(result, visit),
    oc: result.oc,
    note: String(result.note || "").trim(),
    cit: "",
  };
}

// Citation metadata may annotate an observed visit, but issue dates never create inspection observations.
// A citation issued with (or in place of) the original notice annotates the first observation; its
// number would otherwise be lost from the referral, as earlier history formats retain it.
// The root item as cited by the root document itself, or by a citation written directly from it.
function initialCitedItem(citation, rootId, rootItem) {
  return citation.id === rootId
    ? citation.items.find((x) => x.id === rootItem && x.cite && !x.withdrawn)
    : citation.fromDocId === rootId && citation.items.find((x) => x.srcItemId === rootItem && x.cite && !x.withdrawn);
}

const citedNumber = (citation, cited) => cited && citation.cits?.[cited.id]?.num;

function annotateInitialCitation(d, lineage, initial, rootId) {
  if (!(initial && rootId)) return;
  const rootItem = lineage.get(rootId);
  for (const citation of docsFor(d.caseId)) {
    if (!isIssuedCitation(citation) || citation.fromReinspId) continue;
    const cited = initialCitedItem(citation, rootId, rootItem);
    if (citedNumber(citation, cited)) initial.cit = citation.cits[cited.id].num;
  }
}

function annotateVisitCitations(d, lineage, rows) {
  for (const row of rows) {
    if (!row.visitId) continue;
    for (const citation of docsFor(d.caseId)) {
      if (!isIssuedCitation(citation) || citation.fromReinspId !== row.visitId) continue;
      const observedId = lineage.get(citation.fromDocId);
      const cited = citation.items.find((x) => x.srcItemId === observedId && x.cite && !x.withdrawn);
      if (citedNumber(citation, cited)) row.cit = citation.cits[cited.id].num;
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

// A correction of a history-bearing document shows its corrected visit in the item history.
const correctsItemHistory = (d) => d.correction && (isHistoryDoc(d) || hasItemInspectionHistory(d));

export function createInspectionHistory(services) {
  function documentItemHistory(d, it) {
    if (!correctsItemHistory(d)) return it.hist || [];
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
