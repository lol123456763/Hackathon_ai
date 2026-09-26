// BenefitBridge application service. Pure logic with injected dependencies, so the exact same code
// runs inside Base44 backend functions (with the Base44 SDK) and in the browser's offline/local
// mode (with bundled data). See base44/functions/*/entry.ts and src/api/localBackend.js.
import { CATEGORIES, SITUATIONS, INCOME_RANGE_IDS, URGENCIES, LIMITS } from './constants.js';
import { matchResources, normalizeProfile, FALLBACK_211 } from './matching.js';
import { buildRulePlan, sanitizeAiPlan } from './plan.js';
import { estimateBenefits } from './benefits.js';
import { mergeExtraction, extractSituation } from './extract.js';
import {
  EXTRACT_SCHEMA, extractPrompt, PLAN_SCHEMA, planPrompt, resourceForAi,
  EXPLAIN_SCHEMA, explainPrompt, FOLLOWUP_SCHEMA, followupPrompt,
} from './prompts.js';

export class ServiceError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

const PLAN_TTL_DAYS = 90;
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

export function randomToken(bytes = 18) {
  const a = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(a);
  let s = '';
  for (const b of a) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function withTimeout(promise, ms) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('timeout')), ms); })]);
  } finally {
    clearTimeout(timer);
  }
}

// Remove admin-only fields before sending resources to the browser.
export function publicResource(r) {
  if (!r) return r;
  // eslint-disable-next-line no-unused-vars
  const { notes, created_by, created_by_id, updated_date, is_sample, ...rest } = r;
  return rest;
}

function assertToken(token) {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) throw new ServiceError(400, 'invalid_token');
}

function language(v) {
  return v === 'es' ? 'es' : 'en';
}

// ---------------------------------------------------------------------------------------------

/** Turn free text into a partial profile (AI when available, always merged with rule-based parsing). */
export async function extract({ text }, deps) {
  const clean = String(text ?? '').trim().slice(0, LIMITS.situationText);
  if (!clean) throw new ServiceError(400, 'empty_text');
  let ai = null;
  if (deps.invokeLLM) {
    try {
      ai = await withTimeout(deps.invokeLLM({ prompt: extractPrompt(clean), response_json_schema: EXTRACT_SCHEMA }), 20000);
    } catch (e) {
      deps.log?.('extract: AI failed, using rules', e?.message);
    }
  }
  const merged = ai
    ? mergeExtraction(ai, clean, { categories: CATEGORIES, situations: SITUATIONS, incomeRanges: INCOME_RANGE_IDS, urgencies: URGENCIES })
    : extractSituation(clean);
  return { ...merged, source: ai ? 'ai' : 'rules' };
}

function serializeMatch(m) {
  return {
    slug: m.resource.id,
    level: m.level,
    score: Math.round(m.score * 10) / 10,
    distance: m.distance == null ? null : Math.round(m.distance * 10) / 10,
    matched_categories: m.matchedCategories,
    reasons: m.reasons,
    fallback: !!m.fallback,
  };
}

async function loadResourceMap(deps) {
  const list = await deps.loadResources();
  const map = new Map(list.map((r) => [r.id, r]));
  if (!map.has(FALLBACK_211.id)) map.set(FALLBACK_211.id, FALLBACK_211);
  return map;
}

/** Build the view model the site renders for a plan. */
function toView(session, resourceMap, match = null) {
  const resources = {};
  for (const m of session.matches || []) {
    const r = resourceMap.get(m.slug);
    if (r) resources[m.slug] = publicResource(r);
  }
  return {
    token: session.share_token,
    language: session.language,
    profile: session.profile,
    county: session.county || null,
    place: match ? { zip: match.place.zip, county: match.place.county, valid: match.place.valid, inTexas: match.place.inTexas, approximate: match.place.approximate, lat: match.place.lat, lng: match.place.lng } : null,
    matches: (session.matches || []).filter((m) => resources[m.slug]),
    resources,
    action_plan: session.action_plan,
    plan_source: session.plan_source,
    estimates: session.estimates || [],
    checklist_state: session.checklist_state || {},
    saved_resources: session.saved_resources || [],
    created_date: session.created_date || null,
  };
}

