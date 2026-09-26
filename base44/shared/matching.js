// Deterministic resource matching. Runs before (and independently of) any AI so the app always
// returns sensible results, even when the AI is slow or unavailable.
import { INCOME_RANGES, LIMITS } from './constants.js';
import { lookupZip, distanceMiles, resourceLocation } from './zip.js';
import { fplMonthly } from './benefits.js';

export const FALLBACK_211 = {
  id: 'texas-211',
  name: '2-1-1 Texas',
  organization: 'Texas Health and Human Services / United Way',
  categories: ['food', 'housing', 'utilities', 'healthcare', 'mental_health', 'cash_assistance', 'transportation', 'legal', 'employment', 'school_childcare'],
  description_en: 'Free, confidential help line that connects you to local help for food, rent, bills, health care and more. Available 24/7.',
  description_es: 'Línea de ayuda gratuita y confidencial que le conecta con ayuda local para comida, renta, facturas, salud y más. Disponible 24/7.',
  eligibility_summary_en: 'Anyone in Texas can call.',
  eligibility_summary_es: 'Cualquier persona en Texas puede llamar.',
  eligibility_rules: {},
  documents_needed: [],
  how_to_apply_en: 'Dial 2-1-1 (or 1-877-541-7905) from any phone, or search online.',
  how_to_apply_es: 'Marque 2-1-1 (o 1-877-541-7905) desde cualquier teléfono, o busque en línea.',
  apply_url: 'https://www.211texas.org/',
  phone: '2-1-1',
  walk_in: false,
  apply_online: true,
  languages: ['English', 'Spanish'],
  cost: 'Free',
  coverage_type: 'national', // 2-1-1 can be dialed anywhere in the U.S.
  coverage_counties: [],
  source_url: 'https://www.211texas.org/',
  confidence: 'high',
  is_active: true,
  priority_weight: 0,
};

const TARGET_GROUPS = [
  // [rule key, how the user matches it]
  ['pregnant', (p) => p.situations.includes('pregnant')],
  ['child_under_5', (p) => p.child_under_5 === true],
  ['requires_children', (p) => (p.children_count ?? 0) > 0 || p.child_under_5 === true],
  ['senior', (p) => p.situations.includes('senior')],
  ['veteran_only', (p) => p.situations.includes('veteran')],
  ['disability', (p) => p.situations.includes('disability')],
  ['student', (p) => p.situations.includes('student')],
  ['unhoused', (p) => p.situations.includes('unhoused')],
];

const SOFT_BOOSTS = [
  ['job_loss', (p) => p.situations.includes('job_loss')],
  ['uninsured', (p) => p.situations.includes('uninsured')],
];

/** Normalize a user profile so matching never crashes on partial input. */
export function normalizeProfile(input = {}) {
  const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
  const arr = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  return {
    zip: typeof input.zip === 'string' ? input.zip.trim().slice(0, 5) : '',
    household_size: num(input.household_size),
    children_count: num(input.children_count),
    child_under_5: typeof input.child_under_5 === 'boolean' ? input.child_under_5 : null,
    income_range: typeof input.income_range === 'string' ? input.income_range : null,
    situations: arr(input.situations),
    needs: arr(input.needs),
    urgency: typeof input.urgency === 'string' ? input.urgency : null,
    language: input.language === 'es' ? 'es' : 'en',
  };
}

export function coversLocation(resource, place) {
  const type = resource.coverage_type;
  if (type === 'national') return true;
  // Everything else in the database is a Texas program.
  if (!place?.inTexas) return false;
  if (type === 'state') return true;
  const counties = resource.coverage_counties || [];
  if (!place?.counties?.length) return false;
  return counties.some((c) => place.counties.includes(c));
}

function incomeCheck(resource, profile) {
  const pct = resource.eligibility_rules?.max_income_pct_fpl;
  const range = INCOME_RANGES.find((r) => r.id === profile.income_range);
  if (!pct || !range || range.min === null || !profile.household_size) return null;
  const limit = (fplMonthly(profile.household_size) * pct) / 100;
  if (range.max <= limit) return { within: true, pct };
  if (range.min > limit) return { within: false, pct };
  return null; // range straddles the limit: unknown
}

/**
 * Score one resource for a profile.
 * @returns {null | {score:number, reasons:Array<{code:string, params?:object}>, matchedCategories:string[]}}
 *   null means the resource should not be shown.
 */
