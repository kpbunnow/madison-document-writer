/* Reports formatting and filter facts load independently of startup and storage. */
import { ReportsState } from "./state.js";
import { recordDay } from "../assets/shared.js";
export const iso = (d) => recordDay(d);
export const validISO = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ""))) return false;
  const d = new Date(s + "T12:00:00Z");
  return !isNaN(d) && iso(d) === s;
};
export const fmtDate = (s) => (validISO(s) ? s.slice(5, 7) + "/" + s.slice(8, 10) + "/" + s.slice(0, 4) : "—");
export const fmtNum = (n) => (n == null || isNaN(n) ? "—" : Number(n).toLocaleString("en-US"));
export const fmtDays = (n) => (n == null || isNaN(n) ? "—" : (Math.round(n * 10) / 10).toLocaleString("en-US", { maximumFractionDigits: 1 }));
export const fmtMoney = (n) =>
  n == null || isNaN(n) ? "—" : "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const plural = (n, w, p) => fmtNum(n) + " " + (n === 1 ? w : p || w + "s");
export const uniq = (a) => Array.from(new Set(a));
export const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
export const ownerKeyLabel = (k) => (k ? k.replace("|", ", ") : "No usable mailing address");
export const areaLabel = (k, F) => (!k ? "Unlocated" : (F || ReportsState.S.F).areaType === "zip" ? k : "District " + k);
export const inPeriod = (d, F) => validISO(d) && d >= F.from && d <= F.to;
export const violOk = (v, F) => (!F.vtype || v.type === F.vtype) && (!F.ord || v.sections.indexOf(F.ord) >= 0);

export function openAt(c, date, history) {
  return c.caseType === "snow-10.28"
    ? c.documents.some((d) => d.type === "citation" && history.versionAt(d, date)) && (!c.closedOn || c.closedOn > date)
    : history.noticeAt(c, date) && !["Closed", "Withdrawn"].includes(history.statusAt(c, date));
}
