import { recordDay } from "../assets/shared.js";

function reportOpenCases(services, cell, count) {
  return {
    id: "openCases",
    n: 1,
    label: "Open cases by area",
    date: "asOf",
    lede: "Cases with an issued notice or snow citation that remain open on the date chosen.",
    run(M, F) {
      const base = M.counted.filter((c) => services.caseOk(c, F, { asOf: F.asOf }) && services.openAt(c, F.asOf));
      const g = services.groupBy(base, (c) => services.areaKey(c, F)),
        keys = Array.from(g.keys()).sort(services.areaSort);
      const age = (l) => cell(services.avg(l.map((c) => services.daysBetween(c.opened, F.asOf)).filter((x) => x != null)), null, "days");
      const ref = (l) => count(l.filter((c) => services.statusAt(c, F.asOf) === "Referred"));
      const area = {};
      keys.forEach((k) => {
        area[k] = g.get(k).length;
      });
      return {
        cols: ["Area", "Open cases", "Average age (days)", "Of which referred"],
        rows: keys.map((k) => [services.areaLabel(k, F), count(g.get(k)), age(g.get(k)), ref(g.get(k))]),
        total: ["All areas", count(base), age(base), ref(base)],
        area: area,
        points: base,
      };
    },
  };
}

function reportByInspector(services, count) {
  return {
    id: "byInspector",
    n: 2,
    label: "Cases by inspector",
    date: "period",
    lede: "Cases opened in the period, by the inspector on the case and the area.",
    run(M, F) {
      const base = M.counted.filter((c) => services.caseOk(c, F) && services.inPeriod(c.opened, F));
      const keys = services.uniq(base.map((c) => services.areaKey(c, F))).sort(services.areaSort);
      const g = services.groupBy(base, (c) => c.inspector || "—"),
        names = Array.from(g.keys()).sort();
      const across = (l) => keys.map((k) => count(l.filter((c) => services.areaKey(c, F) === k)));
      const area = {};
      keys.forEach((k) => {
        area[k] = base.filter((c) => services.areaKey(c, F) === k).length;
      });
      return {
        cols: ["Inspector"].concat(
          keys.map((k) => services.areaLabel(k, F)),
          ["Total"],
        ),
        rows: names.map((nm) => [nm].concat(across(g.get(nm)), [count(g.get(nm))])),
        total: ["All inspectors"].concat(across(base), [count(base)]),
        area: area,
        points: base,
        matrix: true,
      };
    },
  };
}

function reportOpenViolations(services, cell, nos, count) {
  return {
    id: "openViolations",
    n: 3,
    label: "Open violations by area",
    date: "asOf",
    lede: "Violation items not corrected on the date chosen, on cases whose notice had been issued by then.",
    run(M, F) {
      const vs = [];
      M.counted.forEach((c) => {
        if (!services.caseOk(c, F, { asOf: F.asOf }) || !(c.noticeIssued <= F.asOf)) return;
        c.violations.forEach((v) => {
          const at = services.violationAt(v, F.asOf);
          if (at && services.violOk(at, F) && services.violOpenAt(v, F.asOf)) vs.push(at);
        });
      });
      const g = services.groupBy(vs, (v) => services.areaKey(v.c, F)),
        keys = Array.from(g.keys()).sort(services.areaSort);
      const top = (l) => {
        let best = "",
          n = 0;
        services
          .groupBy(l, (v) => v.typeLabel)
          .forEach((x, k) => {
            if (x.length > n) {
              n = x.length;
              best = k;
            }
          });
        return best ? best + " (" + n + ")" : "—";
      };
      const row = (label, l) => [label, count(l), cell(services.uniq(nos(l)).length, nos(l)), top(l)];
      const area = {};
      keys.forEach((k) => {
        area[k] = g.get(k).length;
      });
      return {
        cols: ["Area", "Open violations", "Cases", "Most common violation"],
        rows: keys.map((k) => row(services.areaLabel(k, F), g.get(k))),
        total: row("All areas", vs),
        area: area,
        points: services.uniq(vs.map((v) => v.c)),
      };
    },
  };
}

