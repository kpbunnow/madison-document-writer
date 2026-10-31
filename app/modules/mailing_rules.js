/* Mailing facts and organization/state classification; normalization and acceptance retain their owners. */
/* A date that does not read as a real calendar day has to be rejected
   rather than compared: every comparison against NaN is false, so an
   unreadable value otherwise satisfies every bound it is checked against.
   February 31st is shaped like a date and is not one. */
/* ---------- the mailing block ----------
   First line is the defendant, the rest is the address. A second owner name
   on line two is part of the address as the division writes it, so it is not
   treated specially. Blank lines are dropped so a stray return cannot shunt
   the name out of the defendant field or leave a hole in the address. */
export const ownerLines = (k) =>
  [k.owner]
    .concat(k.ownerAddr || [])
    .map((x) => String(x || "").trim())
    .filter(Boolean);

/* ---------- who else hears about this case ----------
   A carbon copy, an email recipient and a registered agent are all facts about
   the property rather than about one letter, so they are held on the case and
   appear on everything written afterwards. */
export const EMAIL_KINDS = ["Property Owner", "Tenant", "Agent", "Other"];

export const ccList = (k) => (k && k.ccList) || [];

/* ---------- the Violator ----------
   One contact on the copies list can be marked Violator. It is not a copy: it takes the owner's place as the main
   contact in the mailing block and as the defendant on citations. Snow removal cases cite the property owner, so a
   Violator is ignored there. The property owner is also copied unless the case says otherwise. */
export const VIOLATOR = "Violator";
const SNOW_CASE = "snow-10.28";
export const violatorOf = (k) => ccList(k).find((c) => c && c.kind === VIOLATOR) || null;
export const copiesOf = (k) => ccList(k).filter((c) => !(c && c.kind === VIOLATOR));
export const violatorActive = (k) => !!violatorOf(k) && !!k && k.caseType !== SNOW_CASE;
export const copiesOwner = (k) => !k || k.copyOwner !== false;
/* Marking a contact Violator makes it the only one; the earlier Violator becomes an ordinary copy. */
export function setCopyKind(k, ix, kind) {
  const list = ccList(k);
  if (!list[ix]) return;
  if (kind === VIOLATOR)
    list.forEach((c, n) => {
      if (n !== ix && c && c.kind === VIOLATOR) c.kind = "Copy";
    });
  list[ix].kind = kind === VIOLATOR ? VIOLATOR : "Copy";
}
/* The name a citation or notice is addressed to. */
export const defendantName = (k) => String((violatorActive(k) ? violatorOf(k).name : k && k.owner) || "").trim();

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
export const isLLC = (k) => /\b(LLC|L\.L\.C|LLP|L\.L\.P|INC|INCORPORATED|CORP|CORPORATION|LTD)\b/i.test(defendantName(k));

export function splitOwner(text) {
  const ls = String(text || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  return { owner: ls[0] || "", addr: ls.slice(1) };
}
