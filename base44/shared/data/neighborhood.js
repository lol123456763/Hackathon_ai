// FICTIONAL demo neighborhood for ZIP 78741, southeast Austin (spec Section 9B).
// Every business, hub, person and history item here is sample data, labeled as such in the app.
// All pins are on land south of Lady Bird Lake.

export const HUBS = [
  {
    key: 'riverside-fridge', name: 'Riverside Community Fridge', type: 'community_fridge', area_label: 'E Riverside Dr', lat: 30.2385, lng: -97.7215,
    hours: { days: [0, 1, 2, 3, 4, 5, 6], open: 15 * 60, close: 20 * 60 },
    hours_text_en: 'Staffed 3–8 PM daily', hours_text_es: 'Con personal de 3 a 8 PM todos los días',
    host_note_en: 'Community fridge inside a staffed community center.', host_note_es: 'Refrigerador comunitario dentro de un centro comunitario con personal.',
    has_reserved_shelf: true, drop_code: '4721', verified: true,
    accepts: ['bread_baked', 'produce', 'packaged', 'prepared_labeled', 'dairy'],
    does_not_accept: ['raw_meat_seafood', 'alcohol', 'opened', 'home_canned', 'expired'],
  },
  {
    key: 'oltorf-pantry', name: 'Oltorf Pantry Shelf', type: 'pantry', area_label: 'E Oltorf St', lat: 30.229, lng: -97.726,
    hours: { days: [2, 4, 6], open: 10 * 60, close: 18 * 60 },
    hours_text_en: 'Tue, Thu, Sat 10 AM–6 PM', hours_text_es: 'Mar, jue, sáb 10 AM–6 PM',
    host_note_en: 'Volunteer-run pantry shelf.', host_note_es: 'Despensa atendida por voluntarios.',
    has_reserved_shelf: true, drop_code: '5190', verified: true,
    accepts: ['bread_baked', 'produce', 'packaged', 'dairy'],
    does_not_accept: ['raw_meat_seafood', 'alcohol', 'opened', 'home_canned', 'expired', 'prepared_labeled'],
  },
  {
    key: 'grove-closet', name: 'Grove Free Closet & Fridge', type: 'rec_center', area_label: 'Grove Blvd', lat: 30.233, lng: -97.705,
    hours: { days: [1, 2, 3, 4, 5, 6], open: 14 * 60, close: 19 * 60 },
    hours_text_en: 'Mon–Sat 2–7 PM', hours_text_es: 'Lun a sáb 2–7 PM',
    host_note_en: 'Free clothing closet and small fridge at the rec center.', host_note_es: 'Ropero gratis y refrigerador pequeño en el centro recreativo.',
    has_reserved_shelf: false, drop_code: '2604', verified: true,
    accepts: ['bread_baked', 'produce', 'packaged', 'clothing', 'school_supplies', 'hygiene'],
    does_not_accept: ['raw_meat_seafood', 'alcohol', 'opened', 'home_canned', 'expired'],
  },
];

export const GIVERS = [
  { key: 'maple-masa', name: 'Maple & Masa Bakery', type: 'bakery', area_label: 'S Pleasant Valley Rd', lat: 30.2345, lng: -97.728, verified: true },
  { key: 'riverbend-taqueria', name: 'Riverbend Taquería', type: 'restaurant', area_label: 'E Riverside Dr', lat: 30.24, lng: -97.712, verified: true },
  { key: 'green-crate', name: 'Green Crate Market', type: 'grocery', area_label: 'Montopolis Dr', lat: 30.224, lng: -97.712, verified: true },
  { key: 'eastbank-cafeteria', name: 'Eastbank Middle School cafeteria', type: 'school', area_label: 'Eastbank', lat: 30.227, lng: -97.717, verified: true },
];

export const TEAMS = [
  { key: 'riverside-runners', name: 'Riverside Runners' },
  { key: 'eastbank-helpers', name: 'Eastbank Helpers' },
];

export const VOLUNTEERS = [
  { key: 'jordan', display_name: 'Jordan R.', age: 16, age_band: '16-17', school: 'Eastbank High (sample)', team_key: 'riverside-runners', guardian_consent: true, modes: ['walk', 'bike'], languages: ['en', 'es'], total_hours: 11.5, total_lbs: 212, missions_done: 9 },
  { key: 'maya', display_name: 'Maya T.', age: 16, age_band: '16-17', school: 'Eastbank High (sample)', team_key: 'riverside-runners', guardian_consent: true, modes: ['walk', 'bike'], languages: ['en'], total_hours: 9, total_lbs: 168, missions_done: 7 },
  { key: 'ana', display_name: 'Ana P.', age: 14, age_band: '13-15', school: 'Eastbank Middle (sample)', team_key: 'eastbank-helpers', guardian_consent: true, modes: ['walk'], languages: ['es', 'en'], total_hours: 4, total_lbs: 61, missions_done: 3 },
  { key: 'sam', display_name: 'Sam K.', age: 18, age_band: '18+', school: 'Austin CC (sample)', team_key: 'eastbank-helpers', guardian_consent: false, modes: ['car', 'walk'], languages: ['en'], total_hours: 15.25, total_lbs: 402, missions_done: 12 },
];

