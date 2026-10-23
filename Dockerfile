# ==============================================================================
# Production Dockerfile for Render, Railway, Fly.io & Cloud Deployments
# Packages full Node.js 20 runtime with all 6 native compilers/interpreters:
# Python 3, Node.js, GCC (C), G++ (C++), OpenJDK 17 (Java), Mono (C#)
# ==============================================================================
FROM node:20-bookworm-slim

# Prevent interactive debconf prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install native compilers and runtimes for all 6 languages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    python3 \
    openjdk-17-jdk-headless \
    mono-mcs \
    mono-runtime \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cache package dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy codebase
COPY . .

# Default production runtime settings
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV RUNNER_PREFERENCE=local,remote

EXPOSE 3000

# Start server
CMD ["node", "server.js"]
