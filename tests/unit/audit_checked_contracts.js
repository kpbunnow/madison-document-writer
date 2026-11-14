/* Checked JavaScript contracts (plan Phase 1): the listed entries pass strict tsc --checkJs, use no escape hatch
   (@ts-ignore, @ts-nocheck, @ts-expect-error, explicit any or casts), and each typed boundary rejects a wrong
   call. A declaration alone would not do this; these probes prove the checker reads the implementation. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process");
const ROOT = path.resolve(__dirname, "../..");
const { entries } = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/checked-js.json"), "utf8"));
const tsc = (files) =>
  spawnSync(
    process.execPath,
    [path.join(ROOT, "node_modules/typescript/bin/tsc"), "--allowJs", "--checkJs", "--noEmit", "--target", "ES2022", "--lib", "ES2022,DOM", ...files],
    {
      cwd: ROOT,
      encoding: "utf8",
    },
  );

const clean = tsc(entries);
assert.equal(clean.status, 0, "checked entries compile:\n" + clean.stdout);
for (const entry of entries) {
  const text = fs.readFileSync(path.join(ROOT, entry), "utf8");
  assert.match(text, /^\/\/ @ts-check/, entry + " opts in explicitly");
  assert.doesNotMatch(
    text,
    /@ts-(?:ignore|nocheck|expect-error)|\{any\}|\bany\b\s*[|>}]|@type \{[^}]*\}\s*\*\/\s*\(/,
    entry + " uses no escape hatch or cast",
  );
}

const source = (name) => JSON.stringify(path.join(ROOT, "app/modules", name));
const probes = {
  "address lines must be text": `import { cleanOwnerAddress } from ${source("mailing_rules.js")};\ncleanOwnerAddress(5);`,
  "owner name must be text": `import { ownerLines } from ${source("mailing_rules.js")};\nownerLines({ owner: 3 });`,
  "a defendant needs a case": `import { defendantLines } from ${source("defendant_contact.js")};\ndefendantLines(null);`,
  "copy lines are text": `import { ccLines } from ${source("address_format.js")};\n/** @type {number[]} */\nconst lines = ccLines({ name: "A" });\nvoid lines;`,
  "escaped HTML is text": `import { esc } from ${source("presentation_format.js")};\n/** @type {number} */\nconst out = esc("<b>");\nvoid out;`,
  "event ordering needs times": `import { byTime } from ${source("record_values.js")};\nbyTime({ id: "a" }, { at: "x", id: "b" });`,
};
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dw-contracts-"));
try {
  for (const [name, body] of Object.entries(probes)) {
    const file = path.join(dir, name.replace(/\W+/g, "-") + ".js");
    fs.writeFileSync(file, "// @ts-check\n" + body + "\n");
    const result = tsc([file]);
    assert.notEqual(result.status, 0, name + ": the wrong call must be rejected");
    assert.match(
      result.stdout,
      new RegExp(path.basename(file).replace(/\./g, "\\.") + "\\(\\d+,\\d+\\): error TS"),
      name + ": the error is reported at the probe",
    );
  }
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(
  "PASS checked contracts: " +
    entries.length +
    " entries compile strictly with no escape hatch; " +
    Object.keys(probes).length +
    " wrong calls rejected",
);
