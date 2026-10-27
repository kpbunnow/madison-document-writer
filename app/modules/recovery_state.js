/* Device recovery queue, progress and selection coordination. Core retains initialization order. */
import { WriterState } from "./state.js";

export const recoveryState = Object.freeze({
  get RECOVERY() {
    return WriterState.RECOVERY;
  },
  set RECOVERY(value) {
    WriterState.RECOVERY = value;
  },
  get RECOVERY_BUSY() {
    return WriterState.RECOVERY_BUSY;
  },
  set RECOVERY_BUSY(value) {
    WriterState.RECOVERY_BUSY = value;
  },
  get RECOVERY_NEXT() {
    return WriterState.RECOVERY_NEXT;
  },
  set RECOVERY_NEXT(value) {
    WriterState.RECOVERY_NEXT = value;
  },
  get RECOVERY_SELECT_SEQ() {
    return WriterState.RECOVERY_SELECT_SEQ;
  },
  set RECOVERY_SELECT_SEQ(value) {
    WriterState.RECOVERY_SELECT_SEQ = value;
  },
  get RECOVERY_SIGNATURES() {
    return WriterState.RECOVERY_SIGNATURES;
  },
  set RECOVERY_SIGNATURES(value) {
    WriterState.RECOVERY_SIGNATURES = value;
  },
  get RECOVERY_TIMER() {
    return WriterState.RECOVERY_TIMER;
  },
  set RECOVERY_TIMER(value) {
    WriterState.RECOVERY_TIMER = value;
  },
});
