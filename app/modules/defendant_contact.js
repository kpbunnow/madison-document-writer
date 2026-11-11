/* Who a document or citation is addressed to: the Violator when one is set on the case, otherwise the property owner. */
import { ccLines } from "./address_format.js";
import { ownerLines, violatorActive, violatorOf, copiesOwner } from "./mailing_rules.js";

/* Mailing block and citation defendant lines: name first, then the address. Drafts show standardized lines. */
export const defendantLines = (k, normalize = true) => (violatorActive(k) ? ccLines(violatorOf(k), normalize) : ownerLines(k));

/* The property owner printed as a copy beside a Violator, unless the case turns that off. */
export function ownerCopy(k, lines) {
  if (!violatorActive(k) || !copiesOwner(k)) return null;
  const printed = lines === undefined ? ownerLines(k) : lines;
  return printed.length ? { lines: printed, owner: true } : null;
}

/* Keep distinct address details, including second owner/care-of/unit lines. The report can repeat a mailing line;
   collapse only consecutive duplicates in the address, never the separate owner name. Raw case facts stay intact. */
export function cleanOwnerCopyLines(k) {
  const address = []
    .concat(k.ownerAddr || [])
    .map((line) => String(line || "").trim())
    .filter(Boolean);
  const key = (line) => line.replace(/\s+/g, " ").toUpperCase();
  return [String(k.owner || "").trim(), ...address.filter((line, n) => !n || key(line) !== key(address[n - 1]))].filter(Boolean);
}
