export function createLocalCaseFiles(services) {
  function downloadFile(name, body) {
    const blob = new services.Blob([body], { type: "application/json" });
    const url = services.URL.createObjectURL(blob),
      a = services.document.createElement("a");
    a.href = url;
    a.download = name;
    services.document.body.appendChild(a);
    a.click();
    a.remove();
    services.setTimeout(() => services.URL.revokeObjectURL(url), 4000);
  }

  function pickCaseFile() {
    const inp = services.document.createElement("input");
    inp.type = "file";
    inp.accept = ".json,application/json";
    inp.onchange = () => {
      const file = inp.files && inp.files[0];
      if (!file) return;
      const fr = new services.FileReader();
      fr.onerror = () => services.toast("That file could not be read from this machine");
      fr.onload = () => {
        try {
          services.loadCaseFile(String(fr.result));
        } catch (err) {
          services.toast("That case file was not loaded — " + ((err && err.message) || "it could not be read"));
        }
      };
      fr.readAsText(file);
    };
    inp.click();
  }
  return { downloadFile, pickCaseFile };
}
