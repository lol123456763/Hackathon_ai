export const categories = ['food','housing','utilities','healthcare','school_childcare','employment','transportation','cash_assistance','legal','mental_health'];
export const situations = ['lost_job','single_parent','pregnant','veteran','senior','disability','student','unhoused','uninsured'];
const ranges = [
  ['NY',5,5],['PR',6,9],['VI',8,8],['MA',10,27],['RI',28,29],['NH',30,38],['ME',39,49],
  ['VT',50,59],['CT',60,69],['NJ',70,89],['NY',100,149],['PA',150,196],['DE',197,199],
  ['DC',200,205],['VA',201,201],['VA',206,246],['WV',247,268],['NC',270,289],['SC',290,299],
  ['GA',300,319],['FL',320,349],['AL',350,369],['TN',370,385],['MS',386,397],['GA',398,399],
  ['KY',400,427],['OH',430,459],['IN',460,479],['MI',480,499],['IA',500,528],['WI',530,549],
  ['MN',550,567],['SD',570,577],['ND',580,588],['MT',590,599],['IL',600,629],['MO',630,658],
  ['KS',660,679],['NE',680,693],['LA',700,715],['AR',716,729],['OK',730,749],['TX',750,799],
  ['CO',800,816],['WY',820,831],['ID',832,838],['UT',840,847],['AZ',850,865],['NM',870,884],
  ['NV',889,898],['CA',900,961],['HI',967,968],['OR',970,979],['WA',980,994],['AK',995,999]
];
export function stateFromZip(zip) {
  if (!/^\d{5}$/.test(String(zip))) return null;
  const prefix = Number(String(zip).slice(0,3));
  // Prefix boundaries have a few shared/exceptional ZIPs. Only use a range for
  // broad state matching, never as an official eligibility determination.
  if (prefix === 201) return 'VA';
  return ranges.find(([,lo,hi]) => prefix >= lo && prefix <= hi)?.[0] || null;
}
export function cleanProfile(input = {}) {
  const zip = /^\d{5}$/.test(String(input.zip || '')) ? String(input.zip) : '';
  const hs = Number(input.household_size);
  const cc = Number(input.children_count);
  return {
    zip, household_size: Number.isInteger(hs) && hs >= 1 && hs <= 10 ? hs : null,
    children_count: Number.isInteger(cc) && cc >= 0 && cc <= 10 ? cc : null,
    child_under_5: typeof input.child_under_5 === 'boolean' ? input.child_under_5 : null,
    income_range: ['$0','under_1000','1000_2000','2000_3000','3000_4500','4500_plus','prefer_not'].includes(input.income_range) ? input.income_range : null,
    situations: Array.isArray(input.situations) ? [...new Set(input.situations.filter(v => situations.includes(v)))] : [],
    needs: Array.isArray(input.needs) ? [...new Set(input.needs.filter(v => categories.includes(v)))] : [],
    urgency: ['today','week','month'].includes(input.urgency) ? input.urgency : null,
    language: input.language === 'es' ? 'es' : 'en', crisis_flag:input.crisis_flag===true
  };
}
export function localExtract(text = '') {
  const s = String(text).slice(0, 3000).toLowerCase();
  const es = /\b(soy|estoy|necesito|hijos?|trabajo|comida|alquiler|factura|sin hogar|ayuda)\b/i.test(s);
  const zip = s.match(/\b\d{5}\b/)?.[0] || null;
  const kids = s.match(/\b(\d+)\s+(?:kids?|children|hijos?|niños?)\b/) || s.match(/\b(?:kids?|children|hijos?|niños?)\s*[:=]?\s*(\d+)\b/);
  const children_count = kids ? Math.min(10, Number(kids[1])) : null;
  const household = s.match(/\b(?:family|household|familia|hogar)\s+(?:of|de)\s+(\d+)\b/);
  const impliedHousehold = children_count != null && /single (mom|mother|dad|father|parent)|madre soltera|padre soltero/.test(s) ? children_count+1 : null;
  const needs = [];
  const patterns = {
    food:/food|grocer|pantr|hungr|comida|alimento|despensa|sn a p|snap/,
    housing:/rent|hous|evict|shelter|homeless|alquiler|renta|vivienda|desalojo|sin hogar/,
    utilities:/utilit|electric|power bill|energy|agua|luz|factura|servicio|energía/,
    healthcare:/health|medic|doctor|insurance|salud|médic|seguro/,
    school_childcare:/school|childcare|daycare|preschool|escuela|guardería|cuidado infantil/,
    employment:/job|work|employ|trabajo|empleo|desempleo/,
    transportation:/transport|bus|transit|ride|transporte|autobús/,
    cash_assistance:/cash|money|income|dinero|ingresos|efectivo/,
    legal:/legal|lawyer|attorney|abogad|jurídic/,
    mental_health:/mental|anxiety|depress|crisis|salud mental|ansiedad|depresión/
  };
  for (const [key, pattern] of Object.entries(patterns)) if (pattern.test(s)) needs.push(key);
  const flags = {
    lost_job:/lost (my |his |her |their )?job|laid off|unemploy|perdí.*trabajo|sin trabajo|desemplead/,
    single_parent:/single (mom|mother|dad|father|parent)|madre soltera|padre soltero/,
    pregnant:/pregnan|embarazad/,
    veteran:/veteran|veteran[oa]/,
    senior:/senior|retired|adulto mayor|jubilad/,
    disability:/disab|disabled|discapacidad/,
    student:/student|estudiante/,
    unhoused:/homeless|unhoused|evict|sin hogar|desalojo/,
    uninsured:/no (health )?insurance|uninsured|sin seguro/
  };
  const found = Object.entries(flags).filter(([,pattern]) => pattern.test(s)).map(([key]) => key);
  if (found.includes('lost_job')) for (const n of ['employment','cash_assistance']) if (!needs.includes(n)) needs.push(n);
  if (found.includes('uninsured') && !needs.includes('healthcare')) needs.push('healthcare');
  const crisis_flag = /suicid|kill myself|self.harm|hurt myself|domestic violence|abuse|being hurt|immediate danger|suicid|me quiero morir|violencia doméstica|maltrato|peligro inmediato/i.test(s);
  return {zip, household_size:household ? Number(household[1]) : impliedHousehold, children_count,
    child_under_5:/\b(?:age[sd]?|ages|edad(?:es)?|años?)\s*[:=]?\s*[0-4]\b|\b[0-4]\s*(?:year.old|years old|años)\b/i.test(s) ? true : null,
    income_range:null, situations:found, needs, urgency:/today|tonight|hoy|esta noche/i.test(s)?'today':null,
    detected_language:es?'es':'en', crisis_flag};
}
function coverage(resource, zip) {
  if (resource.coverage_type === 'national') return true;
  if (resource.coverage_type === 'state') return stateFromZip(zip) === resource.coverage_state;
  return resource.coverage_zip_codes?.includes(zip) || false;
}
function hardMismatch(rule, profile) {
  if (rule.veteran_only && !profile.situations.includes('veteran')) return true;
  if (rule.pregnant && !profile.situations.includes('pregnant')) return true;
  if (rule.requires_children && profile.children_count === 0) return true;
  if (rule.requires_child_under_5 && profile.child_under_5 === false) return true;
  if (rule.requires_child_under_5_or_pregnant && profile.child_under_5 === false && !profile.situations.includes('pregnant')) return true;
  if (rule.student && !profile.situations.includes('student')) return true;
  if (rule.disability && !profile.situations.includes('disability')) return true;
  if (rule.min_age === 60 && !profile.situations.includes('senior')) return true;
  return false;
}
export function matchResources(resources, rawProfile) {
  const profile = cleanProfile(rawProfile);
  const scored = resources.filter(r => r.is_active && r.id !== '211' && coverage(r, profile.zip))
    .filter(r => r.categories.some(c => profile.needs.includes(c)))
    .filter(r => !hardMismatch(r.eligibility_rules || {}, profile))
    .map(r => {
      const overlap = r.categories.filter(c => profile.needs.includes(c));
      let score = overlap.length * 3 + (r.priority_weight || 0);
      const rule = r.eligibility_rules || {};
      const incomeMax = rule.max_income_monthly_by_household_size?.[profile.household_size];
      const upper = {'$0':0,under_1000:999, '1000_2000':2000, '2000_3000':3000, '3000_4500':4500}[profile.income_range];
      if (incomeMax && upper !== undefined && upper <= incomeMax) score += 2;
      if (rule.veteran_only && profile.situations.includes('veteran')) score += 2;
      if (rule.pregnant && profile.situations.includes('pregnant')) score += 2;
      if (rule.requires_child_under_5 && profile.child_under_5) score += 2;
      if (rule.requires_children && profile.children_count > 0) score += 2;
      const strength = score >= 8 ? 'very_likely' : score >= 5 ? 'possible' : 'worth_checking';
      return {...r, score, strength, matched_categories:overlap,
        why_en:`Matches your need for ${overlap.join(', ').replaceAll('_',' ')}. Check current program rules before applying.`,
        why_es:`Coincide con su necesidad de ${overlap.join(', ').replaceAll('_',' ')}. Confirme las reglas actuales antes de solicitar.`};
    }).sort((a,b) => b.score - a.score || a.name.localeCompare(b.name));
  const fallback = resources.find(r => r.id === '211' && r.is_active);
  return {matches:scored, fallback, state:stateFromZip(profile.zip), out_of_coverage:!stateFromZip(profile.zip)};
}
export function ruleBasedPlan(profile, matches, fallback) {
  const es = profile.language === 'es';
  const useful = matches.filter(r => r.id !== 'findhelp');
  const first = useful.slice(0,3);
  const covered = new Set(first.flatMap(r => r.matched_categories));
  const next = useful.slice(3).sort((a,b) => b.matched_categories.filter(c=>!covered.has(c)).length - a.matched_categories.filter(c=>!covered.has(c)).length || b.score-a.score).slice(0,3);
  const chosen = first.concat(next);
  const labels = {food:['food','alimentos'],housing:['housing','vivienda'],utilities:['utility bills','facturas de servicios'],healthcare:['healthcare','atención médica'],school_childcare:['school or child care','escuela o cuidado infantil'],employment:['work','empleo'],transportation:['transportation','transporte'],cash_assistance:['cash help','ayuda en efectivo'],legal:['legal help','ayuda legal'],mental_health:['mental health','salud mental']};
  const why = r => (es?'Puede ayudar con ':'It may help with ')+r.matched_categories.map(c=>labels[c]?.[es?1:0]||c).join(', ')+'.';
  const today = first.map(r => ({resource_id:r.id,
    action:es?`Visite la página oficial de ${r.name} para ver cómo empezar hoy.`:`Visit the official ${r.name} page to see how to start today.`,
    why:why(r)}));
  if (!today.length && fallback) today.push({resource_id:fallback.id, action:es?'Llame al 211 para conocer ayuda local.':'Call 211 to ask about local help.', why:es?'Pueden buscar opciones cercanas.':'They can look for nearby options.'});
  const this_week = next.map(r => ({resource_id:r.id,
    action:es?`Revise cómo solicitar ayuda de ${r.name}.`:`Review how to apply to ${r.name}.`,
    why:es?'Confirme los requisitos y documentos.':'Check the current rules and documents.'}));
  const bring = [...new Set(chosen.flatMap(r => r.documents_needed || []))];
  const fallbacks = first.length ? first.map(r=>({
    if:es?`Si ${r.name} no puede ayudar`:`If ${r.name} cannot help`,
    then:es?'Llame al 211 y pida otras opciones cercanas.':'Call 211 and ask for other nearby options.',
    resource_id:fallback?.id || null
  })) : [{if:es?'Si una opción no puede ayudar':'If an option cannot help',then:es?'Llame al 211 y pida otras opciones cercanas.':'Call 211 and ask for other nearby options.',resource_id:fallback?.id || null}];
  return {today, bring, this_week, fallbacks,
    encouragement:es?'Un paso a la vez. Ya tiene un lugar por dónde empezar.':'One step at a time. You have a place to start.'};
}
export function validatePlan(plan, allowed) {
  if (!plan || !Array.isArray(plan.today) || !Array.isArray(plan.bring) || !Array.isArray(plan.this_week) || !Array.isArray(plan.fallbacks) || typeof plan.encouragement !== 'string') return false;
  const validStep = x => x && typeof x.action === 'string' && typeof x.why === 'string' && allowed.has(x.resource_id);
  return plan.today.every(validStep) && plan.this_week.every(validStep) && plan.bring.every(x => typeof x === 'string') && plan.fallbacks.every(x => x && typeof x.if === 'string' && typeof x.then === 'string' && (x.resource_id === null || allowed.has(x.resource_id)));
}
