function queueBlockedAction(R, k, st, proof, conflict, open) {
  let action, label, reason, priority;
  if (proof.valid === false || conflict) {
    action = `data-sync-safety="${R.esc(k.id)}"`;
    label = conflict ? "Review shared changes" : "Review record problem";
    reason = conflict
      ? "Shared changes need review before continuing."
      : "Record verification failed. Keep this case read-only and ask an administrator to review it.";
    priority = 0;
  } else if (st.pendingRecord) {
    action = `data-resumerecord="${R.esc(st.pendingRecord.recordKey)}"`;
    label = "Confirm saved action";
    reason = "Save confirmation needed. Continue the original attempt.";
    priority = 1;
  } else if (st.pendingDoc) {
    action = open(st.pendingDoc);
    label = "Confirm document save";
    reason = "Save confirmation needed. Continue the original attempt.";
    priority = 1;
  } else if (proof.pendingTransaction) {
    action = `data-sync-safety="${R.esc(k.id)}"`;
    label = "Complete pending save";
    reason = "A saved migration needs completion before shared work continues.";
    priority = 1;
  } else return null;
  return { action, label, reason, priority };
}

function queueWorkingAction(R, k, st, held, has, open, caseAction) {
  let action, label, reason, priority;
  if (st.draft) {
    action = open(st.draft);
    label = st.draft.correction ? "Continue correction" : "Continue document";
    reason = held
      ? "Draft retained. Mandatory appearance needs division-approved wording before issuance."
      : has("deposit")
        ? "Citation needs deposit. Continue the draft to complete its approved basis."
        : "Unfinished document saved in this workspace.";
    priority = 2;
  } else if (st.visit) {
    action = caseAction;
    label = st.visit.draft ? "Continue reinspection" : "Complete recorded visit";
    reason = st.visit.draft ? "Finish recording the inspection outcomes." : "The recorded visit needs its follow-up document.";
    priority = 2;
  } else if (st.pendingSync || has("pending")) {
    action = `data-case-sync="${R.esc(k.id)}"`;
    label = !R.CASEDIR ? "Connect case storage" : R.NEEDGRANT ? "Reconnect folder" : "Write to share";
    reason = "Waiting for connection or shared save. The queued case file is retained.";
    priority = 3;
  } else return null;
  return { action, label, reason, priority };
}

function queuePDFAction(R, k, has, fact) {
  let action, label, reason, priority;
  if (has("filing")) {
    action = fact("filing").action;
    label = "File issued PDF";
    reason = "PDF filing needed for an issued document.";
    priority = 4;
  } else if (has("outbox")) {
    action = "data-outbox";
    label = "Transfer saved PDF";
    reason = R.docsFor(k.id).some(
      (d) => R.pdfTransferState(d) === "last verified location; refresh unavailable" && R.ARTIFACT_LOCATIONS[d.id]?.includes("local"),
    )
      ? "The PDF was last verified in the local outbox. Review its current availability before transfer."
      : "The PDF is saved in the local outbox and needs transfer.";
    priority = 4;
  } else if (has("artifacts")) {
    action = fact("artifacts").action;
    label = "Check filed PDF";
    reason = "The PDF location needs verification. Open the document for the exact status.";
    priority = 4;
  } else return null;
  return { action, label, reason, priority };
}

function queueIssuedCaseAction(R, k, st, open, caseAction) {
  let action, label, reason, priority;
  if (st.restrictions.length || (st.current && !st.current.items.length)) {
    action = open(st.current);
    label = "Review case conditions";
    reason = "Continuing case conditions need review.";
    priority = 5;
  } else if (st.closed) {
    action = st.current ? open(st.current) : "data-sync-safety";
    label = "View case";
    reason = "No unfinished work or upcoming deadline.";
    priority = 9;
  } else if (st.current && R.snow.isCase(k)) {
    action = open(st.current);
    label = "Snow citation";
    reason = "Review the issued snow citation.";
    priority = 8;
  } else if (st.current) {
    action = caseAction;
    label = st.late || st.soon ? "Start reinspection" : "Reinspect";
    reason = st.late
      ? "The compliance date has passed."
      : st.soon
        ? "A compliance date is due within 7 days."
        : "No immediate deadline. Start a visit when needed.";
    priority = st.late ? 5 : st.soon ? 6 : 8;
  } else {
    action = `data-new="${R.esc(k.id)}"`;
    label = "Write notice";
    reason = "Case details are ready for a new document.";
    priority = 7;
  }
  return { action, label, reason, priority };
}

/* Presentation-only queue. Existing task facts retain publication/storage ownership. */
export function workspaceQueue(rows, tasks, R) {
  const byCase = new Map(rows.map((x) => [x.k.id, []]));
  for (const task of tasks) for (const item of task.items) if (byCase.has(item.cid)) byCase.get(item.cid).push({ ...item, key: task.key });
  return rows
    .map(({ k, st }) => {
      const facts = byCase.get(k.id),
        proof = R.recordIntegrity.status(k),
        conflict = R.PREFLIGHT_CONFLICT?.cid === k.id;
      const has = (key) => facts.some((t) => t.key === key),
        fact = (key) => facts.find((t) => t.key === key);
      const held = !!st.draft && (st.draft.items || []).some((i) => i.cite && !i.withdrawn && st.draft.cits?.[i.id]?.mandatoryAppearance);
      const open = (d) => `data-open="${R.esc(d.id)}"`,
        caseAction = `data-reinsp="${R.esc(k.id)}"`;
      const chosen =
        queueBlockedAction(R, k, st, proof, conflict, open) ||
        queueWorkingAction(R, k, st, held, has, open, caseAction) ||
        queuePDFAction(R, k, has, fact) ||
        queueIssuedCaseAction(R, k, st, open, caseAction);
      const { action, label, reason, priority } = chosen;
      const resolution =
        proof.valid === false ||
        !!conflict ||
        !!proof.pendingTransaction ||
        held ||
        ["deposit", "confirm", "pending", "filing", "outbox", "artifacts"].some(has) ||
        !R.caseNumberAllowed(k);
      return {
        k,
        st,
        facts,
        proof,
        held,
        action,
        label,
        reason,
        priority,
        resolution,
        continuing: !!(st.draft || st.visit),
        deadline: !!(st.late || st.soon),
        attention: !!(st.attention || resolution || !st.current),
      };
    })
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        String(a.st.due || "9999").localeCompare(String(b.st.due || "9999")) ||
        String(b.k.date).localeCompare(String(a.k.date)) ||
        a.k.id.localeCompare(b.k.id),
    );
}

export function queueMatches(row, filter) {
  const st = row.st;
  return (
    filter === "all" ||
    (filter === "attention" && row.attention) ||
    (["continue", "drafts"].includes(filter) && row.continuing) ||
    (filter === "deadlines" && row.deadline) ||
    (filter === "resolution" && row.resolution) ||
    (filter === "soon" && st.soon) ||
    (filter === "overdue" && st.late) ||
    (filter === "open" && !st.closed) ||
    (filter === "closed" && st.closed)
  );
}
