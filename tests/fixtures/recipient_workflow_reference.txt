import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { standardStreetAddress, standardCityStateZip, addressProblem } from "./address_format.js";
import { ccList, emailList } from "./mailing_rules.js";
import { doc, docCase, kase } from "./writer_queries.js";

export function createRecipientWorkflow(services) {
  function validateAndStandardizeAddresses(k, requireAgent = false, normalize = true) {
    const parsedFault = services.addressParser.fault(k);
    if (parsedFault) return parsedFault;
    const normalized = [];
    for (let ix = 0; ix < ccList(k).length; ix++) {
      const c = ccList(k)[ix];
      if (!String(c.name || "").trim() && !String(c.addr || "").trim() && !String(c.city || "").trim()) continue;
      if (services.addressParser.accepted(c.addressParsed, [c.addr || "", c.city || ""]) && String(c.name || "").trim()) continue;
      const problem = addressProblem(c.name, c.addr, c.city);
      if (problem) {
        const field = !String(c.name || "").trim() ? "name" : !standardStreetAddress(c.addr) ? "addr" : "city";
        return { message: "Copy " + (ix + 1) + ": " + problem, scope: "copy", index: ix, field, selector: '[data-cc="' + ix + "|" + field + '"]' };
      }
      normalized.push([c, String(c.name).trim(), standardStreetAddress(c.addr), standardCityStateZip(c.city)]);
    }
    const a = k.agent || {},
      entered = [a.name, a.addr, a.city].some((v) => String(v || "").trim());
    const acceptedAgent = services.addressParser.accepted(a.addressParsed, [a.addr || "", a.city || ""]) && String(a.name || "").trim();
    if ((requireAgent || entered) && !acceptedAgent) {
      const problem = addressProblem(a.name, a.addr, a.city);
      if (problem) {
        const field = !String(a.name || "").trim() ? "name" : !standardStreetAddress(a.addr) ? "addr" : "city";
        return { message: "Registered agent: " + problem, scope: "agent", index: 0, field, selector: '[data-agent="' + field + '"]' };
      }
    }
    if (normalize) {
      normalized.forEach(([c, name, addr, city]) => {
        c.name = name;
        c.addr = addr;
        c.city = city;
      });
      if (entered && !acceptedAgent) {
        a.addr = standardStreetAddress(a.addr);
        a.city = standardCityStateZip(a.city);
        a.name = String(a.name).trim();
        k.agent = a;
      }
    }
    return null;
  }

  function recipientPreview(c) {
    if (services.addressParser.accepted(c.addressParsed, [c.addr || "", c.city || ""]))
      return "Accepted mailing lines: " + [c.addr, c.city].join(" · ");
    const street = standardStreetAddress(c.addr),
      city = standardCityStateZip(c.city);
    return street && city ? "Printed as: " + street + " · " + city : "";
  }

  function addCC(cid) {
    const current = doc(editor.state.docId),
      k = current && current.caseId === cid && current.correction ? docCase(current) : kase(cid);
    k.ccList = ccList(k).concat([{ name: "", addr: "", city: "" }]);
    workspace.DIRTY = true;
    services.render();
  }

  function removeCC(cid, ix) {
    const current = doc(editor.state.docId),
      k = current && current.caseId === cid && current.correction ? docCase(current) : kase(cid);
    k.ccList = ccList(k).filter((_, n) => n !== ix);
    workspace.DIRTY = true;
    services.render();
  }

  function addEmail(cid) {
    const current = doc(editor.state.docId),
      k = current && current.caseId === cid && current.correction ? docCase(current) : kase(cid);
    k.emails = emailList(k).concat([{ addr: "", kind: "Property Owner" }]);
    workspace.DIRTY = true;
    services.render();
  }

  function removeEmail(cid, ix) {
    const current = doc(editor.state.docId),
      k = current && current.caseId === cid && current.correction ? docCase(current) : kase(cid);
    k.emails = emailList(k).filter((_, n) => n !== ix);
    workspace.DIRTY = true;
    services.render();
  }
  return { validateAndStandardizeAddresses, recipientPreview, addCC, removeCC, addEmail, removeEmail };
}
