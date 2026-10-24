import { recordCase } from "./record_sources.js";
/* Live workspace queries, not startup: never capture array references or initialize shared state here. */
import { WriterState } from "./state.js";
import { INSPECTORS } from "./data/inspectors.js";
import { deliveredByCitation, frozenOf, isEffective, isHistoryDoc, ocOf } from "./document_rules.js";
export const effectiveFiled = (d) => (deliveredByCitation(d) ? !!doc(d.issuanceGroup.citationId)?.filedAt : !!d?.filedAt);

export const kase = (id) => WriterState.CASES.find((k) => k.id === id) || {};

export const insp = (id) => INSPECTORS.find((i) => i.id === id) || {};

export const doc = (id) => WriterState.DOCS.find((d) => d.id === id);

export const docCase = (d) => recordCase(d, WriterState.CASES);

export const docInsp = (d) =>
  d && d.correction ? insp(d.inspectorId) : (frozenOf(d) && frozenOf(d).inspector) || insp((d && d.inspectorId) || docCase(d).inspectorId);

/* Outlook is driven by the local helper rather than a mailto link, because a
   mailto cannot carry an attachment and the whole point is to send the PDF. */
/* Filing, printing and emailing all happen after the click that started
   them, and the screen does not wait: finalizing a notice with a citation
   ticked opens the citation immediately. The page and the filename are
   therefore captured together, up front, and that one job is what every
   later step works from — never whatever document is on screen by then. */
/* the finished document as a standalone page: what the printer sees and what
   the helper turns into the filed PDF */
/* Where documents are going, said on every screen. A case file held back
   because the browser wants permission is not something an inspector can be
   left to notice on their own. */
/* Written because a save that quietly goes to the wrong place is impossible to
   diagnose over the phone. Everything the storage layer knows, on one screen,
   plus a probe that actually writes a file and reports what happened. */
/* ---------- case files ----------
   No backend, so the exported JSON *is* the case record. It holds the case,
   every document written against it and every reinspection, so any inspector
   can open it off the shared drive and pick the work up. */
export const reinsp = (id) => WriterState.REINSP.find((r) => r.id === id);

export const docsFor = (cid) => WriterState.DOCS.filter((d) => d.caseId === cid);

export const reinspFor = (cid) => WriterState.REINSP.filter((r) => r.caseId === cid);

/* the document a reinspection is walked against: the newest one with items,
   which is the original notice on the first return visit and the extension
   after that */
export const draftDocFor = (cid) => docsFor(cid).find((d) => d.draft) || null;

export const draftReinspFor = (cid) => WriterState.REINSP.find((r) => r.draft && r.caseId === cid) || null;

// oldest notice on the case — the one the owner first received
export const originalNotice = (cid) =>
  docsFor(cid)
    .filter((d) => !d.draft && d.type === "notice" && d.items.length)
    .slice(-1)[0] || null;

/* caseId -> [event] */
export const eventsFor = (cid) => WriterState.EVENTS[cid] || (WriterState.EVENTS[cid] = []);

/* ---------- replay ----------
   Rebuilds the published documents and reinspection record for a case. Drafts
   are not in here; they live only on this device until they are issued. */
/* Pure: an event list in, documents and visits out. Nothing global is read
   or written, so reporting can replay a file without loading it. */

export const openItems = (r) => {
  const src = doc(r.sourceDocId);
  return src ? src.items.filter((i) => ocOf(r, i.id) && ocOf(r, i.id) !== "corrected" && ocOf(r, i.id) !== "withdrawn") : [];
};

export const doneItems = (r) => {
  const src = doc(r.sourceDocId);
  return src ? src.items.filter((i) => ocOf(r, i.id) === "corrected") : [];
};

export const unchecked = (r) => {
  const src = doc(r.sourceDocId);
  return src ? src.items.filter((i) => !ocOf(r, i.id)) : [];
};

/* The case is with the City Attorney now: it has an effective (issued, not voided or superseded) referral or
   referral update. Live state only; as-of projections, source-excluding correction checks and helper validation keep
   their own predicates. */
export const isReferredCase = (caseId) => docsFor(caseId).some((d) => isEffective(d) && isHistoryDoc(d));

const isRecordEvent = (e) =>
  /\.issued$/.test(e.type) || e.type === "document.voided" || e.type === "reinspection.recorded" || e.type === "document.served";

export const recordHead = (cid) =>
  eventsFor(cid)
    .filter(isRecordEvent)
    .map((e) => e.id)
    .sort();

export const correctionSource = (d) => (d && d.correction ? doc(d.correction.targetId) : null);

export const recordNow = (cid) => new Date(Math.max(Date.now(), ...eventsFor(cid).map((e) => Date.parse(e.at) + 1))).toISOString();
