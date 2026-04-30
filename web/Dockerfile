FROM node:22-bookworm

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY web/package.json web/package.json
COPY packages/db/package.json packages/db/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter web build

EXPOSE 3000
CMD ["sh", "-c", "pnpm --filter @moodle-ai/db migrate && pnpm --filter web start"]

