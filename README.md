# BenefitBridge

**From confusion to an exact plan in 60 seconds.** A bilingual, phone-first app that turns a short description into a prioritized list of public programs and community resources. It offers guidance; it never decides official eligibility.

## Run locally

Requires Node.js 22.13 or newer. No package installation is needed.

```bash
cp .env.example .env
# Set ADMIN_TOKEN to a random secret of at least 24 characters.
# Optionally set OPENAI_API_KEY for AI extraction, plan writing, and explanations.
npm start
```

On Windows PowerShell, copy the file with `Copy-Item .env.example .env`, edit it, and run `npm start`. Node loads `.env` automatically. Open <http://localhost:3000>.

The SQLite database is created in `data/` by default. Set `DATA_DIR` to a persistent writable directory in production. Put the app behind HTTPS and a reverse proxy. Configure `ADMIN_TOKEN` in the host's secret manager; do not commit it. Without it, `/admin` stays locked. The site works without an OpenAI key using local text extraction and a rule-based action plan. If a key is set, the server calls the OpenAI Responses API with `store: false`; extraction and plan generation fall back to local rules on failure.

## Main flows

- Describe a situation or select needs. A short wizard asks for the remaining facts and lets users review what was understood.
- Match active resources by ZIP coverage and need, then rank them. The app never claims the person is eligible.
- Save an anonymous plan at an unguessable `/plan/:id` URL. Checklist, selected resources, and completion state persist for 90 days. Anyone with the URL can view and edit that plan.
- Filter resources, open official links, call a program, print the plan, share its link, or read it aloud.
- Use `/admin` with `ADMIN_TOKEN` to review analytics, edit/deactivate resources, and import/export CSV.

The **Try an example** link uses a household in Austin ZIP 78741. Change the language in the header to run it in Spanish.

## Privacy and data

The server stores ZIP, broad household answers, selected needs, matched resource IDs, checklist progress, and anonymous feedback. It does not store the free-text description, names, Social Security numbers, exact addresses, or document numbers. Plans and feedback older than 90 days are deleted on startup and daily. The database is excluded from Git.

AI text is sent only when `OPENAI_API_KEY` is configured. The privacy page discloses this. Resource matching remains deterministic. Review agency rules, service areas, hours, and links before relying on a program; the linked agency is the source of truth. Seed listings are broad and avoid volatile income cutoffs.

## Verify

```bash
npm test
```

The integration test exercises extraction, Austin matching, English and Spanish plans, saved checkbox progress, ZIP fallback, feedback, and admin access.

## Configuration

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port (default `3000`) |
| `DATA_DIR` | SQLite storage directory (default `./data`) |
| `ADMIN_TOKEN` | Enables the admin dashboard; at least 24 characters |
| `OPENAI_API_KEY` | Optional AI features; never sent to the browser |
| `OPENAI_MODEL` | Optional model override (default `gpt-4.1-mini`) |

This is an application repository, not a hosted deployment. A durable writable disk is required for saved links and resource administration.
