import { Agent } from "@mastra/core/agent";
import { nextQuestion, scoreAnswer, parseResumeText } from "./tools.js";
import { gemmaProvisioned, gemmaStart, gemmaTurn, GEMMA_ENGINE } from "../ai/gemmaServer.js";

// Server-side Gemma when the locked GGUF is present (and not under test),
// deterministic rules otherwise. Every response says which engine ran, so the
// UI and the demo report never overstate what produced an answer.
// The Mastra agents below carry the instructions; the engine-aware entry
// points are what the API calls.
function stubModel() {
  return {
    async doGenerate() {
      return { text: "", finishReason: "stop", usage: { inputTokens: 0, outputTokens: 0 } };
    },
    async doStream() {
      throw new Error("streaming wired in B2 with wllama provider");
    },
    specification: { version: "v2" },
    provider: "prep-coach-local",
    modelId: "gemma-4-E2B-it-IQ4_XS",
  };
}

export const setterAgent = new Agent({
  id: "setter",
  name: "Question Setter",
  instructions:
    "You are a campus placement interviewer. Generate one focused question at a time grounded in the candidate resume and job description. Prefer project deep-dives, debugging stories, and system trade-offs over trivia.",
  model: stubModel(),
});

export const evaluatorAgent = new Agent({
  id: "evaluator",
  name: "Answer Evaluator",
  instructions:
    "Score answers 0-10 on STAR structure, ownership, and measured impact. Always return strengths, gaps, and a tight rewrite.",
  model: stubModel(),
});

export const plannerAgent = new Agent({
  id: "planner",
  name: "Study Planner",
  instructions:
    "Produce a 7-day placement prep plan from evaluation gaps. Daily 60-90 min blocks, specific drills, no hallucinated dates.",
  model: stubModel(),
});

// Session start = ONE model call: parse the resume and write the opening
// question together, so the interviewer opens in a single generation.
export async function runSessionStart({ resumeText = "", jd = "", role = "" } = {}) {
  if (gemmaProvisioned()) {
    try {
      const g = await gemmaStart({ resumeText, jd });
      if (g) {
        return {
          profile: { ...g.profile, target_role: String(role || "").slice(0, 120) },
          question: g.firstQuestion,
          engine: GEMMA_ENGINE,
        };
      }
    } catch (err) {
      console.error("gemma session start failed, falling back to rules:", err?.message);
    }
  }
  const profile = parseResumeText(resumeText);
  profile.target_role = String(role || "").slice(0, 120);
  return { profile, question: nextQuestion(profile, jd, 0), engine: "rules" };
}

// One turn = ONE model call: score the answer and ask the next question in the
// same generation (ARCHITECTURE hard rule).
export async function runTurn({ question = "", answer = "", profile = {}, jd = "", turn = 0 } = {}) {
  if (gemmaProvisioned()) {
    try {
      const g = await gemmaTurn({ question, answer, profile, jd, turn });
      if (g) return { eval: g.eval, nextQuestion: g.nextQuestion, engine: GEMMA_ENGINE };
    } catch (err) {
      console.error("gemma turn failed, falling back to rules:", err?.message);
    }
  }
  return {
    eval: scoreAnswer(question, answer),
    nextQuestion: nextQuestion(profile, jd, Number(turn) + 1),
    engine: "rules",
  };
}
