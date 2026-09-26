// Loop application service. Pure logic with injected dependencies, so the exact same code runs in the
// Base44 backend function (base44/functions/app) and in the browser's local mode (src/api/localBackend.js).
//
// deps = {
//   db: { list(entity, query?, sort?, limit?), create(entity, data), bulkCreate(entity, rows), update(entity, id, patch), deleteMany(entity, query) },
//   invokeLLM?: (params) => Promise<any>,   // Base44 InvokeLLM; absent in local mode
//   uploadImage?: (dataUrl) => Promise<string|null>,  // returns a public URL for image input
//   waitUntil?: (promise) => void,           // finish work after the response (briefs)
//   now?: () => number, log?: (...args) => void,
// }
import { CATEGORIES, SITUATIONS, INCOME_RANGE_IDS, URGENCIES, LIMITS, REQUEST_TYPES, DEMO, LBS_PER_MEAL } from './constants.js';
import { lookupZip, distanceMiles } from './zip.js';
import { makeClock, formatTime, hhmmToMinutes, minutesToHhmm } from './time.js';
import { matchResources, normalizeProfile } from './matching.js';
import { buildRulePlan, sanitizeAiPlan } from './plan.js';
import { mergeExtraction, extractSituation, finalizeExtraction } from './extract.js';
import * as P from './prompts.js';
import { GOLDEN_OUTPUTS, goldenIntakeKey, isGoldenProfile, EXAMPLE_NOTE } from './golden.js';
import {
  pickupHubOptions, scoreDonationForRequest, estMinutes, chooseMode, missionEligibility, buddyRequired, withinWindow, creditedHours,
  computeImpact, mealsFromLbs, buildBag, randomCode, compatibleLbs,
} from './loop.js';
import { buildSeed, NS, SEEDED_ENTITIES } from './seed.js';
import { SAMPLE_IMPACT, SAMPLE_WEEK, SAMPLE_PULSE } from './data/neighborhood.js';

export class ServiceError extends Error {
  constructor(status, code, extra) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;
const lang = (v) => (v === 'es' ? 'es' : 'en');
const nowMs = (deps) => (deps.now ? deps.now() : Date.now());
const newKey = (prefix) => `${prefix}-${randomToken(9)}`;

export function randomToken(bytes = 24) {
  const a = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(a);
  let s = '';
  for (const b of a) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ------------------------------------------------------------------ AI helper

async function withTimeout(promise, ms) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('timeout')), ms); })]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Live AI first: one attempt, and one retry if the first fails fast — all within a 12-second budget.
 * `validate` turns raw output into a clean value or null. Returns null when the AI is unavailable.
 */
