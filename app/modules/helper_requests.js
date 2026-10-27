import { authFetch } from "./helper_transport.js";

export function createHelperRequests(services) {
  async function helperJSON(url, body) {
    const response = await authFetch(
      url,
      body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );
    const data = await response.json();
    if (!response.ok || !data.ok) {
      const error = new Error(data.error || "The local helper could not complete that action");
      error.name = data.missing ? "NotFoundError" : "StorageError";
      error.definitive = response.status >= 400 && response.status < 500;
      throw error;
    }
    if (data.file) await services.recordIntegrity.verify(data.file, data.integrity);
    return data;
  }
  return { helperJSON };
}
