// @ts-check
import { html, raw } from "./screen_html.js";
/* Shared by Writer and Reports: the state shown after Exit Document Writer stopped the local helper.
   Closing a window never stops the helper; only the authenticated Exit Document Writer request does. */
const HELPER_STOPPED_CHANNEL = "madison-helper-stopped-v1";
const STOPPED_TITLE = "Document Writer has stopped";
export const STOPPED_TEXT = "Document Writer has stopped. You can close this window. To start again, double-click Document Writer on the desktop.";
/** @type {{stopped:boolean,channel:BroadcastChannel|null,instance:string}} */
export const helperStop = { stopped: false, channel: null, instance: "" };

/** @type {Record<string,string>} */
const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** @param {unknown} s */
const escapeText = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** @param {string[]} [details] */
function stoppedHTML(details = []) {
  return html`<main data-helper-stopped style="max-width:620px;margin:12vh auto;padding:28px;font-family:system-ui"><h1 tabindex="-1">${raw(STOPPED_TITLE)}</h1><p>You can close this window. To start again, double-click <strong>Document Writer</strong> on the desktop.</p>${raw(details.map((text) => "<p>" + escapeText(text) + "</p>").join(""))}</main>`;
}

/* Replace the page with the stopped state. Later renders and helper requests are refused (see authFetch). */
/** @param {string[]} [details] */
export function showStopped(details = []) {
  helperStop.stopped = true;
  const app = document.getElementById("app");
  if (!app) return;
  const dialog = document.getElementById("utility-dialog");
  if (dialog) {
    if ("open" in dialog && dialog.open && "close" in dialog && typeof dialog.close === "function") dialog.close();
    dialog.remove();
  }
  const overlay = document.getElementById("overlay");
  if (overlay) overlay.innerHTML = "";
  app.innerHTML = stoppedHTML(details);
  app.dataset.renderScreen = "stopped";
  document.title = STOPPED_TITLE;
  app.querySelector("h1")?.focus?.();
}

/* Other open Writer and Reports windows of this browser profile learn of the stop and show the same state. */
/** @param {()=>void} onStopped */
export function listenForStop(onStopped) {
  if (typeof window === "undefined" || !("BroadcastChannel" in window) || helperStop.channel) return helperStop.channel;
  try {
    const meta = document.querySelector('meta[name="docwriter-instance"]');
    helperStop.instance = String((meta && Reflect.get(meta, "content")) || "");
    helperStop.channel = new window.BroadcastChannel(HELPER_STOPPED_CHANNEL);
    helperStop.channel.onmessage = (event) => {
      if (event.data?.kind === "stopped" && helperStop.instance && event.data.instance === helperStop.instance && !helperStop.stopped) onStopped();
    };
  } catch {
    helperStop.channel = null; /* Without a channel, other windows show their own connection errors instead. */
  }
  return helperStop.channel;
}

export function announceStop() {
  try {
    if (helperStop.instance) helperStop.channel?.postMessage({ kind: "stopped", instance: helperStop.instance });
  } catch {
    /* Other windows then report the lost connection on their next request. */
  }
}
