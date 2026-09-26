// Shared constants for Loop, used by the React site (src/) and Base44 backend functions.
// Plain dependency-free JavaScript so it runs in the browser, Node (tests) and Deno.

export const CATEGORIES = [
  'food', 'housing', 'utilities', 'healthcare', 'school_childcare', 'employment', 'transportation', 'cash_assistance', 'legal', 'mental_health',
];

export const SITUATIONS = ['job_loss', 'single_parent', 'pregnant', 'veteran', 'senior', 'disability', 'student', 'unhoused', 'uninsured'];

export const URGENCIES = ['today', 'week', 'month'];

export const INCOME_RANGES = [
  { id: 'none', max: 0 },
  { id: 'under_1000', max: 999 },
  { id: '1000_2000', max: 2000 },
  { id: '2000_3000', max: 3000 },
  { id: '3000_4500', max: 4500 },
  { id: 'over_4500', max: Infinity },
  { id: 'prefer_not', max: null },
];
export const INCOME_RANGE_IDS = INCOME_RANGES.map((r) => r.id);
// 7A: "low income" signal when income is under $3,000/month, or unknown / prefer not to say.
export const LOW_INCOME_RANGES = ['none', 'under_1000', '1000_2000', '2000_3000', 'prefer_not'];

export const SIGNALS = ['needs_children', 'child_under_5', 'pregnant', 'job_loss', 'veteran_only', 'senior', 'disability', 'student', 'unhoused', 'low_income'];

export const MATCH_LEVELS = ['very_likely', 'possibly', 'worth_checking'];

export const ROLES = ['neighbor', 'give', 'volunteer', 'hub'];

export const REQUEST_TYPES = ['food_tonight', 'groceries_week', 'school_supplies', 'baby_supplies', 'hygiene', 'clothing'];
export const FOOD_PREFS = ['none', 'vegetarian', 'no_pork', 'halal', 'allergy'];
export const REQUEST_STATUSES = ['posted', 'matched', 'on_the_way', 'ready', 'picked_up', 'expired', 'cancelled'];
export const TRACKER_STEPS = ['posted', 'matched', 'on_the_way', 'ready', 'picked_up'];

export const DONATION_STATUSES = ['posted', 'matched', 'picked_up', 'delivered', 'expired', 'cancelled'];
export const ITEM_CATEGORIES = ['bakery', 'prepared', 'produce', 'packaged', 'dairy', 'other'];
export const STORAGE_TYPES = ['cold', 'hot', 'shelf_stable'];

export const MISSION_STATUSES = ['open', 'claimed', 'picked_up', 'delivered', 'verified', 'cancelled'];
export const MODES = ['walk', 'bike', 'transit', 'car'];

export const LANGUAGES = ['en', 'es'];

// Feeding America's standard: 1.2 lbs of food = 1 meal.
export const LBS_PER_MEAL = 1.2;

export const LIMITS = {
  situationText: 1500,
  noteText: 400,
  maxResourcesInPlan: 30,
  maxResourcesForAi: 18,
  aiTimeoutMs: 12000,
  photoMaxBytes: 1_500_000,
};

// The fictional demo neighborhood (Section 9B).
export const DEMO = {
  zip: '78741',
  center: { lat: 30.232, lng: -97.72 },
  zoom: 14,
  networkRadiusMi: 2,
  clockStart: { hour: 17, minute: 5 }, // demo clock starts at 5:05 PM Central on reset
  timeZone: 'America/Chicago',
  goldenGiver: 'maple-masa',
  goldenPickupCode: '3816',
  goldenRequestCode: 'LOOP-27',
  goldenHub: 'riverside-fridge',
};

export const CRISIS_LINES = [
  { id: 'emergency', phone: '911', tel: '911' },
  { id: 'lifeline_988', phone: '988', tel: '988', sms: '988' },
  { id: 'dv_hotline', phone: '1-800-799-7233', tel: '18007997233', sms: '88788', smsBody: 'START' },
  { id: 'texas_211', phone: '2-1-1', tel: '211' },
];
