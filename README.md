# Loop

**Find the help that exists. Activate the help that doesn't.**

Loop connects two worlds of help that don't talk to each other:

- **Formal programs** (SNAP, WIC, utility help) are powerful but slow and confusing.
- **Community help** (surplus food, neighbors, student volunteers) is fast but scattered.

A neighbor describes their situation → AI builds a plan grounded in **real programs** → whatever the plan can't cover tonight becomes an **anonymous request** → a local business posts **surplus food** from a photo → Loop **matches** them and creates a **safe mission** for student volunteers → students carry the food to a **trusted hub** → the neighbor's plan flips to **"Tonight: covered ✓"** and pounds, meals and **verified service hours** are logged automatically.

Built for the **AI No-Code Hackathon** (Round Rock ISD), Community Activation track. Fully bilingual (English / Español), mobile-first, works at 375 px.

---

## Quick start (no account needed)

```bash
npm install
npm run dev
```

Open http://localhost:5173. Without a Base44 app linked, Loop runs in **local mode**: the exact same backend logic runs in your browser on a localStorage database, with rule-based fallbacks instead of AI. Everything in the golden path works.

## The 3-minute demo (golden path)

1. **Neighbor** → *Get help* → **Probar un ejemplo (Español)** → plan appears → **Publicar mi solicitud** → **Publicar de forma anónima** (code **LOOP-27**).
2. **Give** (Maple & Masa Bakery) → **Use sample photo** → confirm allergens → **Post** (pickup code **3816**).
3. The match happens automatically (watch the Live Loop map and feed).
4. **Volunteer** (Jordan R.) → *Bakery run* → pick **Maya T.** → **Claim with my buddy** → tap **Demo: 3816** → **Yes** → tap **Demo: 4721** → **Done** → celebration.
5. **Neighbor** → *Tonight: covered ✓* → **Ya la recogí** → **Usar ejemplo** → **Enviar agradecimiento**. Impact counters: **+40 lbs, +33 meals, +1 family, +1.5 hours**.

**Demo menu (⋮) → Reset demo** restores the exact starting state in under 3 seconds. **Hide demo helpers** hides code chips and example buttons for judges.

## How it's built

```
base44/                  Base44 backend (deployed with `base44 deploy`)
  config.jsonc           app config (public, site build settings)
  entities/*.jsonc       13 data tables with row-level security
  functions/app/         ONE backend function: POST { action, args }
  shared/                ALL business logic — shared by the backend AND the browser
    service.js           every action (plans, requests, posts, missions, codes, reset…)
    matching.js          7A program matching (deterministic, before AI)
    loop.js              7B surplus matching, 7C who can take a mission, 7D hours/impact
    prompts.js           AI prompts + JSON schemas (6A–6G)
    golden.js            golden-path examples + GoldenOutput fallbacks
    plan.js, extract.js  rule-based plan + intake (AI fallbacks)
    seed.js, data/       demo neighborhood, curated programs, Texas ZIP → county
src/                     React + Vite + Tailwind site
  api/                   remote (Base44) vs local (in-browser) backend
  state/                 role switcher, live polling (2.5 s), neighbor flow
  pages/{neighbor,give,volunteer,hub,shared}
  i18n/en.js, es.js      every UI string in both languages (CI checks they match)
data/resources.json      1,400+ Texas + national programs (curated + researched)
research/                raw + verified research files (source for data/resources.json)
scripts/                 data build, validation, ZIP data, Base44 seeding
tests/                   golden path end-to-end, judge-proofing, i18n
```

**Safety is code, not AI.** AI writes, extracts, translates and summarizes. Deterministic rules decide who can take which mission (age, buddy, distance, time, car), what counts as verified (two codes), and what anyone can see (no neighbor locations, ever). Every AI call has a 12-second budget with a retry, then a rule-based or golden fallback, so the demo never stalls.

## Deploying to Base44

The repo **is** the Base44 app. When you're ready (one person does this, once):

```bash
npx base44 login                 # sign in to the Base44 account that will own the app
npx base44 link --create -n Loop # creates the app and links this folder (writes base44/.app.jsonc, not committed)
npm run build
npx base44 deploy -y             # pushes entities, the app function, and the site
npm run seed                     # loads data/resources.json into the Resource table
```

Open the app URL that `deploy` prints. The demo neighborhood seeds itself on first load. After that, every merge to `main` is deployed with `npm run build && npx base44 deploy -y`.

To make yourself an admin (for the entities dashboard), use the Base44 dashboard → Users.

## Team workflow

- **Never push to `main`.** Create a branch (`feat/…`, `fix/…`, `data/…`), push it, open a pull request.
- Before pushing: `npm run check` (lint + tests + data validation + build). CI runs the same on every PR.
- Pull often: `git pull --rebase origin main` before you start and before you push.
- Keep **both languages** in sync: add every new string to `src/i18n/en.js` **and** `src/i18n/es.js`.
- Business logic goes in `base44/shared/` (so it works on Base44 **and** in local mode), never only in React.
- AI coding assistants (Claude, ChatGPT/Codex): read [AGENTS.md](AGENTS.md) first.

## Data

- `base44/shared/data/programs.js` — curated real programs (official URLs; phones only where verified).
- `research/` — deep research of Texas resources by region, each record verified against its official source.
- `npm run data:build` merges them into `data/resources.json` (curated programs always win on duplicates).
- `npm run validate:data` checks every record (CI).

## License

MIT
