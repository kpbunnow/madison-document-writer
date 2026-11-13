/* Reuse Workspace rows only while the surrounding screen is byte-identical. No authority or model cache. */
const screens = new WeakMap();

function rowParts(markup) {
  const table = markup.indexOf('class="case-table-wrap workspace-cases"');
  const start = table < 0 ? -1 : markup.indexOf("<tbody>", table);
  const end = start < 0 ? -1 : markup.indexOf("</tbody>", start);
  if (start < 0 || end < 0) return null;
  const body = markup.slice(start + 7, end),
    rows = [...body.matchAll(/<tr data-queue-case="([^"]*)"[\s\S]*?<\/tr>/g)].map((match) => ({ key: match[1], html: match[0] }));
  // A changed renderer/nested table must use the ordinary full repaint rather than a partial interpretation.
  if (rows.map((row) => row.html).join("") !== body || new Set(rows.map((row) => row.key)).size !== rows.length) return null;
  return { before: markup.slice(0, start + 7), after: markup.slice(end), rows };
}

function remember(root, parts) {
  const body = root.querySelector(".workspace-cases table > tbody"),
    nodes = body ? [...body.children] : [];
  if (!parts || nodes.length !== parts.rows.length) return screens.delete(root);
  screens.set(root, { ...parts, body, rows: new Map(parts.rows.map((row, n) => [row.key, { ...row, node: nodes[n] }])) });
}

function patchRows(root, previous, parts) {
  const active = root.ownerDocument.activeElement,
    kept = new Set();
  let cursor = previous.body.firstElementChild;
  const rows = new Map();
  for (const row of parts.rows) {
    const old = previous.rows.get(row.key);
    let node = old?.html === row.html ? old.node : null;
    if (!node) {
      const template = root.ownerDocument.createElement("template");
      template.innerHTML = row.html;
      node = template.content.firstElementChild;
    }
    if (node !== cursor) previous.body.insertBefore(node, cursor);
    kept.add(node);
    rows.set(row.key, { ...row, node });
    cursor = node.nextElementSibling;
  }
  for (const node of [...previous.body.children]) if (!kept.has(node)) node.remove();
  screens.set(root, { ...parts, body: previous.body, rows });
  // insertBefore can blur a moved row's focused control. Restore only the same surviving node.
  if (active?.isConnected && root.contains(active) && root.ownerDocument.activeElement !== active) active.focus({ preventScroll: true });
}

export function paintWorkspace(root, markup, enabled) {
  const parts = enabled ? rowParts(markup) : null,
    previous = screens.get(root);
  if (
    parts &&
    previous &&
    previous.before === parts.before &&
    previous.after === parts.after &&
    root.contains(previous.body) &&
    [...previous.rows.values()].every((row) => row.node.parentNode === previous.body)
  ) {
    patchRows(root, previous, parts);
    return;
  }
  root.innerHTML = markup;
  remember(root, parts);
}
