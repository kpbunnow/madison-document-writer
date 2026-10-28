/* Startup coordination only. Core retains lock, promise and channel initialization order. */
import { WriterState } from "./state.js";

export const startupState = Object.freeze({
  get STARTUP_STATUS() {
    return WriterState.STARTUP_STATUS;
  },
  set STARTUP_STATUS(value) {
    WriterState.STARTUP_STATUS = value;
  },
  get STARTUP_ERROR() {
    return WriterState.STARTUP_ERROR;
  },
  set STARTUP_ERROR(value) {
    WriterState.STARTUP_ERROR = value;
  },
  get WRITER_READY() {
    return WriterState.WRITER_READY;
  },
  set WRITER_READY(value) {
    WriterState.WRITER_READY = value;
  },
  get WRITER_ACCESS() {
    return WriterState.WRITER_ACCESS;
  },
  set WRITER_ACCESS(value) {
    WriterState.WRITER_ACCESS = value;
  },
  get WRITER_CHANNEL() {
    return WriterState.WRITER_CHANNEL;
  },
  set WRITER_CHANNEL(value) {
    WriterState.WRITER_CHANNEL = value;
  },
  get releaseWriterReady() {
    return WriterState.releaseWriterReady;
  },
  set releaseWriterReady(value) {
    WriterState.releaseWriterReady = value;
  },
  get releaseWorkspaceLock() {
    return WriterState.releaseWorkspaceLock;
  },
  set releaseWorkspaceLock(value) {
    WriterState.releaseWorkspaceLock = value;
  },
  get WORKSPACE_RESTORED() {
    return WriterState.WORKSPACE_RESTORED;
  },
  set WORKSPACE_RESTORED(value) {
    WriterState.WORKSPACE_RESTORED = value;
  },
});
