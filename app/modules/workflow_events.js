import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { importPromptHTML, importTarget, inspectorResultsHTML } from "./inspector_cases.js";
/* Workflow event ownership. Construction is inert; core registers at the original startup positions. */
import { registerEventOnce } from "./event_registration.js";
import { esc } from "./presentation_format.js";
import { downloadText, csvText } from "../assets/shared.js";
import { kase, eventsFor } from "./writer_queries.js";
/* Result list for a shared-case search. */
function searchResultsHTML(result) {
  return (
    "<p>" +
    `${result.hits.length}` +
    " matching cases. " +
    `${result.unreadable}` +
    " unreadable files. " +
    `${result.partial ? "Results limited; refine your search." : ""}` +
    "</p><ul>" +
    "".concat(
      result.hits
        .map(
          (hit) =>
            "<li>" +
            `${esc(hit.number)}` +
            " · " +
            `${esc(hit.address)}` +
            " · " +
            `${esc(hit.owner)}` +
            " " +
            "".concat(
              hit.duplicate
                ? "Duplicate identity; administrator review needed"
                : `<button class="btn" data-global-open="${esc(hit.number)}">Open current case</button>`,
            ) +
            "</li>",
        )
        .join(""),
    ) +
    "</ul>"
  );
}

async function submitSearch(services, form, data) {
  const result = await services.helperJSON("/cases/search?q=" + encodeURIComponent(data.get("query")));
  if (!form.isConnected) return;
  document.getElementById("global-search-results").innerHTML = searchResultsHTML(result);
}

async function submitInspectorCases(services, form, data) {
  const inspector = data.get("inspector");
  const result = await services.helperJSON("/cases/by-inspector?inspector=" + encodeURIComponent(inspector));
  if (!form.isConnected) return;
  document.getElementById("inspector-case-prompt").innerHTML = "";
  document.getElementById("inspector-case-results").innerHTML = inspectorResultsHTML(result, inspector);
}

/* Continue a case from the inspector list by importing a new inspection result for it. */
async function continueWithImport(services, number) {
  const target = importTarget(number);
  if (target.kind === "blocked") return;
  document.getElementById("utility-dialog")?.close();
  if (!(await services.navigation.navigate("import"))) return;
  if (target.kind === "search") {
    editor.WORK.entry["lookup-number"] = number;
    services.render();
  }
}

function submitReminderSettings(services, form, data) {
  const prefs = workspace.WORKFLOW_PREFS.reminders;
  prefs.enabled = data.get("enabled") === "on";
  prefs.days = Math.min(30, Math.max(1, Number(data.get("days")) || 7));
  prefs.plans = {};
  for (const [key, value] of data.entries()) if (key.startsWith("plan:") && services.validISO(value)) prefs.plans[key.slice(5)] = value;
  services.saveWorkflowPrefs();
  document.getElementById("utility-dialog")?.close();
  services.render();
}

async function submitReminderEmail(services, form, data) {
  await services.helperJSON("/email/reminder", { to: data.get("to"), subject: data.get("subject"), body: data.get("body") });
  services.toast("Opened Outlook reminder draft", { severity: "success" });
}

async function submitBatchDue(services, form, data) {
  const changes = [...form.querySelectorAll("[data-batch-item]:checked")].map((el) => ({
    docId: el.dataset.batchDoc,
    itemId: el.dataset.batchItem,
  }));
  const copies = services.planBulkDue(changes, data.get("due"));
  await services.persistWorkspacePatch(
    (staged) => {
      staged.docs = staged.docs.map((d) => copies.get(d.id) || d);
      return staged;
    },
    () => {
      workspace.DOCS = workspace.DOCS.map((d) => copies.get(d.id) || d);
    },
  );
  document.getElementById("utility-dialog")?.close();
  services.render();
  services.toast("Saved selected draft deadlines", { severity: "success" });
}

async function submitOutboxSync(services) {
  const result = await services.helperJSON("/outbox/batch-sync", { items: services.selectedOutbox() });
  await services.refreshArtifactLocations();
  await services.showOutbox();
  services.toast(result.result.moved + " PDF(s) filed; " + result.result.conflicts.length + " conflict(s) retained", {
    severity: result.result.conflicts.length ? "warning" : "success",
  });
}

/* Forms handled here, by form id. */
const TOOL_FORMS = {
  "global-search-form": submitSearch,
  "inspector-cases-form": submitInspectorCases,
  "reminder-settings": submitReminderSettings,
  "reminder-email": submitReminderEmail,
  "batch-due-form": submitBatchDue,
  "outbox-form": submitOutboxSync,
};