export function scoreResource(resource, profile, place) {
  if (resource.is_active === false) return null;
  if (!coversLocation(resource, place)) return null;

  const matchedCategories = (resource.categories || []).filter((c) => profile.needs.includes(c));
  if (profile.needs.length && !matchedCategories.length) return null;

  const rules = resource.eligibility_rules || {};
  const reasons = [];
  let score = 0;

  score += Math.min(matchedCategories.length, 2) * 3;
  if (matchedCategories.length) reasons.push({ code: 'category', params: { categories: matchedCategories } });

  // Targeted programs (e.g., WIC, senior centers, veteran services) only show when the user fits.
  const targets = TARGET_GROUPS.filter(([key]) => rules[key] === true);
  if (targets.length) {
    const hits = targets.filter(([, fits]) => fits(profile)).map(([key]) => key);
    if (!hits.length) return null;
    score += 2 * Math.min(hits.length, 2);
    reasons.push({ code: 'group', params: { groups: hits } });
  }

  for (const [key, fits] of SOFT_BOOSTS) {
    if (rules[key] === true && fits(profile)) {
      score += 2;
      reasons.push({ code: 'group', params: { groups: [key] } });
    }
  }

  const income = incomeCheck(resource, profile);
  if (income?.within) {
    score += 2;
    reasons.push({ code: 'income_within', params: { pct: income.pct } });
  } else if (income && !income.within) {
    score -= 4;
    reasons.push({ code: 'income_above', params: { pct: income.pct } });
  }

  if (['county', 'city'].includes(resource.coverage_type)) {
    score += 2;
    reasons.push({ code: 'local', params: { county: place?.county } });
  } else if (resource.coverage_type === 'region') {
    score += 1;
    reasons.push({ code: 'local', params: { county: place?.county } });
  } else {
    reasons.push({ code: 'statewide' });
  }

  if (profile.urgency === 'today' && (resource.walk_in || resource.phone)) score += 1;
  if (resource.confidence === 'high') score += 0.5;
  score += Number(resource.priority_weight) || 0;

  return { score, reasons, matchedCategories };
}

export function matchLevel(score) {
  if (score >= 8) return 'very_likely';
  if (score >= 5) return 'possibly';
  return 'worth_checking';
}

/**
 * Match resources to a profile.
 * @returns {{place, results: Array<{resource, score, level, reasons, matchedCategories, distance}>,
 *   byCategory: Record<string, string[]>, outOfTexas:boolean, invalidZip:boolean}}
 */
export function matchResources(resources, rawProfile, { perCategory = 6, max = LIMITS.maxResourcesInPlan } = {}) {
  const profile = normalizeProfile(rawProfile);
  const place = lookupZip(profile.zip);
  const pool = resources.some((r) => r.id === FALLBACK_211.id) ? resources : [...resources, FALLBACK_211];

  const scored = [];
  for (const resource of pool) {
    const s = scoreResource(resource, profile, place);
    if (!s) continue;
    const loc = resourceLocation(resource);
    const distance = loc && place.lat != null ? distanceMiles(place, loc) : null;
    scored.push({ resource, ...s, level: matchLevel(s.score), distance });
  }

  scored.sort((a, b) => b.score - a.score || (a.distance ?? 9999) - (b.distance ?? 9999) || a.resource.name.localeCompare(b.resource.name));

  // Keep the best few per requested category so one category cannot crowd out the others.
  const needs = profile.needs.length ? profile.needs : [...new Set(scored.flatMap((s) => s.resource.categories || []))];
  const chosen = new Map();
  const byCategory = {};
  for (const cat of needs) {
    byCategory[cat] = [];
    for (const s of scored) {
      if (byCategory[cat].length >= perCategory) break;
      if (!(s.resource.categories || []).includes(cat) || s.resource.id === FALLBACK_211.id) continue;
      byCategory[cat].push(s.resource.id);
      chosen.set(s.resource.id, s);
    }
  }

  let results = [...chosen.values()].sort((a, b) => b.score - a.score);
  if (results.length > max) results = results.slice(0, max);
  const kept = new Set(results.map((r) => r.resource.id));
  for (const cat of Object.keys(byCategory)) byCategory[cat] = byCategory[cat].filter((id) => kept.has(id));

  // 2-1-1 is always the last-resort fallback.
  const fallback = scored.find((s) => s.resource.id === FALLBACK_211.id);
  if (fallback) results.push({ ...fallback, level: 'worth_checking', fallback: true });

  return {
    profile,
    place,
    results,
    byCategory,
    invalidZip: !place.valid,
    outOfTexas: place.valid && !place.inTexas,
  };
}
