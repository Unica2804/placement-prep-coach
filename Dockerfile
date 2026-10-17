# syntax=docker/dockerfile:1
#
# Placement Prep Coach — self-contained image so judges can verify locally.
#
# Both locked open-weight models are baked in, so `docker run` downloads nothing:
#   LLM  gemma-4-E2B-it-IQ4_XS.gguf        Apache-2.0  (unsloth/gemma-4-E2B-it-GGUF)
#   STT  parakeet-tdt-0.6b-v3-Q4_K_M.gguf  CC-BY-4.0   (handy-computer/parakeet-tdt-0.6b-v3-gguf)
#
# Three stages: native STT CLI -> model fetch -> slim Node runtime.
# Inference is CPU-only and needs no GPU, no API key, and no network at runtime.

ARG NODE_IMAGE=node:22-slim
ARG DEBIAN_IMAGE=debian:12-slim

# ---------- stage 1: build transcribe-cli (Parakeet STT, native) -----------
FROM ${DEBIAN_IMAGE} AS stt-builder
ARG TRANSCRIBE_CPP_TAG=v0.4.0
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential cmake git ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /build
RUN git clone --depth 1 --branch "${TRANSCRIBE_CPP_TAG}" \
      https://github.com/handy-computer/transcribe.cpp transcribe.cpp
WORKDIR /build/transcribe.cpp
# GGML_NATIVE=OFF: without it the binary is built for this build host's CPU and
# can SIGILL on a judge's older machine. Costs a little speed, buys portability.
RUN cmake -B build -DCMAKE_BUILD_TYPE=Release -DGGML_NATIVE=OFF \
 && cmake --build build --target transcribe-cli -j"$(nproc)" \
 && cp "$(find build -type f -name transcribe-cli | head -n 1)" /usr/local/bin/transcribe-cli

# ---------- stage 2: fetch the locked model weights ------------------------
FROM ${DEBIAN_IMAGE} AS models
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ARG GEMMA_GGUF_URL=https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-IQ4_XS.gguf
ARG PARAKEET_GGUF_URL=https://huggingface.co/handy-computer/parakeet-tdt-0.6b-v3-gguf/resolve/main/parakeet-tdt-0.6b-v3-Q4_K_M.gguf
RUN mkdir -p /models \
 && curl -fsSL --retry 3 -o /models/gemma-4-E2B-it-IQ4_XS.gguf "${GEMMA_GGUF_URL}" \
 && curl -fsSL --retry 3 -o /models/parakeet-Q4_K_M.gguf "${PARAKEET_GGUF_URL}" \
 && test "$(stat -c%s /models/gemma-4-E2B-it-IQ4_XS.gguf)" -gt 2900000000 \
 && test "$(stat -c%s /models/parakeet-Q4_K_M.gguf)" -gt 400000000

# ---------- stage 3: runtime ----------------------------------------------
FROM ${NODE_IMAGE}
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

# node-llama-cpp ships its native addon as platform optional deps; the ones for
# other backends and architectures are ~660 MB of dead weight here.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
 && npm cache clean --force \
 && rm -rf node_modules/@node-llama-cpp/linux-x64-cuda \
           node_modules/@node-llama-cpp/linux-x64-cuda-ext \
           node_modules/@node-llama-cpp/linux-x64-vulkan \
           node_modules/@node-llama-cpp/linux-arm64 \
           node_modules/@node-llama-cpp/linux-armv7l

# transcribe-cli needs libgomp (OpenMP) on top of the slim base image.
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
 && rm -rf /var/lib/apt/lists/*

COPY src ./src
COPY public ./public
COPY test ./test
COPY --from=stt-builder /usr/local/bin/transcribe-cli ./models/bin/transcribe-cli
COPY --from=models /models/ ./models/

# Fail the build loudly rather than shipping an image whose native pieces
# cannot actually run.
RUN test -x ./models/bin/transcribe-cli \
 && ! ldd ./models/bin/transcribe-cli | grep "not found" \
 && node -e "fs=require('fs');['models/gemma-4-E2B-it-IQ4_XS.gguf','models/parakeet-Q4_K_M.gguf'].forEach(p=>{if(!fs.existsSync(p))throw new Error('missing '+p)})"

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
