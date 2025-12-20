FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
RUN apt-get update -y && apt-get install -y openssl
COPY . /usr/src/app
WORKDIR /usr/src/app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install
RUN pnpm --filter=@cueplay/api exec prisma generate
RUN pnpm --filter=@cueplay/api... build
RUN pnpm deploy --filter=@cueplay/api /prod/api

FROM base AS runtime
COPY --from=build /prod/api /prod/api
WORKDIR /prod/api

# Install production dependencies for prisma
RUN apt-get update -y && apt-get install -y openssl

ENV NODE_ENV=production
ENV DATABASE_URL="file:./data/dev.db"
ENV ADMIN_PASSWORD="admin"

EXPOSE 3000

# Ensure data directory exists for SQLite
RUN mkdir -p data

# Run prisma migration, generate client, and then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma generate && npm start"]
