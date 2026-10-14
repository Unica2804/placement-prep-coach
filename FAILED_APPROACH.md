# FAILED_APPROACH.md — Banned approaches

> Do not attempt anything listed here. Check this file before any model, runtime, or hosting choice. Additions need owner approval.

## 1. From Week 1 StarWatch (proven failures, do not repeat)

* **F1 — Florence-2-base zero-shot as identifier:** captioned Orion field generically ("night sky filled with stars"), never named constellations. Rejected: generic caption ≠ identification.
* **F2 — SigLIP zero-shot naming:** prompt-fragile and confidently wrong (Scorpius 0.354 > Orion 0.221 on an Orion photo). Own 0.5 gate rejected every claim. Rejected: ships lies with good latency.

## 2. Week 2 guards (would void track claims or privacy story)

* **F3 — Closed-API-only wrapper with no open weights at core:** ineligible for Best Use of Gemma and weak on "why open matters." Our LLM/STT must be the locked GGUFs running on-device.
* **F4 — Claiming tracks not meaningfully used:** Week 1 honesty rule. Enter only Gemma/Mastra/Render categories the build genuinely uses.
* **F5 — Server-upload transcription (cloud STT API as default):** voids on-device privacy claim and Side Hustle cost story. Cloud STT is banned as default; Parakeet WASM is the path.
* **F6 — GGUF loaded without a WASM-capable runtime:** raw `.gguf` fetch with no wllama / transcribe.cpp / whisper.cpp WASM build will not run in-browser. Spike it properly or stop and consult owner.
* **F7 — Static-only Mastra hack as default:** superseded by Render Web Service decision — do not bundle `@mastra/core` into the browser as the primary design. Mastra runs native in Node.
* **F8 — PII-by-default to server:** resume text/audio must never upload without explicit opt-in backup toggle. Any "backup always on" design is banned.
