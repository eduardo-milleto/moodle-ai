FROM node:22-bookworm

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY worker/package.json worker/package.json
COPY packages/db/package.json packages/db/package.json
RUN pnpm install --frozen-lockfile
RUN pnpm --filter worker exec playwright install --with-deps chromium

COPY . .
RUN pnpm --filter worker build

CMD ["pnpm", "--filter", "worker", "start"]
