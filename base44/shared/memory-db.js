// A tiny in-memory implementation of the service `db` interface. Used by local mode (persisted to
// localStorage by src/api/localBackend.js) and by the automated tests.

function matches(row, query) {
  return Object.entries(query || {}).every(([k, v]) => row[k] === v);
}

function sortRows(rows, sort) {
  if (!sort) return rows;
  const desc = sort.startsWith('-');
  const key = desc ? sort.slice(1) : sort;
  return [...rows].sort((a, b) => (String(a[key]) < String(b[key]) ? -1 : String(a[key]) > String(b[key]) ? 1 : 0) * (desc ? -1 : 1));
}

export function createMemoryDb(initial = {}, { onChange } = {}) {
  const tables = structuredClone(initial);
  let seq = Object.values(tables).reduce((n, rows) => n + rows.length, 0);
  const table = (e) => (tables[e] ??= []);
  const changed = () => onChange?.(tables);
  const clone = (x) => structuredClone(x);
  return {
    tables,
    async list(entity, query = {}, sort, limit = 1000) {
      return sortRows(table(entity).filter((r) => matches(r, query)), sort).slice(0, limit).map(clone);
    },
    async create(entity, data) {
      const row = { ...clone(data), id: `m${++seq}`, created_date: new Date().toISOString() };
      table(entity).push(row);
      changed();
      return clone(row);
    },
    async bulkCreate(entity, rows) {
      const out = rows.map((d) => ({ ...clone(d), id: `m${++seq}`, created_date: new Date().toISOString() }));
      table(entity).push(...out);
      changed();
      return out.map(clone);
    },
    async update(entity, id, patch) {
      const row = table(entity).find((r) => r.id === id);
      if (!row) throw new Error(`${entity} ${id} not found`);
      Object.assign(row, clone(patch));
      changed();
      return clone(row);
    },
    async deleteMany(entity, query) {
      const before = table(entity).length;
      tables[entity] = table(entity).filter((r) => !matches(r, query));
      changed();
      return { deleted: before - tables[entity].length };
    },
  };
}
