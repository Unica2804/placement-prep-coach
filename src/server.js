import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runSetter, runEvaluator, runResumeParse } from "./mastra/agents.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(root, "public")));

const backupStore = new Map(); // opt-in only; primary store is IndexedDB on-device

app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

app.post("/api/session", (req, res) => {
  const { resumeText = "", jd = "", role = "" } = req.body ?? {};
  const profile = runResumeParse(resumeText);
  profile.target_role = String(role || "").slice(0, 120);
  const session = {
    id: `s_${Date.now().toString(36)}`,
    profile,
    jd: String(jd || "").slice(0, 8000),
    turn: 0,
    history: [],
    createdAt: new Date().toISOString(),
  };
  const q = runSetter(profile, session.jd, 0);
  session.history.push({ role: "assistant", text: q });
  res.json({ sessionId: session.id, question: q, profile });
});

app.post("/api/turn", (req, res) => {
  const { question = "", answer = "", profile = {}, jd = "", turn = 0 } = req.body ?? {};
  if (!String(answer).trim()) return res.status(400).json({ error: "empty answer" });
  const eval_ = runEvaluator(String(question), String(answer));
  const nextQ = runSetter(profile, String(jd), Number(turn) + 1);
  res.json({ eval: eval_, nextQuestion: nextQ });
});

app.put("/api/sessions/:id", (req, res) => {
  if (req.body?.consent !== true) return res.status(400).json({ error: "backup requires explicit consent" });
  backupStore.set(req.params.id, { ...req.body, backedUpAt: new Date().toISOString() });
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => console.log(`prep-coach listening on :${PORT}`));
}
export default app;
