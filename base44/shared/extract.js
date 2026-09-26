// Rule-based situation extraction (English + Spanish). Used when the AI is unavailable, and
// to double-check AI output (e.g., crisis detection never depends on the AI alone).

const WORD_NUMBERS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
};
const NUM = '(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)';
const toNum = (s) => (/^\d+$/.test(s) ? Number(s) : WORD_NUMBERS[s.toLowerCase()] ?? null);

const CRISIS_PATTERNS = [
  /\b(kill|hurt|harm)\s+(myself|me)\b/i,
  /\bsuicid/i,
  /\b(end|take)\s+my\s+(own\s+)?life\b/i,
  /\bdon'?t\s+want\s+to\s+(live|be alive)\b/i,
  /\b(he|she|they|partner|husband|wife|boyfriend|girlfriend)\s+(hits?|beats?|hurts?|abuses?|threatens?)\b/i,
  /\b(domestic\s+violence|being\s+abused|abusive)\b/i,
  /\bnot\s+safe\s+(at\s+home|here)\b/i,
  /\b(don'?t|do\s+not)\s+feel\s+safe\b/i,
  /\b(don'?t|do\s+not)\s+want\s+to\s+(be\s+here|live|be\s+alive|wake\s+up)\b/i,
  /\b(want|going)\s+to\s+die\b/i,
  /\bno\s+(me\s+siento|estoy)\s+segur[oa]\b/i,
  /\bno\s+quiero\s+(vivir|estar\s+aqu[ií]|seguir)\b/i,
  /\bquiero\s+morir(me)?\b/i,
  /\b(quitarme\s+la\s+vida|suicidarme|matarme|hacerme\s+daño)\b/i,
  /\b(me\s+(pega|golpea|maltrata|amenaza))\b/i,
  /\b(violencia\s+(doméstica|domestica)|no\s+estoy\s+segura?\s+en\s+casa)\b/i,
];

const NEED_PATTERNS = {
  food: /\b(food|groceries|grocery|hungry|eat|meals?|snap|food stamps|pantry|comida|hambre|despensa|alimentos?|estampillas)\b/i,
  housing: /\b(rent|evict|eviction|homeless|shelter|housing|apartment|mortgage|renta|alquiler|desalojo|vivienda|refugio|sin hogar|hipoteca)\b/i,
  utilities: /\b(electric|electricity|light bill|power bill|utility|utilities|water bill|gas bill|bills?|shut ?off|disconnect|luz|electricidad|factura|recibo|agua|gas)\b/i,
  healthcare: /\b(doctor|medical|medicine|insurance|clinic|health|sick|prescription|dental|medicaid|chip|médico|medico|medicina|seguro|clínica|clinica|salud|enferm)/i,
  mental_health: /\b(depress|anxiety|anxious|stress|mental|counsel|therap|panic|ansiedad|depresi|estrés|estres|salud mental|terapia)/i,
  school_childcare: /\b(school|daycare|day care|child ?care|supplies|uniform|pre-?k|head start|escuela|guardería|guarderia|cuidado de niños|útiles|utiles)\b/i,
  employment: /\b(job|work|employ|unemploy|laid off|fired|hiring|resume|trabajo|empleo|desempleo|despid)/i,
  transportation: /\b(bus|car|ride|transport|gas money|transit|carro|coche|transporte|camión|camion|autobús|autobus)\b/i,
  cash_assistance: /\b(cash|money|pay bills|tanf|dinero|efectivo)\b/i,
  legal: /\b(lawyer|legal|court|eviction notice|custody|immigration|abogado|corte|inmigración|inmigracion|custodia)\b/i,
};

const SITUATION_PATTERNS = {
  job_loss: /\b(lost (my|his|her|their|our) job|laid off|got fired|unemployed|lost work|out of work|perd[ií](ó|o)? (el|mi|su) trabajo|me despidieron|lo despidieron|la despidieron|sin trabajo|desemplead)/i,
  single_parent: /\b(single (mom|mother|dad|father|parent)|madre soltera|padre soltero|mamá soltera|mama soltera)\b/i,
  pregnant: /\b(pregnant|expecting a baby|embarazada)\b/i,
  veteran: /\b(veteran|served in the (army|navy|military|marines|air force)|veterano|veterana)\b/i,
  senior: /\b(senior|elderly|retired|over (6\d|7\d|8\d)|(6\d|7\d|8\d) years old|jubilad|anciano|tercera edad|adulto mayor)\b/i,
  disability: /\b(disab|wheelchair|ssi\b|ssdi|discapacidad|discapacitad)/i,
  student: /\b(student|college|university|estudiante|universidad)\b/i,
  unhoused: /\b(homeless|sleeping in (my|our|the) car|no place to (live|stay)|evicted|sin hogar|durmiendo en (el|mi) carro|nos desalojaron)\b/i,
  uninsured: /\b(no (health )?insurance|uninsured|sin seguro)\b/i,
};

const OUT_OF_FOOD = /(almost out of food|out of food|nothing to eat|no food (left|at home)|haven'?t eaten|casi no (nos )?queda comida|no (nos )?queda comida|no tenemos (nada de )?comida|sin comida|no hay comida)/i;

export function detectCrisis(text) {
  return CRISIS_PATTERNS.some((re) => re.test(text || ''));
}

export function detectLanguage(text) {
  const t = ` ${(text || '').toLowerCase()} `;
  const es = (t.match(/\s(el|la|los|las|que|mi|mis|tengo|necesito|para|con|ayuda|niños|hijos|trabajo|comida|somos|estoy|y)\s/g) || []).length;
  const en = (t.match(/\s(the|my|i|we|need|help|with|and|have|kids|job|food|are|is|our)\s/g) || []).length;
  return es > en ? 'es' : 'en';
}

/** Extract a partial profile from free text. Returns the same shape as the AI extractor. */
export function extractSituation(text) {
  const t = String(text || '');
  const lower = t.toLowerCase();
  const out = {
    zip: null,
    household_size: null,
    children_count: null,
    child_under_5: null,
    income_range: null,
    situations: [],
    needs: [],
    urgency: null,
    detected_language: detectLanguage(t),
    crisis_flag: detectCrisis(t),
    tonight_need: false,
    food_prefs: [],
  };

  const zip = t.match(/\b(7[5-9]\d{3}|885\d{2}|\d{5})\b/);
  if (zip) out.zip = zip[1];

  const hh =
    lower.match(new RegExp(`\\b${NUM}\\s+(people|persons|of us|in (our|my) (house|home|family|household)|personas|somos)`, 'i')) ||
    lower.match(new RegExp(`\\b(family|household|familia|hogar) of\\s+${NUM}\\b`, 'i')) ||
    lower.match(new RegExp(`\\b(familia|hogar) de\\s+${NUM}\\b`, 'i')) ||
    lower.match(new RegExp(`\\bsomos\\s+${NUM}\\b`, 'i'));
  if (hh) {
    const n = toNum(hh.slice(1).find((g) => g && toNum(g) !== null) || '');
    if (n) out.household_size = n;
  }

  const kids = lower.match(new RegExp(`\\b${NUM}\\s+(kids|children|child|sons|daughters|niños|ninos|hijos|hijas|niñas)\\b`, 'i'));
  if (kids) out.children_count = toNum(kids[1]);
  else if (/\b(a|one|my|un|una|mi)\s+(kid|child|son|daughter|baby|hijo|hija|bebé|bebe)\b/i.test(lower)) out.children_count = 1;

  // Children's ages: "ages 3 and 8", "3-year-old", "de 3 años"
  const ages = [...lower.matchAll(/\b(\d{1,2})[\s-]*(year|yr|años|anos)/g)].map((m) => Number(m[1]));
  const agesList = lower.match(/\bages?\s+((\d{1,2})(\s*(,|and|y|&)\s*\d{1,2})*)/);
  if (agesList) ages.push(...agesList[1].split(/\D+/).filter(Boolean).map(Number));
  const agePair = lower.match(/(\d{1,2})\s*(?:,|y|and|&)\s*(\d{1,2})\s*(?:años|anos|years|yrs)/);
  if (agePair) ages.push(Number(agePair[1]), Number(agePair[2]));
  if (/\b(baby|infant|toddler|newborn|bebé|bebe|recién nacido)\b/i.test(lower)) ages.push(0);
  if (ages.length) out.child_under_5 = ages.some((a) => a < 5);

  if (out.household_size === null && out.children_count) {
    const parents = /\b(single|soltera|soltero)\b/i.test(lower) ? 1 : null;
    if (parents) out.household_size = parents + out.children_count;
  }

  const money = lower.match(/\$\s?(\d[\d,]*)(\s*(a|per|\/)\s*(month|mo|mes))?/);
  if (money && money[2]) {
    const v = Number(money[1].replace(/,/g, ''));
    out.income_range = v === 0 ? 'none' : v < 1000 ? 'under_1000' : v <= 2000 ? '1000_2000' : v <= 3000 ? '2000_3000' : v <= 4500 ? '3000_4500' : 'over_4500';
  } else if (/\b(no income|zero income|sin ingresos|no tenemos ingresos)\b/i.test(lower)) {
    out.income_range = 'none';
  }

  for (const [need, re] of Object.entries(NEED_PATTERNS)) if (re.test(lower)) out.needs.push(need);
  for (const [sit, re] of Object.entries(SITUATION_PATTERNS)) if (re.test(lower)) out.situations.push(sit);
  if (out.situations.includes('job_loss') && !out.needs.includes('employment')) out.needs.push('employment');
  if (out.situations.includes('uninsured') && !out.needs.includes('healthcare')) out.needs.push('healthcare');
  if (out.crisis_flag && !out.needs.includes('mental_health')) out.needs.push('mental_health');

  if (/\b(today|tonight|right now|immediately|urgent|emergency|hoy|ahora|urgente|esta noche)\b/i.test(lower) || OUT_OF_FOOD.test(lower)) out.urgency = 'today';
  else if (/\b(this week|few days|shut ?off notice|evict|esta semana|pocos días)\b/i.test(lower)) out.urgency = 'week';

  if (OUT_OF_FOOD.test(lower) && !out.needs.includes('food')) out.needs.push('food');
  out.tonight_need = out.urgency === 'today' && out.needs.includes('food');
  if (/\b(no pork|without pork|sin cerdo|sin puerco|no como cerdo)\b/i.test(lower)) out.food_prefs.push('no_pork');
  if (/\b(vegetarian[oa]?s?)\b/i.test(lower)) out.food_prefs.push('vegetarian');
  if (/\bhalal\b/i.test(lower)) out.food_prefs.push('halal');
  return out;
}

/**
 * Merge AI extraction with rule-based extraction. AI values win when valid; rules fill gaps.
 * Crisis detection is OR-ed so a missed AI flag never hides the crisis panel.
 */
export function mergeExtraction(ai, text, { categories, situations, incomeRanges, urgencies }) {
  const rules = extractSituation(text);
  const a = ai && typeof ai === 'object' ? ai : {};
  const pickNum = (v, min, max) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : null);
  const zip = typeof a.zip === 'string' && /^\d{5}$/.test(a.zip) && text.includes(a.zip) ? a.zip : rules.zip;
  const list = (v, allowed) => (Array.isArray(v) ? [...new Set(v.filter((x) => allowed.includes(x)))] : []);
  return {
    zip,
    household_size: pickNum(a.household_size, 1, 20) ?? rules.household_size,
    children_count: pickNum(a.children_count, 0, 15) ?? rules.children_count,
    child_under_5: typeof a.child_under_5 === 'boolean' ? a.child_under_5 : rules.child_under_5,
    income_range: incomeRanges.includes(a.income_range) ? a.income_range : rules.income_range,
    situations: [...new Set([...list(a.situations, situations), ...rules.situations])],
    needs: [...new Set([...list(a.needs, categories), ...rules.needs])],
    urgency: urgencies.includes(a.urgency) ? a.urgency : rules.urgency,
    detected_language: a.detected_language === 'es' || a.detected_language === 'en' ? a.detected_language : rules.detected_language,
    crisis_flag: a.crisis_flag === true || rules.crisis_flag,
    food_prefs: [...new Set([...list(a.food_prefs, ['vegetarian', 'no_pork', 'halal']), ...rules.food_prefs])],
    understood_summary_en: typeof a.understood_summary_en === 'string' ? a.understood_summary_en.slice(0, 300) : null,
    understood_summary_es: typeof a.understood_summary_es === 'string' ? a.understood_summary_es.slice(0, 300) : null,
  };
}

/** Final touches shared by the AI and rule-based paths. */
export function finalizeExtraction(x) {
  const needs = x.needs || [];
  const tonight = x.urgency === 'today' && needs.includes('food');
  return { ...x, tonight_need: tonight || (x.tonight_need === true && needs.includes('food')) };
}
