# Pointing getdiscounted.my at your Netlify site

I can't register the domain or edit DNS for you (a `.my` domain must be bought under your name via a MYNIC-accredited registrar). Here's the exact path — about 15 minutes plus DNS propagation.

## 1. Register the domain

`.my` domains are sold through MYNIC-accredited registrars. Popular ones: **Exabytes, ServerFreak, Shinjiru, IP Serverone, Namecheap** (resellers vary). Search "getdiscounted.my" on any of them and complete checkout. Typical cost is roughly RM60–90/year for `.my` (confirm current pricing at checkout — it changes).

> Tip: `.com.my` needs a registered business; plain `.my` is open to individuals — so `getdiscounted.my` should be fine for a personal project.

## 2. Add the domain in Netlify

In your Netlify site (`inspiring-zabaione-3f30e3`) → **Domain management → Add a domain** → enter `getdiscounted.my`. Netlify will then show you which DNS records to create.

You have two options:

### Option A — Netlify DNS (simplest)
Netlify gives you 4 nameservers (e.g. `dns1.p0X.nsone.net`, …). At your registrar, replace the domain's nameservers with those four. Netlify then manages everything and auto-provisions HTTPS. Best if you don't need email on the domain elsewhere.

### Option B — Keep your registrar's DNS (add records)
At your registrar's DNS panel, add:

| Type | Name / Host | Value | Notes |
|------|-------------|-------|-------|
| `A` | `@` (apex) | `75.2.60.5` | Netlify's load balancer IP |
| `CNAME` | `www` | `inspiring-zabaione-3f30e3.netlify.app` | your Netlify subdomain |

Then in Netlify set `getdiscounted.my` (or `www`) as the **primary domain**. Netlify redirects the other automatically.

> The apex IP `75.2.60.5` is Netlify's documented load-balancer address; if Netlify's dashboard shows a different value for your site, use the one it shows.

## 3. HTTPS

Once DNS resolves, Netlify auto-issues a free Let's Encrypt certificate (Domain management → HTTPS → "Verify DNS / Provision certificate"). Wait until it's green before relying on push/install — service workers require HTTPS.

## 4. Update the app to the new origin

Everything in the app uses relative paths, so no code change is needed for it to work on the new domain. Just:

- Set the Netlify env var **`SITE_URL=https://getdiscounted.my`** (used by the GitHub Action to call the push endpoint).
- The `VAPID_SUBJECT` already points at `mailto:admin@getdiscounted.my` — fine even before you set up email.

That's it — after propagation (minutes to a few hours) the app is live at **https://getdiscounted.my**.
