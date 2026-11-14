/* Actual browser policy owners; no Writer startup, DOM, network or test-only production exports. */
const fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild");
(async () => {
  const input = JSON.parse(fs.readFileSync(0, "utf8"));
  const compiled = await esbuild.build({
    stdin: {
      contents: `
export {normParcel,recordDay,mailingMaxDay,mailingDateMessage} from '../assets/shared.js';
export {cleanOwnerAddress} from './mailing_rules.js';
export {ownerMailingLines} from './defendant_contact.js';
export {validISO} from './calendar.js';
export {dueDateSpacingConflicts} from './deadline_assignment.js';
export {sameSite,siteBasis,resolveCitationAmount} from './citation_policy.js';
export {createCaseRecovery} from './case_recovery.js';`,
      resolveDir: path.resolve(__dirname, "../../app/modules"),
    },
    bundle: true,
    write: false,
    format: "cjs",
    define: { __TEST_BUILD__: "false" },
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
  new Function("today", "module", "exports", compiled.outputFiles[0].text)(new Date("2026-11-14T12:00:00Z"), box, box.exports);
  const a = box.exports;
  const output = {
    parcels: (input.parcels || []).map((v) => [a.normParcel(v), a.siteBasis({ parcel: v })]),
    sites: (input.sites || []).map(([x, y]) => a.sameSite(x, y)),
    mailing: (input.mailing || []).map((v) => a.cleanOwnerAddress(v)),
    frozenMailing: (input.frozenMailing || []).map((v) => a.ownerMailingLines(v)),
    dates: (input.dates || []).map((v) => a.validISO(v)),
    calendar: (input.calendar || []).map(({ type, at }) => [a.recordDay(at), a.mailingMaxDay(type, a.recordDay(at)), a.mailingDateMessage(type)]),
    due: (input.due || []).map((items) => a.dueDateSpacingConflicts(items.filter((i) => !i.done && !i.withdrawn)).length > 0),
    pricing: (input.pricing || []).map((v) => a.resolveCitationAmount(v)),
    recovery: (input.recovery || []).map(({ backup, row }) => {
      try {
        a.createCaseRecovery({ walkIdentity: () => "" }).validateRecovery(backup, row);
        return true;
      } catch {
        return false;
      }
    }),
  };
  process.stdout.write(JSON.stringify(output));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
