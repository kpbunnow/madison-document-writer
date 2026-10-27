import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { caseFile, caseNumberAllowed } from "./case_records.js";
import { caseFileFault, summaryName } from "./case_file_rules.js";
import { migrate } from "./case_migrations.js";
import { kase } from "./writer_queries.js";
import { nowISO } from "./calendar.js";

export function createCaseFolderWorkflow(services) {
  async function writeSummary(cid, saved) {
    const k = kase(cid);
    if (!caseNumberAllowed(k)) {
      services.toast("Case number needs correction before reporting");
      return false;
    }
    const name = summaryName(k);
    let body;
    try {
      body = JSON.stringify(services.summarize(saved || caseFile(cid)));
    } catch (err) {
      workspace.LASTINDEX = { name: name, ok: false, why: "could not be assembled: " + ((err && err.message) || err), at: nowISO() };
      return false;
    }
    const r = await services.writeIndexFile(name, body);
    workspace.LASTINDEX = { name: name, ok: r.ok, why: r.why || "", at: nowISO() };
    return r.ok;
  }

  async function rebuildIndex() {
    if (!workspace.CASEDIR) {
      services.toast("Link the case folder first");
      return null;
    }
    if (workspace.NEEDGRANT) await services.grantCaseFolder(true);
    if (workspace.NEEDGRANT) {
      services.toast("The browser did not grant access to " + workspace.DIRNAME + " — the index was not rebuilt");
      return null;
    }
    const files = (await listCaseFolder()).filter((x) => x.name.charAt(0) !== "_");
    const out = { written: 0, refused: [], failed: [], total: files.length, at: nowISO() };
    editor.state.reindex = { running: true, done: 0, total: files.length };
    services.render();
    for (let n = 0; n < files.length; n++) {
      const nm = files[n].name;
      let f;
      try {
        const fh = await workspace.CASEDIR.getFileHandle(nm);
        f = migrate(JSON.parse(await (await fh.getFile()).text()));
      } catch (err) {
        out.refused.push(nm + " \u2014 " + ((err && err.message) || "not readable"));
        continue;
      }
      const fault = caseFileFault(f);
      if (fault) {
        out.refused.push(nm + " \u2014 " + fault);
        continue;
      }
      let body;
      try {
        body = JSON.stringify(services.summarize(f));
      } catch (err) {
        out.refused.push(nm + " \u2014 could not be summarized: " + ((err && err.message) || err));
        continue;
      }
      const r = await services.writeIndexFile(summaryName(f["case"]), body);
      if (r.ok) out.written++;
      else out.failed.push(nm + " \u2014 " + r.why);
      editor.state.reindex.done = n + 1;
    }
    editor.state.reindex = out;
    workspace.LASTINDEX = {
      name: out.written + " of " + out.total + " case files",
      ok: !out.failed.length,
      why: out.failed.length ? out.failed.length + " could not be written" : "",
      at: out.at,
    };
    services.render();
    services.toast(
      "Reporting index rebuilt \u2014 " +
        out.written +
        " of " +
        out.total +
        " case file" +
        (out.total === 1 ? "" : "s") +
        (out.refused.length ? ", " + out.refused.length + " refused" : "") +
        (out.failed.length ? ", " + out.failed.length + " not written" : ""),
    );
    return out;
  }

  async function listCaseFolder() {
    if (!workspace.CASEDIR || workspace.NEEDGRANT) return [];
    const out = [];
    try {
      for await (const [name, h] of workspace.CASEDIR.entries()) {
        if (h.kind === "file" && /\.json$/i.test(name)) {
          let size = 0,
            mod = 0;
          try {
            const f = await h.getFile();
            size = f.size;
            mod = f.lastModified;
          } catch (e) {
            /* Unreadable optional directory metadata stays unknown; opening and saving still validate actual bytes. */
          }
          out.push({ name: name, size: size, mod: mod });
        }
      }
    } catch (e) {
      services.toast("Could not read the case folder — " + (e.message || e));
      editor.state.folderError = e.message || String(e);
    }
    return out.sort((a, b) => b.mod - a.mod);
  }

  async function openFromFolder(name) {
    if (!workspace.CASEDIR) return;
    try {
      const fh = await workspace.CASEDIR.getFileHandle(name);
      const f = await fh.getFile();
      const raw = await f.text(),
        record = JSON.parse(raw);
      if (record.schema >= 5) await services.recordIntegrity.verify(record);
      services.loadCaseFile(raw);
    } catch (e) {
      services.toast("Could not open " + name);
    }
  }
  return { writeSummary, rebuildIndex, listCaseFolder, openFromFolder };
}
