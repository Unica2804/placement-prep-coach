# ARCHITECTURE.md — Placement Prep Coach

> Detailed architecture. Follow closely. **Any change must be consulted with the owner before implementation.**

## 1. System split

```
Browser (private heavy lift, WASM)          Render Web Service (credits, sleeps when idle)
├── Gemma IQ4_XS via wllama                ├── Vite build serve + /healthz
├── Parakeet Q4_K_M via WASM               ├── Mastra agents/workflows/tools (native Node)
├── 1Q interview UI + voice textbox         ├── prompt versioning + eval harness
├── Dexie IndexedDB sessions (primary)     ├── HF weight proxy (Range cache)
└── zero PII egress by default              └── opt-in session backup store (consent only)
```

Rationale: heavy inference on-device (privacy + $0/run story for judges); server thin and stateless except opt-in backup; sleeping when idle caps credits; app shell paints before ~3.5 GB lazy weights finish.

## 2. Stack

* Frontend: Vite + TypeScript + Tailwind, PWA app shell, modern professional look, dark/light, 360px mobile, keyboard + screen-reader accessible.
* AI runtimes (client): `wllama` (llama.cpp WASM) for Gemma GGUF; `transcribe.cpp`/`whisper.cpp parakeet-cli` WASM build for Parakeet GGUF; `PDF.js` text layer + `Tesseract.js eng` OCR fallback; WebAudio 16 kHz mono resample + VAD.
* Agents (server): `@mastra/core` 1.76.0 + Zod. Agents: `setterAgent` (5-question sets from resume+JD+role), `evaluatorAgent` (STAR rubric 0–10 + rewrite), `plannerAgent` (7-day plan). Tools: `parseResume`, `nextQuestion`, `scoreAnswer` — all Zod-validated, traces journaled. Tenant = anonymous session ID from client `requestContext`, never identity from model input.
* Store: Dexie.js IndexedDB `sessions, turns, evals` (primary). Opt-in `PUT /api/sessions/:id` backup; export/import JSON always available. Quota-exceeded and schema-migration paths handled.
* Server: Node 22 Express, serves `dist/`, `/api/mastra/*`, `/api/sessions/*`, `/healthz`. `render.yaml` = web service, sleep-when-idle on, disk not required (weights via CDN/HF cache).

## 3. Models

| Role | Repo / file | Size | License | Notes |
| ---- | ----------- | ---- | ------- | ----- |
| LLM | `unsloth/gemma-4-E2B-it-GGUF` / `gemma-4-E2B-it-IQ4_XS.gguf` | 2.98 GB | Apache-2.0 | 5.1B stored / 2.3B eff, 128K ctx, multimodal (resume PDF direct read), function-calling, temp 1.0 / top_p 0.95 / top_k 64 |
| STT | `handy-computer/parakeet-tdt-0.6b-v3-gguf` / `parakeet-tdt-0.6b-v3-Q4_K_M.gguf` | 485 MB | CC-BY-4.0 | 0.6B Conformer-TDT, 25 EU langs, 16 kHz mono WAV, WER 1.98% LibriSpeech clean, timestamps optional |

Fallbacks (feature-flagged, need owner approval to become default): OCR via Tesseract; CPU-friendly `Qwen3-0.6B 614MB` if device lacks WebGPU/RAM.

## 4. Flows

1. **Upload:** txt/pdf/image → Gemma multimodal structured extract → `{skills[], experience[], projects[], target_role}` → IDB. Pass bar: clean >90% field recall, PDF >70%. Below bar → OCR fallback auto-engages and re-tests.
2. **Interview:** one question on screen; auto-growing textbox + mic toggle + live transcript (editable pre-submit). Mic → VAD → 16 kHz WAV → Parakeet WASM → transcript. `POST /api/mastra/turn` → evaluator score → setter next question.
3. **Eval + Plan:** final scores, per-answer rewrites, 7-day plan. All in IDB; backup only if toggle on.

## 5. Privacy / open-innovation narrative (for submission)

* Default zero-egress: prove with network tab. Open weights make $0/run business viable, keep student PII off third-party servers, allow weight swaps without vendor lock-in.
* Licenses: Apache-2.0 (Gemma GGUF) + CC-BY-4.0 (Parakeet) + MIT (our code) — all permissive, commercial-use compatible.

## 6. Residency router (RAM-based, avoids per-turn load/unload latency)

Swap costs ~3.8 s/turn (Gemma 3.3 s + Parakeet 0.5 s); both resident costs
~5.4 GB. The router picks one strategy at startup and can downgrade at runtime.

```
RAM unknown  → assume small  → swap
WebGPU present → gpu-resident (Gemma in VRAM, Parakeet on CPU, no swaps)
navigator.deviceMemory >= 8 → ram-resident (both resident, no swaps)
else → swap at turn boundaries only
```

Notes:

* `navigator.deviceMemory` returns coarse buckets (…, 4, 8), never 6 — so the
  effective threshold is 8, not 6. Missing API (Firefox/Safari) = assume swap.
* Swap schedule: transcribe (Parakeet resident) → swap → ONE Gemma call
  (eval + next question together) → Gemma idles through the human
  read/think/speak phase → swap back (0.5 s) → transcribe. ~4 s overhead per
  60–90 s turn, masked by "evaluating…" UI.
* One LLM call per turn, ever. No LLM on partial transcripts or keystrokes.
* Runtime downgrade: any model-load OOM/failure in resident mode falls back to
  swap automatically and records it in the session trace.

## 7. Test-first spikes (run before UI/infra)

* Spike 1 (Gemma resume): 3 resumes × IQ4_XS via wllama; record recall, tok/s, VRAM/RAM.
* Spike 2 (Parakeet): 30 s clean/noisy/accented samples; record WER, load-from-cache time, RTF.
* Spike 3 (Mastra): tool-schema rejection, trace journaling, session resume after reload, cold-start overlap with weight download.
