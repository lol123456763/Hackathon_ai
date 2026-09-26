// Deterministic program matching (spec 7A). Runs before and independently of any AI, so program
// cards render immediately and the app still works when the AI is slow or down.
import { LIMITS, LOW_INCOME_RANGES } from './constants.js';
import { lookupZip, distanceMiles, resourceLocation } from './zip.js';

const LOCALITY = { city: 0, county: 0, region: 1, state: 2, national: 3 };
const GENERAL_KEYS = new Set(['two_one_one', 'findhelp']);

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
    crisis_flag: input.crisis_flag === true,
  };
}

export function coversLocation(resource, place) {
  const type = resource.coverage_type;
  if (type === 'national') return true;
  if (!place?.valid) return false;
  if (type === 'state') return !resource.coverage_state || resource.coverage_state === place.state;
  // Local: ZIP prefix list (curated Austin programs) or Texas county list (researched resources).
  const prefixes = resource.coverage_zip_prefixes || [];
  if (prefixes.length && prefixes.includes(place.zip.slice(0, 3))) return true;
  const counties = resource.coverage_counties || [];
  return !!(place.counties?.length && counties.some((c) => place.counties.includes(c)));
}

function profileSignals(p) {
  const kids = p.children_count;
  return {
    needs_children: kids > 0 || p.child_under_5 === true,
    child_under_5: p.child_under_5 === true,
    pregnant: p.situations.includes('pregnant'),
    job_loss: p.situations.includes('job_loss'),
    veteran_only: p.situations.includes('veteran'),
    senior: p.situations.includes('senior'),
    disability: p.situations.includes('disability'),
    student: p.situations.includes('student'),
    unhoused: p.situations.includes('unhoused'),
    // Unknown or "prefer not to say" is never penalized (treated as possibly low income).
    low_income: p.income_range === null || LOW_INCOME_RANGES.includes(p.income_range),
  };
}

/** True when a hard requirement is clearly NOT met (only when we actually know). */
function clearlyExcluded(s, p, has) {
  if (s.veteran_only && !has.veteran_only) return true;
  if (s.needs_children && p.children_count === 0 && p.child_under_5 !== true) return true;
  // Young-child / pregnancy programs (WIC, Head Start): exclude only when we know neither applies.
  const youngTarget = s.child_under_5 || s.pregnant;
  if (youngTarget) {
    const knowsNoYoungChild = p.child_under_5 === false || p.children_count === 0;
    if (knowsNoYoungChild && !has.pregnant && !(s.child_under_5 && has.child_under_5)) return true;
  }
  for (const k of ['senior', 'student', 'unhoused', 'disability']) {
    if (s[k] && !has[k]) return true;
  }
  return false;
}

export function scoreResource(resource, profile, place, has) {
  if (resource.is_active === false) return null;
  if (!coversLocation(resource, place)) return null;
  const cats = resource.categories || [];
  const matchedCategories = cats.filter((c) => profile.needs.includes(c));
  const crisisOk = resource.is_crisis && (profile.crisis_flag || profile.needs.includes('mental_health'));
  const s = resource.signals || {};
  // Curated programs can also match on strong family signals alone (e.g. CHIP and Head Start for a
  // family with young kids, even if they only asked about food).
  const strong = ['child_under_5', 'needs_children', 'pregnant', 'job_loss', 'veteran_only', 'senior'].filter((k) => s[k] === true && has[k]);
  const signalOnly = !matchedCategories.length && strong.length > 0 && resource.origin !== 'research' && !GENERAL_KEYS.has(resource.program_key);
  if (!matchedCategories.length && !crisisOk && !signalOnly) return null;
  if (clearlyExcluded(s, profile, has)) return null;

  const reasons = [];
  // General directories (2-1-1, Findhelp) and very broad resources count one category at most.
  const general = GENERAL_KEYS.has(resource.program_key) || cats.length >= 6;
  // Researched local listings count their first category fully and extra categories as +1, so broad
  // community centers do not outrank the core programs for a specific need.
  let score = general ? 3 * Math.min(matchedCategories.length, 1) : resource.origin === 'research' ? (matchedCategories.length ? 3 + Math.min(matchedCategories.length - 1, 1) : 0) : 3 * Math.min(matchedCategories.length, 2);
  if (matchedCategories.length) reasons.push({ code: 'category', params: { categories: matchedCategories } });

  const hits = Object.keys(s).filter((k) => s[k] === true && has[k] && k !== 'low_income');
  score += 2 * hits.length;
  if (hits.length) reasons.push({ code: 'signals', params: { signals: hits } });
  if (s.low_income && has.low_income) {
    score += 2;
    reasons.push({ code: 'signals', params: { signals: ['low_income'] } });
  }
  if (['city', 'county', 'region'].includes(resource.coverage_type)) reasons.push({ code: 'local', params: { county: place?.county || null } });
  else if (resource.coverage_type === 'state') reasons.push({ code: 'statewide' });
  if (crisisOk) score += 4;
  if (profile.urgency === 'today' && resource.phone) score += 0.5;
  score += Number(resource.priority_weight) || 0;
  return { score, reasons, matchedCategories, signalOnly };
}

