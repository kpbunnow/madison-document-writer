/* Workspace records, connections and save status. Core retains initialization order.
   Accessors resolve the current backing value on every read/write; construction reads nothing. */
import { WriterState } from "./state.js";

export const workspaceState = Object.freeze({
  get CASES() {
    return WriterState.CASES;
  },
  set CASES(value) {
    WriterState.CASES = value;
  },
  get DOCS() {
    return WriterState.DOCS;
  },
  set DOCS(value) {
    WriterState.DOCS = value;
  },
  get REINSP() {
    return WriterState.REINSP;
  },
  set REINSP(value) {
    WriterState.REINSP = value;
  },
  get EVENTS() {
    return WriterState.EVENTS;
  },
  set EVENTS(value) {
    WriterState.EVENTS = value;
  },
  get PENDING() {
    return WriterState.PENDING;
  },
  set PENDING(value) {
    WriterState.PENDING = value;
  },
  get DIRTY() {
    return WriterState.DIRTY;
  },
  set DIRTY(value) {
    WriterState.DIRTY = value;
  },
  get CASEDIR() {
    return WriterState.CASEDIR;
  },
  set CASEDIR(value) {
    WriterState.CASEDIR = value;
  },
  get DIRNAME() {
    return WriterState.DIRNAME;
  },
  set DIRNAME(value) {
    WriterState.DIRNAME = value;
  },
  get NEEDGRANT() {
    return WriterState.NEEDGRANT;
  },
  set NEEDGRANT(value) {
    WriterState.NEEDGRANT = value;
  },
  get LASTINDEX() {
    return WriterState.LASTINDEX;
  },
  set LASTINDEX(value) {
    WriterState.LASTINDEX = value;
  },
  get LASTWRITE() {
    return WriterState.LASTWRITE;
  },
  set LASTWRITE(value) {
    WriterState.LASTWRITE = value;
  },
  get WORKFLOW_PREFS() {
    return WriterState.WORKFLOW_PREFS;
  },
  set WORKFLOW_PREFS(value) {
    WriterState.WORKFLOW_PREFS = value;
  },
  get SAVE_CHECKPOINTS() {
    return WriterState.SAVE_CHECKPOINTS;
  },
  set SAVE_CHECKPOINTS(value) {
    WriterState.SAVE_CHECKPOINTS = value;
  },
  get PREFLIGHT_CONFLICT() {
    return WriterState.PREFLIGHT_CONFLICT;
  },
  set PREFLIGHT_CONFLICT(value) {
    WriterState.PREFLIGHT_CONFLICT = value;
  },
  get PREFLIGHT_NOTICE() {
    return WriterState.PREFLIGHT_NOTICE;
  },
  set PREFLIGHT_NOTICE(value) {
    WriterState.PREFLIGHT_NOTICE = value;
  },
  get PREFLIGHT_SEQ() {
    return WriterState.PREFLIGHT_SEQ;
  },
  set PREFLIGHT_SEQ(value) {
    WriterState.PREFLIGHT_SEQ = value;
  },
});
