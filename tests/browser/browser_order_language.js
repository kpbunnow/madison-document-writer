/* Order language on a notice in real Chromium. Synthetic only. Every bundled entry that is not a draft or missing its
   ordinance can be added through the picker and removed again; section references print without a trailing period;
   picking the snow item turns a new notice into a snow citation and picking it again restores the notice, after which
   ordinary language can be added. */
const assert = require("assert/strict");
module.exports = async function (browser, page) {
  const result = await page.evaluate(async () => {
    WriterState.state.modal = null;
    WriterState.state.picker = false;
    const stamp = recordDay(today);
    const newCase = (id, number) => {
      WriterState.CASES.push({
        id,
        number,
        address: "1 LANGUAGE ST",
        parcel: "070822219199",
        owner: "SYNTHETIC OWNER",
        ownerAddr: ["1 LANGUAGE ST", "MADISON WI 53703"],
        inspectorId: "i4",
        date: addDays(stamp, -1),
        time: "09:00",
        emails: [],
      });
      newDoc(id, "notice");
      WriterState.state.picker = true;
      render();
    };
    // Each pick first refreshes the catalog review status from the helper and ends with a confirmation message, so wait
    // for that message (or the expected change) rather than a fixed time; the runner can be slow.
    const lastMessage = () => [...document.querySelectorAll("[data-message]")].map((m) => m.textContent.trim()).slice(-1)[0] || "";
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    const click = async (pick, done) => {
      const b = document.createElement("button");
      b.dataset.pick = pick;
      document.body.appendChild(b);
      b.click();
      // The confirmation message is the handler's last step, so nothing more needs waiting for once it shows.
      for (let n = 0; n < 2000 && !done(); n++) await pause(10);
      b.remove();
      WriterState.state.picker = true;
    };
    const items = () => doc(WriterState.state.docId).items;
    newCase("qa-ol-1", "QA-OL-001");
    WriterState.state.keepAdding = true;
    const failures = [];
    let usable = 0;
    const blocked = [],
      reviewed = [];
    scan: for (const [ci, c] of LIBRARY.entries())
      for (const [gi, g] of c.groups.entries())
        for (const it of g.items) {
          if (c.code === "ENF_PM_PROPMAINT" && g.code === "SNOW") continue;
          const status = catalogStatus({ ...it, ci, gi }).code;
          if (["review", "incomplete"].includes(status)) {
            blocked.push(c.code + "/" + g.code + "/" + it.o);
            continue;
          }
          // An earlier suite in the same run records catalog reviews (for example it retires EXT15). A retired or
          // replaced entry is refused on purpose, so it is not a failure to add it.
          if (["retired", "superseded"].includes(status)) {
            reviewed.push(c.code + "/" + g.code + "/" + it.o);
            continue;
          }
          usable++;
          const before = items().length,
            label = c.code + "/" + g.code + "/" + it.o + " " + it.t;
          await click(ci + ":" + gi + ":" + it.o, () => items().length === before + 1 && lastMessage().startsWith("Added: " + it.t));
          if (items().length !== before + 1) {
            failures.push(label + " — " + lastMessage());
            if (failures.length >= 3) break scan;
            continue;
          }
          await click(ci + ":" + gi + ":" + it.o, () => items().length === before && lastMessage().startsWith("Removed: " + it.t));
          if (items().length !== before) {
            failures.push(label + " could not be removed — " + lastMessage());
            if (failures.length >= 3) break scan;
          }
        }
    const dotted = LIBRARY.flatMap((c) => c.groups.flatMap((g) => g.items.flatMap((i) => i.s.filter((s) => /\)\d+\.$/.test(s)))));
    // Snow: pick, undo, then ordinary language again.
    newCase("qa-ol-2", "QA-OL-002");
    WriterState.state.keepAdding = false;
    const ci = LIBRARY.findIndex((c) => c.code === "ENF_PM_PROPMAINT"),
      snow = ci + ":" + LIBRARY[ci].groups.findIndex((g) => g.code === "SNOW") + ":1",
      cart = ci + ":" + LIBRARY[ci].groups.findIndex((g) => g.code === "TRASH_CARTS") + ":1010";
    await click(snow, () => doc(WriterState.state.docId).type === "citation");
    const picked = { type: doc(WriterState.state.docId).type, caseType: kase("qa-ol-2").caseType, picker: WriterState.state.picker };
    await click(snow, () => doc(WriterState.state.docId).type === "notice");
    const undone = { type: doc(WriterState.state.docId).type, caseType: kase("qa-ol-2").caseType || "", items: items().length };
    await click(cart, () => items().length === 1);
    return { usable, blocked, reviewed, failures, dotted, picked, undone, after: items().map((i) => i.title) };
  });
  assert.equal(result.usable + result.reviewed.length, 242, "every selectable entry was either exercised or has a recorded retirement");
  assert.ok(result.reviewed.length <= 3, "only entries another suite retired or replaced are skipped: " + result.reviewed);
  assert.ok(result.usable >= 239, "the usable bundled language was exercised");
  // Owner decision 2026-10-31 approved the bundled drafts. These seven have no determinable section, so they stay blocked.
  assert.deepEqual(result.blocked, [
    "ENF_HSE/SMOKEDETECT/20",
    "ENF_ZONE/OCCUPANCY/10",
    "ENF_ORDER_CATALOG/ALARMS_AND_FIRE_SAFETY/68",
    "ENF_ORDER_CATALOG/PERMITS_AND_APPROVALS/105",
    "ENF_ORDER_CATALOG/PERMITS_AND_APPROVALS/107",
    "ENF_ORDER_CATALOG/USE_AND_EGRESS/108",
    "ENF_ORDER_CATALOG/USE_AND_EGRESS/109",
  ]);
  assert.deepEqual(result.failures, [], "every usable entry can be added and removed");
  assert.deepEqual(result.dotted, [], "no section reference ends with a period");
  assert.deepEqual(result.picked, { type: "citation", caseType: "snow-10.28", picker: true }, "the picker stays open after the snow item");
  assert.deepEqual(result.undone, { type: "notice", caseType: "", items: 0 }, "picking the snow item again restores the notice");
  assert.deepEqual(result.after, ["Cart Late Removal"]);
  return { passed: true, usableEntries: result.usable, snowUndo: true, sectionsWithoutPeriod: true };
};
