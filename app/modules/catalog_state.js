/* Catalog authority and device review state; initialization remains in core. */
import { WriterState } from "./state.js";

export const catalogState = Object.freeze({
  get CATALOG_AT() {
    return WriterState.CATALOG_AT;
  },
  set CATALOG_AT(value) {
    WriterState.CATALOG_AT = value;
  },
  get CATALOG_ERROR() {
    return WriterState.CATALOG_ERROR;
  },
  set CATALOG_ERROR(value) {
    WriterState.CATALOG_ERROR = value;
  },
  get CATALOG_EVENTS() {
    return WriterState.CATALOG_EVENTS;
  },
  set CATALOG_EVENTS(value) {
    WriterState.CATALOG_EVENTS = value;
  },
  get CATALOG_FORMS() {
    return WriterState.CATALOG_FORMS;
  },
  set CATALOG_FORMS(value) {
    WriterState.CATALOG_FORMS = value;
  },
  get CATALOG_FROM_CACHE() {
    return WriterState.CATALOG_FROM_CACHE;
  },
  set CATALOG_FROM_CACHE(value) {
    WriterState.CATALOG_FROM_CACHE = value;
  },
  get CATALOG_VERIFIED() {
    return WriterState.CATALOG_VERIFIED;
  },
  set CATALOG_VERIFIED(value) {
    WriterState.CATALOG_VERIFIED = value;
  },
});

// Cached reviews are optional last-known facts, never a substitute for the helper's publication check.
const cachedReview = (e) =>
  e &&
  typeof e === "object" &&
  !Array.isArray(e) &&
  ["id", "key", "at", "reviewer", "wording", "source"].every((k) => typeof e[k] === "string") &&
  ["id", "key", "at", "reviewer", "source"].every((k) => e[k].trim()) &&
  Number.isInteger(e.version) &&
  e.version > 0 &&
  ["approved", "retired"].includes(e.status) &&
  Array.isArray(e.ordinances) &&
  e.ordinances.every((x) => typeof x === "string") &&
  (e.replaces === undefined || typeof e.replaces === "string") &&
  (e.status !== "approved" || (e.wording.trim() && e.ordinances.length));

export function catalogDeviceState(read) {
  const state = { CATALOG_EVENTS: [], CATALOG_AT: "", CATALOG_VERIFIED: false, CATALOG_FROM_CACHE: false, CATALOG_FORMS: {}, CATALOG_ERROR: "" };
  const errors = [];
  try {
    const cache = JSON.parse(read("madison-catalog-events-v1") || "null");
    if (cache !== null) {
      if (!cache || !Array.isArray(cache.events) || !cache.events.every(cachedReview) || (cache.at !== undefined && typeof cache.at !== "string"))
        throw Error("Invalid cached review history");
      state.CATALOG_EVENTS = cache.events;
      state.CATALOG_AT = cache.at || "";
      state.CATALOG_VERIFIED = true;
      state.CATALOG_FROM_CACHE = true;
    }
  } catch {
    errors.push("Saved catalog reviews could not be read; refresh review status before selecting language.");
  }
  // A failed history read must not hide independent unsubmitted review forms.
  try {
    const forms = JSON.parse(read("madison-catalog-forms-v1") || "{}");
    if (!forms || typeof forms !== "object" || Array.isArray(forms)) throw Error("Invalid saved review forms");
    state.CATALOG_FORMS = forms;
    if (Object.values(forms).some((f) => !f || typeof f !== "object" || Array.isArray(f)))
      errors.push("Some saved review forms are unreadable. Their original browser data was retained.");
  } catch {
    errors.push("Saved review forms could not be read. Their original browser data was left unchanged.");
  }
  state.CATALOG_ERROR = errors.join(" ");
  return state;
}
