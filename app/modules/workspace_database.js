import { workspaceState as workspace } from "./workspace_state.js";

// Device database access only; workspace readiness, save queues and restoration remain callers’ responsibilities.
export function createWorkspaceDatabase(services) {
  function idb() {
    if (workspace.IDBCONN) return workspace.IDBCONN;
    workspace.IDBCONN = new Promise((res, rej) => {
      if (!services.IDB_OK) return rej(new Error("no indexeddb"));
      const rq = services.indexedDB.open("madison-doc-writer", 1);
      rq.onupgradeneeded = () => {
        if (!rq.result.objectStoreNames.contains("kv")) rq.result.createObjectStore("kv");
      };
      rq.onsuccess = () => {
        const db = rq.result;
        db.onversionchange = () => {
          try {
            db.close();
          } catch (e) {
            /* The connection is already being retired; clear its reference even when close reports an error. */
          }
          workspace.IDBCONN = null;
        };
        db.onclose = () => {
          workspace.IDBCONN = null;
        };
        res(db);
      };
      rq.onerror = () => rej(rq.error);
    });
    workspace.IDBCONN.catch(() => {
      workspace.IDBCONN = null;
    });
    return workspace.IDBCONN;
  }

  async function idbGet(key, required = false) {
    try {
      const db = await idb();
      return await new Promise((res, rej) => {
        const rq = db.transaction("kv", "readonly").objectStore("kv").get(key);
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => rej(rq.error);
      });
    } catch (e) {
      workspace.IDBCONN = null;
      if (required) throw e;
      return undefined;
    }
  }

  async function idbSet(key, val) {
    try {
      const db = await idb();
      return await new Promise((res, rej) => {
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(val, key);
        tx.oncomplete = () => res(true);
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error);
      });
    } catch (e) {
      workspace.IDBCONN = null;
      return false;
    }
  }
  return { idb, idbGet, idbSet };
}
