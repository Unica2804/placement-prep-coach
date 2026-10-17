import express from "express";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runSessionStart, runTurn } from "./mastra/agents.js";
import { gemmaProvisioned } from "./ai/gemmaServer.js";
import { TRANSCRIBE_BIN, PARAKEET_MODEL } from "./ai/sttPaths.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(root, "public")));
app.use("/src", express.static(path.join(root, "src"))); // dev + Render: ships browser AI modules

const backupStore = new Map(); // opt-in only; primary store is IndexedDB on-device

const sttProvisioned = () => fs.existsSync(TRANSCRIBE_BIN) && fs.existsSync(PARAKEET_MODEL);

app.get("/healthz", (_req, res) =>
  res.status(200).json({ ok: true, stt: sttProvisioned(), llm: gemmaProvisioned() }),
);

app.post("/api/session", async (req, res) => {
  const { resumeText = "", jd = "", role = "" } = req.body ?? {};
  const { profile, question, engine } = await runSessionStart({ resumeText, jd, role });
  const session = {
    id: `s_${Date.now().toString(36)}`,
    profile,
    jd: String(jd || "").slice(0, 8000),
    turn: 0,
    history: [],
    createdAt: new Date().toISOString(),
  };
  session.history.push({ role: "assistant", text: question });
  res.json({ sessionId: session.id, question, profile, engine });
});

app.post("/api/turn", async (req, res) => {
  const { question = "", answer = "", profile = {}, jd = "", turn = 0 } = req.body ?? {};
  if (!String(answer).trim()) return res.status(400).json({ error: "empty answer" });
  const { eval: eval_, nextQuestion, engine } = await runTurn({
    question: String(question),
    answer: String(answer),
    profile,
    jd: String(jd),
    turn: Number(turn),
  });
  res.json({ eval: eval_, nextQuestion, engine });
});

app.put("/api/sessions/:id", (req, res) => {
  if (req.body?.consent !== true) return res.status(400).json({ error: "backup requires explicit consent" });
  backupStore.set(req.params.id, { ...req.body, backedUpAt: new Date().toISOString() });
  res.json({ ok: true });
});

// Opt-in server transcription (Parakeet on Render, credits-funded).
// Default is on-device; this endpoint only runs when the user explicitly
// chooses server transcription in the UI (consent flag in the query string).
// Body: raw 16 kHz mono WAV bytes (max ~6 min). Paths come from sttPaths.js.
//
// Parakeet peaks at ~905 MB RSS, so on the 2 GB instance two simultaneous runs
// would OOM. Transcriptions are therefore serialized, with a small waiting
// queue that answers 429 rather than buffering unbounded 12 MB uploads.

const STT_MAX_WAITING = 3;
let sttInFlight = 0;
let sttTail = Promise.resolve();

function enqueueTranscription(job) {
  const run = sttTail.then(job, job);
  sttTail = run.then(
    () => {},
    () => {},
  );
  return run;
}

app.post("/api/transcribe", express.raw({ type: "audio/wav", limit: "12mb" }), (req, res) => {
  if (req.query.consent !== "1") return res.status(400).json({ error: "server transcription requires explicit consent" });
  if (!req.body?.length) return res.status(400).json({ error: "empty audio" });
  if (!sttProvisioned()) return res.status(503).json({ error: "server STT not provisioned on this host" });
  if (sttInFlight > STT_MAX_WAITING) return res.status(429).json({ error: "transcription queue full, retry shortly" });
  sttInFlight++;

  const tmp = path.join(os.tmpdir(), `stt-${Date.now().toString(36)}-${sttInFlight}.wav`);
  fs.writeFileSync(tmp, req.body);

  enqueueTranscription(
    () =>
      new Promise((resolve) => {
        execFile(
          TRANSCRIBE_BIN,
          ["-m", PARAKEET_MODEL, tmp],
          { timeout: 120000, maxBuffer: 8 * 1024 * 1024 },
          (err, stdout) => resolve({ err, stdout }),
        );
      }),
  )
    .then(({ err, stdout }) => {
      if (err) return res.status(500).json({ error: "transcription failed" });
      const m = String(stdout).match(/^text:\s*(.*)$/m);
      res.json({ text: (m?.[1] || "").trim(), engine: "parakeet-tdt-0.6b-v3-Q4_K_M" });
    })
    .catch(() => res.status(500).json({ error: "transcription failed" }))
    .finally(() => {
      fs.rmSync(tmp, { force: true });
      sttInFlight--;
    });
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => console.log(`prep-coach listening on :${PORT}`));
}
export default app;
