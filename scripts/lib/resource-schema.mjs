// Normalization + validation for Resource records (used by build-resources and validate-data).
import TX_ZIPS from '../../base44/shared/data/tx-zips.js';
import { CATEGORIES, SIGNALS } from '../../base44/shared/constants.js';

export const TX_COUNTIES = new Set(Object.values(TX_ZIPS).flatMap(([primary, , , ...others]) => [primary, ...others]));
export const COVERAGE_TYPES = ['national', 'state', 'region', 'county', 'city'];

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
  return /^[\d\s()+.-]{3,20}$/.test(s) ? s : null;
}

export function normalizeCounty(c) {
  const s = str(c, 60);
  if (!s) return null;
  const name = s.replace(/\s+county$/i, '').trim();
  for (const county of TX_COUNTIES) if (county.toLowerCase() === name.toLowerCase()) return county;
  return null;
}

const RULE_TO_SIGNAL = {
  requires_children: 'needs_children', child_under_5: 'child_under_5', pregnant: 'pregnant', job_loss: 'job_loss', veteran_only: 'veteran_only',
  senior: 'senior', disability: 'disability', student: 'student', unhoused: 'unhoused',
};

// Research records that duplicate a curated statewide/national program (spec 9A) are dropped:
// the curated version, with the exact official URL, always wins.
const CURATED_DUPLICATES = [
  [/\bSNAP\b|supplemental nutrition|food stamps/i, 'state'],
  [/\bWIC\b/, 'state'],
  [/medicaid|\bCHIP\b/i, 'state'],
  [/\bTANF\b/, 'state'],
  [/\bLIHEAP\b|\bCEAP\b|comprehensive energy assistance/i, 'state'],
  [/\blifeline\b/i, 'state'],
  [/\b988\b/, 'any'],
  [/head start/i, 'state'],
  [/\b2-?1-?1\b/, 'any'],
  [/domestic violence hotline/i, 'state'],
  [/unemployment (insurance|benefits)/i, 'state'],
  [/school (meals|lunch|breakfast)|\bNSLP\b/i, 'state'],
  [/central texas food bank/i, 'any'],
  [/austin energy/i, 'any'],
  [/child,? inc/i, 'any'],
  [/austin isd.*(meal|nutrition)|aisd.*meal/i, 'any'],
  [/capmetro.*(reduced|fare)/i, 'any'],
  [/workforce solutions capital area/i, 'any'],
  [/findhelp/i, 'any'],
];

export function duplicatesCurated(record) {
  const statewide = ['state', 'national'].includes(record.coverage_type);
  return CURATED_DUPLICATES.some(([re, scope]) => re.test(record.name) && (scope === 'any' || statewide));
}

/** Normalize one research record into the Resource entity shape. Returns {record, problems}. */
export function normalizeResearchRecord(raw, { verifiedDate } = {}) {
  const problems = [];
  const name = str(raw.name, 200);
  const categories = [...new Set((raw.categories || []).filter((c) => CATEGORIES.includes(c)))];
  const coverage_type = COVERAGE_TYPES.includes(raw.coverage_type) ? raw.coverage_type : null;
  const counties = [...new Set((raw.coverage_counties || []).map(normalizeCounty).filter(Boolean))];
  if (!coverage_type) problems.push('invalid coverage_type');
  if (['region', 'county', 'city'].includes(coverage_type) && !counties.length) problems.push('local resource without valid Texas counties');

  const rules = raw.eligibility_rules || {};
  const signals = {};
  for (const [k, sig] of Object.entries(RULE_TO_SIGNAL)) if (rules[k] === true) signals[sig] = true;
  if (typeof rules.max_income_pct_fpl === 'number') signals.low_income = true;
  if (typeof rules.min_age === 'number' && rules.min_age >= 55) signals.senior = true;

  const record = {
    slug: slugify(raw.id || name),
    program_key: null,
    name,
    organization: str(raw.organization, 200),
    categories,
    what_it_gives_en: str(raw.description_en),
    what_it_gives_es: str(raw.description_es),
    who_its_for_en: str(raw.eligibility_summary_en),
    who_its_for_es: str(raw.eligibility_summary_es),
    how_to_apply_en: str(raw.how_to_apply_en ?? raw.how_to_apply),
    how_to_apply_es: str(raw.how_to_apply_es),
    documents: [...new Set((raw.documents_needed || []).map((d) => str(d, 200)).filter(Boolean))].slice(0, 10),
    documents_es: [],
    apply_url: cleanUrl(raw.apply_url),
    phone: cleanPhone(raw.phone),
    hours: str(raw.hours, 400),
    address: str(raw.address, 200),
    city: str(raw.city, 80),
    zip: /^\d{5}$/.test(String(raw.zip || '').trim()) ? String(raw.zip).trim() : null,
    walk_in: raw.walk_in === true,
    apply_online: raw.apply_online === true,
    languages: [...new Set((raw.languages || []).map((l) => str(l, 40)).filter(Boolean))],
    coverage_type,
    coverage_state: 'TX',
    coverage_zip_prefixes: [],
    coverage_counties: ['national', 'state'].includes(coverage_type) ? [] : counties,
    signals,
    is_crisis: /crisis|suicide|hotline/i.test(name || '') && categories.includes('mental_health'),
    priority_weight: 0,
    source_url: cleanUrl(raw.source_url),
    last_checked_date: str(raw.verified_date, 10) || verifiedDate || null,
    is_active: raw.is_active !== false,
    confidence: raw.confidence === 'high' ? 'high' : 'medium',
    origin: 'research',
  };
  if (coverage_type === 'national') record.coverage_state = null;

  if (!record.name) problems.push('missing name');
  if (!record.slug) problems.push('missing slug');
  if (!categories.length) problems.push('no valid categories');
  if (!record.what_it_gives_en) problems.push('missing description');
  if (!record.phone && !record.apply_url && !record.address) problems.push('no way to contact (phone, url or address)');
  if (!record.source_url) problems.push('missing source_url');
  return { record, problems };
}

/** Strict validation of a final record (CI). Returns a list of problems. */
export function validateResource(r) {
  const problems = [];
  if (!r.slug || !/^[a-z0-9-]+$/.test(r.slug)) problems.push('bad slug');
  if (!r.name) problems.push('missing name');
  if (!Array.isArray(r.categories) || !r.categories.length || r.categories.some((c) => !CATEGORIES.includes(c))) problems.push('bad categories');
  if (!COVERAGE_TYPES.includes(r.coverage_type)) problems.push('bad coverage_type');
  if (['region', 'county', 'city'].includes(r.coverage_type) && !(r.coverage_counties?.length || r.coverage_zip_prefixes?.length)) problems.push('local resource without area');
  if (!r.what_it_gives_en || !r.what_it_gives_es) problems.push('missing what_it_gives en/es');
  if (!r.phone && !r.apply_url && !r.address) problems.push('no contact');
  for (const u of [r.apply_url, r.source_url]) if (u && !cleanUrl(u)) problems.push(`bad url ${u}`);
  if (!r.last_checked_date || !/^\d{4}-\d{2}-\d{2}$/.test(r.last_checked_date)) problems.push('missing last_checked_date');
  for (const k of Object.keys(r.signals || {})) if (!SIGNALS.includes(k)) problems.push(`unknown signal ${k}`);
  return problems;
}
