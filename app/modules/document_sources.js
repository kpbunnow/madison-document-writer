import { kase, docCase, docInsp } from "./writer_queries.js";
import { simpleVacancy, simplifiedBestInterest, frozenOf } from "./document_rules.js";
import { BLOCKS, CIT_COPIES, CIT_INSTRUCTIONS, COURT, COURT_CONTACT, EXTERIOR_WORK } from "./document_types.js";
import { CITATION_POLICY } from "./citation_policy.js";
import { clone } from "./record_values.js";
import { nowISO } from "./calendar.js";

export function createDocumentSources(services) {
  function activeBlocks(d) {
    if (services.snow.is(d) && d.authoringVersion >= 9) return ["LANGUAGE"];
    // the division's follow-up documents carry none of these
    if (d.type !== "notice" && !services.initialOrderCitation(d)) return [];
    const k = kase(d.caseId),
      set = new Set();
    Object.keys(BLOCKS).forEach((b) => {
      if (BLOCKS[b].always) set.add(b);
    });
    if (d.items.some((i) => /permit|repair|replace/i.test(i.text))) set.add("PERMIT_500");
    // Preserve Historic District wording; omit unsupplied optional Landmark wording.
    const exterior = d.items.some((i) => EXTERIOR_WORK.test(i.text));
    if (k.historic && exterior) set.add("LANDMARKS");
    if (String(k.landmark || "").trim() && exterior && String((BLOCKS.LANDMARK || {}).text || "").trim()) set.add("LANDMARK");
    return [...set];
  }

  function freezeSources(d) {
    return {
      ...(services.snow.is(d) ? services.snow.freeze(d) : {}),
      case: clone(docCase(d)),
      inspector: clone(docInsp(d)),
      body: services.docBody(d),
      // Authoring-15+ Best Interest and authoring-16 Vacancy Extensions have no signer or division review.
      ...(d.special && !simplifiedBestInterest(d) && !simpleVacancy(d)
        ? {
            documentPolicyVersion: 26,
            authorizedSigner: { name: d.special.signerName, title: d.special.signerTitle, delegation: d.special.delegation },
            divisionReview: { by: d.special.reviewer, at: d.special.reviewDateLegal, reference: d.special.reviewRef },
          }
        : {}),
      blocks: clone(services.docBlocks(d)),
      court: {
        ...clone((frozenOf(d) || {}).court || COURT),
        ...(d.authoringVersion >= 9 ? { room: "RM#203,", caseNumberLabel: CITATION_POLICY.mc2000CaseNumberLabel } : {}),
      },
      courtCopies: clone((frozenOf(d) || {}).courtCopies || CIT_COPIES),
      courtInstructions: (frozenOf(d) || {}).courtInstructions || CIT_INSTRUCTIONS,
      courtContact: clone((frozenOf(d) || {}).courtContact || COURT_CONTACT),
      at: nowISO(),
    };
  }
  return { activeBlocks, freezeSources };
}
