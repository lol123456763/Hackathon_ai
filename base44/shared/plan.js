// Action-plan helpers: the rule-based plan (used when AI is unavailable) and validation of AI plans.
import { FALLBACK_211 } from './matching.js';

const URGENT_FIRST = ['food', 'housing', 'utilities', 'mental_health', 'healthcare', 'cash_assistance', 'school_childcare', 'employment', 'transportation', 'legal'];

const T = {
  en: {
    call: (r) => `Call ${r.name}${r.phone ? ` at ${r.phone}` : ''}.`,
    visit: (r) => `Go to ${r.name}${r.address ? ` at ${r.address}` : ''}${r.hours ? ` (${r.hours})` : ''}.`,
    apply: (r) => `Apply for ${r.name}${r.apply_url ? ' online' : ''}.`,
    whyUrgent: (cat) => `This helps with ${CAT_EN[cat] || cat} fastest.`,
    whyNext: (cat) => `This can help with ${CAT_EN[cat] || cat} over the next few weeks.`,
    ifNo: (r) => `If ${r.name} can't help you`,
    thenTry: (r) => `Try ${r.name}${r.phone ? ` (${r.phone})` : ''}.`,
    then211: 'Call 2-1-1. They can find other help near you.',
    encouragement: "You're taking the right steps. Asking for help is a strong thing to do, and there is help available for your family.",
    core: ['Photo ID (driver license, state ID, or passport)', 'Proof of address (a bill or lease)', 'Proof of income for the last 30 days (pay stubs, or a letter if you lost your job)'],
    kidsDocs: ["Children's birth certificates or other proof of age"],
  },
  es: {
    call: (r) => `Llame a ${r.name}${r.phone ? ` al ${r.phone}` : ''}.`,
    visit: (r) => `Vaya a ${r.name}${r.address ? ` en ${r.address}` : ''}${r.hours ? ` (${r.hours})` : ''}.`,
    apply: (r) => `Solicite ${r.name}${r.apply_url ? ' en línea' : ''}.`,
    whyUrgent: (cat) => `Esto ayuda más rápido con ${CAT_ES[cat] || cat}.`,
    whyNext: (cat) => `Esto puede ayudar con ${CAT_ES[cat] || cat} en las próximas semanas.`,
    ifNo: (r) => `Si ${r.name} no le puede ayudar`,
    thenTry: (r) => `Pruebe ${r.name}${r.phone ? ` (${r.phone})` : ''}.`,
    then211: 'Llame al 2-1-1. Le pueden encontrar otra ayuda cerca de usted.',
    encouragement: 'Está dando los pasos correctos. Pedir ayuda es algo valiente, y hay ayuda disponible para su familia.',
    core: ['Identificación con foto (licencia, ID del estado o pasaporte)', 'Comprobante de domicilio (una factura o contrato de renta)', 'Comprobante de ingresos de los últimos 30 días (talones de pago, o una carta si perdió su trabajo)'],
    kidsDocs: ['Actas de nacimiento de los niños u otro comprobante de edad'],
  },
};

const CAT_EN = { food: 'food', housing: 'housing', utilities: 'utility bills', healthcare: 'health care', mental_health: 'emotional support', school_childcare: 'school and child care', employment: 'finding work', transportation: 'transportation', cash_assistance: 'money for bills', legal: 'legal problems' };
const CAT_ES = { food: 'comida', housing: 'vivienda', utilities: 'facturas de servicios', healthcare: 'atención médica', mental_health: 'apoyo emocional', school_childcare: 'escuela y cuidado de niños', employment: 'encontrar trabajo', transportation: 'transporte', cash_assistance: 'dinero para facturas', legal: 'problemas legales' };

function firstNeedCategory(match, needs) {
  return URGENT_FIRST.find((c) => needs.includes(c) && match.matchedCategories.includes(c)) || match.matchedCategories[0] || match.resource.categories?.[0];
}

function actionFor(r, t) {
  if (r.walk_in && r.address) return t.visit(r);
  if (r.phone) return t.call(r);
  return t.apply(r);
}

