# ──────────────────────────────────────────────
# Data Explorer – Client Dockerfile (multi-stage)
# ──────────────────────────────────────────────

# ── Stage 1: Build ───────────────────────────
# Base image pinned by digest for supply-chain reproducibility.
# Update deliberately: docker buildx imagetools inspect node:22-alpine
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS build

WORKDIR /app

# Add build argument for API URL
ARG VITE_API_URL=http://localhost:3001/api
ENV VITE_API_URL=$VITE_API_URL

# Copy package files first for better cache
COPY package*.json ./
COPY vendor ./vendor

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# ── Stage 2: Serve with Nginx ───────────────
# Base image pinned by digest for supply-chain reproducibility.
# Update deliberately: docker buildx imagetools inspect nginx:1.27-alpine
FROM nginx:1.27-alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10

# Upgrade OS packages to pick up security patches
RUN apk upgrade --no-cache
# Install wget for healthcheck
RUN apk add --no-cache wget

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets to nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Run as non-root user
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
