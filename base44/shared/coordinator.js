// Loop's AI coordinator core (deterministic). It reads a student's calendar, finds real free time,
// fits community opportunities into it without conflicts, predicts how likely each one is to get done,
// and finds compatible buddies. The AI only writes the friendly explanations (see prompts.js).
import { hhmmToMinutes, minutesToHhmm } from './time.js';
import { distanceMiles } from './zip.js';
import { missionEligibility } from './loop.js';

export const DAY_START = 7 * 60;
export const DAY_END = 21 * 60;
const STEP = 15;

// ---------------------------------------------------------------- dates

export function dateStr(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}
export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}
export function weekdayOf(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// ---------------------------------------------------------------- calendar → busy intervals

/** Calendar blocks that happen on `date` (recurring weekly or one-off), as {start,end} minutes. */
export function blocksOn(blocks, date) {
  const wd = weekdayOf(date);
  return blocks
    .filter((b) => b.status !== 'cancelled' && (b.date ? b.date === date : (b.days || []).includes(wd)))
    .filter((b) => !(b.skip_dates || []).includes(date))
    .map((b) => ({ ...b, s: hhmmToMinutes(b.start), e: hhmmToMinutes(b.end) }))
    .filter((b) => b.s != null && b.e != null && b.e > b.s)
    .sort((a, b) => a.s - b.s);
}

function merge(intervals) {
  const sorted = [...intervals].sort((a, b) => a.s - b.s);
  const out = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.s <= last.e) last.e = Math.max(last.e, i.e);
    else out.push({ s: i.s, e: i.e });
  }
  return out;
}

/** Free windows on a date (minutes), between DAY_START and DAY_END, excluding `busy` and before `notBefore`. */
export function freeWindows(busy, notBefore = DAY_START) {
  const b = merge(busy);
  const out = [];
  let cursor = Math.max(DAY_START, notBefore);
  for (const i of b) {
    if (i.e <= cursor) continue;
    if (i.s > cursor) out.push({ s: cursor, e: Math.min(i.s, DAY_END) });
    cursor = Math.max(cursor, i.e);
  }
  if (cursor < DAY_END) out.push({ s: cursor, e: DAY_END });
  return out.filter((w) => w.e - w.s >= 30);
}

export function travelMinutes(distance, remote) {
  if (remote || distance == null) return 0;
  return Math.max(10, Math.round((distance * 20) / 5) * 5);
}

// ---------------------------------------------------------------- opportunities

/** Expand missions, events and project shifts into concrete occurrences over the horizon. */
export function occurrences({ missions, events, projects, today, days = 7, nowMin }) {
  const out = [];
  for (const m of missions) {
    if (m.status !== 'open' || !m.giver) continue;
    out.push({
      type: 'mission', ref_key: m.key, date: today, window_start: m.window_start, window_end: m.window_end, duration: m.est_minutes,
      title_en: m.title_en, title_es: m.title_es, place: m.hub?.name, lat: m.giver.lat, lng: m.giver.lng, interests: ['food_rescue'],
      need: (m.requests || []).length ? 3 : 2, families: (m.requests || []).length, hours_credit: Math.round((m.est_minutes / 60) * 4) / 4,
      impact_en: m.impact_en, impact_es: m.impact_es, mission: m,
    });
  }
  for (const e of events) {
    if (e.date < today || e.date > addDays(today, days - 1)) continue;
    out.push({
      type: 'event', ref_key: e.key, date: e.date, start: e.start, end: e.end, title_en: e.title_en, title_es: e.title_es, place: e.area_label,
      lat: e.lat, lng: e.lng, interests: e.type === 'cleanup' ? ['environment'] : e.type === 'civic_meeting' ? ['civic'] : ['community_events'],
      need: 1, hours_credit: e.hours_credit, min_age: e.min_age, impact_en: e.description_en, impact_es: e.description_es,
    });
  }
  for (const p of projects) {
    for (let i = 0; i < days; i++) {
      const date = addDays(today, i);
      const wd = weekdayOf(date);
      for (const slot of p.slots) {
        if (!slot.days.includes(wd)) continue;
        if (i === 0 && hhmmToMinutes(slot.start) < nowMin + 20) continue;
        out.push({
          type: 'project', ref_key: p.key, date, start: slot.start, end: slot.end, title_en: p.title_en, title_es: p.title_es, place: p.place,
          lat: p.lat, lng: p.lng, remote: !!p.remote, interests: p.interests, need: p.need, hours_credit: p.hours_credit, min_age: p.min_age,
          impact_en: p.impact_en, impact_es: p.impact_es, spots: p.spots,
        });
      }
    }
  }
  return out.map((o) => ({ ...o, opp_key: `${o.type}:${o.ref_key}:${o.date}` }));
}

