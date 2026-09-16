FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run generate && npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist/packages ./dist/packages
USER node

FROM runtime AS core
COPY --from=build /app/dist/shared ./dist/shared
COPY --from=build /app/dist/generated/core ./dist/generated/core
EXPOSE 4000
CMD ["node", "dist/shared/server.js"]

FROM runtime AS growth
COPY --from=build /app/dist/modules/growth ./dist/modules/growth
COPY --from=build /app/dist/generated/growth ./dist/generated/growth
EXPOSE 4001
CMD ["node", "dist/modules/growth/server.js"]
