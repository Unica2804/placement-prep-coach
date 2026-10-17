import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Single source of truth for the server STT binary + model location.
// Local dev and Render both keep them under <repo>/models (gitignored);
// env vars win so render.yaml can point wherever the build put them.
export const TRANSCRIBE_BIN = path.resolve(
  root,
  process.env.TRANSCRIBE_BIN || "models/bin/transcribe-cli",
);
export const PARAKEET_MODEL = path.resolve(
  root,
  process.env.PARAKEET_MODEL || "models/parakeet-Q4_K_M.gguf",
);
export const MODEL_DIR = path.join(root, "models");
