import { docsFor } from "./writer_queries.js";
import { validISO, iso } from "./calendar.js";
import { recordDay } from "../assets/shared.js";

export function createCitationHistory(services) {
  function priorCitations(caseId, no) {
    let n = 0;
    const now = new Date(recordDay(services.today) + "T12:00:00"),
      cutoff = iso(
        new Date(
          now.getFullYear() - 1,
          now.getMonth(),
          Math.min(now.getDate(), new Date(now.getFullYear() - 1, now.getMonth() + 1, 0).getDate()),
          12,
        ),
      );
    docsFor(caseId).forEach((x) => {
      if (x.draft || x.void || x.superseded || x.type !== "citation") return;
      const date = (x.revision && (x.revision.actionDate || x.revision.originalIssued)) || x.mailed || recordDay(x.issuedAt);
      if (!validISO(date) || date < cutoff || date > recordDay(services.today)) return;
      if (x.items.some((i) => String(i.no) === String(no) && i.cite && !i.withdrawn)) n++;
    });
    return n;
  }
  return { priorCitations };
}
