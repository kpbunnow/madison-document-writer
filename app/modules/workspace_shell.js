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
    return (
      '<div class="app">\n    <aside class="rail no-print">\n      <div class="ra' +
      'il-brand"><img class="rail-logo" src="' +
      `${LOGO}` +
      '" alt="City of Madison Building Inspection"><div class="rail-sub">Docume' +
      'nt Writer</div></div>\n      <nav class="writer-navigation" aria-label="M' +
      'ain navigation">' +
      `${nav}` +
      '</nav>\n      <div class="rail-foot"><strong>Building Inspection</strong>' +
      'City of Madison<span id="save-status" role="status" aria-live="polite">D' +
      'rafts save on this device</span><span class="build" title="Which build i' +
      's running">Build ' +
      `${esc(BUILD)}` +
      '</span></div>\n    </aside>\n    <div class="main">\n      <header class="t' +
      'opbar no-print"><div><span class="crumb">' +
      `${esc(crumb)}` +
      "</span><h1>" +
      `${esc(title)}` +
      '</h1></div><div class="topbar-actions">' +
      `${actions || ""}` +
      '</div></header>\n      <div class="content">' +
      `${services.recordIntegrity.banner()}` +
      "" +
      `${storageBar()}` +
      "" +
      `${body}` +
      "</div>\n    </div></div>"
    );
  }
  return { shell };
}
