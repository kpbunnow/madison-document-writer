import { editorState as editor } from "./editor_state.js";
import { startupState as startup } from "./startup_state.js";
/* Scoped UI/peer services are supplied by core; read them only when an action runs. */
import { HELPER_VERSION } from "./data/build_identity.js";

/* Main destinations and infrequent tools share safe, saved navigation. */
export function initNavigation(services) {
  const routes = new Set(["import", "cases", "library", "tools"]);
  // Import inspection is opened from Workspace, so Workspace stays the current destination while importing.
  const caseScreens = new Set(["cases", "import", "write", "reinspect", "caseactions", "actions"]);
  let navigationSequence = 0,
    utilitySequence = 0;
  const current = (sequence) => sequence === navigationSequence;
  const invalidateUtilities = () => {
    ++utilitySequence;
  };
  function utilityContext() {
    return { sequence: ++utilitySequence, screen: editor.state.screen, docId: editor.state.docId, reinspId: editor.state.reinspId };
  }
  function utilityCurrent(context) {
    return (
      context.sequence === utilitySequence &&
      context.screen === editor.state.screen &&
      context.docId === editor.state.docId &&
      context.reinspId === editor.state.reinspId
    );
  }
  function saveFailure() {
    services.toast("Your work could not be saved on this device. Keep this screen open and r" + "etry. Download a workspace backup to preserve it.", {
      severity: "error",
      key: "device-save",
      inline: true,
    });
    const parent = document.querySelector('#overlay [role="dialog"]') || document.querySelector(".main .content") || document.querySelector(".main");
    if (!parent) return;
    let banner = document.getElementById("navigation-save-failure");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "navigation-save-failure";
      banner.className = "banner alert no-print";
      banner.setAttribute("role", "alert");
      banner.innerHTML =
        "<div><strong>Work could not be saved on this device.</strong><p>Keep thi" +
        "s screen open. Download a backup of your current work, then retry the na" +
        'vigation when device saving works.</p><button class="btn" data-workbacku' +
        "p>Download workspace backup</button></div>";
    }
    parent.prepend(banner);
  }
  async function leave(action) {
    const sequence = ++navigationSequence;
    if (!startup.WORKSPACE_RESTORED && !startup.WRITER_READY) {
      await services.WRITER_READY_WAIT;
      if (!current(sequence) || !startup.WRITER_READY) return false;
    }
    ++utilitySequence;
    services.cancelCaseLookup();
    services.captureWork();
    let saved = false;
    while (current(sequence)) {
      const revision = editor.LOCAL_CHANGED;
      try {
        saved = await services.saveDrafts();
      } catch (error) {
        saved = false;
      }
      if (!saved || editor.LOCAL_CHANGED <= revision + 1) break;
    }
    if (!current(sequence)) return false;
    if (!saved) {
      saveFailure();
      return false;
    }
    await action(sequence);
    return true;
  }
  async function navigate(route) {
    if (!routes.has(route)) return false;
    return leave(() => {
      document.getElementById("utility-dialog")?.remove();
      editor.state.modal = null;
      editor.state.picker = false;
      editor.state.screen = route;
      if (route === "library") editor.state.languageMode = "browse";
      services.render();
      window.scrollTo(0, 0);
      const heading = document.querySelector(".main h1");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    });
  }
  function rail() {
    const entries = [
      ["cases", "Workspace"],
      ["library", "Order language"],
    ];
    const buttons = entries
      .map(
        ([route, label]) =>
          '<button class="rail-item" data-nav="' +
          `${route}` +
          '" ' +
          "".concat(editor.state.screen === route || (route === "cases" && caseScreens.has(editor.state.screen)) ? 'aria-current="page"' : "") +
          ">" +
          `${services.uiIcon(route)}` +
          "<span>" +
          `${label}` +
          "</span></button>",
      )
      .join("");
    const reports = startup.REPORT_RETURN
      ? `<button class="rail-item" data-report-return>${services.uiIcon("reports")}<span>Back to Reports</span></button>`
      : '<a class="rail-item" href="madison-reports.html" target="_blank" rel="no' +
        'opener" aria-label="Open Reports (opens in a new tab)">' +
        `${services.uiIcon("reports")}` +
        '<span>Open Reports</span><span class="nav-external" aria-hidden="true">↗</spa' +
        "n></a>";
    return (
      "" +
      `${buttons}` +
      "" +
      `${reports}` +
      '<button class="rail-item" data-nav="tools" ' +
      `${editor.state.screen === "tools" ? 'aria-current="page"' : ""}` +
      ">" +
      `${services.uiIcon("tools")}` +
      "<span>Tools &amp; settings</span></button>"
    );
  }
  function screen() {
    const groups = [
      [
        "Cases & planning",
        [
          ["Search shared case records", "Find shared records by case number, address, owner, citation or parcel.", "data-global-search", "search"],
          ["Reminders", "Choose upcoming deadlines and personal reinspection plans.", "data-reminders", "calendar"],
          ["Batch draft due dates", "Assign deadlines across selected items in unfinished original notices.", "data-batch-due", "calendar"],
        ],
      ],
      [
        "Saved work & connection",
        [
          [
            "Saved work & connection",
            "See device saving, shared copies, PDF filing, backups and connection checks in one place.",
            "data-sync-safety",
            "sync",
          ],
          ["Open saved case", "Open a case JSON file already saved on this computer or the share.", "data-openfile", "cases"],
        ],
      ],
    ];
    // Specialist tools; each keeps its own administrator checks. Grouping here grants no authorization.
    const adminTools = [
      [
        "Review catalog",
        "Review order language wording, ordinance authority, replacements and immutable versions.",
        'data-language-mode="admin"',
        "library",
      ],
      [
        "Administrator deposit override",
        "Record an exceptional court or division deposit with its named authorization.",
        "data-admin-deposit",
        "tools",
      ],
      ["Review snow-letter content", "Confirm seasonal sand sites, contacts and web address for new citations.", "data-admin-snow-letter", "tools"],
    ];
    const toolButton = ([label, description, attributes, icon]) =>
      '<button class="tool-action" ' +
      `${attributes}` +
      ">" +
      `${services.uiIcon(icon)}` +
      "<span><strong>" +
      `${label}` +
      "</strong><span>" +
      `${description}` +
      '</span></span><span class="tool-arrow" aria-hidden="true">→</span></butt' +
      "on>";
    // Stops the local helper for every open Writer and Reports window, after reviewing unresolved work (desktop_exit.js).
    const exitWriter =
      '<div data-tools-exit><p class="hint">Finished for the day? Exit stops Document Writer on this computer after ' +
      "saving drafts on this device and checking for unfinished work. Closing a window does not stop it.</p>" +
      '<p><button class="btn" data-exit-writer>Exit Document Writer</button></p></div>';
    const theme = document.documentElement.dataset.theme || "system";
    return services.shell(
      "Tools & settings",
      "Building Inspection",
      `<button class="btn" data-nav="cases">Back to Workspace</button>`,
      '<p class="tools-intro">Find a shared case, manage saved files, or check ' +
        "your connection. Daily case work stays in Workspace.</p>" +
        "".concat(
          groups
            .map(
              ([title, items], index) =>
                '<section class="tools-section" aria-labelledby="tools-group-' +
                `${index}` +
                '"><h2 id="tools-group-' +
                `${index}` +
                '">' +
                `${title}` +
                '</h2><div class="tools-grid">' +
                "".concat(items.map(toolButton).join("")) +
                "</div>" +
                (title === "Saved work & connection" ? exitWriter : "") +
                "</section>",
            )
            .join(""),
        ) +
        '<section class="tools-section" aria-labelledby="tools-manual"><h2 id="to' +
        'ols-manual">Program instructions</h2><p><a class="btn" href="PROGRAM-MAN' +
        'UAL.html" target="_blank" rel="noopener">Open program manual (new tab)</' +
        'a> <a class="btn" href="Program_Instruction_Manual.pdf" target="_bla' +
        'nk" rel="noopener">Printable manual PDF</a></p></section><section class=' +
        '"tools-section" aria-labelledby="tools-display"><h2 id="tools-display">D' +
        'isplay &amp; help</h2><div class="tools-grid"><label class="tool-theme">' +
        "<strong>Color theme</strong><span>Use your device setting or choose a re" +
        'adable display.</span><select data-a11y-theme aria-label="Color theme">' +
        "".concat(
          [
            ["system", "Use device setting"],
            ["light", "Light"],
            ["dark", "Dark"],
            ["high", "High contrast"],
          ]
            .map(([value, label]) => `<option value="${value}" ${value === theme ? "selected" : ""}>${label}</option>`)
            .join(""),
        ) +
        '</select></label><button class="tool-action" data-a11y-history>' +
        `${services.uiIcon("files")}` +
        "<span><strong>Message history</strong><span>Review earlier save confirma" +
        'tions, warnings and errors.</span></span><span class="tool-arrow" aria-h' +
        'idden="true">→</span></button><button class="tool-action" data-a11y-help' +
        ">" +
        `${services.uiIcon("tools")}` +
        "<span><strong>Keyboard shortcuts</strong><span>See available keys. Press" +
        ' ? outside a text field for quick help.</span></span><span class="tool-a' +
        'rrow" aria-hidden="true">→</span></button></div></section>' +
        '<section class="tools-section tools-admin" aria-labelledby="tools-admin"><details data-tools-admin><summary id="tools-admin">Administrator tools</summary>' +
        '<p class="hint">Specialist tools for division administrators. Access still depends on the existing administrator checks; this grouping does not grant authorization.</p>' +
        '<div class="tools-grid">' +
        adminTools.map(toolButton).join("") +
        "</div></details></section>",
    );
  }
  function helperVersion() {
    return HELPER_VERSION;
  }
  return { rail, screen, navigate, leave, current, utilityContext, utilityCurrent, invalidateUtilities, helperVersion };
}
