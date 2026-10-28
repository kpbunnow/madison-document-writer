"use strict";
/* Lazy composition preserves per-instance callbacks, live rebinding and native descriptors. */
const assert = require("node:assert/strict"),
  path = require("node:path"),
  esbuild = require("esbuild"),
  acorn = require("acorn");
const { serviceComposition } = require("../fixtures/deferred_service_syntax.cjs");
(async () => {
  const compiled = await esbuild.build({
    entryPoints: [path.resolve("app/modules/deferred_services.js")],
    bundle: true,
    write: false,
    format: "cjs",
  });
  const box = { exports: {} };
  new Function("module", "exports", compiled.outputFiles[0].text)(box, box.exports);
  const { deferredServices } = box.exports;
  const scope = deferredServices({ invoke: () => target, current: () => current }, ["current"]);
  let current = { id: "first" },
    target = function (...args) {
      return { receiver: this, args };
    };
  assert.deepEqual(Object.keys(scope), ["invoke", "current"]);
  const callback = scope.invoke;
  assert.equal(callback.name, "invoke");
  assert.equal(callback.length, 0);
  assert.equal(Object.hasOwn(callback, "prototype"), false);
  assert.deepEqual(scope.invoke(1, 2), { receiver: undefined, args: [1, 2] });
  const promise = Promise.resolve("same promise");
  target = () => promise;
  assert.equal(callback(), promise);
  const refusal = new Error("same refusal");
  target = () => {
    throw refusal;
  };
  assert.throws(callback, (error) => error === refusal);
  const first = current;
  assert.equal(scope.current, first);
  current = { id: "second" };
  assert.equal(scope.current, current);
  const second = deferredServices({ invoke: () => target, current: () => current }, ["current"]);
  assert.notEqual(second.invoke, callback);
  assert.equal(second.current, current);
  const callDescriptor = Object.getOwnPropertyDescriptor(scope, "invoke"),
    valueDescriptor = Object.getOwnPropertyDescriptor(scope, "current");
  assert.equal(callDescriptor.enumerable, true);
  assert.equal(callDescriptor.configurable, true);
  assert.equal(callDescriptor.writable, true);
  assert.equal(valueDescriptor.get.name, "get current");
  assert.equal(valueDescriptor.set, undefined);
  assert.equal(valueDescriptor.enumerable, true);
  assert.equal(valueDescriptor.configurable, true);
  const parse = (text) => acorn.parse(text, { ecmaVersion: 2022 }).body[0].expression;
  assert.deepEqual(
    serviceComposition(parse('deferredServices({invoke:()=>target,current:()=>current},["current"])')).properties.map((p) => p.kind),
    ["init", "get"],
  );
  for (const invalid of [
    "deferredServices({invoke:async()=>target})",
    "deferredServices({__proto__:()=>target})",
    "other({invoke:()=>target})",
    "deferredServices({...wide})",
    "deferredServices({invoke:target})",
    "deferredServices({invoke:()=>target()})",
    "deferredServices({invoke:(arg)=>target})",
    'deferredServices({invoke:()=>target},["missing"])',
    'deferredServices({invoke:()=>target},["invoke","invoke"])',
  ])
    assert.throws(() => serviceComposition(parse(invalid)), invalid);
  console.log("PASS inert lazy declarations, live identities, synchronous errors/promises and descriptor parity");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
