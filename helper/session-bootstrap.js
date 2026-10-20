window.__DW_SESSION_READY__ = (async function () {
  const meta = document.querySelector('meta[name="docwriter-token"]');
  const token = new URLSearchParams(location.hash.slice(1)).get("session") || meta.content;
  let master = "";
  try {
    master = localStorage.getItem("madison-helper-bootstrap") || "";
  } catch (e) {
    /* Profile storage can be unavailable; the shortcut still supplies a token. */
  }
  if (location.hash.includes("session=")) history.replaceState(null, "", location.pathname + location.search);
  const headers = { "Content-Type": "application/json" };
  if (token) headers["X-DocWriter-Token"] = token;
  else if (master) headers["X-DocWriter-Bootstrap"] = master;
  else throw new Error("Open Document Writer from the installed desktop shortcut.");
  const response = await fetch("/session/bootstrap", { method: "POST", headers, body: "{}" });
  if (!response.ok) throw new Error("This helper session could not be opened. Use the installed desktop shortcut.");
  const value = await response.json();
  meta.content = value.token;
  try {
    localStorage.setItem("madison-helper-bootstrap", value.bootstrap);
  } catch (e) {
    /* Current tab works; new tabs may need the shortcut when profile storage fails. */
  }
  return true;
})();
window.__DW_SESSION_READY__.catch(function () {
  /* The body loader displays the recovery instruction. */
});