async function callAI(deps, params, validate, budgetMs = LIMITS.aiTimeoutMs) {
  if (!deps.invokeLLM) return null;
  const start = Date.now();
  for (let attempt = 0; attempt < 2; attempt++) {
    const remaining = budgetMs - (Date.now() - start);
    if (remaining < 1500) break;
    try {
      const raw = await withTimeout(deps.invokeLLM(params), remaining);
      const value = validate(typeof raw === 'string' ? safeJson(raw) : raw);
      if (value) return value;
    } catch (e) {
      deps.log?.('AI call failed', e?.message);
    }
  }
  return null;
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

async function golden(deps, key) {
  try {
    const rows = await deps.db.list('GoldenOutput', { key }, undefined, 1);
    if (rows[0]?.json) return typeof rows[0].json === 'string' ? JSON.parse(rows[0].json) : rows[0].json;
  } catch {
    /* fall through to built-in */
  }
  return GOLDEN_OUTPUTS[key] || null;
}

// ------------------------------------------------------------------ loading

async function loadDemo(deps) {
  const rows = await deps.db.list('DemoState', { key: 'demo' }, undefined, 1);
  return rows[0] || null;
}

async function ensureSeeded(deps) {
  let demo = await loadDemo(deps);
  if (!demo) {
    await resetDemo({}, deps);
    demo = await loadDemo(deps);
  }
  return demo;
}

async function clockFor(deps) {
  const demo = await ensureSeeded(deps);
  return { demo, clock: makeClock(Date.parse(demo.reset_at), nowMs(deps)) };
}

async function loadResources(deps) {
  if (deps.loadResources) return deps.loadResources();
  const rows = await deps.db.list('Resource', { is_active: true }, undefined, 5000);
  return rows.map((r) => ({ ...r, id: r.slug }));
}

async function world(deps) {
  const [hubs, givers, donations, missions, requests, volunteers, teams, events] = await Promise.all(
    ['Hub', 'Giver', 'Donation', 'Mission', 'HelpRequest', 'Volunteer', 'Team', 'Event'].map((e) => deps.db.list(e, { ns: NS }, undefined, 2000)),
  );
  const by = (list) => new Map(list.map((x) => [x.key, x]));
  return { hubs, givers, donations, missions, requests, volunteers, teams, events, hubBy: by(hubs), giverBy: by(givers), donationBy: by(donations), missionBy: by(missions), volunteerBy: by(volunteers), teamBy: by(teams) };
}

function activity(deps, type, en, es, place, extra = {}) {
  return deps.db.create('Activity', { ns: NS, type, message_en: en, message_es: es, lat: place?.lat ?? null, lng: place?.lng ?? null, at: new Date(nowMs(deps)).toISOString(), ...extra });
}

// ------------------------------------------------------------------ reset

export async function resetDemo(_args, deps) {
  const t0 = Date.now();
  await Promise.all(SEEDED_ENTITIES.map((e) => deps.db.deleteMany(e, { ns: NS })));
  const seed = buildSeed(nowMs(deps));
  await Promise.all(Object.entries(seed).filter(([, rows]) => rows.length).map(([e, rows]) => deps.db.bulkCreate(e, rows)));
  // Golden outputs are only created if missing, so re-saved (reviewed) outputs survive resets.
  const existing = await deps.db.list('GoldenOutput', {}, undefined, 100).catch(() => []);
  const have = new Set(existing.map((g) => g.key));
  const missing = Object.entries(GOLDEN_OUTPUTS).filter(([k]) => !have.has(k)).map(([key, json]) => ({ key, json }));
  if (missing.length) await deps.db.bulkCreate('GoldenOutput', missing).catch(() => {});
  return { ok: true, ms: Date.now() - t0 };
}

// ------------------------------------------------------------------ 6A intake

export async function extract({ text }, deps) {
  const clean = String(text ?? '').trim().slice(0, LIMITS.situationText);
  if (!clean) throw new ServiceError(400, 'empty_text');
  const merge = (ai) => mergeExtraction(ai, clean, { categories: CATEGORIES, situations: SITUATIONS, incomeRanges: INCOME_RANGE_IDS, urgencies: URGENCIES });
  let out = null;
  let source = 'rules';
  const ai = await callAI(deps, { prompt: P.extractPrompt(clean), response_json_schema: P.EXTRACT_SCHEMA }, (x) => (x && Array.isArray(x.needs) ? x : null));
  if (ai) {
    out = merge(ai);
    source = 'ai';
  } else {
    const gk = goldenIntakeKey(clean);
    if (gk && deps.invokeLLM) {
      out = merge(await golden(deps, gk));
      source = 'golden';
    } else {
      out = extractSituation(clean);
    }
  }
  return { ...finalizeExtraction(out), source };
}

// ------------------------------------------------------------------ plans

function profileFrom(raw) {
  const p = normalizeProfile(raw);
  p.needs = p.needs.filter((n) => CATEGORIES.includes(n));
  p.situations = p.situations.filter((s) => SITUATIONS.includes(s));
  if (!INCOME_RANGE_IDS.includes(p.income_range)) p.income_range = null;
  if (!URGENCIES.includes(p.urgency)) p.urgency = null;
  p.food_prefs = (Array.isArray(raw?.food_prefs) ? raw.food_prefs : []).filter((f) => ['vegetarian', 'no_pork', 'halal'].includes(f));
  return p;
}

function tonightContext(profile, place, hubs, clock) {
  const wantsTonight = profile.urgency === 'today' && profile.needs.includes('food');
  if (!wantsTonight || !place.valid || place.lat == null) return { available: false, networkActive: false, hubs: [] };
  const options = pickupHubOptions(hubs, place, clock, 19 * 60);
  const networkActive = hubs.some((h) => distanceMiles(place, h) <= DEMO.networkRadiusMi);
  return { available: options.length > 0, networkActive, hubs: options.map((o) => ({ key: o.hub.key, distance: Math.round(o.distance * 10) / 10 })) };
}

function publicResource(r) {
  if (!r) return r;
  // eslint-disable-next-line no-unused-vars
  const { notes, created_by, created_by_id, updated_date, ns, ...rest } = r;
  return rest;
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

async function planView(session, deps, extras = {}) {
  const resources = await loadResources(deps);
  const map = new Map(resources.map((r) => [r.id, r]));
  const res = {};
  for (const m of session.matches || []) if (map.has(m.slug)) res[m.slug] = publicResource(map.get(m.slug));
  const place = lookupZip(session.profile?.zip);
  let request = null;
  if (session.request_key) {
    const rows = await deps.db.list('HelpRequest', { key: session.request_key }, undefined, 1);
    if (rows[0]) request = await requestView(rows[0], deps);
  }
  return {
    token: session.share_token,
    language: session.language,
    profile: session.profile,
    place: { zip: place.zip, county: place.county, state: place.state, valid: place.valid, lat: place.lat, lng: place.lng, approximate: place.approximate },
    matches: (session.matches || []).filter((m) => res[m.slug]),
    resources: res,
    plan: session.plan,
    plan_source: session.plan_source,
    tonight: session.tonight || { available: false, hubs: [] },
    checklist_state: session.checklist_state || {},
    request,
    created_date: session.created_at,
    ...extras,
  };
}

export async function createPlan({ profile: raw, language }, deps) {
  const profile = profileFrom(raw);
  if (!lookupZip(profile.zip).valid) throw new ServiceError(400, 'invalid_zip');
  const lng = lang(language);
  const { demo, clock } = await clockFor(deps);
  const [resources, hubs] = await Promise.all([loadResources(deps), deps.db.list('Hub', { ns: NS }, undefined, 100)]);
  const match = matchResources(resources, profile);
  const tonight = tonightContext(profile, match.place, hubs, clock);
  const plan = buildRulePlan(match, lng, { tonightAvailable: tonight.available });
  const session = await deps.db.create('PlanSession', {
    ns: NS,
    share_token: randomToken(),
    language: lng,
    profile: { ...match.profile },
    county: match.place.county || null,
    matches: match.results.map(serializeMatch),
    plan,
    plan_source: 'rules',
    tonight,
    checklist_state: {},
    request_key: null,
    created_at: new Date(nowMs(deps)).toISOString(),
  });
  await deps.db.update('DemoState', demo.id, { plans_since_reset: (demo.plans_since_reset || 0) + 1 });
  const W = { food: ['food', 'comida'], housing: ['rent', 'renta'], utilities: ['electric bill', 'factura de luz'], healthcare: ['health care', 'salud'], school_childcare: ['school & child care', 'escuela y cuidado de niños'], employment: ['jobs', 'empleo'], transportation: ['transportation', 'transporte'], cash_assistance: ['cash help', 'ayuda en efectivo'], legal: ['legal help', 'ayuda legal'], mental_health: ['mental health', 'salud mental'] };
  const words = (i) => profile.needs.map((n) => W[n]?.[i]).filter(Boolean).join(', ');
  const who = profile.household_size ? [`A family of ${profile.household_size}`, `Una familia de ${profile.household_size}`] : ['A neighbor', 'Un vecino'];
  await activity(deps, 'plan', `${who[0]} built a plan${words(0) ? `: ${words(0)}` : ''}`, `${who[1]} creó un plan${words(1) ? `: ${words(1)}` : ''}`, null);
  return planView(session, deps);
}

async function getSession(token, deps) {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) throw new ServiceError(400, 'invalid_token');
  const rows = await deps.db.list('PlanSession', { share_token: token }, undefined, 1);
  if (!rows[0]) throw new ServiceError(404, 'plan_not_found');
  return rows[0];
}

export async function getPlan({ token }, deps) {
  return planView(await getSession(token, deps), deps);
}

/** AI plan (6B), live first; golden plan for the demo family if the AI fails or is slow; else keep rules. */
export async function personalizePlan({ token, language }, deps) {
  const session = await getSession(token, deps);
  const lng = language ? lang(language) : session.language;
  const { clock } = await clockFor(deps);
  const [resources, hubs] = await Promise.all([loadResources(deps), deps.db.list('Hub', { ns: NS }, undefined, 100)]);
  const match = matchResources(resources, session.profile);
  const tonight = tonightContext(match.profile, match.place, hubs, clock);
  const forAi = match.results.slice(0, LIMITS.maxResourcesForAi).map((m) => P.resourceForAi(m, lng));
  const allowed = match.results.map((m) => m.resource.id);
  const hubInfo = tonight.hubs.map((h) => ({ hub_id: h.key, name: hubs.find((x) => x.key === h.key)?.name, distance_mi: h.distance }));

  let plan = await callAI(
    deps,
    { prompt: P.planPrompt({ profile: match.profile, place: match.place, resources: forAi, hubs: hubInfo, networkActive: tonight.networkActive, language: lng }), response_json_schema: P.PLAN_SCHEMA },
    (x) => sanitizeAiPlan(x, allowed, { tonightAvailable: tonight.available }),
  );
  let source = 'ai';
  if (!plan && deps.invokeLLM && isGoldenProfile(match.profile)) {
    plan = sanitizeAiPlan(await golden(deps, `plan_${lng}`), allowed, { tonightAvailable: tonight.available });
    source = 'golden';
  }
  if (!plan) {
    plan = buildRulePlan(match, lng, { tonightAvailable: tonight.available });
    source = 'rules';
  }
  if (plan.tonight?.show && !plan.tonight.message) plan.tonight.message = buildRulePlan(match, lng, { tonightAvailable: true }).tonight.message;
  plan.source = source === 'golden' ? 'ai' : source;
  await deps.db.update('PlanSession', session.id, { plan, plan_source: plan.source, language: lng, tonight, checklist_state: session.language === lng ? session.checklist_state : {} });
  return planView({ ...session, plan, plan_source: plan.source, language: lng, tonight, checklist_state: session.language === lng ? session.checklist_state : {} }, deps);
}

export async function updateProgress({ token, checklist_state }, deps) {
  const session = await getSession(token, deps);
  if (!checklist_state || typeof checklist_state !== 'object' || Array.isArray(checklist_state)) throw new ServiceError(400, 'nothing_to_update');
  const clean = {};
  for (const [k, v] of Object.entries(checklist_state).slice(0, 200)) if (k.length <= 120) clean[k] = v === true;
  await deps.db.update('PlanSession', session.id, { checklist_state: clean });
  return { ok: true };
}

export async function explainResource({ slug, language }, deps) {
  if (typeof slug !== 'string' || slug.length > 200) throw new ServiceError(400, 'invalid_slug');
  const r = (await loadResources(deps)).find((x) => x.id === slug);
  if (!r) throw new ServiceError(404, 'resource_not_found');
  const lng = lang(language);
  const ai = await callAI(deps, { prompt: P.explainPrompt(r, lng), response_json_schema: P.EXPLAIN_SCHEMA }, (x) => {
    const b = (x?.bullets || []).filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim().slice(0, 300)).slice(0, 3);
    return b.length ? b : null;
  });
  if (ai) return { bullets: ai, source: 'ai' };
  const f = (k) => (lng === 'es' && r[`${k}_es`]) || r[`${k}_en`];
  return { bullets: [f('what_it_gives'), f('who_its_for'), f('how_to_apply')].filter(Boolean), source: 'rules' };
}

// ------------------------------------------------------------------ requests (neighbor)

async function requestView(r, deps) {
  const hubs = await deps.db.list('Hub', { key: r.hub_key }, undefined, 1);
  const hub = hubs[0];
  return {
    key: r.key, code: r.code, type: r.type, status: r.status, household_size: r.household_size, food_prefs: r.food_prefs || [], needed_by: r.needed_by, pickup_by: r.pickup_by,
    hub: hub ? { key: hub.key, name: hub.name, area_label: hub.area_label, hours_text_en: hub.hours_text_en, hours_text_es: hub.hours_text_es, lat: hub.lat, lng: hub.lng } : null,
    bag_en: r.bag_en || null, bag_es: r.bag_es || null, ready_at: r.ready_at || null, picked_up_at: r.picked_up_at || null,
    thank_you_sent: !!(r.thank_you_original || r.thank_you_fixed), history: r.history || [],
  };
}

export async function requestOptions({ token }, deps) {
  const session = await getSession(token, deps);
  const { clock } = await clockFor(deps);
  const hubs = await deps.db.list('Hub', { ns: NS }, undefined, 100);
  const place = lookupZip(session.profile.zip);
  const opts = pickupHubOptions(hubs, place, clock, 19 * 60).map((o) => ({
    key: o.hub.key, name: o.hub.name, area_label: o.hub.area_label, hours_text_en: o.hub.hours_text_en, hours_text_es: o.hub.hours_text_es,
    distance: Math.round(o.distance * 10) / 10, close: minutesToHhmm(o.today.close),
  }));
  return { hubs: opts, household_size: session.profile.household_size || 1, food_prefs: session.profile.food_prefs || [], now: clock.now };
}

