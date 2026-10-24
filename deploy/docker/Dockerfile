FROM node:22-bookworm-slim AS build
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build:node

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app/web
COPY --from=build /app/web/.next/standalone ./
COPY --from=build /app/web/.next/static ./.next/static
COPY --from=build /app/web/public ./public
VOLUME ["/app/web/data"]
EXPOSE 3000
CMD ["node", "server.js"]
