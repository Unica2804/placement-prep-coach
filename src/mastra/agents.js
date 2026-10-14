import { Agent } from "@mastra/core/agent";
import { nextQuestion, scoreAnswer, parseResumeText } from "./tools.js";

// Model calls are routed to on-device Gemma (wllama) in B2.
// Until then these agents expose instructions + deterministic fallbacks
// so the API, UI, and tests run without weights downloaded.
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

export function runSetter(profile, jd, turn) {
  return nextQuestion(profile, jd, turn);
}

export function runEvaluator(question, answer) {
  return scoreAnswer(question, answer);
}

export function runResumeParse(text) {
  return parseResumeText(text);
}
