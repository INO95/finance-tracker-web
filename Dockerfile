FROM node:20-bookworm-slim AS deps

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-bookworm-slim

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src/ ./src/
COPY public/ ./public/
COPY config/ ./config/
COPY data/schema.sql ./data/schema.sql

RUN mkdir -p data

ENV NODE_ENV=production
ENV FINANCE_WEB_HOST=0.0.0.0
ENV FINANCE_WEB_PORT=4380

EXPOSE 4380

CMD ["node", "src/server.js"]
