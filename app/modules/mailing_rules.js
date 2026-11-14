// @ts-check
/* Mailing facts and organization/state classification; normalization and acceptance retain their owners. */
/** @typedef {import("./contracts.js").MailingCase} MailingCase */
/** @typedef {import("./contracts.js").MailingContact} MailingContact */
/* A date that does not read as a real calendar day has to be rejected
   rather than compared: every comparison against NaN is false, so an
   unreadable value otherwise satisfies every bound it is checked against.
   February 31st is shaped like a date and is not one. */
/* ---------- the mailing block ----------
   First line is the defendant, the rest is the address. A second owner name
   on line two is part of the address as the division writes it, so it is not
   treated specially. Blank lines are dropped so a stray return cannot shunt
   the name out of the defendant field or leave a hole in the address. */
/** @param {MailingCase} k @returns {string[]} */
export const ownerLines = (k) =>
  [k.owner]
    .concat(k.ownerAddr || [])
    .map((x) => String(x || "").trim())
    .filter(Boolean);

/* The Accela report can repeat a mailing line, most often the street line of a three- or four-line owner address.
   Compared without case, spacing, periods or commas, a line that repeats the line before it prints once, and a street
   or PO Box line prints once wherever it repeats. Distinct names, care-of and unit lines stay, even when a unit line
   recurs later. The raw case fact is unchanged. Mirrored by _clean_owner_address in helper/case_store.py. */
/** @param {string} line */
const mailingLineKey = (line) =>
  line
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .replace(/^P ?O ?BOX\b/, "PO BOX");
const STREET_LINE = /^(\d|PO BOX\b)/;
const NUMBERED_UNIT = /^\d+(?:ST|ND|RD|TH)?\s+(?:FLOOR|FL|FLR|UNIT|APT|APARTMENT|SUITE|STE|ROOM|RM)\b/;
/** @param {string[]|string|undefined} lines @returns {string[]} */
export function cleanOwnerAddress(lines) {
  /** @type {Set<string>} */
  const streets = new Set();
  let previous = "";
  // A legacy scalar is one line, as [].concat(lines) always treated it.
  return (Array.isArray(lines) ? lines : lines ? [lines] : [])
    .map((x) => String(x || "").trim())
    .filter((line) => {
      const key = mailingLineKey(line),
        street = STREET_LINE.test(key) && !NUMBERED_UNIT.test(key),
        repeated = !key || key === previous || (street && streets.has(key));
      previous = key || previous;
      if (street) streets.add(key);
      return !repeated;
    });
}
/** @param {MailingCase} k @returns {string[]} */
export const cleanOwnerLines = (k) => [String(k.owner || "").trim(), ...cleanOwnerAddress(k.ownerAddr)].filter(Boolean);

/* ---------- who else hears about this case ----------
   A carbon copy, an email recipient and a registered agent are all facts about
   the property rather than about one letter, so they are held on the case and
   appear on everything written afterwards. */
export const EMAIL_KINDS = ["Property Owner", "Tenant", "Agent", "Other"];

/** @param {MailingCase|null|undefined} k @returns {(MailingContact|null)[]} */
export const ccList = (k) => (k && k.ccList) || [];

/* ---------- the Violator ----------
   One contact on the copies list can be marked Violator. It is not a copy: it takes the owner's place as the main
   contact in the mailing block and as the defendant on citations. Snow removal cases cite the property owner, so a
   Violator is ignored there. The property owner is also copied unless the case says otherwise. */
export const VIOLATOR = "Violator";
const SNOW_CASE = "snow-10.28";
/** @param {MailingCase|null|undefined} k @returns {MailingContact|null} */
export const violatorOf = (k) => ccList(k).find((c) => c && c.kind === VIOLATOR) || null;
/** @param {MailingCase|null|undefined} k @returns {(MailingContact|null)[]} */
export const copiesOf = (k) => ccList(k).filter((c) => !(c && c.kind === VIOLATOR));
/** @param {MailingCase|null|undefined} k */
export const violatorActive = (k) => !!violatorOf(k) && !!k && k.caseType !== SNOW_CASE;
/** @param {MailingCase|null|undefined} k */
export const copiesOwner = (k) => !k || k.copyOwner !== false;
/* Marking a contact Violator makes it the only one; the earlier Violator becomes an ordinary copy. */
/** @param {MailingCase} k @param {number} ix @param {string} kind */
export function setCopyKind(k, ix, kind) {
  const list = ccList(k),
    target = list[ix];
  if (!target) return;
  if (kind === VIOLATOR)
    list.forEach((c, n) => {
      if (n !== ix && c && c.kind === VIOLATOR) c.kind = "Copy";
    });
  target.kind = kind === VIOLATOR ? VIOLATOR : "Copy";
}
/* The name a citation or notice is addressed to. */
/** @param {MailingCase|null|undefined} k */
export function defendantName(k) {
  // violatorActive implies a Violator exists; reading it once lets the checker see that.
  const violator = violatorActive(k) ? violatorOf(k) : null;
  return String((violator ? violator.name : k && k.owner) || "").trim();
}

/** @param {MailingCase|null|undefined} k @returns {import("./contracts.js").EmailRecipient[]} */
export const emailList = (k) => (k && k.emails) || [];

export const US_STATES = new Set(
  (
    "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS " +
    "MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV " +
    "WI WY DC"
  ).split(" "),
);

export const STATE_NAMES = Object.fromEntries(
  (
    "Alabama:AL|Alaska:AK|Arizona:AZ|Arkansas:AR|California:CA|Colorado:CO|Co" +
    "nnecticut:CT|Delaware:DE|Florida:FL|Georgia:GA|Hawaii:HI|Idaho:ID|Illino" +
    "is:IL|Indiana:IN|Iowa:IA|Kansas:KS|Kentucky:KY|Louisiana:LA|Maine:ME|Mar" +
    "yland:MD|Massachusetts:MA|Michigan:MI|Minnesota:MN|Mississippi:MS|Missou" +
    "ri:MO|Montana:MT|Nebraska:NE|Nevada:NV|New Hampshire:NH|New Jersey:NJ|Ne" +
    "w Mexico:NM|New York:NY|North Carolina:NC|North Dakota:ND|Ohio:OH|Oklaho" +
    "ma:OK|Oregon:OR|Pennsylvania:PA|Rhode Island:RI|South Carolina:SC|South " +
    "Dakota:SD|Tennessee:TN|Texas:TX|Utah:UT|Vermont:VT|Virginia:VA|Washingto" +
    "n:WA|West Virginia:WV|Wisconsin:WI|Wyoming:WY|District of Columbia:DC"
  )
    .split("|")
    .map((x) => {
      const [name, abbr] = x.split(":");
      return [name.toLowerCase(), abbr];
    }),
);

/* Wisconsin requires a registered agent for service on a limited liability
   company, so a citation against one cannot go out without it. */
/** @param {MailingCase|null|undefined} k */
export const isLLC = (k) => /\b(LLC|L\.L\.C|LLP|L\.L\.P|INC|INCORPORATED|CORP|CORPORATION|LTD)\b/i.test(defendantName(k));

/** @param {unknown} text @returns {{owner:string,addr:string[]}} */
export function splitOwner(text) {
  const ls = String(text || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  return { owner: ls[0] || "", addr: ls.slice(1) };
}