export async function postRequest({ token, type, household_size, food_prefs, allergy_note, hub_key, needed_by, language }, deps) {
  const session = await getSession(token, deps);
  if (session.request_key) {
    const existing = await deps.db.list('HelpRequest', { key: session.request_key }, undefined, 1);
    if (existing[0] && !['cancelled', 'expired', 'picked_up'].includes(existing[0].status)) throw new ServiceError(409, 'request_exists');
  }
  if (!REQUEST_TYPES.includes(type)) throw new ServiceError(400, 'invalid_type');
  const { demo, clock } = await clockFor(deps);
  const hubs = await deps.db.list('Hub', { ns: NS }, undefined, 100);
  const place = lookupZip(session.profile.zip);
  const options = pickupHubOptions(hubs, place, clock, 19 * 60);
  const choice = options.find((o) => o.hub.key === hub_key) || options[0];
  if (!choice) throw new ServiceError(400, 'no_hub_nearby');
  const size = Math.min(12, Math.max(1, Math.round(Number(household_size) || session.profile.household_size || 1)));
  const prefs = (Array.isArray(food_prefs) ? food_prefs : []).filter((p) => ['vegetarian', 'no_pork', 'halal', 'allergy'].includes(p));
  const needBy = hhmmToMinutes(needed_by) ?? 19 * 60;
  const code = `LOOP-${demo.next_request_seq || 27}`;
  const hub = choice.hub;
  const req = await deps.db.create('HelpRequest', {
    ns: NS,
    key: newKey('req'),
    code,
    plan_token: session.share_token,
    type,
    household_size: size,
    food_prefs: prefs,
    allergy_note: prefs.includes('allergy') ? String(allergy_note || '').slice(0, 80) : '',
    hub_key: hub.key,
    needed_by: minutesToHhmm(Math.min(needBy, choice.today.close)),
    pickup_by: minutesToHhmm(choice.today.close),
    language: lang(language),
    status: 'posted',
    history: [{ status: 'posted', at: clock.now }],
    created_at: new Date(nowMs(deps)).toISOString(),
  });
  await Promise.all([
    deps.db.update('DemoState', demo.id, { next_request_seq: (demo.next_request_seq || 27) + 1 }),
    deps.db.update('PlanSession', session.id, { request_key: req.key }),
    activity(deps, 'request', `A family of ${size} asked neighbors for help at ${hub.name}`, `Una familia de ${size} pidió ayuda a sus vecinos en ${hub.name}`, hub),
  ]);
  await rematch(deps);
  return getPlan({ token }, deps);
}

export async function cancelRequest({ token }, deps) {
  const session = await getSession(token, deps);
  const rows = session.request_key ? await deps.db.list('HelpRequest', { key: session.request_key }, undefined, 1) : [];
  const r = rows[0];
  if (!r || !['posted', 'matched'].includes(r.status)) throw new ServiceError(409, 'cannot_cancel');
  await deps.db.update('HelpRequest', r.id, { status: 'cancelled' });
  if (r.mission_key) {
    const m = (await deps.db.list('Mission', { key: r.mission_key }, undefined, 1))[0];
    if (m) await deps.db.update('Mission', m.id, { request_ids: (m.request_ids || []).filter((k) => k !== r.key) });
  }
  return getPlan({ token }, deps);
}

export async function confirmPickup({ token }, deps) {
  const session = await getSession(token, deps);
  const r = session.request_key ? (await deps.db.list('HelpRequest', { key: session.request_key }, undefined, 1))[0] : null;
  if (!r || r.status !== 'ready') throw new ServiceError(409, 'not_ready');
  const { clock } = await clockFor(deps);
  await deps.db.update('HelpRequest', r.id, { status: 'picked_up', picked_up_at: clock.now, history: [...(r.history || []), { status: 'picked_up', at: clock.now }] });
  const hub = (await deps.db.list('Hub', { key: r.hub_key }, undefined, 1))[0];
  await activity(deps, 'picked_up', `Bag ${r.code} was picked up at ${hub?.name}`, `La bolsa ${r.code} fue recogida en ${hub?.name}`, hub);
  return getPlan({ token }, deps);
}

/** 6E: check the thank-you note for personal info, then translate for the volunteers. */
export async function sendThanks({ token, text }, deps) {
  const session = await getSession(token, deps);
  const r = session.request_key ? (await deps.db.list('HelpRequest', { key: session.request_key }, undefined, 1))[0] : null;
  if (!r || !['ready', 'picked_up'].includes(r.status)) throw new ServiceError(409, 'not_ready');
  const note = String(text || '').trim().slice(0, LIMITS.noteText);
  if (!note) throw new ServiceError(400, 'empty_note');
  const mission = r.mission_key ? (await deps.db.list('Mission', { key: r.mission_key }, undefined, 1))[0] : null;
  const vols = mission ? await Promise.all((mission.volunteer_keys || []).map((k) => deps.db.list('Volunteer', { key: k }, undefined, 1).then((x) => x[0]))) : [];
  const target = vols[0]?.languages?.[0] === 'es' ? 'es' : 'en';

  const validate = (x) => (x && typeof x.allowed === 'boolean' && typeof x.cleaned_text === 'string' ? x : null);
  let out = await callAI(deps, { prompt: P.notePrompt(note, target), response_json_schema: P.NOTE_SCHEMA }, validate);
  if (!out && deps.invokeLLM && (note === EXAMPLE_NOTE.es || note === EXAMPLE_NOTE.en)) out = await golden(deps, 'note_translation');
  const personal = /(\+?\d[\d\s().-]{6,}\d)|(@\w)|([\w.+-]+@[\w-]+\.\w+)|(\b\d{2,5}\s+\w+\s+(st|street|ave|avenue|rd|road|dr|drive|blvd|ln|lane|calle)\b)/i;
  const patch = { thank_you_original: note, thank_you_language: session.language };
  if (out && out.allowed && !personal.test(out.cleaned_text) && !personal.test(out.translated_text || '')) {
    patch.thank_you_cleaned = out.cleaned_text.slice(0, LIMITS.noteText);
    patch.thank_you_translated = (out.translated_text || out.cleaned_text).slice(0, LIMITS.noteText);
    patch.thank_you_target = target;
  } else if (out && !out.allowed) {
    return { ok: false, blocked: true };
  } else {
    // Fallback: fixed message, no text shown to volunteers.
    patch.thank_you_fixed = true;
  }
  await deps.db.update('HelpRequest', r.id, patch);
  await activity(deps, 'thanks', 'A family sent the volunteers a thank-you note', 'Una familia envió una nota de agradecimiento a los voluntarios', null);
  return { ok: true, translated: !!patch.thank_you_translated };
}

// ------------------------------------------------------------------ 7B matching

function bagFor(donation, request) {
  const bag = buildBag(donation.items || [], request.household_size, request.food_prefs || []);
  const fmt = (b, l) => {
    const raw = (l === 'es' ? b.name_es : b.name_en) || b.name_en;
    const name = raw.replace(/\s*\(.*?\)\s*/g, ' ').trim();
    const trays = /\btrays?$/i.exec(name);
    if (trays) return `${b.count} trays ${name.replace(/\s*\btrays?$/i, '').replace(/^./, (c) => c.toLowerCase())}`;
    return `${b.count} ${name.replace(/^./, (c) => c.toLowerCase())}`;
  };
  return { en: bag.map((b) => fmt(b, 'en')).join(', '), es: bag.map((b) => fmt(b, 'es')).join(', '), lbs: request.household_size * LBS_PER_MEAL };
}

function bagInstructions(requests, hub) {
  const shelf = hub.has_reserved_shelf;
  const en = requests.map((r) => `Put bag ${r.code} (${r.bag_en}) on the reserved shelf.`).join(' ');
  const es = requests.map((r) => `Pon la bolsa ${r.code} (${r.bag_es}) en el estante reservado.`).join(' ');
  const rest = { en: shelf ? 'Stock the rest in the fridge.' : 'Give everything to the host.', es: shelf ? 'Guarda el resto en el refrigerador.' : 'Entrega todo a la persona encargada.' };
  return { en: `${en} ${rest.en}`.trim(), es: `${es} ${rest.es}`.trim() };
}

function templateBrief(m, giver, hub, requests) {
  const fam = requests.length;
  return {
    title_en: `${giver.type === 'bakery' ? 'Bakery' : giver.type === 'grocery' ? 'Grocery' : 'Food'} run: ${giver.name} → ${hub.name}`,
    title_es: `Entrega de ${giver.type === 'bakery' ? 'panadería' : 'comida'}: ${giver.name} → ${hub.name}`,
    brief_en: `Carry about ${m.lbs_planned} lbs from ${giver.name} to ${hub.name} (${m.distance_mi} mi ${m.mode}).${fam ? ` ${fam} family bag${fam > 1 ? 's' : ''} reserved: ${requests.map((r) => `${r.code} (${r.household_size} people)`).join(', ')}.` : ''} Stay with your buddy. Businesses and hubs only, never anyone's home. If anything feels wrong, tap I feel unsafe.`,
    brief_es: `Lleva unas ${m.lbs_planned} lbs de ${giver.name} a ${hub.name} (${m.distance_mi} mi).${fam ? ` Bolsas reservadas: ${requests.map((r) => `${r.code} (${r.household_size} personas)`).join(', ')}.` : ''} Quédate con tu compañero. Solo negocios y centros, nunca la casa de nadie. Si algo no se siente bien, toca "Me siento inseguro".`,
    steps_en: ['Meet your buddy.', `Go to ${giver.name} and enter the pickup code.`, 'Check the weight and pack the food.', `Go to ${hub.name} and enter the hub drop code.`, 'Place reserved bags on the shelf, stock the rest, and tap Done.'],
    steps_es: ['Reúnete con tu compañero.', `Ve a ${giver.name} y escribe el código de recogida.`, 'Revisa el peso y empaca la comida.', `Ve a ${hub.name} y escribe el código del centro.`, 'Pon las bolsas reservadas en el estante, guarda el resto y toca Listo.'],
    safety_checklist_en: ['I am with my buddy', 'Businesses and hubs only — never a home', 'Keep cold food cold; deliver prepared food within 2 hours', 'No cash, no medication', 'Tap "I feel unsafe" if anything feels wrong'],
    safety_checklist_es: ['Estoy con mi compañero', 'Solo negocios y centros, nunca una casa', 'Mantén fría la comida fría; entrega la comida preparada en menos de 2 horas', 'Sin dinero, sin medicinas', 'Toca "Me siento inseguro" si algo no se siente bien'],
  };
}

