// Server-side Gemma (node-llama-cpp, locked GGUF). Runs inside the same
// container as the app, so inference stays on the user's machine.
//
// Recipe is the S1-proven one (see spikes/s1c-gemma-grammar.mjs and BACKLOG S1):
//   Gemma chat template + temp 0.5 / topP 0.95 / topK 64 + fixed seed,
//   unconstrained generation, parse-then-validate with 1 retry.
// Grammar-constrained decoding is NOT used: it collapses to degenerate
// placeholders on this quant at temp <= 0.8 (see FAILED_APPROACH.md).
//
// ARCHITECTURE hard rule: exactly one LLM call per turn. /api/turn therefore
// gets the score AND the next question from a single generation.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { ResumeProfile } from "../mastra/tools.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");

export const GEMMA_MODEL =
  process.env.GEMMA_MODEL || path.join(root, "models", "gemma-4-E2B-it-IQ4_XS.gguf");
export const GEMMA_ENGINE = "gemma-4-E2B-it-IQ4_XS";

const CTX = Number(process.env.GEMMA_CTX || 4096);
const MAX_RESUME_CHARS = 6000; // keeps the parse prompt inside 4K ctx
const MAX_ANSWER_CHARS = 4000;

// Tests set NODE_ENV=test before importing the server, so the 3 GB model is
// never loaded during `npm test`. GEMMA_ENABLE=0 disables it explicitly.
export function gemmaProvisioned() {
  return (
    process.env.NODE_ENV !== "test" &&
    process.env.GEMMA_ENABLE !== "0" &&
    fs.existsSync(GEMMA_MODEL)
  );
}

let model = null;
let loading = null;

async function getModel() {
  if (model) return model;
  if (!loading) {
    loading = (async () => {
      const { getLlama } = await import("node-llama-cpp");
      const llama = await getLlama();
      model = await llama.loadModel({ modelPath: GEMMA_MODEL });
      return model;
    })();
  }
  return loading;
}

// One generation at a time: each call takes its own context, and two
// concurrent contexts on a small host would blow the memory budget.
let tail = Promise.resolve();
function serialize(job) {
  const run = tail.then(job, job);
  tail = run.then(
    () => {},
    () => {},
  );
  return run;
}

function gemmaPrompt(body) {
  return `<start_of_turn>user\n${body}\n<end_of_turn>\n<start_of_turn>model\n`;
}