export function createWorkflowEvents(services) {
  function registerToolForms(target = document) {
    return registerEventOnce(target, "workflow.registerToolForms", "submit", async (e) => {
      const form = e.target;
      if (!Object.hasOwn(TOOL_FORMS, form.id)) return;
      e.preventDefault();
      const submit = form.querySelector("button[type=submit]");
      submit.disabled = true;
      try {
        await TOOL_FORMS[form.id](services, form, new FormData(form));
      } catch (error) {
        services.toast(error.message, { severity: "error" });
      } finally {
        if (submit.isConnected) submit.disabled = false;
      }
    });
  }

  function registerToolActions(target = document) {
    return registerEventOnce(target, "workflow.registerToolActions", "click", async (e) => {
      const t = e.target.closest?.(
        "[data-global-search],[data-shared-offer],[data-global-open],[data-inspector-case],[data-inspector-import],[data-inspector-cancel],[data-reminders],[data-reminder-draft],[data-reminder-dismiss],[data-timeline],[data-timeline-csv],[data-timeline-json],[data-batch-due],[data-outbox],[data-outbox-print]",
      );
      if (!t) return;
      try {
        // The no-results offer opens the same shared search with the workspace query prefilled.
        if (t.hasAttribute("data-global-search") || t.hasAttribute("data-shared-offer")) await services.globalSearch();
        else if (t.dataset.globalOpen) {
          await services.writerOpenReportedCase({ number: t.dataset.globalOpen });
          document.getElementById("utility-dialog")?.close();
        } else if (t.dataset.inspectorCase) document.getElementById("inspector-case-prompt").innerHTML = importPromptHTML(t.dataset.inspectorCase);
        else if (t.hasAttribute("data-inspector-cancel")) document.getElementById("inspector-case-prompt").innerHTML = "";
        else if (t.dataset.inspectorImport) await continueWithImport(services, t.dataset.inspectorImport);
        else if (t.hasAttribute("data-reminders")) services.showReminders();
        else if (t.dataset.reminderDraft) services.showReminderDraft(t.dataset.reminderDraft);
        else if (t.dataset.reminderDismiss) {
          workspace.WORKFLOW_PREFS.reminders.dismissed.push(t.dataset.reminderDismiss);
          workspace.WORKFLOW_PREFS.reminders.dismissed = workspace.WORKFLOW_PREFS.reminders.dismissed.slice(-200);
          services.saveWorkflowPrefs();
          services.render();
        } else if (t.dataset.timeline) services.showTimeline(t.dataset.timeline, "all");
        else if (t.hasAttribute("data-timeline-csv"))
          downloadText(
            "case-timeline.csv",
            csvText([
              ["Event ID", "UTC time", "Category", "Type", "Recorded by"],
              ...services.timelineRows().map((e) => [e.id, e.at, services.timelineCategory(e.type), e.type, e.by || ""]),
            ]),
            "text/csv",
          );
        else if (t.hasAttribute("data-timeline-json"))
          services.downloadFile(
            "case-event-log.json",
            JSON.stringify(
              {
                format: "madison-event-log-export",
                version: 1,
                caseNumber: kase(workspace.TIMELINE_CASE).number,
                events: eventsFor(workspace.TIMELINE_CASE),
              },
              null,
              2,
            ),
          );
        else if (t.hasAttribute("data-batch-due")) services.showBulkDue();
        else if (t.hasAttribute("data-outbox")) await services.showOutbox();
        else if (t.hasAttribute("data-outbox-print")) await services.printOutbox();
      } catch (error) {
        services.toast(error.message, { severity: "error" });
      }
    });
  }

  function registerTimelineFilter(target = document) {
    return registerEventOnce(target, "workflow.registerTimelineFilter", "change", (e) => {
      if (e.target.id === "timeline-filter") services.showTimeline(workspace.TIMELINE_CASE, e.target.value);
      if (["case-filter", "case-inspector"].includes(e.target.id)) queueMicrotask(services.saveWorkflowPrefs);
    });
  }

  function registerSearchPreferences(target = document) {
    return registerEventOnce(target, "workflow.registerSearchPreferences", "input", (e) => {
      if (e.target.id === "case-search") queueMicrotask(services.saveWorkflowPrefs);
    });
  }

  const syncPdf = (t) => {
    t.disabled = true;
    services
      .helperJSON("/outbox/sync", {})
      .then(async (result) => {
        await services.checkHelper();
        await services.refreshArtifactLocations();
        services.render();
        services.toast(result.moved + " PDF(s) moved to the share");
      })
      .catch((error) => {
        services.toast(error.message);
        t.disabled = false;
      });
    return;
  };
  return { registerToolForms, registerToolActions, registerTimelineFilter, registerSearchPreferences, syncPdf };
}
