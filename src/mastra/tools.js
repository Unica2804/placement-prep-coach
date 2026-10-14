import { z } from "zod";

export const ResumeProfile = z.object({
  skills: z.array(z.string()).default([]),
  experience: z.array(z.string()).default([]),
  projects: z.array(z.string()).default([]),
  target_role: z.string().default(""),
});

export const QuestionSet = z.object({
  questions: z.array(z.string()).min(1).max(8),
});

export const AnswerScore = z.object({
  score: z.number().min(0).max(10),
  strengths: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  rewrite: z.string().default(""),
});

export function parseResumeText(text) {
  const clean = String(text ?? "").replace(/<[^>]*>/g, " ").slice(0, 50000);
  const lines = clean.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const skills = [];
  const experience = [];
  const projects = [];
  for (const line of lines) {
    if (/skill|stack|tech/i.test(line)) skills.push(line.slice(0, 200));
    else if (/intern|experience|work|sde|engineer/i.test(line)) experience.push(line.slice(0, 200));
    else if (/project|built|developed/i.test(line)) projects.push(line.slice(0, 200));
  }
  return ResumeProfile.parse({
    skills: skills.slice(0, 20),
    experience: experience.slice(0, 20),
    projects: projects.slice(0, 20),
  });
}

export function nextQuestion(profile, jd, turn) {
  const role = jd?.slice(0, 60) || profile.target_role || "software engineer";
  const bank = [
    `Walk me through your strongest project relevant to this ${role} role. What was your personal contribution?`,
    `What is the hardest bug you fixed in the last 6 months? How did you isolate it?`,
    `Explain a system you designed end-to-end. What trade-offs did you make?`,
    `Given this job description, which of your skills is weakest and how are you closing the gap?`,
    `Describe a time you disagreed with a teammate. How did you resolve it?`,
  ];
  return bank[turn % bank.length];
}

export function scoreAnswer(question, answer) {
  const a = String(answer ?? "").trim();
  if (!a) return { score: 0, strengths: [], gaps: ["empty answer"], rewrite: "Provide a STAR-structured answer: Situation, Task, Action, Result." };
  let score = 4;
  const strengths = [];
  const gaps = [];
  if (a.length > 200) { score += 1; strengths.push("good depth"); } else gaps.push("too short — add specifics");
  if (/because|therefore|result|impact|metric|%/.test(a)) { score += 1; strengths.push("shows reasoning/impact"); } else gaps.push("missing impact or metrics");
  if (/I (built|fixed|designed|led|shipped)/.test(a)) { score += 1; strengths.push("clear ownership"); } else gaps.push("unclear personal contribution");
  if (a.length > 800) { score -= 1; gaps.push("too long — tighten to 60-90 seconds spoken"); }
  score = Math.max(0, Math.min(10, score));
  return {
    score,
    strengths,
    gaps,
    rewrite: `STAR rewrite prompt for: "${question.slice(0, 80)}..." — open with context (2 lines), state YOUR action (3 lines), close with measured result.`,
  };
}
