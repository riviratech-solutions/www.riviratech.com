# syntax=docker/dockerfile:1
#
# riviratech Innovations — website + admin panel (React 19 + Vite 7).
#
# Two stages: build the static bundle with Node, then serve it with nginx.
# The VITE_* values are compiled INTO the bundle at build time, so they are
# passed as --build-arg (not runtime env). Rebuild to change them.
#
# Build:
#   docker build -t riviratech-web \
#     --build-arg VITE_SERVER_URL=https://api.riviratechinnovations.com/ \
#     --build-arg VITE_SITE_URL=https://www.riviratechinnovations.com/ \
#     --build-arg VITE_CHATBOT_URL=https://chat.riviratechinnovations.com/ \
#     --build-arg VITE_TURNSTILE_SITE_KEY=xxxx .
# Run:
#   docker run -p 8080:80 riviratech-web

# ---- Stage 1: build ---------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# These map to import.meta.env.VITE_* and are baked into the compiled JS.
# Defaults are same-origin ("/") so a bare build still works behind a proxy.
ARG VITE_SERVER_URL=/
ARG VITE_SITE_URL=/
ARG VITE_CHATBOT_URL=/
ARG VITE_TURNSTILE_SITE_KEY=
ENV VITE_SERVER_URL=$VITE_SERVER_URL \
    VITE_SITE_URL=$VITE_SITE_URL \
    VITE_CHATBOT_URL=$VITE_CHATBOT_URL \
    VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY

# Install deps against the lockfile first for cacheable layers. `npm ci` needs
# devDependencies (vite, tsc) so do NOT pass --omit=dev here.
COPY package.json package-lock.json ./
RUN npm ci

# Build (tsc -b && vite build -> dist/)
COPY . .
RUN npm run build

# ---- Stage 2: serve ---------------------------------------------------------
FROM nginx:1.27-alpine AS serve

# SPA config: client-side routing falls back to index.html (our catch-all
# route renders CustomPage / NotFound). Also gzip + long-cache for hashed assets.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=4s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
