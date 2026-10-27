import { EVENT_TYPES } from "./document_types.js";
import { nowISO } from "./calendar.js";
import { eventsFor, kase } from "./writer_queries.js";
import { WriterState } from "./state.js";
import { makeEvent } from "./contracts.js";

export function evid() {
  const r = () => Math.random().toString(36).slice(2, 10);
  return "ev_" + Date.now().toString(36) + "_" + r() + r().slice(0, 4);
}

export function appendEvent(cid, type, payload, at, by) {
  if (EVENT_TYPES.indexOf(type) < 0) throw new Error("unknown event type " + type);
  const latest = eventsFor(cid).reduce((n, e) => Math.max(n, Date.parse(e.at) || 0), 0);
  const recorded = nowISO();
  const ordered = new Date(Math.max(Date.parse(recorded), latest + 1)).toISOString();
  const ev = makeEvent(evid(), at || ordered, by || kase(cid).inspectorId || "", type, payload || {});
  eventsFor(cid).push(ev);
  WriterState.DIRTY = true;
  return ev;
}
