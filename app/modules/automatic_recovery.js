import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { recoveryState as recovery } from "./recovery_state.js";
import { stableJSON, clone } from "./record_values.js";
import { doc, eventsFor, kase } from "./writer_queries.js";
import { nowISO } from "./calendar.js";
import { BUILD } from "./data/build_identity.js";
import { WriterState } from "./state.js";

// Automatic recovery identity/snapshots/write scheduling; browser storage, timers and helper/UI stay supplied.
export function createAutomaticRecovery(services) {
  function recoveryWorkspace() {
    try {
      let id = services.localStorage.getItem(services.RECOVERY_WORKSPACE_KEY);
      if (!/^[a-f0-9]{32}$/.test(id || "")) {
        id = services.rnd12() + services.rnd12();
        services.localStorage.setItem(services.RECOVERY_WORKSPACE_KEY, id);
      }
      return id;
    } catch (e) {
      return null;
    }
  }

  function recoveryCaseKey(cid) {
    try {
      const map = JSON.parse(services.localStorage.getItem(services.RECOVERY_CASE_KEYS) || "{}");
      if (!/^[a-f0-9]{32}$/.test(map[cid] || "")) {
        map[cid] = services.rnd12() + services.rnd12();
        services.localStorage.setItem(services.RECOVERY_CASE_KEYS, JSON.stringify(map));
      }
      return map[cid];
    } catch (e) {
      return null;
    }
  }

  function recoveryIncluded(cid) {
    const ds = workspace.DOCS.filter((d) => d.draft && d.caseId === cid),
      rs = workspace.REINSP.filter((r) => r.draft && r.caseId === cid);
    const acts = Object.values(editor.RECORD_ATTEMPTS).filter((x) => x.cid === cid);
    const pending = workspace.PENDING.filter((p) => p.cid === cid);
    const forms = Object.keys(editor.WORK.recordForms || {}).filter((id) =>
      workspace.DOCS.some((d) => d.id === id.split(":")[0] && d.caseId === cid),
    );
    return [
      ...(ds.length ? [ds.length + " document draft(s)"] : []),
      ...(rs.length ? [rs.length + " worksheet(s)"] : []),
      ...(forms.length ? [forms.length + " record form(s)"] : []),
      ...(acts.length ? [acts.length + " pending correction/record action(s)"] : []),
      ...(pending.length ? [pending.length + " held shared operation(s)"] : []),
    ];
  }

  function recoverySnapshot(cid, key) {
    const k = kase(cid),
      b = services.draftBundle();
    return {
      format: "madison-draft-recovery",
      version: 1,
      build: BUILD,
      workspace: services.RECOVERY_WORKSPACE,
      case: key,
      number: k.number,
      at: nowISO(),
      included: recoveryIncluded(cid),
      bundle: {
        integrityRecords: b.integrityRecords.filter((f) => f.case.number === k.number),
        cases: [clone(k)],
        docs: clone(b.docs.filter((d) => d.caseId === cid)),
        reinsp: clone(b.reinsp.filter((r) => r.caseId === cid)),
        events: { [cid]: clone(eventsFor(cid)) },
        recordAttempts: Object.fromEntries(Object.entries(editor.RECORD_ATTEMPTS).filter(([, v]) => v.cid === cid)),
        checkpoints: { [cid]: clone(workspace.SAVE_CHECKPOINTS[cid] || null) },
        seq: b.seq,
        work: {
          entry: {},
          acc: null,
          walk: editor.WORK.walk?.context?.startsWith(cid + "|") ? clone(editor.WORK.walk) : null,
          recordForms: Object.fromEntries(Object.entries(editor.WORK.recordForms || {}).filter(([id]) => doc(id.split(":")[0])?.caseId === cid)),
        },
      },
      pending: clone(workspace.PENDING.filter((p) => p.cid === cid)),
    };
  }

  function recoveryJobs() {
    if (!services.RECOVERY_WORKSPACE) throw new Error("Browser workspace identity cannot be stored");
    const jobs = workspace.CASES.filter((k) => recoveryIncluded(k.id).length).map((k) => ({ cid: k.id, key: recoveryCaseKey(k.id) }));
    if (editor.state.acc || editor.WORK.acc || String(editor.WORK.entry?.["lookup-number"] || "").trim())
      jobs.push({ cid: null, key: "00000000000000000000000000000000" });
    return jobs.map((job) => {
      if (!job.key) throw new Error("Case backup identity cannot be stored");
      const backup = job.cid
        ? recoverySnapshot(job.cid, job.key)
        : {
            format: "madison-draft-recovery",
            version: 1,
            build: BUILD,
            workspace: services.RECOVERY_WORKSPACE,
            case: job.key,
            number: "Import in progress",
            at: nowISO(),
            included: ["saved import work"],
            bundle: {
              cases: [],
              docs: [],
              reinsp: [],
              events: {},
              recordAttempts: {},
              checkpoints: {},
              seq: workspace.seq,
              work: clone(editor.WORK),
            },
            pending: [],
          };
      return { workspace: services.RECOVERY_WORKSPACE, case: job.key, backup };
    });
  }

  async function backupUnfinished(jobs) {
    if (!jobs.length) return;
    const errors = [];
    for (const job of jobs) {
      const signature = stableJSON({ bundle: job.backup.bundle, pending: job.backup.pending, included: job.backup.included });
      const key = job.workspace + "|" + job.case;
      if (recovery.RECOVERY_SIGNATURES[key] === signature) continue;
      try {
        await services.helperJSON("/draft-backups/write", job);
        recovery.RECOVERY_SIGNATURES[key] = signature;
        recovery.RECOVERY.at = nowISO();
      } catch (error) {
        errors.push((job.backup.number || job.case) + ": " + error.message);
      }
    }
    recovery.RECOVERY.error = errors.join("; ");
  }

  function scheduleRecoveryBackup() {
    if (!WriterState.HELPER) return;
    services.clearTimeout(recovery.RECOVERY_TIMER);
    recovery.RECOVERY_TIMER = services.setTimeout(() => {
      let jobs;
      try {
        jobs = recoveryJobs();
      } catch (e) {
        recovery.RECOVERY.error = e.message;
        services.renderRecoveryStatus();
        return;
      }
      recovery.RECOVERY_NEXT = jobs; // Keep only the latest successfully saved browser state.
      if (recovery.RECOVERY_BUSY) return;
      recovery.RECOVERY_BUSY = true;
      (async () => {
        while (recovery.RECOVERY_NEXT) {
          const pending = recovery.RECOVERY_NEXT;
          recovery.RECOVERY_NEXT = null;
          try {
            await backupUnfinished(pending);
          } catch (e) {
            recovery.RECOVERY.error = e.message || String(e);
          }
          services.renderRecoveryStatus();
        }
        recovery.RECOVERY_BUSY = false;
      })().catch((e) => {
        recovery.RECOVERY_BUSY = false;
        recovery.RECOVERY.error = e.message;
        services.renderRecoveryStatus();
      });
    }, 700);
  }
  return {
    recoveryWorkspace,
    recoveryCaseKey,
    recoverySnapshot,
    recoveryJobs,
    backupUnfinished,
    scheduleRecoveryBackup,
    ...(__TEST_BUILD__ ? { recoveryIncluded } : {}),
  };
}
