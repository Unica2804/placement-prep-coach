// Residency router: decides whether both models stay loaded or swap per turn.
// deviceMemory buckets are coarse (…, 4, 8) — 6 is not a real value, so the
// effective RAM threshold is 8. Missing API (Firefox/Safari) → swap (safe).

export const MODES = ["gpu-resident", "ram-resident", "swap"];

export function decideResidency({ deviceMemory, webgpu = false } = {}) {
  if (webgpu) return "gpu-resident"; // Gemma in VRAM, Parakeet on CPU — separate memories
  if (typeof deviceMemory === "number" && deviceMemory >= 8) return "ram-resident";
  return "swap"; // unknown, small, or <= 4 GB buckets
}

export function describeMode(mode) {
  return {
    "gpu-resident": "both models resident (VRAM+CPU), zero swaps",
    "ram-resident": "both models resident (~5.4 GB RAM), zero swaps",
    swap: "one model at a time, swap at turn boundaries (~4 s/turn)",
  }[mode];
}

// Runtime model manager: enforces the mode, downgrades resident→swap on OOM/load failure.
export class ModelResidency {
  constructor({ mode = "swap", loadParakeet, loadGemma, unloadParakeet, unloadGemma, onEvent = () => {} }) {
    this.mode = mode;
    this.loaded = new Set();
    this.loaders = { parakeet: loadParakeet, gemma: loadGemma };
    this.unloaders = { parakeet: unloadParakeet, gemma: unloadGemma };
    this.onEvent = onEvent;
  }

  // Ensure `name` is loaded; in swap mode unloads the other model first.
  // On load failure in a resident mode, downgrades to swap and retries once.
  async ensure(name) {
    if (this.loaded.has(name)) return true;
    const other = name === "gemma" ? "parakeet" : "gemma";
    if (this.mode === "swap" && this.loaded.has(other)) {
      await this.unloaders[other]();
      this.loaded.delete(other);
      this.onEvent({ type: "unload", model: other });
    }
    try {
      await this.loaders[name]();
    } catch (err) {
      if (this.mode !== "swap") {
        this.mode = "swap"; // adaptive downgrade (ARCHITECTURE.md §6)
        this.onEvent({ type: "downgrade", reason: String(err?.message || err) });
        if (this.loaded.has(other)) {
          await this.unloaders[other]();
          this.loaded.delete(other);
        }
        await this.loaders[name](); // throws to caller if this fails too
      } else throw err;
    }
    this.loaded.add(name);
    this.onEvent({ type: "load", model: name, mode: this.mode });
    return true;
  }
}
