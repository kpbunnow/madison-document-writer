import { recordDay } from "../assets/shared.js";
import { iso } from "./calendar.js";
import { CITEPOCH } from "./document_types.js";
import { WriterState } from "./state.js";

function nthWeekday(y, m, wd, n) {
  // n-th weekday of a month, 1-based
  const d = new Date(Date.UTC(y, m, 1, 12));
  d.setUTCDate(1 + ((wd - d.getUTCDay() + 7) % 7) + (n - 1) * 7);
  return d;
}

function lastWeekday(y, m, wd) {
  const d = new Date(Date.UTC(y, m + 1, 0, 12));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() - wd + 7) % 7));
  return d;
}

function courtHolidays(y) {
  const f = [
    [0, 1],
    [5, 19],
    [6, 4],
    [10, 11],
    [11, 24],
    [11, 25],
    [11, 31],
  ]; // fixed dates
  const out = f.map((p) => new Date(Date.UTC(y, p[0], p[1], 12)));
  out.push(nthWeekday(y, 0, 1, 3)); // Martin Luther King Jr. Day
  out.push(lastWeekday(y, 4, 1)); // Memorial Day
  out.push(nthWeekday(y, 8, 1, 1)); // Labor Day
  const tg = nthWeekday(y, 10, 4, 4); // Thanksgiving and the day after
  out.push(tg);
  out.push(new Date(Date.UTC(y, 10, tg.getUTCDate() + 1, 12)));
  return out.map((d) => iso(d));
}

function isCourtHoliday(d) {
  const s = typeof d === "string" ? d : iso(d);
  return courtHolidays(+s.slice(0, 4)).indexOf(s) >= 0;
}

export function createCourtScheduling(services) {
  function nextCourtDate(from) {
    const p = String(from || recordDay(services.today)).split("-");
    const d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12));
    d.setUTCDate(d.getUTCDate() + 42); // six weeks out
    d.setUTCDate(d.getUTCDate() + ((3 - d.getUTCDay() + 7) % 7)); // then on to a Wednesday
    let guard = 0;
    while (isCourtHoliday(d) && guard++ < 12) d.setUTCDate(d.getUTCDate() + 7);
    return iso(d);
  }

  function citationNumber() {
    const used = {};
    WriterState.DOCS.forEach((d) =>
      Object.keys(d.cits || {}).forEach((x) => {
        const v = (d.cits[x] || {}).num;
        if (v) used[v] = 1;
      }),
    );
    const base = Math.floor((services.nowMillis() - CITEPOCH) / 1000);
    for (let bump = 0; bump < 120; bump++) {
      const secs = String(base + bump)
        .padStart(9, "0")
        .slice(-9);
      const start = Math.floor(services.random() * 100);
      for (let i = 0; i < 100; i++) {
        const c = "B" + secs + String((start + i) % 100).padStart(2, "0");
        if (!used[c]) return c;
      }
    }
    return "B" + String(base).padStart(9, "0").slice(-9) + String(Math.floor(services.random() * 100)).padStart(2, "0");
  }
  return { nextCourtDate, citationNumber };
}
