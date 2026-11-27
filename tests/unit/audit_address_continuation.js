/* Delayed parser responses and acceptance must stay bound to the editable contact that requested them. */
const assert = require("node:assert/strict");
const { compile } = require("../fixtures/equivalence_harness.cjs");
global.document = {
  addEventListener() {},
  getElementById() {
    return null;
  },
};
(async () => {
  const api = await compile('export {initAddressParser} from "./address_parser.js";');
  const s = api.WriterState;
  function setup() {
    const k = {
      id: "c",
      number: "QA-ADDRESS",
      owner: "Synthetic Owner",
      ownerAddr: ["123 MAIN ST", "MADISON WI 53703"],
      ccList: [{ name: "Copy", addr: "123 MAIN ST", city: "MADISON WI 53703" }],
    };
    const d = { id: "d", caseId: k.id, draft: true };
    Object.assign(s, { CASES: [k], DOCS: [d], state: { screen: "write", docId: d.id }, DIRTY: false });
    let html = "",
      blocked = false,
      held = null,
      saves = 0,
      seq = 0;
    const answer = { available: true, type: "street", standardized: ["123 Main St", "Madison WI 53703"], recipientLine: "" };
    const services = {
      recordIntegrity: { blocked: () => blocked },
      uid: () => "address" + ++seq,
      A11Y: {
        utility: (_, text) => {
          html = text;
        },
      },
      toast() {},
      saveDrafts() {
        saves++;
      },
      render() {},
      helperJSON: async () => answer,
    };
    const owner = api.initAddressParser(services);
    return {
      k,
      d,
      owner,
      services,
      answer,
      token: () => /data-accept-address="([^"]+)"/.exec(html)?.[1],
      get html() {
        return html;
      },
      get saves() {
        return saves;
      },
      block() {
        blocked = true;
      },
      hold() {
        services.helperJSON = () =>
          new Promise((resolve) => {
            held = resolve;
          });
      },
      release() {
        held(answer);
      },
    };
  }
  for (const change of [
    (x) => {
      x.d.draft = false;
    },
    (x) => {
      x.d.pendingAmendment = {};
    },
    (x) => x.block(),
    (x) => {
      s.CASES = [structuredClone(x.k)];
    },
    (x) => {
      s.DOCS = [structuredClone(x.d)];
    },
  ]) {
    const x = setup();
    await x.owner.preview("owner");
    const token = x.token(),
      before = JSON.stringify(x.k),
      saves = x.saves;
    change(x);
    assert.equal(x.owner.accept(token), false, "stale/locked contact cannot accept a preview");
    assert.equal(JSON.stringify(x.k), before, "refusal preserves original facts");
    assert.equal(x.saves, saves);
  }
  for (const change of [
    (x) => {
      x.d.draft = false;
    },
    (x) => {
      x.d.pendingAmendment = {};
    },
    (x) => x.block(),
    (x) => {
      s.CASES = [structuredClone(x.k)];
    },
  ]) {
    const x = setup();
    x.hold();
    const request = x.owner.preview("owner");
    change(x);
    x.release();
    assert.equal(await request, false, "late reply cannot install parser metadata on a replaced/locked contact");
    assert.equal(x.k.ownerAddressParsed, undefined);
    assert.equal(x.saves, 0);
    assert.equal(x.html, "");
  }
  {
    const x = setup();
    await x.owner.preview("copy", 0);
    const token = x.token();
    x.k.ccList[0] = structuredClone(x.k.ccList[0]);
    assert.equal(x.owner.accept(token), false, "identical text on a replacement contact does not own the old token");
  }
  {
    const x = setup();
    x.hold();
    const old = x.owner.preview("owner");
    x.services.helperJSON = async () => ({ ...x.answer, standardized: ["123 Newer St", "Madison WI 53703"] });
    await x.owner.preview("owner");
    const token = x.token();
    x.release();
    assert.equal(await old, false, "older response cannot replace the newer preview");
    assert.equal(x.token(), token);
    assert.equal(x.owner.accept(token), true);
    assert.equal(x.k.ownerAddr[0], "123 Newer St");
  }
  {
    const x = setup(),
      tokens = [];
    for (let n = 0; n < 30; n++) {
      await x.owner.preview("owner");
      tokens.push(x.token());
    }
    for (const token of tokens.slice(0, -1)) assert.equal(x.owner.accept(token), false, "superseded previews are discarded");
    assert.equal(x.owner.accept(tokens.at(-1)), true);
    assert.equal(x.k.owner, "Synthetic Owner");
  }
  console.log("PASS address preview context, lock/read-only rechecks, latest-response ordering and superseded token cleanup");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
