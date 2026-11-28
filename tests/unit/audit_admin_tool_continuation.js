/* Real pricing refuses incomplete dates; delayed seasonal saves must retain later dialogs. */
const assert = require("node:assert/strict"),
  path = require("node:path"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom");
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents: `export {initAdministration} from './administration.js';
        export {initCitationPricing} from './citation_pricing.js';
        export {lookupForf} from './citation_charges.js';
        export {WriterState} from './state.js';`,
      resolveDir: path.resolve("app/modules"),
    },
    bundle: true,
    write: false,
    format: "cjs",
    plugins: [
      {
        name: "data",
        setup(b) {
          b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.resolve("build/generated/modules/data", path.basename(a.path)) }));
        },
      },
    ],
  });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const { initAdministration, initCitationPricing, lookupForf, WriterState: s } = box.exports;
  const dom = new JSDOM('<div id="overlay"></div>');
  Object.assign(global, { window: dom.window, document: dom.window.document, FormData: dom.window.FormData });
  const quiet = () => {},
    messages = [];
  const services = {
    isLocked: () => false,
    toast: (m) => messages.push(m),
    render: quiet,
    A11Y: {
      utility(title, markup) {
        document.getElementById("overlay").innerHTML = '<dialog id="utility-dialog">' + markup + "</dialog>";
        document.getElementById("utility-dialog").close = function () {
          this.dataset.closed = "yes";
        };
      },
    },
  };
  const draft = (id, issued) => ({
    id,
    caseId: "k",
    draft: true,
    authoringVersion: 16,
    items: [{ id: "i", cite: true, sections: ["27.05(2)(b)"] }],
    cits: { i: { num: id, ord: "27.05(2)(b)", issued, tier: 1, amount: "197.00" } },
  });
  const bad = draft("incomplete", "2026-1"),
    good = draft("valid", "2026-11-27");
  Object.assign(s, { CASES: [{ id: "k", number: "CB1", date: "2026-11-27" }], DOCS: [bad, good], HELPER: { ok: true }, CASEDIR: { helper: true } });
  services.citationPricing = initCitationPricing({
    isLocked: services.isLocked,
    libraryReview: { refresh: quiet },
    snow: { prepare: quiet, is: () => false },
    citationPricingDate: (c) => c.issued,
    lookupForf,
    inspAt: () => ({ date: "2026-11-27" }),
  });
  assert.throws(() => services.citationPricing.refresh(bad), /Enter a valid pricing date/);
  const owner = initAdministration(services);
  await assert.doesNotReject(() => owner.openOverride(), "an incomplete draft cannot block other eligible drafts");
  const options = [...document.querySelectorAll("#admin-deposit-form option")].map((o) => o.textContent);
  assert.ok(options.some((x) => x.includes("valid")));
  assert.ok(!options.some((x) => x.includes("incomplete")));
  assert.equal(bad.cits.i.issued, "2026-1");
  services.citationPricing = {
    refresh() {
      throw new Error("Synthetic unrelated failure");
    },
  };
  await assert.rejects(() => owner.openOverride(), /Synthetic unrelated failure/, "other pricing refusals still propagate");

  const letter = {
    season: "2026–27",
    reviewedOn: "2026-11-27",
    webAddress: "https://example.invalid/",
    westPhone: "555-0100",
    eastPhone: "555-0101",
    closing: "Synthetic closing",
    sites: [["West", "East"]],
  };
  let finish, saved;
  services.snow = {
    setLetter: (v) => {
      saved = v;
    },
  };
  services.helperJSON = async (url, payload) =>
    payload
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : { letter };
  for (const mode of ["ordinary", "later-dialog"]) {
    await owner.openLetter();
    const form = document.getElementById("admin-snow-letter-form");
    const pending = form.onsubmit({ target: form, preventDefault() {} });
    if (mode === "later-dialog") services.A11Y.utility("Later work", '<textarea id="later">Unsent work</textarea>');
    finish({ letter });
    await pending;
    assert.equal(saved, letter, "the acknowledged seasonal content still applies");
    assert.equal(document.getElementById("utility-dialog").dataset.closed, mode === "ordinary" ? "yes" : undefined);
    if (mode === "later-dialog") assert.equal(document.getElementById("later").value, "Unsent work");
  }
  dom.window.close();
  console.log("PASS real incomplete-date pricing isolation and originating seasonal-review dialog closure");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
