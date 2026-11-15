// @ts-check
import { authFetch } from "./helper_transport.js";
import { isObject } from "./case_store_port.js";

/** @param {{recordIntegrity:{verify:(file:unknown,proof:unknown)=>Promise<unknown>}}} services */
export function createHelperRequests(services) {
  /** @param {string} url @param {unknown} [body] @returns {Promise<Record<string,unknown>>} */
  async function helperJSON(url, body) {
    const response = await authFetch(
      url,
      body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );
    /** @type {unknown} */
    const data = await response.json();
    if (!isObject(data)) throw new Error("The local helper returned an incomplete response. Keep pending work and retry.");
    if (!response.ok || !data.ok) {
      const error = Object.assign(new Error(String(("error" in data && data.error) || "The local helper could not complete that action")), {
        definitive: response.status >= 400 && response.status < 500,
      });
      error.name = data.missing ? "NotFoundError" : "StorageError";
      throw error;
    }
    if (data.file) await services.recordIntegrity.verify(data.file, data.integrity);
    return data;
  }
  return { helperJSON };
}
