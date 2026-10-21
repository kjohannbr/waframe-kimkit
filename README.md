# Warframe Toolkit

Front estático no **GitHub Pages** + API no **Cloudflare Workers** (Hono, D1, KV). Arquitetura completa em [`ARQUITETURA.md`](./ARQUITETURA.md).

```
apps/web   SvelteKit (adapter-static) + Tailwind → GitHub Pages
apps/api   Worker Hono + D1 + KV + Cron → Cloudflare
.github/workflows/   deploy-web.yml · deploy-api.yml
```

> O GitHub Pages só serve arquivos estáticos. Por isso o Worker/D1/KV continuam no Cloudflare (plano gratuito) e o front fala com ele via CORS + **token Bearer** (cookies não funcionam entre `github.io` e `workers.dev`).

## Passo a passo

### 1. Criar o repositório
Crie o repo no GitHub (ex.: `warframe-toolkit`) e envie este conteúdo na branch `main`:

```bash
git remote add origin https://github.com/kjohannbr/waframe-kimkit.git
git push -u origin main
```

### 2. Cloudflare (uma vez só)
**Atalho:** `bash scripts/setup-cloudflare.sh` faz tudo abaixo (D1, KV, schema, VAPID, secrets, `wrangler.toml` e primeiro deploy). Manualmente:

```bash
cd apps/api
npx wrangler login
npx wrangler d1 create warframe-db          # copie o database_id para wrangler.toml
npx wrangler kv namespace create KV         # copie o id para wrangler.toml
npm run db:init                             # aplica schema.sql no D1 remoto
npx web-push generate-vapid-keys            # gera chave pública/privada VAPID
npx wrangler secret put JWT_SECRET          # string aleatória longa
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
```

Edite `apps/api/wrangler.toml`: `database_id`, KV `id`, `APP_URL`, `APP_ORIGIN`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`. No Resend, verifique um domínio e ajuste o `from:` em `src/index.ts`.

Faça o primeiro deploy: `npm run deploy` (anote a URL `https://warframe-api.SEU_SUBDOMINIO.workers.dev`).

### 3. GitHub
- **Settings → Pages → Source:** *GitHub Actions*.
- **Settings → Secrets and variables → Actions → Variables:** `API_URL` = URL do Worker.
- **Secrets:** `CLOUDFLARE_API_TOKEN` (template "Edit Cloudflare Workers") e `CLOUDFLARE_ACCOUNT_ID`.

A partir daí, cada `push` na `main` publica sozinho: `apps/web/**` → Pages; `apps/api/**` → Worker.
O site fica em `https://kjohannbr.github.io/waframe-kimkit/`.

## Desenvolvimento local
```bash
cd apps/api && cp ../../.dev.vars.example .dev.vars && npm run dev    # :8787
cd apps/web && cp .env.example .env && npm run dev                    # :5173
```
Em dev, defina `APP_ORIGIN=http://localhost:5173` e `APP_URL=http://localhost:5173` no `.dev.vars`.

## O que já funciona / o que falta
- ✅ Login por link mágico (token Bearer), Kanban de resets semanais, Web Push (SW + VAPID), CRUD de builds e rota de preço de Rivens na API
- 🚧 `syncCatalog` (importar warframe-items para o D1) — esqueleto
- 🚧 Builder (slots, Incarnon), motor de dano/DPS, simulador de alvo e Rivens no front

## Notas
- **Push no iOS** exige instalar o site na tela inicial (PWA).
- O base path (`/nome-do-repo`) vem do nome do repositório no CI; se usar domínio próprio na raiz, remova `BASE_PATH` do workflow.
- Os endpoints do warframestat.us e do Warframe.Market devem ser conferidos antes de produção.
