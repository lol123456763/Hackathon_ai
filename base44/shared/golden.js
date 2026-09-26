// Golden-path examples and GoldenOutput fallbacks (spec 6 + 9C).
// The live AI is ALWAYS tried first. These are used only for the demo scenario, when the AI call
// errors or takes longer than 12 seconds, so the demo never stalls. They are stored in the
// GoldenOutput table on reset, so admins can re-save better outputs without a code change.

export const EXAMPLE_TEXT = {
  en: "I'm a single mom with 2 kids, ages 3 and 8. I just lost my job last week. We live in 78741, I'm behind on the electric bill and we're almost out of food.",
  es: 'Soy mamá soltera con dos niños de 3 y 8 años. Perdí mi trabajo la semana pasada. Vivimos en el 78741, estoy atrasada con la luz y casi no nos queda comida.',
};

export const EXAMPLE_NOTE = {
  es: '¡Gracias! A mis hijos les encantaron las conchas.',
  en: 'Thank you! My kids loved the conchas.',
};

const INTAKE = {
  zip: '78741',
  household_size: 3,
  children_count: 2,
  child_under_5: true,
  income_range: null,
  situations: ['job_loss', 'single_parent'],
  needs: ['food', 'utilities', 'employment'],
  urgency: 'today',
  tonight_need: true,
  food_prefs: [],
  crisis_flag: false,
  understood_summary_en: 'A family of 3 with two kids (one under 5), who just lost a job and needs food today and help with the electric bill.',
  understood_summary_es: 'Una familia de 3 con dos niños (uno menor de 5), que acaba de perder el trabajo y necesita comida hoy y ayuda con la factura de luz.',
};

const PLAN_IDS = {
  snap: 'snap-texas',
  energy: 'austin-energy-bill-help',
  twc: 'twc-unemployment',
  wic: 'wic-texas',
  chip: 'medicaid-chip-texas',
  headStart: 'child-inc-head-start',
  aisd: 'austin-isd-school-meals',
  wfs: 'workforce-solutions-capital-area',
  foodBank: 'central-texas-food-bank',
  ceap: 'ceap-texas',
  twoOneOne: 'two-one-one-texas',
};