async function writeBrief(missionId, facts, fallbackKey, deps) {
  const valid = (x) => (x && typeof x.brief_en === 'string' && typeof x.brief_es === 'string' && Array.isArray(x.steps_en) ? x : null);
  let out = await callAI(deps, { prompt: P.briefPrompt(facts), response_json_schema: P.BRIEF_SCHEMA }, valid, 15000);
  let source = 'ai';
  if (!out && fallbackKey && deps.invokeLLM) {
    out = await golden(deps, fallbackKey);
    source = 'ai';
  }
  if (!out) return;
  await deps.db.update('Mission', missionId, {
    title_en: out.title_en || facts.title_en, title_es: out.title_es || facts.title_es,
    brief_en: out.brief_en.slice(0, 600), brief_es: out.brief_es.slice(0, 600),
    steps_en: (out.steps_en || []).slice(0, 8), steps_es: (out.steps_es || []).slice(0, 8),
    safety_checklist_en: (out.safety_checklist_en || []).slice(0, 8), safety_checklist_es: (out.safety_checklist_es || []).slice(0, 8),
    brief_source: source,
  });
}

async function createMission(deps, w, donation, hub, requests) {
  const giver = w.giverBy.get(donation.giver_key);
  const distance = Math.round(distanceMiles(giver, hub) * 10) / 10;
  const mode = chooseMode(distance);
  const est = estMinutes(distance, mode);
  const mission = {
    ns: NS, key: newKey('mis'), type: 'food_run', donation_key: donation.key, giver_key: giver.key, hub_key: hub.key,
    request_ids: requests.map((r) => r.key), distance_mi: distance, mode, est_minutes: est, min_age: mode === 'car' ? 18 : 13,
    window_start: donation.pickup_start, window_end: donation.pickup_end, lbs_planned: Math.round(donation.total_lbs),
    status: 'open', volunteer_keys: [], brief_source: 'template', created_at: new Date(nowMs(deps)).toISOString(),
    impact_en: requests.length ? `feeds ${requests.length} ${requests.length > 1 ? 'families' : 'family'} tonight + restocks the ${hub.type === 'community_fridge' ? 'fridge' : 'hub'}` : `restocks the ${hub.type === 'community_fridge' ? 'fridge' : 'hub'}`,
    impact_es: requests.length ? `alimenta a ${requests.length} ${requests.length > 1 ? 'familias' : 'familia'} esta noche + reabastece ${hub.type === 'community_fridge' ? 'el refrigerador' : 'el centro'}` : `reabastece ${hub.type === 'community_fridge' ? 'el refrigerador' : 'el centro'}`,
  };
  const bags = bagInstructions(requests, hub);
  Object.assign(mission, templateBrief(mission, giver, hub, requests), { bag_instructions_en: bags.en, bag_instructions_es: bags.es, handling_en: donation.handling_en || null, handling_es: donation.handling_es || null });
  const created = await deps.db.create('Mission', mission);
  const facts = {
    title_en: mission.title_en, title_es: mission.title_es, giver: giver.name, hub: hub.name, items: (donation.items || []).map((i) => `${i.quantity_text} ${i.name_en}`),
    lbs: mission.lbs_planned, distance_mi: distance, mode, window: `${donation.pickup_start}–${donation.pickup_end}`, handling: donation.handling_en,
    requests: requests.map((r) => ({ code: r.code, household_size: r.household_size })), bag_instructions: bags.en,
  };
  const golden = giver.key === DEMO.goldenGiver && hub.key === DEMO.goldenHub ? 'mission_brief' : null;
  const job = writeBrief(created.id, facts, golden, deps).catch((e) => deps.log?.('brief failed', e?.message));
  if (deps.waitUntil) deps.waitUntil(job);
  else await job;
  return created;
}

/**
 * Match every waiting food request with available surplus (7B), then send any unmatched surplus to a hub
 * as a restock mission. Safe to call any time; it only changes records that are still waiting.
 */
export async function rematch(deps) {
  const { clock } = await clockFor(deps);
  const w = await world(deps);
  const nowMin = clock.minutesOf(clock.now);
  const allocated = new Map();
  for (const r of w.requests) {
    if (r.mission_key && !['cancelled', 'expired', 'posted'].includes(r.status)) {
      const m = w.missionBy.get(r.mission_key);
      if (m) allocated.set(m.donation_key, (allocated.get(m.donation_key) || 0) + r.household_size * LBS_PER_MEAL);
    }
  }
  const waiting = w.requests.filter((r) => r.status === 'posted' && ['food_tonight', 'groceries_week'].includes(r.type)).sort((a, b) => String(a.needed_by).localeCompare(String(b.needed_by)));
  const changes = [];

  for (const req of waiting) {
    const hub = w.hubBy.get(req.hub_key);
    let best = null;
    for (const d of w.donations) {
      const mission = w.missions.find((m) => m.donation_key === d.key && m.status !== 'cancelled');
      const joinable = d.status === 'matched' && mission && mission.status === 'open' && mission.hub_key === hub.key;
      if (!(d.status === 'posted' || joinable)) continue;
      const remaining = d.total_lbs - (allocated.get(d.key) || 0);
      const s = scoreDonationForRequest({ donation: d, giver: w.giverBy.get(d.giver_key), hub, request: req, nowMin, remainingLbs: remaining });
      if (s && (!best || s.score > best.score)) best = { ...s, donation: d, mission: joinable ? mission : null };
    }
    if (!best) continue;
    const bag = bagFor(best.donation, req);
    Object.assign(req, { bag_en: bag.en, bag_es: bag.es });
    allocated.set(best.donation.key, (allocated.get(best.donation.key) || 0) + bag.lbs);
    let mission = best.mission;
    if (mission) {
      const reqs = [...mission.request_ids.map((k) => w.requests.find((x) => x.key === k)).filter(Boolean), req];
      const bags = bagInstructions(reqs, hub);
      mission.request_ids = reqs.map((r) => r.key);
      await deps.db.update('Mission', mission.id, { request_ids: mission.request_ids, bag_instructions_en: bags.en, bag_instructions_es: bags.es });
    } else {
      mission = await createMission(deps, w, best.donation, hub, [req], clock);
      w.missions.push(mission);
      best.donation.status = 'matched';
      await deps.db.update('Donation', best.donation.id, { status: 'matched', mission_key: mission.key });
      const giver = w.giverBy.get(best.donation.giver_key);
      await activity(deps, 'match', `${Math.round(best.donation.total_lbs)} lbs at ${giver.name} ↔ family of ${req.household_size} at ${hub.name} · ${best.distance.toFixed(1)} mi`, `${Math.round(best.donation.total_lbs)} lbs en ${giver.name} ↔ familia de ${req.household_size} en ${hub.name} · ${best.distance.toFixed(1)} mi`, hub, { line: { from: { lat: giver.lat, lng: giver.lng }, to: { lat: hub.lat, lng: hub.lng } } });
    }
    req.status = 'matched';
    req.mission_key = mission.key;
    changes.push(deps.db.update('HelpRequest', req.id, { status: 'matched', mission_key: mission.key, bag_en: bag.en, bag_es: bag.es, history: [...(req.history || []), { status: 'matched', at: clock.now }] }));
  }
  await Promise.all(changes);

  // Unmatched surplus → restock mission to the nearest open hub that accepts it.
  for (const d of w.donations.filter((x) => x.status === 'posted')) {
    const win = hhmmToMinutes(d.pickup_end);
    if (win != null && win <= nowMin) continue;
    const giver = w.giverBy.get(d.giver_key);
    const hub = w.hubs
      .map((h) => ({ h, dist: distanceMiles(giver, h) }))
      .filter(({ h, dist }) => dist <= 2 && (h.hours?.days || []).includes(clock.today.weekday) && h.hours.close > nowMin + 30 && accepts(h, d))
      .sort((a, b) => a.dist - b.dist)[0]?.h;
    if (!hub) continue;
    const mission = await createMission(deps, w, d, hub, [], clock);
    await deps.db.update('Donation', d.id, { status: 'matched', mission_key: mission.key });
    await activity(deps, 'match', `${Math.round(d.total_lbs)} lbs at ${giver.name} → restock ${hub.name}`, `${Math.round(d.total_lbs)} lbs en ${giver.name} → reabastecer ${hub.name}`, hub, { line: { from: { lat: giver.lat, lng: giver.lng }, to: { lat: hub.lat, lng: hub.lng } } });
  }
}

