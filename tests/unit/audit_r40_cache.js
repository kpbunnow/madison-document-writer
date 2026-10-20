/* Eviction causes a fresh proof, never acceptance without verification. */
const assert = require("assert/strict"),
  fs = require("fs"),
  os = require("os"),
  path = require("path"),
  esbuild = require("esbuild");
global.crypto = require("crypto").webcrypto;
const target = path.join(os.tmpdir(), "r40-proof-" + process.pid + ".cjs");
esbuild.buildSync({ entryPoints: ["app/modules/record_integrity.js"], outfile: target, bundle: true, format: "cjs", platform: "node" });
const { canonicalJSON, sha256, initRecordIntegrity } = require(target);
(async () => {
  const original = JSON.parse(fs.readFileSync("tests/fixtures/reference/integrity-case.json")),
    records = [];
  let current = original.case;
  const proof = initRecordIntegrity({ kase: () => current });
  for (let n = 0; n < 140; n++) {
    const record = JSON.parse(JSON.stringify(original));
    record.case.number = "QA-CACHE-" + n;
    const commit = record.integrity.commits.at(-1);
    commit.context.rootHash = await sha256(canonicalJSON(Object.fromEntries(Object.entries(record).filter(([key]) => key !== "integrity"))));
    commit.hash = await sha256(commit.prevHash + canonicalJSON(commit.context));
    records.push(record);
    assert.ok((await proof.verify(record)).valid);
  }
  assert.equal(records.filter((record) => proof.hasProof(record)).length, 128);
  assert.equal(proof.hasProof(records[0]), false);
  assert.ok((await proof.verify(JSON.parse(JSON.stringify(records[0])))).valid);
  assert.ok(proof.hasProof(records[0]));
  assert.equal(proof.snapshot().length, 140, "workspace recovery snapshots are retained independently from transient proof keys");
  const changed = JSON.parse(JSON.stringify(records[0]));
  changed.case.owner = "Outside rewrite";
  current = changed.case;
  assert.equal((await proof.verify(changed)).valid, false);
  assert.ok(proof.blocked(changed.case.id));
  console.log("PASS bounded 128 transient proofs, re-verification on eviction, and complete recovery snapshots");
  fs.unlinkSync(target);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
