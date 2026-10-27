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
