// Coordinator actions: the student's calendar, AI schedule import, weekly suggestions
// (accept / move / decline), shift check-ins and profile. Registered in service.js ACTIONS.
import { hhmmToMinutes, minutesToHhmm, centralParts } from './time.js';
import { planWeek, weekView, parseScheduleText, parseIcs, dateStr, addDays, weekdayOf } from './coordinator.js';
import { INTERESTS, SCHOOLS } from './data/youth.js';
import { unsupportedFacts, allText } from './guard.js';
import * as P from './prompts.js';

const KINDS = ['school', 'homework', 'activity', 'personal'];
const NS = 'loop';

export function makeCoordinatorActions({ ServiceError, clockFor, getState, callAI, claimMission, rsvpEvent, activity, newKey, nowMs }) {
  async function volunteer(deps, key) {
    const v = (await deps.db.list('Volunteer', { key }, undefined, 1))[0];
    if (!v) throw new ServiceError(404, 'volunteer_not_found');
    return v;
  }
  const blocksOf = (deps, key) => deps.db.list('CalendarBlock', { volunteer_key: key }, undefined, 500);
  const withPoint = (v) => ({ ...v, school_point: SCHOOLS[v.school_key] || null });

  function cleanBlock(b) {
    const s = hhmmToMinutes(b?.start);
    const e = hhmmToMinutes(b?.end);
    if (s == null || e == null || e <= s) return null;
    const days = Array.isArray(b.days) ? [...new Set(b.days.map(Number).filter((d) => d >= 0 && d <= 6))] : [];
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date || '')) ? b.date : null;
    if (!days.length && !date) return null;
    return {
      title: String(b.title || 'Busy').trim().slice(0, 60) || 'Busy',
      kind: KINDS.includes(b.kind) ? b.kind : 'personal',
      ...(date ? { date } : { days: days.sort() }),
      start: minutesToHhmm(s),
      end: minutesToHhmm(e),
      source: ['manual', 'ai_text', 'ics'].includes(b.source) ? b.source : 'manual',
    };
  }

  /** Plan the week and attach friendly reasons (AI first, template fallback on the client). */
  async function coordinator({ volunteer_key, language, with_ai = true }, deps) {
    const { clock } = await clockFor(deps);
    const today = dateStr(clock.today);
    const nowMin = clock.minutesOf(clock.now);
    const state = await getState({ role: 'volunteer', identity: volunteer_key }, deps);
    const [allVols, me, myBlocks, projects] = await Promise.all([
      deps.db.list('Volunteer', { ns: NS }, undefined, 200),
      volunteer(deps, volunteer_key),
      blocksOf(deps, volunteer_key),
      deps.db.list('Project', { ns: NS }, undefined, 100),
    ]);
    const others = await Promise.all(allVols.filter((o) => o.key !== me.key).map(async (o) => ({ volunteer: withPoint(o), blocks: await blocksOf(deps, o.key) })));
    // Missions come from the live snapshot (includes giver/hub/requests details).
    const plan = planWeek({ volunteer: withPoint(me), blocks: myBlocks, others, missions: state.missions, events: state.events, projects, today, nowMin });
    const week = weekView({ blocks: myBlocks, today, nowMin });

    let ai = null;
    if (with_ai && plan.suggestions.length && deps.invokeLLM) {
      const facts = plan.suggestions.map((s) => ({
        opp_key: s.opp_key, title: s.title_en, weekday: weekdayOf(s.date), date: s.date, start: s.start, end: s.end, place: s.place,
        likelihood_percent: s.likelihood, buddies_free: s.buddies.map((b) => b.display_name), families_waiting_tonight: s.families, why_codes: s.factors.map((f) => f.code), impact: s.impact_en,
      }));
      const busy = week.map((d) => ({ date: d.date, busy: d.blocks.map((b) => `${b.title} ${b.start}-${b.end}`) }));
      ai = await callAI(
        deps,
        { prompt: P.coordinatorPrompt({ name: me.display_name.split(' ')[0], interests: me.interests, goalHours: me.weekly_goal_hours, suggestions: facts, busy }), response_json_schema: P.COORDINATOR_SCHEMA },
        (x) => (x && typeof x.summary_en === 'string' && Array.isArray(x.reasons) && !unsupportedFacts(allText(x), JSON.stringify({ facts, busy })).length ? x : null),
      );
    }
    const reasons = new Map((ai?.reasons || []).map((r) => [r.opp_key, r]));
    const suggestions = plan.suggestions.map((s) => ({ ...s, reason_en: reasons.get(s.opp_key)?.reason_en?.slice(0, 220) || null, reason_es: reasons.get(s.opp_key)?.reason_es?.slice(0, 220) || null }));
    const freeMin = week.reduce((sum, d) => sum + d.free_minutes, 0);
    const suggestedMin = suggestions.reduce((sum, s) => sum + (hhmmToMinutes(s.end) - hhmmToMinutes(s.start)), 0);
    return {
      today,
      now: clock.now,
      language: language === 'es' ? 'es' : 'en',
      profile: { key: me.key, display_name: me.display_name, age: me.age, interests: me.interests || [], weekly_goal_hours: me.weekly_goal_hours || 2, school: SCHOOLS[me.school_key]?.name || null, stats: me.stats || null },
      week,
      suggestions,
      summary: ai ? { en: ai.summary_en.slice(0, 400), es: (ai.summary_es || ai.summary_en).slice(0, 400), ai: true } : null,
      stats: { free_minutes: freeMin, committed_minutes: plan.committedMin, suggested_minutes: suggestedMin, goal_minutes: plan.goalMin },
      interests: INTERESTS,
      demo_codes: Object.fromEntries(projects.map((p) => [p.key, p.checkin_code])), // demo helper chips only
      // For mission cards: which open runs fit this student's calendar today, and how likely they are to finish.
      mission_fit: Object.fromEntries(plan.candidates.filter((c) => c.type === 'mission').map((c) => [c.ref_key, { start: c.start, end: c.end, likelihood: c.likelihood, buddies: c.buddies.slice(0, 2) }])),
    };
  }

  async function calendarAdd({ volunteer_key, blocks }, deps) {
    await volunteer(deps, volunteer_key);
    const clean = (Array.isArray(blocks) ? blocks : []).slice(0, 40).map(cleanBlock).filter(Boolean);
    if (!clean.length) throw new ServiceError(400, 'invalid_block');
    await deps.db.bulkCreate('CalendarBlock', clean.map((b) => ({ ns: NS, key: newKey('cal'), volunteer_key, status: 'planned', ...b })));
    return { added: clean.length };
  }

  async function calendarRemove({ volunteer_key, block_key, date }, deps) {
    const b = (await deps.db.list('CalendarBlock', { key: block_key }, undefined, 1))[0];
    if (!b || b.volunteer_key !== volunteer_key) throw new ServiceError(404, 'block_not_found');
    if (b.kind === 'loop') {
      if (b.status === 'done') throw new ServiceError(409, 'already_done');
      await deps.db.update('CalendarBlock', b.id, { status: 'cancelled' });
      if (b.opp_type === 'mission') await releaseMission(b.ref_key, volunteer_key, deps);
      if (b.opp_type === 'event') await rsvpEvent({ event_key: b.ref_key, volunteer_key, going: false }, deps).catch(() => {});
      return { ok: true };
    }
    // Recurring block + date → skip just that day; otherwise delete it.
    if (!b.date && date) {
      await deps.db.update('CalendarBlock', b.id, { skip_dates: [...new Set([...(b.skip_dates || []), date])] });
    } else {
      await deps.db.update('CalendarBlock', b.id, { status: 'cancelled' });
    }
    return { ok: true };
  }

  async function releaseMission(missionKey, volunteerKey, deps) {
    const m = (await deps.db.list('Mission', { key: missionKey }, undefined, 1))[0];
    if (!m || m.status !== 'claimed' || !(m.volunteer_keys || []).includes(volunteerKey)) return;
    await deps.db.update('Mission', m.id, { status: 'open', volunteer_keys: [], claimed_at: null });
    const reqs = await Promise.all((m.request_ids || []).map((k) => deps.db.list('HelpRequest', { key: k }, undefined, 1).then((x) => x[0])));
    await Promise.all(reqs.filter((r) => r?.status === 'on_the_way').map((r) => deps.db.update('HelpRequest', r.id, { status: 'matched' })));
  }

  /** AI turns "School M-F 8-3:30, robotics Tue/Thu 3:45-5:15" into calendar blocks (preview only). */
  async function parseSchedule({ text }, deps) {
    const clean = String(text || '').trim().slice(0, 1200);
    if (!clean) throw new ServiceError(400, 'empty_text');
    const valid = (x) => {
      const blocks = (x?.blocks || []).map((b) => cleanBlock({ ...b, source: 'ai_text' })).filter(Boolean);
      return blocks.length ? blocks : null;
    };
    const ai = await callAI(deps, { prompt: P.schedulePrompt(clean), response_json_schema: P.SCHEDULE_SCHEMA }, valid);
    if (ai) return { blocks: ai, source: 'ai' };
    return { blocks: parseScheduleText(clean).map((b) => cleanBlock({ ...b, source: 'ai_text' })).filter(Boolean), source: 'rules' };
  }

  async function parseCalendarFile({ ics }, deps) {
    if (typeof ics !== 'string' || ics.length > 400000 || !/BEGIN:VCALENDAR/.test(ics)) throw new ServiceError(400, 'invalid_ics');
    const { clock } = await clockFor(deps);
    const toCentral = (ms) => {
      const p = centralParts(ms);
      return { date: dateStr(p), minutes: p.hour * 60 + p.minute };
    };
    const blocks = parseIcs(ics, { today: dateStr(clock.today), days: 14, toCentral }).map((b) => cleanBlock({ ...b, source: 'ics' })).filter(Boolean);
    return { blocks: blocks.slice(0, 40), total: blocks.length };
  }

  async function findCandidate(volunteer_key, opp_key, deps, { start } = {}) {
    const { clock } = await clockFor(deps);
    const today = dateStr(clock.today);
    const nowMin = clock.minutesOf(clock.now);
    const state = await getState({ role: 'volunteer', identity: volunteer_key }, deps);
    const [allVols, me, myBlocks, projects] = await Promise.all([deps.db.list('Volunteer', { ns: NS }, undefined, 200), volunteer(deps, volunteer_key), blocksOf(deps, volunteer_key), deps.db.list('Project', { ns: NS }, undefined, 100)]);
    const others = await Promise.all(allVols.filter((o) => o.key !== me.key).map(async (o) => ({ volunteer: withPoint(o), blocks: await blocksOf(deps, o.key) })));
    const plan = planWeek({ volunteer: withPoint(me), blocks: myBlocks, others, missions: state.missions, events: state.events, projects, today, nowMin });
    const c = plan.candidates.find((x) => x.opp_key === opp_key && (!start || x.start === start));
    return { c, plan, me, today };
  }

  /** Accept: re-checks the fit and rules on the server, then commits (claim / RSVP / sign up) and adds it to the calendar. */
  async function acceptSuggestion({ volunteer_key, opp_key, buddy_key }, deps) {
    const { c, me } = await findCandidate(volunteer_key, opp_key, deps);
    if (!c) throw new ServiceError(409, 'no_longer_fits');
    const buddy = buddy_key || (me.age < 18 && c.type === 'mission' ? c.buddies[0]?.key : null);
    if (c.type === 'mission') await claimMission({ mission_key: c.ref_key, volunteer_key, buddy_key: buddy || undefined }, deps);
    if (c.type === 'event') await rsvpEvent({ event_key: c.ref_key, volunteer_key, going: true }, deps);
    if (c.type === 'project') {
      const taken = await deps.db.list('CalendarBlock', { opp_key, status: 'planned' }, undefined, 50);
      const project = (await deps.db.list('Project', { key: c.ref_key }, undefined, 1))[0];
      if (project && taken.length >= project.spots) throw new ServiceError(409, 'full');
    }
    // Missions: claimMission already put the run on both teammates' calendars.
    if (c.type === 'mission') {
      await deps.db.update('Volunteer', me.id, { stats: { committed: (me.stats?.committed || 0) + 1, completed: me.stats?.completed || 0 } });
      return { ok: true, mission_key: c.ref_key };
    }
    const block = { ns: NS, key: newKey('cal'), volunteer_key, kind: 'loop', title: c.title_en, title_es: c.title_es, date: c.date, start: c.start, end: c.end, opp_key, opp_type: c.type, ref_key: c.ref_key, place: c.place, hours_credit: c.hours_credit, status: 'planned', source: 'loop', buddy_key: buddy || null };
    await deps.db.create('CalendarBlock', block);
    await deps.db.update('Volunteer', me.id, { stats: { committed: (me.stats?.committed || 0) + 1, completed: me.stats?.completed || 0 } });
    await activity(deps, 'planned', `${me.display_name} planned "${c.title_en}" into free time`, `${me.display_name} agendó "${c.title_es}" en su tiempo libre`, c.lat != null ? c : null);
    return { ok: true, mission_key: c.type === 'mission' ? c.ref_key : null };
  }

  async function declineSuggestion({ volunteer_key, opp_key, reason }, deps) {
    const me = await volunteer(deps, volunteer_key);
    const list = [...(me.declined || []), { opp_key: String(opp_key).slice(0, 160), reason: ['not_interested', 'busy', 'too_far', 'other'].includes(reason) ? reason : 'other', at: nowMs(deps) }].slice(-100);
    await deps.db.update('Volunteer', me.id, { declined: list });
    return { ok: true };
  }

  /** "Move": other times this same opportunity fits the student's week. */
  async function alternatives({ volunteer_key, opp_key }, deps) {
    const { plan } = await findCandidate(volunteer_key, opp_key, deps);
    const [type, ref] = String(opp_key).split(':');
    return { options: plan.candidates.filter((x) => x.type === type && x.ref_key === ref && x.opp_key !== opp_key).slice(0, 6) };
  }

  /** Project shifts are verified with the host's check-in code (like events). */
  async function checkinShift({ volunteer_key, block_key, code }, deps) {
    const b = (await deps.db.list('CalendarBlock', { key: block_key }, undefined, 1))[0];
    if (!b || b.volunteer_key !== volunteer_key || b.kind !== 'loop' || b.opp_type !== 'project') throw new ServiceError(404, 'block_not_found');
    if (b.status === 'done') throw new ServiceError(409, 'already_checked_in');
    const project = (await deps.db.list('Project', { key: b.ref_key }, undefined, 1))[0];
    if (!project || String(code || '').trim() !== project.checkin_code) throw new ServiceError(400, 'wrong_code');
    const me = await volunteer(deps, volunteer_key);
    const { clock } = await clockFor(deps);
    await deps.db.update('CalendarBlock', b.id, { status: 'done' });
    await deps.db.update('Volunteer', me.id, {
      total_hours: Math.round(((me.total_hours || 0) + project.hours_credit) * 100) / 100,
      stats: { committed: me.stats?.committed || 1, completed: (me.stats?.completed || 0) + 1 },
      hours_log: [...(me.hours_log || []), { kind: 'project', key: project.key, title_en: project.title_en, title_es: project.title_es, hub: project.place, hours: project.hours_credit, lbs: 0, at: clock.now, verified_by: ['checkin_code'] }],
    });
    const team = (await deps.db.list('Team', { key: me.team_key }, undefined, 1))[0];
    if (team) await deps.db.update('Team', team.id, { total_hours: Math.round(((team.total_hours || 0) + project.hours_credit) * 100) / 100 });
    await deps.db.create('Activity', { ns: NS, type: 'project', message_en: `${me.display_name} finished "${project.title_en}" (+${project.hours_credit} h)`, message_es: `${me.display_name} terminó "${project.title_es}" (+${project.hours_credit} h)`, lat: project.lat, lng: project.lng, at: new Date(nowMs(deps)).toISOString(), project: true });
    return { ok: true, hours: project.hours_credit };
  }

  async function updateProfile({ volunteer_key, interests, weekly_goal_hours }, deps) {
    const me = await volunteer(deps, volunteer_key);
    const patch = {};
    if (Array.isArray(interests)) patch.interests = [...new Set(interests.filter((i) => INTERESTS.includes(i)))];
    const g = Number(weekly_goal_hours);
    if (Number.isFinite(g)) patch.weekly_goal_hours = Math.max(0.5, Math.min(12, Math.round(g * 2) / 2));
    await deps.db.update('Volunteer', me.id, patch);
    return { ok: true, ...patch };
  }

  return { coordinator, calendarAdd, calendarRemove, parseSchedule, parseCalendarFile, acceptSuggestion, declineSuggestion, alternatives, checkinShift, updateProfile };
}

export { addDays };
