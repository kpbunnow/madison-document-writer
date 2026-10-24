import { SNOW_TYPE, DOC_TYPES, NEW_TYPES } from "./document_types.js";
/* Rules read only their arguments and document metadata; no live workspace or UI wiring. */

export const alignedExtension = (d) => d?.authoringVersion >= 12 && ["bestInterestExtension", "vacancyExtension"].includes(d.type);

/* Authoring 13 (R56): every extended Best Interest or Vacancy item carries a later repair due date, entered in
   Violation items; the conditional Vacancy model remains only for authoring-12 and earlier reprints. */
export const DATED_EXTENSIONS = 13;

export const simplifiedBestInterest = (d) => d?.type === "bestInterestExtension" && d.authoringVersion >= 15;

export const datedExtension = (d) => (d?.authoringVersion || 0) >= DATED_EXTENSIONS && ["bestInterestExtension", "vacancyExtension"].includes(d.type);

/* Authoring 16 (R62, owner Development 3): Best Interest and Vacancy Extensions cover every uncorrected item, with
   no affected-item selection or safety confirmation. Best Interest due dates work as on a normal Extension (the
   worksheet's Next due date, editable in Violation items); a Vacancy Extension prints no due date for uncorrected
   items and keeps only Scope and the next review inspection date. */
export const ALL_ITEM_EXTENSIONS = 16;

export const allItemExtension = (d) =>
  (d?.authoringVersion || 0) >= ALL_ITEM_EXTENSIONS && ["bestInterestExtension", "vacancyExtension"].includes(d.type);

export const simpleVacancy = (d) => d?.type === "vacancyExtension" && (d.authoringVersion || 0) >= ALL_ITEM_EXTENSIONS;

export const specialType = (type) => NEW_TYPES.find((t) => t.id === type);

export const supplemental = (d) => specialType(d?.type)?.effect === "supplemental";

export function activeRestrictions(documents) {
  const live = documents.filter((d) => !d.draft && !d.void && !d.superseded && d.type === "noOccupancy");
  const released = new Set(live.filter((d) => d.special?.mode === "release").map((d) => d.special.releases));
  return live.filter((d) => d.special?.mode !== "release" && !released.has(d.id));
}

export const deliveredByCitation = (d) => !!d && d.type === "notice" && d.authoringVersion >= 11 && !!d.issuanceGroup?.citationId;

/* ---------- what an issued document renders from ----------
   Issuing freezes the document, and everything the document was written
   from goes into the snapshot with it: the case as it read, the inspector
   who signed it, the body copy and the closing blocks. A property can be
   sold, an inspector can leave the roster and a later build can reword the
   library, and none of it may change a document the owner already holds.
   A draft has no frozen block and reads live; so does an issued document
   from a file written before this existed. */
export const frozenOf = (d) => (d && d.frozen) || null;

/* The inspection a document was written from (division, 09/18/2026). A
   follow-up carries its own inspDate/inspTime, taken from the reinspection;
   an Official Notice, a citation drafted with it, and any document written
   before this existed have none and read the case's initial inspection. When
   a document has its own date its time is its own too, or blank: one
   inspection's date is never printed beside another's time. */
export const hasOwnInsp = (d) => !!d && Object.prototype.hasOwnProperty.call(d, "inspDate");

/* ---------- clearing a case off the list ----------
   The list is a working desk, not the record: the record is the case file on
   the share. Removing a case puts it away, and Open case file brings it back.
   Work that has not reached the share yet is a different matter, so it is
   named and confirmed rather than quietly dropped. */
/* ---------- reinspection ---------- */
export const ocOf = (r, id) => (r.results[id] || {}).oc || "";

export const isHistoryDoc = (d) => !!(DOC_TYPES.find((t) => t.id === (d || {}).type) || {}).history;

/* Everything that happens once a document is issued: the case record is
   written, and the copy that goes in the mail is either filed as a PDF by the
   local helper or sent to the print dialog. Each step reports for itself, so a
   share that is down or a missing helper never leaves the inspector guessing. */
/* A notice can carry citations from the very first visit. Issuing it leaves
   the citation drafted and waiting rather than writing it silently, so the
   inspector still sets the court details and finalizes it themselves. */
/* A visit where everything passed still has to reach the record — it is the
   compliance half of every rate the division wants to report on. */
/* Document corrections are revisions of one business action, never new visits.
   The helper commits the revision and supersession together under its case lock.
   A failed/ambiguous save retains an idempotent attempt on the local draft. */
export const isEffective = (d) => !!d && !d.draft && !d.void && !d.superseded;

/* Items may be cited only when the imported Accela inspection status is Citation. */
export const citeAllowed = (d) => !!d?.importRule?.cite;

/* When an imported status does not permit citations (for example Citation corrected to Official Notice in Accela
   and re-imported), clear the citation marks and their draft citation and deposit data on a draft notice or an
   open worksheet. Issued and corrected documents are never changed. Returns whether anything was cleared. */
export function clearProhibitedCitations(target) {
  if (!target?.importRule || target.importRule.cite) return false;
  let cleared = false;
  if (target.results) {
    if (!target.draft || target.docId) return false;
    for (const res of Object.values(target.results)) {
      if (res?.cite) {
        res.cite = false;
        cleared = true;
      }
    }
    return cleared;
  }
  if (!target.draft || target.correction || target.pendingIssue || target.pendingAmendment || !Array.isArray(target.items)) return false;
  for (const it of target.items) {
    if (!it.cite) continue;
    it.cite = false;
    delete target.depositRequests?.[it.id];
    delete target.cits?.[it.id];
    cleared = true;
  }
  return cleared;
}

/* R4 authoring: explicit selections, manual deadlines, and reviewable deposits. */
export const libraryKey = (lib) => (lib ? JSON.stringify([lib.c, lib.g, lib.o]) : "");

export const itemLibraryKey = (it) => it.libraryKey || libraryKey(it.lib);

export const dueItems = (d) => (d.items || []).filter((i) => !i.done && !i.withdrawn && i.dueExempt !== "snow-10.28");

export const distinctDues = (items) => [...new Set(items.map((i) => i.due).filter(Boolean))];

export function recordCorrectionTypeAllowed(src, type) {
  if (type === src.type) return true;
  if (specialType(src.type)) return false;
  if (!src.fromReinspId || src.type === "citation" || !["extension", "referral", "referralUpdate", "compliance"].includes(type)) return false;
  return true;
}
export const isSnowCase = (k) => k?.caseType === SNOW_TYPE;
