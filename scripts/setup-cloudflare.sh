#!/usr/bin/env bash
# Cria D1 + KV, gera chaves VAPID, cadastra secrets e preenche apps/api/wrangler.toml.
# Uso (na raiz do repo):  bash scripts/setup-cloudflare.sh
# Requer: Node 22+, conta Cloudflare (o script abre o login no navegador).
set -euo pipefail

cd "$(dirname "$0")/../apps/api"
TOML=wrangler.toml

echo "▶ Instalando dependências…"
npm ci

echo "▶ Login no Cloudflare (abre o navegador)…"
npx wrangler login

# ── D1 ──
if grep -q 'COLE_AQUI_O_ID_DO_D1' "$TOML"; then
  echo "▶ Criando banco D1 'warframe-db'…"
  OUT=$(npx wrangler d1 create warframe-db 2>&1 || true)
  echo "$OUT"
  D1_ID=$(echo "$OUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1 || true)
  if [ -z "$D1_ID" ]; then
    echo "✖ Não achei o database_id na saída. Se o banco já existe, rode 'npx wrangler d1 list' e cole o ID em $TOML."
    exit 1
  fi
  sed -i "s/COLE_AQUI_O_ID_DO_D1/$D1_ID/" "$TOML"
fi

# ── KV ──
if grep -q 'COLE_AQUI_O_ID_DO_KV' "$TOML"; then
  echo "▶ Criando namespace KV…"
  OUT=$(npx wrangler kv namespace create KV 2>&1 || true)
  echo "$OUT"
  KV_ID=$(echo "$OUT" | grep -oE '[0-9a-f]{32}' | head -1 || true)
  if [ -z "$KV_ID" ]; then
    echo "✖ Não achei o id do KV. Rode 'npx wrangler kv namespace list' e cole o id em $TOML."
    exit 1
  fi
  sed -i "s/COLE_AQUI_O_ID_DO_KV/$KV_ID/" "$TOML"
fi

# ── Schema ──
echo "▶ Aplicando schema.sql no D1 remoto…"
npx wrangler d1 execute warframe-db --remote --file=schema.sql

# ── VAPID ──
if grep -q 'COLE_AQUI_A_CHAVE_PUBLICA_VAPID' "$TOML"; then
  echo "▶ Gerando chaves VAPID…"
  KEYS=$(npx --yes web-push generate-vapid-keys --json)
  VAPID_PUB=$(echo "$KEYS" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).publicKey))')
  VAPID_PRIV=$(echo "$KEYS" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).privateKey))')
  sed -i "s#COLE_AQUI_A_CHAVE_PUBLICA_VAPID#$VAPID_PUB#" "$TOML"
  printf '%s' "$VAPID_PRIV" | npx wrangler secret put VAPID_PRIVATE_KEY
fi

# ── Demais secrets ──
echo "▶ Gerando JWT_SECRET aleatório…"
node -e 'console.log(require("crypto").randomBytes(48).toString("base64url"))' | tr -d '\n' | npx wrangler secret put JWT_SECRET

echo "▶ Cole a RESEND_API_KEY (https://resend.com/api-keys) e pressione Enter:"
npx wrangler secret put RESEND_API_KEY

echo "▶ Primeiro deploy do Worker…"
npx wrangler deploy

cat <<'EOF'

✔ Pronto. Falta só:
  1. Copiar a URL do Worker mostrada acima (https://warframe-api.<seu-subdominio>.workers.dev)
  2. GitHub → Settings → Secrets and variables → Actions → Variables → API_URL = essa URL
  3. GitHub → Settings → Pages → Source: GitHub Actions
  4. git add -A && git commit -m "Config Cloudflare" && git push   (o site publica sozinho)
  5. Ajustar o remetente ("from") em apps/api/src/index.ts para um domínio verificado no Resend
EOF