export function matchResources(resources, rawProfile, { perCategory = 6, max = LIMITS.maxResourcesInPlan } = {}) {
  const profile = normalizeProfile(rawProfile);
  const place = lookupZip(profile.zip);
  const has = profileSignals(profile);

  const scored = [];
  for (const resource of resources) {
    const s = scoreResource(resource, profile, place, has);
    if (!s) continue;
    const loc = resourceLocation(resource);
    scored.push({ resource, ...s, distance: loc && place.lat != null ? distanceMiles(place, loc) : null });
  }

  // De-duplicate by program_key: keep the most local version (e.g. SNAP via Your Texas Benefits over national SNAP).
  const byKey = new Map();
  const unique = [];
  for (const s of scored) {
    const key = s.resource.program_key;
    if (!key) {
      unique.push(s);
      continue;
    }
    const prev = byKey.get(key);
    const better = !prev || LOCALITY[s.resource.coverage_type] < LOCALITY[prev.resource.coverage_type] || (LOCALITY[s.resource.coverage_type] === LOCALITY[prev.resource.coverage_type] && s.score > prev.score);
    if (better) byKey.set(key, s);
  }
  unique.push(...byKey.values());

  const fallbacks = unique.filter((s) => s.resource.program_key === 'two_one_one');
  let ranked = unique.filter((s) => s.resource.program_key !== 'two_one_one');
  ranked.sort((a, b) => b.score - a.score || (a.distance ?? 9999) - (b.distance ?? 9999) || a.resource.name.localeCompare(b.resource.name));

  // Keep the best few per requested category so one category cannot crowd out the others.
  const needs = profile.needs.length ? profile.needs : [...new Set(ranked.flatMap((s) => s.resource.categories || []))];
  const chosen = new Map();
  for (const s of ranked.filter((x) => x.resource.is_crisis && profile.crisis_flag)) chosen.set(s.resource.id, s);
  // Round-robin across categories: each round adds the next-best unchosen resource for every need.
  const counts = Object.fromEntries(needs.map((c) => [c, 0]));
  for (let round = 0; round < perCategory; round++) {
    for (const cat of needs) {
      const next = ranked.find((s) => !chosen.has(s.resource.id) && (s.resource.categories || []).includes(cat));
      if (next) {
        chosen.set(next.resource.id, next);
        counts[cat]++;
      }
    }
  }
  for (const s of ranked.filter((x) => x.signalOnly && !chosen.has(x.resource.id)).slice(0, 6)) chosen.set(s.resource.id, s);
  ranked = [...chosen.values()].sort((a, b) => b.score - a.score).slice(0, max);

  // Labels by thirds of the ranked list.
  const third = Math.ceil(ranked.length / 3);
  ranked.forEach((s, i) => {
    s.level = i < third ? 'very_likely' : i < 2 * third ? 'possibly' : 'worth_checking';
  });

  const byCategory = {};
  for (const cat of needs) byCategory[cat] = ranked.filter((s) => s.matchedCategories.includes(cat)).map((s) => s.resource.id);

  // 2-1-1 is always the last-resort fallback (the most local version).
  const results = [...ranked];
  let f = fallbacks.sort((a, b) => LOCALITY[a.resource.coverage_type] - LOCALITY[b.resource.coverage_type])[0];
  if (!f) {
    const r = resources.filter((x) => x.program_key === 'two_one_one' && x.is_active !== false && coversLocation(x, place)).sort((a, b) => LOCALITY[a.coverage_type] - LOCALITY[b.coverage_type])[0];
    if (r) f = { resource: r, score: 0, reasons: [], matchedCategories: [], distance: null };
  }
  if (f) results.push({ ...f, level: 'worth_checking', fallback: true });

  return { profile, place, results, byCategory, invalidZip: !place.valid, outOfTexas: place.valid && place.state !== 'TX' };
}
