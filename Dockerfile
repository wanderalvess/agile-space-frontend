# --- Dependencies stage ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Build stage ---
FROM node:20-alpine AS builder
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

# --- Runtime stage ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=9002
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
USER nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static

EXPOSE 9002
CMD ["node", "server.js"]
