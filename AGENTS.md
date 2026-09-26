# AGENTS.md

## Base44 dev environment

- Run with `docker compose -f docker-compose.base44.yml up -d --build`. A single `web` service runs `node:22` with the repo bind-mounted at `/app`.
- No dependencies, no build step, no migrations: the app is a zero-dependency Node HTTP server. `package.json` has no dependencies, so nothing needs installing before start.
- The SQLite database is created automatically at `$DATA_DIR` (`/app/data/benefitbridge.sqlite`) and seeded from `data.js` on first boot. Seeding is idempotent (only runs when the `resources` table is empty).
- Node 22's built-in `node --sqlite` support emits an `ExperimentalWarning: SQLite is an experimental feature` on startup. This is expected noise, not an error.
- Secret `GEMINI_API_KEY` (and optional `OPENAI_API_KEY`) arrive through `/run/base44/app.env` and enable AI features; `GET /api/health` reports `ai_enabled`. Without them the app still works using local extraction and rule-based plans.
- `npm run dev` cannot be used here: `--env-file-if-exists=.env` makes Node's `--watch` crash when `.env` is absent. The compose service therefore runs `node --watch server.js` directly.
- `ADMIN_TOKEN` is optional. `/admin` and `/api/admin/*` stay disabled unless it is at least 24 characters.

## Verify it works

- Health: `curl http://localhost:3000/api/health` → `{"ok":true,...}`.
- Tests: `docker compose -f docker-compose.base44.yml exec -T web node --test` (3 tests: Gemini unit tests plus a full English/Spanish plan integration test).
- End-to-end: `POST /api/explain` or `POST /api/plans` with `{"zip":"78741","needs":["food"],"household_size":2}` returns matched resources and an action plan.
- The UI is static: `public/index.html` plus `public/app.js`, `design.css`, `styles.css`, `personality.css`. Server changes need a container restart; static file edits are picked up on refresh.
