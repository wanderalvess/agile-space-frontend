# Base Debian (glibc), NÃO Alpine (musl): o onnxruntime-node (embedding local da Base de
# Conhecimento, via @huggingface/transformers) só traz binários nativos glibc — no Alpine
# dá "Error loading shared library libonnxruntime.so.1" e /api/knowledge/embed devolve 500.
# --- Dependencies stage ---
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Build stage ---
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p ./public

# Vars NEXT_PUBLIC_* usadas em componentes client-side são inlined no bundle JS durante
# o build (webpack/Turbopack) — setá-las só em runtime (docker-compose "environment:")
# não tem efeito nenhum no bundle já gerado. Por isso chegam aqui como build ARG, não ENV
# direto no compose.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SPRING_API_URL
ARG NEXT_PUBLIC_GEMINI_API_KEY
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SPRING_API_URL=$NEXT_PUBLIC_SPRING_API_URL
ENV NEXT_PUBLIC_GEMINI_API_KEY=$NEXT_PUBLIC_GEMINI_API_KEY
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID

RUN npm run build

# --- Modelo de embedding (opcional) ---
# Pré-baixa o modelo do Hugging Face (~470MB, fp32) para a imagem não depender de internet
# no runtime. Desligado por padrão (PRELOAD_EMBEDDING_MODEL=0) porque engorda a imagem e o
# push/pull; ligue com: --build-arg PRELOAD_EMBEDDING_MODEL=1. Se o download falhar, o build
# NÃO falha: o modelo é baixado na primeira chamada de /api/knowledge/embed (precisa de internet).
FROM deps AS model
ARG PRELOAD_EMBEDDING_MODEL=0
COPY scripts/preload-embedding-model.mjs ./scripts/preload-embedding-model.mjs
RUN mkdir -p /model-cache &&     if [ "$PRELOAD_EMBEDDING_MODEL" = "1" ]; then       EMBEDDING_CACHE_DIR=/model-cache node scripts/preload-embedding-model.mjs         || echo "AVISO: pré-download do modelo de embedding falhou; ele será baixado em runtime.";     fi

# --- Runtime stage ---
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=9002
ENV HOSTNAME=0.0.0.0

# wget: o healthcheck do docker-compose usa "wget --spider" (node:slim não traz wget).
# ca-certificates: HTTPS para baixar o modelo do Hugging Face e falar com o backend.
RUN apt-get update     && apt-get install -y --no-install-recommends wget ca-certificates     && rm -rf /var/lib/apt/lists/*     && groupadd --system nextjs && useradd --system --gid nextjs --create-home nextjs

# Cache do modelo de embedding (src/lib/embeddings.ts lê EMBEDDING_CACHE_DIR). Precisa ser
# gravável pelo usuário não-root; se o modelo foi pré-baixado, vem preenchido do estágio "model".
ENV EMBEDDING_CACHE_DIR=/app/.cache/transformers-cache
RUN mkdir -p /app/.cache && chown -R nextjs:nextjs /app/.cache
COPY --from=model --chown=nextjs:nextjs /model-cache /app/.cache/transformers-cache
USER nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static

EXPOSE 9002
CMD ["node", "server.js"]
