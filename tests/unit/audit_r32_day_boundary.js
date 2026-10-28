/* Real built date paths under clocks on both sides of midnight in Chicago. */
const assert = require("assert/strict"),
  cp = require("child_process");
if (!process.env.R32_CLOCK) {
  for (const zone of ["UTC", "America/Los_Angeles", "America/New_York"])
    for (const clock of ["2026-07-30T04:30:00Z", "2026-07-30T05:30:00Z"]) {
      cp.execFileSync(process.execPath, [__filename], { env: { ...process.env, TZ: zone, R32_CLOCK: clock }, stdio: "inherit" });
    }
  process.exit(0);
}
const NativeDate = Date,
  instant = NativeDate.parse(process.env.R32_CLOCK);
global.Date = class extends NativeDate {
  constructor(...args) {
    super(...(args.length ? args : [instant]));
  }
  static now() {
    return instant;
  }
};
const esbuild = require("esbuild"),
  path = require("path");
const child = require("child_process");
const day = process.env.R32_CLOCK.includes("04:30") ? "2026-07-29" : "2026-07-30";
assert.equal(
  child
    .execFileSync("python3", ["-c", "import sys,case_store;print(case_store.city_day(sys.argv[1]).isoformat())", process.env.R32_CLOCK], {
      encoding: "utf8",
    })
    .trim(),
  day,
);
(async () => {
  const compiled = await esbuild.build({
    stdin: {
      contents:
        'export {recordDay,mailingMaxDay} from "./app/assets/shared.js";export {iso,addDays} from "./app/modules/calendar.js";export {courtCents,withinWindow} from "./app/modules/citation_policy.js";export {createCourtScheduling} from "./app/modules/court_scheduling.js";',
      resolveDir: path.resolve("."),
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
  new Function("module", "exports", compiled.outputFiles[0].text)(box, box.exports);
  const { recordDay, mailingMaxDay, iso, addDays, courtCents, withinWindow, createCourtScheduling } = box.exports;
  const { nextCourtDate } = createCourtScheduling({ today: new Date() });
  const expected = process.env.R32_CLOCK.includes("04:30") ? "2026-07-29" : "2026-07-30";
  assert.equal(recordDay(new Date()), expected);
  assert.equal(iso(new Date()), expected);
  assert.equal(mailingMaxDay("citation"), expected);
  assert.equal(mailingMaxDay("notice"), addDays(expected, 5));
  assert.equal(addDays(expected, 7), expected === "2026-07-29" ? "2026-08-05" : "2026-08-06");
  assert.equal(courtCents(recordDay(new Date())), expected === "2026-07-29" ? 3800 : 4800);
  assert.equal(nextCourtDate(expected), expected === "2026-07-29" ? "2026-09-09" : "2026-09-16");
  assert.ok(withinWindow(expected === "2026-07-29" ? "2025-07-29" : "2025-07-30", expected, { months: 12 }));
  assert.ok(!withinWindow("2025-07-28", expected, { months: 12 }));
  console.log("PASS midnight " + process.env.TZ + " " + expected);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
