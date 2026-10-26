import { SUMMARY_DIR } from "../assets/shared.js";
import { caseDetails, stableJSON, clone } from "./record_values.js";
import { summaryName } from "./case_file_rules.js";
import { nowISO } from "./calendar.js";
import { WriterState } from "./state.js";
import { caseStoreRequest } from "./contracts.js";
// Folder/helper write access; validation, revision and projection authority remain supplied.

export function createSharedCaseStorage(services) {
  function helperFolder() {
    return {
      name: services.CASEDIR_EXPECT,
      kind: "directory",
      helper: true,
      queryPermission: async () => "granted",
      requestPermission: async () => "granted",
      async getFileHandle(name) {
        return {
          kind: "file",
          name,
          async getFile() {
            const result = await services.helperJSON("/cases/open?name=" + encodeURIComponent(name));
            if (result.file.schema >= 5) await services.recordIntegrity.verify(result.file, result.integrity);
            services.COMMITTED.set(summaryName(result.file.case), result);
            const body = JSON.stringify(result.file);
            return { size: body.length, lastModified: Date.now(), text: async () => body };
          },
        };
      },
      async *entries() {
        const result = await services.helperJSON("/cases/list");
        for (const f of result.files) yield [f.name, { kind: "file", getFile: async () => ({ size: f.size, lastModified: f.mod }) }];
      },
    };
  }

  async function writeToFolder(name, body) {
    if (services.recordIntegrity.status(JSON.parse(body).case).valid === false)
      return { ok: false, why: "This record was changed outside the program. Read-only." };
    if (WriterState.CASEDIR && WriterState.CASEDIR.helper) {
      try {
        const file = JSON.parse(body),
          base = services.COMMITTED.get(summaryName(file.case));
        const local = WriterState.CASES.find((k) => k.number === file.case.number),
          checkpoint = local && WriterState.SAVE_CHECKPOINTS[local.id];
        const result = await services.helperJSON(
          "/cases/save",
          caseStoreRequest({ name: name, file: file, baseRevision: (base && base.revision) || "", baseCase: checkpoint ? checkpoint.case : null }),
        );
        if (result.file.schema >= 5) await services.recordIntegrity.verify(result.file, result.integrity);
        services.COMMITTED.set(summaryName(result.file.case), result);
        const current = WriterState.CASES.find((k) => k.number === result.file.case.number);
        if (current) {
          const saved = caseDetails(result.file.case),
            submitted = caseDetails(file.case);
          new Set(Object.keys(submitted).concat(Object.keys(saved))).forEach((key) => {
            if (key === "id") return;
            if (stableJSON(current[key]) === stableJSON(submitted[key])) {
              if (saved[key] === undefined) delete current[key];
              else current[key] = clone(saved[key]);
            }
          });
          services.mergeCaseEvents(current, clone(result.file));
          services.project();
        }
        WriterState.LASTWRITE = { name: result.name, ok: true, why: "", at: nowISO(), bytes: body.length };
        return { ok: true, file: result.file, name: result.name };
      } catch (error) {
        WriterState.LASTWRITE = { name: name, ok: false, why: error.message, at: nowISO() };
        return { ok: false, why: error.message };
      }
    }
    if (JSON.parse(body).schema >= 5) {
      const why = "Schema 5 requires the local helper to maintain the integrity chain.";
      WriterState.LASTWRITE = { name, ok: false, why, at: nowISO() };
      return { ok: false, why };
    }
    if (!WriterState.CASEDIR) return { ok: false, why: "no folder linked" };
    if (WriterState.NEEDGRANT) return { ok: false, why: "permission", needGrant: true };
    try {
      const fh = await WriterState.CASEDIR.getFileHandle(name, { create: true });
      const ws = await fh.createWritable();
      await ws.write(body);
      await ws.close();
      WriterState.LASTWRITE = { name: name, ok: true, why: "", at: nowISO(), bytes: body.length };
      return { ok: true };
    } catch (err) {
      const n = (err && err.name) || "";
      const why = n === "NotAllowedError" || n === "SecurityError" ? "permission" : (err && err.message) || n || "the folder refused the write";
      WriterState.LASTWRITE = { name: name, ok: false, why: (n ? n + ": " : "") + why, at: nowISO() };
      if (why === "permission") {
        WriterState.NEEDGRANT = true;
        return { ok: false, why: "permission", needGrant: true };
      }
      return { ok: false, why: why };
    }
  }

  async function writeIndexFile(name, body) {
    if (WriterState.CASEDIR && WriterState.CASEDIR.helper) {
      const committed = services.COMMITTED.get(name);
      if (!committed) return { ok: false, why: "The case has not been read or saved yet" };
      try {
        await services.helperJSON("/cases/summary", { name: committed.name, revision: committed.revision, summary: JSON.parse(body) });
        return { ok: true };
      } catch (error) {
        return { ok: false, why: error.message };
      }
    }
    if (JSON.parse(body).schema >= 5) {
      const why = "Schema 5 requires the local helper to maintain the integrity chain.";
      WriterState.LASTWRITE = { name, ok: false, why, at: nowISO() };
      return { ok: false, why };
    }
    if (!WriterState.CASEDIR) return { ok: false, why: "no folder linked" };
    if (WriterState.NEEDGRANT) return { ok: false, why: "permission" };
    try {
      const dir = await WriterState.CASEDIR.getDirectoryHandle(SUMMARY_DIR, { create: true });
      const fh = await dir.getFileHandle(name, { create: true });
      const ws = await fh.createWritable();
      await ws.write(body);
      await ws.close();
      return { ok: true };
    } catch (err) {
      return { ok: false, why: (err && (err.message || err.name)) || "the folder refused the write" };
    }
  }
  return { helperFolder, writeToFolder, writeIndexFile };
}
