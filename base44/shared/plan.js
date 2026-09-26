// Action plans: the rule-based fallback plan (spec 6B fallback) and validation of AI plans.
import { unsupportedFacts, allText } from './guard.js';

const T = {
  en: {
    call: (r) => `Call ${r.name}${r.phone ? ` at ${r.phone}` : ''}.`,
    apply: (r) => `Apply for ${r.name}${r.apply_url ? ' online' : ''}.`,
    contact: (r) => `Contact ${r.name}.`,
    why: (r) => r.what_it_gives_en || '',
    tonight: 'Ask your neighbors for dinner tonight.',
    ifFood: 'If you still need food this week',
    ifStuck: 'If you feel stuck',
    ifBills: "If you can't pay a bill",
    then: (r) => `Try ${r.name}${r.phone ? ` (${r.phone})` : ''}.`,
    then211: 'Dial 2-1-1 for free local help, any time.',
    encouragement: "You're taking the right steps for your family. Help is out there, and you don't have to find it alone.",
    core: ['Photo ID', 'Proof of address', 'Proof of income (or a letter showing you lost your job)'],
    kids: ["Your children's birth certificates"],
  },
  es: {
    call: (r) => `Llama a ${r.name_es || r.name}${r.phone ? ` al ${r.phone}` : ''}.`,
    apply: (r) => `Solicita ${r.name_es || r.name}${r.apply_url ? ' en línea' : ''}.`,
    contact: (r) => `Comunícate con ${r.name_es || r.name}.`,
    why: (r) => r.what_it_gives_es || r.what_it_gives_en || '',
    tonight: 'Pide la cena a tus vecinos.',
    ifFood: 'Si todavía necesitas comida esta semana',
    ifStuck: 'Si te sientes sin salida',
    ifBills: 'Si no puedes pagar una factura',
    then: (r) => `Prueba ${r.name_es || r.name}${r.phone ? ` (${r.phone})` : ''}.`,
    then211: 'Marca 2-1-1 para recibir ayuda local gratis, a cualquier hora.',
    encouragement: 'Estás dando los pasos correctos para tu familia. Hay ayuda, y no tienes que buscarla solo.',
    core: ['Identificación con foto', 'Comprobante de domicilio', 'Comprobante de ingresos (o una carta que muestre que perdiste tu trabajo)'],
    kids: ['Actas de nacimiento de tus hijos'],
  },
};

function actionFor(r, t) {
  if (r.apply_online && r.apply_url) return t.apply(r);
  if (r.phone) return t.call(r);
  return t.contact(r);
}

/** Combined, de-duplicated document checklist. */
export function collectDocuments(match, language = 'en') {
  const t = T[language] || T.en;
  const docs = [...t.core];
  if ((match.profile.children_count ?? 0) > 0 || match.profile.child_under_5) docs.push(...t.kids);
  const seen = new Set(docs.map(normalizeDoc));
  for (const m of match.results.slice(0, 10)) {
    const list = language === 'es' && m.resource.documents_es?.length ? m.resource.documents_es : language === 'en' ? m.resource.documents || [] : [];
    for (const d of list) {
      const key = normalizeDoc(d);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      docs.push(d);
    }
  }
  return docs.slice(0, 8);
}

