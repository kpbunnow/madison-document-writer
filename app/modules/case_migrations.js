/* Deterministic legacy migration only; schema-5 integrity migration remains helper-owned. */
import { SCHEMA } from "./document_types.js";
import { byTime, clone } from "./record_values.js";
/* ---------- migration ----------
   A file written today has to open years from now, after the app has moved
   on. Every load runs through here; each step upgrades one version. */
/* A migrated event must carry the same id every time the same legacy file
   is opened, or loading it twice appends the whole history again. The
   ordinal preserves the order the file was written in: same-day documents
   all migrate to noon, and a tie on the timestamp is broken on the id. */
export const migId = (cid, n, kind, ref) =>
  "mig1_" +
  String(cid || "").replace(/[^A-Za-z0-9]/g, "") +
  "_" +
  String(n).padStart(4, "0") +
  "_" +
  kind +
  "_" +
  String(ref || "").replace(/[^A-Za-z0-9_-]/g, "");

export const MIGRATIONS = {
  3: function (f) {
    return Object.assign({}, f, { schema: 4 });
  },
  2: function (f) {
    return Object.assign({}, f, { schema: 3 });
  },
  1: function (f) {
    // v1 stored current state; v2 stores the events that produced it
    const evs = [];
    const cno = (f["case"] || {}).number || "";
    let mn = 0;
    (f.documents || [])
      .slice()
      .reverse()
      .forEach((d) => {
        const type =
          (d.type === "notice" ? "notice" : d.type === "extension" ? "extension" : d.type === "citation" ? "citation" : "notice") + ".issued";
        const snap = clone(d);
        snap.draft = false;
        evs.push({
          id: migId(cno, mn++, "doc", d.id),
          at: (d.mailed || d.created || "1970-01-01") + "T12:00:00.000Z",
          by: d.inspectorId || (f["case"] || {}).inspectorId || "",
          type: type,
          payload: { docId: d.id, snapshot: snap, fromReinspId: d.fromReinspId || "", fromDocId: d.fromDocId || "" },
        });
      });
    (f.reinspections || []).forEach((r) => {
      evs.push({
        id: migId(cno, mn++, "rein", r.id),
        at: (r.date || "1970-01-01") + "T12:00:00.000Z",
        by: r.inspectorId || "",
        type: "reinspection.recorded",
        payload: { reinspId: r.id, reinspection: clone(r) },
      });
    });
    return {
      format: f.format,
      schema: 2,
      exported: f.exported,
      exportedBy: f.exportedBy,
      case: f["case"],
      inspectors: f.inspectors || [],
      events: evs.sort(byTime),
    };
  },
};

export function migrate(f) {
  let v = f.schema || f.version || 1,
    guard = 0;
  if (v === 4) return f;
  while (v < 4 && guard++ < 20) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error("no migration from schema " + v);
    f = step(f);
    v = f.schema || v + 1;
  }
  if (v > SCHEMA) throw new Error("this file was written by a newer version of the program (schema " + v + ")");
  return f;
}
