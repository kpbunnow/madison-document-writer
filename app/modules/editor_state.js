/* Editor view pointer, work buffer and local interaction state. Core retains initialization order. */
import { WriterState } from "./state.js";

export const editorState = Object.freeze({
  get state() {
    return WriterState.state;
  },
  set state(value) {
    WriterState.state = value;
  },
  get WORK() {
    return WriterState.WORK;
  },
  set WORK(value) {
    WriterState.WORK = value;
  },
  get LOCAL_SAVE() {
    return WriterState.LOCAL_SAVE;
  },
  set LOCAL_SAVE(value) {
    WriterState.LOCAL_SAVE = value;
  },
  get draftTimer() {
    return WriterState.draftTimer;
  },
  set draftTimer(value) {
    WriterState.draftTimer = value;
  },
  get RECORD_ATTEMPTS() {
    return WriterState.RECORD_ATTEMPTS;
  },
  set RECORD_ATTEMPTS(value) {
    WriterState.RECORD_ATTEMPTS = value;
  },
  get AMENDMENT_BUSY() {
    return WriterState.AMENDMENT_BUSY;
  },
  set AMENDMENT_BUSY(value) {
    WriterState.AMENDMENT_BUSY = value;
  },
  get FILING_ACTIVE() {
    return WriterState.FILING_ACTIVE;
  },
  set FILING_ACTIVE(value) {
    WriterState.FILING_ACTIVE = value;
  },
  get undoFn() {
    return WriterState.undoFn;
  },
  set undoFn(value) {
    WriterState.undoFn = value;
  },
  get WORK_PATCH() {
    return WriterState.WORK_PATCH;
  },
  set WORK_PATCH(value) {
    WriterState.WORK_PATCH = value;
  },
  get LOCAL_CHANGED() {
    return WriterState.LOCAL_CHANGED;
  },
  set LOCAL_CHANGED(value) {
    WriterState.LOCAL_CHANGED = value;
  },
  get LOCAL_SAVE_CHAIN() {
    return WriterState.LOCAL_SAVE_CHAIN;
  },
  set LOCAL_SAVE_CHAIN(value) {
    WriterState.LOCAL_SAVE_CHAIN = value;
  },
  get dragging() {
    return WriterState.dragging;
  },
  set dragging(value) {
    WriterState.dragging = value;
  },
  get groupOld() {
    return WriterState.groupOld;
  },
  set groupOld(value) {
    WriterState.groupOld = value;
  },
  get RESOLUTION_BUSY() {
    return WriterState.RESOLUTION_BUSY;
  },
  set RESOLUTION_BUSY(value) {
    WriterState.RESOLUTION_BUSY = value;
  },
  get SAFETY_HEALTH() {
    return WriterState.SAFETY_HEALTH;
  },
  set SAFETY_HEALTH(value) {
    WriterState.SAFETY_HEALTH = value;
  },
  get SAFETY_LOCK() {
    return WriterState.SAFETY_LOCK;
  },
  set SAFETY_LOCK(value) {
    WriterState.SAFETY_LOCK = value;
  },
});