/** Match resources, build an instant rule-based plan, save it, and return the view. */
export async function createPlan({ profile: rawProfile, language: lang }, deps) {
  const profile = normalizeProfile(rawProfile);
  if (!/^\d{5}$/.test(profile.zip)) throw new ServiceError(400, 'invalid_zip');
  profile.needs = profile.needs.filter((n) => CATEGORIES.includes(n));
  profile.situations = profile.situations.filter((s) => SITUATIONS.includes(s));
  if (!INCOME_RANGE_IDS.includes(profile.income_range)) profile.income_range = null;
  if (!URGENCIES.includes(profile.urgency)) profile.urgency = null;
  const lng = language(lang);

  const resourceMap = await loadResourceMap(deps);
  const match = matchResources([...resourceMap.values()], profile);
  const plan = buildRulePlan(match, lng);
  const now = deps.now ? deps.now() : new Date();

  // eslint-disable-next-line no-unused-vars
  const { language: _omit, ...storedProfile } = match.profile;
  const session = await deps.plans.create({
    share_token: randomToken(),
    language: lng,
    profile: storedProfile,
    county: match.place.county || null,
    matches: match.results.map(serializeMatch),
    action_plan: plan,
    plan_source: 'rules',
    estimates: estimateBenefits(match.profile),
    checklist_state: {},
    saved_resources: [],
    expires_at: addDays(now, PLAN_TTL_DAYS),
  });
  return toView(session, resourceMap, match);
}

async function getSession(token, deps) {
  assertToken(token);
  const session = await deps.plans.getByToken(token);
  if (!session) throw new ServiceError(404, 'plan_not_found');
  return session;
}

/** Ask the AI for a personalized plan and store it (keeps the rule-based plan if AI fails). */
export async function upgradePlanWithAi({ token, language: lang }, deps) {
  const session = await getSession(token, deps);
  const resourceMap = await loadResourceMap(deps);
  const lng = lang ? language(lang) : session.language;
  if (!deps.invokeLLM) return toView(session, resourceMap);

  const match = matchResources([...resourceMap.values()], { ...session.profile, language: lng });
  const forAi = match.results.slice(0, LIMITS.maxResourcesForAi).map(resourceForAi);
  const allowed = forAi.map((r) => r.resource_id).concat(FALLBACK_211.id);

  let aiPlan = null;
  for (let attempt = 0; attempt < 2 && !aiPlan; attempt++) {
    try {
      const raw = await withTimeout(
        deps.invokeLLM({ prompt: planPrompt(match.profile, match.place, forAi, lng), response_json_schema: PLAN_SCHEMA }),
        45000,
      );
      aiPlan = sanitizeAiPlan(raw, allowed);
    } catch (e) {
      deps.log?.(`plan: AI attempt ${attempt + 1} failed`, e?.message);
    }
  }
  if (!aiPlan) return toView(session, resourceMap, match);

  const updated = await deps.plans.update(session.id, {
    action_plan: aiPlan,
    plan_source: 'ai',
    language: lng,
    checklist_state: {},
  });
  return toView({ ...session, ...updated, action_plan: aiPlan, plan_source: 'ai', language: lng, checklist_state: {} }, resourceMap, match);
}

/** Re-create the rule-based plan in another language (instant) — used when the user switches language. */
export async function relocalizePlan({ token, language: lang }, deps) {
  const session = await getSession(token, deps);
  const resourceMap = await loadResourceMap(deps);
  const lng = language(lang);
  const match = matchResources([...resourceMap.values()], { ...session.profile, language: lng });
  const plan = buildRulePlan(match, lng);
  await deps.plans.update(session.id, { action_plan: plan, plan_source: 'rules', language: lng, checklist_state: {} });
  return toView({ ...session, action_plan: plan, plan_source: 'rules', language: lng, checklist_state: {} }, resourceMap, match);
}

export async function getPlan({ token }, deps) {
  const session = await getSession(token, deps);
  const resourceMap = await loadResourceMap(deps);
  const match = matchResources([], session.profile); // place info only
  return toView(session, resourceMap, match);
}

export async function updateProgress({ token, checklist_state, saved_resources }, deps) {
  const session = await getSession(token, deps);
  const patch = {};
  if (checklist_state && typeof checklist_state === 'object' && !Array.isArray(checklist_state)) {
    const clean = {};
    for (const [k, v] of Object.entries(checklist_state).slice(0, 200)) {
      if (typeof k === 'string' && k.length <= 200) clean[k] = v === true;
    }
    patch.checklist_state = clean;
  }
  if (Array.isArray(saved_resources)) {
    const known = new Set((session.matches || []).map((m) => m.slug));
    patch.saved_resources = [...new Set(saved_resources.filter((s) => typeof s === 'string' && known.has(s)))];
  }
  if (!Object.keys(patch).length) throw new ServiceError(400, 'nothing_to_update');
  await deps.plans.update(session.id, patch);
  return { ok: true, ...patch };
}

