# Get Discounted

A Progressive Web App (PWA) that aggregates credit card promotions from Malaysian banks, auto-refreshes the data, and can alert users to new and nearby deals. Currently covers **18 banks / 51 promotions**.

## Files

| File | Purpose |
|------|---------|
| `index.html` | The app — search, filter by merchant/bank/category, "near me", alerts |
| `promos.json` | The promotion data (edit this to update offers; the app auto-syncs it) |
| `manifest.webmanifest` | PWA metadata so the app is installable |
| `service-worker.js` | Offline caching + web-push notification handling |
| `icon-*.png`, `apple-touch-icon.png`, `favicon-32.png` | App icons |
| `netlify/functions/subscribe.mjs` | Serverless endpoint that stores push subscriptions |
| `netlify/functions/send.mjs` | Admin endpoint that sends web push to all subscribers |
| `ingest/scrape.mjs` | Automated scraper that rewrites `promos.json` from bank pages |
| `.github/workflows/update-promos.yml` | Daily cron: scrape → commit → notify |
| `.github/workflows/deploy-pages.yml` | Optional GitHub Pages deploy |
| `package.json`, `.env.example` | Deps + the env vars to set in Netlify |
| `ARCHITECTURE.md` / `DEPLOY.md` / `DOMAIN.md` | Production design / deploy paths / custom domain |

## Backend & automation (what's wired)

- **Automated data** — `ingest/scrape.mjs` fetches each bank's promo page and rewrites `promos.json`, keeping manual entries and flagging new ones. The GitHub Action runs it daily and commits changes. Adapters for CIMB/RHB are real examples; the rest are stubs to fill in as you verify selectors. Prefer official feeds and respect each site's robots.txt/ToS.
- **Real web push** — `subscribe.mjs` stores subscriptions in Netlify Blobs; `send.mjs` (admin-token protected) pushes to everyone and prunes dead subs. The client subscribes on "Enable alerts". After ingestion finds new promos, the workflow calls `/send` so subscribers get notified even with the app closed.
- **To activate**: set the env vars from `.env.example` in Netlify (VAPID keys, `ADMIN_TOKEN`, `SITE_URL`) and add `ADMIN_TOKEN` + `SITE_URL` as GitHub Actions secrets. VAPID public key is already in `index.html`.

## Custom domain

See `DOMAIN.md` for pointing **getdiscounted.my** at the Netlify site (registrar + DNS records). The app uses relative paths, so no code changes are needed.

## Run it locally

The PWA features (installable app, service worker, web push) only work over `http(s)`, **not** by double-clicking the file. From this folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. To install: in Chrome/Edge use the install icon in the address bar; on iPhone Safari use Share → Add to Home Screen.

> Opening `index.html` directly still works for browsing — it falls back to an embedded snapshot — but auto-sync, install, and push are disabled on `file://`.

## Host it (recommended)

Upload the whole folder to any static host — GitHub Pages, Netlify, Vercel, Cloudflare Pages. That gives you HTTPS, real auto-refresh of `promos.json`, installability, and a working web-push endpoint.

## Updating promotions

Edit `promos.json` and redeploy. Open pages pick up changes within ~90 seconds (or via the **Refresh now** button). Each promo needs: `id`, `merchant`, `cat`, `bank`, `card`, `offer`, `expiry`, `link`, and optional `outlets` (`[{name, lat, lng}]`) to power "near me". Expired promos hide automatically.

## Turning on real push notifications

The client is wired for web push; you just need a backend to send it:

1. Generate VAPID keys (e.g. `npx web-push generate-vapid-keys`).
2. Put the **public** key into `VAPID_PUBLIC_KEY` in `index.html`.
3. Uncomment the `fetch('/api/subscribe', …)` call in `subscribePush()` and build an endpoint that stores each subscription with the user's preferences (home city, categories, quiet hours).
4. When ingestion adds a promo — or a geofence reports a user near an outlet — have the backend send a push with `web-push` to the stored subscriptions. `service-worker.js` already renders it and deep-links on tap.

See `ARCHITECTURE.md` for the full ingestion, geofencing, and delivery design.

## Disclaimer

Offers are compiled from public bank pages and change frequently. This is an independent informational aggregator, not affiliated with any bank, and does not access users' cards or transactions. Always confirm terms on the bank's official page before spending.
