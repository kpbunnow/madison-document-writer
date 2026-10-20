import { toast as dep_toast } from "./court_and_deposits.js";
import { shell as dep_shell } from "./workspace_shell.js";
import { saveDrafts as dep_saveDrafts } from "./case_files.js";
import { uiIcon as dep_uiIcon } from "./reinspection_walkthrough.js";
import { captureWork as dep_captureWork } from "./issuance_and_corrections.js";
import { cancelCaseLookup as dep_cancelCaseLookup, render as dep_render } from "./inspection_import.js";
import { HELPER_VERSION as dep_HELPER_VERSION } from "./data/build_identity.js";
import { WriterState } from "./state.js";
/* Main destinations and infrequent tools share safe, saved navigation. */
export function initNavigation() {
  const routes = new Set(["import", "cases", "library", "tools"]);
  const caseScreens = new Set(["cases", "write", "reinspect", "caseactions", "actions"]);
  let navigationSequence = 0,
    utilitySequence = 0;
  const current = (sequence) => sequence === navigationSequence;
  const invalidateUtilities = () => {
    ++utilitySequence;
  };
  function utilityContext() {
    return { sequence: ++utilitySequence, screen: WriterState.state.screen, docId: WriterState.state.docId, reinspId: WriterState.state.reinspId };
  }
  function utilityCurrent(context) {
    return (
      context.sequence === utilitySequence &&
      context.screen === WriterState.state.screen &&
      context.docId === WriterState.state.docId &&
      context.reinspId === WriterState.state.reinspId
    );
  }
  function saveFailure() {
    dep_toast("Your work could not be saved on this device. Keep this screen open and r" + "etry. Download a workspace backup to preserve it.", {
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
    ++utilitySequence;
    dep_cancelCaseLookup();
    dep_captureWork();
    let saved = false;
    while (current(sequence)) {
      const revision = WriterState.LOCAL_CHANGED;
      try {
        saved = await dep_saveDrafts();
      } catch (error) {
        saved = false;
      }
      if (!saved || WriterState.LOCAL_CHANGED <= revision + 1) break;
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
      WriterState.state.modal = null;
      WriterState.state.picker = false;
      WriterState.state.screen = route;
      if (route === "library") WriterState.state.languageMode = "browse";
      dep_render();
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
      ["import", "Import inspection"],
      ["cases", "Workspace"],
      ["library", "Order language"],
    ];
    const buttons = entries
      .map(
        ([route, label]) =>
          '<button class="rail-item" data-nav="' +
          `${route}` +
          '" ' +
          "".concat(
            WriterState.state.screen === route || (route === "cases" && caseScreens.has(WriterState.state.screen)) ? 'aria-current="page"' : "",
          ) +
          ">" +
          `${dep_uiIcon(route)}` +
          "<span>" +
          `${label}` +
          "</span></button>",
      )
      .join("");
    const reports = WriterState.REPORT_RETURN
      ? `<button class="rail-item" data-report-return>${dep_uiIcon("reports")}<span>Back to Reports</span></button>`
      : '<a class="rail-item" href="madison-reports.html" target="_blank" rel="no' +
        'opener" aria-label="Reports (opens in a new tab)">' +
        `${dep_uiIcon("reports")}` +
        '<span>Reports</span><span class="nav-external" aria-hidden="true">↗</spa' +
        "n></a>";
    return (
      "" +
      `${buttons}` +
      "" +
      `${reports}` +
      '<button class="rail-item" data-nav="tools" ' +
      `${WriterState.state.screen === "tools" ? 'aria-current="page"' : ""}` +
      ">" +
      `${dep_uiIcon("tools")}` +
      "<span>Tools &amp; settings</span></button>"
    );
  }
  function screen() {
    const groups = [
      [
        "Cases & planning",
        [
          ["Search all cases", "Find shared records by case number, address, owner, citation or parcel.", "data-global-search", "search"],
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
      [
        "Administration",
        [
          [
            "Order language review",
            "Review wording, ordinance authority, replacements and immutable versions.",
            'data-language-mode="admin"',
            "library",
          ],
          [
            "Administrator deposit override",
            "Record an exceptional court or division deposit with its named authorization.",
            "data-admin-deposit",
            "tools",
          ],
          [
            "Review snow-letter content",
            "Confirm seasonal sand sites, contacts and web address for new citations.",
            "data-admin-snow-letter",
            "tools",
          ],
        ],
      ],
    ];
    const theme = document.documentElement.dataset.theme || "system";
    return dep_shell(
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
                "".concat(
                  items
                    .map(
                      ([label, description, attributes, icon]) =>
                        '<button class="tool-action" ' +
                        `${attributes}` +
                        ">" +
                        `${dep_uiIcon(icon)}` +
                        "<span><strong>" +
                        `${label}` +
                        "</strong><span>" +
                        `${description}` +
                        '</span></span><span class="tool-arrow" aria-hidden="true">→</span></butt' +
                        "on>",
                    )
                    .join(""),
                ) +
                "</div></section>",
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
        `${dep_uiIcon("files")}` +
        "<span><strong>Message history</strong><span>Review earlier save confirma" +
        'tions, warnings and errors.</span></span><span class="tool-arrow" aria-h' +
        'idden="true">→</span></button><button class="tool-action" data-a11y-help' +
        ">" +
        `${dep_uiIcon("tools")}` +
        "<span><strong>Keyboard shortcuts</strong><span>See available keys. Press" +
        ' ? outside a text field for quick help.</span></span><span class="tool-a' +
        'rrow" aria-hidden="true">→</span></button></div></section>',
    );
  }
  function helperVersion() {
    return dep_HELPER_VERSION;
  }
  return { rail, screen, navigate, leave, current, utilityContext, utilityCurrent, invalidateUtilities, helperVersion };
}
