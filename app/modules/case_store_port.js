// @ts-check
import { caseDetails, stableJSON, clone } from "./record_values.js";
/* The real request producer and acknowledgment consumer shared by amendment and folder saves.
   No state, clock, transport or trust cache. The caller keeps all effect ordering. */
/** @typedef {import('./contracts.js').CaseFile} CaseFile */
/** @typedef {import('./contracts.js').CaseIdentity} CaseIdentity */
/** @typedef {import('./contracts.js').CaseStoreRequest} CaseStoreRequest */
/** @typedef {import('./contracts.js').CaseStoreAcknowledgment} CaseStoreAcknowledgment */
/** @param {string} name @param {CaseFile} file
 * @param {{revision?:string}|undefined} base @param {{case:CaseIdentity}|undefined} checkpoint
 * @param {string|undefined} idempotencyEvent @returns {CaseStoreRequest} */
export function buildCaseStoreRequest(name, file, base, checkpoint, idempotencyEvent) {
  const request = { name, file, baseRevision: (base && base.revision) || "", baseCase: checkpoint ? checkpoint.case : null };
  return idempotencyEvent === undefined ? request : { ...request, idempotencyEvent };
}

/** @param {unknown} value @returns {value is Record<string,unknown>} */
export function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Narrow only consumed acknowledgment facts, after the authenticated request's proof verification.
 * A malformed response can follow a committed save: this Error is deliberately NOT a definitive StorageError.
 * @param {unknown} result @returns {CaseStoreAcknowledgment} */
export function caseStoreAcknowledgment(result) {
  if (isObject(result) && isAcknowledgment(result)) return result;
  throw new Error("The shared save acknowledgment is incomplete. Keep the pending request and retry to confirm it.");
}
/** @param {Record<string,unknown>} value @returns {value is CaseStoreAcknowledgment} */
function isAcknowledgment(value) {
  return (
    typeof value.name === "string" &&
    typeof value.revision === "string" &&
    isObject(value.file) &&
    isObject(value.file.case) &&
    typeof value.file.case.number === "string" &&
    Array.isArray(value.file.events) &&
    value.file.events.every((event) => isObject(event) && typeof event.id === "string") &&
    (value.file.schema === undefined || typeof value.file.schema === "number")
  );
}

/** The actual checked composition: construct retained request, await verified transport, consume acknowledgment.
 * @param {(url:string,body:CaseStoreRequest)=>Promise<unknown>} helperJSON
 * @param {string} name @param {CaseFile} file
 * @param {{revision?:string}|undefined} base @param {{case:CaseIdentity}|undefined} checkpoint
 * @param {string|undefined} idempotencyEvent @param {object} [receiver] @returns {Promise<CaseStoreAcknowledgment>} */
export async function saveCaseStore(helperJSON, name, file, base, checkpoint, idempotencyEvent, receiver) {
  return caseStoreAcknowledgment(
    await Reflect.apply(helperJSON, receiver, ["/cases/save", buildCaseStoreRequest(name, file, base, checkpoint, idempotencyEvent)]),
  );
}

/** Fields not edited while awaiting the request take saved values; later local edits remain.
 * @param {{mergeCaseEvents:(current:Record<string,unknown>,file:import('./contracts.js').SavedCaseFile)=>unknown}} services
 * @param {Record<string,unknown>} k @param {string} cid @param {Record<string,unknown>} localBefore
 * @param {CaseStoreAcknowledgment} result */
export function mergeSavedCase(services, k, cid, localBefore, result) {
  const savedCase = Object.assign({}, caseDetails(result.file.case), { id: cid });
  new Set(Object.keys(localBefore).concat(Object.keys(savedCase))).forEach((key) => {
    if (key === "id") return;
    if (stableJSON(k[key]) === stableJSON(localBefore[key])) {
      if (savedCase[key] === undefined) delete k[key];
      else k[key] = clone(savedCase[key]);
    }
  });
  services.mergeCaseEvents(k, clone(result.file));
  return { k, savedCase };
}

/** Apply a confirmed folder save to the matching current case, without overwriting edits made in flight.
 * @param {{mergeCaseEvents:(current:Record<string,unknown>,file:import('./contracts.js').SavedCaseFile)=>unknown,project:()=>unknown}} services
 * @param {Record<string,unknown>[]} cases @param {CaseFile} file @param {CaseStoreAcknowledgment} result */
export function applyCommittedCase(services, cases, file, result) {
  const current = cases.find((k) => k.number === result.file.case.number);
  if (current) {
    const saved = caseDetails(result.file.case),
      submitted = caseDetails(file.case);
    new Set(Object.keys(submitted).concat(Object.keys(saved))).forEach((key) => {
      if (key === "id") return;
      if (stableJSON(current[key]) === stableJSON(submitted[key])) {
        if (saved[key] === undefined) delete current[key];
        else current[key] = clone(saved[key]);
      }
    });
    services.mergeCaseEvents(current, clone(result.file));
    services.project();
  }
}
