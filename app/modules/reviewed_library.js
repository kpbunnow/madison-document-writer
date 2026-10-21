import { itemLibraryKey } from "./app_core.js";
import { CITATION_POLICY } from "./citation_policy.js";
/* Upgrade mutable working items only; issued snapshots and corrections stay frozen. */
export function initReviewedLibrary() {
  function refresh(d) {
    if (!d?.draft || d.correction || d.pendingAmendment) return;
    for (const item of d.items || []) {
      const key = itemLibraryKey(item),
        review = CITATION_POLICY.libraryCorrections?.[key];
      if (!review) continue;
      item.printedReferences = { ...review.printedReferences };
      if (item.citationReviewApplied === review.date) continue;
      if (JSON.stringify(item.sections || []) === JSON.stringify(review.beforeSections)) {
        item.sections = [...review.afterSections];
        item.citationReviewNotice = "This item's citation was corrected to " + review.afterSections.join(" or ") + " on review against MGO";
        const c = d.cits?.[item.id];
        if (c) {
          c.ord = item.sections.length === 1 ? item.sections[0] : review.beforeSections[0] === item.sections[0] ? c.ord : "";
          c.depositMode = "schedule";
          c.preparedSections = [...item.sections];
          delete c.scheduleEntryId;
          delete c.overrideBasis;
          delete c.tierOverride;
          delete c.tierOverrideSource;
          delete c.chargeStale;
          delete c.differentChargeSource;
        }
      }
      item.citationReviewApplied = review.date;
    }
  }
  return { refresh };
}
