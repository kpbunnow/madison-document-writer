import { editorState as editor } from "./editor_state.js";
import { catalogState as catalog } from "./catalog_state.js";
import { caseNumberKey } from "../assets/shared.js";
import { caseDetails, stableJSON, clone } from "./record_values.js";
import { caseFileFault, caseFileName } from "./case_file_rules.js";
import { doc, docsFor, eventsFor, kase } from "./writer_queries.js";
import { esc } from "./presentation_format.js";
import { nowISO } from "./calendar.js";
import { BUILD } from "./data/build_identity.js";
import { WriterState } from "./state.js";
import { savedCaseState, savedWorkHTML } from "./saved_work.js";

/* Named lazy adapters preserve review/preflight authority and live workspace references. */
export function createLanguageCatalog(services) {
  /* app functions; direct dependencies use explicit shared state. */

  function catalogReview(key) {
    return catalog.CATALOG_EVENTS.filter((e) => e.key === key).slice(-1)[0] || null;
  }

  function catalogReplacement(key) {
    return (
      catalog.CATALOG_EVENTS.filter((e) => e.status === "approved" && e.replaces === key && catalogReview(e.key)?.id === e.id).slice(-1)[0] || null
    );
  }

  function catalogStatus(i) {
    const key = services.catalogKey(i),
      review = catalogReview(key),
      replacement = catalogReplacement(key);
    if (review?.status === "retired") return { code: "retired", label: "Retired · historical only", review };
    if (replacement) return { code: "superseded", label: "Replaced by " + replacement.key, review, replacement };
    if (review?.status === "approved")
      return { code: "ready", label: "Reviewed v" + review.version + " · " + review.reviewer + " · " + review.at.slice(0, 10), review };
    if (!catalog.CATALOG_VERIFIED) return { code: "unknown", label: "Review status unavailable · selection paused" };
    if (!i.s.length) return { code: "incomplete", label: "Missing ordinance · division review required" };
    if (i.p === "draft") return { code: "review", label: "Draft · division review required" };
    return { code: "legacy", label: "Legacy selection · formal review not recorded" };
  }

  function effectiveCatalog(i) {
    const status = catalogStatus(i),
      r = status.code === "ready" && status.review;
    return { ...i, a: r ? r.wording : i.a, s: r ? [...r.ordinances] : i.s, effectiveReview: r || null };
  }

  function catalogItem(key) {
    return services.allItems().find((i) => services.catalogKey(i) === key);
  }

  function catalogDraftBlocked(it) {
    const source = it.libraryKey && catalogItem(it.libraryKey);
    const status = source && catalogStatus(source);
    return (
      it.prov === "draft" ||
      (!!status && (["retired", "superseded"].includes(status.code) || (status.code === "ready" && it.catalogReviewId !== status.review.id)))
    );
  }

  function catalogDraftNotice(it) {
    const source = it.libraryKey && catalogItem(it.libraryKey),
      status = source && catalogStatus(source);
    if (!status || !["ready", "retired", "superseded"].includes(status.code)) return "";
    if (status.code === "ready" && it.catalogReviewId === status.review.id) return "";
    return (
      '<div class="hint no-print" role="status">' +
      "".concat(
        esc(
          status.code === "ready"
            ? "Catalog wording changed since selection. Your draft text is preserved."
            : status.code === "superseded"
              ? "Catalog entry is superseded. Review the preferred entry before issuing."
              : "Catalog entry was retired. Division review is required before issuing.",
        ),
      ) +
      "\n    " +
      "".concat(
        status.code === "ready"
          ? '<button class="btn btn-sm" data-adopt-catalog="' + `${esc(it.id)}` + '">Review and use v' + `${status.review.version}` + "</button>"
          : "",
      ) +
      "</div>"
    );
  }

  function adoptCatalogReview(d, it) {
    const source = it.libraryKey && catalogItem(it.libraryKey),
      status = source && catalogStatus(source);
    if (!d?.draft || !it || !status || status.code !== "ready") return false;
    if (
      !confirm(
        "Compare current draft:\n" +
          it.text +
          "\nOrdinance: " +
          (it.sections || []).join("; ") +
          "\n\nReviewed v" +
          status.review.version +
          ":\n" +
          status.review.wording +
          "\nOrdinance: " +
          status.review.ordinances.join("; ") +
          "\n\nReplace the draft wording and ordinance? Item identity stays the same.",
      )
    )
      return false;
    it.text = status.review.wording;
    it.sections = [...status.review.ordinances];
    it.prov = "approved";
    it.catalogVersion = status.review.version;
    it.catalogReviewId = status.review.id;
    WriterState.DIRTY = true;
    services.saveDrafts();
    services.refreshSheet();
    return true;
  }

  function catalogSelection(i) {
    const status = catalogStatus(i),
      r = status.review;
    return status.code === "ready"
      ? { ...i, a: r.wording, s: r.ordinances, p: "approved", catalogVersion: r.version, catalogReviewId: r.id }
      : { ...i, catalogVersion: 0 };
  }

  function catalogVisible(i, filter) {
    const s = catalogStatus(i).code;
    return (
      !filter ||
      filter === "all" ||
      (filter === "approved" && s === "ready") ||
      (filter === "usable" && ["ready", "legacy"].includes(s)) ||
      (filter === "review" && ["review", "incomplete"].includes(s)) ||
      (filter === "legacy" && ["legacy", "superseded", "retired"].includes(s))
    );
  }

  let catalogReadSequence = 0;
  async function refreshCatalog() {
    const sequence = ++catalogReadSequence,
      previous = catalog.CATALOG_EVENTS;
    const current = () => sequence === catalogReadSequence && previous === catalog.CATALOG_EVENTS;
    try {
      const events = (await services.helperJSON("/catalog/reviews")).events;
      if (!Array.isArray(events)) throw new Error("Invalid review history");
      if (!current()) return false;
      catalog.CATALOG_EVENTS = events;
      catalog.CATALOG_ERROR = "";
      catalog.CATALOG_VERIFIED = true;
      catalog.CATALOG_FROM_CACHE = false;
      catalog.CATALOG_AT = nowISO();
      try {
        localStorage.setItem("madison-catalog-events-v1", JSON.stringify({ at: catalog.CATALOG_AT, events }));
      } catch (e) {
        catalog.CATALOG_ERROR = "Current reviews verified, but this browser could not cache them for later outages.";
      }
    } catch (e) {
      if (!current()) return false;
      catalog.CATALOG_ERROR = "Review refresh unavailable: " + e.message + ". Last verified: " + (catalog.CATALOG_AT || "none") + ".";
    }
    if (editor.state.screen === "library" || editor.state.picker) services.render();
    return catalog.CATALOG_VERIFIED && !/Review refresh unavailable/.test(catalog.CATALOG_ERROR);
  }

  function catalogForm(key, i, r) {
    return (
      catalog.CATALOG_FORMS[key] || {
        reviewer: "",
        wording: r?.wording || i.a,
        ordinances: (r?.ordinances || i.s).join("; "),
        source: r?.source || "",
        replaces: r?.replaces || "",
        baseVersion: r?.version || 0,
      }
    );
  }

  function catalogReplacementOptions(key, selected, query = "") {
    return (
      '<option value="">None</option>' +
      services
        .allItems()
        .filter((x) => services.catalogKey(x) !== key)
        .map((x) => {
          const k = services.catalogKey(x),
            s = catalogStatus(x),
            e = effectiveCatalog(x);
          return { k, label: x.t + " · " + e.s.join(", ") + " · " + s.label };
        })
        .filter((x) => !query || x.k === selected || x.label.toLowerCase().includes(query.toLowerCase()))
        .map((x) => `<option value="${esc(x.k)}" ${selected === x.k ? "selected" : ""}>${esc(x.label)}</option>`)
        .join("")
    );
  }

  function catalogReviewPanel(i) {
    const key = services.catalogKey(i),
      s = catalogStatus(i),
      r = s.review;
    const f = catalogForm(key, i, r);
    return (
      '<details class="lib-guidance" ' +
      `${catalog.CATALOG_FORMS[key]?.open ? "open" : ""}` +
      "><summary>Division review administration · " +
      `${esc(s.label)}` +
      "</summary>\n    <p>Source: " +
      `${esc(i.p || "export")}` +
      "" +
      `${i.legacyKeys?.length ? " · overlaps " + esc(i.legacyKeys.join(", ")) : ""}` +
      ".</p>\n    " +
      "".concat(
        r
          ? "<p>Reviewed " +
              `${esc(r.at)}` +
              " by " +
              `${esc(r.reviewer)}` +
              " · v" +
              `${r.version}` +
              " · source " +
              `${esc(r.source)}` +
              " · ordinance " +
              `${esc(r.ordinances.join(", "))}` +
              ". " +
              `${r.replaces ? "Preferred over " + esc(r.replaces) : ""}` +
              "</p>"
          : "",
      ) +
      "\n    " +
      "".concat(
        r
          ? "<details><summary>Compare bundled, reviewed and draft wording</summary><" +
              "p><strong>Bundled:</strong> " +
              `${esc(i.a)}` +
              " · " +
              `${esc(i.s.join("; "))}` +
              "</p>\n      <p><strong>Current reviewed v" +
              `${r.version}` +
              ":</strong> " +
              `${esc(r.wording)}` +
              " · " +
              `${esc(r.ordinances.join("; "))}` +
              "</p>\n      <p><strong>Unsubmitted form:</strong> " +
              `${esc(f.wording)}` +
              " · " +
              `${esc(f.ordinances)}` +
              "</p></details>"
          : "",
      ) +
      "\n    " +
      "".concat(catalog.CATALOG_FORMS[key]?.error ? `<p class="save-error" role="alert">${esc(catalog.CATALOG_FORMS[key].error)}</p>` : "") +
      "\n    " +
      "".concat(
        catalog.CATALOG_FORMS[key] && f.baseVersion !== (r?.version || 0)
          ? '<button class="btn btn-sm" data-catalog-rebase="' +
              `${esc(key)}` +
              '">Use current v' +
              `${r?.version || 0}` +
              " as review basis (keep entered values)</button>"
          : "",
      ) +
      '\n    <label>Reviewer <input data-catalog-field="reviewer" data-catalog-k' +
      'ey="' +
      `${esc(key)}` +
      '" value="' +
      `${esc(f.reviewer)}` +
      '"></label>\n    <label>Approved corrective action <textarea data-catalog-' +
      'field="wording" data-catalog-key="' +
      `${esc(key)}` +
      '">' +
      `${esc(f.wording)}` +
      "</textarea></label>\n    <label>Ordinance reference(s), separated by semi" +
      'colons <input data-catalog-field="ordinances" data-catalog-key="' +
      `${esc(key)}` +
      '" value="' +
      `${esc(f.ordinances)}` +
      '"></label>\n    <label>Source / authority for review <input data-catalog-' +
      'field="source" data-catalog-key="' +
      `${esc(key)}` +
      '" value="' +
      `${esc(f.source)}` +
      '"></label>\n    <label>Find an entry to replace <input type="search" data' +
      '-catalog-replacement-query="' +
      `${esc(key)}` +
      '" value="' +
      `${esc(f.replacementQuery || "")}` +
      '" placeholder="Search title, ordinance or status"></label>\n    <label>En' +
      'try replaced (optional) <select data-catalog-field="replaces" data-catal' +
      'og-key="' +
      `${esc(key)}` +
      '">' +
      "".concat(
        catalog.CATALOG_FORMS[key]?.open
          ? catalogReplacementOptions(key, f.replaces, f.replacementQuery)
          : '<option value="' + esc(f.replaces) + '">Open to browse entries</option>',
      ) +
      '</select></label>\n    <button class="btn btn-sm" data-catalog-save="' +
      `${esc(key)}` +
      '" data-catalog-status="approved">Record approved version</button>\n    <b' +
      'utton class="btn btn-sm" data-catalog-save="' +
      `${esc(key)}` +
      '" data-catalog-status="retired">Retire entry</button>\n    <p class="hint' +
      '">Review is an immutable, versioned shared record. It changes future sel' +
      "ection only. Existing drafts need deliberate revision.</p>\n  </details>"
    );
  }

  async function readSharedCase(k) {
    if (WriterState.CASEDIR?.helper) return (await services.helperJSON("/cases/resolve?number=" + encodeURIComponent(k.number))).file;
    if (WriterState.CASEDIR && !WriterState.NEEDGRANT) {
      const fh = await WriterState.CASEDIR.getFileHandle(caseFileName(k));
      return JSON.parse(await (await fh.getFile()).text());
    }
    throw new Error("Shared case storage is unavailable");
  }

  function localCaseWork(cid) {
    return (
      WriterState.DOCS.some((d) => d.draft && d.caseId === cid) ||
      WriterState.REINSP.some((r) => r.draft && r.caseId === cid) ||
      WriterState.PENDING.some((p) => p.cid === cid) ||
      Object.values(editor.RECORD_ATTEMPTS).some((x) => x.cid === cid) ||
      WriterState.DOCS.some((d) => d.caseId === cid && d.pendingAmendment)
    );
  }

  function compareSharedCase(local, events, shared, checkpoint, unfinished = localCaseWork(local.id)) {
    const fault =
      services.recordIntegrity.status(shared.case).valid === false
        ? "This record was changed outside the program. Read-only."
        : caseFileFault(shared);
    if (fault || caseNumberKey(shared.case.number) !== caseNumberKey(local.number) || shared.case.id !== local.id)
      return { kind: "invalid", detail: fault || "The shared record has a different case identity", fields: [] };
    const known = new Map(events.map((e) => [e.id, e])),
      remote = new Map(shared.events.map((e) => [e.id, e]));
    const baseline = new Set(checkpoint?.events || []);
    const removed = [...known].filter(([id]) => !remote.has(id) && (!checkpoint || baseline.has(id)));
    const altered = [...known].filter(([id, e]) => remote.has(id) && stableJSON(e) !== stableJSON(remote.get(id)));
    const added = [...remote].filter(([id]) => !known.has(id));
    if (removed.length || altered.length)
      return { kind: "history-conflict", detail: `${removed.length} locally known event(s) missing; ${altered.length} event(s) changed`, fields: [] };
    const fields = [],
      merged = caseDetails(shared.case),
      a = caseDetails(local),
      b = checkpoint?.case && caseDetails(checkpoint.case);
    for (const field of new Set([...Object.keys(a), ...Object.keys(merged)])) {
      if (
        field === "id" ||
        (field === "number" && caseNumberKey(a[field]) === caseNumberKey(merged[field])) ||
        stableJSON(a[field]) === stableJSON(merged[field])
      )
        continue;
      const lc = b ? stableJSON(a[field]) !== stableJSON(b[field]) : true;
      const rc = b ? stableJSON(merged[field]) !== stableJSON(b[field]) : true;
      fields.push({ field, local: a[field], shared: merged[field], localChanged: lc, sharedChanged: rc });
      if (lc && !rc) {
        if (a[field] === undefined) delete merged[field];
        else merged[field] = clone(a[field]);
      }
    }
    const conflict = fields.some((f) => f.localChanged && f.sharedChanged);
    const localEvents = [...known.keys()].filter((id) => !baseline.has(id));
    const remoteDetails = fields.some((f) => f.sharedChanged),
      localDetails = fields.some((f) => f.localChanged);
    const kind = conflict
      ? "conflict"
      : added.length && unfinished
        ? "history-conflict"
        : added.length
          ? "shared-history"
          : remoteDetails && localDetails
            ? "compatible"
            : remoteDetails
              ? "shared-only"
              : localDetails || localEvents.length
                ? "local-only"
                : "unchanged";
    return {
      kind,
      fields,
      merged,
      added: added.length,
      detail: added.length
        ? `${added.length} new shared history event(s)`
        : conflict
          ? "The same case field changed differently in both copies"
          : kind === "compatible"
            ? "Independent case fields changed in both copies"
            : kind === "shared-only"
              ? "Shared case details changed"
              : "Local changes are retained",
    };
  }

  async function preflightCase(cid, action, continuation) {
    const k = kase(cid);
    if (!k.id) return false;
    if (!WriterState.CASEDIR || WriterState.NEEDGRANT) {
      WriterState.PREFLIGHT_NOTICE = "Shared case unavailable; final publication will recheck it.";
      continuation();
      return true;
    }
    const token = ++WriterState.PREFLIGHT_SEQ,
      wasScreen = editor.state.screen,
      wasDoc = editor.state.docId,
      wasVisit = editor.state.reinspId;
    let file, comparison;
    try {
      file = await readSharedCase(k);
      comparison = compareSharedCase(k, eventsFor(cid), file, WriterState.SAVE_CHECKPOINTS[cid]);
    } catch (e) {
      comparison = { kind: e.name === "NotFoundError" ? "missing" : "unavailable", detail: e.message, fields: [] };
    }
    if (
      token !== WriterState.PREFLIGHT_SEQ ||
      !WriterState.CASES.some((x) => x.id === cid) ||
      editor.state.screen !== wasScreen ||
      editor.state.docId !== wasDoc ||
      editor.state.reinspId !== wasVisit
    )
      return false;
    if (
      ["invalid", "conflict", "history-conflict"].includes(comparison.kind) ||
      (comparison.kind === "shared-history" && (localCaseWork(cid) || services.caseUnsaved(k))) ||
      (comparison.kind === "shared-only" && !WriterState.SAVE_CHECKPOINTS[cid] && localCaseWork(cid))
    ) {
      WriterState.PREFLIGHT_CONFLICT = { cid, action, file, comparison, continuation, token };
      editor.state.modal = "shared-change";
      services.render();
      return false;
    }
    if (["shared-only", "compatible"].includes(comparison.kind)) {
      const prior = clone(k),
        checkpoint = clone(WriterState.SAVE_CHECKPOINTS[cid] || null);
      Object.keys(k).forEach((key) => delete k[key]);
      Object.assign(k, comparison.merged);
      services.rememberSaved(k, file);
      if (!(await services.saveDrafts())) {
        Object.keys(k).forEach((key) => delete k[key]);
        Object.assign(k, prior);
        WriterState.SAVE_CHECKPOINTS[cid] = checkpoint;
        WriterState.PREFLIGHT_CONFLICT = {
          cid,
          action,
          file,
          comparison: { kind: "unavailable", detail: "Browser storage could not save the merged case", fields: comparison.fields },
          continuation,
          token,
        };
        editor.state.modal = "shared-change";
        services.render();
        return false;
      }
      if (
        token !== WriterState.PREFLIGHT_SEQ ||
        editor.state.screen !== wasScreen ||
        editor.state.docId !== wasDoc ||
        editor.state.reinspId !== wasVisit
      )
        return false;
    } else if (comparison.kind === "shared-history") {
      if (!services.loadCaseFile(JSON.stringify(file))) {
        WriterState.PREFLIGHT_CONFLICT = {
          cid,
          action,
          file,
          comparison: { kind: "invalid", detail: "The shared case could not be loaded", fields: [] },
          continuation,
          token,
        };
        editor.state.modal = "shared-change";
        services.render();
        return false;
      }
    }
    WriterState.PREFLIGHT_NOTICE =
      comparison.kind === "unavailable"
        ? "Shared case unavailable; final publication will recheck it."
        : comparison.kind === "missing"
          ? "No shared case file yet; publication will verify this."
          : comparison.kind === "local-only"
            ? "Local changes retained; publication will reconcile them."
            : "Shared history checked.";
    continuation();
    return true;
  }

  function sharedChangeModal() {
    const c = WriterState.PREFLIGHT_CONFLICT;
    if (!c) return "";
    const k = kase(c.cid),
      v = c.comparison;
    return (
      '<div class="modal"><div class="modal-box" role="dialog" aria-modal="true' +
      '" aria-label="Shared case reconciliation"><div class="modal-h"><h2>Revie' +
      'w shared case</h2></div>\n  <div class="modal-b"><p>Case ' +
      `${esc(k.number)}` +
      ": " +
      `${esc(v.detail)}` +
      ". Your drafts and pending identities are retained.</p>\n  " +
      "".concat(
        v.fields?.length
          ? "<table><thead><tr><th>Field</th><th>Local</th><th>Shared</th><th>Resolut" +
              "ion</th></tr></thead><tbody>" +
              `${conflictControls(c)}` +
              "</tbody></table>"
          : "",
      ) +
      "\n  <p>Keeping local work resumes " +
      `${esc(c.action)}` +
      ". Issuance still requires reconciliation with the current shared record." +
      '</p></div>\n  <div class="modal-f">' +
      "".concat(v.kind === "conflict" ? '<button class="btn btn-primary" data-conflict-apply>Apply field choices and save</button>' : "") +
      '<button class="btn" data-shared-export>Export local work</button><button' +
      ' class="btn" data-shared-current ' +
      `${c.file ? "" : "disabled"}` +
      '>Open current shared case</button><button class="btn" data-shared-local>' +
      "Keep working locally</button></div></div></div>"
    );
  }

  function keepChangedLocal() {
    const c = WriterState.PREFLIGHT_CONFLICT;
    if (!c) return;
    WriterState.PREFLIGHT_CONFLICT = null;
    editor.state.modal = null;
    WriterState.PREFLIGHT_NOTICE = "Local work retained. Resolve shared differences before publication.";
    c.continuation();
  }

  async function openChangedShared() {
    const c = WriterState.PREFLIGHT_CONFLICT,
      k = c && kase(c.cid);
    if (!k?.id || !c.file) return;
    try {
      const key = services.recoveryCaseKey(k.id);
      if (!services.RECOVERY_WORKSPACE || !key) throw new Error("Recovery identity unavailable");
      if (
        WriterState.PENDING.some((p) => p.cid === k.id) ||
        WriterState.DOCS.some((d) => d.caseId === k.id && d.pendingAmendment) ||
        Object.values(editor.RECORD_ATTEMPTS).some((x) => x.cid === k.id)
      )
        throw new Error("Confirm pending save identities before replacing this case.");
      if (caseFileFault(c.file) || c.file.case.id !== k.id) throw new Error("Shared case is invalid or has a different identity.");
      const backup = services.recoverySnapshot(k.id, key);
      backup.preReplacement = true;
      await services.helperJSON("/draft-backups/write", { workspace: services.RECOVERY_WORKSPACE, case: key, backup });
      if (!confirm("Recovery copy saved. Replace local work for " + k.number + " with the current shared record?")) return;
      const fresh = await readSharedCase(k);
      if (stableJSON(fresh.case) !== stableJSON(c.file.case) || stableJSON(fresh.events) !== stableJSON(c.file.events))
        throw new Error("Shared case changed again. Review it before replacing local work.");
      if (WriterState.PREFLIGHT_CONFLICT !== c) return;
      const staged = {
        ...services.draftBundle(),
        cases: WriterState.CASES.filter((x) => x.id !== k.id).concat([clone(fresh.case)]),
        docs: WriterState.DOCS.filter((d) => d.caseId !== k.id),
        reinsp: WriterState.REINSP.filter((r) => r.caseId !== k.id),
        events: { ...WriterState.EVENTS, [k.id]: clone(fresh.events) },
        recordAttempts: Object.fromEntries(Object.entries(editor.RECORD_ATTEMPTS).filter(([, x]) => x.cid !== k.id)),
        checkpoints: { ...WriterState.SAVE_CHECKPOINTS, [k.id]: { case: caseDetails(fresh.case), events: fresh.events.map((e) => e.id) } },
        work: {
          ...clone(editor.WORK),
          walk: editor.WORK.walk?.context?.startsWith(k.id + "|") ? null : editor.WORK.walk,
          recordForms: Object.fromEntries(Object.entries(editor.WORK.recordForms || {}).filter(([id]) => doc(id.split(":")[0])?.caseId !== k.id)),
        },
      };
      if (!(await services.idbSet("drafts", staged))) throw new Error("Browser storage could not save the replacement.");
      WriterState.CASES = staged.cases;
      WriterState.DOCS = staged.docs;
      WriterState.REINSP = staged.reinsp;
      WriterState.EVENTS = staged.events;
      editor.RECORD_ATTEMPTS = staged.recordAttempts;
      WriterState.SAVE_CHECKPOINTS = staged.checkpoints;
      editor.WORK = staged.work;
      services.clearWalk();
      services.project();
      WriterState.PREFLIGHT_CONFLICT = null;
      editor.state.modal = null;
      editor.state.screen = "cases";
      services.render();
    } catch (e) {
      services.toast("Local work kept: " + e.message);
    }
  }

  async function persistWorkspacePatch(prepare, commit) {
    if (editor.WORK_PATCH) throw new Error("Another workspace change is saving");
    let unlock;
    editor.WORK_PATCH = new Promise((resolve) => {
      unlock = resolve;
    });
    try {
      await editor.LOCAL_SAVE_CHAIN;
      services.captureWork();
      const staged = prepare(clone(services.draftBundle()));
      if (!(await services.idbSet("drafts", staged))) throw new Error("Browser storage could not save the change. Local work was kept.");
      commit(staged);
      editor.LOCAL_SAVE = { ok: true, at: nowISO(), saving: false };
      ++editor.LOCAL_CHANGED;
      WriterState.DIRTY = false;
      services.scheduleRecoveryBackup();
      return true;
    } finally {
      unlock();
      editor.WORK_PATCH = null;
    }
  }

  function resolvedCaseFields(local, shared, comparison, choices) {
    if (comparison.kind !== "conflict" || !comparison.merged) throw new Error("Only case field conflicts can be merged here");
    const merged = clone(comparison.merged);
    for (const f of comparison.fields) {
      if (!f.localChanged || !f.sharedChanged) continue;
      const choice = choices[f.field];
      if (!choice || !["mine", "shared", "merge"].includes(choice.kind)) throw new Error("Choose how to resolve " + f.field);
      const value = choice.kind === "mine" ? f.local : choice.kind === "shared" ? f.shared : choice.value;
      if (f.field === "id" || f.field === "number") throw new Error("Case identity cannot be merged");
      if (typeof value !== typeof f.local && typeof value !== typeof f.shared) throw new Error("The merged " + f.field + " has the wrong value type");
      if (value === undefined) delete merged[f.field];
      else merged[f.field] = clone(value);
    }
    merged.id = local.id;
    merged.number = local.number;
    return merged;
  }

  function friendlyField(value) {
    if (value === undefined) return "(absent)";
    if (Array.isArray(value)) return value.map(friendlyField).join("\n");
    if (value && typeof value === "object")
      return Object.entries(value)
        .map(([k, v]) => k + ": " + friendlyField(v))
        .join("\n");
    return String(value);
  }

  function conflictControls(c) {
    return c.comparison.fields
      .map(
        (f, n) =>
          '<tr><th scope="row">' +
          `${esc(f.field)}` +
          "</th><td>" +
          `${esc(friendlyField(f.local))}` +
          "</td><td>" +
          `${esc(friendlyField(f.shared))}` +
          "</td><td>" +
          "".concat(
            f.localChanged && f.sharedChanged && !["id", "number"].includes(f.field)
              ? "<label>Resolution for " +
                  `${esc(f.field)}` +
                  ' <select data-conflict-choice="' +
                  `${n}` +
                  '"><option value="">Choose…</option><option value="mine">Keep mine</optio' +
                  'n><option value="shared">Take shared</option><option value="merge">Merge' +
                  " field</option></select></label><label>Merged " +
                  `${esc(f.field)}` +
                  ' <textarea data-conflict-value="' +
                  `${n}` +
                  '">' +
                  `${esc(typeof f.local === "string" ? f.local : JSON.stringify(f.local, null, 2))}` +
                  "</textarea></label>" +
                  "".concat(typeof f.local === "string" ? "" : "<small>Structured fields use JSON to preserve their value type.</small>") +
                  ""
              : `${f.localChanged ? "Keep local independent change" : "Take shared independent change"}`,
          ) +
          "</td></tr>",
      )
      .join("");
  }

  async function applyConflict() {
    const c = WriterState.PREFLIGHT_CONFLICT;
    if (!c || editor.RESOLUTION_BUSY) return;
    try {
      if (
        WriterState.PENDING.some((p) => p.cid === c.cid && p.idempotencyEvent) ||
        WriterState.DOCS.some((d) => d.caseId === c.cid && d.pendingAmendment) ||
        Object.values(editor.RECORD_ATTEMPTS).some((x) => x.cid === c.cid)
      )
        throw new Error("Confirm the pending official save before merging case details");
      if (c.comparison.added && localCaseWork(c.cid))
        throw new Error(
          "Shared history changed while local work is unfinished. Export local work" + " and review the shared case before merging fields.",
        );
      const choices = {};
      c.comparison.fields.forEach((f, n) => {
        const el = document.querySelector('[data-conflict-choice="' + n + '"]');
        if (!el) return;
        let value = document.querySelector('[data-conflict-value="' + n + '"]')?.value;
        if (el.value === "merge" && typeof f.local !== "string") value = JSON.parse(value);
        choices[f.field] = { kind: el.value, value };
      });
      const merged = resolvedCaseFields(kase(c.cid), c.file.case, c.comparison, choices);
      editor.RESOLUTION_BUSY = true;
      document.querySelectorAll("#overlay button,#overlay input,#overlay select,#overlay textarea").forEach((el) => (el.disabled = true));
      const fresh = await readSharedCase(kase(c.cid));
      if (stableJSON(fresh.case) !== stableJSON(c.file.case) || stableJSON(fresh.events) !== stableJSON(c.file.events))
        throw new Error("Shared case changed again; review it again before merging");
      const key = services.recoveryCaseKey(c.cid);
      if (!services.RECOVERY_WORKSPACE || !key) throw new Error("Recovery identity unavailable");
      const backup = services.recoverySnapshot(c.cid, key);
      backup.preReplacement = true;
      await services.helperJSON("/draft-backups/write", { workspace: services.RECOVERY_WORKSPACE, case: key, backup });
      await persistWorkspacePatch(
        (staged) => {
          staged.cases = staged.cases.map((k) => (k.id === c.cid ? merged : k));
          staged.checkpoints[c.cid] = { case: caseDetails(fresh.case), events: fresh.events.map((e) => e.id) };
          return staged;
        },
        (staged) => {
          WriterState.CASES = staged.cases;
          WriterState.SAVE_CHECKPOINTS = staged.checkpoints;
        },
      );
      WriterState.PREFLIGHT_CONFLICT = null;
      editor.state.modal = null;
      WriterState.PREFLIGHT_NOTICE = "Case field choices saved on this device. Writing the shared record checks it again.";
      editor.RESOLUTION_BUSY = false;
      await services.saveCaseFile(c.cid);
      services.render();
    } catch (error) {
      editor.RESOLUTION_BUSY = false;
      services.toast(error.message, { severity: "error" });
      services.render();
    }
  }

  function safetyCaseStatus(k) {
    const result = savedCaseState(services.app_savedworkContext(), k);
    return [result.status, result.label, result.action];
  }

  async function showSafety(cid = "") {
    const context = services.navigation.utilityContext();
    let health;
    // The panel opens immediately; slow connection checks must not hide device recovery.
    services.captureWork();
    if (editor.state.modal) {
      editor.state.modal = null;
      services.render();
    }
    services.A11Y.utility("Saved work & connection", savedWorkHTML(services.app_savedworkContext(), cid, { checking: true }));
    try {
      health = await services.helperJSON("/dw-status");
    } catch (error) {
      health = { error: error.message };
    }
    if (!services.navigation.utilityCurrent(context) || !document.querySelector("[data-saved-work-panel]")) return false;
    editor.SAFETY_HEALTH = health;
    // Keep focus and disclosures during the late health response.
    const dialog = document.getElementById("utility-dialog"),
      panel = dialog.querySelector("[data-saved-work-panel]");
    const open = [...panel.querySelectorAll("details[open][data-saved-detail]")].map((el) => el.dataset.savedDetail);
    const active = document.activeElement,
      button = active?.closest("button"),
      data = button ? { ...button.dataset } : null,
      id = active?.id,
      summary = active?.matches("summary") ? active.parentElement.dataset.savedDetail : "";
    panel.outerHTML = savedWorkHTML(services.app_savedworkContext(), cid, health);
    for (const key of open) dialog.querySelector('[data-saved-detail="' + key + '"]')?.setAttribute("open", "");
    const target = summary
      ? dialog.querySelector('[data-saved-detail="' + summary + '"] > summary')
      : id
        ? document.getElementById(id)
        : data?.safetyCase
          ? [...dialog.querySelectorAll("[data-safety-case]")].find((el) => el.dataset.safetyCase === data.safetyCase)
          : data
            ? [...dialog.querySelectorAll("button")].find((el) => Object.entries(data).every(([key, value]) => el.dataset[key] === value))
            : null;
    if (active && !active.isConnected) (target || dialog.querySelector("[data-utility-close]"))?.focus({ preventScroll: true });
  }

  async function showHealth(probe = false) {
    const context = services.navigation.utilityContext();
    let health;
    try {
      health = await services.helperJSON(probe ? "/setup/probe" : "/dw-status", probe ? {} : undefined);
    } catch (error) {
      health = { error: error.message };
    }
    if (!services.navigation.utilityCurrent(context)) return false;
    editor.SAFETY_HEALTH = health;
    const h = editor.SAFETY_HEALTH,
      check = (x) => (x === true ? "Available" : x === false ? "Unavailable" : "Not tested");
    const fields = [
      ["External integrity anchor", h.integrityAnchor || "Not configured"],
      ["Local address parser", h.addressParserStatus || "address parser unavailable; R19 fallback"],
      ["Shared folder reachable", check(h.shareReachable)],
      ["Share and case folder writable", check(h.shareWritable)],
      ["Chrome / Edge PDF renderer", check(h.chrome)],
      ["Outlook draft handoff", check(h.outlook)],
      ["SQL lookup configuration", check(h.lookupConfigured)],
      ["SQL Windows support", check(h.lookupPlatform)],
      ["SQL connection", h.lookupConnection || "Not tested"],
      ["Catalog manifest", check(h.catalogManifest)],
      ["Program/helper versions", h.versionMatch && h.version === services.navigation.helperVersion() ? "Match" : "Mismatch or helper unavailable"],
      ["Checked at", h.checkedAt || "Unavailable"],
    ];
    services.A11Y.utility(
      "Connection & setup",
      "<table><caption>Connection and installation checks</caption><thead><tr><" +
        'th scope="col">Check</th><th scope="col">Result</th></tr></thead><tbody>' +
        "".concat(fields.map(([label, value]) => `<tr><th scope="row">${label}</th><td>${esc(value)}</td></tr>`).join("")) +
        "</tbody></table><p>" +
        "".concat(esc(h.error || "SQL connection is tested by an explicit case lookup. No case content is included in these diagnostics.")) +
        '</p><button class="btn" data-health-probe>Test share write access</butto' +
        'n> <button class="btn" data-diagnostics-copy>Copy diagnostics</button><l' +
        'abel>IT diagnostics <textarea id="it-diagnostics" readonly rows="8">' +
        "".concat(esc(JSON.stringify({ program: BUILD, helper: h.version, checks: Object.fromEntries(fields) }, null, 2))) +
        "</textarea></label>",
    );
  }

  async function inspectLock() {
    const number = prompt("Case number whose lock should be inspected");
    if (!number) return;
    try {
      editor.SAFETY_LOCK = { number, ...(await services.helperJSON("/locks/status?number=" + encodeURIComponent(number))) };
      showLock();
    } catch (error) {
      services.toast(error.message, { severity: "error" });
    }
  }

  function showLock() {
    const lock = editor.SAFETY_LOCK;
    if (!lock) return;
    services.A11Y.utility(
      "Shared lock assistant",
      lock.present
        ? "<p><strong>" +
            `${esc(lock.scope || "Case saving")}` +
            "</strong> is locked. Ask an administrator to check the owning helper.</p" +
            "><p>Computer: <strong>" +
            `${esc(lock.host)}` +
            "</strong>. Process: " +
            `${lock.pid}` +
            ". Created: " +
            `${esc(new Date(lock.at * 1000).toLocaleString())}` +
            ". Age: " +
            `${Math.floor(lock.ageSeconds / 60)}` +
            " minutes.</p><p>Ask the administrator to verify that the owning helper h" +
            "as stopped and no save is running. Age alone does not establish that a l" +
            "ock is stale. Folder permissions govern administration; this form record" +
            's the administrator\'s confirmation.</p><form id="lock-release-form"><lab' +
            'el>Administrator name <input name="administrator" required minlength="2"' +
            ' maxlength="120"></label><label>Verification and reason <textarea name="' +
            'reason" required minlength="15" maxlength="1000"></textarea></label><lab' +
            'el><input name="confirmed" type="checkbox" required> Administrator has c' +
            'onfirmed it is safe to release this lock</label><button class="btn" type' +
            '="submit">Release verified lock with audit note</button></form>'
        : "<p>No lock is present for this case.</p>",
    );
  }

  function saveWorkflowPrefs() {
    WriterState.WORKFLOW_PREFS.filter = editor.state.caseFilter;
    WriterState.WORKFLOW_PREFS.query = editor.state.caseQ;
    WriterState.WORKFLOW_PREFS.inspector = editor.state.caseInspector;
    try {
      localStorage.setItem(services.WORKFLOW_PREFS_KEY, JSON.stringify(WriterState.WORKFLOW_PREFS));
    } catch (error) {
      services.toast("Could not save workspace preferences", { severity: "error" });
    }
  }

  function caseSearchText(k) {
    const docs = docsFor(k.id);
    return [
      k.number,
      k.address,
      k.owner,
      k.parcel,
      ...docs.flatMap((d) => [d.frozen?.case?.address, d.frozen?.case?.owner, ...Object.values(d.cits || {}).map((c) => c.num)]),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  async function globalSearch() {
    services.navigation.utilityContext();
    services.A11Y.utility(
      "Search shared case records",
      '<form id="global-search-form"><label>Case, address, owner or citation nu' +
        'mber <input type="search" name="query" required minlength="2" maxlength=' +
        '"200" value="' +
        `${esc(editor.state.caseQ)}` +
        '"></label><button class="btn" type="submit">Search shared case records</button>' +
        '</form><div id="global-search-results" aria-live="polite"></div>',
    );
  }
  return {
    catalogReview,
    catalogStatus,
    effectiveCatalog,
    catalogItem,
    catalogDraftBlocked,
    catalogDraftNotice,
    adoptCatalogReview,
    catalogSelection,
    catalogVisible,
    refreshCatalog,
    catalogForm,
    catalogReplacementOptions,
    catalogReviewPanel,
    compareSharedCase,
    preflightCase,
    sharedChangeModal,
    keepChangedLocal,
    openChangedShared,
    persistWorkspacePatch,
    applyConflict,
    safetyCaseStatus,
    showSafety,
    showHealth,
    inspectLock,
    showLock,
    saveWorkflowPrefs,
    caseSearchText,
    globalSearch,
    catalogReplacement,
    readSharedCase,
    localCaseWork,
    resolvedCaseFields,
    friendlyField,
    conflictControls,
  };
}
