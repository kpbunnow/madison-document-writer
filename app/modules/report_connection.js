/* Reports observes the existing scoped helper-stop protocol; it never stops the helper. */
import { listenForStop, showStopped } from "./helper_stopped.js";
export function listenForReportStop() {
  return listenForStop(() =>
    showStopped(["Exit Document Writer was used in a Writer window. Reports cannot read case records until Document Writer starts again."]),
  );
}
