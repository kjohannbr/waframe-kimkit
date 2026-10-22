// node --test apps/web/tests/search.test.mjs   (Node 22+: executa .ts direto)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepare, search, highlight, compatibleMods, norm } from '../src/lib/catalog.ts';
import { emptyBuild, slotDrain, summarize } from '../src/lib/builder.ts';

const data = (f) => JSON.parse(readFileSync(new URL(`../static/data/${f}.json`, import.meta.url), 'utf8'));
const items = prepare(data('items'));
const mods = data('mods');
const names = (q, o) => search(items, q, o).map((x) => x.name);

test('"nukor" mostra Nukor e Kuva Nukor, com o nome exato primeiro', () => {
  assert.deepEqual(names('nukor'), ['Nukor', 'Kuva Nukor']);
});

test('"So" mostra toda arma/item que tem "so" no nome (não só no começo)', () => {
  const r = names('So');
  for (const n of ['Soma', 'Soma Prime', 'Sobek', 'Kuva Sobek', 'Sonicor', 'Aksomati', 'Twin Basolk', 'Nami Solo', 'Evensong']) {
    assert.ok(r.includes(n), `faltou ${n}`);
  }
  assert.ok(r.every((n) => norm(n).includes('so')), 'apareceu item sem "so" no nome');
  // quem começa com "so" vem antes de quem só contém
  const firstContains = r.findIndex((n) => !norm(n).startsWith('so'));
  const lastStarts = r.map((n) => norm(n).startsWith('so')).lastIndexOf(true);
  assert.ok(lastStarts < firstContains, 'ordem: começa-com deve vir antes de contém');
});

test('ignora maiúsculas, acentos e espaços extras', () => {
  assert.deepEqual(names('  NUKOR '), names('nukor'));
});

test('várias palavras: todas precisam aparecer', () => {
  assert.deepEqual(names('kuva nuk'), ['Kuva Nukor']);
});

test('sem resultado e consulta vazia', () => {
  assert.deepEqual(names('zzzzqq'), []);
  assert.deepEqual(names(''), []);
});

test('filtro por categoria e limite', () => {
  assert.ok(names('so', { filter: (i) => i.category === 'Secundária' }).every((n) => ['Aksomati', 'Aksomati Prime', 'Aksondol', 'Sonicor'].includes(n)));
  assert.equal(names('a', { limit: 5 }).length, 5);
});

test('highlight marca o trecho digitado', () => {
  assert.deepEqual(highlight('Kuva Nukor', 'nuk'), ['Kuva ', 'Nuk', 'or']);
  assert.deepEqual(highlight('Soma', 'zz'), ['Soma', '', '']);
});

test('mods compatíveis respeitam o tipo da arma', () => {
  const by = (n) => items.find((i) => i.name === n);
  const has = (item, mod, slot = 'main') => compatibleMods(mods, item, slot).some((m) => m.name === mod);
  assert.ok(has(by('Soma Prime'), 'Serration'));
  assert.ok(!has(by('Nukor'), 'Serration'), 'Serration não serve em pistola');
  assert.ok(has(by('Nukor'), 'Hornet Strike'));
  assert.ok(has(by('Kuva Sobek'), 'Point Blank'), 'shotgun usa mods de shotgun');
  assert.ok(has(by('Excalibur'), 'Vitality'));
  assert.ok(!has(by('Soma Prime'), 'Vitality'));
  assert.ok(compatibleMods(mods, by('Excalibur'), 'aura').length > 20);
  assert.ok(compatibleMods(mods, by('Skana'), 'stance').length > 50);
});

test('capacidade: polaridade igual = metade, diferente = +25%, neutro = normal', () => {
  const serration = mods.find((m) => m.name === 'Serration'); // drain 4, rank 10 → 14, madurai
  assert.equal(slotDrain(serration, 10, null), 14);
  assert.equal(slotDrain(serration, 10, 'madurai'), 7);
  assert.equal(slotDrain(serration, 10, 'naramon'), 18);
  const aura = mods.find((m) => m.compat === 'AURA');
  assert.ok(slotDrain(aura, aura.maxRank, null, true) < 0, 'aura soma capacidade');
});

test('resumo de capacidade da build', () => {
  const item = items.find((i) => i.name === 'Soma Prime');
  const b = emptyBuild(item);
  const serration = mods.find((m) => m.name === 'Serration');
  const modsById = new Map(mods.map((m) => [m.id, m]));
  assert.deepEqual(summarize(b, modsById), { capacity: 30, used: 0, free: 30, over: false });
  b.slots[7] = { modId: serration.id, rank: 10, polarity: null };
  assert.equal(summarize(b, modsById).used, 14);
  b.reactor = true;
  assert.equal(summarize(b, modsById).capacity, 60);
});