function accepts(hub, donation) {
  const need = new Set();
  for (const i of donation.items || []) {
    if (i.category === 'bakery') need.add('bread_baked');
    else if (i.category === 'prepared') need.add('prepared_labeled');
    else if (i.category === 'produce') need.add('produce');
    else if (i.category === 'dairy') need.add('dairy');
    else need.add('packaged');
  }
  return [...need].every((n) => (hub.accepts || []).includes(n));
}

// ------------------------------------------------------------------ 6C + give

const UNSAFE = [
  [/\b(beer|wine|liquor|alcohol|vodka|tequila|whiskey|cerveza|vino|licor)\b/i, 'alcohol'],
  [/\braw\s+(chicken|meat|beef|pork|fish|seafood|shrimp)|\b(pollo|carne|pescado|mariscos)\s+crud[oa]s?\b|\bcrud[oa]s?\b/i, 'raw_meat'],
  [/\b(opened|half[- ]eaten|partly eaten|leftovers? from (plates|customers)|abiert[oa]s?|a medio comer)\b/i, 'opened'],
  [/\bhome[- ]canned|conservas? caseras?\b/i, 'home_canned'],
  [/\b(spoiled|moldy|mold|expired|rotten|echad[oa] a perder|mohos?[oa]?|caducad[oa]|podrid[oa])\b/i, 'spoiled'],
];

export function safetyFlags(draft) {
  const text = [...(draft.items || []).map((i) => `${i.name_en} ${i.name_es}`), draft.note || ''].join(' ');
  const flags = new Set((draft.safety_flags || []).filter((f) => typeof f === 'string' && f.trim()).map((f) => f.trim().slice(0, 80)));
  for (const [re, code] of UNSAFE) if (re.test(text)) flags.add(code);
  return [...flags];
}

function cleanDraft(x) {
  if (!x || !Array.isArray(x.items) || !x.items.length) return null;
  const items = x.items.slice(0, 12).map((i) => ({
    name_en: String(i.name_en || '').slice(0, 80), name_es: String(i.name_es || i.name_en || '').slice(0, 80), quantity_text: String(i.quantity_text || '').slice(0, 40),
    est_lbs: Math.max(0, Math.min(500, Number(i.est_lbs) || 0)), category: ['bakery', 'prepared', 'produce', 'packaged', 'dairy', 'other'].includes(i.category) ? i.category : 'other',
    storage: ['cold', 'hot', 'shelf_stable'].includes(i.storage) ? i.storage : 'shelf_stable', tags: (i.tags || []).map(String).slice(0, 6),
  })).filter((i) => i.name_en);
  if (!items.length) return null;
  return {
    items, total_lbs: Math.round(items.reduce((s, i) => s + i.est_lbs, 0) * 10) / 10,
    possible_allergens: (x.possible_allergens || []).map(String).slice(0, 10), handling_en: String(x.handling_en || '').slice(0, 200), handling_es: String(x.handling_es || '').slice(0, 200),
    suggested_pickup: x.suggested_pickup && hhmmToMinutes(x.suggested_pickup.start) != null ? x.suggested_pickup : null,
    safety_flags: (x.safety_flags || []).map(String).slice(0, 6), label_en: String(x.label_en || '').slice(0, 300), label_es: String(x.label_es || '').slice(0, 300),
    confidence: ['high', 'medium', 'low'].includes(x.confidence) ? x.confidence : 'medium',
  };
}

export async function analyzePhoto({ giver_key, image, sample, sample_url, note }, deps) {
  const { clock } = await clockFor(deps);
  const giver = (await deps.db.list('Giver', { key: giver_key }, undefined, 1))[0];
  if (!giver) throw new ServiceError(404, 'giver_not_found');
  const nowMin = clock.minutesOf(clock.now);
  let url = sample ? sample_url || null : null;
  if (image) {
    if (typeof image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > LIMITS.photoMaxBytes * 1.4) throw new ServiceError(400, 'invalid_image');
    url = deps.uploadImage ? await deps.uploadImage(image).catch(() => null) : null;
  }
  let draft = null;
  let source = 'ai';
  if (url) {
    draft = await callAI(deps, { prompt: P.photoPrompt({ giverType: giver.type, nowHhmm: minutesToHhmm(nowMin), note }), response_json_schema: P.PHOTO_SCHEMA, file_urls: [url] }, cleanDraft);
  }
  if (!draft && sample) {
    draft = cleanDraft(await golden(deps, 'photo_post'));
    source = deps.invokeLLM ? 'ai' : 'sample';
  }
  if (!draft) return { draft: null, source: 'empty' };
  // Pickup window: suggested, or next full hour, lasting 1 hour.
  const start = draft.suggested_pickup ? hhmmToMinutes(draft.suggested_pickup.start) : Math.ceil((nowMin + 15) / 60) * 60;
  const end = draft.suggested_pickup ? hhmmToMinutes(draft.suggested_pickup.end) ?? start + 60 : start + 60;
  draft.pickup_start = minutesToHhmm(Math.max(start, 0));
  draft.pickup_end = minutesToHhmm(Math.max(end, start + 30));
  draft.safety_flags = safetyFlags(draft);
  return { draft, source };
}

export async function postDonation({ giver_key, draft, allergens_confirmed }, deps) {
  const giver = (await deps.db.list('Giver', { key: giver_key }, undefined, 1))[0];
  if (!giver) throw new ServiceError(404, 'giver_not_found');
  const d = cleanDraft(draft);
  if (!d) throw new ServiceError(400, 'invalid_draft');
  const flags = safetyFlags({ ...d, note: draft?.note });
  if (flags.length) throw new ServiceError(422, 'unsafe_food', { flags });
  if (!allergens_confirmed) throw new ServiceError(400, 'confirm_allergens');
  const start = hhmmToMinutes(draft.pickup_start);
  const end = hhmmToMinutes(draft.pickup_end);
  if (start == null || end == null || end <= start) throw new ServiceError(400, 'invalid_window');
  if (d.items.some((i) => i.category === 'prepared') && end - start > 180) throw new ServiceError(400, 'window_too_long');
  const { clock } = await clockFor(deps);
  const code = giver.key === DEMO.goldenGiver ? DEMO.goldenPickupCode : randomCode(4);
  const donation = await deps.db.create('Donation', {
    ns: NS, key: newKey('don'), giver_key: giver.key, items: d.items, total_lbs: d.total_lbs, allergens: d.possible_allergens,
    handling_en: d.handling_en, handling_es: d.handling_es, label_en: d.label_en, label_es: d.label_es,
    pickup_start: minutesToHhmm(start), pickup_end: minutesToHhmm(end), pickup_code: code, status: 'posted', photo: draft.photo_kind || null,
    at: new Date(nowMs(deps)).toISOString(), posted_demo_time: clock.now,
  });
  await activity(deps, 'surplus', `${giver.name} posted about ${Math.round(d.total_lbs)} lbs of surplus food`, `${giver.name} publicó unas ${Math.round(d.total_lbs)} lbs de comida sobrante`, giver);
  await rematch(deps);
  return { key: donation.key, pickup_code: code };
}

export async function cancelDonation({ giver_key, key }, deps) {
  const d = (await deps.db.list('Donation', { key }, undefined, 1))[0];
  if (!d || d.giver_key !== giver_key) throw new ServiceError(404, 'not_found');
  if (d.status !== 'posted') throw new ServiceError(409, 'cannot_cancel');
  await deps.db.update('Donation', d.id, { status: 'cancelled' });
  return { ok: true };
}

// ------------------------------------------------------------------ volunteer missions (7C, 7D)

async function getMission(key, deps) {
  const m = (await deps.db.list('Mission', { key }, undefined, 1))[0];
  if (!m) throw new ServiceError(404, 'mission_not_found');
  return m;
}
async function getVolunteer(key, deps) {
  const v = (await deps.db.list('Volunteer', { key }, undefined, 1))[0];
  if (!v) throw new ServiceError(404, 'volunteer_not_found');
  return v;
}

export async function claimMission({ mission_key, volunteer_key, buddy_key }, deps) {
  const m = await getMission(mission_key, deps);
  const v = await getVolunteer(volunteer_key, deps);
  const e = missionEligibility(v, m);
  if (!e.ok) throw new ServiceError(403, 'not_eligible', { reasons: e.reasons });
  const team = [v.key];
  if (buddy_key) {
    if (buddy_key === volunteer_key) throw new ServiceError(400, 'invalid_buddy');
    const b = await getVolunteer(buddy_key, deps);
    const be = missionEligibility(b, m);
    if (!be.ok) throw new ServiceError(403, 'buddy_not_eligible', { reasons: be.reasons });
    team.push(b.key);
  } else if (buddyRequired(v)) {
    throw new ServiceError(400, 'buddy_required');
  }
  const { clock } = await clockFor(deps);
  await deps.db.update('Mission', m.id, { status: 'claimed', volunteer_keys: team, claimed_at: clock.now, claimed_real: nowMs(deps) });
  const reqs = await Promise.all((m.request_ids || []).map((k) => deps.db.list('HelpRequest', { key: k }, undefined, 1).then((x) => x[0])));
  await Promise.all(reqs.filter((r) => r && r.status === 'matched').map((r) => deps.db.update('HelpRequest', r.id, { status: 'on_the_way', history: [...(r.history || []), { status: 'on_the_way', at: clock.now }] })));
  const names = (await Promise.all(team.map((k) => getVolunteer(k, deps)))).map((x) => x.display_name);
  await activity(deps, 'claimed', `${names.join(' & ')} claimed "${m.title_en}"`, `${names.join(' y ')} tomaron "${m.title_es}"`, null);
  return { ok: true };
}

