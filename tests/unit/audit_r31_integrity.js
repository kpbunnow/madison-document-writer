const assert = require("assert/strict"),
  fs = require("fs"),
  os = require("os"),
  path = require("path"),
  esbuild = require("esbuild");
global.crypto = require("crypto").webcrypto;
const target = path.join(os.tmpdir(), "r31-integrity-" + process.pid + ".cjs");
esbuild.buildSync({ entryPoints: ["app/modules/record_integrity.js"], outfile: target, bundle: true, format: "cjs", platform: "node" });
const { canonicalJSON, sha256, verifyIntegrity, initRecordIntegrity } = require(target);
(async () => {
  const values = JSON.parse(fs.readFileSync("tests/fixtures/reference/canonical-corpus.json")),
    expected = JSON.parse(fs.readFileSync("tests/fixtures/reference/canonical-expected.json"));
  for (let n = 0; n < values.length; n++) {
    assert.equal(canonicalJSON(values[n]), expected[n].canonical);
    assert.equal(await sha256(canonicalJSON(values[n])), expected[n].hash);
  }
  const value = JSON.parse(fs.readFileSync("tests/fixtures/reference/integrity-case.json"));
  assert.equal((await verifyIntegrity(value)).valid, true);
  for (const mutation of ["amount", "order", "delete", "owner"]) {
    const bad = JSON.parse(JSON.stringify(value));
    if (mutation === "amount") bad.events.at(-1).payload.snapshot.cits.charged_item.amount = "1.00";
    else if (mutation === "order") bad.events.reverse();
    else if (mutation === "delete") bad.events.pop();
    else bad.case.owner = "Tampered";
    const status = await verifyIntegrity(bad);
    assert.equal(status.valid, false);
    assert.ok(status.eventId && status.expected && status.actual);
    const proof = initRecordIntegrity({ kase: () => bad.case });
    await proof.verify(bad);
    assert.ok(proof.blocked(bad.case.id));
    assert.ok(proof.hasProof(bad));
  }
  console.log("PASS RFC8785 corpus and WebCrypto tamper/read-only verification");
  fs.unlinkSync(target);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
