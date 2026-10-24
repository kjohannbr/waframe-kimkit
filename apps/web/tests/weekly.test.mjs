import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nextReset, countdown, circuitNormalWeek, circuitSteelWeek, archonShard, varziaLabel, varziaPrice, varziaKind,
  DESCENDIA_REWARDS, CIRCUIT_NORMAL, CIRCUIT_STEEL, isTab
} from '../src/lib/weekly.ts';

test('nextReset: sempre a próxima segunda 00:00 UTC', () => {
  assert.equal(nextReset(new Date('2026-10-23T12:00:00Z')).toISOString(), '2026-10-26T00:00:00.000Z');
  assert.equal(nextReset(new Date('2026-10-26T00:00:00Z')).toISOString(), '2026-11-02T00:00:00.000Z');
  assert.equal(nextReset(new Date('2026-10-25T23:59:59Z')).toISOString(), '2026-10-26T00:00:00.000Z');
  assert.equal(nextReset(new Date('2026-10-19T10:00:00Z')).toISOString(), '2026-10-26T00:00:00.000Z');
});

test('countdown formata dias/horas/minutos', () => {
  assert.equal(countdown(3 * 86400e3 + 4 * 3600e3), '3d 04h 00m');
  assert.equal(countdown(2 * 3600e3 + 5 * 60e3), '2h 05m');
  assert.equal(countdown(-5), 'agora');
  assert.equal(countdown(NaN), 'agora');
});

test('Circuit: identifica a semana pelos itens (ordem e caixa não importam)', () => {
  assert.equal(circuitNormalWeek(['limbo', 'Hydroid', 'Mirage'])?.week, 6);
  assert.equal(circuitNormalWeek(['Foo', 'Bar', 'Baz']), null);
  assert.equal(circuitSteelWeek(['Dera', 'Cestra', 'Okina', 'Sybaris', 'Sicarus'])?.letter, 'H');
  assert.equal(circuitSteelWeek(['x']), null);
  assert.equal(CIRCUIT_NORMAL.length, 11);
  assert.ok(CIRCUIT_STEEL.every((w) => w.length === 5) && CIRCUIT_STEEL.length === 9);
});

test('Archon: shard por cor', () => {
  assert.equal(archonShard('Archon Amar')?.shard, 'Crimson Archon Shard');
  assert.equal(archonShard('Archon Boreal')?.shard, 'Azure Archon Shard');
  assert.equal(archonShard('Archon Nira')?.shard, 'Amber Archon Shard');
  assert.equal(archonShard('Outro'), null);
});

test('Varzia: rótulo, tipo e preço', () => {
  assert.equal(varziaLabel('T1 Void Projection Protea Ivara Vault A Bronze'), 'Lith · Protea Ivara Vault A (Intact)');
  assert.equal(varziaLabel('Algo Simples'), 'Algo Simples');
  assert.equal(varziaKind('T4 Void Projection X Gold'), 'relic');
  assert.equal(varziaKind('M P V Protea Prime Single Pack'), 'pack');
  assert.equal(varziaPrice({ ducats: 6, credits: null }), '6 Regal Aya');
  assert.equal(varziaPrice({ ducats: null, credits: 1 }), '1 Aya');
  assert.equal(varziaPrice({ ducats: null, credits: null }), 'preço não informado');
});

test('Descendia: andares de recompensa e abas', () => {
  assert.ok(Object.keys(DESCENDIA_REWARDS).every((n) => +n >= 1 && +n <= 21));
  assert.ok(DESCENDIA_REWARDS[21].normal && DESCENDIA_REWARDS[21].steel);
  assert.equal(isTab('descendia'), true);
  assert.equal(isTab('x'), false);
});
