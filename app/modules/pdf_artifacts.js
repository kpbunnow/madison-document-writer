import { editorState as editor } from "./editor_state.js";
/* Retained PDF outbox and location verification; helper adapters retain file authority. */
import { deliveredByCitation } from "./document_rules.js";
import { effectiveFiled } from "./writer_queries.js";
import { esc as dep_esc } from "./presentation_format.js";
import { WriterState } from "./state.js";
import { authFetch } from "./helper_transport.js";

export function pdfTransferState(d) {
  if (deliveredByCitation(d)) return "included in citation PDF";
  if (!effectiveFiled(d)) return "unfiled";
  if (!d.filedArtifact) return "historical / location unverified";
  if (WriterState.ARTIFACT_IDENTITY[d.id] && WriterState.ARTIFACT_IDENTITY[d.id] !== d.filedArtifact.filename + "|" + d.filedArtifact.sha256)
    return "location unverified";
  if (WriterState.ARTIFACT_VERIFY[d.id] === "invalid") return "invalid artifact identity";
  if (WriterState.ARTIFACT_VERIFY[d.id] === "unavailable" || WriterState.ARTIFACT_VERIFY[d.id] === "incomplete")
    return WriterState.ARTIFACT_LOCATIONS[d.id] ? "last verified location; refresh unavailable" : "location verification unavailable";
  const places = WriterState.ARTIFACT_LOCATIONS[d.id];
  if (!places) return "location unverified";
  if (places.some((x) => x.includes("conflict"))) return "artifact conflict";
  if (places.includes("shared")) return "shared";
  if (places.includes("local")) return "local outbox";
  return "missing or unavailable";
}

export function independentArtifact(d) {
  return !d.draft && !d.void && !d.superseded && !deliveredByCitation(d);
}

