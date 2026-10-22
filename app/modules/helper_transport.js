/* Every helper call carries this page's current, memory-only session token. */
import { helperStop, STOPPED_TEXT } from "./helper_stopped.js";
export async function authFetch(url, options = {}) {
  if (helperStop.stopped) throw new Error(STOPPED_TEXT);
  const headers = new Headers(options.headers || {});
  const token = document.querySelector('meta[name="docwriter-token"]')?.content;
  if (!token && !__TEST_BUILD__) throw new Error("Open the program from the installed desktop shortcut to reconnect. Your device work is retained.");
  if (token) headers.set("X-DocWriter-Token", token);
  const response = await fetch(url, { ...options, headers });
  if (response.status === 403 && token)
    throw new Error("The helper session changed or refused this request. Reload the program t" + "o reconnect; your device work is retained.");
  return response;
}
