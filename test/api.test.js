import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
const { default: app } = await import("../src/server.js");

function req(method, url, body) {
  return new Promise((resolve, reject) => {
    const srv = app.listen(0, async () => {
      try {
        const r = await fetch(`http://127.0.0.1:${srv.address().port}${url}`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
        const data = await r.json().catch(() => ({}));
        srv.close(() => resolve({ status: r.status, data }));
      } catch (e) { srv.close(() => reject(e)); }
    });
  });
}

test("GET /healthz is 200", async () => {
  const r = await req("GET", "/healthz");
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
});

test("POST /api/session returns question + profile", async () => {
  const r = await req("POST", "/api/session", { resumeText: "Skills: JS\nIntern at Acme", jd: "SDE intern", role: "SDE" });
  assert.equal(r.status, 200);
  assert.ok(r.data.sessionId);
  assert.ok(r.data.question);
});

test("POST /api/turn rejects empty answer with 400", async () => {
  const r = await req("POST", "/api/turn", { question: "Q", answer: "  " });
  assert.equal(r.status, 400);
});

test("PUT /api/sessions requires consent", async () => {
  const denied = await req("PUT", "/api/sessions/s_1", { turn: 1 });
  assert.equal(denied.status, 400);
  const ok = await req("PUT", "/api/sessions/s_1", { consent: true, turn: 1 });
  assert.equal(ok.status, 200);
});
