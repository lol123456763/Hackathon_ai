// Shared constants used by both the React site (src/) and Base44 backend functions (base44/functions/).
// Keep this file dependency-free plain JavaScript so it runs in the browser, Node (tests) and Deno.

export const CATEGORIES = [
  'food',
  'housing',
  'utilities',
  'healthcare',
  'school_childcare',
  'employment',
  'transportation',
  'cash_assistance',
  'legal',
  'mental_health',
];

export const SITUATIONS = [
  'job_loss',
  'single_parent',
  'pregnant',
  'veteran',
  'senior',
  'disability',
  'student',
  'unhoused',
  'uninsured',
];

export const URGENCIES = ['today', 'week', 'month'];

// Monthly household income ranges. `max` is the top of the range (inclusive) in dollars;
// `mid` is used when a single number is needed (e.g., benefit estimates).
export const INCOME_RANGES = [
  { id: 'none', min: 0, max: 0, mid: 0 },
  { id: 'under_1000', min: 1, max: 999, mid: 600 },
  { id: '1000_2000', min: 1000, max: 2000, mid: 1500 },
  { id: '2000_3000', min: 2000, max: 3000, mid: 2500 },
  { id: '3000_4500', min: 3000, max: 4500, mid: 3750 },
  { id: 'over_4500', min: 4500, max: Infinity, mid: 5500 },
  { id: 'prefer_not', min: null, max: null, mid: null },
];

export const INCOME_RANGE_IDS = INCOME_RANGES.map((r) => r.id);

export const MATCH_LEVELS = ['very_likely', 'possibly', 'worth_checking'];

export const LANGUAGES = ['en', 'es'];

// Hard caps that protect the backend from oversized input.
export const LIMITS = {
  situationText: 1500,
  followupQuestion: 500,
  followupHistory: 8,
  feedbackComment: 1000,
  maxResourcesInPlan: 30,
  maxResourcesForAi: 18,
};

// Crisis lines always available in Texas. These numbers are national/state services that
// do not change; they are also shown whenever crisis language is detected.
export const CRISIS_LINES = [
  { id: 'emergency', phone: '911', tel: '911', sms: null },
  { id: 'lifeline_988', phone: '988', tel: '988', sms: '988' },
  { id: 'dv_hotline', phone: '1-800-799-7233', tel: '18007997233', sms: '88788' },
  { id: 'texas_211', phone: '2-1-1', tel: '211', sms: null },
];
