// Modelos de tarefa do Kanban de resets. A fonte da verdade é esta lista:
// o Worker faz upsert dela no D1 (schema.sql tem a mesma lista para instalações novas — há teste contra divergência).

export type TaskTemplate = {
  key: string;
  title: string;
  category: string;
  cadence: 'weekly' | 'daily' | 'biweekly';
  sort: number;
};

export const TASK_TEMPLATES: TaskTemplate[] = [
  { key: 'deep_archimedea', title: 'Deep Archimedea', category: 'archimedea', cadence: 'weekly', sort: 10 },
  { key: 'elite_deep_archimedea', title: 'Elite Deep Archimedea', category: 'archimedea', cadence: 'weekly', sort: 11 },
  { key: 'temporal_archimedea', title: 'Temporal Archimedea (1999)', category: 'archimedea', cadence: 'weekly', sort: 12 },
  { key: 'elite_temporal_archimedea', title: 'Elite Temporal Archimedea', category: 'archimedea', cadence: 'weekly', sort: 13 },
  { key: 'descendia', title: 'The Descendia', category: 'descendia', cadence: 'weekly', sort: 15 },
  { key: 'descendia_steel_path', title: 'The Descendia (Steel Path)', category: 'descendia', cadence: 'weekly', sort: 16 },
  { key: 'hex_holvania', title: 'Höllvania / Conteúdos do Hex', category: 'hex', cadence: 'weekly', sort: 20 },
  { key: 'netracells', title: 'Netracells', category: 'netracells', cadence: 'weekly', sort: 30 },
  { key: 'archon_hunt', title: 'Archon Hunt', category: 'archon', cadence: 'weekly', sort: 31 },
  { key: 'kahl_garrison', title: "Kahl's Garrison (Break Narmer)", category: 'kahl', cadence: 'weekly', sort: 32 },
  { key: 'nightwave_weekly', title: 'Nightwave: atos semanais', category: 'nightwave', cadence: 'weekly', sort: 35 },
  { key: 'circuit', title: 'The Circuit (Duviri)', category: 'duviri', cadence: 'weekly', sort: 40 },
  { key: 'circuit_steel_path', title: 'The Circuit (Steel Path)', category: 'duviri', cadence: 'weekly', sort: 41 },
  { key: 'vendor_iron_wake', title: 'Iron Wake / Palladino (Riven Slivers)', category: 'vendor', cadence: 'weekly', sort: 50 },
  { key: 'vendor_teshin', title: 'Teshin (Steel Path Honors)', category: 'vendor', cadence: 'weekly', sort: 51 },
  { key: 'vendor_varzia', title: 'Varzia (Prime Resurgence)', category: 'vendor', cadence: 'weekly', sort: 52 },
  { key: 'vendor_maroo', title: 'Maroo (Ayatan Treasure Hunt)', category: 'vendor', cadence: 'weekly', sort: 53 },
  { key: 'vendor_acrithis', title: 'Acrithis (5 itens da semana)', category: 'vendor', cadence: 'weekly', sort: 54 }
];

let ready = false;

/** Cria/atualiza os modelos no D1 (idempotente). Roda uma vez por instância do Worker. */
export async function ensureTaskTemplates(db: D1Database) {
  if (ready) return;
  await db.batch(
    TASK_TEMPLATES.map((t) =>
      db
        .prepare(
          `INSERT INTO task_templates (key,title,category,cadence,sort_order) VALUES (?,?,?,?,?)
           ON CONFLICT(key) DO UPDATE SET title=excluded.title, category=excluded.category,
             cadence=excluded.cadence, sort_order=excluded.sort_order`
        )
        .bind(t.key, t.title, t.category, t.cadence, t.sort)
    )
  );
  ready = true;
}
