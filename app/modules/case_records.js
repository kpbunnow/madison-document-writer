import { replayEvents } from "./case_projection.js";
import { caseDetails, stableJSON, byTime, clone } from "./record_values.js";
import { caseNumberKey, validCaseNumber } from "../assets/shared.js";
import { correctionHistoryFault } from "./case_file_rules.js";
import { SCHEMA } from "./document_types.js";
import { nowISO } from "./calendar.js";
import { eventsFor, kase, insp } from "./writer_queries.js";
import { INSPECTORS } from "./data/inspectors.js";
import { WriterState } from "./state.js";

// Live record operations, not pure calculations or startup: no UI, storage or trust decisions.
export function replay(cid) {
  return replayEvents(eventsFor(cid));
}

export function project() {
  WriterState.DOCS = WriterState.DOCS.filter((d) => d.draft);
  WriterState.REINSP = WriterState.REINSP.filter((r) => r.draft);
  WriterState.CASES.forEach((k) => {
    const st = replay(k.id);
    st.documents.forEach((d) => WriterState.DOCS.push(d));
    st.reinspections.forEach((r) => WriterState.REINSP.push(r));
  });
  WriterState.DOCS.sort((a, b) => {
    const at = a.draft ? "9999" : a.issuedAt || "",
      bt = b.draft ? "9999" : b.issuedAt || "";
    return at === bt ? 0 : at < bt ? 1 : -1;
  });
}

export function rememberSaved(k, file) {
  const details = caseDetails(file.case);
  details.id = k.id;
  WriterState.SAVE_CHECKPOINTS[k.id] = { case: details, events: (file.events || []).map((e) => e.id) };
  k.savedAt = nowISO();
}

export function caseFile(cid) {
  const k = kase(cid),
    evs = eventsFor(cid).slice().sort(byTime);
  const used = {};
  evs.forEach((e) => {
    if (e.by) used[e.by] = 1;
  });
  used[k.inspectorId] = 1;
  return {
    format: "madison-case-file",
    schema: SCHEMA,
    exported: nowISO(),
    exportedBy: insp(k.inspectorId).name || "",
    case: caseDetails(k),
    inspectors: INSPECTORS.filter((i) => used[i.id]),
    events: clone(evs),
  };
}

export function caseNumberAllowed(k) {
  return (
    !!k && (validCaseNumber(k.number) || (!!caseNumberKey(k.number) && !!(k.savedAt || WriterState.SAVE_CHECKPOINTS[k.id] || eventsFor(k.id).length)))
  );
}

export function bumpSeq(o) {
  const scan = (v) => {
    if (typeof v === "string") {
      const m = /^[a-z](\d+)$/.exec(v);
      if (m) WriterState.seq = Math.max(WriterState.seq, +m[1]);
    } else if (v && typeof v === "object") Object.keys(v).forEach((kk) => scan(v[kk]));
  };
  scan(o);
}

export function mergeCaseEvents(k, f) {
  const inc = f["case"];
  if (k.id !== inc.id) {
    (f.events || []).forEach((e) => {
      const p = e.payload || {};
      if (p.snapshot && p.snapshot.caseId === inc.id) p.snapshot.caseId = k.id;
      if (p.reinspection && p.reinspection.caseId === inc.id) p.reinspection.caseId = k.id;
      if (p.caseId === inc.id) p.caseId = k.id;
    });
  }
  const combined = new Map(eventsFor(k.id).map((e) => [e.id, e]));
  (f.events || []).forEach((e) => {
    const old = combined.get(e.id);
    if (old && stableJSON(old) !== stableJSON(e)) throw new Error("Conflicting content for an existing event");
    combined.set(e.id, e);
  });
  const fault = correctionHistoryFault(Array.from(combined.values()));
  if (fault) throw new Error(fault);
  const have = {};
  eventsFor(k.id).forEach((e) => {
    have[e.id] = 1;
  });
  let added = 0;
  (f.events || []).forEach((e) => {
    if (!have[e.id]) {
      eventsFor(k.id).push(e);
      added++;
    }
  });
  if (added) eventsFor(k.id).sort(byTime);
  return added;
}
