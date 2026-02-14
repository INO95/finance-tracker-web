FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY src/ ./src/
COPY public/ ./public/
COPY config/ ./config/
COPY data/schema.sql ./data/schema.sql

RUN mkdir -p data

ENV FINANCE_WEB_HOST=0.0.0.0
ENV FINANCE_WEB_PORT=4380

EXPOSE 4380

CMD ["node", "src/server.js"]
