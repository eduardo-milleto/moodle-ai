# Moodle AI

Dashboard pessoal para tarefas do Moodle Unisinos com Next.js, Postgres, worker Playwright/ICS e notificações Telegram.

## Arquitetura

- `web`: Next.js App Router com dashboard protegido por senha.
- `worker`: cron em Node.js que sincroniza Moodle via Playwright, usa `.ics` como fallback e envia Telegram.
- `packages/db`: Drizzle schema, migrations e repositório compartilhado.
- `db`: Postgres em Docker Compose.
- `caddy`: proxy/TLS automático quando um domínio estiver apontado para a VPS.

## Segredos

Os segredos reais ficam fora do repo em:

```bash
/Users/eduardomilleto/Documents/env/.env
```

Prepare a permissão:

```bash
scripts/prepare-local-env.sh
```

Para rodar local, copie o exemplo para o repo e preencha valores de desenvolvimento:

```bash
cp .env.example .env
chmod 600 .env
```

Variáveis principais:

- `DATABASE_URL`
- `DASHBOARD_PASSWORD`
- `SESSION_SECRET`
- `MOODLE_BASE_URL`
- `MOODLE_USERNAME`
- `MOODLE_PASSWORD`
- `MOODLE_ICS_URL`
- `AGENT_ENABLED`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

O token Hostinger local existente pode continuar como `hostinger_api_nexor` em `/Users/eduardomilleto/Documents/env/.env`.

## Desenvolvimento local

```bash
pnpm install
pnpm typecheck
pnpm lint
docker compose up -d db
DATABASE_URL=postgres://moodle:moodle@localhost:5432/moodle_ai pnpm db:migrate
DATABASE_URL=postgres://moodle:moodle@localhost:5432/moodle_ai pnpm dev
```

Worker manual:

```bash
DATABASE_URL=postgres://moodle:moodle@localhost:5432/moodle_ai pnpm sync:once
```

Stack completa:

```bash
docker compose up -d --build
```

## Telegram

Crie um bot no BotFather, envie uma mensagem para o bot e configure:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
NOTIFY_DUE_HOURS=48
```

Se essas variáveis ficarem vazias, o worker sincroniza sem enviar alertas.

## Deploy na VPS

1. Comprar VPS Ubuntu 24.04 na Hostinger.
2. Liberar acesso SSH por chave.
3. Rodar:

```bash
scripts/deploy-vps.sh root@SERVER_IP
```

Na primeira execução, o script cria `/opt/moodle-ai/.env` a partir do exemplo e para. Edite o arquivo na VPS:

```bash
ssh root@SERVER_IP
nano /opt/moodle-ai/.env
chmod 600 /opt/moodle-ai/.env
cd /opt/moodle-ai
docker compose up -d --build
```

Sem domínio, acesse por túnel SSH:

```bash
ssh -L 3000:localhost:3000 root@SERVER_IP
```

Depois abra `http://localhost:3000` no Mac.

## Domínio e TLS

Quando o DNS estiver apontando para a VPS, preencha:

```env
APP_DOMAIN=seu-dominio.com
ACME_EMAIL=seu-email@dominio.com
```

Então suba Caddy:

```bash
docker compose --profile caddy up -d --build
```