function extractJson(raw) {
  const m = String(raw).replace(/```json|```/g, "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

async function generateJson(body, { maxTokens = 1000, attempts = 2 } = {}) {
  return serialize(async () => {
    const { LlamaCompletion } = await import("node-llama-cpp");
    const m = await getModel();
    for (let attempt = 0; attempt < attempts; attempt++) {
      const ctx = await m.createContext({ contextSize: CTX });
      try {
        const c = new LlamaCompletion({ contextSequence: ctx.getSequence() });
        const res = await c.generateCompletionWithMeta(gemmaPrompt(body), {
          temperature: 0.5,
          topP: 0.95,
          topK: 64,
          maxTokens,
          seed: 7 + attempt,
        });
        const raw = typeof res === "string" ? res : res.response;
        const parsed = extractJson(raw);
        if (parsed) return parsed;
        const reason = typeof res === "string" ? "unknown" : res.stopReason;
        console.error(
          `gemma attempt ${attempt + 1}/${attempts}: no JSON (stopReason=${reason}, ` +
            `${String(raw).length} chars, tail=${JSON.stringify(String(raw).slice(-160))})`,
        );
      } finally {
        await ctx.dispose();
      }
    }
    return null;
  });
}

// Session start: ONE generation that parses the resume AND writes the opening
// question, so starting an interview is a single model call.
// S1 lesson: the model summarizes bullets unless told to copy them verbatim,
// and drops numbers/product names it paraphrases. Ask for verbatim.
export async function gemmaStart({ resumeText, jd = "" }) {
  const src = String(resumeText ?? "").replace(/<[^>]*>/g, " ").slice(0, MAX_RESUME_CHARS);
  if (!src.trim()) return null;
  const got = await generateJson(
    "You are a campus placement interviewer. From the resume and job " +
      "description below, extract the candidate profile and write the opening " +
      "interview question.\n\n" +
      "Profile keys: skills (array of short skill names), experience (array of " +
      "strings), projects (array of strings). Copy bullet points VERBATIM, " +
      "including every number, metric, and product name exactly as written. Do " +
      "not summarize.\n\n" +
      `JOB DESCRIPTION:\n${String(jd || "").slice(0, 1200) || "(none)"}\n\n` +
      `RESUME:\n${src}\n\n` +
      "Reply with ONLY a JSON object: " +
      '{"skills": [...], "experience": [...], "projects": [...], ' +
      '"firstQuestion": "one question, max 2 sentences, grounded in their strongest ' +
      'relevant project"}',
    { maxTokens: 1000 },
  );
  if (!got) return null;
  const profile = ResumeProfile.safeParse({
    skills: toArr(got.skills),
    experience: toArr(got.experience),
    projects: toArr(got.projects),
  });
  if (!profile.success) {
    console.error("gemma start output failed validation:", JSON.stringify(got).slice(0, 400));
    return null;
  }
  if (typeof got.firstQuestion !== "string" || got.firstQuestion.trim().length < 8) return null;
  return { profile: profile.data, firstQuestion: got.firstQuestion.trim() };
}

// Small models are sloppy about JSON types: a score arrives as "7" instead of
// 7, or a one-item list as a bare string. Coerce rather than discard a whole
// otherwise-good generation.
const toArr = (v) => {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  if (typeof v === "string") return v.trim() ? [v.trim()] : [];
  return [];
};

const strArr = z.preprocess(toArr, z.array(z.string()));

const scoreNum = z.preprocess((v) => {
  const n = typeof v === "string" ? Number.parseFloat(v.replace(/[^0-9.]/g, "")) : v;
  return Number.isFinite(n) ? n : undefined;
}, z.number().min(0).max(10));

const TurnResult = z.object({
  score: scoreNum,
  strengths: strArr.default([]),
  gaps: strArr.default([]),
  rewrite: z.preprocess((v) => (typeof v === "string" ? v : ""), z.string().default("")),
  nextQuestion: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().min(8),
  ),
});

// Exported for tests: this coercion is load-bearing. A real turn was silently
// discarded because the model returned "score": "7" as a string.
export const TurnResultSchema = TurnResult;

function compactProfile(profile) {
  const p = profile ?? {};
  const line = (arr) => (Array.isArray(arr) ? arr.slice(0, 6).join("; ") : "");
  return [
    p.skills?.length ? `skills: ${line(p.skills)}` : "",
    p.experience?.length ? `experience: ${line(p.experience)}` : "",
    p.projects?.length ? `projects: ${line(p.projects)}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 1800);
}

export async function gemmaTurn({ question, answer, profile, jd, turn = 0 }) {
  const got = await generateJson(
    "You are a campus placement interviewer. Evaluate the answer below and ask " +
      "the next question. Score 0-10 on STAR structure, clear personal ownership, " +
      "and measured impact. Be specific and terse.\n\n" +
      `ROLE / JOB DESCRIPTION:\n${String(jd || "").slice(0, 1200) || "(none)"}\n\n` +
      `CANDIDATE PROFILE:\n${compactProfile(profile) || "(none)"}\n\n` +
      `QUESTION: ${String(question || "").slice(0, 500)}\n` +
      `ANSWER: ${String(answer || "").slice(0, MAX_ANSWER_CHARS)}\n\n` +
      "Reply with ONLY a JSON object: " +
      '{"score": 0-10, "strengths": ["..."], "gaps": ["..."], ' +
      '"rewrite": "one tighter STAR version of the weakest part", ' +
      '"nextQuestion": "one question, max 2 sentences, grounded in the profile and different from the question above"}\n' +
      "Be terse: at most 3 items in strengths and 3 in gaps, each under 15 words, " +
      "and the rewrite under 60 words. Emit the JSON on one line and stop.",
    { maxTokens: 1000 },
  );
  if (!got) return null;
  const parsed = TurnResult.safeParse(got);
  if (!parsed.success) {
    console.error("gemma turn output failed validation:", JSON.stringify(got).slice(0, 400));
    return null;
  }
  const { score, strengths, gaps, rewrite, nextQuestion } = parsed.data;
  return { eval: { score, strengths, gaps, rewrite }, nextQuestion };
}

export async function unloadGemmaServer() {
  if (model) {
    await model.dispose();
    model = null;
    loading = null;
  }
}
