/* Text/selector formatting only. Escaping and fill-in markup preserve the issued rendering contract. */
export const money = (n) => (Math.round((+n || 0) * 100) / 100).toFixed(2);

/* unsaved work exists that is not in any exported file */
/* ---------- helpers ---------- */
export const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const nl2 = (s) => esc(s).replace(/\n/g, "<br>");

// the city's fill-in convention is a literal "( )" in the corrective action
const BLANK = /\(\s{0,8}\)/g;

export const countBlanks = (s) => (String(s).match(BLANK) || []).length;

export const markBlanks = (s) => nl2(s).replace(/\(\s{0,8}\)/g, '<span class="blank" role="img" aria-label="fill-in bubble"></span>');

export const editableBlanks = (s) =>
  esc(s).replace(
    /\(\s{0,8}\)/g,
    '<span class="blank blank-edit" contenteditable="false" role="button" tabindex="0" aria-label="Fill in missing text" title="Click to fill in missing text">( )</span>',
  );

/* What kind of violation an item is: its library entry when it carries one;
   for items written before that, the one library entry with the same title
   and the same sections; otherwise its first ordinance section. */
export const moneyNum = (v) => {
  const n = parseFloat(String(v == null ? "" : v).replace(/[^0-9.]/g, ""));
  return isNaN(n) ? null : n;
};

export const validMoney = (v) => v !== "" && v !== null && v !== undefined && /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(String(v)) && Number.isFinite(+v);

/* R13 check destinations are data, shared by the review links and field highlights. */
export const checkTarget = (selector, label, action = "") => ({ selector, label, action });

export const checkAttr = (value) => String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

export const itemSelector = (id, field) => '[data-id="' + checkAttr(id) + '"][data-field="' + field + '"]';

export const citSelector = (id, field) => '[data-review-cit="' + checkAttr(id) + "|" + field + '"]';

/* ---------- reinspection worksheet ----------
   The inspector is not writing from a blank page. They are standing at the
   property with the notice they already issued, walking its numbered list.
   The notice itself is closed to edits from here on — the owner has it. */
/* A due date is the inspector's judgement, so the check flags rather than
   blocks: it must be in the future, and unusually tight or long windows
   are worth a second look. */
/* ---------- writer: the document is the editor ---------- */
/* the whole printable document: the notice, then one page per citation copy */
/* ---------- Wisconsin Uniform Municipal Court Citation (MC-2000) ----------
   The four copies differ: agency and inspector carry a disposition record,
   the defendant's carries the plea instructions instead of the narrative.
   Facsimile of the form on file — confirm against the court's own stock
   before this is used to produce a filed citation. */
export const BOXY = "&#9744;",
  BOXN = "&#9746;";

export function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s + "T12:00:00Z");
  return String(d.getUTCMonth() + 1).padStart(2, "0") + "/" + String(d.getUTCDate()).padStart(2, "0") + "/" + d.getUTCFullYear();
}

export function longDate(v) {
  if (!v) return "";
  const p = String(v).split("-");
  if (p.length < 3) return fmtDate(v);
  const dt = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12));
  const D = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const M = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return D[dt.getUTCDay()] + ", " + M[dt.getUTCMonth()] + " " + dt.getUTCDate() + ", " + dt.getUTCFullYear();
}

export function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return (h % 12 === 0 ? 12 : h % 12) + ":" + String(m).padStart(2, "0") + " " + (h >= 12 ? "PM" : "AM");
}
