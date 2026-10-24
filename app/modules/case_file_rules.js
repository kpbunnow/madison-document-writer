/* Case shape, identity, correction-history and merge rules; no trust, UI or storage decisions. */
import { caseNumberKey } from "../assets/shared.js";
import { byTime, clone, caseDetails, stableJSON } from "./record_values.js";
import { recordCorrectionTypeAllowed } from "./document_rules.js";
/* Identifiers from a file are written straight into HTML attributes and into
   selectors, so anything that is not a plain identifier is refused at the
   door rather than escaped at each of the places it is used. */
export const ID_FIELDS = [
  "id",
  "docId",
  "caseId",
  "reinspId",
  "sourceDocId",
  "fromDocId",
  "fromReinspId",
  "srcItemId",
  "inspectorId",
  "replaces",
  "eventId",
  "itemId",
  "targetId",
  "rootId",
  "baseEventId",
];

export const ID_OK = /^[A-Za-z0-9_-]{1,64}$/;

export function mergeCaseDetails(local, remote, base) {
  const output = caseDetails(remote),
    a = caseDetails(local),
    b = base ? caseDetails(base) : null;
  const keys = new Set(Object.keys(a).concat(Object.keys(output)));
  keys.forEach((key) => {
    if (key === "id") return;
    if (stableJSON(a[key]) === stableJSON(output[key])) return;
    if (!b)
      throw new Error(
        "Case details differ from the shared copy. Export your local case for rev" +
          "iew, then remove it from the workspace and reopen the shared case.",
      );
    if (stableJSON(a[key]) === stableJSON(b[key])) return;
    if (stableJSON(output[key]) !== stableJSON(b[key]))
      throw new Error("Both copies changed " + key + ". Keep your local case and review the shared copy before saving.");
    if (a[key] === undefined) delete output[key];
    else output[key] = clone(a[key]);
  });
  output.id = local.id;
  return output;
}

export function caseFileName(k) {
  if (!caseNumberKey(k.number)) return null;
  return (
    (k.address || "PROPERTY")
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim() +
    " - " +
    k.number
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim() +
    ".json"
  );
}

export function badIds(o, depth) {
  if (!o || typeof o !== "object" || (depth || 0) > 12) return false;
  return Object.keys(o).some((key) => {
    const v = o[key];
    if (typeof v === "string") return ID_FIELDS.indexOf(key) >= 0 && v !== "" && !ID_OK.test(v);
    return badIds(v, (depth || 0) + 1);
  });
}

export function caseFileFault(f) {
  if (!f || typeof f !== "object") return "it is not a record";
  if (f.format !== "madison-case-file") return "it is not a Madison case file";
  const k = f["case"];
  if (!k || typeof k !== "object") return "it carries no case";
  if (!String(k.id || "").trim() || !String(k.number || "").trim()) return "the case has no number";
  if (k.ownerAddr !== undefined && (!Array.isArray(k.ownerAddr) || k.ownerAddr.some((x) => typeof x !== "string")))
    return "the owner address is not a list of text lines";
  if (k.emails !== undefined && !Array.isArray(k.emails)) return "email recipients are not a list";
  if (k.ccList !== undefined && !Array.isArray(k.ccList)) return "copy recipients are not a list";
  if (f.inspectors !== undefined && !Array.isArray(f.inspectors)) return "the inspector list is not a list";
  if ((f.inspectors || []).some((i) => !i || typeof i !== "object" || !String(i.id || "").trim())) return "an inspector record is incomplete";
  if (f.events !== undefined && !Array.isArray(f.events)) return "the event list is not a list";
  const seen = {};
  const evs = f.events || [];
  for (let n = 0; n < evs.length; n++) {
    const e = evs[n],
      at = " (event " + (n + 1) + " of " + evs.length + ")";
    if (!e || typeof e !== "object") return "an event is not a record" + at;
    if (!String(e.id || "").trim()) return "an event has no id" + at;
    if (seen[e.id]) return "two events share an id" + at;
    seen[e.id] = 1;
    if (!String(e.at || "").trim() || isNaN(new Date(e.at).getTime())) return "an event has no usable date" + at;
    if (!String(e.type || "").trim()) return "an event has no type" + at;
    if (e.payload !== undefined && (!e.payload || typeof e.payload !== "object")) return "an event payload is not a record" + at;
    const p = e.payload || {};
    if (/\.issued$/.test(e.type)) {
      if (!p.snapshot || typeof p.snapshot !== "object") return "an issued document carries no snapshot" + at;
      if (!Array.isArray(p.snapshot.items)) return "an issued document has no item list" + at;
      if (!p.snapshot.id || !p.snapshot.caseId) return "an issued document has no identity" + at;
      if (
        p.snapshot.items.some(
          (it) => !it || typeof it !== "object" || !it.id || !Array.isArray(it.sections) || it.sections.some((x) => typeof x !== "string"),
        )
      )
        return "an item has an invalid identity or ordinance list" + at;
      if (
        p.snapshot.frozen &&
        p.snapshot.frozen.case &&
        p.snapshot.frozen.case.ownerAddr !== undefined &&
        !Array.isArray(p.snapshot.frozen.case.ownerAddr)
      )
        return "a frozen mailing address is invalid" + at;
    }
    if (e.type === "reinspection.recorded" && (!p.reinspection || typeof p.reinspection !== "object")) return "a reinspection carries no record" + at;
  }
  if (badIds(f)) return "it carries an identifier the program cannot use";
  return correctionHistoryFault(f.events || []);
}

export function correctionHistoryFault(events) {
  const docs = new Map(),
    changed = new Set();
  for (const ev of events.slice().sort(byTime)) {
    const p = ev.payload || {};
    if (/\.issued$/.test(ev.type) && p.snapshot) {
      if (docs.has(p.snapshot.id)) return "Two issued records share a document identity";
      if (ev.type === "correction.issued") {
        const old = docs.get(p.replaces);
        if (!old || old.eventId !== p.baseEventId || changed.has(p.replaces))
          return "Conflicting corrections: keep both drafts for review and reopen the current shared case";
        if (!String(p.reason || "").trim() || !p.snapshot.revision) return "A correction is missing its reason or revision link";
        if (
          !recordCorrectionTypeAllowed(old, p.snapshot.type) ||
          stableJSON(old.items.map((i) => [i.id, i.no])) !== stableJSON(p.snapshot.items.map((i) => [i.id, i.no]))
        )
          return "A correction changed the document type or item identities";
        changed.add(p.replaces);
      }
      docs.set(p.snapshot.id, Object.assign({}, p.snapshot, { eventId: ev.id }));
    }
  }
  return "";
}

export const summaryName = (k) => caseNumberKey(k.number) + ".json";
