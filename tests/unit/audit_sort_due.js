/* Sort by due date: the ordering (soonest first inside each location heading, one run without headings, undated last,
   ties keep their order) and the button's handler with substitute services: numbers follow, Undo restores, a stale Undo
   and a draft that cannot reorder are refused. The page markup is checked in audit_usability_phase2.js. */
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { compile } = require("../fixtures/equivalence_harness.cjs");

const load = () => compile('export * from "./deadline_assignment.js"; export {createDueDateEvents} from "./due_date_events.js";');

const item = (id, due, group) => ({ id, no: "", due, ...(group ? { group } : {}) });
const ids = (list) => list.map((i) => i.id).join(",");

(async () => {
  const m = await load();
  const day = (n) => "2026-12-" + String(10 + n).padStart(2, "0");

  // The ordering.
  const sample = [
    item("a", day(15), "North"),
    item("b", "", "North"),
    item("c", day(5), "North"),
    item("d", day(10), "South"),
    item("e", day(1), "South"),
    item("f", day(1), "North"),
  ];
  assert.equal(ids(m.orderByDue(sample)), "c,a,b,e,d,f", "North and South sort separately; f starts a new North run and stays put");
  assert.equal(
    ids(m.orderByDue([item("x", day(2)), item("y", day(2)), item("z", day(1))])),
    "z,x,y",
    "no headings: one run; equal dates keep their order",
  );
  assert.equal(ids(m.orderByDue([item("p", "not a date"), item("q", day(3))])), "q,p", "an invalid date counts as undated");
  assert.equal(ids(m.orderByDue([item("u", "", "  Front "), item("v", day(9), "Front")])), "v,u", "headings compare without surrounding spaces");
  assert.deepEqual(m.orderByDue([]), []);
  const same = [item("k1", day(1)), item("k2", day(2))];
  assert.ok(
    m.orderByDue(same).every((it, ix) => it === same[ix]),
    "already in order: the same objects in the same places",
  );
  const input = [item("r1", day(9)), item("r2", day(1))];
  m.orderByDue(input);
  assert.equal(ids(input), "r1,r2", "the input array is not changed");

  // The handler.
  const dom = new JSDOM('<button id="btn-sortdue">Sort by due date</button>');
  const target = { items: [item("t1", day(9)), item("t2", day(1)), item("t3", "")] };
  let editable = true,
    visit = false,
    undo = null,
    renders = 0,
    saves = 0;
  const toasts = [];
  const events = m.createDueDateEvents({
    activeDueTarget: () => ({ target, visit }),
    orderByDue: m.orderByDue,
    structEditable: () => editable,
    renumber: (d) => d.items.forEach((it, ix) => (it.no = String(ix + 1))),
    render: () => renders++,
    saveDrafts: () => saves++,
    toast: (message) => toasts.push(message),
    toastUndo: (message, fn) => {
      toasts.push(message);
      undo = fn;
    },
  });
  events.registerBulkAssignment(dom.window.document);
  const press = () => dom.window.document.getElementById("btn-sortdue").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  press();
  assert.equal(ids(target.items), "t2,t1,t3");
  assert.equal(target.items.map((i) => i.no).join(","), "1,2,3", "numbers follow the new order");
  assert.ok(renders === 1 && saves === 1, "the draft is saved and repainted");
  assert.equal(toasts.at(-1), "Items sorted by due date, soonest first.");
  undo();
  assert.equal(ids(target.items), "t1,t2,t3", "Undo restores the earlier order");
  assert.equal(target.items.map((i) => i.no).join(","), "1,2,3");
  press();
  press();
  assert.equal(toasts.at(-1), "The items are already in due-date order.", "sorting again changes nothing");
  const staleUndo = undo;
  target.items.push(item("t4", day(3)));
  staleUndo();
  assert.equal(toasts.at(-1), "This draft changed. Sort again to reorder the items.");
  assert.equal(ids(target.items), "t2,t1,t3,t4", "nothing was undone over the newer change");
  editable = false;
  target.items = [item("n1", day(9)), item("n2", day(1))];
  press();
  assert.equal(toasts.at(-1), "Items can be sorted on a new Official Notice draft.");
  assert.equal(ids(target.items), "n1,n2");
  editable = true;
  visit = true;
  press();
  assert.equal(toasts.at(-1), "Items can be sorted on a new Official Notice draft.", "a reinspection worksheet does not sort");
  console.log("PASS sort by due date: ordering and handler");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
