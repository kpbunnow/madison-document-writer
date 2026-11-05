/* Real Chromium owner seam: repaint identity/caret and redirect timing before extraction. */
const assert = require("node:assert/strict");
const esbuild = require("esbuild");
const { chromium } = require("playwright");
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents:
        'import {createAppScreens} from "./app/modules/app_screens.js"; import {createContactEvents} from "./app/modules/contact_events.js"; import {WriterState} from "./app/modules/state.js"; window.audit={createAppScreens,createContactEvents,WriterState};',
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: "iife",
    plugins: [
      {
        name: "data",
        setup(b) {
          b.onResolve({ filter: /\/data\// }, (a) => ({
            path: require("node:path").resolve("build/generated/modules/data", require("node:path").basename(a.path)),
          }));
        },
      },
    ],
  });
  const browser = await chromium.launch({ executablePath: process.env.DW_BROWSER || undefined, headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<div id="app"></div><div id="overlay"></div>');
    await page.addScriptTag({ content: built.outputFiles[0].text });
    const result = await page.evaluate(() => {
      const { createAppScreens, WriterState: s } = window.audit;
      s.WRITER_READY = true;
      s.STARTUP_STATUS = "ready";
      s.state = { screen: "write", docId: "d", modal: null, picker: false };
      s.DOCS = [{ id: "d", items: [{ id: "i", text: "typed text" }] }];
      const calls = [];
      const noop = () => {};
      const services = {
        document,
        window,
        location,
        IDB_OK: true,
        A11Y: { rememberFocus: noop, enhance: noop },
        app_languagediscoveryContext: () => ({ state: s.state }),
        isLocked: () => false,
        ensureWalkContext: noop,
        screenCases: () => "<h1>Cases</h1>",
        screenWrite: () =>
          '<div class="document-workspace" data-editor-doc="d"><div data-field="text" data-id="i" contenteditable="true">typed text</div><details class="editor-more"><summary>Actions</summary><button id="action">Save</button></details></div>',
        overlayHTML: () => "",
        paginate: () => calls.push("paginate"),
        editorEnhance: () => calls.push("editor"),
        restoreWorkControls: noop,
        updateSaveStatus: noop,
        enhanceDialog: noop,
        highlightOpenChecks: noop,
      };
      const screens = createAppScreens(services);
      screens.render();
      const live = document.querySelector('[data-field="text"]');
      live.focus();
      const range = document.createRange();
      range.setStart(live.firstChild, 2);
      range.setEnd(live.firstChild, 6);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      screens.render();
      const kept = live === document.querySelector('[data-field="text"]') && live === document.activeElement;
      const caret = [getSelection().anchorOffset, getSelection().focusOffset];
      document.querySelector(".editor-more").open = true;
      document.getElementById("action").focus();
      screens.render();
      const actions = document.querySelector(".editor-more").open && document.activeElement.id === "action";
      calls.length = 0;
      services.screenWrite = () => {
        s.state.screen = "cases";
        return services.screenCases();
      };
      screens.render();
      const redirected = document.getElementById("app").dataset.renderScreen === "cases" && calls.length === 0;
      s.state.screen = "write";
      services.ensureWalkContext = () => {
        s.state.screen = "cases";
      };
      services.screenWrite = () => {
        throw new Error("captured route before walk context");
      };
      screens.render();
      return { kept, caret, actions, redirected, routeAfterWalk: document.querySelector("h1").textContent === "Cases" };
    });
    assert.deepEqual(result, { kept: true, caret: [2, 6], actions: true, redirected: true, routeAfterWalk: true });
    // A passive history/helper repaint can arrive after focus but before the next native input event.
    // Use real contact handlers and keyboard input; a detached/replaced field must not swallow the edit.
    for (const [attribute, key] of [
      ["cc", "0|addr"],
      ["cc", "0|city"],
      ["agent", "addr"],
      ["em", "0|addr"],
    ]) {
      await page.evaluate(
        ({ attribute, key }) => {
          const { createAppScreens, createContactEvents, WriterState: s } = window.audit;
          s.state = { screen: "write", docId: "recipient-draft", modal: "cc", picker: false };
          s.CASES = [{ id: "recipient-case", ccList: [{ name: "Synthetic", addr: "", city: "" }], agent: { addr: "" }, emails: [{ addr: "" }] }];
          s.DOCS = [{ id: "recipient-draft", caseId: "recipient-case", draft: true, items: [] }];
          const noop = () => {};
          const read = () =>
            attribute === "cc" ? s.CASES[0].ccList[0][key.split("|")[1]] : attribute === "em" ? s.CASES[0].emails[0].addr : s.CASES[0].agent.addr;
          const write = (value) => {
            const target = attribute === "cc" ? s.CASES[0].ccList[0] : attribute === "em" ? s.CASES[0].emails[0] : s.CASES[0].agent;
            target[attribute === "cc" ? key.split("|")[1] : "addr"] = value;
          };
          const services = {
            document,
            window,
            location,
            IDB_OK: true,
            A11Y: { rememberFocus: noop, enhance: noop },
            app_languagediscoveryContext: () => ({ state: s.state }),
            isLocked: () => false,
            ensureWalkContext: noop,
            screenWrite: () => '<div class="document-workspace" data-editor-doc="recipient-draft"></div>',
            overlayHTML: () =>
              '<div class="modal"><input type="' +
              (attribute === "em" ? "email" : "text") +
              '" data-' +
              attribute +
              '="' +
              key +
              '" value="' +
              read() +
              '"></div>',
            paginate: noop,
            editorEnhance: noop,
            restoreWorkControls: noop,
            updateSaveStatus: noop,
            enhanceDialog: noop,
            highlightOpenChecks: noop,
            validateAndStandardizeAddresses: () => null,
            recipientPreview: () => "",
            scheduleDraftSave: noop,
          };
          const contacts = createContactEvents(services);
          if (window.recipientInput) document.removeEventListener("input", window.recipientInput);
          window.recipientInput = (event) => contacts.editRecipient(event.target);
          document.addEventListener("input", window.recipientInput);
          const screens = createAppScreens(services);
          screens.render();
          const field = document.querySelector("#overlay input");
          field.focus();
          window.recipientProbe = { screens, services, field, read, write, s };
          screens.render();
        },
        { attribute, key },
      );
      const entered = attribute === "em" ? "test@example.test" : "PO BOX 123";
      await page.keyboard.insertText(entered);
      assert.deepEqual(
        await page.evaluate(() => ({ value: recipientProbe.read(), same: recipientProbe.field === document.activeElement })),
        { value: entered, same: true },
        attribute + ": passive refresh must retain the active field and native input",
      );
      await page.evaluate(() => {
        const field = recipientProbe.field;
        if (field.type !== "email") field.setSelectionRange(3, 6);
        recipientProbe.screens.render();
      });
      assert.deepEqual(
        await page.evaluate(() => [document.activeElement.selectionStart, document.activeElement.selectionEnd]),
        attribute === "em" ? [null, null] : [3, 6],
      );
      const updated = await page.evaluate(() => {
        const { screens, services, field, write } = recipientProbe;
        const markup = services.overlayHTML;
        services.overlayHTML = () => markup().replace("<input", '<input aria-invalid="true"');
        screens.render();
        const invalid = field.isConnected && field.getAttribute("aria-invalid") === "true";
        write("UPDATED BY MODEL");
        screens.render();
        return { invalid, replaced: !field.isConnected, value: document.querySelector("#overlay input").value };
      });
      assert.deepEqual(
        updated,
        { invalid: true, replaced: true, value: "UPDATED BY MODEL" },
        "validation attributes update, and new model values win",
      );
      const locked = await page.evaluate(() => {
        const field = document.querySelector("#overlay input");
        field.focus();
        recipientProbe.services.isLocked = () => true;
        recipientProbe.screens.render();
        recipientProbe.services.isLocked = () => false;
        return !field.isConnected;
      });
      assert.equal(locked, true, "a locked document must use fresh controls");
      const changed = await page.evaluate(() => {
        const { screens, s } = recipientProbe;
        const field = document.querySelector("#overlay input");
        field.focus();
        s.state.docId = "another-draft";
        s.DOCS.push({ id: "another-draft", caseId: "recipient-case", draft: true, items: [] });
        screens.render();
        return !field.isConnected;
      });
      assert.equal(changed, true, "navigation must not transplant an old recipient field");
    }
    console.log("PASS real-browser repaint keepers and live route reads");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