function reportAllCases(services, count) {
  return {
    id: "allCases",
    n: 4,
    label: "All cases",
    date: "period",
    lede: "Cases opened in the period (by initial inspection date), and where they stand now.",
    run(M, F) {
      const base = M.counted.filter((c) => services.caseOk(c, F) && services.inPeriod(c.opened, F));
      const g = services.groupBy(base, (c) => services.areaKey(c, F)),
        keys = Array.from(g.keys()).sort(services.areaSort);
      const closed = (c) => c.status === "Closed" || (c.caseType === "snow-10.28" && !!c.closedOn);
      const row = (label, l) => [
        label,
        count(l),
        count(l.filter((c) => !closed(c) && c.status !== "Withdrawn")),
        count(l.filter(closed)),
        count(l.filter((c) => c.status === "Withdrawn")),
        count(l.filter((c) => c.citations.length > 0)),
        count(l.filter((c) => c.referrals.length > 0)),
      ];
      const area = {};
      keys.forEach((k) => {
        area[k] = g.get(k).length;
      });
      return {
        cols: ["Area", "Cases", "Still open", "Closed", "Withdrawn", "Cited", "Referred"],
        rows: keys.map((k) => row(services.areaLabel(k, F), g.get(k))),
        total: row("All areas", base),
        area: area,
        points: base,
      };
    },
  };
}

function reportAllViolations(services, count) {
  return {
    id: "allViolations",
    n: 5,
    label: "All violations",
    date: "period",
    lede: "Violation items on cases opened in the period, by type and area.",
    run(M, F) {
      const vs = [];
      M.counted.forEach((c) => {
        if (!services.caseOk(c, F) || !services.inPeriod(c.opened, F)) return;
        c.violations.forEach((v) => {
          if (!v.withdrawn && services.violOk(v, F)) vs.push(v);
        });
      });
      const keys = services.uniq(vs.map((v) => services.areaKey(v.c, F))).sort(services.areaSort);
      const g = services.groupBy(vs, (v) => v.typeLabel),
        types = Array.from(g.keys()).sort((a, b) => g.get(b).length - g.get(a).length || (a < b ? -1 : 1));
      const across = (l) => keys.map((k) => count(l.filter((v) => services.areaKey(v.c, F) === k)));
      const area = {};
      keys.forEach((k) => {
        area[k] = vs.filter((v) => services.areaKey(v.c, F) === k).length;
      });
      return {
        cols: ["Violation type", "Total"].concat(keys.map((k) => services.areaLabel(k, F))),
        rows: types.map((t) => [t, count(g.get(t))].concat(across(g.get(t)))),
        total: ["All types", count(vs)].concat(across(vs)),
        area: area,
        points: services.uniq(vs.map((v) => v.c)),
        matrix: true,
      };
    },
  };
}

function reportDaysToCompliance(services, cell, count) {
  return {
    id: "daysToCompliance",
    n: 6,
    label: "Days to compliance",
    date: "period",
    lede: "From the initial inspection to the date each item was corrected, for cases opened in the period.",
    run(M, F) {
      const vs = [];
      M.counted
        .filter((c) => c.caseType !== "snow-10.28")
        .forEach((c) => {
          if (!services.caseOk(c, F) || !services.inPeriod(c.opened, F)) return;
          c.violations.forEach((v) => {
            if (!v.withdrawn && services.violOk(v, F)) vs.push(v);
          });
        });
      const d = (v) => services.daysBetween(v.c.opened, v.doneOn);
      const row = (label, l) => {
        const done = l.filter((v) => v.done && d(v) != null),
          open = l.filter((v) => !v.done),
          ds = done.map(d);
        return [
          label,
          count(l),
          count(done),
          cell(services.avg(ds), null, "days"),
          cell(services.median(ds), null, "days"),
          count(open),
          cell(services.avg(open.map((v) => services.daysBetween(v.c.opened, services.TODAY)).filter((x) => x != null)), null, "days"),
        ];
      };
      const g = services.groupBy(vs, (v) => v.typeLabel),
        types = Array.from(g.keys()).sort((a, b) => g.get(b).length - g.get(a).length || (a < b ? -1 : 1));
      return {
        cols: ["Violation type", "Violations", "Corrected", "Average days", "Median days", "Still open", "Average age of open (days)"],
        rows: types.map((t) => row(t, g.get(t))),
        total: row("All types", vs),
        area: null,
        points: services.uniq(vs.map((v) => v.c)),
      };
    },
  };
}

