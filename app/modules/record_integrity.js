/* RFC 8785 serialization and independent WebCrypto verification of helper records. */
export function canonicalJSON(value) {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw Error("Non-finite JSON number");
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = value.charCodeAt(++i);
        if (!(next >= 0xdc00 && next <= 0xdfff)) throw Error("Invalid Unicode surrogate");
      } else if (code >= 0xdc00 && code <= 0xdfff) throw Error("Invalid Unicode surrogate");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return "[" + value.map(canonicalJSON).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((k) => canonicalJSON(k) + ":" + canonicalJSON(value[k]))
        .join(",") +
      "}"
    );
  throw Error("Unsupported canonical JSON value");
}
export async function sha256(value) {
  const bytes = new TextEncoder().encode(value),
    hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
function legacyIntegrityStatus(record) {
  const modern = (v) =>
    v &&
    typeof v === "object" &&
    (Object.hasOwn(v, "integrity") ||
      Object.hasOwn(v, "pricedOn") ||
      Object.hasOwn(v, "policyVersionHash") ||
      v.authoringVersion >= 7 ||
      Object.values(v).some(modern));
  if (modern(record))
    return {
      valid: false,
      state: "downgraded",
      eventId: "migration",
      expected: "retained schema 5 and integrity",
      actual: "removed or downgraded",
      label: "Integrity record removed from a migrated case",
    };
  return { valid: true, legacy: true, anchored: false, label: "Legacy: integrity begins on migration" };
}

const integrityFailure = (last, eventId, expected, actual) => ({
  valid: false,
  eventId,
  expected: String(expected),
  actual: String(actual),
  lastGoodCommitTime: last,
  label: "This record was changed outside the program",
});

// Each check returns a failure verdict, or null when its link holds; `walk` carries what later checks need.
async function checkGenesis(walk, record) {
  const genesis = walk.record.integrity.genesis,
    genesisBody = { ...genesis };
  delete genesisBody.hash;
  let actual = await sha256(canonicalJSON(genesisBody));
  if (actual !== genesis.hash) return integrityFailure(walk.last, "genesis", genesis.hash, actual);
  const events = new Map(record.events.map((e) => [e.id, e]));
  if (events.size !== record.events.length) return integrityFailure(walk.last, "duplicate event", "unique identities", "duplicate identity");
  actual = await sha256(canonicalJSON(genesis.eventIds.map((id) => events.get(id) ?? null)));
  if (actual !== genesis.historyHash)
    return integrityFailure(walk.last, genesis.eventIds.find((id) => !events.has(id)) || "genesis history", genesis.historyHash, actual);
  walk.genesis = genesis;
  walk.events = events;
  walk.head = genesis.hash;
  walk.last = genesis.committedAt;
  walk.known = new Set(genesis.eventIds);
  return null;
}

async function checkEntries(walk, entries) {
  for (let n = 0; n < entries.length; n++) {
    const entry = entries[n];
    const actual = await sha256(walk.head + canonicalJSON(walk.events.get(entry.eventId) ?? null));
    if (walk.known.has(entry.eventId) || entry.seq !== n + 1 || entry.prevHash !== walk.head || entry.hash !== actual)
      return integrityFailure(walk.last, entry.eventId, entry.hash, actual);
    walk.known.add(entry.eventId);
    walk.head = actual;
    walk.last = entry.committedAt;
  }
  if (walk.known.size !== walk.events.size)
    return integrityFailure(
      walk.last,
      Array.from(walk.events.keys()).find((id) => !walk.known.has(id)) || "deleted event",
      "one commit per event",
      "missing event",
    );
  return null;
}

async function checkCommits(walk, chain) {
  if (walk.head !== chain.headHash) return integrityFailure(walk.last, "head", chain.headHash, walk.head);
  walk.previous = "0".repeat(64);
  for (const commit of chain.commits) {
    const actual = await sha256(walk.previous + canonicalJSON(commit.context));
    if (commit.prevHash !== walk.previous || commit.hash !== actual) return integrityFailure(walk.last, "record commit", commit.hash, actual);
    walk.previous = actual;
  }
  return null;
}

async function checkContext(walk, record, chain) {
  const context = chain.commits.at(-1).context,
    order = record.events.map((e) => e.id);
  if (canonicalJSON(order) !== canonicalJSON(context.eventOrder))
    return integrityFailure(
      walk.last,
      order.find((id, n) => id !== context.eventOrder[n]) || "deleted event",
      await sha256(canonicalJSON(context.eventOrder)),
      await sha256(canonicalJSON(order)),
    );
  if (context.headHash !== walk.head || canonicalJSON(context.commitTimes) !== canonicalJSON(chain.entries.map((e) => e.committedAt)))
    return integrityFailure(walk.last, "commit metadata", context.headHash, walk.head);
  const recordBody = { ...record };
  delete recordBody.integrity;
  const actual = await sha256(canonicalJSON(recordBody));
  if (actual !== context.rootHash) return integrityFailure(walk.last, "case details or inspectors", context.rootHash, actual);
  return null;
}

export async function verifyIntegrity(record) {
  if ((record.schema || record.version || 1) < 5) return legacyIntegrityStatus(record);
  const walk = { record, last: "" };
  try {
    const chain = record.integrity;
    const failure =
      (await checkGenesis(walk, record)) ||
      (await checkEntries(walk, chain.entries)) ||
      (await checkCommits(walk, chain)) ||
      (await checkContext(walk, record, chain));
    if (failure) return failure;
    return {
      valid: true,
      anchored: false,
      label: "Verified chain / not externally anchored",
      headHash: walk.head,
      commitHash: walk.previous,
      lastGoodCommitTime: walk.last,
      migrationDate: walk.genesis.committedAt,
      legacyHistoryAsFound: walk.genesis.sourceSchema < 5,
    };
  } catch (error) {
    return integrityFailure(walk.last, "integrity metadata", "complete verifiable chain", error.message);
  }
}
export function initRecordIntegrity(R) {
  const store = R.store || R;
  const proofs = new Map(),
    statuses = new Map(),
    records = new Map(),
    serials = new Map();
  async function verify(file, helperStatus) {
    const number = file.case?.number,
      serial = (serials.get(number) || 0) + 1;
    serials.set(number, serial);
    const result = await verifyIntegrity(file),
      status =
        helperStatus?.valid === false
          ? helperStatus
          : { ...result, anchored: !!helperStatus?.anchored, label: helperStatus?.anchored && result.valid ? "Verified / anchored" : result.label };
    const key = canonicalJSON(file);
    proofs.delete(key);
    if (helperStatus?.pendingTransaction) {
      status.pendingTransaction = true;
      status.label = helperStatus.label;
    }
    proofs.set(key, status);
    while (proofs.size > 128) proofs.delete(proofs.keys().next().value);
    if (serials.get(number) === serial) {
      statuses.set(number, status);
      records.set(number, JSON.parse(canonicalJSON(file)));
    }
    return status;
  }
  const status = (k) =>
    statuses.get(typeof k === "string" ? k : k?.number) || { valid: true, label: "Shared integrity not yet checked", anchored: false };
  const blocked = (cid) => status(R.kase(cid)).valid === false;
  function banner() {
    const k = R.kase(R.doc(store.state.docId)?.caseId || store.state.caseId),
      s = status(k);
    if (s.valid && s.pendingTransaction)
      return (
        '<div class="banner info" role="status">The saved migration needs complet' +
        "ion. Retry saving; if it continues, ask an administrator to review the p" +
        "ending transaction.</div>"
      );
    if (s.valid)
      return s.legacyHistoryAsFound
        ? '<div class="banner info" role="status">Integrity is verified from migration on ' +
            R.esc(s.migrationDate) +
            ". Earlier history was hashed as found; this does not prove it was unchanged before migration.</div>"
        : "";
    return (
      '<div class="banner alert" role="alert"><strong>' +
      R.esc(s.label) +
      "</strong><p>Read-only · " +
      R.esc(s.eventId) +
      " · expected " +
      R.esc(s.expected) +
      " · actual " +
      R.esc(s.actual) +
      " · last good commit " +
      R.esc(s.lastGoodCommitTime || "Unavailable") +
      ". No automatic repair.</p></div>"
    );
  }
  async function restore(values) {
    for (const f of values || []) await verify(f);
  }
  async function refresh() {
    if (!store.HELPER?.ok || !store.CASEDIR?.helper) return;
    const queue = store.CASES.slice();
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        while (queue.length) {
          const k = queue.shift();
          try {
            await R.helperJSON("/cases/resolve?number=" + encodeURIComponent(k.number));
          } catch (error) {
            const s = status(k);
            if (records.has(k.number)) statuses.set(k.number, { ...s, label: s.valid ? "Cached proof / shared check unavailable" : s.label });
          }
        }
      }),
    );
    R.render();
  }
  return {
    verify,
    sourceHash: (record) => sha256(canonicalJSON(record)),
    hasProof: (f) => proofs.has(canonicalJSON(f)),
    status,
    blocked,
    banner,
    restore,
    refresh,
    snapshot: () => Array.from(records.values()),
  };
}