/** Build a complete action plan without AI, from matchResources() output. */
export function buildRulePlan(match, language = 'en') {
  const t = T[language] || T.en;
  const needs = match.profile.needs.length ? match.profile.needs : URGENT_FIRST;
  const results = match.results.filter((m) => !m.fallback);

  const today = [];
  const used = new Set();
  const todayCats = [];
  for (const cat of URGENT_FIRST.filter((c) => needs.includes(c))) {
    if (today.length >= 3) break;
    const m = results.find((x) => !used.has(x.resource.id) && x.matchedCategories.includes(cat) && (x.resource.phone || x.resource.walk_in) && x.level !== 'worth_checking')
      || results.find((x) => !used.has(x.resource.id) && x.matchedCategories.includes(cat));
    if (!m) continue;
    used.add(m.resource.id);
    todayCats.push(cat);
    today.push({ action: actionFor(m.resource, t), resource_id: m.resource.id, why: t.whyUrgent(cat) });
  }

  const this_week = results
    .filter((x) => !used.has(x.resource.id) && x.level !== 'worth_checking')
    .slice(0, 4)
    .map((x) => {
      used.add(x.resource.id);
      return { action: x.resource.apply_online ? t.apply(x.resource) : actionFor(x.resource, t), resource_id: x.resource.id, why: t.whyNext(firstNeedCategory(x, needs)) };
    });

  const fallbacks = today.map((step, i) => {
    const cat = todayCats[i];
    const alt = results.find((x) => !used.has(x.resource.id) && x.matchedCategories.includes(cat));
    const first = results.find((x) => x.resource.id === step.resource_id).resource;
    if (alt) {
      used.add(alt.resource.id);
      return { if: t.ifNo(first), then: t.thenTry(alt.resource), resource_id: alt.resource.id };
    }
    return { if: t.ifNo(first), then: t.then211, resource_id: FALLBACK_211.id };
  });

  return {
    today,
    bring: collectDocuments(match, language),
    this_week,
    fallbacks,
    encouragement: t.encouragement,
    source: 'rules',
  };
}

/** Combined, de-duplicated document checklist for the plan. */
export function collectDocuments(match, language = 'en') {
  const t = T[language] || T.en;
  const docs = [...t.core];
  if ((match.profile.children_count ?? 0) > 0 || match.profile.child_under_5) docs.push(...t.kidsDocs);
  if (language === 'en') {
    const seen = new Set(docs.map(normalizeDoc));
    for (const m of match.results.slice(0, 12)) {
      for (const d of m.resource.documents_needed || []) {
        const key = normalizeDoc(d);
        if (!key || seen.has(key) || [...seen].some((s) => s.includes(key) || key.includes(s))) continue;
        seen.add(key);
        docs.push(d);
      }
    }
  }
  return docs.slice(0, 10);
}

function normalizeDoc(d) {
  const s = String(d || '').toLowerCase();
  if (/photo id|identification|driver|state id|picture id/.test(s)) return 'photo id';
  if (/address|residen|lease|utility bill/.test(s)) return 'address';
  if (/income|pay ?stub|paycheck|earnings|wage/.test(s)) return 'income';
  if (/birth cert/.test(s)) return 'birth certificate';
  if (/social security|ssn/.test(s)) return 'social security';
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Validate an AI-generated plan against the allowed resource ids. Returns a cleaned plan or null
 * if it is unusable. Steps that reference unknown resources are dropped (the AI may not invent programs).
 */
export function sanitizeAiPlan(plan, allowedIds) {
  if (!plan || typeof plan !== 'object') return null;
  const ids = new Set(allowedIds);
  const str = (v, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const steps = (arr) =>
    (Array.isArray(arr) ? arr : [])
      .map((s) => ({ action: str(s?.action), resource_id: str(s?.resource_id, 120), why: str(s?.why) }))
      .filter((s) => s.action && ids.has(s.resource_id));
  const out = {
    today: steps(plan.today).slice(0, 3),
    bring: (Array.isArray(plan.bring) ? plan.bring : []).map((b) => str(b, 160)).filter(Boolean).slice(0, 10),
    this_week: steps(plan.this_week).slice(0, 5),
    fallbacks: (Array.isArray(plan.fallbacks) ? plan.fallbacks : [])
      .map((f) => ({ if: str(f?.if), then: str(f?.then), resource_id: ids.has(str(f?.resource_id, 120)) ? str(f?.resource_id, 120) : null }))
      .filter((f) => f.if && f.then)
      .slice(0, 5),
    encouragement: str(plan.encouragement, 300),
    source: 'ai',
  };
  if (!out.today.length) return null;
  return out;
}
