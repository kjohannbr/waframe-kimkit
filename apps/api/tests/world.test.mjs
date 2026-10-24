// node --test "tests/*.test.mjs"   (Node 22+: executa .ts direto)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as W from '../src/world.ts';
import { TASK_TEMPLATES } from '../src/tasks.ts';
import * as F from './fixtures.mjs';

// ───────────── texto ─────────────
test('tidy junta letras soltas e preserva o resto', () => {
  assert.equal(W.tidy('M P V Protea Prime Single Pack'), 'MPV Protea Prime Single Pack');
  assert.equal(W.tidy('C T_ L A B'), 'CTLAB');
  assert.equal(W.tidy('T1 Void Projection Protea Ivara Vault A Bronze'), 'T1 Void Projection Protea Ivara Vault A Bronze');
  assert.equal(W.tidy('  Soma   Prime '), 'Soma Prime');
  assert.equal(W.tidy(null), '');
});
test('humanize e clean', () => {
  assert.equal(W.humanize('/Lotus/Specs/FrozenLightEximusCabal'), 'Frozen Light Eximus Cabal');
  assert.equal(W.clean('<DT_X>Enemies  take   less'), 'Enemies take less');
});

// ───────────── semana ─────────────
test('semana do jogo: segunda 00:00 UTC', () => {
  assert.equal(W.weekWindow(new Date('2026-10-23T10:46:00Z')).id, '2026-10-19'); // sexta
  assert.equal(W.weekWindow(new Date('2026-10-19T00:00:00Z')).id, '2026-10-19'); // exatamente no reset
  assert.equal(W.weekWindow(new Date('2026-10-18T23:59:59Z')).id, '2026-10-12'); // segundo antes
  assert.equal(W.weekWindow(new Date('2026-10-25T12:00:00Z')).id, '2026-10-19'); // domingo
  assert.equal(W.weekWindow(new Date('2026-10-23T10:00:00Z')).end, '2026-10-26T00:00:00.000Z');
});

// ───────────── Archimedeas ─────────────
test('Archimedeas: tipo vem de "C T_ L A B" / "CT_HEX" e marca riscos Elite', () => {
  const [deep, temporal] = W.normArchimedeas(F.archimedeas);
  assert.equal(deep.kind, 'deep');
  assert.equal(deep.title, 'Deep Archimedea');
  assert.equal(temporal.kind, 'temporal');
  assert.equal(temporal.title, 'Temporal Archimedea');
  assert.equal(deep.missions.length, 3);
  assert.equal(deep.missions[0].missionType, 'Extermination');
  assert.equal(deep.missions[0].deviation.name, 'Sealed Armor');
  assert.deepEqual(deep.missions[0].risks.map((r) => [r.name, r.elite]), [['Bold Venture', false], ['Alluring Arcocanids', true]]);
  assert.equal(deep.missions[0].risks[0].description, 'Bold Venture description'); // tag <DT_X> removida
  assert.equal(deep.personalModifiers.length, 2);
  assert.equal(deep.expiry, '2026-10-26T00:00:00.000Z');
});
test('Archimedea: chave sem espaços e tipo desconhecido', () => {
  assert.equal(W.archimedeaKind('CT_LAB', ''), 'deep');
  assert.equal(W.archimedeaKind('CT_HEX', ''), 'temporal');
  assert.equal(W.archimedeaKind('', 'Temporal Archimedea'), 'temporal');
  assert.equal(W.archimedeaKind('XYZ', ''), 'unknown');
  assert.equal(W.normArchimedeas([{ type: 'X Y Z W', missions: [] }])[0].kind, 'unknown');
});

// ───────────── Descendia ─────────────
test('Descendia: ordena por andar e junta penitências (inimigos + efeitos)', () => {
  const d = W.normDescendia(F.descendia);
  assert.deepEqual(d.challenges.map((c) => c.index), [1, 2, 8, 21]);
  assert.deepEqual(d.challenges[0].penances, ['Frozen Light Eximus Cabal']);
  assert.equal(d.challenges[0].content, '');            // vazio não repete o objetivo
  assert.equal(d.challenges[1].content, '');            // igual ao objetivo → omitido
  assert.deepEqual(d.challenges[2].penances, ['Manic Mania']);
  assert.deepEqual(d.challenges[3].penances, ['Frost Giants']); // nome vazio → derivado do uniqueName
  assert.equal(d.id, 'desc1');
});
test('Descendia: formatos inválidos viram null', () => {
  assert.equal(W.normDescendia(null), null);
  assert.equal(W.normDescendia({ challenges: [] }), null);
  assert.equal(W.normDescendia({ challenges: [{ index: 0 }] }), null); // andar sem nenhum conteúdo
});
test('Descendia: aceita numeração a partir de 0 (andar = índice + 1) ou sem índice', () => {
  const zero = W.normDescendia({ id: 'z', challenges: [0, 1, 2].map((i) => ({ index: i, type: `T${i}` })) });
  assert.deepEqual(zero.challenges.map((c) => c.index), [1, 2, 3]);
  assert.deepEqual(zero.challenges.map((c) => c.objective), ['T0', 'T1', 'T2']);
  const none = W.normDescendia({ id: 'n', challenges: [{ type: 'A' }, { type: 'B' }] });
  assert.deepEqual(none.challenges.map((c) => c.index), [1, 2]);
});

