// @ts-check
/// <reference path="./build_flags.d.ts" />
/* Every helper call carries this page's current, memory-only session token. */
import { helperStop, STOPPED_TEXT } from "./helper_stopped.js";
/** @param {string} url @param {RequestInit} [options] */
export async function authFetch(url, options = {}) {
  if (helperStop.stopped) throw new Error(STOPPED_TEXT);
  const headers = new Headers(options.headers || {});
  const meta = document.querySelector('meta[name="docwriter-token"]');
  /** @type {unknown} */
  const token = meta ? Reflect.get(meta, "content") : undefined;
  if (!token && !__TEST_BUILD__) throw new Error("Open the program from the installed desktop shortcut to reconnect. Your device work is retained.");
  if (token) headers.set("X-DocWriter-Token", String(token));
  const response = await fetch(url, { ...options, headers });
  if (response.status === 403 && token)
    throw new Error("The helper session changed or refused this request. Reload the program to reconnect; your device work is retained.");
  return response;
}
