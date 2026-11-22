/* Search for the HTML program manual. tools/build_manual.py embeds this file, so the manual stays one page with no
   network access. It indexes the visible text of each heading, paragraph, list item, table row and figure caption,
   finds entries that contain every search word (a word may be the start of a longer word), ranks headings and
   section titles first, and links each result to its passage. Without scripts the manual still works with the
   browser's own Find (Ctrl+F). */
(function () {
  "use strict";
  var panel = document.querySelector("[data-manual-search]"),
    input = document.getElementById("manual-search-input"),
    status = document.getElementById("manual-search-status"),
    list = document.getElementById("manual-search-results"),
    clear = document.getElementById("manual-search-clear"),
    body = document.getElementById("instructions");
  if (!panel || !input || !status || !list || !body) return;
  // Everyday words staff may use for the program's own terms.
  var RELATED = {
    deadline: ["due"],
    due: ["deadline"],
    ticket: ["citation"],
    fine: ["deposit"],
    price: ["deposit", "pricing"],
    save: ["saved", "saving"],
    backup: ["backup", "recovery", "restore"],
    undo: ["undo", "correction"],
    fix: ["correct", "correction", "fix"],
    print: ["print", "pdf"],
    mail: ["mailing", "mailed", "email"],
    reinspect: ["reinspection", "reinspect"],
    quit: ["exit"],
    close: ["exit", "close"],
    shortcut: ["keyboard", "shortcut"],
    login: ["sign-in", "session"],
  };
  var fold = function (text) {
    return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  };
  var words = function (text) {
    return fold(text).match(/[a-z0-9]+(?:[.()][a-z0-9]+)*/g) || [];
  };
  var sectionOf = function (el) {
    var node = el;
    while (node && node !== body) {
      var previous = node.previousElementSibling;
      while (previous) {
        if (/^H[23]$/.test(previous.tagName) || (previous.tagName === "P" && previous.id)) return previous;
        previous = previous.previousElementSibling;
      }
      node = node.parentElement;
    }
    return null;
  };
  var chapterOf = function (el) {
    var node = el;
    while (node && node !== body) {
      var previous = node;
      while (previous) {
        if (previous.tagName === "H2") return previous;
        previous = previous.previousElementSibling;
      }
      node = node.parentElement;
    }
    return null;
  };
  var entries = [];
  body.querySelectorAll("h2, h3, p, li, tr, figcaption").forEach(function (el, n) {
    if (el.closest("nav, [data-manual-search], details > summary")) return;
    if (el.tagName === "LI" && el.querySelector("p, li")) return;
    var text = el.textContent.replace(/\s+/g, " ").trim();
    if (!text) return;
    if (!el.id) el.id = "passage-" + n;
    var heading = /^H[23]$/.test(el.tagName) || (el.tagName === "P" && el.firstElementChild && el.firstElementChild.tagName === "STRONG");
    var chapter = chapterOf(el),
      section = heading ? el : sectionOf(el);
    entries.push({
      el: el,
      text: text,
      words: words(text),
      heading: heading,
      title: (chapter ? chapter.textContent : "Program instruction manual").trim(),
      section: section && section !== chapter ? section.textContent.replace(/\s+/g, " ").trim().slice(0, 80) : "",
    });
  });
  var wordMatches = function (word, term) {
    var options = [term].concat(RELATED[term] || []);
    return options.some(function (option) {
      return word.indexOf(option) === 0;
    });
  };
  var matches = function (entry, term) {
    return entry.words.some(function (word) {
      return wordMatches(word, term);
    });
  };
  var highlights = function (text, terms) {
    // Keep original offsets/text: folding accents or using a synonym must not lose the visible match.
    return Array.from(text.matchAll(/[\p{L}\p{N}]+(?:[.()][\p{L}\p{N}]+)*/gu)).filter(function (match) {
      return terms.some(function (term) {
        return wordMatches(fold(match[0]), term);
      });
    });
  };
  var snippet = function (text, terms) {
    var hits = highlights(text, terms),
      at = hits.length ? hits[0].index : 0;
    var start = Math.max(0, at - 70),
      piece = (start ? "… " : "") + text.slice(start, start + 220) + (start + 220 < text.length ? " …" : "");
    var span = document.createElement("span");
    var cursor = 0;
    highlights(piece, terms).forEach(function (match) {
      span.appendChild(document.createTextNode(piece.slice(cursor, match.index)));
      var mark = document.createElement("mark");
      mark.textContent = match[0];
      span.appendChild(mark);
      cursor = match.index + match[0].length;
    });
    span.appendChild(document.createTextNode(piece.slice(cursor)));
    return span;
  };
  var timer = null;
  var search = function () {
    var terms = words(input.value);
    if (clear) clear.hidden = !input.value;
    list.textContent = "";
    if (!terms.length) {
      status.textContent = "";
      return;
    }
    var found = entries
      .filter(function (entry) {
        return terms.every(function (term) {
          return matches(entry, term);
        });
      })
      .map(function (entry) {
        var phrase = fold(entry.text).indexOf(fold(input.value.trim())) >= 0,
          title = words(entry.title + " " + entry.section),
          inTitle = terms.filter(function (term) {
            return title.some(function (word) {
              return word.indexOf(term) === 0;
            });
          }).length;
        return { entry: entry, score: (entry.heading ? 4 : 0) + (phrase ? 3 : 0) + 2 * inTitle - entry.text.length / 2000 };
      })
      .sort(function (a, b) {
        return b.score - a.score;
      });
    status.textContent = found.length
      ? (found.length > 40 ? "Showing 40 of " : "") + found.length + " matching passages. Select one to go to it."
      : "No passages contain every word. Try fewer or different words.";
    found.slice(0, 40).forEach(function (result) {
      var item = document.createElement("li"),
        link = document.createElement("a");
      link.href = "#" + result.entry.el.id;
      link.textContent = result.entry.title + (result.entry.section ? " › " + result.entry.section : "");
      item.appendChild(link);
      item.appendChild(document.createElement("br"));
      item.appendChild(snippet(result.entry.text, terms));
      list.appendChild(item);
    });
  };
  input.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(search, 150);
  });
  if (clear)
    clear.addEventListener("click", function () {
      clearTimeout(timer);
      input.value = "";
      search();
      input.focus();
    });
  list.addEventListener("click", function (event) {
    var link = event.target.closest("a");
    if (!link) return;
    var target = document.getElementById(link.getAttribute("href").slice(1));
    if (!target) return;
    var details = target.closest("details");
    while (details) {
      details.open = true;
      details = details.parentElement.closest("details");
    }
    target.setAttribute("tabindex", "-1");
    setTimeout(function () {
      target.focus();
    }, 0);
  });
  panel.hidden = false;
  document.querySelectorAll("[data-manual-search-link]").forEach(function (link) {
    link.hidden = false;
  });
})();
