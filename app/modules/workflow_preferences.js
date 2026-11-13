/* Optional device preferences. Retired Workspace filters never hide retained cases. */
import { validISO } from "./calendar.js";

export const WORKFLOW_PREFS_KEY = "madison-workspace-preferences-v1";

export function loadWorkflowPreferences(readStored) {
  const prefs = { reminders: { enabled: false, days: 7, plans: {}, dismissed: [] } };
  try {
    const raw = JSON.parse(readStored() || "null");
    if (raw && typeof raw === "object" && raw.reminders && typeof raw.reminders === "object") {
      const r = raw.reminders;
      prefs.reminders = {
        enabled: r.enabled === true,
        days: Math.min(30, Math.max(1, Number(r.days) || 7)),
        plans: Object.fromEntries(Object.entries(r.plans && typeof r.plans === "object" ? r.plans : {}).filter(([, value]) => validISO(value))),
        dismissed: Array.isArray(r.dismissed) ? r.dismissed.filter((x) => typeof x === "string").slice(-200) : [],
      };
    }
  } catch {
    /* An optional local preference cannot change case records or issued documents. */
  }
  return prefs;
}