export async function explainResource({ slug, language: lang }, deps) {
  if (typeof slug !== 'string' || slug.length > 200) throw new ServiceError(400, 'invalid_slug');
  const resourceMap = await loadResourceMap(deps);
  const r = resourceMap.get(slug);
  if (!r) throw new ServiceError(404, 'resource_not_found');
  const lng = language(lang);
  if (deps.invokeLLM) {
    try {
      const out = await withTimeout(deps.invokeLLM({ prompt: explainPrompt(r, lng), response_json_schema: EXPLAIN_SCHEMA }), 20000);
      const bullets = (out?.bullets || []).filter((b) => typeof b === 'string' && b.trim()).map((b) => b.trim().slice(0, 300)).slice(0, 3);
      if (bullets.length) return { bullets, source: 'ai' };
    } catch (e) {
      deps.log?.('explain: AI failed', e?.message);
    }
  }
  // Fallback: the stored plain-language fields.
  const pick = (en, es) => (lng === 'es' && es ? es : en);
  return {
    bullets: [pick(r.description_en, r.description_es), pick(r.eligibility_summary_en, r.eligibility_summary_es), pick(r.how_to_apply_en, r.how_to_apply_es)].filter(Boolean),
    source: 'rules',
  };
}

export async function askFollowup({ token, question, history, language: lang }, deps) {
  const q = String(question ?? '').trim().slice(0, LIMITS.followupQuestion);
  if (!q) throw new ServiceError(400, 'empty_question');
  const session = await getSession(token, deps);
  const resourceMap = await loadResourceMap(deps);
  const lng = language(lang);
  const resources = (session.matches || [])
    .slice(0, LIMITS.maxResourcesForAi)
    .map((m) => resourceMap.get(m.slug) && resourceForAi({ resource: resourceMap.get(m.slug), level: m.level, distance: m.distance }))
    .filter(Boolean);
  const hist = (Array.isArray(history) ? history : [])
    .slice(-LIMITS.followupHistory)
    .map((h) => ({ role: h?.role === 'assistant' ? 'assistant' : 'user', text: String(h?.text ?? '').slice(0, 800) }));

  const crisis = extractSituation(q).crisis_flag;
  if (!deps.invokeLLM) {
    return { answer: null, resource_ids: [], crisis, source: 'unavailable' };
  }
  try {
    const out = await withTimeout(
      deps.invokeLLM({ prompt: followupPrompt({ profile: session.profile, resources, plan: session.action_plan, history: hist, question: q, language: lng }), response_json_schema: FOLLOWUP_SCHEMA }),
      30000,
    );
    const allowed = new Set(resources.map((r) => r.resource_id).concat(FALLBACK_211.id));
    return {
      answer: String(out?.answer ?? '').trim().slice(0, 2000) || null,
      resource_ids: (out?.resource_ids || []).filter((id) => allowed.has(id)).slice(0, 5),
      crisis,
      source: 'ai',
    };
  } catch (e) {
    deps.log?.('followup: AI failed', e?.message);
    return { answer: null, resource_ids: [], crisis, source: 'unavailable' };
  }
}

/** Aggregate, anonymous statistics for the admin dashboard. */
export function computeStats(sessions, feedback, resources, today = new Date()) {
  const perDay = {};
  const needs = {};
  const counties = {};
  const zips = {};
  let aiPlans = 0;
  for (const s of sessions) {
    const day = String(s.created_date || '').slice(0, 10);
    if (day) perDay[day] = (perDay[day] || 0) + 1;
    for (const n of s.profile?.needs || []) needs[n] = (needs[n] || 0) + 1;
    if (s.county) counties[s.county] = (counties[s.county] || 0) + 1;
    if (s.profile?.zip) zips[s.profile.zip] = (zips[s.profile.zip] || 0) + 1;
    if (s.plan_source === 'ai') aiPlans++;
  }
  const fbByResource = {};
  const ratings = { helpful: 0, not_helpful: 0, wrong_info: 0 };
  for (const f of feedback) {
    if (ratings[f.rating] !== undefined) ratings[f.rating]++;
    if (f.resource_slug && f.rating !== 'helpful') {
      fbByResource[f.resource_slug] ??= { not_helpful: 0, wrong_info: 0 };
      fbByResource[f.resource_slug][f.rating]++;
    }
  }
  const staleCutoff = new Date(today);
  staleCutoff.setUTCDate(staleCutoff.getUTCDate() - 180);
  const cutoff = staleCutoff.toISOString().slice(0, 10);
  const top = (obj, n = 10) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([key, count]) => ({ key, count }));
  return {
    totals: {
      plans: sessions.length,
      ai_plans: aiPlans,
      feedback: feedback.length,
      resources: resources.length,
      active_resources: resources.filter((r) => r.is_active !== false).length,
      stale_resources: resources.filter((r) => !r.verified_date || r.verified_date < cutoff).length,
    },
    plans_per_day: Object.entries(perDay).sort().slice(-30).map(([day, count]) => ({ day, count })),
    top_needs: top(needs),
    top_counties: top(counties),
    top_zips: top(zips),
    ratings,
    flagged_resources: Object.entries(fbByResource)
      .map(([slug, v]) => ({ slug, ...v, total: v.not_helpful + v.wrong_info }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20),
  };
}
