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
**Atalho:** `node scripts/setup-cloudflare.mjs` faz tudo abaixo (D1, KV, schema, VAPID, secrets, `wrangler.toml` e primeiro deploy). Manualmente:

```bash
cd apps/api
npx wrangler login
npx wrangler d1 create warframe-db          # copie o database_id para wrangler.toml
npx wrangler kv namespace create KV         # copie o id para wrangler.toml
npm run db:init                             # aplica schema.sql no D1 remoto
npx web-push generate-vapid-keys            # gera chave pública/privada VAPID
npx wrangler secret put JWT_SECRET          # string aleatória longa
npx wrangler secret put ADMIN_EMAIL        # e-mail do administrador
npx wrangler secret put ADMIN_PASSWORD     # senha do administrador (nunca vai para o repositório)
npx wrangler secret put VAPID_PRIVATE_KEY
```

Edite `apps/api/wrangler.toml`: `database_id`, KV `id`, `APP_URL`, `APP_ORIGIN`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`.

Faça o primeiro deploy: `npm run deploy` (anote a URL `https://warframe-api.SEU_SUBDOMINIO.workers.dev`).

### 3. GitHub
- **Settings → Pages → Source:** *GitHub Actions*.
- (Opcional) **Variables:** `API_URL` para sobrescrever a URL da API embutida no workflow do front.
- (Opcional, deploy automático do Worker) **Secrets** `CLOUDFLARE_API_TOKEN` (template "Edit Cloudflare Workers") e `CLOUDFLARE_ACCOUNT_ID`, e a **variável** `DEPLOY_API` = `true`.

A partir daí, cada `push` na `main` publica sozinho: `apps/web/**` → Pages; `apps/api/**` → Worker.
O site fica em `https://kjohannbr.github.io/waframe-kimkit/`.

## Desenvolvimento local
```bash
cd apps/api && cp ../../.dev.vars.example .dev.vars && npm run dev    # :8787
cd apps/web && cp .env.example .env && npm run dev                    # :5173
```
Em dev, defina `APP_ORIGIN=http://localhost:5173` e `APP_URL=http://localhost:5173` no `.dev.vars`.

## O que já funciona / o que falta
- ✅ Login e cadastro com e-mail e senha (token Bearer), conta de administrador e painel `/admin`
- ✅ Builder: busca de toda a lista de Warframes e armas com autocomplete, slots de mods com imagem, capacidade e polaridade
- ✅ Kanban de resets semanais, Web Push (SW + VAPID), CRUD de builds e rota de preço de Rivens na API
- 🚧 Incarnon, motor de dano/DPS, simulador de alvo e Rivens no front

## Notas
- **Push no iOS** exige instalar o site na tela inicial (PWA).
- O base path (`/nome-do-repo`) vem do nome do repositório no CI; se usar domínio próprio na raiz, remova `BASE_PATH` do workflow.
- Os endpoints do warframestat.us e do Warframe.Market devem ser conferidos antes de produção.

## Catálogo (armas e mods)
`node scripts/build-catalog.mjs` regenera `apps/web/static/data/*.json` a partir do [WFCD/warframe-items](https://github.com/WFCD/warframe-items). O workflow do site faz isso sozinho a cada deploy e toda segunda-feira. As imagens vêm de `https://cdn.warframestat.us/img/<arquivo>`; se uma falhar, o site mostra as iniciais do nome.

## Administrador e senhas
- O admin é definido só por secrets do Cloudflare (`ADMIN_EMAIL`, `ADMIN_PASSWORD`); no primeiro login a conta é criada com perfil `admin`.
- `PBKDF2_ITER` (em `wrangler.toml`) controla o custo do hash das senhas dos usuários. Está em `10000` para caber no limite de CPU do plano grátis do Workers; no plano pago use `100000`. O valor usado fica gravado em cada hash, então dá para aumentar depois sem invalidar senhas antigas.

## Testes
```bash
cd apps/web && npm test      # busca, compatibilidade de mods e capacidade
```
