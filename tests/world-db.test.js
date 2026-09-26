// The one-record world store used on Base44: loads once, saves once, detects concurrent saves.
import { describe, it, expect } from 'vitest';
import { createWorldDb, WorldConflict } from '../base44/shared/world-db.js';
import { createMemoryDb } from '../base44/shared/memory-db.js';
import { dispatch } from '../base44/shared/service.js';
import RESOURCES from '../data/resources.json';

function fakeStore() {
  const state = { record: null, loads: 0, saves: 0 };
  return {
    state,
    async load() {
      state.loads++;
      return state.record && structuredClone(state.record);
    },
    async save(record, expected) {
      if ((state.record?.version || 0) !== expected) throw new WorldConflict('changed');
      state.saves++;
      state.record = structuredClone(record);
    },
  };
}

describe('world store', () => {
  it('runs the app with one load per request and one save per change', async () => {
    const store = fakeStore();
    const plans = createMemoryDb();
    const run = async (action, args) => {
      const w = createWorldDb(store, plans);
      const out = await dispatch(action, args, { db: w.db, loadResources: async () => RESOURCES.map((r) => ({ ...r, id: r.slug })) });
      await w.commit();
      return out;
    };
    await run('reset');
    const before = { ...store.state };
    const s = await run('state', { role: 'volunteer', identity: 'jordan' });
    expect(s.impact.lbs).toBe(1284);
    expect(store.state.loads - before.loads).toBe(1);
    expect(store.state.saves - before.saves).toBe(0); // polling never writes
    await run('postDonation', { giver_key: 'maple-masa', draft: { items: [{ name_en: 'Bread', name_es: 'Pan', quantity_text: '10', est_lbs: 10, category: 'bakery', storage: 'shelf_stable' }], pickup_start: '17:00', pickup_end: '18:00' }, allergens_confirmed: true });
    expect(store.state.saves - before.saves).toBe(1);
  });

  it('detects a concurrent save', async () => {
    const store = fakeStore();
    const a = createWorldDb(store, createMemoryDb());
    const b = createWorldDb(store, createMemoryDb());
    await a.db.create('Hub', { key: 'x' });
    await b.db.create('Hub', { key: 'y' });
    await a.commit();
    await expect(b.commit()).rejects.toBeInstanceOf(WorldConflict);
  });
});
