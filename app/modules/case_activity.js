import { workspaceState as workspace } from "./workspace_state.js";
/* Read-only case activity and personal reminders; explicit lazy presentation/query adapters. */
import { recordDay } from "../assets/shared.js";
import { addDays } from "./calendar.js";
import { distinctDues, dueItems } from "./document_rules.js";
import { esc as dep_esc } from "./presentation_format.js";
import { kase, eventsFor } from "./writer_queries.js";
import { html, raw } from "./screen_html.js";

export function timelineCategory(type) {
  return type.endsWith(".issued")
    ? type === "correction.issued"
      ? "corrected"
      : "issued"
    : type.includes("withdraw")
      ? "withdrawn"
      : type.includes("filed")
        ? "filed"
        : type.includes("record")
          ? "recorded"
          : "other";
}

export function createCaseActivity(services) {
  function remindersDue() {
    const prefs = workspace.WORKFLOW_PREFS.reminders,
      day = recordDay(services.today),
      end = addDays(day, prefs.days);
    if (!prefs.enabled) return [];
    const rows = [];
    for (const k of workspace.CASES) {
      const st = services.caseState(k);
      if (st.closed || !services.sourceDocFor(k.id)) continue;
      const dates = distinctDues(dueItems(services.sourceDocFor(k.id)));
      for (const date of dates) if (date >= day && date <= end) rows.push({ cid: k.id, kind: "Compliance due", date });
      const plan = prefs.plans[k.id];
      if (plan && plan >= day && plan <= end) rows.push({ cid: k.id, kind: "Reinspection planned", date: plan });
    }
    return rows.map((row) => ({ ...row, id: [day, row.cid, row.kind, row.date].join("|") })).filter((row) => !prefs.dismissed.includes(row.id));
  }

  function remindersPanel() {
    const rows = remindersDue();
    return !rows.length
      ? ""
      : html`<section class="card" aria-labelledby="reminders-title"><h2 id="reminders-title">Upcoming reminders</h2><ul>${raw(
          "".concat(
            rows
              .map(
                (row) =>
                  html`<li>${kase(row.cid).number} · ${row.kind} · ${raw(services.fmtDate(row.date))} <button class="btn btn-sm" data-reminder-draft="${row.id}">Email draft</button> <button class="btn btn-sm" data-reminder-dismiss="${row.id}">Dismiss for today</button></li>`,
              )
              .join(""),
          ),
        )}</ul></section>`;
  }

  function showReminders() {
    services.navigation.utilityContext();
    const prefs = workspace.WORKFLOW_PREFS.reminders;
    services.A11Y.utility(
      "Optional reminders",
      html`<p>Reminders appear when you open this workspace. Email drafts open only when requested, for you to review and send.</p><form id="reminder-settings"><label><input name="enabled" type="checkbox" ${raw(prefs.enabled ? "checked" : "")}> Show upcoming due dates and planned reinspections</label><label>Days ahead <input name="days" type="number" min="1" max="30" value="${raw(prefs.days)}" required></label><table><caption>Personal reinspection plans in this browser profile</caption><thead><tr><th scope="col">Case</th><th scope="col">Planned date</th></tr></thead><tbody>${raw(
        "".concat(
          workspace.CASES.filter((k) => !services.caseState(k).closed)
            .map(
              (k) =>
                '<tr><th scope="row">' +
                `${dep_esc(k.number)}` +
                '</th><td><input type="date" name="plan:' +
                `${dep_esc(k.id)}` +
                '" aria-label="Planned reinspection for ' +
                `${dep_esc(k.number)}` +
                '" value="' +
                `${dep_esc(prefs.plans[k.id] || "")}` +
                '"></td></tr>',
            )
            .join(""),
        ),
      )}</tbody></table><button class="btn" type="submit">Save reminder preferences</button></form>`,
    );
  }

  function showReminderDraft(id) {
    services.navigation.utilityContext();
    const row = remindersDue().find((r) => r.id === id);
    if (!row) return;
    const k = kase(row.cid),
      subject = row.kind + " — " + k.number,
      body =
        "Case " +
        k.number +
        "\nProperty: " +
        k.address +
        "\n" +
        row.kind +
        ": " +
        services.fmtDate(row.date) +
        "\n\nPlease contact Building Inspection with any questions.";
    services.A11Y.utility(
      "Review reminder email draft",
      html`<form id="reminder-email"><label>Recipient <input type="email" name="to" required list="reminder-recipients" value="${k.emails?.[0]?.addr || ""}"><datalist id="reminder-recipients">${raw((k.emails || []).map((e) => `<option value="${dep_esc(e.addr)}">`).join(""))}</datalist></label><label>Subject <input name="subject" maxlength="200" required value="${subject}"></label><label>Message <textarea name="body" required maxlength="12000" rows="8">${body}</textarea></label><button class="btn" type="submit">Open Outlook draft</button></form>`,
    );
  }

  function timelineRows() {
    return eventsFor(workspace.TIMELINE_CASE)
      .filter((e) => workspace.TIMELINE_FILTER === "all" || timelineCategory(e.type) === workspace.TIMELINE_FILTER)
      .slice()
      .sort((a, b) => String(a.at).localeCompare(String(b.at)) || a.id.localeCompare(b.id));
  }

  function showTimeline(cid, filter = workspace.TIMELINE_FILTER) {
    services.navigation.utilityContext();
    workspace.TIMELINE_CASE = cid;
    workspace.TIMELINE_FILTER = filter;
    const rows = timelineRows(),
      k = kase(cid);
    services.A11Y.utility(
      "Case timeline — " + k.number,
      html`<label>Event filter <select id="timeline-filter">${raw(
        "".concat(
          ["all", "issued", "corrected", "withdrawn", "filed", "recorded", "other"]
            .map((value) => `<option value="${value}" ${value === filter ? "selected" : ""}>${value}</option>`)
            .join(""),
        ),
      )}</select></label><button class="btn" data-timeline-csv>Export filtered CSV</button> <button class="btn" data-timeline-json>Export full event log</button><table><caption>Read-only case event log</caption><thead><tr><th scope="col">Time (Chicago)</th><th scope="col">Event</th><th scope="col">Recorded by</th><th scope="col">Details</th></tr></thead><tbody>${raw(
        "".concat(
          rows
            .map(
              (e) =>
                '<tr><th scope="row">' +
                `${dep_esc(new Date(e.at).toLocaleString("en-US", { timeZone: "America/Chicago" }))}` +
                "</th><td>" +
                `${dep_esc(e.type)}` +
                "</td><td>" +
                `${dep_esc(e.by || e.payload?.snapshot?.frozen?.inspector?.name || "")}` +
                "</td><td>" +
                "".concat(
                  dep_esc(e.payload?.reason || e.payload?.snapshot?.revision?.reason || e.payload?.snapshot?.type || e.payload?.docId || ""),
                ) +
                "</td></tr>",
            )
            .join("") || '<tr><td colspan="4">No matching events.</td></tr>',
        ),
      )}</tbody></table>`,
    );
  }
  return { remindersDue, remindersPanel, showReminders, showReminderDraft, timelineRows, showTimeline };
}
