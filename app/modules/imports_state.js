/* Accela selection and lookup request coordination. Core retains initialization order. */
import { WriterState } from "./state.js";

export const importsState = Object.freeze({
  get ACC_SELECTION_SERIAL() {
    return WriterState.ACC_SELECTION_SERIAL;
  },
  set ACC_SELECTION_SERIAL(value) {
    WriterState.ACC_SELECTION_SERIAL = value;
  },
  get LOOKUP_BUSY() {
    return WriterState.LOOKUP_BUSY;
  },
  set LOOKUP_BUSY(value) {
    WriterState.LOOKUP_BUSY = value;
  },
  get LOOKUP_CONTROLLER() {
    return WriterState.LOOKUP_CONTROLLER;
  },
  set LOOKUP_CONTROLLER(value) {
    WriterState.LOOKUP_CONTROLLER = value;
  },
  get LOOKUP_ERROR() {
    return WriterState.LOOKUP_ERROR;
  },
  set LOOKUP_ERROR(value) {
    WriterState.LOOKUP_ERROR = value;
  },
  get LOOKUP_SERIAL() {
    return WriterState.LOOKUP_SERIAL;
  },
  set LOOKUP_SERIAL(value) {
    WriterState.LOOKUP_SERIAL = value;
  },
});
