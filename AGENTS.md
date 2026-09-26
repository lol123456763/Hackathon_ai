# Instructions for AI coding agents (Claude Code, ChatGPT / Codex, Copilot, Cursor)

This repo is **Loop**, a Base44 app coded in the repo and deployed with the Base44 CLI. Three students work on it at the same time. Follow these rules exactly.

## Golden rules

1. **Never break the golden path.** `tests/golden-path.test.js` runs the whole 3-minute demo headlessly. It must pass. Run `npm test` before every commit.
2. **Work on a branch, open a PR.** Never commit to `main`, never force-push, never rewrite someone else's commits. Start with `git pull --rebase origin main`. If you hit a merge conflict, resolve it by keeping both people's intent; ask the human if unsure.
3. **Run `npm run check` before pushing** (lint + tests + data validation + build). CI runs it on every PR.
4. **Business logic lives in `base44/shared/`** — plain JavaScript that runs in the browser (local mode), Node (tests) and Deno (Base44 function). Import with `@shared/…` in `src/`, and with relative `../../shared/…js` in `base44/functions/`. Do not import npm packages or `src/` code from `base44/shared/`.
5. **Every UI string goes in both `src/i18n/en.js` and `src/i18n/es.js`** (warm Latin-American Spanish, "tú"). `tests/i18n.test.js` fails if keys or `{placeholders}` differ.
6. **Safety decisions are code, never AI**: who can take a mission (`base44/shared/loop.js` → `missionEligibility`), verification (two codes), and what data is visible (`getState` in `service.js`). Never add a field for a neighbor's name, phone or home address. Never show a request's location on the map (only counts at hubs).
7. **AI calls** go through `callAI()` in `service.js`: strict JSON schema, 12-second budget, retry once, then a rule-based or golden fallback. Prompts live in `base44/shared/prompts.js` and must forbid inventing programs, phone numbers, URLs, amounts or eligibility rules.
8. **Never invent program data.** Resource records need an official `source_url`. Phone numbers only if confirmed on an official page. Curated programs in `base44/shared/data/programs.js` use the exact official URLs.
9. **No secrets in the repo** (it is public). No API keys, tokens, or `.env` files. `base44/.app.jsonc` is git-ignored.
10. **Match the surrounding code**: React function components, Tailwind classes with the design tokens in `src/index.css`, `lucide-react` icons, 44 px minimum touch targets, visible focus states, `aria-*` labels.

## Base44 platform reference

Official Base44 agent docs are in `.claude/skills/` (`base44-sdk`, `base44-cli`, `base44-troubleshooter`). Read `base44-sdk/SKILL.md` before using any Base44 API — method names differ from Firebase/Supabase (e.g. `entities.X.filter()`, `functions.invoke()` returns an axios response with `.data`).

## Map of the code

- `base44/shared/service.js` — every action (`dispatch(action, args, deps)`), the live `getState` snapshot, reset.
- `base44/shared/matching.js` — program matching (spec 7A). `loop.js` — surplus matching, mission rules, hours (7B–7D).
- `base44/shared/coordinator.js` + `coordinator-service.js` — the student calendar and AI coordinator (free time, conflict-free suggestions, predictions, buddies). `tests/coordinator.test.js` proves suggestions never overlap the calendar.
- `legacy/` — the original BenefitBridge server; do not edit it for Loop features.
- `base44/shared/golden.js` — the demo inputs and golden fallbacks. `seed.js` + `data/neighborhood.js` — the reset state.
- `base44/functions/app/entry.ts` — the only backend function (thin wrapper around `dispatch`).
- `src/api/backend.js` — picks Base44 (remote) or local mode. `src/state/app.jsx` — role, identity, live polling, toasts.
- `src/pages/{neighbor,give,volunteer,hub,shared}` — screens by role. `src/components/` — shared UI.

## Commands

```bash
npm run dev            # local mode at http://localhost:5173 (no Base44 account needed)
npm test               # vitest: golden path, judge-proofing, i18n
npm run lint
npm run check          # everything CI runs
npm run data:build     # research/verified/*.json + curated programs → data/resources.json
npm run validate:data
```
