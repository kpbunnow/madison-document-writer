/* Owned DOM rendering completes before teardown; leaked intervals and timer/completion failures still fail. */
const assert = require("assert/strict");
const { spawnSync } = require("child_process");
const scenario = process.argv[2];

if (!scenario) {
  for (const [name, status, output] of [
    ["dom", 0, "PASS owned rendering and every pending callback"],
    ["closed", 0, "PASS owned rendering and every pending callback"],
    ["frames", 0, "PASS owned rendering and every pending callback"],
    ["fast-interval", 1, "A referenced interval is still running"],
    ["frame-loop", 1, "A referenced interval is still running"],
    ["frame-interval", 1, "A referenced interval is still running"],
    ["interval", 1, "A referenced interval is still running"],
    ["timer-error", 1, "synthetic timer failure"],
    ["completion-error", 1, "synthetic completion failure"],
  ]) {
    const result = spawnSync(process.execPath, [__filename, name], { encoding: "utf8", timeout: 10000 });
    assert.ifError(result.error);
    assert.equal(result.status, status, result.stdout + result.stderr);
    assert.ok((result.stdout + result.stderr).includes(output), result.stdout + result.stderr);
  }
  console.log("PASS DOM render completion, unchanged leaked-interval refusal and timer/completion failure detection");
} else {
  const { settle } = require("../fixtures/settle_ui_timers.cjs");
  if (scenario === "completion-error") {
    settle(Promise.reject(new Error("synthetic completion failure")));
  } else if (scenario === "timer-error") {
    setTimeout(() => {
      throw new Error("synthetic timer failure");
    }, 15000);
    settle(Promise.resolve());
  } else {
    const { JSDOM } = require("jsdom");
    const dom = new JSDOM('<!doctype html><input id="field">', { pretendToBeVisual: true });
    dom.window.document.getElementById("field").focus();
    if (scenario === "closed") dom.window.close();
    if (scenario === "frame-loop") {
      const frame = () => dom.window.requestAnimationFrame(frame);
      frame();
      settle(Promise.resolve(), dom.window).catch((error) => {
        dom.window.close();
        throw error;
      });
    } else if (scenario === "frame-interval") {
      let handle;
      const completion = new Promise((resolve) =>
        dom.window.requestAnimationFrame(() => {
          handle = setInterval(() => {}, 1);
          resolve();
        }),
      );
      settle(completion, dom.window).catch((error) => {
        clearInterval(handle);
        dom.window.close();
        throw error;
      });
    } else if (scenario === "interval" || scenario === "fast-interval") {
      const handle = setInterval(() => {}, scenario === "fast-interval" ? 1 : 1000);
      settle(Promise.resolve(), dom.window).catch((error) => {
        clearInterval(handle);
        dom.window.close();
        throw error;
      });
    } else {
      const calls = [];
      const frames = [];
      if (scenario === "frames")
        dom.window.requestAnimationFrame(() => {
          frames.push(1);
          dom.window.requestAnimationFrame(() => {
            frames.push(2);
            dom.window.requestAnimationFrame(() => frames.push(3));
          });
        });
      let closed = false;
      const close = dom.window.close.bind(dom.window);
      dom.window.close = () => {
        assert.deepEqual(calls, ["short", "long"], "Window closes only after every pending callback");
        if (scenario === "frames") assert.deepEqual(frames, [1, 2, 3], "Every nested rendering callback completed before closing");
        closed = true;
        close();
      };
      setTimeout(() => calls.push("short"), 2);
      setTimeout(() => calls.push("long"), 15000);
      settle(Promise.resolve(), dom.window).then(() => {
        assert.deepEqual(calls, ["short", "long"]);
        assert.equal(closed, true);
        console.log("PASS owned rendering and every pending callback");
      });
    }
  }
}
