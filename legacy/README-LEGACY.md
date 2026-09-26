# Legacy: BenefitBridge server (Deepam's version)

This folder is the BenefitBridge app that was on `main` before the team moved to **Loop** on Base44.
It is kept intact and still runs on its own:

```bash
cd legacy/benefitbridge-server
node --test        # its own tests
npm start          # http://localhost:3000 (Node 22.13+, SQLite, optional GEMINI_API_KEY)
```

Why it moved: Base44 hosts a static site plus serverless functions, so a Node `http` server with a SQLite
file can't be deployed there. Ideas from this app that now live in Loop:

- Server-side **Gemini** provider (`base44/shared/gemini.js`, used when the `GEMINI_API_KEY` Base44 secret is set).
- The **"unsupported fact" guard**: AI text containing a phone number, URL or dollar amount that is not in the source
  data is rejected (`base44/shared/guard.js`).
- Deeper official links for several Austin programs.
