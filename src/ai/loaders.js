// Browser model loaders. Wire ModelResidency to real on-device runtimes.
// Gemma: wllama (llama.cpp WASM) from CDN, weights cached in IDB by wllama.
// Parakeet: whisper.cpp parakeet WASM build — NOT yet vendored (B2 risk, see BACKLOG).
//   captureSpeech (mic → 16 kHz WAV) works today; transcribe() reports
//   { ready:false } until the WASM build lands, so the UI stays honest.
import { downsampleTo16k, encodeWav16k } from "./audio.js";
import { decideResidency, ModelResidency } from "./modelRouter.js";

export const GEMMA_URL =
  "https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-IQ4_XS.gguf";
export const PARAKEET_URL =
  "https://huggingface.co/handy-computer/parakeet-tdt-0.6b-v3-gguf/resolve/main/parakeet-tdt-0.6b-v3-Q4_K_M.gguf";

let gemma = null;

export async function loadGemmaWllama(onProgress = () => {}) {
  if (gemma) return gemma;
  const { Wllama } = await import(
    "https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.9/esm/index.js"
  );
  const { default: WasmFromCDN } = await import(
    "https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.9/esm/wasm-from-cdn.js"
  );
  const w = new Wllama(WasmFromCDN);
  await w.loadModelFromUrl(GEMMA_URL, {
    n_threads: Math.min(4, (navigator.hardwareConcurrency || 4) - 1),
    n_ctx: 4096, // 4K keeps RSS down (S1 measured 4.28 GB at 8K)
    progressCallback: onProgress,
  });
  gemma = w;
  return w;
}

export async function unloadGemma() {
  gemma = null; // wllama frees on page GC; explicit unload lands with worker refactor
}

export async function loadParakeetWasm() {
  throw new Error("parakeet-wasm-not-vendored"); // B2 open item: bundle whisper.cpp parakeet WASM
}
export async function unloadParakeet() {}

export async function transcribeWav16k(_wavBytes) {
  return { ready: false, reason: "parakeet-wasm-not-vendored" };
}

// Mic → 16 kHz mono WAV bytes. Pure capture path, works today.
export async function captureSpeech16kWav({ maxSec = 120, onLevel = () => {} } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const chunks = [];
  let silentTicks = 0;
  const sampleRate = ctx.sampleRate;
  const captured = await new Promise((resolve) => {
    const stop = () => {
      src.disconnect(); proc.disconnect(); ctx.close();
      stream.getTracks().forEach((t) => t.stop());
      const flat = new Float32Array(chunks.reduce((a, c) => a + c.length, 0));
      let o = 0;
      for (const c of chunks) { flat.set(c, o); o += c.length; }
      resolve(flat);
    };
    const timer = setTimeout(stop, maxSec * 1000);
    proc.onaudioprocess = (e) => {
      const d = e.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(d));
      let peak = 0;
      for (let i = 0; i < d.length; i += 16) peak = Math.max(peak, Math.abs(d[i]));
      onLevel(peak);
      if (peak < 0.01 && ++silentTicks > 200) { clearTimeout(timer); stop(); }
    };
    src.connect(proc); proc.connect(ctx.destination);
    captureSpeech16kWav.stop = () => { clearTimeout(timer); stop(); };
  });
  return encodeWav16k(downsampleTo16k(captured, sampleRate));
}

export function createResidency(onEvent) {
  const mode = decideResidency({
    deviceMemory: navigator.deviceMemory,
    webgpu: !!navigator.gpu,
  });
  return new ModelResidency({
    mode,
    loadParakeet: loadParakeetWasm,
    loadGemma: () => loadGemmaWllama(),
    unloadParakeet,
    unloadGemma,
    onEvent,
  });
}
