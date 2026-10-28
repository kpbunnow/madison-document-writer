/* Catalog and record owners are composed without Writer startup, a DOM or bundle internals. */
const assert = require("node:assert/strict"),
  path = require("node:path"),
  esbuild = require("esbuild");
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents: `
      export {LIBRARY} from './data/library.js';
      export {DEPOSITS} from './data/deposits.js';
      export {INSPECTORS} from './data/inspectors.js';
      export {countBlanks} from './presentation_format.js';
      export {lookupForf} from './citation_charges.js';
      export {insp} from './writer_queries.js';
      export {ownerLines} from './mailing_rules.js';
      export {TEST_CASES} from './test_fixtures.js';
      export {WriterState} from './state.js';`,
      resolveDir: path.resolve("app/modules"),
    },
    bundle: true,
    write: false,
    format: "cjs",
    plugins: [
      {
        name: "data",
        setup(build) {
          build.onResolve({ filter: /\/data\// }, (args) => ({ path: path.resolve("build/generated/modules/data", path.basename(args.path)) }));
        },
      },
    ],
  });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const { LIBRARY, DEPOSITS, INSPECTORS, countBlanks, lookupForf, insp, ownerLines, TEST_CASES, WriterState } = box.exports;
  assert.deepEqual(WriterState, {}, "catalog imports must not start Writer or initialize state");
  WriterState.CASES = structuredClone(TEST_CASES);

  function H(t) {
    console.log("\n=== " + t + " ===");
  }
  function P(l, v) {
    console.log("  " + String(l).padEnd(42) + v);
  }
  var issues = [];
  function bug(s) {
    issues.push(s);
    console.log("  !! " + s);
  }

  H("LIBRARY");
  var items = [],
    codes = {},
    grpNames = {};
  LIBRARY.forEach(function (cl) {
    if (codes[cl.code]) bug("duplicate checklist code " + cl.code);
    codes[cl.code] = 1;
    cl.groups.forEach(function (g) {
      var key = cl.code + "/" + g.code;
      if (grpNames[key]) bug("duplicate group " + key);
      grpNames[key] = 1;
      g.items.forEach(function (i) {
        items.push({ cl: cl.code, g: g.code, i: i });
      });
    });
  });
  P("checklists / groups / items", LIBRARY.length + " / " + Object.keys(grpNames).length + " / " + items.length);
  var noTitle = items.filter(function (x) {
    return !x.i.t || !x.i.t.trim();
  });
  var noText = items.filter(function (x) {
    return !x.i.a || !x.i.a.trim();
  });
  var noSec = items.filter(function (x) {
    return !x.i.s || !x.i.s.length;
  });
  var noProv = items.filter(function (x) {
    return !x.i.p;
  });
  P("missing title", noTitle.length);
  P("missing corrective text", noText.length);
  P(
    "no ordinance",
    noSec.length +
      (noSec.length
        ? "  (" +
          noSec
            .map(function (x) {
              return x.i.t;
            })
            .join("; ") +
          ")"
        : ""),
  );
  P("missing provenance", noProv.length);
  var prov = {};
  items.forEach(function (x) {
    prov[x.i.p] = (prov[x.i.p] || 0) + 1;
  });
  P("provenance", JSON.stringify(prov));
  var dupT = {},
    dups = [];
  items.forEach(function (x) {
    var k = x.cl + "|" + x.i.t.toUpperCase();
    if (dupT[k]) dups.push(k);
    dupT[k] = 1;
  });
  P("duplicate titles within a checklist", dups.length + (dups.length ? ": " + dups.slice(0, 4).join(", ") : ""));
  var blanks = items.filter(function (x) {
    return countBlanks(x.i.a) > 0;
  });
  P("items with ( ) blanks", blanks.length);
  var ordShape = items.filter(function (x) {
    return (x.i.s || []).some(function (o) {
      return !/^(\d+\.\d|SPS )/.test(o);
    });
  });
  P(
    "odd-looking ordinance strings",
    ordShape.length +
      (ordShape.length
        ? ": " +
          ordShape
            .map(function (x) {
              return x.i.s.join("/");
            })
            .slice(0, 5)
            .join(", ")
        : ""),
  );
  var longT = items.filter(function (x) {
    return x.i.a.length > 1200;
  });
  P("very long corrective texts (>1200 ch)", longT.length);

  H("DEPOSIT SCHEDULE");
  P("rows", DEPOSITS.length);
  var dupO = [],
    seen = {};
  DEPOSITS.forEach(function (f) {
    if (seen[f.ordinance]) dupO.push(f.ordinance);
    seen[f.ordinance] = 1;
  });
  P("duplicate ordinances", dupO.length + (dupO.length ? ": " + dupO.join(", ") : ""));
  P(
    "rows with no tier ladder",
    DEPOSITS.filter(function (f) {
      return !f.tiers || !f.tiers.length;
    }).length,
  );
  var badTier = DEPOSITS.filter(function (f) {
    return (f.tiers || []).some(function (t) {
      return !(t.amountCents > 0) || !t.ordinal;
    });
  });
  P("malformed tiers", badTier.length);
  var nonAsc = DEPOSITS.filter(function (f) {
    var t = f.tiers || [];
    for (var n = 1; n < t.length; n++) if (t[n].amountCents < t[n - 1].amountCents) return true;
    return false;
  });
  P(
    "non-ascending ladders",
    nonAsc.length +
      (nonAsc.length
        ? ": " +
          nonAsc
            .map(function (f) {
              return f.ordinance;
            })
            .join(", ")
        : ""),
  );
  P(
    "missing description",
    DEPOSITS.filter(function (f) {
      return !f.description;
    }).length,
  );

  H("LIBRARY -> DEPOSIT COVERAGE");
  var secs = {};
  items.forEach(function (x) {
    (x.i.s || []).forEach(function (o) {
      secs[o] = 1;
    });
  });
  var all = Object.keys(secs),
    ex = 0,
    fb = 0,
    none = [];
  all.forEach(function (o) {
    var f = lookupForf([o]);
    if (!f) none.push(o);
    else if (f.exact) ex++;
    else fb++;
  });
  P("distinct ordinances in the library", all.length);
  P("  exact schedule entry", ex);
  P("  chapter fallback", fb);
  P("  no deposit path", none.length + ": " + none.join(", "));

  H("INSPECTORS");
  P("count", INSPECTORS.length);
  var ids = {},
    ems = {},
    bad = 0;
  INSPECTORS.forEach(function (x) {
    if (ids[x.id]) bug("duplicate inspector id " + x.id);
    ids[x.id] = 1;
    if (ems[x.email]) bug("duplicate email " + x.email);
    ems[x.email] = 1;
    if (!/^[a-z0-9.\-]+@cityofmadison\.com$/.test(x.email)) bug("odd email " + x.email);
    if (!/^\(608\) \d{3}-\d{4}$/.test(x.phone)) bug("odd phone for " + x.name + ": " + x.phone);
    if (x.badge && !/^\d{4}$/.test(x.badge)) bug("odd badge for " + x.name + ": " + x.badge);
  });
  P(
    "without a badge",
    INSPECTORS.filter(function (x) {
      return !x.badge;
    })
      .map(function (x) {
        return x.name;
      })
      .join(", "),
  );
  var dupB = {},
    dupBadge = [];
  INSPECTORS.forEach(function (x) {
    if (!x.badge) return;
    if (dupB[x.badge]) dupBadge.push(x.badge);
    dupB[x.badge] = 1;
  });
  P("duplicate badges", dupBadge.length ? dupBadge.join(", ") : "none");

  H("SEED CASES");
  WriterState.CASES.forEach(function (k) {
    if (!k.number || !k.address) bug("case " + k.id + " missing number or address");
    if (!insp(k.inspectorId).name) bug("case " + k.number + " points at a missing inspector: " + k.inspectorId);
    var o = ownerLines(k);
    if (o.length < 3) bug("case " + k.number + " mailing block has only " + o.length + " line(s)");
  });
  P("cases", WriterState.CASES.length);
  P(
    "all inspectors resolve",
    WriterState.CASES.every(function (k) {
      return !!insp(k.inspectorId).name;
    }),
  );

  console.log("\n" + (issues.length ? issues.length + " DATA ISSUE(S)" : "no data issues"));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
