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
    [
      path.join(ROOT, "node_modules/typescript/bin/tsc"),
      "--allowJs",
      "--checkJs",
      "--strict",
      "--noEmit",
      "--target",
      "ES2022",
      "--lib",
      "ES2022,DOM",
      ...files,
    ],
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
  "base revision is text at the producer": `import { buildCaseStoreRequest } from ${source("case_store_port.js")};
buildCaseStoreRequest("case.json", {format:"madison-case-file",schema:5,case:{id:"c",number:"QA"},events:[],inspectors:[]}, {revision:42}, undefined, "attempt");`,
  "checkpoint case has an identity": `import { buildCaseStoreRequest } from ${source("case_store_port.js")};
buildCaseStoreRequest("case.json", {format:"madison-case-file",schema:5,case:{id:"c",number:"QA"},events:[],inspectors:[]}, undefined, {case:42}, "attempt");`,
  "expected head lists identities": `import { buildCaseStoreRequest } from ${source("case_store_port.js")};
buildCaseStoreRequest("case.json", {format:"madison-case-file",schema:5,case:{id:"c",number:"QA"},events:[{id:"e",at:"t",type:"notice.issued",payload:{expectedHead:42}}],inspectors:[]}, undefined, undefined, "attempt");`,
  "retained event is text": `import { saveCaseStore } from ${source("case_store_port.js")};
saveCaseStore(async()=>({}), "case.json", {format:"madison-case-file",schema:5,case:{id:"c",number:"QA"},events:[],inspectors:[]}, undefined, undefined, 42);`,
  "acknowledgment revision is text at consumer": `import { caseStoreAcknowledgment } from ${source("case_store_port.js")};
/** @type {number} */
const revision = caseStoreAcknowledgment({}).revision;
void revision;`,
  "case number is text at actual consumer": `import { caseStoreAcknowledgment } from ${source("case_store_port.js")};
caseStoreAcknowledgment({}).file.case.number.toFixed();`,
  "actual merge consumer rejects malformed saved case": `import { mergeSavedCase } from ${source("case_store_port.js")};
mergeSavedCase({mergeCaseEvents:()=>{}},{},"c",{}, {name:"saved.json",revision:"head",file:{case:{number:42},events:[]}});`,
  "actual folder consumer rejects malformed acknowledgment": `import { applyCommittedCase } from ${source("case_store_port.js")};
applyCommittedCase({mergeCaseEvents:()=>{},project:()=>{}},[], {format:"madison-case-file",schema:5,case:{id:"c",number:"QA"},events:[],inspectors:[]}, {name:"saved.json",revision:42,file:{case:{number:"QA"},events:[]}});`,
  "verified transport needs a verifier": `import { createHelperRequests } from ${source("helper_requests.js")};
createHelperRequests({recordIntegrity:{verify:42}});`,
  "verified transport needs a route": `import { createHelperRequests } from ${source("helper_requests.js")};
createHelperRequests({recordIntegrity:{verify:async()=>{}}}).helperJSON(42);`,
};
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dw-contracts-"));
try {
  const positive = path.join(dir, "supported-save-composition.js");
  fs.writeFileSync(
    positive,
    `// @ts-check
import { saveCaseStore, buildCaseStoreRequest, applyCommittedCase, mergeSavedCase } from ${source("case_store_port.js")};
import { createHelperRequests } from ${source("helper_requests.js")};
const {helperJSON} = createHelperRequests({recordIntegrity:{verify:async(file,proof)=>{void file;void proof;}}});
const request = buildCaseStoreRequest("case.json", {format:"madison-case-file",schema:5,case:{id:"c",number:"QA"},events:[{id:"e",at:"t",type:"notice.issued",payload:{expectedHead:["old"]}}],inspectors:[]}, {revision:"prior"}, {case:{id:"c",number:"QA"}}, "retained");
saveCaseStore(helperJSON, request.name, request.file, undefined, undefined, "retained").then(saved=>{
  const services={mergeCaseEvents:(/** @type {Record<string,unknown>} */ current,/** @type {import(${source("contracts.js")}).SavedCaseFile} */ file)=>{void current;void file;},project:()=>{}};
  const current={id:"c",number:"QA"};
  mergeSavedCase(services,current,"c",{},saved);
  applyCommittedCase(services,[current],request.file,saved);
});
buildCaseStoreRequest("legacy.json", {format:"madison-case-file",schema:4,case:{id:"c",number:"QA"},events:[],inspectors:[]}, undefined, undefined, undefined);
`,
    "utf8",
  );
  const supported = tsc([positive]);
  assert.equal(supported.status, 0, "supported current/legacy composition compiles: " + supported.stdout);
  for (const [name, body] of Object.entries(probes)) {
    const file = path.join(dir, name.replace(/\W+/g, "-") + ".js");
    fs.writeFileSync(file, "// @ts-check\n" + body + "\n");
    const result = tsc([file]);
    assert.notEqual(result.status, 0, name + ": the wrong call must be rejected");
    // A plain string match: no regular expression is built from the file name.
    const probe = path.basename(file) + "(";
    assert.ok(
      result.stdout.split("\n").some((line) => line.includes(probe) && /\): error TS\d+/.test(line)),
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