// ───────────── Mercadores ─────────────
test('Baro fora do ar: sem estoque, mas com chegada e local', () => {
  const b = W.normTrader(F.voidTraderInactive);
  assert.equal(b.name, "Baro Ki'Teer");
  assert.equal(b.location, 'Strata Relay (Earth)');
  assert.deepEqual(b.inventory, []);
  assert.equal(b.activation, '2026-10-23T13:00:00.000Z');
});
test('Baro com estoque: preço ausente vira null', () => {
  const b = W.normTrader(F.voidTraderActive);
  assert.deepEqual(b.inventory[0], { name: 'Primed Pistol Gambit', ducats: 350, credits: 150000 });
  assert.deepEqual(b.inventory[1], { name: 'Some Relic Pack', ducats: null, credits: 1 });
});
test('Varzia: nomes arrumados e preços separados', () => {
  const v = W.normTrader(F.vaultTrader);
  assert.equal(v.inventory[0].name, 'MPV Protea Prime Single Pack');
  assert.equal(v.inventory[0].ducats, 6);
  assert.equal(v.inventory[0].credits, null);
  assert.equal(v.inventory[1].credits, 1);
});
test('Teshin / Steel Path', () => {
  const s = W.normSteelPath(F.steelPath);
  assert.deepEqual(s.current, { name: '30,000 Endo', cost: 150 });
  assert.equal(s.rotation.length, 2);
  assert.equal(s.evergreens[0].name, 'Veiled Riven Cipher');
  assert.equal(W.normSteelPath({}), null);
});

// ───────────── Archon / Circuit / Nightwave ─────────────
test('Archon Hunt', () => {
  const a = W.normArchon(F.archonHunt);
  assert.equal(a.boss, 'Archon Amar');
  assert.deepEqual(a.missions[2], { type: 'Assassination', node: 'War (Mars)' });
  assert.equal(W.normArchon({}), null);
});
test('Circuit: normal = Warframes, hard = Incarnon Genesis', () => {
  assert.deepEqual(W.normCircuit(F.duviriCycle), {
    normal: ['Hydroid', 'Mirage', 'Limbo'],
    steelPath: ['Dera', 'Cestra', 'Okina', 'Sybaris', 'Sicarus']
  });
  assert.equal(W.normCircuit({ choices: [] }), null);
});
test('Nightwave: classifica atos, ignora texto provisório e sem título', () => {
  const n = W.normNightwave(F.nightwave);
  assert.equal(n.season, 18);
  assert.deepEqual(n.acts.map((a) => [a.title, a.kind]), [['Loyalty', 'daily'], ['Mission Complete XI', 'weekly'], ['Season Weekly Hard Going Down', 'elite']]);
  assert.equal(n.acts[2].desc, '');
});

