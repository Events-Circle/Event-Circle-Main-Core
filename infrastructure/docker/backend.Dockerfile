FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@10.30.3
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --filter @events-circle/backend...
RUN pnpm generate && pnpm exec turbo run build --filter @events-circle/backend...

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4000
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages ./packages
COPY --from=build --chown=node:node /app/backend ./backend
COPY --from=build --chown=node:node /app/package.json ./package.json
USER node
WORKDIR /app/backend
EXPOSE 4000
CMD ["node", "dist/main.js"]
