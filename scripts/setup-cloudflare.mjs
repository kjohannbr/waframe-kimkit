// Cria D1 + KV, gera chaves VAPID, cadastra secrets e preenche apps/api/wrangler.toml.
// Uso (na raiz do repo, em qualquer terminal):  node scripts/setup-cloudflare.mjs
// Requer: Node 22+ e uma conta Cloudflare (o script abre o login no navegador).
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline/promises';

const API_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'api');
const TOML = join(API_DIR, 'wrangler.toml');

// shell:true faz o npx funcionar no Windows (npx.cmd) e no Linux/macOS
function run(cmd, { input, capture = false, allowFail = false } = {}) {
  const r = spawnSync(cmd, {
    cwd: API_DIR,
    shell: true,
    input,
    encoding: 'utf8',
    stdio: [input !== undefined ? 'pipe' : 'inherit', capture ? 'pipe' : 'inherit', capture ? 'pipe' : 'inherit'],
  });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  if (capture) process.stdout.write(out);
  if (r.status !== 0 && !allowFail) {
    console.error(`\n✖ Falhou: ${cmd}`);
    process.exit(r.status ?? 1);
  }
  return out;
}

const step = (msg) => console.log(`\n▶ ${msg}`);
let toml = readFileSync(TOML, 'utf8');
const save = () => writeFileSync(TOML, toml);

step('Instalando dependências…');
run('npm ci');

step('Login no Cloudflare (abre o navegador)…');
run('npx wrangler login');

// ── D1 ──
if (toml.includes('COLE_AQUI_O_ID_DO_D1')) {
  step("Criando banco D1 'warframe-db'…");
  const out = run('npx wrangler d1 create warframe-db', { capture: true, allowFail: true });
  const id = out.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)?.[0];
  if (!id) {
    console.error("\n✖ Não achei o database_id. Se o banco já existe, rode 'npx wrangler d1 list' (em apps/api) e cole o ID em apps/api/wrangler.toml.");
    process.exit(1);
  }
  toml = toml.replace('COLE_AQUI_O_ID_DO_D1', id);
  save();
}

// ── KV ──
if (toml.includes('COLE_AQUI_O_ID_DO_KV')) {
  step('Criando namespace KV…');
  const out = run('npx wrangler kv namespace create KV', { capture: true, allowFail: true });
  const id = out.match(/\b[0-9a-f]{32}\b/)?.[0];
  if (!id) {
    console.error("\n✖ Não achei o id do KV. Rode 'npx wrangler kv namespace list' (em apps/api) e cole o id em apps/api/wrangler.toml.");
    process.exit(1);
  }
  toml = toml.replace('COLE_AQUI_O_ID_DO_KV', id);
  save();
}

step('Aplicando schema.sql no D1 remoto…');
run('npx wrangler d1 execute warframe-db --remote --file=schema.sql');

// ── VAPID (P-256, formato base64url cru, igual ao web-push) ──
if (toml.includes('COLE_AQUI_A_CHAVE_PUBLICA_VAPID')) {
  step('Gerando chaves VAPID…');
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' });
  const b64u = (s) => Buffer.from(s, 'base64url');
  const publicKey = Buffer.concat([Buffer.from([4]), b64u(jwk.x), b64u(jwk.y)]).toString('base64url');
  toml = toml.replace('COLE_AQUI_A_CHAVE_PUBLICA_VAPID', publicKey);
  save();
  run('npx wrangler secret put VAPID_PRIVATE_KEY', { input: jwk.d });
}

// ── Demais secrets ──
step('Gerando JWT_SECRET aleatório…');
run('npx wrangler secret put JWT_SECRET', { input: randomBytes(48).toString('base64url') });

step('RESEND_API_KEY (crie em https://resend.com/api-keys)');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const resend = (await rl.question('Cole a chave e pressione Enter: ')).trim();
rl.close();
if (!resend) {
  console.error('✖ Chave vazia. Rode o script de novo quando tiver a chave.');
  process.exit(1);
}
run('npx wrangler secret put RESEND_API_KEY', { input: resend });

step('Primeiro deploy do Worker…');
run('npx wrangler deploy');

console.log(`
✔ Pronto. Falta só:
  1. Copiar a URL do Worker mostrada acima (https://warframe-api.<seu-subdominio>.workers.dev)
  2. GitHub → Settings → Secrets and variables → Actions → Variables → API_URL = essa URL
  3. GitHub → Settings → Pages → Source: GitHub Actions
  4. git add -A && git commit -m "Config Cloudflare" && git push   (o site publica sozinho)
  5. Trocar o remetente ("from") em apps/api/src/index.ts por um domínio verificado no Resend
`);
