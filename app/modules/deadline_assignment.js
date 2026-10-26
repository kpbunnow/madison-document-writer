/* Deadline planning, assignment and presentation; events/persistence retain their existing authority. */
import { validISO, daysBetween } from "./calendar.js";
import { clone } from "./record_values.js";
import { dueItems, distinctDues } from "./document_rules.js";
import { doc, kase, reinsp } from "./writer_queries.js";
import { esc as dep_esc } from "./presentation_format.js";
import { WriterState } from "./state.js";

export function dueDateSpacingConflicts(items) {
  const byDate = new Map();
  items.forEach((i) => {
    if (validISO(i.due)) {
      if (!byDate.has(i.due)) byDate.set(i.due, []);
      byDate.get(i.due).push(i);
    }
  });
  const dates = [...byDate.keys()].sort(),
    conflicts = [];
  for (let ix = 1; ix < dates.length; ix++)
    if (daysBetween(dates[ix - 1], dates[ix]) < 7)
      conflicts.push({ dates: [dates[ix - 1], dates[ix]], items: [...byDate.get(dates[ix - 1]), ...byDate.get(dates[ix])] });
  return conflicts;
}

export function dueContext(target, visit) {
  if (visit) {
    const src = doc(target.sourceDocId);
    return (src ? src.items : [])
      .filter(
        (i) =>
          !i.done &&
          !i.withdrawn &&
          target.results[i.id] &&
          target.results[i.id].oc &&
          target.results[i.id].oc !== "corrected" &&
          target.results[i.id].oc !== "withdrawn" &&
          !target.results[i.id].carried,
      )
      .map((i) => ({ id: i.id, no: i.no, title: i.title, due: target.results[i.id].due || "" }));
  }
  return dueItems(target);
}

export function dueSelectedText(items, selected) {
  const n = items.filter((i) => selected.has(i.id)).length;
  return n + " of " + items.length + " item" + (items.length === 1 ? "" : "s") + " selected";
}

export function activeDueTarget() {
  const visit = WriterState.state.screen === "reinspect",
    target = visit ? reinsp(WriterState.state.reinspId) : doc(WriterState.state.docId);
  return { target, visit };
}

