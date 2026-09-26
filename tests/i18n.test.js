import { describe, it, expect } from 'vitest';
import en from '../src/i18n/en.js';
import es from '../src/i18n/es.js';

function keys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
}

describe('translations', () => {
  it('English and Spanish have exactly the same keys', () => {
    const a = keys(en).sort();
    const b = keys(es).sort();
    expect(b.filter((k) => !a.includes(k))).toEqual([]);
    expect(a.filter((k) => !b.includes(k))).toEqual([]);
  });

  it('keeps the same {placeholders} in both languages', () => {
    const get = (o, k) => k.split('.').reduce((x, p) => x?.[p], o);
    for (const k of keys(en)) {
      const e = get(en, k);
      const s = get(es, k);
      if (typeof e !== 'string') continue;
      const ph = (x) => (x.match(/\{\w+\}/g) || []).sort().join();
      expect(ph(s), k).toBe(ph(e));
    }
  });
});
