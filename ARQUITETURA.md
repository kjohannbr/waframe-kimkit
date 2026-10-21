# Warframe Toolkit — Plano de Arquitetura

## 1. Visão geral

```
                ┌────────────────────────────┐
 Navegador ───▶ │ Cloudflare Pages (SvelteKit │  estático + Tailwind + Lucide
 (PWA + SW)     │  ou Next.js export)         │
                └──────────────┬─────────────┘
                               │ /api/*  (mesmo domínio via Pages Functions / route)
                ┌──────────────▼─────────────┐
                │ Worker (Hono.js)            │──▶ Resend (magic link)
                │  auth · builds · catálogo   │──▶ warframestat.us / warframe-items
                │  rivens · tasks · push      │──▶ api.warframe.market
                └───┬──────────┬─────────────┘
                    │          │
               ┌────▼───┐  ┌───▼────┐
               │  D1    │  │  KV    │  sessões, magic links, cache de preço, hash de catálogo
               └────────┘  └────────┘
        Cron Triggers: reset semanal (seg 00:00 UTC) · sync/checagem a cada 6h
```

**Decisão de stack:** SvelteKit (adapter-static) tende a gerar bundle menor e reatividade simples para o builder (muitos slots recalculando em tempo real). Next.js também serve; o backend independe disso. Mantenha o motor de cálculo num pacote TypeScript puro (`/packages/calc`) usado tanto no front (tempo real) quanto no Worker (validação/preço de Riven).

## 2. Estrutura do repositório

```
/apps/web        → frontend (Pages)
/apps/api        → Worker Hono (src/index.ts, routes/, services/)
/packages/calc   → motor de dano/DPS/Riven (puro, testável com Vitest)
/packages/types  → tipos compartilhados (Build, Mod, Item, Riven)
/migrations      → SQL do D1
```

## 3. Módulos

### 3.1 Auth passwordless
1. `POST /auth/request` → token aleatório, guarda **hash** no KV (TTL 15 min, uso único), envia e-mail via Resend.
2. `POST /auth/verify` → consome token, cria/acha usuário, cria `sess:{sid}` no KV (TTL 30 d), emite JWT em cookie `HttpOnly; Secure; SameSite=Lax`.
3. Logout/revogação = apagar `sess:{sid}`. Rate limit por e-mail e por IP (KV ou Cloudflare Rate Limiting).

### 3.2 Sincronização de dados
- Cron a cada 6h: baixa `warframe-items` (por versão/hash — se igual ao do KV, pula), faz upsert em lotes (`db.batch`, ≤100 statements).
- Normalização: guardar campos consultáveis em colunas (`type`, `compat_name`, `polarity`, `is_exilus`) e o restante em `data_json`.
- Incarnon: perks por tier 2–5 em `incarnon_perks` como **modificadores estruturados** (`stat`, `op`, `value`), pois a API raramente os entrega prontos. Provavelmente exigirá curadoria manual de um JSON no repo.
- Rivens: disposição por arma em `riven_dispositions` (atualiza a cada rebalanceamento).

### 3.3 Builder
- **Estado da build** (`config_json`): `{ slots: [{mod, rank, polarity}×8], exilus, aura|stance, forma[], reactor, arcanes[], shards[], incarnon:{2,3,4,5}, riven }`.
- **Capacidade:** drain por rank; polaridade igual = −50% (arredondado), diferente = +25%, sem polaridade = base; Forma troca a polaridade do slot; Reator/Catalisador dobra a capacidade.
- **Filtro de mods:** `compat_name` ∈ categoria da arma, `is_exilus` para o slot exilus, bloqueio de mods duplicados/da mesma família (ex.: Primed vs. normal), tipo do slot.

### 3.4 Motor de cálculo (`packages/calc`) — ordem de operações
1. **Stats base** da arma → aplicar **perks Incarnon** (alteram base antes dos mods).
2. **Somar bônus aditivos** dos mods por stat (dano base, crit chance, status, cadência, multishot, etc.).
3. **Elementos:** elementais básicos na ordem em que os mods são colocados; combinação em pares (Heat+Cold→Blast, etc.); dano físico base (IPS) com bônus separado.
4. **Crit:** `mult_médio = 1 + CC·(CM−1)` (tratar crit tiers acima de 100% se quiser fidelidade).
5. **DPS sustentado:** inclui recarga e tamanho do carregador; **DPS de rajada:** só tempo de disparo.
6. Saída: dano total, DPS (sustentado/rajada), CC, CM, SC, distribuição de elementos.

