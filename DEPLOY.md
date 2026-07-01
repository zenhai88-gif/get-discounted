# Deploy Get Discounted (make it live)

The app is a plain static site — no build step. Pick whichever path suits you. All give you a public HTTPS URL, which is required for install + push to work.

## Fastest — Netlify Drop (no account, ~20 seconds)

1. Go to **https://app.netlify.com/drop**
2. Drag the file **`getdiscounted-site.zip`** (in this folder) onto the page.
3. You instantly get a live URL like `https://random-name.netlify.app`.
4. (Optional) Click "Claim site" to keep it and rename it.

That's the true one-drop deploy. To update later, drag a new zip.

## One-click button — Netlify (permanent, from GitHub)

1. Push this folder to a GitHub repo.
2. Add this button to your repo's README (already included below) and click it, or go to Netlify → "Add new site" → "Import from Git" → pick the repo. Netlify reads `netlify.toml` automatically.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/YOUR_USERNAME/get-discounted)

## One-click button — Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/get-discounted)

Vercel reads `vercel.json` automatically. Replace `YOUR_USERNAME` after you create the repo.

## Free & automatic — GitHub Pages

1. Push this folder to a GitHub repo named e.g. `get-discounted`.
2. Repo **Settings → Pages → Source: GitHub Actions**.
3. The included workflow (`.github/workflows/deploy-pages.yml`) publishes on every push to `main`.
4. Live at `https://YOUR_USERNAME.github.io/get-discounted/`.

## After it's live

- **Install it**: open the URL in Chrome/Edge (install icon in the address bar) or iPhone Safari (Share → Add to Home Screen).
- **Update promos**: edit `promos.json`, redeploy (or push) — open apps auto-sync within ~90s.
- **Turn on real push**: add your VAPID public key in `index.html` and stand up the subscribe endpoint (see `README.md` and `ARCHITECTURE.md`).
