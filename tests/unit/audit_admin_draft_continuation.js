/* An administrator receipt belongs to the unchanged, still-editable draft requested. */
const assert = require("node:assert/strict"),
  path = require("node:path"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom");
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents: 'export {initAdministration} from "./administration.js"; export {WriterState} from "./state.js";',
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
  const { WriterState: s, initAdministration } = box.exports;
  for (const mode of ["invalid-date", "ordinary", "issued", "pending", "locked", "replaced", "edited", "new-dialog"]) {
    const dom = new JSDOM('<div id="overlay"></div>');
    Object.assign(global, { window: dom.window, document: dom.window.document, FormData: dom.window.FormData });
    const c = {
        num: "B1",
        ord: "27.05(2)(b)",
        issued: mode === "invalid-date" ? "not a date" : "2026-11-27",
        depositMode: "schedule",
        tier: 1,
        amount: "197.00",
      },
      d = { id: "d", caseId: "k", draft: true, items: [{ id: "i", sections: ["27.05(2)(b)"] }], cits: { i: c } };
    Object.assign(s, { CASES: [{ id: "k", number: "CB1" }], DOCS: [d], HELPER: { ok: true }, CASEDIR: { helper: true }, DIRTY: false });
    let resolve,
      locked = false,
      saves = 0;
    const messages = [];
    const services = {
      isLocked: () => locked,
      citationPricing: { refresh() {} },
      helperJSON: () =>
        new Promise((r) => {
          resolve = r;
        }),
      saveDrafts: async () => {
        saves++;
      },
      toast: (x) => messages.push(x),
      render() {},
      A11Y: {
        utility(title, html) {
          document.getElementById("overlay").innerHTML = '<dialog id="utility-dialog">' + html + "</dialog>";
          document.getElementById("utility-dialog").close = function () {
            this.dataset.closed = "yes";
          };
        },
      },
    };
    const owner = initAdministration(services);
    await assert.doesNotReject(() => owner.openOverride(), "one incomplete draft must not crash the administrator tool");
    if (mode === "invalid-date") {
      assert.equal(document.getElementById("admin-deposit-form"), null);
      dom.window.close();
      continue;
    }
    const form = document.getElementById("admin-deposit-form");
    form.elements.amount.value = "250";
    form.elements.administrator.value = "Synthetic administrator";
    form.elements.reason.value = "Synthetic approved reason with sufficient detail";
    form.elements.sourceReference.value = "Synthetic reference";
    form.elements.confirmed.checked = true;
    const before = structuredClone(c),
      pending = form.onsubmit({ preventDefault() {}, target: form });
    if (mode === "issued") d.draft = false;
    if (mode === "pending") d.pendingAmendment = { id: "held" };
    if (mode === "locked") locked = true;
    if (mode === "replaced") s.DOCS = [structuredClone(d)];
    if (mode === "edited") c.amount = "300.00";
    if (mode === "new-dialog") services.A11Y.utility("Later", '<textarea id="later">Unsent work</textarea>');
    resolve({ ok: true, amount: "250.00", depositMode: "total", overrideBasis: { pricingDate: "2026-11-27", policyVersionHash: "synthetic" } });
    await pending;
    if (["issued", "pending", "locked", "replaced", "edited"].includes(mode)) {
      assert.deepEqual(
        c,
        mode === "edited" ? { ...before, amount: "300.00" } : before,
        mode + ": stale receipt must not mutate the original citation",
      );
      assert.equal(saves, 0);
    } else {
      assert.equal(c.amount, "250.00");
      assert.equal(saves, 1);
    }
    if (mode === "new-dialog") {
      assert.equal(document.getElementById("utility-dialog").dataset.closed, undefined);
      assert.equal(document.getElementById("later").value, "Unsent work");
    }
    dom.window.close();
  }
  console.log("PASS administrator draft/date/lock/identity/edit guards and later-dialog preservation with ordinary receipt application");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
