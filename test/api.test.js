import test, { before, after } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
const { default: app } = await import("../src/server.js");

let base = "";
let srv = null;
before(() => new Promise((resolve) => {
  srv = app.listen(0, () => {
    base = `http://127.0.0.1:${srv.address().port}`;
    resolve();
  });
}));
after(() => new Promise((resolve) => srv.close(() => resolve())));

async function call(method, url, body) {
  const r = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

test("GET /healthz is 200", async () => {
  const r = await call("GET", "/healthz");
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
});

test("POST /api/session returns question + profile", async () => {
  const r = await call("POST", "/api/session", { resumeText: "Skills: JS\nIntern at Acme", jd: "SDE intern", role: "SDE" });
  assert.equal(r.status, 200);
  assert.ok(r.data.sessionId);
  assert.ok(r.data.question);
});

test("POST /api/turn rejects empty answer with 400", async () => {
  const r = await call("POST", "/api/turn", { question: "Q", answer: "  " });
  assert.equal(r.status, 400);
});

test("PUT /api/sessions requires consent", async () => {
  const denied = await call("PUT", "/api/sessions/s_1", { turn: 1 });
  assert.equal(denied.status, 400);
  const ok = await call("PUT", "/api/sessions/s_1", { consent: true, turn: 1 });
  assert.equal(ok.status, 200);
});
