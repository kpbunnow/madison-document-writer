/* Calendar arithmetic preserves the existing UTC-addition and local-noon interval semantics. */
import { recordDay } from "../assets/shared.js";
export const iso = (d) => recordDay(d);

export const addDays = (s, n) => {
  const d = new Date(s + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5);

/* Event ids must survive a merge between two devices, so they are random
   rather than sequential. */
export const nowISO = () => new Date().toISOString();

/* Existing user-entered date/time parsing; no ambient clock or new normalization policy. */
export function validISO(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
  if (!m) return false;
  const d = new Date(s + "T12:00:00Z");
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() + 1 === +m[2] && d.getUTCDate() === +m[3];
}

export function parseDate(v) {
  const s = String(v || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return validISO(s) ? s : null;
  const m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/.exec(s);
  if (!m) return null;
  let y = +m[3];
  if (y < 100) y += 2000;
  const mo = +m[1],
    da = +m[2];
  if (mo < 1 || mo > 12 || da < 1 || da > 31 || y < 1900 || y > 2200) return null;
  const out = y + "-" + String(mo).padStart(2, "0") + "-" + String(da).padStart(2, "0");
  return validISO(out) ? out : null;
}

export function parseTime(v) {
  const m = /^(\d{1,2}):(\d{2})(?::([0-5]\d)(?:\.\d+)?)?\s*([AaPp](?:[Mm])?)?$/.exec(String(v || "").trim());
  if (!m) return null;
  let h = +m[1];
  const mi = +m[2],
    ap = (m[4] || "").slice(0, 1).toLowerCase();
  if (ap && (h < 1 || h > 12)) return null;
  if (ap === "p" && h < 12) h += 12;
  if (ap === "a" && h === 12) h = 0;
  if (h > 23 || mi > 59) return null;
  return String(h).padStart(2, "0") + ":" + String(mi).padStart(2, "0");
}
