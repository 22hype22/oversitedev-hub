# Oversite dashboard (frontend) — build the Vite SPA and serve it statically.
# Used to host the frontend on Railway. The domain stays registered on Lovable
# and points its DNS at this Railway service. The worker has its own Dockerfile
# under /worker; this file is only for the dashboard frontend.

FROM node:20-alpine AS build
WORKDIR /app

# VITE_* values are compiled into the bundle at BUILD time. On Railway, set them
# as service variables; Railway passes matching ARGs into the Docker build.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ARG VITE_PAYMENTS_CLIENT_TOKEN
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID \
    VITE_PAYMENTS_CLIENT_TOKEN=$VITE_PAYMENTS_CLIENT_TOKEN

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
# serve-handler is the static engine behind `serve`; server.mjs wraps it so
# plain-http visitors are sent to https and every response carries HSTS.
RUN npm install --no-audit --no-fund serve-handler@6
COPY --from=build /app/dist ./dist
COPY server.mjs ./server.mjs
# Railway injects $PORT; server.mjs serves the SPA with history-API fallback.
CMD ["node", "server.mjs"]
