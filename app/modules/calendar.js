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
