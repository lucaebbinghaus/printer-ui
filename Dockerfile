# 1) Dependencies + Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


# 2) Runtime (kleineres Image)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# nur das Nötige ins Runtime-Image
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.* ./ 2>/dev/null || true

EXPOSE 3000
CMD ["npm","run","start"]
