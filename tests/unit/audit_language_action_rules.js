/* Compare language actions with the retained owner, including lazy reads and focus. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild");
(async () => {
  const source = fs.readFileSync("app/modules/language_actions.js", "utf8");
  async function compile(contents) {
    const result = await esbuild.build({
      stdin: { contents: contents + '\nexport {WriterState} from "./state.js";', resolveDir: path.resolve("app/modules") },
      bundle: true,
      write: false,
      format: "cjs",
    });
    const box = { exports: {} };
    new Function("module", "exports", result.outputFiles[0].text)(box, box.exports);
    return box.exports;
  }
  const [current, legacy] = await Promise.all([
    compile(source),
    compile(source.slice(0, source.indexOf("export function")) + fs.readFileSync("tests/fixtures/language_actions_reference.txt", "utf8")),
  ]);
  async function run(api, flags) {
    const calls = [],
      state = api.WriterState;
    state.state = { screen: flags.screen, languageMode: flags.mode, q: "old", cl: 3, libCl: 4 };
    state.CATALOG_FORMS = {};
    global.window = { scrollTo: (...args) => calls.push(["scroll", ...args]) };
    const focus = { focus: (...args) => calls.push(["focus", ...args]) };
    global.document = {
      querySelector: (s) => {
        calls.push(["query", s]);
        return flags.focus ? focus : null;
      },
      getElementById: (s) => {
        calls.push(["id", s]);
        return flags.focus ? focus : null;
      },
    };
    const dataset = new Proxy(
      { ...flags.dataset },
      {
        get(o, k) {
          calls.push(["dataset", k]);
          return o[k];
        },
      },
    );
    const button = {
      dataset,
      isConnected: flags.connected,
      textContent: "old",
      hasAttribute(k) {
        calls.push(["has", k]);
        return flags.attrs.includes(k);
      },
      getAttribute(k) {
        calls.push(["attr", k]);
        return flags.disabled ? "true" : null;
      },
      setAttribute: (...a) => calls.push(["set", ...a]),
      removeAttribute: (...a) => calls.push(["remove", ...a]),
      closest(s) {
        calls.push(["closest", s]);
        return flags.picker;
      },
    };
    const services = new Proxy(
      {},
      {
        get(_, key) {
          calls.push(["service", key]);
          if (key === "navigation")
            return {
              get leave() {
                calls.push(["navigation", "leave"]);
                return (callback) => {
                  calls.push(["call", "leave"]);
                  if (flags.fail === "leave") throw new Error("interrupted leave");
                  if (flags.navigate) callback();
                  return Promise.resolve();
                };
              },
            };
          return (...args) => {
            calls.push(["call", key, ...args.map((x) => (typeof x === "function" ? "callback" : x))]);
            if (flags.fail === key) throw new Error("interrupted " + key);
            if (key === "catalogItem") return flags.item ? { t: "replacement", id: "entry" } : null;
            if (key === "catalogKey") return "key";
            if (key === "catalogForm") return { title: "retained", open: false };
            if (key === "catalogReview") return "approved";
            if (key === "refreshCatalog") return Promise.resolve();
          };
        },
      },
    );
    const owner = api.createLanguageActions(services);
    assert.deepEqual(calls, [], "construction must remain inert");
    let error;
    try {
      await owner({
        target: {
          closest(s) {
            calls.push(["target", s]);
            return flags.button ? button : null;
          },
        },
      });
    } catch (e) {
      error = [e.name, e.message];
    }
    return { calls, error, state: structuredClone(state), text: button.textContent, tabIndex: focus.tabIndex };
  }
  let checked = 0;
  const actions = [
    {},
    { languageMode: "admin" },
    { languageMode: "browse" },
    { catalogOpen: "entry" },
    { languageReplacement: "entry" },
    { languageMode: "admin", catalogOpen: "entry", languageReplacement: "entry" },
  ];
  for (const dataset of actions)
    for (const attrs of [
      [],
      ["data-language-refresh"],
      ["data-language-standard"],
      ["data-language-all"],
      ["data-language-standard", "data-language-all"],
    ])
      for (let bits = 0; bits < 256; bits++) {
        const f = {
          dataset,
          attrs,
          screen: bits & 1 ? "library" : "cases",
          mode: bits & 2 ? "admin" : "browse",
          picker: !!(bits & 4),
          item: !!(bits & 8),
          disabled: !!(bits & 16),
          connected: !!(bits & 32),
          focus: !!(bits & 64),
          navigate: !!(bits & 128),
          button: true,
        };
        assert.deepEqual(await run(current, f), await run(legacy, f), "scenario " + checked++);
      }
  for (const fail of [
    "catalogItem",
    "catalogKey",
    "catalogReview",
    "catalogForm",
    "keepCatalogForms",
    "render",
    "refreshCatalog",
    "leave",
    "refreshOverlay",
  ])
    for (const dataset of actions) {
      const f = {
        dataset,
        attrs: ["data-language-refresh"],
        screen: "library",
        mode: "admin",
        picker: true,
        item: true,
        connected: true,
        focus: true,
        navigate: true,
        button: true,
        fail,
      };
      assert.deepEqual(await run(current, f), await run(legacy, f), "interruption " + checked++);
    }
  console.log("PASS language action equivalence " + checked + " scenarios: state, refusal priority, lazy reads, async refresh and focus");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
