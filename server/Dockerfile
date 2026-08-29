# ──────────────────────────────────────────────
# Data Explorer – Server Dockerfile (multi-stage)
# ──────────────────────────────────────────────

# ── Stage 1: Build ───────────────────────────
# Base image pinned by digest for supply-chain reproducibility.
# Update deliberately: docker buildx imagetools inspect node:22-alpine
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS build

# Install openssl for Prisma + native deps
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files first for better cache
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client and build NestJS
RUN npm run build

# Prune devDependencies – only production deps remain
RUN npm prune --omit=dev

# ── Stage 2: Runtime ─────────────────────────
# Base image pinned by digest for supply-chain reproducibility.
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS runtime

# Install openssl for Prisma + wget for healthcheck
RUN apk add --no-cache openssl wget

WORKDIR /app

# Run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

ENV NODE_ENV=production
ENV PORT=3001

# Copy built assets from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/prisma ./prisma

# Copy entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Change ownership to non-root user
RUN chown -R appuser:appgroup /app

USER appuser

# Expose backend port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start the application via entrypoint
ENTRYPOINT ["/app/docker-entrypoint.sh"]
