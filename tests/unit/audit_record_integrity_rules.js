/* Record verification against the retained module: genuine chains of every shape and tampering at every link,
   compared for the exact verdict (event, expected, actual, last good commit), legacy handling and malformed input. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { compile, prng } = require("../fixtures/equivalence_harness.cjs");

const { random, pick, chance } = prng(20261206);

async function build(api) {
  const { canonicalJSON: canon, sha256: sha } = api;
  const count = 1 + random(5);
  const events = Array.from({ length: count }, (_, n) => ({
    id: "e" + n,
    at: "2026-10-2" + n,
    type: "notice.issued",
    payload: { n, text: pick(["a", "bé", "c"]) },
  }));
  const migrated = random(count + 1);
  const eventIds = events.slice(0, migrated).map((e) => e.id);
  const byId = new Map(events.map((e) => [e.id, e]));
  const genesisBody = {
    committedAt: "2026-10-01T00:00:00Z",
    eventIds,
    historyHash: await sha(canon(eventIds.map((id) => byId.get(id)))),
    sourceSchema: pick([4, 5]),
  };
  const genesis = { ...genesisBody, hash: await sha(canon(genesisBody)) };
  let head = genesis.hash;
  const entries = [];
  for (let n = migrated; n < count; n++) {
    const hash = await sha(head + canon(events[n]));
    entries.push({ seq: entries.length + 1, eventId: events[n].id, prevHash: head, hash, committedAt: "2026-10-1" + n });
    head = hash;
  }
  const record = { schema: 5, case: { id: "c", number: "BLD2026-00001", note: pick(["x", "y"]) }, inspectors: [{ id: "i1" }], events };
  const context = {
    eventOrder: events.map((e) => e.id),
    headHash: head,
    commitTimes: entries.map((e) => e.committedAt),
    rootHash: await sha(canon(record)),
  };
  if (chance(10)) context[pick(["headHash", "commitTimes"])] = pick(["wrong", ["t"]]);
  const commits = [];
  let previous = "0".repeat(64);
  for (let n = 0; n < 1 + random(2); n++) {
    const c = n === 0 ? context : { ...context };
    const hash = await sha(previous + canon(c));
    commits.push({ prevHash: previous, hash, context: c });
    previous = hash;
  }
  record.integrity = { genesis, entries, headHash: head, commits };
  return record;
}

const TAMPERS = [
  (r) => (r.integrity.genesis.hash = "0".repeat(64)),
  (r) => (r.integrity.genesis.historyHash = "f".repeat(64)),
  (r) => (r.integrity.genesis.eventIds = ["gone", ...r.integrity.genesis.eventIds]),
  (r) => r.events.push({ ...r.events[0] }),
  (r) => r.events.pop(),
  (r) => r.events.reverse(),
  (r) => r.events.push({ id: "extra", type: "x" }),
  (r) => r.integrity.entries.length && (r.integrity.entries[0].seq = 9),
  (r) => r.integrity.entries.length && (r.integrity.entries[0].prevHash = "a"),
  (r) => r.integrity.entries.length && (r.integrity.entries.at(-1).hash = "b"),
  (r) => r.integrity.entries.length && (r.integrity.entries[0].eventId = r.integrity.genesis.eventIds[0] || "e0"),
  (r) => (r.integrity.headHash = "c".repeat(64)),
  (r) => (r.integrity.commits[0].prevHash = "d"),
  (r) => (r.integrity.commits.at(-1).hash = "e"),
  (r) => (r.integrity.commits.at(-1).context.eventOrder = ["z"]),
  (r) => (r.integrity.commits.at(-1).context.headHash = "h"),
  (r) => (r.integrity.commits.at(-1).context.commitTimes = ["t"]),
  (r) => (r.case.note = "tampered"),
  (r) => r.inspectors.push({ id: "i2" }),
  (r) => delete r.integrity.genesis,
  (r) => delete r.integrity,
  (r) => (r.integrity.commits = []),
  (r) => (r.events[0].payload.n = NaN),
  (r) => (r.events[0].payload.text = "\ud800"),
  (r) => (r.schema = pick([1, 2, 4, undefined])),
  (r) => (r.schema = 4) && (r.case.authoringVersion = 8),
  (r) => (r.schema = 3) && (r.pricedOn = "x"),
  (r) => (r.events = null),
];

(async () => {
  const [current, legacy] = await Promise.all([
    compile('export {verifyIntegrity, canonicalJSON, sha256} from "./record_integrity.js";'),
    compile(fs.readFileSync("tests/fixtures/record_integrity_reference.txt", "utf8")),
  ]);
  const verdicts = new Set();
  let valid = 0,
    tampered = 0;
  for (let n = 0; n < 6000; n++) {
    const record = await build(current);
    const edits = chance(5) ? 0 : chance(4) ? 2 : 1;
    const picks = [];
    for (let k = 0; k < edits; k++) {
      const t = random(TAMPERS.length);
      picks.push(t);
      try {
        TAMPERS[t](record);
      } catch {
        /* a tamper that cannot apply leaves the record as it was */
      }
    }
    const text = JSON.stringify(record, (_, v) => (typeof v === "number" && !Number.isFinite(v) ? "<nonfinite>" : v));
    const outcome = async (api) => {
      const copy = JSON.parse(text, (_, v) => v);
      // restore tampers JSON cannot carry
      if (picks.includes(22) && copy.events?.[0]?.payload) copy.events[0].payload.n = NaN;
      try {
        return JSON.stringify(await api.verifyIntegrity(copy));
      } catch (e) {
        return "throw " + e.name + ": " + e.message;
      }
    };
    const [before, after] = [await outcome(legacy), await outcome(current)];
    assert.equal(after, before, `integrity scenario ${n} differs from the retained module (tampers ${picks}):\n${text.slice(0, 600)}`);
    const parsed = before.startsWith("{") ? JSON.parse(before) : { eventId: before };
    if (parsed.valid) valid++;
    else tampered++;
    verdicts.add(parsed.valid ? "valid" : parsed.eventId?.replace(/^e\d+$/, "event") || before);
  }
  for (const v of [
    "valid",
    "genesis",
    "duplicate event",
    "event",
    "head",
    "record commit",
    "commit metadata",
    "case details or inspectors",
    "integrity metadata",
    "migration",
  ])
    assert.ok(
      [...verdicts].some((t) => t === v || String(t).startsWith(v)),
      "scenarios reach verdict " + v + " in " + [...verdicts].join("|"),
    );
  assert.ok(valid > 1000 && tampered > 2500, `coverage: ${valid} valid, ${tampered} tampered`);
  console.log("PASS record verification matches the retained module over 6000 records (" + valid + " valid, " + tampered + " tampered)");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
