/* exported validCaseNumber, caseNumberKey, mailingMaxDay, mailingDateMessage */
/* ---------- shared with the reports page ----------
   Injected by build.py into both madison-document-writer.html and
   madison-reports.html at the SHARED placeholder. Anything both pages must agree on
   lives here and nowhere else. */

/* Bumped whenever the shape of a case summary changes. A summary written
   under an older version is reported as stale until the index is rebuilt. */
const SUMMARY_VERSION = 6;
/* Notices/follow-ups may be scheduled five City calendar days ahead.
   Citations may not be future-mailed; their issue date equals mailing date.
   build.py exports this single policy to the helper's calendar_policy.json. */
const MAILED_MAX_DAYS_AHEAD = 5;
const CITATION_MAX_DAYS_AHEAD = 0;
const validCaseNumber = (value) => typeof value === "string" && /^[A-Za-z0-9-]{3,80}$/.test(value);
const caseNumberKey = (value) =>
  typeof value === "string" && value.trim() && value.trim().length <= 80 && !/[\x00-\x1f\x7f]/.test(value)
    ? value
        .replace(/[\\/:*?"<>|]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase()
    : "";
function mailingMaxDay(type, day = recordDay(new Date())) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + (type === "citation" ? CITATION_MAX_DAYS_AHEAD : MAILED_MAX_DAYS_AHEAD));
  return d.toISOString().slice(0, 10);
}
function mailingDateMessage(type) {
  const days = type === "citation" ? CITATION_MAX_DAYS_AHEAD : MAILED_MAX_DAYS_AHEAD;
  return (
    (type === "citation" ? "The citation mailing date" : "The mailing date") +
    " must be on or after the inspection and " +
    (days === 0 ? "no later than today." : "no more than " + (days === 5 ? "five" : days) + " " + (days === 1 ? "day" : "days") + " ahead.")
  );
}

/* The folder, inside the case folder, that holds one summary per case. */
const SUMMARY_DIR = "Reporting Index";

/* A parcel as the city's parcel layer keys it: exactly 12 digits, no dashes.
   Anything else is not a parcel number and returns ''. */
function normParcel(p) {
  const d = String(p == null ? "" : p).replace(/[\s-]/g, "");
  return /^\d{12}$/.test(d) ? d : "";
}

/* Audit instants stay UTC; record-effective days follow the City's civil day,
   including daylight saving time. Never truncate a UTC timestamp for a day. */
const recordDayFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" });
function recordDay(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = recordDayFormatter.formatToParts(date);
  const get = (key) => (parts.find((p) => p.type === key) || {}).value || "";
  return get("year") + "-" + get("month") + "-" + get("day");
}

/* RFC 4180 with spreadsheet formula neutralization for textual values. */
function csvText(rows) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => {
            let text = String(value ?? "");
            if (typeof value !== "number" && /^[\s]*[=+\-@]/.test(text)) text = "'" + text;
            return '"' + text.replace(/"/g, '""') + '"';
          })
          .join(","),
      )
      .join("\r\n") +
    "\r\n"
  );
}
function downloadText(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type })),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export {
  SUMMARY_VERSION,
  MAILED_MAX_DAYS_AHEAD,
  CITATION_MAX_DAYS_AHEAD,
  validCaseNumber,
  caseNumberKey,
  mailingMaxDay,
  mailingDateMessage,
  SUMMARY_DIR,
  normParcel,
  recordDay,
  csvText,
  downloadText,
};
