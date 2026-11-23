/* Recovery dialog against the retained module: exact markup for every list, selection, error, local and shared
   comparison state, with escaping and every peer read in order. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { compile, prng, recorder } = require("../fixtures/equivalence_harness.cjs");

const { random, pick, chance } = prng(20261302);

function scenario() {
  const selected = chance(3)
    ? null
    : {
        number: pick(["BLD2026-1", "<b>x</b>"]),
        at: "2026-10-10 <t>",
        included: pick([[], ["drafts", "visits"]]),
        bundle: pick([{ cases: [{ id: "k1", number: "BLD2026-1" }] }, { cases: [] }, {}, undefined]),
      };
  const list = Array.from({ length: random(4) }, () => ({
    number: pick(["BLD2026-1", "", undefined, "A&B"]),
    at: pick(["t1", "", undefined]),
    name: "file.json",
    case: pick(["k1", "k2"]),
    included: pick([undefined, [], ["drafts"]]),
    error: pick([undefined, "bad <file>"]),
    workspace: pick(["abcdef0123456789", "short"]),
  }));
  // Sometimes the selected backup is one of the listed copies, so its row is marked.
  let selectedRow = null;
  if (selected && list.length && chance(2)) {
    Object.assign(selected, { workspace: list[0].workspace, case: list[0].case, at: list[0].at });
    selectedRow = list[0];
  }
  return {
    error: pick(["", "", "Read failed <now>"]),
    loading: chance(5),
    list,
    selected,
    selectedRow,
    shared: pick([
      undefined,
      {},
      { detail: "Shared <ok>", kind: "ok" },
      { detail: "Blocked", kind: "history-conflict" },
      {
        detail: "Conflict",
        kind: "conflict",
        fields: [
          { field: "owner", local: "A", shared: "B" },
          { field: "phone", local: undefined, shared: null },
        ],
      },
      { fields: [] },
    ]),
    local: pick([null, { id: "k1", number: "BLD2026-1" }, { id: "k9", number: "BLD2026-1" }]),
    unsaved: pick(["", "draft present", "<b>edits</b>"]),
    fail: chance(3) ? 1 + random(8) : 0,
  };
}

function run(api, sc) {
  const x = structuredClone(sc),
    calls = [],
    state = api.WriterState;
  Object.assign(state, {
    CASES: x.local ? [x.local] : [],
    RECOVERY: { selected: x.selected, selectedRow: x.selectedRow, error: x.error, loading: x.loading, list: x.list, shared: x.shared },
  });
  const returns = { caseUnsaved: () => x.unsaved };
  const services = recorder(calls, returns, {}, x.fail);
  const owner = api.createRecoveryUI(services);
  assert.deepEqual(calls, [], "construction remains inert");
  let value, error;
  try {
    value = owner.recoveryModal();
  } catch (e) {
    error = [e.name, e.message];
  }
  return JSON.stringify({ value, error, calls });
}

(async () => {
  // The approved bug fix changes only which row carries aria-pressed. Keep the retained file unchanged and adapt
  // that one expression in its comparison view; independent collision/import scenarios below pin the new identity.
  const reference = fs.readFileSync("tests/fixtures/recovery_ui_reference.txt", "utf8");
  const oldSelection = `!!recovery.RECOVERY.selected &&
                        x.workspace === recovery.RECOVERY.selected.workspace &&
                        x.case === recovery.RECOVERY.selected.case &&
                        x.at === recovery.RECOVERY.selected.at`;
  assert.equal(reference.split(oldSelection).length, 2);
  const reviewedReference = reference.replace(oldSelection, "!!recovery.RECOVERY.selected && x === recovery.RECOVERY.selectedRow");
  const [current, legacy] = await Promise.all([compile('export {createRecoveryUI} from "./recovery_ui.js";'), compile(reviewedReference)]);
  for (const imported of [false, true]) {
    const backup = { workspace: "a".repeat(32), case: "b".repeat(32), at: "2026-11-23T12:00:00Z", included: [], bundle: { cases: [] } };
    const list = [
      { ...backup, name: "first.json" },
      { ...backup, name: "second.json" },
    ];
    if (imported) {
      list[1] = { workspace: backup.workspace, case: backup.case, name: "Imported file", imported: backup };
    }
    const result = JSON.parse(run(current, { selected: backup, selectedRow: list[1], list, loading: false, error: "", fail: 0 }));
    assert.equal(result.error, undefined);
    assert.deepEqual(
      [...result.value.matchAll(/data-recovery-row="\d+" aria-pressed="(true|false)"/g)].map((m) => m[1]),
      ["false", "true"],
      imported
        ? "the imported copy must be selected instead of a stored copy with the same date"
        : "timestamps cannot identify a unique recovery file",
    );
  }
  const seen = new Set();
  let marked = 0;
  for (let n = 0; n < 6000; n++) {
    const sc = scenario();
    const [before, after] = [run(legacy, sc), run(current, sc)];
    assert.equal(after, before, `recovery dialog scenario ${n} differs from the retained module:\n${JSON.stringify(sc)}`);
    const html = JSON.parse(after).value || "";
    if (html.includes('aria-pressed="true"')) marked++;
    for (const f of [
      "Reading backups",
      "No backups found.",
      "banner alert",
      "data-recovery-row",
      "disabled",
      "Unknown case",
      "No listed drafts",
      "banner info",
      "import work",
      "case absent",
      "no unfinished work",
      "&lt;b&gt;edits",
      "Checking shared record",
      "Shared &lt;ok&gt;",
      "<table>",
      "(absent)",
      "data-recovery-restore",
      "data-recovery-shared",
      "data-recovery-export",
    ])
      if (html.includes(f)) seen.add(f);
  }
  for (const f of [
    "Reading backups",
    "No backups found.",
    "banner alert",
    "data-recovery-row",
    "Unknown case",
    "No listed drafts",
    "banner info",
    "import work",
    "case absent",
    "no unfinished work",
    "&lt;b&gt;edits",
    "Checking shared record",
    "Shared &lt;ok&gt;",
    "<table>",
    "(absent)",
    "data-recovery-restore",
    "data-recovery-shared",
    "data-recovery-export",
  ])
    assert.ok(seen.has(f), "scenarios reach: " + f);
  assert.ok(marked > 0, "some scenarios mark the selected copy");
  console.log("PASS recovery dialog matches the retained module over 6000 scenarios");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
