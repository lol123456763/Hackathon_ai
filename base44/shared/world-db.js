// Keeps the whole shared demo neighborhood (hubs, posts, missions, requests, calendars, feed…) in ONE
// Base44 record, so a live-panel poll costs one read instead of ~11 (Base44 rate-limits entity calls).
// Each request loads the world once, works on it in memory (same `db` interface as memory-db.js), and
// saves once at the end with a version check; on a conflicting save the whole action is retried.
import { createMemoryDb } from './memory-db.js';

export const WORLD_ENTITIES = new Set([
  'Hub', 'Giver', 'Team', 'Volunteer', 'Event', 'Activity', 'Donation', 'Mission', 'HelpRequest', 'DemoState', 'CalendarBlock', 'Project',
]);
const MAX_ACTIVITY = 150;

export class WorldConflict extends Error {}

/**
 * @param store {{ load(): Promise<{id?:string, version:number, data:object}|null>, save(record, expectedVersion): Promise<void> }}
 * @param passthrough  db interface for entities that stay in their own tables (e.g. PlanSession)
 */
export function createWorldDb(store, passthrough) {
  let loaded = null;
  let mem = null;
  let dirty = false;
  async function ensure() {
    if (mem) return mem;
    loaded = (await store.load()) || { version: 0, data: {} };
    mem = createMemoryDb(loaded.data || {}, { onChange: () => (dirty = true) });
    return mem;
  }
  const route = (entity) => (WORLD_ENTITIES.has(entity) ? ensure() : Promise.resolve(passthrough));
  return {
    db: {
      list: async (entity, ...args) => (await route(entity)).list(entity, ...args),
      create: async (entity, data) => (await route(entity)).create(entity, data),
      bulkCreate: async (entity, rows) => (await route(entity)).bulkCreate(entity, rows),
      update: async (entity, id, patch) => (await route(entity)).update(entity, id, patch),
      deleteMany: async (entity, query) => (await route(entity)).deleteMany(entity, query),
    },
    /** Save if anything changed. Throws WorldConflict if someone else saved first. */
    async commit() {
      if (!dirty || !mem) return false;
      const tables = mem.tables;
      if (tables.Activity?.length > MAX_ACTIVITY) {
        tables.Activity = [...tables.Activity].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, MAX_ACTIVITY);
      }
      await store.save({ ...loaded, version: (loaded.version || 0) + 1, data: tables }, loaded.version || 0);
      dirty = false;
      return true;
    },
  };
}