export const GOLDEN_OUTPUTS = {
  intake_en: { ...INTAKE, detected_language: 'en' },
  intake_es: { ...INTAKE, detected_language: 'es' },

  plan_en: {
    tonight: { show: true, message: 'Ask your neighbors for dinner tonight.' },
    today: [
      { action: 'Apply for SNAP at YourTexasBenefits.com and ask for expedited SNAP. If you qualify, it can arrive within 7 days.', resource_id: PLAN_IDS.snap, why: 'Food is your most urgent need.' },
      { action: 'Call Austin Energy about bill help before your due date.', resource_id: PLAN_IDS.energy, why: 'Calling early can stop a shut-off and may lower your bill.' },
      { action: 'File for unemployment with the Texas Workforce Commission.', resource_id: PLAN_IDS.twc, why: 'You lost your job last week. File as soon as possible.' },
    ],
    this_week: [
      { action: 'Make a WIC appointment for your 3-year-old.', resource_id: PLAN_IDS.wic, why: 'WIC helps children under 5.' },
      { action: "Apply for Children's Medicaid or CHIP for both kids.", resource_id: PLAN_IDS.chip, why: 'Free or low-cost health coverage for your children.' },
      { action: 'Ask Child Inc. about Head Start for your 3-year-old.', resource_id: PLAN_IDS.headStart, why: 'Free early learning and care while you look for work.' },
      { action: 'Apply for Austin ISD school meals for your 8-year-old.', resource_id: PLAN_IDS.aisd, why: 'Free or reduced-price breakfast and lunch at school.' },
      { action: 'Visit Workforce Solutions Capital Area for free job help.', resource_id: PLAN_IDS.wfs, why: 'Job search, training and child care help.' },
    ],
    bring: ['Photo ID', 'Proof of address', 'Proof of income or a letter showing you lost your job', "Your children's birth certificates", 'Social Security numbers for household members (if you have them)'],
    fallbacks: [
      { if: 'If SNAP takes too long', then: 'Use the Central Texas Food Bank pantry finder for free food this week.', resource_id: PLAN_IDS.foodBank },
      { if: "If you can't pay the electric bill", then: 'Ask about Texas energy assistance (CEAP) through your local agency.', resource_id: PLAN_IDS.ceap },
      { if: 'If you feel stuck', then: 'Dial 2-1-1 for free local help, any time.', resource_id: PLAN_IDS.twoOneOne },
    ],
    encouragement: "You're taking the right steps for your family. Help is on the way.",
  },

  plan_es: {
    tonight: { show: true, message: 'Pide la cena a tus vecinos.' },
    today: [
      { action: 'Solicita SNAP en YourTexasBenefits.com y pide SNAP acelerado. Si calificas, puede llegar en 7 días.', resource_id: PLAN_IDS.snap, why: 'La comida es tu necesidad más urgente.' },
      { action: 'Llama a Austin Energy para pedir ayuda con tu factura antes de la fecha de pago.', resource_id: PLAN_IDS.energy, why: 'Llamar a tiempo puede evitar un corte y podría bajar tu factura.' },
      { action: 'Solicita el seguro de desempleo con la Comisión de la Fuerza Laboral de Texas (TWC).', resource_id: PLAN_IDS.twc, why: 'Perdiste tu trabajo la semana pasada. Solicítalo lo antes posible.' },
    ],
    this_week: [
      { action: 'Haz una cita de WIC para tu niño de 3 años.', resource_id: PLAN_IDS.wic, why: 'WIC ayuda a niños menores de 5 años.' },
      { action: 'Solicita Medicaid para Niños o CHIP para tus dos hijos.', resource_id: PLAN_IDS.chip, why: 'Seguro médico gratis o a bajo costo para tus hijos.' },
      { action: 'Pregunta en Child Inc. por Head Start para tu niño de 3 años.', resource_id: PLAN_IDS.headStart, why: 'Educación y cuidado gratis mientras buscas trabajo.' },
      { action: 'Solicita las comidas escolares de Austin ISD para tu niño de 8 años.', resource_id: PLAN_IDS.aisd, why: 'Desayuno y almuerzo gratis o a precio reducido en la escuela.' },
      { action: 'Visita Workforce Solutions Capital Area para ayuda gratis con empleo.', resource_id: PLAN_IDS.wfs, why: 'Búsqueda de trabajo, capacitación y ayuda con el cuidado de niños.' },
    ],
    bring: ['Identificación con foto', 'Comprobante de domicilio', 'Comprobante de ingresos o una carta que muestre que perdiste tu trabajo', 'Actas de nacimiento de tus hijos', 'Números de Seguro Social de tu hogar (si los tienen)'],
    fallbacks: [
      { if: 'Si SNAP tarda mucho', then: 'Usa el buscador de despensas del Central Texas Food Bank para conseguir comida gratis esta semana.', resource_id: PLAN_IDS.foodBank },
      { if: 'Si no puedes pagar la luz', then: 'Pregunta por la ayuda de energía de Texas (CEAP) en tu agencia local.', resource_id: PLAN_IDS.ceap },
      { if: 'Si te sientes sin salida', then: 'Marca 2-1-1 para recibir ayuda local gratis, a cualquier hora.', resource_id: PLAN_IDS.twoOneOne },
    ],
    encouragement: 'Estás dando los pasos correctos para tu familia. La ayuda ya viene en camino.',
  },

  photo_post: {
    items: [
      { name_en: 'Bolillos (bread rolls)', name_es: 'Bolillos', quantity_text: 'about 30', est_lbs: 9, category: 'bakery', storage: 'shelf_stable', tags: ['vegetarian'] },
      { name_en: 'Conchas (sweet bread)', name_es: 'Conchas', quantity_text: 'about 20', est_lbs: 6, category: 'bakery', storage: 'shelf_stable', tags: ['vegetarian'] },
      { name_en: 'Rice & beans trays', name_es: 'Bandejas de arroz con frijoles', quantity_text: '10 trays', est_lbs: 25, category: 'prepared', storage: 'cold', tags: ['vegetarian'] },
    ],
    total_lbs: 40,
    possible_allergens: ['wheat', 'milk', 'eggs'],
    handling_en: 'Keep trays cold. Deliver within 2 hours.',
    handling_es: 'Mantén las bandejas frías. Entrega en menos de 2 horas.',
    suggested_pickup: { start: '17:00', end: '18:00' },
    safety_flags: [],
    label_en: 'Bolillos, conchas, rice & beans · Made today · Possible allergens: wheat, milk, eggs · Keep trays cold',
    label_es: 'Bolillos, conchas, arroz con frijoles · Hecho hoy · Posibles alérgenos: trigo, leche, huevo · Mantener las bandejas frías',
    confidence: 'high',
  },

  mission_brief: {
    title_en: 'Bakery run: Maple & Masa → Riverside Community Fridge',
    title_es: 'Entrega de panadería: Maple & Masa → Riverside Community Fridge',
    brief_en: "Team, tonight's run is a short walk: about 40 lbs of fresh bread and rice & beans from Maple & Masa to Riverside Community Fridge. One bag is reserved for family LOOP-27 (3 people). Keep the trays cold and deliver within 2 hours. Stay with your buddy — businesses and hubs only, never anyone's home. If anything feels wrong, tap I feel unsafe.",
    brief_es: 'Equipo, la entrega de hoy es una caminata corta: unas 40 lbs de pan fresco y arroz con frijoles de Maple & Masa a Riverside Community Fridge. Una bolsa es para la familia LOOP-27 (3 personas). Mantén las bandejas frías y entrega en menos de 2 horas. Quédate con tu compañero: solo negocios y centros, nunca la casa de nadie. Si algo no se siente bien, toca "Me siento inseguro".',
    steps_en: ['Meet your buddy and walk to Maple & Masa Bakery.', 'Ask for the Loop pickup and enter the pickup code.', 'Check the weight and pack trays in the cooler bag.', 'Walk to Riverside Community Fridge.', 'Enter the hub drop code and place bag LOOP-27 on the reserved shelf.', 'Stock the rest in the fridge and tap Done.'],
    steps_es: ['Reúnete con tu compañero y caminen a Maple & Masa Bakery.', 'Pide la entrega de Loop y escribe el código de recogida.', 'Revisa el peso y pon las bandejas en la bolsa térmica.', 'Caminen a Riverside Community Fridge.', 'Escribe el código del centro y pon la bolsa LOOP-27 en el estante reservado.', 'Guarda el resto en el refrigerador y toca Listo.'],
    safety_checklist_en: ['I am with my buddy', 'Businesses and hubs only — never a home', 'Trays stay cold, delivered within 2 hours', 'No cash, no medication', 'I will tap "I feel unsafe" if anything feels wrong'],
    safety_checklist_es: ['Estoy con mi compañero', 'Solo negocios y centros, nunca una casa', 'Las bandejas se mantienen frías y se entregan en menos de 2 horas', 'Sin dinero en efectivo, sin medicinas', 'Tocaré "Me siento inseguro" si algo no se siente bien'],
  },

  note_translation: {
    allowed: true,
    cleaned_text: EXAMPLE_NOTE.es,
    translated_text: EXAMPLE_NOTE.en,
    removed: [],
  },

  pulse_brief: {
    headline_en: 'Electric-bill help is the fastest-growing need in 78741 this week.',
    headline_es: 'La ayuda con la factura de luz es la necesidad que más crece en 78741 esta semana.',
    insights_en: ['Electric-bill requests rose from 12 to 17 (+42%).', 'Food is still the most common need (23 this week).', 'School supplies (9) are rising as the semester starts.'],
    insights_es: ['Las solicitudes de ayuda con la luz subieron de 12 a 17 (+42%).', 'La comida sigue siendo la necesidad más común (23 esta semana).', 'Los útiles escolares (9) van en aumento con el inicio del semestre.'],
    suggested_action: {
      type: 'pop_up',
      title_en: 'Bill-help pop-up at Riverside Community Fridge',
      title_es: 'Punto de ayuda con facturas en Riverside Community Fridge',
      description_en: 'Student volunteers help neighbors find energy assistance (CEAP) and utility bill-help options, with snacks from the fridge.',
      description_es: 'Estudiantes voluntarios ayudan a vecinos a encontrar ayuda de energía (CEAP) y opciones de ayuda con la factura, con botanas del refrigerador.',
      hub_key: 'riverside-fridge',
    },
  },
};

/** Is this intake text the demo example? */
export function goldenIntakeKey(text) {
  const t = String(text || '').trim();
  if (t === EXAMPLE_TEXT.es) return 'intake_es';
  if (t === EXAMPLE_TEXT.en) return 'intake_en';
  return null;
}

/** Is this profile the demo family? */
export function isGoldenProfile(p) {
  return p?.zip === '78741' && Number(p.household_size) === 3 && Number(p.children_count) === 2 && p.child_under_5 === true && (p.situations || []).includes('job_loss');
}
