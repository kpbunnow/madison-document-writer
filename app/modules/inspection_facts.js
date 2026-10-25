/* Inspection identity and call-time workspace facts; no startup, UI or publication authority. */
import { parseTime } from "./calendar.js";
import { hasOwnInsp } from "./document_rules.js";
import { docCase, docsFor, reinspFor } from "./writer_queries.js";

export function inspAt(d) {
  if (hasOwnInsp(d)) return { date: d.inspDate || "", time: d.inspTime || "", own: true };
  const k = docCase(d);
  return { date: k.date || "", time: k.time || "", own: false };
}

export function inspectionIdentity(row) {
  return { type: row.typeKey, date: row.date, time: parseTime(row.time || "") || "" };
}

export function sameInspection(a, b) {
  return !!a && !!b && a.date === b.date && a.type === b.type && (!a.time || !b.time || a.time === b.time);
}

export function inspectionUsed(k, row) {
  const key = inspectionIdentity(row),
    documents = docsFor(k.id);
  // Retain evidence even after correction or withdrawal; never recycle an inspection.
  if (documents.some((d) => sameInspection(d.importInspection, key))) return true;
  if (key.type === "initial" && documents.some((d) => d.type === "notice")) return true;
  if (reinspFor(k.id).some((r) => sameInspection(r.importInspection || { type: "reinspection", date: r.date, time: r.time || "" }, key))) return true;
  return documents.some(
    (d) => d.type !== "notice" && d.fromReinspId && sameInspection({ type: "reinspection", date: inspAt(d).date, time: inspAt(d).time || "" }, key),
  );
}
