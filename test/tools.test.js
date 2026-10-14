import test from "node:test";
import assert from "node:assert/strict";
import { parseResumeText, scoreAnswer, nextQuestion } from "../src/mastra/tools.js";

test("parseResumeText strips HTML (XSS) and caps fields", () => {
  const p = parseResumeText("<script>alert(1)</script>\nSkills: Python\nIntern at XYZ\nBuilt a project");
  assert.ok(!JSON.stringify(p).includes("<script>"));
  assert.ok(p.skills.length <= 20);
});

test("parseResumeText handles empty input", () => {
  const p = parseResumeText("");
  assert.deepEqual(p.skills, []);
});

test("parseResumeText truncates 50k-char resumes", () => {
  const p = parseResumeText("Skills: x\n".repeat(20000));
  assert.ok(JSON.stringify(p).length < 60000);
});

test("scoreAnswer rejects empty, rewards STAR+ownership", () => {
  const e0 = scoreAnswer("Q?", "   ");
  assert.equal(e0.score, 0);
  const good = scoreAnswer("Q?", "I built a cache because p99 was 800ms therefore I added Redis and cut it 40%. Result: error rate fell.");
  assert.ok(good.score >= 6, JSON.stringify(good));
  assert.ok(good.strengths.length > 0);
});

test("scoreAnswer penalizes overlong answers", () => {
  const long = scoreAnswer("Q?", "I built stuff. ".repeat(200));
  assert.ok(long.gaps.some((g) => /too long/i.test(g)));
});

test("nextQuestion rotates and grounds in role", () => {
  const q0 = nextQuestion({ target_role: "" }, "SDE intern", 0);
  const q1 = nextQuestion({ target_role: "" }, "SDE intern", 1);
  assert.notEqual(q0, q1);
  assert.ok(q0.length > 20);
});
