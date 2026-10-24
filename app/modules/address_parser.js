import { toast } from "./court_and_deposits.js";
import { helperJSON } from "./workspace_shell.js";
import { saveDrafts } from "./case_files.js";
import { render } from "./app_screens.js";
import { A11Y, recordIntegrity, uid } from "./app_core.js";
import { ccList } from "./mailing_rules.js";
import { doc, docCase, kase } from "./writer_queries.js";
import { esc } from "./presentation_format.js";
import { WriterState } from "./state.js";
/* Local preview and explicit acceptance; retained raw address never changes silently. */
export function initAddressParser() {
  const pending = new Map();
  function context(scope, index = 0) {
    const d = doc(WriterState.state.docId),
      k = d ? docCase(d) : kase(WriterState.state.caseId);
    if (!k) return null;
    const target = scope === "owner" ? k : scope === "agent" ? k.agent || {} : ccList(k)[index];
    if (!target) return null;
    const lines = scope === "owner" ? k.ownerAddr || [] : [target.addr || "", target.city || ""];
    return { d, k, target, scope, index, lines, raw: lines.join("\n") };
  }
  const accepted = (parsed, lines) => !!parsed?.accepted && JSON.stringify(parsed.acceptedLines) === JSON.stringify(lines);
  function fault(k) {
    const all = [
      { parsed: k.ownerAddressParsed, lines: k.ownerAddr || [], scope: "owner", index: 0, selector: '[data-case="ownerBlock"]' },
      ...ccList(k).map((c, index) => ({
        parsed: c.addressParsed,
        lines: [c.addr || "", c.city || ""],
        scope: "copy",
        index,
        selector: '[data-cc="' + index + '|addr"]',
      })),
      {
        parsed: k.agent?.addressParsed,
        lines: [k.agent?.addr || "", k.agent?.city || ""],
        scope: "agent",
        index: 0,
        selector: '[data-agent="addr"]',
      },
    ];
    const bad = all.find((x) => x.parsed?.type === "ambiguous" && !x.parsed.accepted && x.lines.join("\n") === x.parsed.raw);
    return bad
      ? { ...bad, field: "addr", message: "Ambiguous mailing address: " + bad.parsed.raw + ". Edit the raw address before continuing." }
      : null;
  }
  async function preview(scope, index = 0) {
    const c = context(scope, index);
    if (!c || (c.d && (!c.d.draft || c.d.pendingAmendment)) || recordIntegrity.blocked(c.k.id)) return false;
    const signature = c.raw;
    let result;
    try {
      result = await helperJSON("/address/parse", { raw: c.raw });
    } catch (error) {
      toast("Address parser unavailable. The R19 address standardizer remains available.");
      return false;
    }
    if (context(scope, index)?.raw !== signature || WriterState.state.docId !== c.d?.id) return false;
    if (!result.available) {
      toast("Address parser unavailable. The R19 address standardizer remains available.");
      return false;
    }
    const parsed = { ...result, accepted: false };
    if (scope === "owner") c.k.ownerAddressParsed = parsed;
    else c.target.addressParsed = parsed;
    const token = uid("a");
    pending.set(token, c);
    c.parsed = parsed;
    A11Y.utility(
      "Mailing address preview",
      "<p>Entered exactly as supplied:</p><pre>" +
        esc(c.raw) +
        "</pre><p>" +
        esc(parsed.warning || "Review the standardized mailing lines. Names remain as entered.") +
        "</p><pre>" +
        esc([parsed.recipientLine, ...parsed.standardized].filter(Boolean).join("\n")) +
        "</pre>" +
        (parsed.type === "ambiguous"
          ? '<p role="alert">This address is ambiguous. Edit the raw text; no standardized guess is available.</p>'
          : '<button class="btn btn-primary" data-accept-address="' + token + '">Accept standardized address</button>'),
    );
    saveDrafts();
    return true;
  }
  function accept(token) {
    const c = pending.get(token);
    if (!c || context(c.scope, c.index)?.raw !== c.raw) return false;
    const p = c.parsed;
    if (!["street", "po-box"].includes(p.type)) return false;
    const lines = [p.recipientLine, ...p.standardized].filter(Boolean);
    p.accepted = true;
    if (c.scope === "owner") {
      c.k.ownerAddr = lines;
      p.acceptedLines = lines.slice();
    } else {
      c.target.addr = lines.slice(0, -1).join("\n");
      c.target.city = lines.at(-1);
      p.acceptedLines = [c.target.addr, c.target.city];
    }
    WriterState.DIRTY = true;
    pending.delete(token);
    saveDrafts();
    document.getElementById("utility-dialog")?.close();
    render();
    return true;
  }
  document.addEventListener("click", (e) => {
    const button = e.target.closest?.("[data-parse-address],[data-accept-address]");
    if (!button) return;
    if (button.dataset.acceptAddress) accept(button.dataset.acceptAddress);
    else {
      const [scope, index] = button.dataset.parseAddress.split("|");
      void preview(scope, +index || 0);
    }
  });
  return { preview, accept, accepted, fault };
}
