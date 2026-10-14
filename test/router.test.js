import test from "node:test";
import assert from "node:assert/strict";
import { decideResidency, describeMode, ModelResidency } from "../src/ai/modelRouter.js";

test("decideResidency: unknown RAM → swap (safe default)", () => {
  assert.equal(decideResidency({}), "swap");
  assert.equal(decideResidency({ deviceMemory: undefined }), "swap");
});

test("decideResidency: small buckets → swap", () => {
  for (const gb of [0.5, 1, 2, 4]) assert.equal(decideResidency({ deviceMemory: gb }), "swap");
});

test("decideResidency: >= 8 GB → ram-resident (8 is the real bucket, not 6)", () => {
  assert.equal(decideResidency({ deviceMemory: 8 }), "ram-resident");
  assert.equal(decideResidency({ deviceMemory: 16 }), "ram-resident");
});

test("decideResidency: WebGPU wins regardless of RAM", () => {
  assert.equal(decideResidency({ deviceMemory: 4, webgpu: true }), "gpu-resident");
  assert.equal(decideResidency({ webgpu: true }), "gpu-resident");
});

test("describeMode covers every mode", () => {
  for (const m of ["gpu-resident", "ram-resident", "swap"]) assert.ok(describeMode(m).length > 5);
});

test("ModelResidency swap mode unloads the idle model before loading", async () => {
  const calls = [];
  const mgr = new ModelResidency({
    mode: "swap",
    loadParakeet: async () => calls.push("loadP"),
    loadGemma: async () => calls.push("loadG"),
    unloadParakeet: async () => calls.push("unloadP"),
    unloadGemma: async () => calls.push("unloadG"),
  });
  await mgr.ensure("parakeet");
  await mgr.ensure("gemma");
  assert.deepEqual(calls, ["loadP", "unloadP", "loadG"]);
});

test("ModelResidency resident mode keeps both loaded (no unload)", async () => {
  const calls = [];
  const mgr = new ModelResidency({
    mode: "ram-resident",
    loadParakeet: async () => calls.push("loadP"),
    loadGemma: async () => calls.push("loadG"),
    unloadParakeet: async () => calls.push("unloadP"),
    unloadGemma: async () => calls.push("unloadG"),
  });
  await mgr.ensure("parakeet");
  await mgr.ensure("gemma");
  assert.deepEqual(calls, ["loadP", "loadG"]);
});

test("ModelResidency downgrades to swap on OOM and still serves", async () => {
  const events = [];
  let gemmaFails = true;
  const mgr = new ModelResidency({
    mode: "ram-resident",
    loadParakeet: async () => {},
    loadGemma: async () => { if (gemmaFails) { gemmaFails = false; throw new Error("OOM"); } },
    unloadParakeet: async () => {},
    unloadGemma: async () => {},
    onEvent: (e) => events.push(e),
  });
  await mgr.ensure("parakeet");
  await mgr.ensure("gemma"); // first attempt OOMs → downgrade → retry succeeds
  assert.equal(mgr.mode, "swap");
  assert.ok(events.some((e) => e.type === "downgrade"));
});

test("ModelResidency re-ensure of loaded model is a no-op", async () => {
  let loads = 0;
  const mgr = new ModelResidency({
    mode: "ram-resident",
    loadParakeet: async () => loads++,
    loadGemma: async () => {},
    unloadParakeet: async () => {},
    unloadGemma: async () => {},
  });
  await mgr.ensure("parakeet");
  await mgr.ensure("parakeet");
  assert.equal(loads, 1);
});
