// Normalization + validation rules for resource records (used by build-resources and validate-data).
import TX_ZIPS from '../../base44/shared/data/tx-zips.js';
import { CATEGORIES } from '../../base44/shared/constants.js';

export const TX_COUNTIES = new Set(Object.values(TX_ZIPS).flatMap(([primary, , , ...others]) => [primary, ...others]));
export const COVERAGE_TYPES = ['national', 'state', 'region', 'county', 'city'];
const RULE_KEYS = {
  max_income_pct_fpl: 'number', requires_children: 'boolean', child_under_5: 'boolean', pregnant: 'boolean', min_age: 'number', max_age: 'number',
  senior: 'boolean', veteran_only: 'boolean', disability: 'boolean', student: 'boolean', unhoused: 'boolean', uninsured: 'boolean', job_loss: 'boolean',
  residency_required: 'string',
};

const str = (v, max = 2000) => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ').slice(0, max) : null);

export function slugify(s) {
  return String(s || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

export function cleanUrl(u) {
  const s = str(u, 500);
  if (!s) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function cleanPhone(p) {
  const s = str(p, 60);
  if (!s) return null;
  if (/^(2-?1-?1|211)$/.test(s)) return '2-1-1';
  if (/^9-?8-?8$/.test(s)) return '988';
  if (/^9-?1-?1$/.test(s)) return '911';
  const digits = s.replace(/\D/g, '');
  const d = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (d.length === 10) {
    const ext = s.match(/(ext\.?|x)\s*(\d+)/i);
    const base = /^8(00|33|44|55|66|77|88)/.test(d) ? `1-${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    return ext ? `${base} ext. ${ext[2]}` : base;
  }
  // Short codes / unusual numbers: keep as written only if they look like a phone number.
  return /^[\d\s()+.-]{3,20}$/.test(s) ? s : null;
}

export function normalizeCounty(c) {
  const s = str(c, 60);
  if (!s) return null;
  const name = s.replace(/\s+county$/i, '').trim();
  for (const county of TX_COUNTIES) if (county.toLowerCase() === name.toLowerCase()) return county;
  return null;
}

/** Normalize one research record into the Resource entity shape. Returns {record, problems}. */
export function normalizeRecord(raw, { verifiedDate } = {}) {
  const problems = [];
  const name = str(raw.name, 200);
  const categories = [...new Set((raw.categories || []).filter((c) => CATEGORIES.includes(c)))];
  let coverage_type = COVERAGE_TYPES.includes(raw.coverage_type) ? raw.coverage_type : null;
  const counties = [...new Set((raw.coverage_counties || []).map(normalizeCounty).filter(Boolean))];
  if (['region', 'county', 'city'].includes(coverage_type) && !counties.length) problems.push('local resource without valid Texas counties');
  if (!coverage_type) problems.push('invalid coverage_type');
  if (['national', 'state'].includes(coverage_type)) counties.length = 0;

  const rules = {};
  for (const [k, type] of Object.entries(RULE_KEYS)) {
    const v = raw.eligibility_rules?.[k];
    if (v === undefined || v === null) continue;
    if (typeof v === type) rules[k] = v;
  }
  if (rules.max_income_pct_fpl !== undefined && (rules.max_income_pct_fpl < 50 || rules.max_income_pct_fpl > 500)) delete rules.max_income_pct_fpl;
  // Only `true` flags are meaningful for matching.
  for (const [k, v] of Object.entries(rules)) if (v === false) delete rules[k];

  const record = {
    slug: slugify(raw.id || name),
    name,
    organization: str(raw.organization, 200),
    categories,
    description_en: str(raw.description_en),
    description_es: str(raw.description_es),
    eligibility_summary_en: str(raw.eligibility_summary_en),
    eligibility_summary_es: str(raw.eligibility_summary_es),
    eligibility_rules: rules,
    documents_needed: [...new Set((raw.documents_needed || []).map((d) => str(d, 200)).filter(Boolean))].slice(0, 12),
    how_to_apply_en: str(raw.how_to_apply_en ?? raw.how_to_apply),
    how_to_apply_es: str(raw.how_to_apply_es),
    apply_url: cleanUrl(raw.apply_url),
    phone: cleanPhone(raw.phone),
    address: str(raw.address, 200),
    city: str(raw.city, 80),
    zip: /^\d{5}$/.test(String(raw.zip || '').trim()) ? String(raw.zip).trim() : null,
    hours: str(raw.hours, 400),
    walk_in: raw.walk_in === true,
    apply_online: raw.apply_online === true,
    languages: [...new Set((raw.languages || []).map((l) => str(l, 40)).filter(Boolean))],
    cost: str(raw.cost, 120),
    coverage_type,
    coverage_counties: counties,
    source_url: cleanUrl(raw.source_url),
    confidence: raw.confidence === 'high' ? 'high' : 'medium',
    notes: str(raw.notes, 1000),
    is_active: raw.is_active !== false,
    verified_date: str(raw.verified_date, 10) || verifiedDate || null,
    priority_weight: typeof raw.priority_weight === 'number' ? raw.priority_weight : 0,
  };

  if (!record.name) problems.push('missing name');
  if (!record.slug) problems.push('missing slug');
  if (!categories.length) problems.push('no valid categories');
  if (!record.description_en) problems.push('missing description_en');
  if (!record.phone && !record.apply_url && !record.address) problems.push('no way to contact (phone, url or address)');
  if (!record.source_url) problems.push('missing source_url');
  return { record, problems };
}

/** Strict validation of a final record (used by CI). Returns a list of problems. */
export function validateRecord(r) {
  const { problems } = normalizeRecord(r, {});
  if (!r.description_es) problems.push('missing description_es');
  if (!r.verified_date || !/^\d{4}-\d{2}-\d{2}$/.test(r.verified_date)) problems.push('missing verified_date');
  return problems;
}
