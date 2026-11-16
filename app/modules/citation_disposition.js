/* An initial citation can resolve the case without recording correction or a repair deadline. */
export const CITATION_ONLY = "initial-citation-only";
export const citationOnlyItem = (item) => item?.dueExempt === CITATION_ONLY;
// Omit the repair column only when it has no dates or other outcomes to communicate.
export const citationOnlyUndated = (d) =>
  ["notice", "citation"].includes(d?.type) &&
  !d.fromReinspId &&
  d.importInspection?.type === "initial" &&
  !!d.items?.length &&
  d.items.every((item) => citationOnlyItem(item) && !item.due && !item.done && !item.doneOn);
export const canChooseCitationOnly = (d, item) =>
  !!d?.draft &&
  d.type === "notice" &&
  !d.correction &&
  !d.pendingAmendment &&
  !d.fromReinspId &&
  !!d.importRule?.cite &&
  d.importInspection?.type === "initial" &&
  !!item?.cite &&
  !item.done &&
  !item.withdrawn;

export const citationOnlyCarryValid = (res) => !!res?.carried && res.oc === "none" && !res.on && !res.due && !res.cite && !res.note;
export const citationOnlyFollowup = (d) => !!d?.fromDocId && !d.issuanceGroup && !d.initialPreview;
export const citationOnlyClosureRequested = (d) => {
  const live = (d?.items || []).filter((item) => !item.done && !item.withdrawn);
  return live.length > 0 && live.every(citationOnlyItem);
};

export function citationOnlyClosed(d) {
  return (
    !!d &&
    d.type === "citation" &&
    !d.draft &&
    !d.void &&
    !d.superseded &&
    !d.fromReinspId &&
    d.importInspection?.type === "initial" &&
    !!d.issuanceGroup?.noticeId &&
    !!d.issuanceGroup?.citationId &&
    d.fromDocId === d.issuanceGroup.noticeId &&
    citationOnlyClosureRequested(d) &&
    d.items.filter((item) => !item.done && !item.withdrawn).every((item) => item.cite && !item.due)
  );
}

export function citationOnlyFault(d) {
  const flagged = (d.items || []).filter(citationOnlyItem);
  if (!flagged.length) return "";
  const carried = citationOnlyFollowup(d);
  if (!carried && (!["notice", "citation"].includes(d.type) || d.fromReinspId || d.importInspection?.type !== "initial"))
    return "Citation-only disposition is available only on the initial inspection.";
  if (flagged.some((i) => i.due || i.done || i.doneOn || (carried ? i.cite : !i.cite && !i.withdrawn)))
    return "Citation-only items retain a blank due date and are never marked corrected or cited again.";
  return "";
}