// Sample 30-day history shown on the Impact board (labeled "sample data").
export const SAMPLE_IMPACT = { lbs: 1284, meals: 1070, families: 46, hours: 212, plans: 38, volunteers: 19 };

// Sample "this week" sparkline values (7 days, oldest → newest) per counter.
export const SAMPLE_WEEK = {
  lbs: [38, 52, 41, 60, 47, 55, 63],
  meals: [31, 43, 34, 50, 39, 45, 52],
  families: [1, 2, 1, 3, 2, 2, 3],
  hours: [5.5, 7, 6, 8.5, 6.5, 7.25, 9],
};

// Needs Pulse sample counts for 78741: this week vs last week.
export const SAMPLE_PULSE = {
  food: [23, 20],
  utilities: [17, 12],
  school_supplies: [9, 8],
  housing: [8, 8],
  healthcare: [6, 5],
};

// 25 past activity items spread over the last 7 days (minutes before reset).
export const SAMPLE_ACTIVITY = [
  [30, 'delivered', 'Riverbend Taquería: 18 lbs of rice and tortillas stocked Riverside Community Fridge', 'Riverbend Taquería: 18 lbs de arroz y tortillas en Riverside Community Fridge', 'riverbend-taqueria'],
  [95, 'mission', 'Riverside Runners finished a taquería run (0.7 mi walk)', 'Riverside Runners terminaron una entrega de la taquería (0.7 mi a pie)', 'riverside-fridge'],
  [180, 'plan', 'A family of 5 built a plan: food and rent help', 'Una familia de 5 creó un plan: comida y ayuda con la renta', null],
  [260, 'restock', 'Grove Free Closet & Fridge restocked: 22 lbs produce', 'Grove Free Closet & Fridge reabastecido: 22 lbs de frutas y verduras', 'grove-closet'],
  [600, 'covered', 'A family of 4 was covered tonight at Oltorf Pantry Shelf', 'Una familia de 4 recibió comida esta noche en Oltorf Pantry Shelf', 'oltorf-pantry'],
  [1440, 'delivered', 'Eastbank Middle School cafeteria: 35 lbs of sealed lunches rescued', 'Cafetería de Eastbank Middle School: 35 lbs de almuerzos sellados rescatados', 'eastbank-cafeteria'],
  [1500, 'mission', 'Eastbank Helpers finished a cafeteria run (0.4 mi walk)', 'Eastbank Helpers terminaron una entrega de la cafetería (0.4 mi a pie)', 'riverside-fridge'],
  [1620, 'plan', 'A single parent built a plan: child care and jobs', 'Una madre soltera creó un plan: cuidado de niños y empleo', null],
  [2000, 'covered', 'A family of 3 was covered tonight at Riverside Community Fridge', 'Una familia de 3 recibió comida esta noche en Riverside Community Fridge', 'riverside-fridge'],
  [2880, 'delivered', 'Green Crate Market: 54 lbs of produce to Oltorf Pantry Shelf', 'Green Crate Market: 54 lbs de frutas y verduras a Oltorf Pantry Shelf', 'green-crate'],
  [2950, 'hours', 'Sam K. earned 1.25 verified hours', 'Sam K. ganó 1.25 horas verificadas', null],
  [3100, 'plan', 'A senior built a plan: utility bills and health care', 'Un adulto mayor creó un plan: facturas y atención médica', null],
  [4320, 'event', 'Fridge paint & restock day: 11 students joined', 'Día de pintar y llenar el refrigerador: se unieron 11 estudiantes', 'riverside-fridge'],
  [4400, 'delivered', 'Maple & Masa Bakery: 26 lbs of bread to Riverside Community Fridge', 'Maple & Masa Bakery: 26 lbs de pan a Riverside Community Fridge', 'maple-masa'],
  [4500, 'covered', 'Two families were covered tonight at Riverside Community Fridge', 'Dos familias recibieron comida esta noche en Riverside Community Fridge', 'riverside-fridge'],
  [5760, 'plan', 'A family of 6 built a plan: food, school supplies', 'Una familia de 6 creó un plan: comida y útiles escolares', null],
  [5900, 'delivered', 'Riverbend Taquería: 21 lbs of beans and rice', 'Riverbend Taquería: 21 lbs de frijoles y arroz', 'riverbend-taqueria'],
  [6000, 'mission', 'Riverside Runners finished 2 runs in one evening', 'Riverside Runners terminaron 2 entregas en una tarde', 'riverside-fridge'],
  [7200, 'restock', 'Oltorf Pantry Shelf restocked: 40 lbs packaged food', 'Oltorf Pantry Shelf reabastecido: 40 lbs de comida empacada', 'oltorf-pantry'],
  [7300, 'covered', 'A family of 2 was covered tonight at Oltorf Pantry Shelf', 'Una familia de 2 recibió comida esta noche en Oltorf Pantry Shelf', 'oltorf-pantry'],
  [8640, 'delivered', 'Eastbank Middle School cafeteria: 30 lbs of fruit cups and milk', 'Cafetería de Eastbank Middle School: 30 lbs de fruta en vasitos y leche', 'eastbank-cafeteria'],
  [8700, 'hours', 'Ana P. earned 0.5 verified hours', 'Ana P. ganó 0.5 horas verificadas', null],
  [9000, 'plan', 'A student built a plan: food and transportation', 'Un estudiante creó un plan: comida y transporte', null],
  [9500, 'delivered', 'Green Crate Market: 48 lbs of produce to Grove Free Closet & Fridge', 'Green Crate Market: 48 lbs de frutas y verduras a Grove Free Closet & Fridge', 'green-crate'],
  [9900, 'covered', 'A family of 5 was covered tonight at Riverside Community Fridge', 'Una familia de 5 recibió comida esta noche en Riverside Community Fridge', 'riverside-fridge'],
];

