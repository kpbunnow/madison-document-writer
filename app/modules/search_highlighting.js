/* Screen-only enhancement. Matching/ranking stays with each search owner. Text nodes, never HTML or form values,
   are marked; rerenders/clearing the query remove the marks. No listeners/observers/timers; cached result roots are
   weak references, so discarded screens are collectible. Unchanged enhancement performs no DOM writes. */
import { languageHighlightTerms } from "./language_search.js";

const fold = (value) => String(value).normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
const blocked = "mark,input,textarea,select,option,script,style,[contenteditable],.document-workspace,[data-close],.language-add-again";
const painted = new WeakMap();

function removeMark(mark) {
  const parent = mark.parentNode;
  mark.replaceWith(mark.ownerDocument.createTextNode(mark.textContent));
  parent.normalize();
}

function highlightNode(node, terms, wordStart) {
  const original = node.data;
  let folded = "",
    offset = 0;
  const starts = [],
    ends = [];
  for (const char of original) {
    const text = fold(char);
    for (let n = 0; n < text.length; n++) {
      starts.push(offset);
      ends.push(offset + char.length);
    }
    if (!text && ends.length) ends[ends.length - 1] = offset + char.length;
    folded += text;
    offset += char.length;
  }
  const ranges = [];
  for (const term of terms) {
    let at = 0;
    while ((at = folded.indexOf(term, at)) !== -1) {
      if (!wordStart || !at || !/[a-z0-9]/.test(folded[at - 1])) ranges.push([starts[at], ends[at + term.length - 1]]);
      at += term.length;
    }
  }
  if (!ranges.length) return;
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push(range.slice());
  }
  const document = node.ownerDocument,
    fragment = document.createDocumentFragment();
  let end = 0;
  for (const [from, to] of merged) {
    fragment.append(document.createTextNode(original.slice(end, from)));
    const mark = document.createElement("mark");
    mark.dataset.searchMatch = "";
    mark.textContent = original.slice(from, to);
    fragment.append(mark);
    end = to;
  }
  fragment.append(document.createTextNode(original.slice(end)));
  node.replaceWith(fragment);
}

export function highlightSearchText(root, terms, wordStart = false) {
  const unique = [...new Set(terms.map(fold).filter(Boolean))];
  if (!unique.length) return;
  const walker = root.ownerDocument.createTreeWalker(root, 4),
    nodes = [];
  while (walker.nextNode()) if (!walker.currentNode.parentElement.closest(blocked)) nodes.push(walker.currentNode);
  for (const node of nodes) highlightNode(node, unique, wordStart);
}

const searches = [
  ["case-search", ".case-table tbody", "phrase"],
  ["folder-search", ".folderlist", "phrase"],
  ["open-cases-search", "#open-cases-results .open-case-main", "words"],
  [
    "pk-q",
    ".picker-list .language-entry-head,.picker-list .language-preview,.picker-list .language-details,.picker-list .language-group-h",
    "language",
  ],
  ["lib-filter", ".language-browser .language-group", "language"],
  ["catalog-filter", ".language-admin-list,.language-review-entry", "language"],
  ["deposit-schedule-search", "table.rep tbody", "words"],
  ["pv-q", ".card-case", "phrase"],
  ["ow-q", "table.rep tbody,.card-case", "phrase"],
];

export function enhanceSearchResults(root) {
  const active = [];
  for (const [id, selector, mode] of searches) {
    const input = root.querySelector("#" + id);
    if (!input) continue;
    const query = String(input?.value || "").trim();
    const terms = mode === "language" ? languageHighlightTerms(query) : mode === "words" ? query.split(/\s+/) : [query];
    const signature = JSON.stringify([mode, terms]);
    root.querySelectorAll(selector).forEach((result) => {
      active.push(result);
      const text = result.textContent,
        prior = painted.get(result);
      if (prior?.signature === signature && prior.text === text) return;
      result.querySelectorAll("mark[data-search-match]").forEach(removeMark);
      highlightSearchText(result, terms, mode === "language");
      painted.set(result, { signature, text });
    });
  }
  root.querySelectorAll("mark[data-search-match]").forEach((mark) => {
    if (!active.some((result) => result.contains(mark))) removeMark(mark);
  });
}