export async function missionPickup({ mission_key, volunteer_key, code, confirmed_lbs }, deps) {
  const m = await getMission(mission_key, deps);
  if (!(m.volunteer_keys || []).includes(volunteer_key)) throw new ServiceError(403, 'not_your_mission');
  if (m.status !== 'claimed') throw new ServiceError(409, 'wrong_step');
  const { clock } = await clockFor(deps);
  if (!withinWindow(m, clock.minutesOf(clock.now))) throw new ServiceError(409, 'outside_window');
  const d = (await deps.db.list('Donation', { key: m.donation_key }, undefined, 1))[0];
  if (!d || String(code || '').trim() !== d.pickup_code) throw new ServiceError(400, 'wrong_code');
  const lbs = Number(confirmed_lbs);
  const confirmed = Number.isFinite(lbs) && lbs > 0 && lbs <= 1000 ? Math.round(lbs * 10) / 10 : d.total_lbs;
  await Promise.all([
    deps.db.update('Mission', m.id, { status: 'picked_up', picked_up_at: clock.now }),
    deps.db.update('Donation', d.id, { status: 'picked_up', confirmed_lbs: confirmed }),
  ]);
  const giver = (await deps.db.list('Giver', { key: d.giver_key }, undefined, 1))[0];
  await activity(deps, 'picked_up_surplus', `${confirmed} lbs picked up at ${giver?.name}`, `${confirmed} lbs recogidas en ${giver?.name}`, giver);
  return { ok: true, confirmed_lbs: confirmed };
}

export async function missionDropoff({ mission_key, volunteer_key, code }, deps) {
  const m = await getMission(mission_key, deps);
  if (!(m.volunteer_keys || []).includes(volunteer_key)) throw new ServiceError(403, 'not_your_mission');
  if (m.status !== 'picked_up') throw new ServiceError(409, 'wrong_step');
  const { clock } = await clockFor(deps);
  if (!withinWindow(m, clock.minutesOf(clock.now))) throw new ServiceError(409, 'outside_window');
  const hub = (await deps.db.list('Hub', { key: m.hub_key }, undefined, 1))[0];
  if (!hub || String(code || '').trim() !== hub.drop_code) throw new ServiceError(400, 'wrong_code');
  const d = (await deps.db.list('Donation', { key: m.donation_key }, undefined, 1))[0];
  const lbs = d?.confirmed_lbs ?? d?.total_lbs ?? m.lbs_planned;
  const actualMinutes = m.claimed_real ? (nowMs(deps) - m.claimed_real) / 60000 : 0;
  const hours = creditedHours(m.est_minutes, actualMinutes);
  const meals = mealsFromLbs(lbs);

  const reqs = (await Promise.all((m.request_ids || []).map((k) => deps.db.list('HelpRequest', { key: k }, undefined, 1).then((x) => x[0])))).filter((r) => r && r.status === 'on_the_way');
  const vols = await Promise.all((m.volunteer_keys || []).map((k) => getVolunteer(k, deps)));
  const teams = new Map();
  for (const v of vols) teams.set(v.team_key, (teams.get(v.team_key) || 0) + 1);

  const logEntry = { kind: 'mission', key: m.key, title_en: m.title_en, title_es: m.title_es, hub: hub.name, hours, lbs, at: clock.now, verified_by: ['pickup_code', 'drop_code'] };
  await Promise.all([
    deps.db.update('Mission', m.id, { status: 'verified', delivered_at: clock.now, credited_hours: hours, lbs_delivered: lbs, meals }),
    d && deps.db.update('Donation', d.id, { status: 'delivered' }),
    ...reqs.map((r) => deps.db.update('HelpRequest', r.id, { status: 'ready', ready_at: clock.now, history: [...(r.history || []), { status: 'ready', at: clock.now }] })),
    ...vols.map((v) => deps.db.update('Volunteer', v.id, {
      total_hours: Math.round(((v.total_hours || 0) + hours) * 100) / 100, total_lbs: Math.round((v.total_lbs || 0) + lbs), missions_done: (v.missions_done || 0) + 1,
      hours_log: [...(v.hours_log || []), logEntry],
    })),
  ]);
  for (const [teamKey, count] of teams) {
    const t = (await deps.db.list('Team', { key: teamKey }, undefined, 1))[0];
    if (t) await deps.db.update('Team', t.id, { total_hours: Math.round(((t.total_hours || 0) + hours * count) * 100) / 100, total_lbs: Math.round((t.total_lbs || 0) + lbs) });
  }
  const names = vols.map((v) => v.display_name).join(' & ');
  await activity(deps, 'delivered', `${names} delivered ${lbs} lbs to ${hub.name} · about ${meals} meals`, `${vols.map((v) => v.display_name).join(' y ')} entregaron ${lbs} lbs en ${hub.name} · unas ${meals} comidas`, hub);
  if (reqs.length) await activity(deps, 'covered', `${reqs.length} ${reqs.length > 1 ? 'families' : 'family'} covered tonight at ${hub.name}`, `${reqs.length} ${reqs.length > 1 ? 'familias recibieron' : 'familia recibió'} comida esta noche en ${hub.name}`, hub);
  return { ok: true, lbs, meals, families: reqs.length, hours_each: hours, volunteers: vols.map((v) => v.display_name) };
}

export async function missionUnsafe({ mission_key, volunteer_key }, deps) {
  const m = await getMission(mission_key, deps);
  if (!(m.volunteer_keys || []).includes(volunteer_key)) throw new ServiceError(403, 'not_your_mission');
  const { clock } = await clockFor(deps);
  await deps.db.update('Mission', m.id, { status: 'cancelled', cancelled_reason: 'unsafe', cancelled_at: clock.now });
  const d = (await deps.db.list('Donation', { key: m.donation_key }, undefined, 1))[0];
  if (d && ['matched', 'picked_up'].includes(d.status)) await deps.db.update('Donation', d.id, { status: d.status === 'picked_up' ? 'cancelled' : 'posted', mission_key: null });
  const reqs = (await Promise.all((m.request_ids || []).map((k) => deps.db.list('HelpRequest', { key: k }, undefined, 1).then((x) => x[0])))).filter(Boolean);
  await Promise.all(reqs.filter((r) => ['matched', 'on_the_way'].includes(r.status)).map((r) => deps.db.update('HelpRequest', r.id, { status: 'posted', mission_key: null, history: [...(r.history || []), { status: 'posted', at: clock.now }] })));
  const hub = (await deps.db.list('Hub', { key: m.hub_key }, undefined, 1))[0];
  await activity(deps, 'unsafe', `Safety alert sent to ${hub?.name}. The mission was ended.`, `Alerta de seguridad enviada a ${hub?.name}. La misión terminó.`, null, { hub_key: m.hub_key, alert: true });
  await rematch(deps);
  return { ok: true };
}

// ------------------------------------------------------------------ state snapshot for the UI

function tick(w, clock, deps) {
  // Requests not picked up by hub closing time go back to general stock.
  const nowMin = clock.minutesOf(clock.now);
  const updates = [];
  for (const r of w.requests) {
    const close = hhmmToMinutes(r.pickup_by);
    if (r.status === 'ready' && close != null && nowMin > close) {
      r.status = 'expired';
      updates.push(deps.db.update('HelpRequest', r.id, { status: 'expired' }));
    }
  }
  return Promise.all(updates);
}

function volunteerPublic(v) {
  return { key: v.key, display_name: v.display_name, age: v.age, age_band: v.age_band, team_key: v.team_key, guardian_consent: !!v.guardian_consent, modes: v.modes, languages: v.languages, total_hours: v.total_hours, total_lbs: v.total_lbs, missions_done: v.missions_done, school: v.school };
}

