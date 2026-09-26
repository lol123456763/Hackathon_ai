// Builds the exact "Reset demo" starting state (spec Section 1 + 9B) as plain records.
import { HUBS, GIVERS, TEAMS, VOLUNTEERS, EVENTS, SAMPLE_ACTIVITY, OPEN_PRODUCE_POST } from './data/neighborhood.js';
import { VOLUNTEER_PROFILES, CALENDARS, PROJECTS, SCHOOLS } from './data/youth.js';
import { distanceMiles } from './zip.js';
import { centralParts, centralToEpoch, makeClock } from './time.js';

export const NS = 'loop';
export const SEEDED_ENTITIES = ['Hub', 'Giver', 'Team', 'Volunteer', 'Event', 'Activity', 'Donation', 'Mission', 'HelpRequest', 'PlanSession', 'DemoState', 'CalendarBlock', 'Project'];

function eventDate(clock, dayOffset) {
  const today = clock.today;
  let add = dayOffset;
  if (dayOffset === 'next_saturday') add = ((6 - today.weekday + 7) % 7) || 7;
  const noon = centralToEpoch(today.year, today.month, today.day, 12, 0) + add * 86400000;
  const p = centralParts(noon);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function buildSeed(resetAtMs) {
  const clock = makeClock(resetAtMs, resetAtMs);
  const iso = (ms) => new Date(ms).toISOString();
  const giver = (k) => GIVERS.find((g) => g.key === k);
  const hub = (k) => HUBS.find((h) => h.key === k);

  const teams = TEAMS.map((t) => {
    const members = VOLUNTEERS.filter((v) => v.team_key === t.key);
    return {
      ns: NS, key: t.key, name: t.name, member_keys: members.map((m) => m.key),
      total_hours: members.reduce((s, m) => s + m.total_hours, 0), total_lbs: members.reduce((s, m) => s + m.total_lbs, 0),
    };
  });

  const volunteers = VOLUNTEERS.map((v) => {
    const p = VOLUNTEER_PROFILES[v.key] || {};
    return { ns: NS, ...v, school: SCHOOLS[p.school]?.name || v.school, school_key: p.school || null, interests: p.interests || [], weekly_goal_hours: p.weekly_goal_hours || 2, stats: p.stats || { committed: 0, completed: 0 }, declined: [], hours_log: [] };
  });
  let n = 0;
  const calendar = Object.entries(CALENDARS).flatMap(([vk, blocks]) => blocks.map((b) => ({ ns: NS, key: `cal-seed-${++n}`, volunteer_key: vk, status: 'planned', source: 'seed', ...b })));
  const projects = PROJECTS.map((p) => ({ ns: NS, ...p, remote: !!p.remote }));

  const events = EVENTS.map((e) => ({
    ns: NS, key: e.key, type: e.type, title_en: e.title_en, title_es: e.title_es, description_en: e.description_en, description_es: e.description_es,
    date: eventDate(clock, e.day_offset), start: e.start, end: e.end, hub_key: e.hub_key, area_label: e.area_label, lat: e.lat, lng: e.lng,
    host: e.host, min_age: e.min_age, spots: e.spots, rsvp_keys: [], checked_in_keys: [], checkin_code: e.checkin_code, hours_credit: e.hours_credit,
    status: 'posted', sample: true,
  }));

  const activity = SAMPLE_ACTIVITY.map(([minutesAgo, type, en, es, placeKey]) => {
    const place = placeKey ? hub(placeKey) || giver(placeKey) : null;
    return { ns: NS, type, message_en: en, message_es: es, lat: place?.lat ?? null, lng: place?.lng ?? null, at: iso(resetAtMs - minutesAgo * 60000), sample: true };
  });

  // History posts (already delivered) + Green Crate's open produce post with its locked car mission.
  const donations = [
    {
      ns: NS, key: 'hist-riverbend', giver_key: 'riverbend-taqueria', items: [{ name_en: 'Rice and tortillas', name_es: 'Arroz y tortillas', quantity_text: '6 trays', est_lbs: 18, category: 'prepared', storage: 'cold' }],
      total_lbs: 18, confirmed_lbs: 18, allergens: ['wheat'], pickup_start: '14:00', pickup_end: '15:00', pickup_code: '2291', status: 'delivered', at: iso(resetAtMs - 60 * 60000), sample: true,
    },
    {
      ns: NS, key: 'hist-eastbank', giver_key: 'eastbank-cafeteria', items: [{ name_en: 'Sealed lunches', name_es: 'Almuerzos sellados', quantity_text: 'about 40', est_lbs: 35, category: 'packaged', storage: 'cold' }],
      total_lbs: 35, confirmed_lbs: 35, allergens: ['milk', 'wheat'], pickup_start: '13:00', pickup_end: '14:00', pickup_code: '8834', status: 'delivered', at: iso(resetAtMs - 1440 * 60000), sample: true,
    },
    {
      ns: NS, key: 'green-crate-open', giver_key: OPEN_PRODUCE_POST.giver_key, items: OPEN_PRODUCE_POST.items, total_lbs: OPEN_PRODUCE_POST.total_lbs, allergens: [],
      handling_en: 'Keep greens cool.', handling_es: 'Mantén las verduras frescas.', pickup_start: OPEN_PRODUCE_POST.pickup[0], pickup_end: OPEN_PRODUCE_POST.pickup[1],
      pickup_code: OPEN_PRODUCE_POST.pickup_code, status: 'matched', at: iso(resetAtMs - 20 * 60000), sample: true,
    },
  ];

  const gc = giver('green-crate');
  const ol = hub(OPEN_PRODUCE_POST.hub_key);
  const produceMission = {
    ns: NS, key: 'green-crate-run', type: 'food_run', title_en: OPEN_PRODUCE_POST.mission.title_en, title_es: OPEN_PRODUCE_POST.mission.title_es,
    donation_key: 'green-crate-open', giver_key: gc.key, hub_key: ol.key, request_ids: [], distance_mi: Math.round(distanceMiles(gc, ol) * 10) / 10,
    mode: OPEN_PRODUCE_POST.mission.mode, est_minutes: OPEN_PRODUCE_POST.mission.est_minutes, min_age: OPEN_PRODUCE_POST.mission.min_age,
    window_start: OPEN_PRODUCE_POST.pickup[0], window_end: OPEN_PRODUCE_POST.pickup[1],
    brief_en: 'Drive 60 lbs of produce crates from Green Crate Market to Oltorf Pantry Shelf. Adult drivers only. Lift with a partner.',
    brief_es: 'Lleva en auto 60 lbs de cajas de verduras de Green Crate Market a Oltorf Pantry Shelf. Solo conductores adultos. Levanta con un compañero.',
    brief_source: 'template', impact_en: 'restocks the pantry shelf', impact_es: 'reabastece la despensa',
    status: 'open', volunteer_keys: [], lbs_planned: 60, sample: true,
  };

  const demo = { ns: NS, key: 'demo', reset_at: iso(resetAtMs), next_request_seq: 27, plans_since_reset: 0 };

  return {
    Hub: HUBS.map((h) => ({ ns: NS, ...h })),
    Giver: GIVERS.map((g) => ({ ns: NS, ...g })),
    Team: teams,
    Volunteer: volunteers,
    Event: events,
    Activity: activity,
    Donation: donations,
    Mission: [produceMission],
    HelpRequest: [],
    PlanSession: [],
    DemoState: [demo],
    CalendarBlock: calendar,
    Project: projects,
  };
}
