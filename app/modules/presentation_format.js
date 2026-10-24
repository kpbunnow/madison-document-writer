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
    '<span class="blank blank-edit" contenteditable="false" role="button" tab' +
      'index="0" aria-label="Fill in missing text" title="Click to fill in miss' +
      'ing text">( )</span>',
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