export async function getState({ role, identity, token }, deps) {
  const { demo, clock } = await clockFor(deps);
  const w = await world(deps);
  await tick(w, clock, deps);
  const activityRows = await deps.db.list('Activity', { ns: NS }, '-at', 40);
  activityRows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const nowMin = clock.minutesOf(clock.now);

  const waitingByHub = {};
  const readyByHub = {};
  for (const r of w.requests) {
    if (['posted', 'matched', 'on_the_way'].includes(r.status)) waitingByHub[r.hub_key] = (waitingByHub[r.hub_key] || 0) + 1;
    if (r.status === 'ready') readyByHub[r.hub_key] = (readyByHub[r.hub_key] || 0) + 1;
  }

  const hubs = w.hubs.map((h) => ({
    key: h.key, name: h.name, type: h.type, area_label: h.area_label, lat: h.lat, lng: h.lng, hours_text_en: h.hours_text_en, hours_text_es: h.hours_text_es,
    host_note_en: h.host_note_en, host_note_es: h.host_note_es, has_reserved_shelf: h.has_reserved_shelf, accepts: h.accepts, does_not_accept: h.does_not_accept, verified: h.verified,
    open_now: !!(h.hours?.days.includes(clock.today.weekday) && nowMin >= h.hours.open && nowMin < h.hours.close),
    waiting: waitingByHub[h.key] || 0, ready: readyByHub[h.key] || 0,
    ...(role === 'hub' && identity === h.key ? { drop_code: h.drop_code } : {}),
  }));

  const givers = w.givers.map((g) => ({
    key: g.key, name: g.name, type: g.type, area_label: g.area_label, lat: g.lat, lng: g.lng, verified: g.verified,
    open_lbs: w.donations.filter((d) => d.giver_key === g.key && ['posted', 'matched'].includes(d.status)).reduce((s, d) => s + d.total_lbs, 0),
  }));

  const me = role === 'volunteer' ? w.volunteerBy.get(identity) : null;
  const missions = w.missions
    .filter((m) => m.status !== 'cancelled')
    .map((m) => {
      const giver = w.giverBy.get(m.giver_key);
      const hub = w.hubBy.get(m.hub_key);
      const reqs = (m.request_ids || []).map((k) => w.requests.find((r) => r.key === k)).filter(Boolean);
      const out = {
        key: m.key, type: m.type, title_en: m.title_en, title_es: m.title_es, status: m.status, giver: giver && { key: giver.key, name: giver.name, lat: giver.lat, lng: giver.lng, area_label: giver.area_label },
        hub: hub && { key: hub.key, name: hub.name, lat: hub.lat, lng: hub.lng, area_label: hub.area_label }, distance_mi: m.distance_mi, mode: m.mode, est_minutes: m.est_minutes, min_age: m.min_age,
        window_start: m.window_start, window_end: m.window_end, lbs_planned: m.lbs_planned, impact_en: m.impact_en, impact_es: m.impact_es,
        brief_en: m.brief_en, brief_es: m.brief_es, brief_source: m.brief_source, steps_en: m.steps_en, steps_es: m.steps_es, safety_checklist_en: m.safety_checklist_en, safety_checklist_es: m.safety_checklist_es,
        bag_instructions_en: m.bag_instructions_en, bag_instructions_es: m.bag_instructions_es, handling_en: m.handling_en, handling_es: m.handling_es,
        requests: reqs.map((r) => ({ code: r.code, household_size: r.household_size })), volunteer_names: (m.volunteer_keys || []).map((k) => w.volunteerBy.get(k)?.display_name).filter(Boolean),
        volunteer_keys: m.volunteer_keys || [], credited_hours: m.credited_hours || null,
        // Demo helper chips only (the demo is public and the Hub role shows its code anyway).
        demo_codes: { pickup: w.donationBy.get(m.donation_key)?.pickup_code || null, drop: hub?.drop_code || null }, lbs_delivered: m.lbs_delivered || null, meals: m.meals || null, created_at: m.created_at || null, sample: !!m.sample,
      };
      if (me) {
        const e = missionEligibility(me, m);
        out.eligibility = { ok: e.ok || (m.volunteer_keys || []).includes(me.key), reasons: (m.volunteer_keys || []).includes(me.key) ? [] : e.reasons };
        out.mine = (m.volunteer_keys || []).includes(me.key);
        out.buddy_options = w.volunteers.filter((b) => b.key !== me.key && missionEligibility(b, { ...m, status: 'open' }).ok).map((b) => ({ key: b.key, display_name: b.display_name, team_key: b.team_key }));
        if (out.mine) {
          const thanks = reqs.filter((r) => r.thank_you_translated || r.thank_you_cleaned || r.thank_you_fixed);
          out.thanks = thanks.map((r) => ({ text: r.thank_you_target === (me.languages?.[0] === 'es' ? 'es' : 'en') ? r.thank_you_translated : r.thank_you_translated || r.thank_you_cleaned, original: r.thank_you_cleaned || null, from_language: r.thank_you_language, fixed: !!r.thank_you_fixed && !r.thank_you_translated }));
        }
      }
      return out;
    });

  const donations = w.donations
    .filter((d) => ['posted', 'matched', 'picked_up'].includes(d.status) || (role === 'give' && d.giver_key === identity))
    .map((d) => {
      const mine = role === 'give' && d.giver_key === identity;
      const mission = w.missions.find((m) => m.donation_key === d.key && m.status !== 'cancelled');
      return {
        key: d.key, giver_key: d.giver_key, status: d.status, total_lbs: d.total_lbs, confirmed_lbs: d.confirmed_lbs || null, items: d.items, pickup_start: d.pickup_start, pickup_end: d.pickup_end, at: d.at, sample: !!d.sample,
        ...(mine ? { pickup_code: d.pickup_code, label_en: d.label_en, label_es: d.label_es, allergens: d.allergens, handling_en: d.handling_en, handling_es: d.handling_es, volunteers: mission ? (mission.volunteer_keys || []).map((k) => { const v = w.volunteerBy.get(k); return v && { name: v.display_name, team: w.teamBy.get(v.team_key)?.name }; }).filter(Boolean) : [], mission_status: mission?.status || null } : {}),
      };
    });

  let myRequest = null;
  if (token && TOKEN_RE.test(token)) {
    const s = (await deps.db.list('PlanSession', { share_token: token }, undefined, 1))[0];
    const r = s?.request_key && w.requests.find((x) => x.key === s.request_key);
    if (r) myRequest = await requestView(r, deps);
  }

  let hubView = null;
  if (role === 'hub') {
    const hub = w.hubBy.get(identity);
    if (hub) {
      hubView = {
        key: hub.key,
        incoming: missions.filter((m) => m.hub?.key === hub.key && ['open', 'claimed', 'picked_up'].includes(m.status)).map((m) => ({ key: m.key, title_en: m.title_en, title_es: m.title_es, status: m.status, volunteer_names: m.volunteer_names, lbs: m.lbs_planned, eta_minutes: m.status === 'picked_up' ? Math.round(m.est_minutes / 2) : m.status === 'claimed' ? m.est_minutes : null })),
        shelf: w.requests.filter((r) => r.hub_key === hub.key && ['on_the_way', 'ready', 'picked_up', 'expired'].includes(r.status)).map((r) => ({ code: r.code, status: r.status, household_size: r.household_size, ready_at: r.ready_at || null, picked_up_at: r.picked_up_at || null })),
        alerts: activityRows.filter((a) => a.alert && a.hub_key === hub.key).map((a) => ({ at: a.at, message_en: a.message_en, message_es: a.message_es })),
      };
    }
  }

  const volunteersActive = new Set(w.missions.filter((m) => ['claimed', 'picked_up', 'verified'].includes(m.status) && !m.sample).flatMap((m) => m.volunteer_keys || [])).size;
  const impact = computeImpact({ sample: SAMPLE_IMPACT, missions: w.missions.filter((m) => !m.sample), requests: w.requests, plans: demo.plans_since_reset || 0, volunteersActive });
  const spark = {
    lbs: [...SAMPLE_WEEK.lbs.slice(0, 6), SAMPLE_WEEK.lbs[6] + impact.live.lbs],
    meals: [...SAMPLE_WEEK.meals.slice(0, 6), SAMPLE_WEEK.meals[6] + mealsFromLbs(impact.live.lbs)],
    families: [...SAMPLE_WEEK.families.slice(0, 6), SAMPLE_WEEK.families[6] + impact.live.families],
    hours: [...SAMPLE_WEEK.hours.slice(0, 6), SAMPLE_WEEK.hours[6] + impact.live.hours],
  };

  return {
    clock: { now: clock.now, reset_at: demo.reset_at, weekday: clock.today.weekday },
    hubs,
    givers,
    missions,
    donations,
    my_request: myRequest,
    hub_view: hubView,
    volunteers: w.volunteers.map(volunteerPublic),
    me: me ? { ...volunteerPublic(me), hours_log: me.hours_log || [] } : null,
    teams: w.teams.map((t) => ({ key: t.key, name: t.name, total_hours: t.total_hours, total_lbs: t.total_lbs, members: (t.member_keys || []).length })).sort((a, b) => b.total_hours - a.total_hours),
    events: w.events.filter((e) => e.status === 'posted').map((e) => ({
      key: e.key, type: e.type, title_en: e.title_en, title_es: e.title_es, description_en: e.description_en, description_es: e.description_es, date: e.date, start: e.start, end: e.end,
      hub_key: e.hub_key, area_label: e.area_label, lat: e.lat, lng: e.lng, host: e.host, min_age: e.min_age, spots: e.spots, rsvp_count: (e.rsvp_keys || []).length,
      rsvped: me ? (e.rsvp_keys || []).includes(me.key) : false, checked_in: me ? (e.checked_in_keys || []).includes(me.key) : false, hours_credit: e.hours_credit, sample: !!e.sample,
      ...(role === 'hub' && identity && e.hub_key === identity ? { checkin_code: e.checkin_code } : {}),
      demo_checkin: e.checkin_code, // demo helper chip only
    })),
    activity: activityRows.slice(0, 30).map((a) => ({ id: a.id || a.at, type: a.type, message_en: a.message_en, message_es: a.message_es, lat: a.lat, lng: a.lng, at: a.at, sample: !!a.sample, line: a.line || null })),
    impact,
    spark,
  };
}