function normalizeDoc(d) {
  const s = String(d || '').toLowerCase();
  if (/photo id|identification|identificaci|driver|state id|licencia/.test(s)) return 'photo id';
  if (/address|residen|lease|domicilio/.test(s)) return 'address';
  if (/income|pay ?stub|paycheck|earnings|ingresos|talones/.test(s)) return 'income';
  if (/birth cert|acta/.test(s)) return 'birth certificate';
  if (/social security|ssn|seguro social/.test(s)) return 'social security';
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Rule-based plan: top 3 by score → today, next 5 → this week, union of documents → bring,
 * 2-1-1 + food bank → fallbacks.
 */
export function buildRulePlan(match, language = 'en', { tonightAvailable = false } = {}) {
  const t = T[language] || T.en;
  const ranked = match.results.filter((m) => !m.fallback && !m.resource.is_crisis);
  const step = (m) => ({ action: actionFor(m.resource, t), resource_id: m.resource.id, why: t.why(m.resource) });
  // Today: the best general program for each urgent need (child-specific programs like WIC or school
  // meals come next, this week). Then the next 5 by score.
  const URGENT_ORDER = ['food', 'housing', 'utilities', 'employment', 'healthcare', 'mental_health', 'cash_assistance', 'school_childcare', 'transportation', 'legal'];
  const childOnly = (m) => m.resource.signals?.child_under_5 || m.resource.signals?.needs_children;
  const todayPicks = [];
  for (const cat of URGENT_ORDER.filter((c) => match.profile.needs.includes(c))) {
    if (todayPicks.length >= 3) break;
    const pick = ranked.find((m) => !todayPicks.includes(m) && m.matchedCategories.includes(cat) && !childOnly(m) && m.resource.origin !== 'research');
    if (pick) todayPicks.push(pick);
  }
  for (const m of ranked) if (todayPicks.length < 3 && !todayPicks.includes(m)) todayPicks.push(m);
  const today = todayPicks.map(step);
  const this_week = ranked.filter((m) => !todayPicks.includes(m)).slice(0, 5).map(step);

  const fallbacks = [];
  const foodBank = match.results.find((m) => m.resource.program_key === 'food_bank' && !today.concat(this_week).some((s) => s.resource_id === m.resource.id));
  if (foodBank && match.profile.needs.includes('food')) fallbacks.push({ if: t.ifFood, then: t.then(foodBank.resource), resource_id: foodBank.resource.id });
  const energy = match.results.find((m) => m.resource.program_key === 'energy_help' && !today.concat(this_week).some((s) => s.resource_id === m.resource.id));
  if (energy && match.profile.needs.includes('utilities')) fallbacks.push({ if: t.ifBills, then: t.then(energy.resource), resource_id: energy.resource.id });
  const two11 = match.results.find((m) => m.resource.program_key === 'two_one_one');
  fallbacks.push({ if: t.ifStuck, then: t.then211, resource_id: two11?.resource.id || null });

  return {
    tonight: { show: !!tonightAvailable, message: t.tonight },
    today,
    this_week,
    bring: collectDocuments(match, language),
    fallbacks,
    encouragement: t.encouragement,
    source: 'rules',
  };
}

/**
 * Validate an AI plan against the allowed resource ids. Steps that reference unknown resources are
 * dropped (the AI may not invent programs). Returns null if the plan is unusable.
 */
export function sanitizeAiPlan(plan, allowedIds, { tonightAvailable = false, sourceText = null } = {}) {
  if (!plan || typeof plan !== 'object') return null;
  const ids = new Set(allowedIds);
  const str = (v, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const steps = (arr, max) =>
    (Array.isArray(arr) ? arr : [])
      .map((s) => ({ action: str(s?.action), resource_id: str(s?.resource_id, 120), why: str(s?.why) }))
      .filter((s) => s.action && ids.has(s.resource_id))
      .slice(0, max);
  const out = {
    tonight: { show: !!tonightAvailable && plan.tonight?.show !== false, message: str(plan.tonight?.message, 160) },
    today: steps(plan.today, 3),
    this_week: steps(plan.this_week, 5),
    bring: (Array.isArray(plan.bring) ? plan.bring : []).map((b) => str(b, 160)).filter(Boolean).slice(0, 8),
    fallbacks: (Array.isArray(plan.fallbacks) ? plan.fallbacks : [])
      .map((f) => ({ if: str(f?.if), then: str(f?.then), resource_id: ids.has(str(f?.resource_id, 120)) ? str(f?.resource_id, 120) : null }))
      .filter((f) => f.if && f.then)
      .slice(0, 4),
    encouragement: str(plan.encouragement, 300),
    source: 'ai',
  };
  if (!out.today.length) return null;
  // Reject plans that mention a phone number, URL or dollar amount we did not supply.
  if (sourceText !== null && unsupportedFacts(allText(out), sourceText).length) return null;
  return out;
}
