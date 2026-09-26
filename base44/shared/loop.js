// Loop's deterministic neighborhood engine (spec Section 7B–7D). No AI decides anything here:
// who can take a mission, what counts as verified, and what is shown to whom are rules in code.
import { LBS_PER_MEAL, DEMO } from './constants.js';
import { distanceMiles } from './zip.js';
import { hhmmToMinutes } from './time.js';

export const MAX_GIVER_HUB_MI = 2;
const PACE_MIN_PER_MI = { walk: 20, bike: 8, transit: 12, car: 4 };

// ---------------------------------------------------------------- basics

export function mealsFromLbs(lbs) {
  return Math.floor((Number(lbs) || 0) / LBS_PER_MEAL + 1e-9);
}

export function roundQuarter(hours) {
  return Math.round(hours * 4) / 4;
}

export function hubOpenMinutes(hub, weekday) {
  if (!hub?.hours || !hub.hours.days.includes(weekday)) return null;
  return { open: hub.hours.open, close: hub.hours.close };
}

/** Hubs sorted by distance from a point, with open/close info for the demo day. */
export function hubsNear(hubs, point, clock) {
  return hubs
    .map((h) => ({ hub: h, distance: distanceMiles(point, h), today: hubOpenMinutes(h, clock.today.weekday) }))
    .filter((x) => x.distance != null)
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Pickup hubs for a tonight request: must have a reserved shelf and be open until at least `neededBy`
 * (minutes since midnight). Returns up to 3, best first.
 */
export function pickupHubOptions(hubs, point, clock, neededByMin, maxMiles = DEMO.networkRadiusMi) {
  const nowMin = clock.minutesOf(clock.now);
  return hubsNear(hubs, point, clock)
    .filter((x) => x.distance <= maxMiles && x.hub.has_reserved_shelf && x.today && x.today.close >= Math.max(neededByMin, nowMin + 30))
    .slice(0, 3);
}

// ---------------------------------------------------------------- food compatibility & bags

export function itemCompatible(item, prefs = []) {
  const tags = (item.tags || []).map((t) => String(t).toLowerCase());
  const name = `${item.name_en || ''}`.toLowerCase();
  const hasMeat = tags.includes('meat') || tags.includes('pork') || /\b(pork|carnitas|ham|bacon|chorizo|beef|chicken|meat)\b/.test(name);
  const hasPork = tags.includes('pork') || /\b(pork|carnitas|ham|bacon|chorizo)\b/.test(name);
  if (prefs.includes('vegetarian') && hasMeat) return false;
  if (prefs.includes('no_pork') && hasPork) return false;
  if (prefs.includes('halal') && hasMeat) return false; // unknown preparation: do not guess
  return true;
}

export function compatibleLbs(donation, prefs) {
  return (donation.items || []).filter((i) => itemCompatible(i, prefs)).reduce((s, i) => s + (Number(i.est_lbs) || 0), 0);
}

function countOf(quantityText) {
  const m = String(quantityText || '').match(/\d+/);
  return m ? Number(m[0]) : null;
}

/**
 * Family bag for one request: dinner-first. About 1.2 lbs per person per meal, from the items that best
 * make a dinner: prepared trays (1 per 2 people), then bread (2 per person), then pastries (~1.25 per person).
 */
export function buildBag(items, householdSize, prefs = []) {
  const n = Math.max(1, Number(householdSize) || 1);
  const usable = items.filter((i) => itemCompatible(i, prefs));
  const prepared = usable.filter((i) => i.category === 'prepared');
  const bakery = usable.filter((i) => i.category === 'bakery');
  const other = usable.filter((i) => !['prepared', 'bakery'].includes(i.category));
  const bag = [];
  const take = (item, want) => {
    const avail = countOf(item.quantity_text);
    const count = avail == null ? want : Math.min(want, avail);
    if (count > 0) bag.push({ name_en: item.name_en, name_es: item.name_es, count, unit: item.unit || null });
  };
  if (prepared[0]) take(prepared[0], Math.ceil(n / 2));
  if (bakery[0]) take(bakery[0], 2 * n);
  if (bakery[1]) take(bakery[1], Math.ceil(n * 1.25));
  if (!bag.length && other[0]) take(other[0], Math.max(1, Math.ceil((n * LBS_PER_MEAL) / Math.max(0.5, (other[0].est_lbs || 1) / (countOf(other[0].quantity_text) || 1)))));
  return bag;
}

export function bagText(bag, lang) {
  const parts = bag.map((b) => {
    const name = (lang === 'es' ? b.name_es : b.name_en) || b.name_en;
    const trayish = /tray|bandeja/i.test(name);
    return trayish ? `${b.count} ${name}` : `${b.count} ${name}`;
  });
  return parts.join(', ');
}

// ---------------------------------------------------------------- 7B: request ↔ surplus

/** Minutes since midnight for a donation pickup window stored as "HH:MM". */
function windowMinutes(d) {
  return { start: hhmmToMinutes(d.pickup_start), end: hhmmToMinutes(d.pickup_end) };
}

/**
 * Score a donation for a request at a hub. Returns null if it cannot serve it.
 * remainingLbs lets one donation serve several requests at the same hub.
 */
export function scoreDonationForRequest({ donation, giver, hub, request, nowMin, remainingLbs }) {
  if (!giver || !hub) return null;
  const w = windowMinutes(donation);
  const neededBy = hhmmToMinutes(request.needed_by);
  if (w.end == null || w.start == null || neededBy == null) return null;
  if (w.end <= nowMin) return null; // pickup window already over
  if (w.start >= neededBy) return null; // food would arrive too late
  const dist = distanceMiles(giver, hub);
  if (dist == null || dist > MAX_GIVER_HUB_MI) return null;
  const need = (Number(request.household_size) || 1) * LBS_PER_MEAL;
  const lbs = Math.min(remainingLbs ?? donation.total_lbs, compatibleLbs(donation, request.food_prefs || []));
  if (lbs < need) return null;
  const closeness = (MAX_GIVER_HUB_MI - dist) * 10;
  const timeFit = Math.max(0, (neededBy - w.end) / 30);
  const perishable = (donation.items || []).some((i) => i.category === 'prepared') ? 5 : 0;
  return { score: closeness + timeFit + perishable, distance: dist };
}

export function estMinutes(distance, mode) {
  const raw = distance * 2 * PACE_MIN_PER_MI[mode] + 20;
  return Math.max(30, Math.ceil(raw / 15) * 15);
}

export function chooseMode(distance) {
  if (distance <= 1) return 'walk';
  if (distance <= 2) return 'bike';
  return 'car';
}

// ---------------------------------------------------------------- 7C: who can take a mission

/**
 * @returns {{ok:boolean, reasons:string[]}} reason codes: consent, buddy, age_18, needs_car, too_far_1_5, too_far_1,
 *   after_8pm, after_7pm, mode, taken
 */
export function missionEligibility(volunteer, mission) {
  const reasons = [];
  const age = Number(volunteer.age) || 0;
  const endMin = hhmmToMinutes(mission.window_end);
  if (mission.status !== 'open') reasons.push('taken');
  if (age < (mission.min_age || 13)) reasons.push('age_18');
  if (mission.mode === 'car') {
    if (age < 18 && !reasons.includes('age_18')) reasons.push('age_18');
    if (!(volunteer.modes || []).includes('car')) reasons.push('needs_car');
  } else if (!(volunteer.modes || []).includes(mission.mode) && !(mission.mode === 'walk')) {
    reasons.push('mode');
  }
  if (age < 18) {
    if (!volunteer.guardian_consent) reasons.push('consent');
    if (age <= 15) {
      if (mission.distance_mi > 1) reasons.push('too_far_1');
      if (endMin != null && endMin > 19 * 60) reasons.push('after_7pm');
    } else {
      if (mission.distance_mi > 1.5) reasons.push('too_far_1_5');
      if (endMin != null && endMin > 20 * 60) reasons.push('after_8pm');
    }
  }
  return { ok: reasons.length === 0, reasons };
}

/** Under-18 volunteers must claim with a buddy who is also eligible. */
export function buddyRequired(volunteer) {
  return (Number(volunteer.age) || 0) < 18;
}

// ---------------------------------------------------------------- 7D: verification & hours

/** Codes may be entered from 30 min before the window until 60 min after it (demo-friendly grace). */
export function withinWindow(mission, nowMin) {
  const s = hhmmToMinutes(mission.window_start);
  const e = hhmmToMinutes(mission.window_end);
  if (s == null || e == null) return true;
  return nowMin >= s - 30 && nowMin <= e + 60;
}

export function creditedHours(estMinutesValue, actualMinutes) {
  const est = Number(estMinutesValue) || 0;
  const actual = Number(actualMinutes) || 0;
  const minutes = actual > est ? Math.min(actual, est * 2) : est;
  return roundQuarter(minutes / 60);
}

/** Aggregate live impact on top of the labeled sample history. */
export function computeImpact({ sample, missions, requests, plans, volunteersActive, extra = { hours: 0, projects: 0 } }) {
  const verified = missions.filter((m) => m.status === 'verified');
  const lbs = verified.reduce((s, m) => s + (Number(m.lbs_delivered) || 0), 0);
  const hours = verified.reduce((s, m) => s + (Number(m.credited_hours) || 0) * (m.volunteer_keys || []).length, 0);
  const families = requests.filter((r) => ['ready', 'picked_up'].includes(r.status)).length;
  return {
    lbs: sample.lbs + lbs,
    meals: sample.meals + verified.reduce((s, m) => s + mealsFromLbs(m.lbs_delivered), 0),
    families: sample.families + families,
    hours: sample.hours + hours + extra.hours,
    projects: (sample.projects || 0) + verified.length + extra.projects,
    plans: sample.plans + plans,
    volunteers: Math.max(sample.volunteers, volunteersActive || 0),
    live: { lbs, hours: hours + extra.hours, families, plans },
  };
}

export function randomCode(digits = 4, rand = Math.random) {
  let s = '';
  for (let i = 0; i < digits; i++) s += Math.floor(rand() * 10);
  return s[0] === '0' ? `1${s.slice(1)}` : s;
}