/* Inert construction: dependencies and browser/state objects are read only by operations. */
export function createPdfArtifacts(services) {
  async function showOutbox() {
    const context = services.navigation.utilityContext(),
      result = await services.helperJSON("/outbox/list");
    if (!services.navigation.utilityCurrent(context)) return false;
    WriterState.OUTBOX_FILES = result.files;
    if (WriterState.HELPER) WriterState.HELPER.outbox = result.files.length;
    services.A11Y.utility(
      "PDF outbox",
      "<p>Select existing PDFs to file or open for printing. Conflicting shared" +
        " copies stay in the outbox for review. Transferring or printing does not" +
        ' confirm mailing, email delivery or Accela recording.</p><button class="' +
        'btn" data-sync-safety>Back to saved work &amp; connection</button><form ' +
        'id="outbox-form"><table><caption>Local PDFs awaiting shared filing</capt' +
        'ion><thead><tr><th scope="col">Select</th><th scope="col">PDF</th><th sc' +
        'ope="col">Bytes</th></tr></thead><tbody>' +
        "".concat(
          WriterState.OUTBOX_FILES.map(
            (file, n) =>
              '<tr><td><input type="checkbox" name="pdf" value="' +
              `${n}` +
              '" aria-label="Select ' +
              `${dep_esc(file.name)}` +
              '"></td><th scope="row">' +
              `${dep_esc(file.name)}` +
              "</th><td>" +
              `${file.size}` +
              "</td></tr>",
          ).join("") || '<tr><td colspan="3">No local outbox PDFs.</td></tr>',
        ) +
        '</tbody></table><button class="btn" type="submit">Transfer selected PDFs' +
        '</button> <button class="btn" type="button" data-outbox-print>Print sele' +
        "cted PDFs</button></form>",
    );
  }

  function selectedOutbox() {
    const form = document.getElementById("outbox-form");
    return [...form.querySelectorAll("[name=pdf]:checked")]
      .map((el) => WriterState.OUTBOX_FILES[Number(el.value)])
      .filter(Boolean)
      .map(({ name, sha256 }) => ({ name, sha256 }));
  }

  async function printOutbox() {
    const items = selectedOutbox();
    if (!items.length || items.length > 20) throw new Error("Select 1–20 PDFs to print");
    const viewers = items.map(() => window.open("about:blank", "_blank"));
    for (let n = 0; n < items.length; n++) {
      const item = items[n];
      try {
        const response = await authFetch("/outbox/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        });
        if (!response.ok) throw new Error((await response.json()).error || "Could not read PDF");
        const blob = await response.blob(),
          url = URL.createObjectURL(blob),
          viewer = viewers[n];
        if (viewer) {
          viewer.addEventListener(
            "load",
            () => {
              setTimeout(() => {
                try {
                  if (!viewer.closed) {
                    viewer.focus();
                    viewer.print();
                  }
                } catch (error) {
                  services.toast("Use the opened PDF viewer’s Print control.", { severity: "warning" });
                }
              }, 1200);
            },
            { once: true },
          );
          viewer.location.href = url;
        } else {
          const link = document.createElement("a");
          link.href = url;
          link.download = item.name;
          link.click();
        }
        setTimeout(() => URL.revokeObjectURL(url), 120000);
      } catch (error) {
        viewers[n]?.close();
        throw error;
      }
    }
    services.toast("Opened selected PDF copies. Use each PDF viewer’s Print control.", { severity: "success" });
  }

  async function refreshArtifactLocations() {
    const token = ++WriterState.ARTIFACT_SEQ;
    const items = WriterState.DOCS.filter((d) => !d.draft && d.filedArtifact?.filename && d.filedArtifact?.sha256).map((d) => ({
      filename: d.filedArtifact.filename,
      sha256: d.filedArtifact.sha256,
      docId: d.id,
    }));
    const ids = Object.fromEntries(items.map((x) => [x.docId, x.filename + "|" + x.sha256]));
    for (const id of Object.keys(WriterState.ARTIFACT_LOCATIONS))
      if (ids[id] !== WriterState.ARTIFACT_IDENTITY[id]) delete WriterState.ARTIFACT_LOCATIONS[id];
    WriterState.ARTIFACT_IDENTITY = ids;
    if (!WriterState.HELPER) {
      for (const x of items) WriterState.ARTIFACT_VERIFY[x.docId] = "unavailable";
      if (editor.state.screen === "cases") services.render();
      return;
    }

    const batches = [];
    for (let i = 0; i < items.length; i += 100) batches.push(items.slice(i, i + 100));
    const next = { ...WriterState.ARTIFACT_LOCATIONS },
      status = {};
    for (const id of Object.keys(next)) if (!ids[id]) delete next[id];
    async function check(group) {
      try {
        const result = await services.helperJSON("/artifact/status", { items: group });
        const wanted = new Map(group.map((x) => [x.docId, x]));
        for (const row of result.items || []) {
          const source = wanted.get(row.docId);
          if (!source || !Array.isArray(row.locations) || (row.sha256 && row.sha256 !== source.sha256)) continue;
          next[row.docId] = row.locations;
          status[row.docId] = "verified";
        }
        for (const x of group) if (!status[x.docId]) status[x.docId] = "incomplete";
      } catch (e) {
        if (group.length > 1 && /invalid|limit|checksum|filename|item/i.test(e.message || "")) {
          const middle = Math.floor(group.length / 2);
          await check(group.slice(0, middle));
          await check(group.slice(middle));
        } else
          for (const x of group)
            status[x.docId] = group.length === 1 && /invalid|checksum|filename/i.test(e.message || "") ? "invalid" : "unavailable";
      }
    }
    let cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(3, batches.length) }, async () => {
        while (cursor < batches.length) {
          const batch = batches[cursor++];
          await check(batch);
        }
      }),
    );
    if (token !== WriterState.ARTIFACT_SEQ) return;
    for (const x of items) {
      const current = WriterState.DOCS.find((d) => d.id === x.docId)?.filedArtifact;
      if (!current || current.filename + "|" + current.sha256 !== ids[x.docId]) {
        delete next[x.docId];
        status[x.docId] = "incomplete";
        delete WriterState.ARTIFACT_IDENTITY[x.docId];
      }
    }
    WriterState.ARTIFACT_LOCATIONS = next;
    WriterState.ARTIFACT_VERIFY = status;
    if (editor.state.screen === "cases") services.render();
  }

  return { showOutbox, selectedOutbox, printOutbox, refreshArtifactLocations };
}
