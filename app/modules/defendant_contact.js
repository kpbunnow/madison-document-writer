// @ts-check
/* Who a document or citation is addressed to: the Violator when one is set on the case, otherwise the property owner. */
import { ccLines } from "./address_format.js";
import { cleanOwnerLines, ownerLines, violatorActive, violatorOf, copiesOwner } from "./mailing_rules.js";
/** @typedef {import("./contracts.js").MailingCase} MailingCase */

/* Mailing block and citation defendant lines: name first, then the address. Drafts show standardized lines and print
   a repeated owner address line once; an issued document prints its retained owner lines, or its original lines. */
/** @param {MailingCase} k @param {string[]} [retained] @returns {string[]} */
export function defendantLines(k, normalize = true, retained = undefined) {
  // violatorActive implies a Violator exists; reading it once lets the checker see that.
  const violator = violatorActive(k) ? violatorOf(k) : null;
  return violator ? ccLines(violator, normalize) : normalize ? cleanOwnerLines(k) : retained || ownerLines(k);
}

/* The property owner printed as a copy beside a Violator, unless the case turns that off. */
/** @param {MailingCase} k @param {string[]} [lines] @returns {{lines:string[],owner:true}|null} */
export function ownerCopy(k, lines) {
  if (!violatorActive(k) || !copiesOwner(k)) return null;
  const printed = lines === undefined ? ownerLines(k) : lines;
  return printed.length ? { lines: printed, owner: true } : null;
}

/* The owner's lines as a new draft prints them in the mailing block, citation and CC. */
export const cleanOwnerCopyLines = cleanOwnerLines;

/* The owner's printed lines when they differ from the raw case lines (a repeated report line removed), else null.
   Issued documents retain them as frozen.ownerMailingLines; the raw case facts stay intact. */
/** @param {MailingCase} k @returns {string[]|null} */
export function ownerMailingLines(k) {
  const clean = cleanOwnerLines(k);
  return JSON.stringify(clean) === JSON.stringify(ownerLines(k)) ? null : clean;
}