/** Age/time/distance rules for any opportunity (same limits as food missions, spec 7C). */
export function canDo(volunteer, occ, endMin, distance) {
  if (occ.type === 'mission') {
    const e = missionEligibility(volunteer, occ.mission);
    return e;
  }
  const reasons = [];
  const age = Number(volunteer.age) || 0;
  if (age < (occ.min_age || 13)) reasons.push('age');
  if (age < 18) {
    if (age <= 15 && endMin > 19 * 60) reasons.push('after_7pm');
    if (age > 15 && endMin > 20 * 60) reasons.push('after_8pm');
    if (!occ.remote && distance != null && distance > (age <= 15 ? 1.5 : 2.5)) reasons.push('too_far');
  }
  return { ok: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------- prediction

/**
 * Predicted chance the student completes this (0–1), with the factors that moved it.
 * Heuristic from schedule pressure, time of day, distance, buddy and past reliability.
 */
export function predictCompletion({ slackBefore, slackAfter, endMin, dayBusyMin, distance, remote, buddy, reliability, isToday }) {
  let p = 0.82;
  const factors = [];
  const rel = reliability == null ? 0.85 : reliability;
  p += (rel - 0.85) * 0.6;
  if (rel >= 0.88) factors.push('reliable');
  if (slackBefore < 20 || slackAfter < 20) {
    p -= 0.12;
    factors.push('tight');
  } else if (slackBefore >= 45 && slackAfter >= 45) {
    p += 0.05;
    factors.push('roomy');
  }
  if (endMin > 19 * 60 + 30) {
    p -= 0.08;
    factors.push('late');
  }
  if (dayBusyMin > 9 * 60) {
    p -= 0.08;
    factors.push('busy_day');
  }
  if (!remote && distance != null && distance > 1) {
    p -= Math.min(0.12, (distance - 1) * 0.08);
    factors.push('far');
  } else if (remote || (distance != null && distance <= 0.6)) {
    p += 0.04;
    factors.push('close');
  }
  if (buddy) {
    p += 0.05;
    factors.push('buddy');
  }
  if (isToday) p += 0.03;
  return { p: Math.max(0.35, Math.min(0.97, p)), factors };
}

// ---------------------------------------------------------------- planning

function busyFor(blocks, date, extra = []) {
  return [...blocksOn(blocks, date).map((b) => ({ s: b.s, e: b.e })), ...extra];
}

/** Try to place an occurrence in a volunteer's day. Returns placement or null. */
export function place(occ, { blocks, date, nowMin, travel }) {
  const busy = busyFor(blocks, date);
  const fits = (s, e) => busy.every((b) => e + travel <= b.s || s - travel >= b.e) && s >= DAY_START && e <= DAY_END && s >= nowMin;
  if (occ.type === 'mission') {
    const ws = hhmmToMinutes(occ.window_start);
    const we = hhmmToMinutes(occ.window_end);
    for (let s = Math.ceil(Math.max(ws, nowMin) / STEP) * STEP; s <= we; s += STEP) {
      const e = s + occ.duration;
      if (fits(s, e)) return slack(busy, s, e);
    }
    return null;
  }
  const s = hhmmToMinutes(occ.start);
  const e = hhmmToMinutes(occ.end);
  return fits(s, e) ? slack(busy, s, e) : null;
}

function slack(busy, s, e) {
  const before = busy.filter((b) => b.e <= s).reduce((m, b) => Math.max(m, b.e), DAY_START);
  const after = busy.filter((b) => b.s >= e).reduce((m, b) => Math.min(m, b.s), DAY_END);
  const dayBusy = merge(busy).reduce((sum, b) => sum + (b.e - b.s), 0);
  return { s, e, slackBefore: s - before, slackAfter: after - e, dayBusyMin: dayBusy };
}

/**
 * Plan a student's week.
 * @param volunteer  {key, age, modes, guardian_consent, interests, school_point, weekly_goal_hours, stats, declined}
 * @param blocks     the student's calendar blocks (including accepted Loop commitments, kind 'loop')
 * @param others     other volunteers [{volunteer, blocks}] for buddy matching
 * @returns {{suggestions, candidates}}
 */
export function planWeek({ volunteer, blocks, others = [], missions = [], events = [], projects = [], today, nowMin, days = 7 }) {
  const declined = new Set((volunteer.declined || []).map((d) => d.opp_key));
  const committed = new Set(blocks.filter((b) => b.kind === 'loop' && b.status !== 'cancelled').map((b) => b.opp_key));
  const reliability = volunteer.stats?.committed ? volunteer.stats.completed / volunteer.stats.committed : null;
  const origin = volunteer.school_point || null;
  const interests = volunteer.interests || [];

  const candidates = [];
  for (const occ of occurrences({ missions, events, projects, today, days, nowMin })) {
    if (declined.has(occ.opp_key) || committed.has(occ.opp_key)) continue;
    const distance = occ.remote ? 0 : origin && occ.lat != null ? distanceMiles(origin, occ) : null;
    const travel = travelMinutes(distance, occ.remote);
    const pl = place(occ, { blocks, date: occ.date, nowMin: occ.date === today ? nowMin : 0, travel });
    if (!pl) continue;
    const rules = canDo(volunteer, occ, pl.e, distance);
    if (!rules.ok) continue;

    // Compatible buddies: eligible, free at the same time, shared interests first.
    const buddies = others
      .filter(({ volunteer: o }) => o.key !== volunteer.key)
      .filter(({ volunteer: o }) => canDo(o, occ, pl.e, distance).ok)
      .filter(({ blocks: ob }) => busyFor(ob, occ.date).every((b) => pl.e <= b.s || pl.s >= b.e))
      .map(({ volunteer: o }) => ({ key: o.key, display_name: o.display_name, shared: (o.interests || []).filter((i) => occ.interests.includes(i)).length, same_team: o.team_key === volunteer.team_key }))
      .sort((a, b) => Number(b.same_team) - Number(a.same_team) || b.shared - a.shared);

    const pred = predictCompletion({ ...pl, endMin: pl.e, distance, remote: occ.remote, buddy: buddies.length > 0, reliability, isToday: occ.date === today });
    const interestHits = occ.interests.filter((i) => interests.includes(i));
    const score =
      30 * (interestHits.length ? 1 : 0.35) + 25 * (occ.need / 3) + 25 * pred.p + (occ.date === today ? 10 : Math.max(0, 8 - (weekdayDelta(today, occ.date)))) + (distance == null ? 5 : Math.max(0, 10 - distance * 5));
    const factors = [];
    if (interestHits.length) factors.push({ code: 'interest', params: { interests: interestHits } });
    if (occ.families) factors.push({ code: 'urgent', params: { families: occ.families } });
    else if (occ.need >= 2) factors.push({ code: 'need' });
    factors.push({ code: 'free', params: { before: pl.slackBefore, after: pl.slackAfter } });
    if (buddies[0]) factors.push({ code: 'buddy', params: { name: buddies[0].display_name } });

    candidates.push({
      opp_key: occ.opp_key, type: occ.type, ref_key: occ.ref_key, date: occ.date, start: minutesToHhmm(pl.s), end: minutesToHhmm(pl.e),
      title_en: occ.title_en, title_es: occ.title_es, place: occ.place, lat: occ.lat, lng: occ.lng, remote: !!occ.remote,
      distance: distance == null ? null : Math.round(distance * 10) / 10, travel_minutes: travel, hours_credit: occ.hours_credit,
      impact_en: occ.impact_en, impact_es: occ.impact_es, families: occ.families || 0, interests: occ.interests,
      likelihood: Math.round(pred.p * 100), likelihood_factors: pred.factors, buddies: buddies.slice(0, 3), factors, score: Math.round(score * 10) / 10,
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  // Greedy weekly plan: no overlaps, at most 2 per day, stop near the weekly goal.
  const goalMin = (Number(volunteer.weekly_goal_hours) || 2) * 60;
  const committedMin = blocks.filter((b) => b.kind === 'loop' && b.status !== 'cancelled' && b.date >= today && b.date <= addDays(today, days - 1)).reduce((s, b) => s + (hhmmToMinutes(b.end) - hhmmToMinutes(b.start)), 0);
  const chosen = [];
  const perDay = {};
  let plannedMin = committedMin;
  const usedRefs = new Set();
  // Something that fits today always comes first (urgent food runs rank highest), so the student can act now.
  const bestToday = candidates.find((c) => c.date === today);
  const ordered = bestToday ? [bestToday, ...candidates.filter((c) => c !== bestToday)] : candidates;
  for (const c of ordered) {
    if (plannedMin >= goalMin * 1.25 || chosen.length >= 6) break;
    if ((perDay[c.date] || 0) >= 2) continue;
    if (c.type !== 'project' && usedRefs.has(c.ref_key)) continue;
    const s = hhmmToMinutes(c.start);
    const e = hhmmToMinutes(c.end);
    const clash = chosen.some((x) => x.date === c.date && !(e + c.travel_minutes <= hhmmToMinutes(x.start) || s - c.travel_minutes >= hhmmToMinutes(x.end)));
    if (clash) continue;
    chosen.push(c);
    usedRefs.add(c.ref_key);
    perDay[c.date] = (perDay[c.date] || 0) + 1;
    plannedMin += e - s;
  }
  chosen.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return { suggestions: chosen, candidates, committedMin, goalMin };
}

function weekdayDelta(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/** Week view: each day's calendar, commitments and free windows. */
export function weekView({ blocks, today, nowMin, days = 7 }) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const dayBlocks = blocksOn(blocks, date);
    const free = freeWindows(dayBlocks.map((b) => ({ s: b.s, e: b.e })), i === 0 ? nowMin : DAY_START);
    out.push({
      date,
      weekday: weekdayOf(date),
      blocks: dayBlocks.map((b) => ({ key: b.key, kind: b.kind, title: b.title, title_es: b.title_es || null, start: b.start, end: b.end, recurring: !b.date, opp_key: b.opp_key || null, opp_type: b.opp_type || null, ref_key: b.ref_key || null, status: b.status || 'planned', place: b.place || null, hours_credit: b.hours_credit || null })),
      free: free.map((w) => ({ start: minutesToHhmm(w.s), end: minutesToHhmm(w.e), minutes: w.e - w.s })),
      free_minutes: free.reduce((s, w) => s + (w.e - w.s), 0),
    });
  }
  return out;
}

// ---------------------------------------------------------------- schedule parsing (AI fallback + ICS)

const DAY_WORDS = [
  [/\b(sun(day)?|domingo|dom)\b/i, [0]],
  [/\b(mon(day)?|lunes|lun)\b/i, [1]],
  [/\b(tue(s(day)?)?|martes|mar)\b/i, [2]],
  [/\b(wed(nesday)?|mi[eé]rcoles|mi[eé])\b/i, [3]],
  [/\b(thu(r(s(day)?)?)?|jueves|jue)\b/i, [4]],
  [/\b(fri(day)?|viernes|vie)\b/i, [5]],
  [/\b(sat(urday)?|s[aá]bado|s[aá]b)\b/i, [6]],
];

function parseTime(t, meridiemHint) {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.?m\.?|p\.?m\.?)?$/i.exec(t.trim());
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  const mer = (m[3] || meridiemHint || '').toLowerCase().replace(/\./g, '');
  if (mer === 'pm' && h < 12) h += 12;
  if (mer === 'am' && h === 12) h = 0;
  if (!mer && h >= 1 && h <= 6) h += 12; // "3-5" after school means PM
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function kindFor(title) {
  const t = title.toLowerCase();
  if (/school|class|clase|escuela|colegio/.test(t)) return 'school';
  if (/homework|study|tarea|estudiar/.test(t)) return 'homework';
  if (/practice|club|team|robotics|band|soccer|football|basketball|volleyball|swim|dance|choir|orchestra|pr[aá]ctica|equipo|banda|f[uú]tbol|ensayo/.test(t)) return 'activity';
  return 'personal';
}

/** Rule-based "type your schedule" parser, e.g. "School M-F 8-3:30; robotics Tue/Thu 3:45-5:15pm". */
export function parseScheduleText(text) {
  const out = [];
  for (const raw of String(text || '').split(/[\n;]+|,(?![^()]*\))/)) {
    const line = raw.trim();
    if (!line) continue;
    const time = /(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.?m\.?|p\.?m\.?)?)\s*(?:-|–|to|a|hasta)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.?m\.?|p\.?m\.?)?)/i.exec(line);
    if (!time) continue;
    const endMer = /(am|pm)/i.exec(time[2])?.[1];
    let s = parseTime(time[1], null);
    let e = parseTime(time[2], null);
    if (s == null || e == null) continue;
    if (!/(am|pm)/i.test(time[1]) && endMer?.toLowerCase() === 'pm' && s < 12 * 60 && s + 12 * 60 < e) s += 12 * 60;
    if (e <= s && e + 12 * 60 > s) e += 12 * 60;
    if (e <= s) continue;
    let days = [];
    if (/\b(weekdays?|m\s*-\s*f|mon\s*-\s*fri|lunes a viernes|entre semana)\b/i.test(line)) days = [1, 2, 3, 4, 5];
    else if (/\b(weekends?|fines? de semana)\b/i.test(line)) days = [0, 6];
    else if (/\b(every ?day|daily|diario|todos los d[ií]as)\b/i.test(line)) days = [0, 1, 2, 3, 4, 5, 6];
    else for (const [re, d] of DAY_WORDS) if (re.test(line)) days.push(...d);
    if (/\b(tue\/thu|t\/th|tth)\b/i.test(line)) days = [2, 4];
    if (/\b(mwf|m\/w\/f)\b/i.test(line)) days = [1, 3, 5];
    if (!days.length) days = [1, 2, 3, 4, 5];
    const title = line.replace(time[0], '').replace(/\b(weekdays?|weekends?|every ?day|daily|m\s*-\s*f|mon\s*-\s*fri|mwf|tue\/thu|on|from|at|de|los|las|y|a|and)\b/gi, ' ')
      .replace(/\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(day)?s?\b/gi, ' ').replace(/\b(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)\b/gi, ' ')
      .replace(/[/,&+-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Busy';
    // Homework without am/pm is in the evening ("homework 7:30-9" = 19:30-21:00).
    if (kindFor(title) === 'homework' && !/(am|pm)/i.test(time[0]) && s < 12 * 60 && e <= 12 * 60) {
      s += 12 * 60;
      e += 12 * 60;
    }
    out.push({ title: title.slice(0, 60), kind: kindFor(title), days: [...new Set(days)].sort(), start: minutesToHhmm(s), end: minutesToHhmm(e) });
  }
  return out;
}

const ICS_DAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/** Minimal .ics parser (Google/Apple export): weekly recurring and one-off timed events. */
export function parseIcs(text, { today, days = 14, toCentral } = {}) {
  const unfolded = String(text || '').replace(/\r?\n[ \t]/g, '');
  const events = unfolded.split('BEGIN:VEVENT').slice(1).map((chunk) => chunk.split('END:VEVENT')[0]);
  const out = [];
  for (const ev of events.slice(0, 300)) {
    const get = (name) => {
      const m = new RegExp(`^${name}(;[^:\\n]*)?:(.*)$`, 'm').exec(ev);
      return m ? { params: m[1] || '', value: m[2].trim() } : null;
    };
    const ds = get('DTSTART');
    const de = get('DTEND');
    if (!ds || !/T\d{4}/.test(ds.value)) continue; // skip all-day events
    const parse = (v) => {
      const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/.exec(v.value);
      if (!m) return null;
      const utc = /Z$/.test(v.value);
      if (utc && toCentral) return toCentral(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
      return { date: `${m[1]}-${m[2]}-${m[3]}`, minutes: +m[4] * 60 + +m[5] };
    };
    const a = parse(ds);
    const b = de ? parse(de) : a && { date: a.date, minutes: a.minutes + 60 };
    if (!a || !b || b.minutes <= a.minutes) continue;
    const title = (get('SUMMARY')?.value || 'Busy').replace(/\\([,;n])/g, (_, c) => (c === 'n' ? ' ' : c)).slice(0, 60);
    const rrule = get('RRULE')?.value || '';
    const block = { title, kind: kindFor(title), start: minutesToHhmm(a.minutes), end: minutesToHhmm(b.minutes), source: 'ics' };
    if (/FREQ=WEEKLY/.test(rrule)) {
      const by = /BYDAY=([A-Z,]+)/.exec(rrule)?.[1];
      block.days = by ? by.split(',').map((d) => ICS_DAYS[d.slice(-2)]).filter((d) => d != null) : [weekdayOf(a.date)];
      out.push(block);
    } else if (/FREQ=DAILY/.test(rrule)) {
      out.push({ ...block, days: [0, 1, 2, 3, 4, 5, 6] });
    } else if (!today || (a.date >= today && a.date <= addDays(today, days))) {
      out.push({ ...block, date: a.date });
    }
  }
  return out;
}
