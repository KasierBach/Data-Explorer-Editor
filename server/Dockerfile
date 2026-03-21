# Stage 1: Build
FROM node:20-alpine AS build

# Install openssl for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Generate Prisma client and build NestJS
RUN npx prisma generate
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine AS runtime

RUN apk add --no-cache openssl

WORKDIR /app

# Copy built assets and dependencies from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/prisma ./prisma

# Expose backend port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start:prod"]
