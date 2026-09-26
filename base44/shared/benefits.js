// Rough benefit estimator based on official published tables (see data/benefit-rules.js).
// Estimates are intentionally conservative and always presented as "rough estimates".
import RULES from './data/benefit-rules.js';
import { INCOME_RANGES } from './constants.js';

export { RULES as BENEFIT_RULES };

/** Monthly federal poverty guideline for a household size (48 contiguous states). */
export function fplMonthly(size) {
  const n = Math.max(1, Math.round(Number(size) || 1));
  const annual = RULES.fpl.base + RULES.fpl.perAdditional * (n - 1);
  return annual / 12;
}

function tableValue(table, size) {
  // table: { values: [size1, size2, ...], perAdditional }
  const n = Math.max(1, Math.round(size));
  if (n <= table.values.length) return table.values[n - 1];
  return table.values[table.values.length - 1] + table.perAdditional * (n - table.values.length);
}

function incomeBounds(profile) {
  const r = INCOME_RANGES.find((x) => x.id === profile.income_range);
  if (!r || r.min === null) return null;
  return r;
}

// Classify a percent-of-poverty limit against an income range.
function limitStatus(range, size, pct) {
  const limit = (fplMonthly(size) * pct) / 100;
  if (range.max <= limit) return 'likely';
  if (range.min > limit) return 'unlikely';
  return 'maybe';
}

function snapEstimate(profile, range) {
  const s = RULES.snap;
  const size = profile.household_size;
  const status = limitStatus(range, size, s.grossPct);
  if (status === 'unlikely') return { id: 'snap', status, monthly: null, source: s.source };
  const max = tableValue(s.maxAllotment, size);
  const stdDed = tableValue(s.standardDeduction, size);
  // Conservative net income: assume all income is earned (20% deduction) and no shelter deduction.
  const netHigh = Math.max(0, range.max * 0.8 - stdDed);
  const netLow = Math.max(0, range.min * 0.8 - stdDed);
  const clamp = (v) => Math.max(size <= 2 ? s.minBenefit : 0, Math.min(max, Math.round(v)));
  const low = clamp(max - 0.3 * netHigh);
  const high = clamp(max - 0.3 * netLow);
  return { id: 'snap', status, monthly: low === high ? { low, high } : { low: Math.min(low, high), high: Math.max(low, high) }, max, source: s.source };
}

/**
 * Estimate likely benefits for a profile.
 * @returns {Array<{id:string, status:'likely'|'maybe'|'unlikely', monthly?:{low:number, high:number}|null, detail?:string, source:string}>}
 *   Empty array if household size or income is unknown.
 */
export function estimateBenefits(profile) {
  const range = incomeBounds(profile);
  const size = Number(profile.household_size);
  if (!range || !size) return [];
  const kids = Number(profile.children_count) || 0;
  const out = [];

  out.push(snapEstimate({ ...profile, household_size: size }, range));

  if (kids > 0) {
    const m = RULES.schoolMeals;
    const free = limitStatus(range, size, m.freePct);
    const reduced = limitStatus(range, size, m.reducedPct);
    out.push({
      id: 'school_meals',
      status: free === 'likely' || reduced === 'likely' ? 'likely' : free === 'maybe' || reduced === 'maybe' ? 'maybe' : 'unlikely',
      detail: free === 'likely' ? 'free' : reduced !== 'unlikely' ? 'free_or_reduced' : null,
      source: m.source,
    });
    out.push({ id: 'chip_medicaid_kids', status: limitStatus(range, size, RULES.medicaidChip.chipChildrenPct), source: RULES.medicaidChip.source });
  }

  if (profile.child_under_5 || (profile.situations || []).includes('pregnant')) {
    out.push({ id: 'wic', status: limitStatus(range, size, RULES.wic.pct), source: RULES.wic.source });
  }

  const ceap = RULES.ceap;
  out.push({
    id: 'ceap',
    status: limitStatus(range, size, ceap.pct),
    monthly: null,
    detail: ceap.benefitMax ? `up_to:${ceap.benefitMax}` : null,
    source: ceap.source,
  });

  out.push({
    id: 'lifeline',
    status: limitStatus(range, size, RULES.lifeline.pct),
    monthly: RULES.lifeline.monthlyDiscount ? { low: RULES.lifeline.monthlyDiscount, high: RULES.lifeline.monthlyDiscount } : null,
    source: RULES.lifeline.source,
  });

  return out;
}
