FROM oven/bun:1.3.14 AS dev

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
EXPOSE 3000
CMD ["bun", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

FROM dev AS build
ARG VITE_API_MODE=api
ARG VITE_API_URL=
ARG VITE_AUTH_REQUIRED=true
ENV VITE_API_MODE=$VITE_API_MODE
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_AUTH_REQUIRED=$VITE_AUTH_REQUIRED
RUN bun run build

FROM node:22.23.1-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
