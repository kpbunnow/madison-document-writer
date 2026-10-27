import { STATE_NAMES, US_STATES } from "./mailing_rules.js";

function postalTitle(word) {
  if (/^[A-Z][a-z].*[A-Z]/.test(word)) return word; // keep intentional spelling such as McFarland
  return word.toLowerCase().replace(/(^|[-'’])([a-z])/g, (_, edge, letter) => edge + letter.toUpperCase());
}

export function standardStreetAddress(value) {
  const raw = String(value || "")
    .trim()
    .replace(/\s+/g, " ");
  const street = raw.replace(/,\s*(?=(?:apt|apartment|ste|suite|unit|fl|floor|rm|room)\b|#)/gi, " ");
  const match = street.match(/^(\d+[A-Za-z]?(?:[-/]\d+[A-Za-z]?)?)\s+(.+)$/);
  if (!match || street.includes(",") || !/[A-Za-z]/.test(match[2]) || /\bP\.?\s*O\.?\s+BOX\b/i.test(street)) return "";
  const suffix = {
    street: "St",
    st: "St",
    avenue: "Ave",
    ave: "Ave",
    boulevard: "Blvd",
    blvd: "Blvd",
    road: "Rd",
    rd: "Rd",
    drive: "Dr",
    dr: "Dr",
    lane: "Ln",
    ln: "Ln",
    court: "Ct",
    ct: "Ct",
    circle: "Cir",
    cir: "Cir",
    parkway: "Pkwy",
    pkwy: "Pkwy",
    place: "Pl",
    pl: "Pl",
    terrace: "Ter",
    ter: "Ter",
    highway: "Hwy",
    hwy: "Hwy",
    apartment: "Apt",
    apt: "Apt",
    suite: "Ste",
    ste: "Ste",
    floor: "Fl",
    fl: "Fl",
    room: "Rm",
    rm: "Rm",
    unit: "Unit",
  };
  const directionWords = { north: "N", south: "S", east: "E", west: "W", northeast: "NE", northwest: "NW", southeast: "SE", southwest: "SW" };
  const directions = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]);
  const parts = street.split(" ");
  const formatted = parts
    .map((part, index) => {
      if (index === 0) return part.toUpperCase();
      const bare = part.replace(/\.$/, "");
      const key = bare.toLowerCase();
      if (directionWords[key]) return directionWords[key];
      if (directions.has(bare.toUpperCase())) return bare.toUpperCase();
      return suffix[key] || postalTitle(bare);
    })
    .join(" ");
  return formatted;
}

export function standardCityStateZip(value) {
  const raw = String(value || "")
    .trim()
    .replace(/\s+/g, " ");
  const zipMatch = raw.match(/^(.*?)[,\s]+(\d{5}(?:-?\d{4})?)$/);
  if (!zipMatch) return "";
  const area = zipMatch[1].replace(/,\s*$/, "").trim(),
    zip = zipMatch[2].replace(/^(\d{5})(\d{4})$/, "$1-$2");
  // Prefer the longest complete state name; no partial suffix matches.
  const states = Object.entries(STATE_NAMES)
    .sort((a, b) => b[0].length - a[0].length)
    .concat(Array.from(US_STATES, (x) => [x.toLowerCase(), x]));
  let city = "",
    state = "";
  for (const [name, abbr] of states) {
    const suffix = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = area.match(new RegExp("^(.+?)(?:,\\s*|\\s+)(" + suffix + ")$", "i"));
    if (match) {
      city = match[1].trim();
      state = abbr;
      break;
    }
  }
  if (!state || !city || !/^[A-Za-z][A-Za-z .'-]*$/.test(city)) return "";
  return (
    city
      .split(/(\s+|[-'])/)
      .map((part) => (/^[A-Za-z]/.test(part) ? postalTitle(part) : part))
      .join("") +
    ", " +
    state +
    " " +
    zip
  );
}

export function addressProblem(name, street, city) {
  if (!String(name || "").trim()) return "Enter the recipient name.";
  if (!standardStreetAddress(street)) return "Enter a street address with a street number and name (for example, 123 Main St).";
  if (!standardCityStateZip(city))
    return (
      "Enter city, a complete state name or two-letter abbreviation, and ZIP (f" +
      "or example, Madison, WI 53703). Check ambiguous or unsupported state tex" +
      "t."
    );
  return "";
}
