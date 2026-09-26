// End-to-end golden path (spec Section 1) against the real service logic with an in-memory database.
// No AI (local mode): exercises every rule-based fallback, matching, missions, codes, hours and impact.
import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../base44/shared/memory-db.js';
import { dispatch } from '../base44/shared/service.js';
import { EXAMPLE_TEXT, EXAMPLE_NOTE } from '../base44/shared/golden.js';
import RESOURCES from '../data/resources.json';

function makeDeps(start = Date.UTC(2026, 8, 26, 15, 0)) {
  let now = start;
  const deps = {
    db: createMemoryDb(),
    loadResources: async () => RESOURCES.map((r) => ({ ...r, id: r.slug })),
    now: () => now,
    advance: (min) => {
      now += min * 60000;
    },
  };
  return deps;
}
const call = (deps, action, args) => dispatch(action, args, deps);

describe('golden path', () => {
  let deps;
  beforeEach(async () => {
    deps = makeDeps();
    await call(deps, 'reset');
  });

  it('starts in the exact reset state', async () => {
    const s = await call(deps, 'state', { role: 'volunteer', identity: 'jordan' });
    expect(s.impact).toMatchObject({ lbs: 1284, meals: 1070, families: 46, hours: 212 });
    expect(s.me.total_hours).toBe(11.5);
    expect(s.missions.map((m) => m.title_en)).toEqual(['Produce run: Green Crate → Oltorf Pantry Shelf']);
    expect(s.missions[0].eligibility.ok).toBe(false);
    expect(s.missions[0].eligibility.reasons).toEqual(expect.arrayContaining(['age_18', 'needs_car']));
    expect(s.donations.some((d) => d.giver_key === 'maple-masa')).toBe(false);
  });

  for (const lang of ['es', 'en']) {
    it(`runs every beat in ${lang}`, async () => {
      // BEAT 1 — neighbor
      const ex = await call(deps, 'extract', { text: EXAMPLE_TEXT[lang] });
      expect(ex).toMatchObject({ zip: '78741', household_size: 3, children_count: 2, child_under_5: true, urgency: 'today', tonight_need: true, detected_language: lang });
      expect(ex.situations).toEqual(expect.arrayContaining(['job_loss', 'single_parent']));
      expect(ex.needs).toEqual(expect.arrayContaining(['food', 'utilities']));

      const view = await call(deps, 'createPlan', { profile: ex, language: lang });
      expect(view.tonight.available).toBe(true);
      expect(view.plan.tonight.show).toBe(true);
      const ids = view.matches.map((m) => m.slug);
      for (const id of ['snap-texas', 'austin-energy-bill-help', 'twc-unemployment', 'wic-texas', 'medicaid-chip-texas', 'child-inc-head-start', 'austin-isd-school-meals', 'central-texas-food-bank']) {
        expect(ids).toContain(id);
      }
      expect(ids).not.toContain('snap-national'); // de-duplicated by program_key
      expect(view.matches.at(-1).slug).toBe('two-one-one-texas');

      const opts = await call(deps, 'requestOptions', { token: view.token });
      expect(opts.hubs[0].key).toBe('riverside-fridge');
      const afterReq = await call(deps, 'postRequest', { token: view.token, type: 'food_tonight', household_size: 3, food_prefs: [], hub_key: 'riverside-fridge', needed_by: '19:00', language: lang });
      expect(afterReq.request).toMatchObject({ code: 'LOOP-27', status: 'posted', pickup_by: '20:00' });

      // BEAT 2 — giver
      deps.advance(1);
      const photo = await call(deps, 'analyzePhoto', { giver_key: 'maple-masa', sample: true });
      expect(photo.draft.total_lbs).toBe(40);
      expect(photo.draft.safety_flags).toEqual([]);
      const posted = await call(deps, 'postDonation', { giver_key: 'maple-masa', draft: { ...photo.draft, pickup_start: '17:00', pickup_end: '18:00' }, allergens_confirmed: true });
      expect(posted.pickup_code).toBe('3816');

      // BEAT 3 — match
      deps.advance(1);
      let s = await call(deps, 'state', { role: 'volunteer', identity: 'jordan', token: view.token });
      const mission = s.missions.find((m) => m.giver?.key === 'maple-masa');
      expect(mission).toBeTruthy();
      expect(mission.hub.key).toBe('riverside-fridge');
      expect(mission.distance_mi).toBe(0.5);
      expect(mission.mode).toBe('walk');
      expect(mission.est_minutes).toBe(45);
      expect(mission.eligibility.ok).toBe(true);
      expect(mission.bag_instructions_en).toBe('Put bag LOOP-27 (2 trays rice & beans, 6 bolillos, 4 conchas) on the reserved shelf. Stock the rest in the fridge.');
      expect(s.my_request.status).toBe('matched');
      expect(s.activity.map((a) => a.message_en)).toContain('40 lbs at Maple & Masa Bakery ↔ family of 3 at Riverside Community Fridge · 0.5 mi');

      // BEAT 4 — volunteer
      await expect(call(deps, 'claimMission', { mission_key: mission.key, volunteer_key: 'jordan' })).rejects.toMatchObject({ code: 'buddy_required' });
      await call(deps, 'claimMission', { mission_key: mission.key, volunteer_key: 'jordan', buddy_key: 'maya' });
      s = await call(deps, 'state', { role: 'neighbor', token: view.token });
      expect(s.my_request.status).toBe('on_the_way');
      await expect(call(deps, 'missionPickup', { mission_key: mission.key, volunteer_key: 'jordan', code: '0000' })).rejects.toMatchObject({ code: 'wrong_code' });
      await call(deps, 'missionPickup', { mission_key: mission.key, volunteer_key: 'jordan', code: '3816', confirmed_lbs: 40 });
      await expect(call(deps, 'missionDropoff', { mission_key: mission.key, volunteer_key: 'jordan', code: '1111' })).rejects.toMatchObject({ code: 'wrong_code' });
      const done = await call(deps, 'missionDropoff', { mission_key: mission.key, volunteer_key: 'jordan', code: '4721' });
      expect(done).toMatchObject({ lbs: 40, meals: 33, families: 1, hours_each: 0.75 });

      // BEAT 5 — loop closes
      s = await call(deps, 'state', { role: 'volunteer', identity: 'jordan', token: view.token });
      expect(s.my_request.status).toBe('ready');
      expect(s.impact).toMatchObject({ lbs: 1324, meals: 1103, families: 47, hours: 213.5 });
      expect(s.me.total_hours).toBe(12.25);
      await call(deps, 'confirmPickup', { token: view.token });
      const thanks = await call(deps, 'sendThanks', { token: view.token, text: EXAMPLE_NOTE.es });
      expect(thanks.ok).toBe(true);
      s = await call(deps, 'state', { role: 'volunteer', identity: 'jordan', token: view.token });
      expect(s.my_request.status).toBe('picked_up');
      expect(s.missions.find((m) => m.key === mission.key).thanks).toHaveLength(1);
    });
  }

  it('resets exactly, even mid-flow', async () => {
    const ex = await call(deps, 'extract', { text: EXAMPLE_TEXT.en });
    const view = await call(deps, 'createPlan', { profile: ex, language: 'en' });
    await call(deps, 'postRequest', { token: view.token, type: 'food_tonight', household_size: 3, hub_key: 'riverside-fridge', needed_by: '19:00' });
    await call(deps, 'reset');
    await expect(call(deps, 'getPlan', { token: view.token })).rejects.toMatchObject({ code: 'plan_not_found' });
    const s = await call(deps, 'state', { role: 'volunteer', identity: 'jordan' });
    expect(s.impact).toMatchObject({ lbs: 1284, meals: 1070, families: 46, hours: 212, plans: 38 });
    expect(s.me.total_hours).toBe(11.5);
    const again = await call(deps, 'createPlan', { profile: ex, language: 'en' });
    const r = await call(deps, 'postRequest', { token: again.token, type: 'food_tonight', household_size: 3, hub_key: 'riverside-fridge', needed_by: '19:00' });
    expect(r.request.code).toBe('LOOP-27');
  });
});

