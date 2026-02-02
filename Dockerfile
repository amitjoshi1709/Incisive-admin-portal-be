# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma/
RUN npx prisma generate

COPY tsconfig.json ./
COPY nest-cli.json ./
COPY src ./src/

RUN npm run build
RUN ls -la dist/ && ls -la dist/main.js

# Production stage
FROM node:20-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --only=production

COPY prisma ./prisma/
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 nestjs
USER nestjs

EXPOSE 3000

CMD ["sh", "-c", "node dist/prisma/run-migrations.js && node dist/main.js"]
