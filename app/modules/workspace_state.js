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
  get seq() {
    return WriterState.seq;
  },
  set seq(value) {
    WriterState.seq = value;
  },
  get IDBCONN() {
    return WriterState.IDBCONN;
  },
  set IDBCONN(value) {
    WriterState.IDBCONN = value;
  },
  get TIMELINE_CASE() {
    return WriterState.TIMELINE_CASE;
  },
  set TIMELINE_CASE(value) {
    WriterState.TIMELINE_CASE = value;
  },
  get TIMELINE_FILTER() {
    return WriterState.TIMELINE_FILTER;
  },
  set TIMELINE_FILTER(value) {
    WriterState.TIMELINE_FILTER = value;
  },
  get ARTIFACT_IDENTITY() {
    return WriterState.ARTIFACT_IDENTITY;
  },
  set ARTIFACT_IDENTITY(value) {
    WriterState.ARTIFACT_IDENTITY = value;
  },
  get ARTIFACT_LOCATIONS() {
    return WriterState.ARTIFACT_LOCATIONS;
  },
  set ARTIFACT_LOCATIONS(value) {
    WriterState.ARTIFACT_LOCATIONS = value;
  },
  get ARTIFACT_SEQ() {
    return WriterState.ARTIFACT_SEQ;
  },
  set ARTIFACT_SEQ(value) {
    WriterState.ARTIFACT_SEQ = value;
  },
  get ARTIFACT_VERIFY() {
    return WriterState.ARTIFACT_VERIFY;
  },
  set ARTIFACT_VERIFY(value) {
    WriterState.ARTIFACT_VERIFY = value;
  },
  get OUTBOX_FILES() {
    return WriterState.OUTBOX_FILES;
  },
  set OUTBOX_FILES(value) {
    WriterState.OUTBOX_FILES = value;
  },
});
