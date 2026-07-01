# Get Discounted — Location + Notification Architecture

This sketches how the demo page grows into a real app that notifies users about nearby credit-card promotions. The current `index.html` is a working front-end prototype: it auto-refreshes from `promos.json`, filters by distance using the browser's geolocation, and fires a browser notification when new promos appear. The pieces below are what turn that prototype into a production service.

## The gap between the prototype and production

The prototype fakes three things that a real system must do properly. It reads a hand-maintained `promos.json` instead of ingesting promotions automatically; it geolocates only when the page is open instead of watching location in the background; and it fires a local browser notification instead of a true push that reaches a phone whose app is closed. Everything else — the merchant model, distance math, category filtering — carries straight over.

## Data ingestion (keeping promos fresh)

Bank promotions live on dozens of pages that change weekly, so the data layer is the hard part. A scheduled job (hourly or daily) fetches each bank's promotions page, extracts structured offers, geocodes the participating outlets, and writes them to a database. Extraction is a mix of official feeds where they exist, HTML parsing where the markup is stable, and an LLM pass to turn messy promo copy into the clean `{merchant, offer, category, expiry, outlets}` shape the app already uses. Each record keeps a `source` URL and a `lastSeen` timestamp so stale offers auto-expire when they drop off the bank's site. Outlets are geocoded once (address → lat/lng) and cached. The mobile app and the web page both read the same `/promos` API, so the front-end never changes when a bank is added.

## Location layer

There are two modes. **Foreground** is what the prototype already does: request location when the user opens the app, compute Haversine distance to each promo's outlets, and sort/filter by radius. **Background geofencing** is the real value: register the outlet coordinates as geofences with the OS (iOS `CLLocationManager` region monitoring, Android `GeofencingClient`) so the OS wakes the app when the user physically enters, say, a 200 m radius around a participating Shell station or AEON store. The app then checks which promos apply at that location and asks the backend whether to notify. Battery matters, so production uses coarse significant-location updates plus a capped number of active geofences (iOS allows 20 per app), dynamically swapping in the nearest outlets as the user moves.

## Notification layer

Notifications flow from server to device through the platform push services rather than being generated on-device. When ingestion adds a promo, or when a geofence entry reports a user near a participating outlet, the backend decides whether to send — respecting the user's category preferences, home city, quiet hours, and a per-user rate limit so nobody gets spammed. It then sends through **APNs** (iOS), **FCM** (Android), and the **Web Push API** with VAPID keys (browser/PWA). A service worker on web and the OS notification handler on mobile render the alert even when the app is closed. Deep links carry the user straight to the relevant promo card and its official terms link.

## Suggested stack

A pragmatic build uses a **PWA or React Native** client (the current HTML is already a valid PWA starting point — add a manifest and service worker), a **Node or Python API** over **PostgreSQL + PostGIS** for fast "outlets within N km" geo-queries, a **scheduled scraper/ingestion worker**, and **FCM + APNs + Web Push** for delivery. PostGIS is worth calling out: it does the radius and geofence lookups in the database far more efficiently than looping in app code, which is what the prototype does today.

## Privacy and trust

Location and push are sensitive permissions, so the app should ask for them in context (explain the benefit before the OS prompt), keep precise coordinates on-device where possible and send only "am I near outlet X" checks to the server, offer granular controls (per-category, per-bank, radius, quiet hours), and make it obvious this is an independent aggregator that is not affiliated with any bank and does not see the user's card or transaction data.

## Incremental path

Ship the current page as a hosted PWA so `promos.json` auto-syncs and web push works. Automate ingestion for the top five banks so the JSON stops being hand-maintained. Add PostGIS and the `/promos` geo-API. Then wrap the PWA in React Native (or go native) to unlock background geofencing and reliable mobile push. Each step is usable on its own, so the app delivers value before the whole system is built.
