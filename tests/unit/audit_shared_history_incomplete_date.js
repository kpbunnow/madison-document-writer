/* Shared citation history with an incomplete citation issue date (the pricing date), found by the 2026-11-27 second review (synthetic).

   Citation review asks for shared citation history in the background (ensureShared), and Refresh citation history and
   issuance ask for it directly (loadShared). Both first refreshed the draft, and the refresh refuses an unreadable
   pricing date, so while an inspector was still typing the issue date the request failed as an unhandled rejection, the
   history was never fetched, and Refresh citation history did nothing. The refusal is now handled there as it is for the
   other Writer callers: the history is fetched, the draft stays editable and its readiness fault still names the date. */
const assert = require("node:assert/strict"),
  { JSDOM } = require("jsdom");

(async () => {
  const rejections = [];
  process.on("unhandledRejection", (error) => rejections.push(error));
  const dom = new JSDOM('<meta name="docwriter-token" content="synthetic"><div id="app"></div><div id="overlay"></div>');
  Object.assign(global, { window: dom.window, document: dom.window.document });
  const asked = [];
  global.fetch = async (url) => {
    asked.push(String(url));
    return { ok: true, status: 200, json: async () => ({ ok: true, history: [] }) };
  };
  const flow = await require("../fixtures/citation_deposit_workflow.cjs")();
  flow.newDoc("k1", "notice");
  const d = flow.doc(flow.WriterState.state.docId);
  d.items = [
    {
      id: "item",
      no: "1",
      title: "Noxious weeds",
      text: "Remove weeds.",
      cite: true,
      sections: ["27.05(2)(b)"],
      due: flow.addDays(flow.recordDay(flow.today), 21),
    },
  ];
  flow.initialCitations.prepare(d);
  Object.assign(flow.WriterState, { HELPER: { ok: true }, CASEDIR: { helper: true } });

  for (const [index, bad] of ["2026-1", "2026-02-31"].entries()) {
    asked.length = 0;
    rejections.length = 0;
    d.cits.item.issued = bad;
    assert.doesNotThrow(() => flow.citationReview(d));
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(rejections, [], "an issue date being typed does not fail the background history request");
    // The background request reads at most every 15 seconds; the first pass is the one that fetches.
    if (index === 0) assert.deepEqual(asked, ["/citations/history"], "shared history is still fetched");
    asked.length = 0;
    const button = document.createElement("button");
    button.dataset.refreshCitationHistory = "";
    document.body.append(button);
    button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    button.remove();
    assert.deepEqual(rejections, [], "Refresh citation history does not fail either");
    assert.deepEqual(asked, ["/citations/history"], "Refresh citation history reads the history");
    assert.equal(d.cits.item.issued, bad, "the entered text stays for correction");
    assert.match(flow.citationDepositFault(d.cits.item, flow.initialCitations.preview(d), d.items[0]), /valid.*date/i);
  }
  dom.window.close();
  console.log("PASS shared citation history loads while a citation issue date is incomplete; the date stays a readiness fault");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
