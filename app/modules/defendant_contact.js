/* Who a document or citation is addressed to: the Violator when one is set on the case, otherwise the property owner. */
import { ccLines } from "./address_format.js";
import { ownerLines, violatorActive, violatorOf, copiesOwner } from "./mailing_rules.js";

/* Mailing block and citation defendant lines: name first, then the address. Drafts show standardized lines. */
export const defendantLines = (k, normalize = true) => (violatorActive(k) ? ccLines(violatorOf(k), normalize) : ownerLines(k));

/* The property owner printed as a copy beside a Violator, unless the case turns that off. */
export const ownerCopy = (k) => (violatorActive(k) && copiesOwner(k) && ownerLines(k).length ? { lines: ownerLines(k), owner: true } : null);
