# Multi-stage build for Next.js 15 Dashboard
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3001

CMD ["npm", "start"]
