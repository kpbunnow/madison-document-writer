/* An initial citation can resolve the case without recording correction or a repair deadline. */
export const CITATION_ONLY = "initial-citation-only";
export const citationOnlyItem = (item) => item?.dueExempt === CITATION_ONLY;
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

export function citationOnlyClosed(d) {
  const live = (d?.items || []).filter((item) => !item.done && !item.withdrawn);
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
    live.length > 0 &&
    live.every((item) => citationOnlyItem(item) && item.cite && !item.due)
  );
}

export function citationOnlyFault(d) {
  const flagged = (d.items || []).filter(citationOnlyItem);
  if (!flagged.length) return "";
  if (!["notice", "citation"].includes(d.type) || d.fromReinspId || d.importInspection?.type !== "initial")
    return "Citation-only closure is available only on the initial inspection.";
  if (flagged.some((i) => i.due || i.done || (!i.cite && !i.withdrawn)))
    return "Citation-only items need a citation and a blank due date; they are not marked corrected.";
  if (d.items.some((i) => !i.done && !i.withdrawn && !citationOnlyItem(i)))
    return "Citation-only closure must cover every remaining violation before the case can close.";
  return "";
}
