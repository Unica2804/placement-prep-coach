// S1 spike FINAL: Gemma-4-E2B IQ4_XS resume-parse matrix via node-llama-cpp.
// Recipe (empirically determined, see BACKLOG S1 note):
//   Gemma chat template + temp 0.5/topP 0.95/topK 64 + fixed seed,
//   unconstrained generation, parse-then-validate with 1 retry.
// Grammar-constrained decoding collapses to degenerate placeholders on this
// quant at temp<=0.8 and is unstable at 1.0 — so grammar is NOT used.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getLlama, LlamaCompletion } from "node-llama-cpp";

const GGUF = "/tmp/gemma-4-E2B-IQ4_XS.gguf";
const FIXDIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

const EXPECTED = {
  skills: ["python", "javascript", "typescript", "react", "node", "postgres", "docker"],
  exp: ["acme", "redis", "rate limiter", "320ms", "dashboard"],
  proj: ["campusmess", "400", "tinydiffusion", "unet", "pytorch"],
};

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const normFlat = (got) => norm(JSON.stringify(got));

async function extract(model, text) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const fxCtx = await model.createContext({ contextSize: 8192 });
    const c = new LlamaCompletion({ contextSequence: fxCtx.getSequence() });
    const prompt =
      "<start_of_turn>user\nExtract the candidate profile as JSON with keys " +
      "skills (array), experience (array of strings), projects (array of strings). " +
      "Reply with ONLY the JSON object, no markdown fences.\n\nResume:\n" +
      text + "\n<end_of_turn>\n<start_of_turn>model\n";
    const start = Date.now();
    const raw = await c.generateCompletion(prompt, {
      temperature: 0.5, topP: 0.95, topK: 64, maxTokens: 1024, seed: 7 + attempt,
    });
    const secs = (Date.now() - start) / 1000;
    await fxCtx.dispose();
    const m = String(raw).replace(/```json|```/g, "").match(/\{[\s\S]*\}/);
    if (m) {
      try { return { got: JSON.parse(m[0]), secs }; } catch { /* retry */ }
    }
  }
  return { got: { skills: [], experience: [], projects: [] }, secs: -1 };
}

const llama = await getLlama();
console.log("loading model...");
const t0 = Date.now();
const model = await llama.loadModel({ modelPath: GGUF });
console.log(`model loaded in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

for (const f of ["resume-clean.txt", "resume-pdf-noise.txt", "resume-ocr-noise.txt"]) {
  const text = fs.readFileSync(path.join(FIXDIR, f), "utf8").split("GROUND TRUTH")[0].trim();
  const { got, secs } = await extract(model, text);
  const flat = normFlat(got);
  const rec = (keys) => keys.filter((k) => flat.includes(norm(k)));
  const rs = rec(EXPECTED.skills), re = rec(EXPECTED.exp), rp = rec(EXPECTED.proj);
  const total = rs.length + re.length + rp.length;
  console.log(`\n=== ${f} (${secs.toFixed(1)}s) recall ${total}/17 ===`);
  console.log(`skills ${rs.length}/7: ${rs.join(",") || "NONE"}`);
  console.log(`exp    ${re.length}/5: ${re.join(",") || "NONE"}`);
  console.log(`proj   ${rp.length}/5: ${rp.join(",") || "NONE"}`);
}
await model.dispose();
process.exit(0);
