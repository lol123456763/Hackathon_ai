// AI coordinator + calendar: suggestions never conflict with the student's calendar, accept/decline/move
// work, shift check-ins credit verified hours, and schedules can be typed or imported.
import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../base44/shared/memory-db.js';
import { dispatch } from '../base44/shared/service.js';
import { parseScheduleText, parseIcs, blocksOn } from '../base44/shared/coordinator.js';
import { hhmmToMinutes } from '../base44/shared/time.js';
import { EXAMPLE_TEXT } from '../base44/shared/golden.js';
import RESOURCES from '../data/resources.json';

function makeDeps() {
  let now = Date.UTC(2026, 8, 23, 15, 0); // a Wednesday
  return {
    db: createMemoryDb(),
    loadResources: async () => RESOURCES.map((r) => ({ ...r, id: r.slug })),
    now: () => now,
    advance: (min) => {
      now += min * 60000;
    },
  };
}
const call = (deps, action, args) => dispatch(action, args, deps);

function assertNoConflicts(week, suggestions) {
  for (const s of suggestions) {
    const day = week.find((d) => d.date === s.date);
    const a = hhmmToMinutes(s.start);
    const b = hhmmToMinutes(s.end);
    for (const blk of day.blocks) {
      const c = hhmmToMinutes(blk.start);
      const d = hhmmToMinutes(blk.end);
      expect(b <= c || a >= d, `${s.title_en} ${s.date} ${s.start}-${s.end} overlaps ${blk.title} ${blk.start}-${blk.end}`).toBe(true);
    }
  }
}

describe('AI coordinator', () => {
  let deps;
  beforeEach(async () => {
    deps = makeDeps();
    await call(deps, 'reset');
  });

  it('suggests a conflict-free week that respects age rules', async () => {
    for (const key of ['jordan', 'maya', 'ana', 'sam']) {
      const c = await call(deps, 'coordinator', { volunteer_key: key });
      expect(c.week).toHaveLength(7);
      expect(c.suggestions.length).toBeGreaterThan(0);
      assertNoConflicts(c.week, c.suggestions);
      for (const s of c.suggestions) {
        expect(s.likelihood).toBeGreaterThanOrEqual(35);
        expect(s.likelihood).toBeLessThanOrEqual(97);
        if (key === 'ana') expect(hhmmToMinutes(s.end)).toBeLessThanOrEqual(19 * 60); // 14-year-old: done by 7 PM
      }
    }
    const ana = await call(deps, 'coordinator', { volunteer_key: 'ana' });
    expect(ana.suggestions.some((s) => s.ref_key === 'civic-table')).toBe(false); // 16+ project
  });

  it('never suggests anything during school', async () => {
    const c = await call(deps, 'coordinator', { volunteer_key: 'jordan' });
    for (const s of c.suggestions) {
      const wd = new Date(`${s.date}T12:00:00Z`).getUTCDay();
      if (wd >= 1 && wd <= 5) expect(hhmmToMinutes(s.start)).toBeGreaterThanOrEqual(15 * 60 + 30);
    }
  });

  it('accepts a project shift, then verifies it with the check-in code', async () => {
    const c = await call(deps, 'coordinator', { volunteer_key: 'jordan' });
    const shift = c.suggestions.find((s) => s.type === 'project');
    expect(shift).toBeTruthy();
    await call(deps, 'acceptSuggestion', { volunteer_key: 'jordan', opp_key: shift.opp_key });
    const after = await call(deps, 'coordinator', { volunteer_key: 'jordan' });
    const block = after.week.flatMap((d) => d.blocks).find((b) => b.opp_key === shift.opp_key);
    expect(block).toMatchObject({ kind: 'loop', status: 'planned' });
    expect(after.suggestions.some((s) => s.opp_key === shift.opp_key)).toBe(false);
    assertNoConflicts(after.week, after.suggestions);

    await expect(call(deps, 'checkinShift', { volunteer_key: 'jordan', block_key: block.key, code: '0000' })).rejects.toMatchObject({ code: 'wrong_code' });
    const r = await call(deps, 'checkinShift', { volunteer_key: 'jordan', block_key: block.key, code: after.demo_codes[shift.ref_key] });
    const s = await call(deps, 'state', { role: 'volunteer', identity: 'jordan' });
    expect(s.me.total_hours).toBe(11.5 + r.hours);
    expect(s.impact.hours).toBe(212 + r.hours);
    expect(s.impact.projects).toBe(65);
  });

  it('declines, and offers other times to move to', async () => {
    const c = await call(deps, 'coordinator', { volunteer_key: 'jordan' });
    const first = c.suggestions[0];
    const alts = await call(deps, 'alternatives', { volunteer_key: 'jordan', opp_key: first.opp_key });
    expect(Array.isArray(alts.options)).toBe(true);
    await call(deps, 'declineSuggestion', { volunteer_key: 'jordan', opp_key: first.opp_key, reason: 'busy' });
    const after = await call(deps, 'coordinator', { volunteer_key: 'jordan' });
    expect(after.suggestions.some((s) => s.opp_key === first.opp_key)).toBe(false);
  });

  it('fits the golden-path bakery run into Jordan’s free time and puts the claim on both calendars', async () => {
    const ex = await call(deps, 'extract', { text: EXAMPLE_TEXT.en });
    const view = await call(deps, 'createPlan', { profile: ex, language: 'en' });
    await call(deps, 'postRequest', { token: view.token, type: 'food_tonight', household_size: 3, hub_key: 'riverside-fridge', needed_by: '19:00' });
    const photo = await call(deps, 'analyzePhoto', { giver_key: 'maple-masa', sample: true });
    await call(deps, 'postDonation', { giver_key: 'maple-masa', draft: { ...photo.draft, pickup_start: '17:00', pickup_end: '18:00' }, allergens_confirmed: true });
    const c = await call(deps, 'coordinator', { volunteer_key: 'jordan' });
    const s = await call(deps, 'state', { role: 'volunteer', identity: 'jordan' });
    const bakery = s.missions.find((m) => m.giver?.key === 'maple-masa');
    expect(c.mission_fit[bakery.key]).toBeTruthy();
    const top = c.suggestions.find((x) => x.ref_key === bakery.key);
    expect(top.families).toBe(1);
    await call(deps, 'acceptSuggestion', { volunteer_key: 'jordan', opp_key: top.opp_key, buddy_key: 'maya' });
    const maya = await call(deps, 'coordinator', { volunteer_key: 'maya' });
    expect(maya.week[0].blocks.some((b) => b.ref_key === bakery.key)).toBe(true);
  });

  it('adds typed schedule blocks and removes a single day', async () => {
    const parsed = await call(deps, 'parseSchedule', { text: 'Piano lessons Mon 5-6pm, volunteering none' });
    expect(parsed.blocks[0]).toMatchObject({ days: [1], start: '17:00', end: '18:00' });
    await call(deps, 'calendarAdd', { volunteer_key: 'ana', blocks: parsed.blocks });
    const c = await call(deps, 'coordinator', { volunteer_key: 'ana' });
    assertNoConflicts(c.week, c.suggestions);
  });
});