/* Dependencies and live workspace/browser state are read only when an operation is invoked. */
export function createDeadlineAssignment(services) {
  function planBulkDue(changes, value) {
    if (!validISO(value) || value < services.MINDUE()) throw new Error("Choose a future due date");
    if (!changes.length) throw new Error("Select at least one outstanding draft item");
    const copies = new Map();
    for (const change of changes) {
      const current = doc(change.docId);
      if (!current || !services.structEditable(current) || current.pendingAmendment)
        throw new Error("Only new, editable notice drafts can receive batch deadlines");
      if (!copies.has(current.id)) copies.set(current.id, clone(current));
      const copy = copies.get(current.id),
        item = dueItems(copy).find((i) => i.id === change.itemId);
      if (!item) throw new Error("Selected item is not outstanding");
      item.due = value;
    }
    for (const copy of copies.values()) {
      if (distinctDues(dueItems(copy)).length > 3) throw new Error("That would create more than three deadlines");
      if (dueDateSpacingConflicts(dueItems(copy)).length) throw new Error("Keep deadlines at least seven days apart");
    }
    return copies;
  }

  function showBulkDue() {
    services.navigation.utilityContext();
    services.A11Y.utility(
      "Batch draft due dates",
      "<p>Updates apply only to selected outstanding items in new editable noti" +
        "ce drafts. All selected drafts are validated together before saving.</p>" +
        '<form id="batch-due-form"><label>New due date <input type="date" name="d' +
        'ue" min="' +
        `${services.MINDUE()}` +
        '" required></label>' +
        "".concat(
          WriterState.DOCS.filter((d) => services.structEditable(d) && !d.pendingAmendment)
            .map(
              (d) =>
                "<fieldset><legend>" +
                `${dep_esc(kase(d.caseId).number)}` +
                "</legend>" +
                "".concat(
                  dueItems(d)
                    .map(
                      (i) =>
                        '<label><input type="checkbox" data-batch-doc="' +
                        `${dep_esc(d.id)}` +
                        '" data-batch-item="' +
                        `${dep_esc(i.id)}` +
                        '"> Item ' +
                        `${dep_esc(i.no)}` +
                        " · " +
                        `${dep_esc(i.title)}` +
                        " · " +
                        `${dep_esc(i.due || "No deadline")}` +
                        "</label>",
                    )
                    .join(""),
                ) +
                "</fieldset>",
            )
            .join("") || "<p>No eligible notice drafts.</p>",
        ) +
        '<button class="btn" type="submit">Validate and save selected deadlines</' +
        "button></form>",
    );
  }

  function updateDueIndicators(d) {
    const count = document.querySelector("[data-due-count]");
    if (count) count.textContent = distinctDues(dueItems(d)).length + " of 3 dates used";
    dueItems(d).forEach((i) => {
      const label = document.querySelector('[data-due-label="' + i.id + '"]');
      if (label) label.textContent = i.due ? services.fmtDate(i.due) : "Date needed";
    });
  }

  function duePanel(target, visit) {
    if (services.snow.is(target)) return "";
    // R53: also on an open reinspection worksheet, for the items still outstanding.
    if (visit ? !target.draft || target.docId : services.isLocked(target) || target.type !== "notice" || target.correction) return "";
    const items = dueContext(target, visit);
    if (!items.length) return "";
    const work = target.dueWork || {},
      selected = new Set(work.selected || []),
      dates = distinctDues(items);
    /* A notice draft selects items in the items table (data-due-select beside each due date), so its panel is a compact
     bar; the reinspection worksheet keeps its item list. Both apply through assignDue. */
    return (
      '<section class="card no-print authoring-panel' +
      `${visit ? "" : " due-compact"}` +
      '" aria-label="Assign due dates"><div class="card-h"><h2>Assign due dates' +
      "</h2><span data-due-count>" +
      `${dates.length}` +
      ' of 3 dates used</span></div><div class="card-b"><p class="hint">' +
      (visit
        ? "Select items that share a deadline and apply a date. Up to three distinct deadlines are allowed."
        : "Select items in the table above, then apply one date to them. Up to three distinct due dates are allowed.") +
      "</p>" +
      (visit
        ? '<div class="deadline-items">' +
          items
            .map(
              (i) =>
                '<label class="deadline-item"><input type="checkbox" data-due-select="' +
                `${dep_esc(i.id)}` +
                '" ' +
                `${selected.has(i.id) ? "checked" : ""}` +
                "><span><strong>Item " +
                `${dep_esc(i.no)}` +
                "</strong> · " +
                `${dep_esc(i.title || "Violation")}` +
                '<small data-due-label="' +
                `${dep_esc(i.id)}` +
                '">' +
                `${i.due ? dep_esc(services.fmtDate(i.due)) : "Date needed"}` +
                "</small></span></label>",
            )
            .join("") +
          "</div>"
        : "") +
      '<div class="editor-tools">' +
      ("<span data-due-selected>" + dueSelectedText(items, selected) + "</span>") +
      '<button class="btn btn-sm" data-due-all="1">Select all</button><button class="btn btn-sm" data-due-all="0">Clear' +
      ' selection</button><label for="bulk-due">Date for selected items</label>' +
      '<input type="date" id="bulk-due" value="' +
      `${dep_esc(work.date || "")}` +
      '" min="' +
      `${services.MINDUE()}` +
      '"><button class="btn btn-primary" id="btn-bulkdue">Apply date to selected items</bu' +
      "tton></div></div></section>"
    );
  }

  function assignDue(target, visit, value, ids) {
    if (
      visit
        ? // An empty or missing intent is "not yet decided" (an import rule that asks for a choice sets "").
          !target.draft ||
          target.docId ||
          (target.followupIntent && !["undecided", "extension", "bestInterestExtension", "citation"].includes(target.followupIntent))
        : services.isLocked(target) || target.type !== "notice" || target.correction
    )
      return "Assign due dates is available on a new Official Notice or an open reinspection worksheet.";
    const items = dueContext(target, visit),
      selected = new Set(ids || []);
    if (!selected.size) return "Select at least one outstanding item.";
    if ([...selected].some((id) => !items.some((i) => i.id === id))) return "The selection changed. Select only current outstanding items.";
    if (!validISO(value) || value < services.MINDUE()) return "Choose a future due date.";
    const proposed = items.map((i) => ({ ...i, due: selected.has(i.id) ? value : i.due }));
    if (distinctDues(proposed).length > 3) return "That would create more than three due dates. Select a larger group or use an existing date.";
    if (dueDateSpacingConflicts(proposed).length) return "Keep distinct due dates at least seven days apart.";
    items
      .filter((i) => selected.has(i.id))
      .forEach((i) => {
        if (visit) target.results[i.id].due = value;
        else target.items.find((x) => x.id === i.id).due = value;
      });
    if (target.correction) target.correction.reviewed = false;
    return "";
  }

  return { planBulkDue, showBulkDue, updateDueIndicators, duePanel, assignDue };
}