> Mantenha todas as constantes (multiplicadores de facção/armadura, valores de proc) em um arquivo de configuração versionado, e escreva testes contra builds de referência conferidas no jogo/wiki.

### 3.5 Simulador de DPS real (alvo)
- Entradas: facção, nível, vida, % armadura (e tipo de vida/armadura base).
- **Redução de armadura:** `DR = A / (A + 300)`; armadura efetiva reduzida por Corrosivo/Calor.
- **Simulação por passo de tempo** (ex.: 100 ms): a cada disparo, sortear/esperar procs conforme chance de status (usar valor esperado + modo Monte Carlo opcional).
  - **Viral:** aumenta dano contra vida por acúmulo (cap em 10 stacks).
  - **Corrosivo:** remove armadura por acúmulo (cap).
  - **Slash:** DoT que ignora armadura.
  - **Calor:** DoT + redução temporária de armadura.
- Saída: curva dano × tempo, **DPS efetivo**, tempo para matar.
- Rodar no cliente (Web Worker) para não travar a UI.

### 3.6 Rivens
- **Valor do atributo:** `base_stat × disposição × multiplicador(nº de atributos/negativo) × fator de rank`, com faixa de rolagem ±10%. Os valores-base por atributo ficam em tabela de config.
- **God Roll Predictor:** pontuar cada atributo pelo ganho marginal de DPS na build-padrão da arma (calcular DPS com e sem o atributo) → ranquear combinações de 2–3 positivos (+1 negativo opcional), com bônus pelo negativo "inofensivo".
- **Preço:** `POST /rivens/price` consulta leilões do Warframe.Market (filtro por arma + atributos), calcula min/mediana/máx dos *buyouts* de vendedores online, cache de 10 min no KV. Confirme a versão atual da API antes de produção e respeite rate limit.

### 3.7 Dashboard de resets (Kanban)
- Reset semanal = **segunda 00:00 UTC** (domingo 21:00 em Brasília). O "reset automático" é implícito: cada tarefa é gravada com `period_id`; ao virar o período, o `LEFT JOIN` retorna tudo como `todo` (sem job de limpeza).
- Colunas: A fazer / Em progresso / Concluído, com drag-and-drop (otimista no cliente, `PUT /tasks/:key`).
- Templates de tarefa em `task_templates`, adicionando novas sem deploy de front.

### 3.8 Web Push
- VAPID gerado uma vez (`web-push generate-vapid-keys`); pública no front, privada em secret.
- Biblioteca compatível com Workers (`@block65/webcrypto-web-push`), pois o `web-push` do Node depende de APIs ausentes no runtime.
- Cron semanal dispara `weekly_reset`; cron de 6h compara fingerprint dos modificadores (tabela `notification_log`, `UNIQUE`) e só notifica quando mudou.
- Limpeza: HTTP 404/410 → apaga assinatura; falhas repetidas → incrementa `failure_count`.
- iOS: Web Push só funciona com o app **instalado na tela inicial (PWA)** — inclua `manifest.webmanifest` e um aviso de UX.

## 4. Segurança e performance
- Cookies HttpOnly, CORS restrito ao `APP_URL`, validação de payloads (Zod + `@hono/zod-validator`).
- Builds privadas filtradas por `user_id` em toda query; links compartilháveis por `share_slug` aleatório.
- Cache agressivo de catálogo (`Cache-Control` + Cache API), índices D1 já no schema.
- Catálogo grande no front: baixar por tipo sob demanda, guardar em IndexedDB, versionar por hash.

## 5. Roadmap sugerido
1. Schema + auth + sync de catálogo
2. Builder (slots, capacidade, filtro) + motor de cálculo com testes
3. Builds salvas/compartilhadas
4. Kanban + Web Push
5. Simulador de alvo
6. Rivens (cálculo → God Roll → preço)

## 6. Pontos a validar antes de codar
- Endpoint atual do `warframestat.us` para Archimedea/Hex e do Warframe.Market (v1 vs v2).
- Fonte dos dados de Incarnon e Arcanos "Incarnon Genesis" (provável curadoria manual).
- Valores exatos de procs/armadura conforme o patch vigente (centralizados em config).
