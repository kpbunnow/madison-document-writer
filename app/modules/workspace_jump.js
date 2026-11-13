/* Find a case in the Workspace list (owner direction 2026-11-13). Nothing is hidden: matching rows are marked while
   typing, and Enter scrolls to the first match and moves focus to it. Screen-only; no state is kept. */
const rowText = (row) =>
  [".addr", ".case-number"]
    .map((s) => row.querySelector(s)?.textContent || "")
    .join(" ")
    .toLowerCase();

function mark(input) {
  const query = input.value.trim().toLowerCase(),
    rows = [...document.querySelectorAll("tr[data-queue-case]")],
    status = document.getElementById("workspace-jump-status");
  rows.forEach((row) => row.classList.remove("case-jump-hit"));
  const hits = query ? rows.filter((row) => rowText(row).includes(query)) : [];
  hits.forEach((row) => row.classList.add("case-jump-hit"));
  if (status)
    status.textContent = !query
      ? ""
      : hits.length
        ? hits.length + (hits.length === 1 ? " case" : " cases") + " highlighted. Press Enter to go to the first."
        : "No case in this list matches.";
  return hits;
}

export function createWorkspaceJump() {
  document.addEventListener("input", (event) => {
    if (event.target.id === "workspace-jump") mark(event.target);
  });
  document.addEventListener("keydown", (event) => {
    if (event.target.id !== "workspace-jump" || event.key !== "Enter") return;
    event.preventDefault();
    const first = mark(event.target)[0];
    if (!first) return;
    first.tabIndex = -1;
    first.scrollIntoView?.({ block: "center" });
    first.focus({ preventScroll: true });
  });
}
