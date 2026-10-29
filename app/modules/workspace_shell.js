import { html, raw } from "./screen_html.js";
import { esc } from "./presentation_format.js";
import { BUILD, LOGO } from "./data/build_identity.js";
import { connectionBanner } from "./saved_work.js";

export function createWorkspaceShell(services) {
  function storageBar() {
    return connectionBanner(services.app_savedworkContext());
  }

  /* The screen frame. title and crumb are plain text and are escaped here (callers never pre-escape them);
     actions and body are HTML built by the caller. */
  function shell(title, crumb, actions, body) {
    const nav = services.navigation.rail();
    return html`<div class="app">
    <aside class="rail no-print">
      <div class="rail-brand"><img class="rail-logo" src="${String(LOGO)}" alt="City of Madison Building Inspection"><div class="rail-sub">Document Writer</div></div>
      <nav class="writer-navigation" aria-label="Main navigation">${raw(nav)}</nav>
      <div class="rail-foot"><strong>Building Inspection</strong>City of Madison<span id="save-status" role="status" aria-live="polite">Drafts save on this device</span><span class="build" title="Which build is running">Build ${raw(esc(BUILD))}</span></div>
    </aside>
    <div class="main">
      <header class="topbar no-print"><div><span class="crumb">${raw(esc(crumb))}</span><h1>${raw(esc(title))}</h1></div><div class="topbar-actions">${raw(actions || "")}</div></header>
      <div class="content">${raw(services.recordIntegrity.banner())}${raw(storageBar())}${raw(body)}</div>
    </div></div>`;
  }
  return { shell };
}