describe('judge-proofing', () => {
  let deps;
  beforeEach(async () => {
    deps = makeDeps();
    await call(deps, 'reset');
  });

  it('flags crisis text', async () => {
    const ex = await call(deps, 'extract', { text: "I don't feel safe at home and I don't want to be here anymore" });
    expect(ex.crisis_flag).toBe(true);
  });

  it('handles out-of-area and invalid ZIPs', async () => {
    const v = await call(deps, 'createPlan', { profile: { zip: '10001', needs: ['food'] }, language: 'en' });
    expect(v.tonight.available).toBe(false);
    expect(v.matches.every((m) => ['national'].includes(v.resources[m.slug].coverage_type))).toBe(true);
    await expect(call(deps, 'createPlan', { profile: { zip: '00000', needs: ['food'] } })).rejects.toMatchObject({ code: 'invalid_zip' });
  });

  it('blocks unsafe food posts', async () => {
    const draft = { items: [{ name_en: 'Raw chicken', name_es: 'Pollo crudo', quantity_text: '5 lbs', est_lbs: 5, category: 'other', storage: 'cold' }], pickup_start: '17:00', pickup_end: '18:00' };
    await expect(call(deps, 'postDonation', { giver_key: 'maple-masa', draft, allergens_confirmed: true })).rejects.toMatchObject({ code: 'unsafe_food' });
  });

  it('enforces age rules for Ana (14)', async () => {
    const s = await call(deps, 'state', { role: 'volunteer', identity: 'ana' });
    const produce = s.missions.find((m) => m.mode === 'car');
    expect(produce.eligibility.reasons).toEqual(expect.arrayContaining(['age_18', 'needs_car', 'after_7pm']));
  });

  it('asks follow-ups for vague input', async () => {
    const ex = await call(deps, 'extract', { text: 'need help' });
    expect(ex.zip).toBeNull();
    expect(ex.household_size).toBeNull();
  });
});