function reportRepeatOwners(services, cell, nos, count) {
  return {
    id: "repeatOwners",
    n: 7,
    label: "Repeat cases by owner",
    date: "period",
    lede: "Owners, recognized by mailing address, with two or more cases opened in the period.",
    run(M, F) {
      const base = M.counted.filter((c) => services.caseOk(c, F) && services.inPeriod(c.opened, F));
      const g = services.groupBy(
        base.filter((c) => c.ownerKey),
        (c) => c.ownerKey,
      );
      const keys = Array.from(g.keys())
        .filter((k) => g.get(k).length >= 2)
        .sort((a, b) => g.get(b).length - g.get(a).length || (a < b ? -1 : 1));
      const tail = (l) => [
        count(l),
        count(l.filter((c) => !["Closed", "Withdrawn"].includes(c.status))),
        cell(services.uniq(l.map((c) => c.parcelKey || c.address)).length, nos(l)),
      ];
      const rows = keys.map((k) =>
        [{ owner: k, text: services.uniq(g.get(k).map((c) => c.owner)).join("; ") }, services.ownerKeyLabel(k)].concat(tail(g.get(k))),
      );
      const none = base.filter((c) => !c.ownerKey);
      if (none.length) rows.push({ dim: true, cells: ["Unmatched — no usable mailing address", ""].concat(tail(none)) });
      return {
        cols: ["Owner names seen", "Mailing address", "Cases", "Still open", "Properties"],
        rows: rows,
        total: null,
        area: null,
        points: [].concat(...keys.map((k) => g.get(k))),
        note: keys.length
          ? services.plural(keys.length, "owner") +
            (" with more than one case. An address shared through a property manager g" +
              "roups every owner that manager represents; the names column shows who is" +
              " under each.")
          : "",
      };
    },
  };
}

function reportCitations(services, cell, count) {
  return {
    id: "citations",
    n: 8,
    label: "Citations by ordinance",
    date: "period",
    lede: "Citations issued in the period, by the ordinance on the MC-2000 and the area. Voided citations are not counted.",
    run(M, F) {
      const cs = [];
      M.counted.forEach((c) => {
        if (!services.caseOk(c, F, { noViol: true, noInspector: true })) return;
        c.citations.forEach((x) => {
          if (!services.inPeriod(x.issued, F) || (F.inspector && x.by !== F.inspector)) return;
          if (F.ord && x.ordinance !== F.ord) return;
          if (F.vtype) {
            const v = c.violations.find((v) => v.no === x.no);
            if (!v || v.type !== F.vtype) return;
          }
          cs.push(x);
        });
      });
      const keys = services.uniq(cs.map((x) => services.areaKey(x.c, F))).sort(services.areaSort);
      const g = services.groupBy(cs, (x) => x.ordinance || "—"),
        ords = Array.from(g.keys()).sort(services.ordSort);
      const money = (l) =>
        cell(
          l.reduce((n, x) => n + (x.amount || 0), 0),
          null,
          "money",
        );
      const across = (l) => keys.map((k) => count(l.filter((y) => services.areaKey(y.c, F) === k)));
      const area = {};
      keys.forEach((k) => {
        area[k] = cs.filter((x) => services.areaKey(x.c, F) === k).length;
      });
      return {
        cols: ["Ordinance", "Citations"].concat(
          keys.map((k) => services.areaLabel(k, F)),
          ["Cash deposits"],
        ),
        rows: ords.map((o) => [o, count(g.get(o))].concat(across(g.get(o)), [money(g.get(o))])),
        total: ["All ordinances", count(cs)].concat(across(cs), [money(cs)]),
        area: area,
        points: services.uniq(cs.map((x) => x.c)),
        matrix: true,
      };
    },
  };
}

function reportOverriddenDeposits(services, cell, count) {
  return {
    id: "overriddenDeposits",
    n: 11,
    label: "Overridden deposits",
    date: "period",
    lede: "Exceptional determined deposits with a named administrator, reason, source and helper authorization.",
    run(M, F) {
      const list = [];
      M.counted.forEach((c) => {
        if (!services.caseOk(c, F, { noViol: true, noInspector: true })) return;
        c.citations.forEach((x) => {
          if (x.overrideBasis && services.inPeriod(x.issued, F) && (!F.inspector || x.by === F.inspector) && (!F.ord || x.ordinance === F.ord))
            list.push(x);
        });
      });
      return {
        cols: ["Case", "Citation", "Ordinance", "Cash deposit", "Administrator", "Reason", "Source reference", "Authorized"],
        rows: list.map((x) => [
          x.c.number,
          x.num,
          x.ordinance,
          cell(x.amount, null, "money"),
          x.overrideBasis.administrator,
          x.overrideBasis.reason,
          x.overrideBasis.sourceReference,
          services.fmtDate(recordDay(x.overrideBasis.approvedAt)),
        ]),
        total: ["Overridden deposits", count(list), "", "", "", "", "", ""],
        points: services.uniq(list.map((x) => x.c)),
        area: null,
      };
    },
  };
}