// ───────────── fetchWorld (servidor falso) ─────────────
const fakeFetch = (overrides = {}, failing = []) => async (url) => {
  const path = new URL(url).pathname.split('/').pop();
  assert.match(String(url), /language=en/);
  if (failing.includes(path)) return new Response('boom', { status: 503 });
  const body = path in overrides ? overrides[path] : F.routes[path];
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

test('fetchWorld: monta todas as seções', async () => {
  const now = new Date('2026-10-23T10:46:00Z');
  const w = await W.fetchWorld('https://x.test/pc', fakeFetch(), now);
  assert.deepEqual(w.errors, {});
  assert.equal(w.week.id, '2026-10-19');
  assert.equal(w.archimedeas.length, 2);
  assert.equal(w.descendia.challenges.length, 4);
  assert.equal(w.baro.name, "Baro Ki'Teer");
  assert.equal(w.varzia.name, 'Varzia');
  assert.equal(w.steelPath.current.name, '30,000 Endo');
  assert.equal(w.archon.boss, 'Archon Amar');
  assert.equal(w.circuit.normal.length, 3);
  assert.equal(w.nightwave.acts.length, 3);
  assert.deepEqual(Object.keys(w.times).sort(), [...W.SECTION_KEYS].sort());
});
test('fetchWorld: falha parcial não derruba o resto', async () => {
  const w = await W.fetchWorld('https://x.test/pc', fakeFetch({}, ['descendia', 'nightwave']), new Date('2026-10-23T10:46:00Z'));
  assert.equal(w.descendia, null);
  assert.equal(w.nightwave, null);
  assert.match(w.errors.descendia, /503/);
  assert.ok(w.archimedeas && w.baro && w.varzia);
  assert.ok(W.hasAnyData(w));
});
test('fetchWorld: JSON vazio/inválido conta como erro da seção', async () => {
  const w = await W.fetchWorld('https://x.test/pc', fakeFetch({ archimedeas: [], descendia: { challenges: [] } }), new Date('2026-10-23T10:46:00Z'));
  assert.equal(w.archimedeas, null);
  assert.equal(w.errors.archimedeas, 'sem dados');
  assert.equal(w.errors.descendia, 'sem dados');
});
test('fetchWorld: tudo fora do ar → sem dados', async () => {
  const w = await W.fetchWorld('https://x.test/pc', fakeFetch({}, Object.values(W.SECTIONS).map((s) => s.path)), new Date('2026-10-23T10:46:00Z'));
  assert.equal(W.hasAnyData(w), false);
});
test('fetchWorld: erro de rede é capturado', async () => {
  const w = await W.fetchWorld('https://x.test/pc', async () => { throw new TypeError('network down'); }, new Date('2026-10-23T10:46:00Z'));
  assert.equal(W.hasAnyData(w), false);
  assert.equal(w.errors.baro, 'network down');
});

// ───────────── cache / stale ─────────────
test('mergeStale: completa seção que falhou com o cache da mesma semana', async () => {
  const t0 = new Date('2026-10-23T08:00:00Z');
  const cached = await W.fetchWorld('https://x.test/pc', fakeFetch(), t0);
  const t1 = new Date('2026-10-23T09:00:00Z');
  const fresh = await W.fetchWorld('https://x.test/pc', fakeFetch({}, ['descendia']), t1);
  const merged = W.mergeStale(fresh, cached, t1);
  assert.equal(merged.descendia.id, 'desc1');
  assert.deepEqual(merged.stale, ['descendia']);
  assert.equal(merged.times.descendia, t0.toISOString());   // idade real da seção, não a de agora
  assert.equal(merged.times.baro, t1.toISOString());
});
test('mergeStale: não usa cache velho (>6h) nem de outra semana', async () => {
  const cached = await W.fetchWorld('https://x.test/pc', fakeFetch(), new Date('2026-10-23T01:00:00Z'));
  const late = new Date('2026-10-23T10:00:00Z'); // 9h depois
  const freshA = await W.fetchWorld('https://x.test/pc', fakeFetch({}, ['descendia']), late);
  assert.equal(W.mergeStale(freshA, cached, late).descendia, null);

  const nextWeek = new Date('2026-10-26T00:30:00Z');
  const freshB = await W.fetchWorld('https://x.test/pc', fakeFetch({}, ['descendia']), nextWeek);
  const m = W.mergeStale(freshB, cached, nextWeek);
  assert.equal(m.descendia, null);
  assert.deepEqual(m.stale, []);
});
test('mergeStale sem cache devolve o mesmo objeto', async () => {
  const w = await W.fetchWorld('https://x.test/pc', fakeFetch(), new Date('2026-10-23T10:00:00Z'));
  assert.equal(W.mergeStale(w, null), w);
});

// ───────────── tarefas ─────────────
test('modelos de tarefa: chaves únicas, ordem única e inclui Descendia/Archimedeas', () => {
  const keys = TASK_TEMPLATES.map((t) => t.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(new Set(TASK_TEMPLATES.map((t) => t.sort)).size, keys.length);
  for (const k of ['descendia', 'descendia_steel_path', 'temporal_archimedea', 'elite_temporal_archimedea', 'deep_archimedea', 'elite_deep_archimedea', 'vendor_iron_wake', 'vendor_teshin', 'vendor_varzia', 'vendor_maroo']) {
    assert.ok(keys.includes(k), `falta ${k}`);
  }
});
test('schema.sql traz o mesmo seed de src/tasks.ts', () => {
  const sql = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
  const seed = sql.slice(sql.indexOf('INSERT INTO task_templates'));
  const rows = [...seed.matchAll(/^ \('((?:[^']|'')+)', '((?:[^']|'')+)', '([^']+)', '([^']+)', (\d+)\)/gm)].map((m) => ({
    key: m[1], title: m[2].replace(/''/g, "'"), category: m[3], cadence: m[4], sort: Number(m[5])
  }));
  assert.deepEqual(rows, TASK_TEMPLATES);
});
