/* The recent prior-citation warning names the schedule's own warning period (2026-11-27 review cleanup, synthetic).
   Every current schedule uses 90 days, so the shipped text is unchanged; a schedule with another period is named with
   that period instead of a fixed "90 days". */
const assert = require("node:assert/strict"),
  path = require("node:path"),
  esbuild = require("esbuild");

(async () => {
  const built = await esbuild.build({
    stdin: { contents: 'export {refreshPricingWarning} from "./citation_pricing.js";', resolveDir: path.resolve(__dirname, "../../app/modules") },
    bundle: true,
    write: false,
    format: "cjs",
    plugins: [
      {
        name: "data",
        setup(b) {
          b.onResolve({ filter: /\/data\// }, (a) => ({
            path: path.resolve(__dirname, "../../build/generated/modules/data", path.basename(a.path)),
          }));
        },
      },
    ],
  });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const { refreshPricingWarning } = box.exports;
  const warning = (days, priorDate, history = [{ date: priorDate }]) => {
    const c = { ord: "27.05(2)(b)" };
    refreshPricingWarning(c, { rule: { priorCitationWarningDays: days } }, "2026-11-27", history);
    return c.pricingWarning;
  };
  assert.equal(
    warning(90, "2026-10-01"),
    "A prior 27.05(2)(b) citation for this respondent is under 90 days old.",
    "current schedules are unchanged",
  );
  assert.equal(warning(90, "2026-07-01"), "", "an older prior citation gives no warning");
  assert.equal(warning(30, "2026-11-10"), "A prior 27.05(2)(b) citation for this respondent is under 30 days old.", "another period is named");
  assert.equal(warning(30, "2026-10-01"), "");
  assert.equal(
    warning(90, "2026-11-10", [{ date: "2026-11-10", differentOwner: true }]),
    "Prior citation at this property was issued to a different owner",
  );
  console.log("PASS prior-citation warning names the schedule's warning period");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