function reportReferrals(services, cell, count) {
  return {
    id: "referrals",
    n: 9,
    label: "Referrals for prosecution",
    date: "period",
    lede: "Cases referred to the City Attorney in the period, with the owner as the referral printed it.",
    run(M, F) {
      const rs = [];
      M.counted.forEach((c) => {
        if (!services.caseOk(c, F, { noInspector: true })) return;
        c.referrals.forEach((r) => {
          if (services.inPeriod(r.issued, F) && (!F.inspector || r.by === F.inspector)) rs.push(r);
        });
      });
      rs.sort((a, b) => (a.issued < b.issued ? 1 : -1));
      const byOwner = services.groupBy(
        M.counted.filter((c) => c.ownerKey),
        (c) => c.ownerKey,
      );
      const rows = rs.map((r) => {
        const all = r.ownerKey && byOwner.get(r.ownerKey);
        return [
          services.fmtDate(r.issued),
          { kase: r.c.number },
          r.c.address,
          services.areaLabel(services.areaKey(r.c, F), F),
          { owner: r.ownerKey, text: r.owner },
          services.ownerKeyLabel(r.ownerKey),
          all ? count(all) : cell(0, null),
        ];
      });
      const area = {};
      services
        .groupBy(rs, (r) => services.areaKey(r.c, F))
        .forEach((l, k) => {
          area[k] = l.length;
        });
      return {
        cols: ["Referred", "Case", "Address", "Area", "Owner", "Mailing address", "Owner’s cases, all time"],
        rows: rows,
        total: ["All referrals", count(rs), "", "", "", "", ""],
        area: area,
        points: services.uniq(rs.map((r) => r.c)),
        list: true,
      };
    },
  };
}

function reportDocumentActions(services, cell) {
  return {
    id: "documentActions",
    n: 10,
    label: "Document actions",
    date: "period",
    lede: "Issued actions by document family. Includes scoped orders before an Offi" + "cial Notice; one inspection may support several actions.",
    run(M, F) {
      const docs = [];
      M.cases.forEach((c) => {
        if (!services.caseOk(c, F, { noInspector: true, noNotice: true })) return;
        c.documents
          .filter((d) => !d.void && !d.superseded && services.inPeriod(d.issued, F) && (!F.inspector || d.by === F.inspector))
          .forEach((d) => docs.push({ c, d }));
      });
      const g = services.groupBy(docs, (x) => (x.d.type === "referralUpdate" ? "Referral for Prosecution" : x.d.label)),
        labels = Array.from(g.keys()).sort();
      const area = {};
      services.groupBy(docs, (x) => services.areaKey(x.c, F)).forEach((l, k) => (area[k] = l.length));
      return {
        cols: ["Document family", "Actions", "Cases"],
        rows: labels.map((l) => [
          l,
          cell(
            g.get(l).length,
            g.get(l).map((x) => x.c.number),
          ),
          cell(
            services.uniq(g.get(l).map((x) => x.c.number)).length,
            g.get(l).map((x) => x.c.number),
          ),
        ]),
        total: [
          "All actions",
          cell(
            docs.length,
            docs.map((x) => x.c.number),
          ),
          cell(
            services.uniq(docs.map((x) => x.c.number)).length,
            docs.map((x) => x.c.number),
          ),
        ],
        area,
        points: services.uniq(docs.map((x) => x.c)),
      };
    },
  };
}

/* Definitions are inert; report runs read only the scoped calculation services. */
export function createReportCatalog(services) {
  const cell = (n, ids, fmt) => ({ n: n, ids: ids ? services.uniq(ids) : null, fmt: fmt || "int" });
  const nos = (list) => list.map((x) => (x.c ? x.c.number : x.number));
  const count = (l) => cell(l.length, nos(l));
  return [
    reportOpenCases(services, cell, count),
    reportByInspector(services, count),
    reportOpenViolations(services, cell, nos, count),
    reportAllCases(services, count),
    reportAllViolations(services, count),
    reportDaysToCompliance(services, cell, count),
    reportRepeatOwners(services, cell, nos, count),
    reportCitations(services, cell, count),
    reportOverriddenDeposits(services, cell, count),
    reportReferrals(services, cell, count),
    reportDocumentActions(services, cell),
  ];
}