// Events (P1). Times are relative to the demo day.
export const EVENTS = [
  {
    key: 'creek-cleanup', type: 'cleanup', day_offset: 'next_saturday', start: '09:00', end: '11:00', min_age: 13, spots: 25, hours_credit: 2, hub_key: null,
    area_label: 'Country Club Creek Trail', lat: 30.2262, lng: -97.7135, host: 'Riverside Runners', checkin_code: '7342',
    title_en: 'Country Club Creek cleanup', title_es: 'Limpieza de Country Club Creek',
    description_en: 'Pick up litter along the creek trail. Gloves and bags provided. Wear closed-toe shoes.',
    description_es: 'Recoge basura a lo largo del sendero. Hay guantes y bolsas. Usa zapatos cerrados.',
  },
  {
    key: 'supply-drive', type: 'drive', day_offset: 3, start: '10:00', end: '14:00', min_age: 13, spots: 15, hours_credit: 2, hub_key: 'oltorf-pantry',
    area_label: 'E Oltorf St', lat: 30.229, lng: -97.726, host: 'Oltorf Pantry Shelf', checkin_code: '5528',
    title_en: 'Back-to-school supply drive', title_es: 'Colecta de útiles escolares',
    description_en: 'Sort donated backpacks and school supplies into kits for families.',
    description_es: 'Organiza mochilas y útiles donados en paquetes para familias.',
  },
  {
    key: 'fridge-day', type: 'fridge_day', day_offset: 5, start: '15:00', end: '17:00', min_age: 13, spots: 12, hours_credit: 2, hub_key: 'riverside-fridge',
    area_label: 'E Riverside Dr', lat: 30.2385, lng: -97.7215, host: 'Riverside Community Fridge', checkin_code: '9016',
    title_en: 'Fridge paint & restock day', title_es: 'Día de pintar y llenar el refrigerador',
    description_en: 'Paint the fridge shelter mural and restock shelves with the host team.',
    description_es: 'Pinta el mural del refrigerador y llena los estantes con el equipo anfitrión.',
  },
  {
    key: 'youth-town-hall', type: 'civic_meeting', day_offset: 8, start: '18:00', end: '19:30', min_age: 13, spots: 60, hours_credit: 1.5, hub_key: 'grove-closet',
    area_label: 'Grove Blvd', lat: 30.233, lng: -97.705, host: 'Neighborhood youth council (sample)', checkin_code: '6604',
    title_en: 'Neighborhood youth town hall', title_es: 'Asamblea juvenil del vecindario',
    description_en: 'Share what the neighborhood needs and plan the next month of drives with local leaders.',
    description_es: 'Comparte lo que necesita el vecindario y planea las colectas del próximo mes con líderes locales.',
  },
];

// Green Crate's open produce post at reset (its mission is car-only, 18+, so it shows locked for Jordan).
export const OPEN_PRODUCE_POST = {
  giver_key: 'green-crate',
  hub_key: 'oltorf-pantry',
  items: [
    { name_en: 'Mixed vegetables', name_es: 'Verduras variadas', quantity_text: '3 crates', est_lbs: 35, category: 'produce', storage: 'cold' },
    { name_en: 'Apples and oranges', name_es: 'Manzanas y naranjas', quantity_text: '2 crates', est_lbs: 25, category: 'produce', storage: 'shelf_stable' },
  ],
  total_lbs: 60,
  pickup: ['18:30', '19:30'],
  pickup_code: '6120',
  mission: {
    title_en: 'Produce run: Green Crate → Oltorf Pantry Shelf', title_es: 'Entrega de verduras: Green Crate → Oltorf Pantry Shelf',
    mode: 'car', min_age: 18, est_minutes: 40,
  },
};