describe('schedule parsing', () => {
  it('reads natural schedules in English and Spanish', () => {
    const b = parseScheduleText('School M-F 8-3:30; robotics Tue/Thu 3:45-5:15pm, homework weekdays 7:30-9, tarea lunes a viernes 6 a 7:30, soccer sat 10am-12pm');
    expect(b).toEqual([
      { title: 'School', kind: 'school', days: [1, 2, 3, 4, 5], start: '08:00', end: '15:30' },
      { title: 'robotics', kind: 'activity', days: [2, 4], start: '15:45', end: '17:15' },
      { title: 'homework', kind: 'homework', days: [1, 2, 3, 4, 5], start: '19:30', end: '21:00' },
      { title: 'tarea', kind: 'homework', days: [1, 2, 3, 4, 5], start: '18:00', end: '19:30' },
      { title: 'soccer', kind: 'activity', days: [6], start: '10:00', end: '12:00' },
    ]);
  });

  it('imports weekly and one-off events from an .ics file', () => {
    const ics = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'SUMMARY:Band practice', 'DTSTART;TZID=America/Chicago:20260922T160000', 'DTEND;TZID=America/Chicago:20260922T173000', 'RRULE:FREQ=WEEKLY;BYDAY=TU,TH', 'END:VEVENT',
      'BEGIN:VEVENT', 'SUMMARY:Dentist', 'DTSTART:20260925T150000', 'DTEND:20260925T160000', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const blocks = parseIcs(ics, { today: '2026-09-23', days: 14 });
    expect(blocks).toEqual([
      { title: 'Band practice', kind: 'activity', start: '16:00', end: '17:30', source: 'ics', days: [2, 4] },
      { title: 'Dentist', kind: 'personal', start: '15:00', end: '16:00', source: 'ics', date: '2026-09-25' },
    ]);
    expect(blocksOn(blocks, '2026-09-24').map((x) => x.title)).toEqual(['Band practice']);
  });
});
