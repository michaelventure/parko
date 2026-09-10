FROM node:20-alpine AS build
WORKDIR /app
# El motor de Prisma necesita OpenSSL; node:20-alpine no lo trae por
# defecto (es una imagen minima sin muchas libs del sistema).
RUN apk add --no-cache openssl
# `prisma generate` corre en build time y solo valida que DATABASE_URL
# EXISTA (no se conecta a la base real) — Render solo inyecta las env vars
# reales en runtime, asi que aqui basta un valor de relleno.
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
COPY package*.json ./
COPY prisma ./prisma
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
COPY package*.json ./
COPY prisma ./prisma
RUN npm install --omit=dev && npx prisma generate
COPY --from=build /app/dist ./dist
COPY docs ./docs
COPY public ./public
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
