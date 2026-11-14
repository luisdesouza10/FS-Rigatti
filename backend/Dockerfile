# ---- build ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci -w backend --include-workspace-root=false --no-audit --no-fund
COPY backend/tsconfig.json backend/tsconfig.build.json backend/
COPY backend/src backend/src
COPY backend/scripts backend/scripts
RUN npm run build -w backend

# ---- runtime ----
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci -w backend --include-workspace-root=false --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/backend/dist backend/dist
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
WORKDIR /app/backend
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://localhost:4000/api/health || exit 1
CMD ["node", "dist/src/server.js"]
