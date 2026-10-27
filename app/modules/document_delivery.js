import { editorState as editor } from "./editor_state.js";
import { recordDay } from "../assets/shared.js";
import { DOC_TYPES } from "./document_types.js";
import { docCase, docInsp, eventsFor, kase } from "./writer_queries.js";
import { emailList } from "./mailing_rules.js";
import { project } from "./case_records.js";
import { WriterState } from "./state.js";

export function createDocumentDelivery(services) {
  async function checkHelper() {
    try {
      const r = await services.authFetch("/dw-status", { cache: "no-store" });
      if (!r.ok) throw 0;
      WriterState.HELPER = await r.json();
    } catch (e) {
      WriterState.HELPER = null;
    }
    return WriterState.HELPER;
  }

  function emailSubject(d) {
    const k = docCase(d),
      ty = (DOC_TYPES.find((t) => t.id === d.type) || {}).label || d.type;
    return "City of Madison Building Inspection — " + ty + " — " + (k.address || "") + " — " + (k.number || "");
  }

  function emailBody(d) {
    const k = docCase(d),
      i = docInsp(d),
      ty = (DOC_TYPES.find((t) => t.id === d.type) || {}).label || d.type;
    return [
      "Attached is a " + ty.toLowerCase() + " for " + (k.address || "the property above") + ".",
      "",
      "Case number: " + (k.number || ""),
      "Property: " + (k.address || ""),
      "Date mailed: " + services.fmtDate(d.mailed || recordDay(services.today)),
      "",
      "Please contact the inspector below with any questions.",
      "",
      i.name || "",
      i.title || "",
      i.phone || "",
      i.email || "",
    ].join("\r\n");
  }

  async function emailDocument(d, picked, reuse, job) {
    if (!d || d.draft || d.pendingAmendment) {
      services.toast("Issue and confirm the document before preparing an email.");
      return false;
    }
    const k = kase(d.caseId),
      list = emailList(k).filter((e) => String(e.addr || "").trim());
    // An issued document has already been filed. The email attaches that same
    // file; the page travels with the request only as a fallback for when it
    // is not there, so a second render can never replace what was filed.
    const artifact = issuedArtifact(d);
    if (!artifact) {
      services.toast(
        "This issued version has no verified archived PDF. It cannot be attached " +
          "as an exact original. Re-file it only after reviewing the record.",
      );
      return false;
    }
    const jb = job && job.docId === d.id ? job : { docId: d.id, name: artifact.filename, html: "" };
    const useFiled = true;
    if (!picked && list.length) {
      editor.state.modal = "sendto";
      editor.state.sendDoc = d.id;
      editor.state.sendJob = jb;
      editor.state.sendReuse = useFiled;
      services.render();
      return false;
    }
    const to = (picked || []).filter((e) => String(e.addr || "").trim());
    if (!WriterState.HELPER) {
      services.toast("Emailing needs Document Writer started from the Document Writer icon on the desktop");
      return false;
    }

    services.toastHold("Preparing the email — this takes a few seconds");
    editor.FILING_ACTIVE = (editor.FILING_ACTIVE || 0) + 1;
    try {
      const r = await services.authFetch("/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: (jb && jb.name) || services.documentFileName(d) + ".pdf",
          html: "",
          reuse: useFiled,
          sha256: artifact.sha256,
          docId: d.id,
          to: to.map((e) => e.addr).join("; "),
          subject: emailSubject(d),
          body: emailBody(d),
        }),
      });
      const j = await r.json();
      if (j && j.ok) {
        // Opening a compose window is not confirmation of delivery.
        // Do not alter an issued snapshot or its filed PDF here.
        services.toast(
          j.via === "outlook"
            ? "Outlook is opening with " + j.name + " attached"
            : "Outlook was not found — your mail program is opening without the attachment",
        );
        return true;
      }
      services.toast("Could not open the email — " + ((j && j.error) || "unknown reason"));
      return false;
    } catch (e) {
      services.toast("Could not reach the local helper to send the email");
      return false;
    } finally {
      editor.FILING_ACTIVE -= 1;
    }
  }

  function issuedArtifact(d) {
    if (!d || d.draft) return null;
    const events = eventsFor(d.caseId).filter((ev) => ev.type === "document.filed" && (ev.payload || {}).docId === d.id);
    const p = (events.at(-1) || {}).payload || {};
    return p.sha256 && p.filename ? { filename: p.filename, sha256: p.sha256, docId: d.id } : null;
  }

  async function openIssuedCopy(d) {
    if (!d || d.draft) return false;
    const artifact = issuedArtifact(d);
    if (artifact && WriterState.HELPER) {
      try {
        const response = await services.authFetch("/artifact/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(artifact),
        });
        const reply = await response.json();
        if (reply.ok) {
          const bytes = Uint8Array.from(services.atob(reply.pdf), (c) => c.charCodeAt(0));
          const url = services.URL.createObjectURL(new services.Blob([bytes], { type: "application/pdf" }));
          const windowCopy = services.window.open(url, "_blank");
          if (windowCopy) {
            services.toast("Opened the verified archived PDF. Print it from the PDF viewer.");
            services.setTimeout(() => services.URL.revokeObjectURL(url), 300000);
            return true;
          }
          const a = services.document.createElement("a");
          a.href = url;
          a.download = artifact.filename;
          services.document.body.appendChild(a);
          a.click();
          a.remove();
          services.toast("Pop-up blocked — downloaded the verified archived PDF.");
          services.setTimeout(() => services.URL.revokeObjectURL(url), 300000);
          return true;
        }
        services.toast("Exact issued PDF unavailable: " + (reply.error || "verification failed"));
      } catch (e) {
        services.toast("Exact issued PDF unavailable: the local helper or archive could not be reached.");
      }
    } else
      services.toast(
        artifact
          ? "Exact issued PDF unavailable: start the local helper."
          : "This historical version has no recorded PDF checksum, so its original bytes cannot be verified.",
      );
    if (services.confirm("The exact issued PDF could not be verified. Open a clearly labeled RECONSTRUCTED copy from saved data instead?")) {
      const job = services.printJob(d);
      if (job) {
        job.html = job.html.replace(
          "<body>",
          '<body><div style="font: bold 14px sans-serif;padding:12px;border:2px sol' +
            'id #900">RECONSTRUCTED COPY — NOT VERIFIED ORIGINAL ISSUED PDF</div>',
        );
        services.printNotice(job);
      }
    }
    return false;
  }

  async function filePdf(d, job) {
    if (!d) return false;
    if (!WriterState.HELPER || !WriterState.HELPER.chrome) return false;
    // named jb: the JSON reply inside the try block is already called j
    const jb = job && job.docId === d.id ? job : services.printJob(d);
    if (!jb || !jb.html) return false;
    const snapshot = eventsFor(d.caseId).find((e) => e.payload?.snapshot?.id === d.id)?.payload.snapshot;
    if (!snapshot) throw new Error("Save the issued document before filing its PDF.");
    const operation = {
      caseId: snapshot.caseId || d.caseId,
      caseNumber: snapshot.frozen?.case?.number || kase(d.caseId).number,
      docId: d.id,
      version: await services.recordIntegrity.sourceHash(snapshot),
    };
    services.toastHold("Filing " + jb.name + " — this takes a few seconds");
    editor.FILING_ACTIVE = (editor.FILING_ACTIVE || 0) + 1;
    try {
      const r = await services.authFetch("/save-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: jb.name, html: jb.html, operation }),
      });
      const j = await r.json();
      if (j && j.ok) {
        if (j.local) {
          WriterState.HELPER.outbox = (WriterState.HELPER.outbox || 0) + 1;
          services.toast("PDF filing needed. Original saved in the local outbox. Open Saved work & connection to transfer it.");
        } else services.toast("Filed " + j.name);
        if (
          !d.draft &&
          !d.void &&
          !d.superseded &&
          !eventsFor(d.caseId).some((e) => e.type === "document.filed" && e.payload.docId === d.id && e.payload.sha256 === j.sha256)
        ) {
          services.appendEvent(d.caseId, "document.filed", {
            docId: d.id,
            reference: j.path || j.name,
            filename: j.name,
            sha256: j.sha256 || "",
            local: !!j.local,
          });
          project();
        }
        if (!d.draft && !d.void && !d.superseded) {
          await services.saveCaseFile(d.caseId);
          await services.refreshArtifactLocations();
        }
        return true;
      }
      services.toast("Could not write the PDF — " + ((j && j.error) || "unknown reason"));
      return false;
    } catch (e) {
      services.toast("PDF filing needed. The helper response is uncertain. Use File issued PDF to retry the same original.");
      return false;
    } finally {
      editor.FILING_ACTIVE -= 1;
    }
  }
  return { checkHelper, emailDocument, openIssuedCopy, filePdf };
}