// ------------------------------------------------------------------ P1: pulse & events

export async function pulse({ zip }, deps) {
  const z = zip || DEMO.zip;
  const plans = await deps.db.list('PlanSession', { ns: NS }, undefined, 2000);
  const counts = {};
  for (const [k, [thisWeek, lastWeek]] of Object.entries(SAMPLE_PULSE)) counts[k] = { this_week: thisWeek, last_week: lastWeek };
  for (const p of plans) {
    if (p.profile?.zip !== z) continue;
    for (const n of p.profile.needs || []) {
      counts[n] ??= { this_week: 0, last_week: 0 };
      counts[n].this_week++;
    }
  }
  // Privacy: only categories with 5 or more.
  const shown = Object.fromEntries(Object.entries(counts).filter(([, v]) => v.this_week >= 5));
  const hubs = (await deps.db.list('Hub', { ns: NS }, undefined, 100)).map((h) => ({ hub_key: h.key, name: h.name, type: h.type }));
  const valid = (x) => (x && x.headline_en && x.headline_es && x.suggested_action?.title_en ? x : null);
  let brief = await callAI(deps, { prompt: P.pulsePrompt({ zip: z, counts: shown, hubs }), response_json_schema: P.PULSE_SCHEMA }, valid);
  let source = 'ai';
  if (!brief) {
    brief = deps.invokeLLM && z === DEMO.zip ? await golden(deps, 'pulse_brief') : rulePulse(shown);
    source = deps.invokeLLM && z === DEMO.zip ? 'ai' : 'rules';
  }
  if (!hubs.some((h) => h.hub_key === brief.suggested_action?.hub_key)) brief.suggested_action.hub_key = hubs[0]?.hub_key || null;
  return { zip: z, counts: shown, brief, source };
}

function rulePulse(counts) {
  const growth = Object.entries(counts).map(([k, v]) => [k, v.last_week ? (v.this_week - v.last_week) / v.last_week : 0, v]).sort((a, b) => b[1] - a[1]);
  const [topKey, g] = growth[0] || ['food', 0];
  const label = { utilities: ['Electric-bill help', 'La ayuda con la factura de luz'], food: ['Food', 'La comida'], school_supplies: ['School supplies', 'Los útiles escolares'], housing: ['Rent help', 'La ayuda con la renta'], healthcare: ['Health care', 'La atención médica'] }[topKey] || [topKey, topKey];
  return {
    headline_en: `${label[0]} is the fastest-growing need this week (+${Math.round(g * 100)}%).`,
    headline_es: `${label[1]} es la necesidad que más crece esta semana (+${Math.round(g * 100)}%).`,
    insights_en: growth.slice(0, 3).map(([k, , v]) => `${k.replace('_', ' ')}: ${v.this_week} this week (last week ${v.last_week}).`),
    insights_es: growth.slice(0, 3).map(([k, , v]) => `${k.replace('_', ' ')}: ${v.this_week} esta semana (la anterior ${v.last_week}).`),
    suggested_action: { type: 'pop_up', title_en: `${label[0]} pop-up`, title_es: `Punto de ayuda: ${label[1].toLowerCase()}`, description_en: 'Student volunteers help neighbors connect with programs for this need.', description_es: 'Estudiantes voluntarios ayudan a los vecinos a conectarse con programas para esta necesidad.', hub_key: 'riverside-fridge' },
  };
}

export async function createEvent({ hub_key, event }, deps) {
  const hub = (await deps.db.list('Hub', { key: hub_key }, undefined, 1))[0];
  if (!hub) throw new ServiceError(404, 'hub_not_found');
  const e = event || {};
  const title_en = String(e.title_en || '').trim().slice(0, 100);
  const title_es = String(e.title_es || e.title_en || '').trim().slice(0, 100);
  if (!title_en) throw new ServiceError(400, 'title_required');
  const start = hhmmToMinutes(e.start);
  const end = hhmmToMinutes(e.end);
  if (start == null || end == null || end <= start) throw new ServiceError(400, 'invalid_window');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(e.date || ''))) throw new ServiceError(400, 'invalid_date');
  const created = await deps.db.create('Event', {
    ns: NS, key: newKey('evt'), type: ['pop_up', 'drive', 'cleanup', 'fridge_day', 'civic_meeting'].includes(e.type) ? e.type : 'pop_up', title_en, title_es,
    description_en: String(e.description_en || '').slice(0, 400), description_es: String(e.description_es || e.description_en || '').slice(0, 400),
    date: e.date, start: minutesToHhmm(start), end: minutesToHhmm(end), hub_key: hub.key, area_label: hub.area_label, lat: hub.lat, lng: hub.lng, host: hub.name,
    min_age: Math.max(13, Math.min(18, Number(e.min_age) || 13)), spots: Math.max(1, Math.min(200, Number(e.spots) || 10)), rsvp_keys: [], checked_in_keys: [],
    checkin_code: randomCode(4), hours_credit: Math.max(0.25, Math.min(6, Math.round(((end - start) / 60) * 4) / 4)), status: 'posted', sample: false,
  });
  await activity(deps, 'event', `New event: ${title_en} at ${hub.name}`, `Nuevo evento: ${title_es} en ${hub.name}`, hub);
  return { key: created.key, checkin_code: created.checkin_code };
}

export async function rsvpEvent({ event_key, volunteer_key, going }, deps) {
  const e = (await deps.db.list('Event', { key: event_key }, undefined, 1))[0];
  if (!e) throw new ServiceError(404, 'event_not_found');
  const v = await getVolunteer(volunteer_key, deps);
  if ((Number(v.age) || 0) < (e.min_age || 13)) throw new ServiceError(403, 'too_young', { min_age: e.min_age });
  const list = new Set(e.rsvp_keys || []);
  if (going === false) list.delete(v.key);
  else {
    if (list.size >= e.spots && !list.has(v.key)) throw new ServiceError(409, 'full');
    list.add(v.key);
  }
  await deps.db.update('Event', e.id, { rsvp_keys: [...list] });
  return { ok: true, rsvped: list.has(v.key) };
}

export async function eventCheckin({ event_key, volunteer_key, code }, deps) {
  const e = (await deps.db.list('Event', { key: event_key }, undefined, 1))[0];
  if (!e) throw new ServiceError(404, 'event_not_found');
  const v = await getVolunteer(volunteer_key, deps);
  if (!(e.rsvp_keys || []).includes(v.key)) throw new ServiceError(409, 'rsvp_first');
  if ((e.checked_in_keys || []).includes(v.key)) throw new ServiceError(409, 'already_checked_in');
  if (String(code || '').trim() !== e.checkin_code) throw new ServiceError(400, 'wrong_code');
  const { clock } = await clockFor(deps);
  await deps.db.update('Event', e.id, { checked_in_keys: [...(e.checked_in_keys || []), v.key] });
  await deps.db.update('Volunteer', v.id, {
    total_hours: Math.round(((v.total_hours || 0) + e.hours_credit) * 100) / 100,
    hours_log: [...(v.hours_log || []), { kind: 'event', key: e.key, title_en: e.title_en, title_es: e.title_es, hub: e.host, hours: e.hours_credit, lbs: 0, at: clock.now, verified_by: ['checkin_code'] }],
  });
  const t = (await deps.db.list('Team', { key: v.team_key }, undefined, 1))[0];
  if (t) await deps.db.update('Team', t.id, { total_hours: Math.round(((t.total_hours || 0) + e.hours_credit) * 100) / 100 });
  await activity(deps, 'hours', `${v.display_name} earned ${e.hours_credit} verified hours at ${e.title_en}`, `${v.display_name} ganó ${e.hours_credit} horas verificadas en ${e.title_es}`, e);
  return { ok: true, hours: e.hours_credit };
}

// ------------------------------------------------------------------ dispatcher

export const ACTIONS = {
  state: getState,
  reset: resetDemo,
  extract,
  createPlan,
  getPlan,
  personalizePlan,
  updateProgress,
  explainResource,
  requestOptions,
  postRequest,
  cancelRequest,
  confirmPickup,
  sendThanks,
  analyzePhoto,
  postDonation,
  cancelDonation,
  claimMission,
  missionPickup,
  missionDropoff,
  missionUnsafe,
  pulse,
  createEvent,
  rsvpEvent,
  eventCheckin,
};

export async function dispatch(action, args, deps) {
  const fn = ACTIONS[action];
  if (!fn) throw new ServiceError(400, 'unknown_action');
  return fn(args || {}, deps);
}

export { formatTime, compatibleLbs };
