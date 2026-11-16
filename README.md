# Prepper Field Guide — Obsidian plugin

> **Payment disclosure:** the core plugin is free. Some features require a one-time **Pro** license ($19). Pro features are marked ⭐ below. Licenses are verified fully offline (Ed25519 signature) — no account, no server, no phone-home.

Builds an **offline, location-based preparedness guide** inside your vault. Set your location once, run one command, and you get:

| Note | What's in it | Data source |
|---|---|---|
| **Offline map (interactive)** | Pan/zoom USGS topo + satellite map that works with no signal: live GPS dot, all water/medical/shelter/supply markers, long-press for distance from home, ⭐ waypoints, set-home pin-drop, nearest-water finder. Optional printable JPGs. | USGS The National Map (public domain) |
| **Local Resources** | Nearest-water summary; USGS-recorded springs, wells and stream gages plus OSM springs, wells, drinking water, rivers/lakes, hospitals, clinics, pharmacies, fire/police/EMS, shelters, campsites, fuel, hardware, grocery — distance, direction, coordinates, phone | OpenStreetMap + USGS Water Data API |
| **Plants/** | One note per local species that matches a curated edible / caution / toxic / deadly list — photo, what to eat or why it's dangerous, lookalikes, local observation count, Wikipedia summary. Index note sorted deadliest-first, plus the 75 most common unclassified local plants | iNaturalist research-grade observations, Wikipedia |
| **Weather & Hazards** | NWS office, county, active alerts, 7-day forecast (US only) | api.weather.gov |
| **⭐ Almanac** | 30 years of daily weather at your exact point → last/first freeze dates with 1-in-10-year risk, growing season, monthly normals & records, days ≥95°F / nights ≤32°F, rain-catchment estimate, what to prepare for each month (freeze, heat, flood, hurricane), 6-month seasonal outlook vs normal, planting calendar keyed to your frost dates, sunrise/sunset and full/new moons | PRISM Climate Group (OSU) via NOAA RCC-ACIS; NOAA Climate Prediction Center outlooks; sun/moon computed offline (US lower 48) |
| **⭐ Pantry Plan** | Food, water, hygiene and medicine targets scaled to your household (adults, kids, pets) and duration (2 weeks → 1 year), with shelf life, storage tips, and a "Have" column that survives refreshes | Built in (standard long-term storage planning baselines) |
| **⭐ Medicinal Plants** | Local medicinal species with honest evidence ratings (good / some / traditional only), uses, traditional preparation, cautions & drug interactions, deadly lookalikes, a symptom quick-finder, a "historically used — don't" list, and an Herbal Preparations guide | iNaturalist, Wikipedia, built-in reference |
| **Family Emergency Plan** | Fill-in template: contacts, meeting places, evacuation routes, shutoffs, kids' pickup — created once, never overwritten | Built in |
| **Guides/** | Water purification (CDC/EPA doses), foraging safety rules, fire, shelter & signaling, first aid quick reference, go-bag checklist | Built in |
| **Prepper Home** | Hub with links + your own "My notes" section (preserved on refresh) | — |

Everything is plain Markdown + JPG — works with no signal, syncs with GSync, prints fine.

## Install
1. Copy `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/prepper-field-guide/`
2. Settings → Community plugins → enable **Prepper Field Guide**
3. Click the ⛺ ribbon icon (or command palette → *Prepper: Build / refresh entire field guide*) and enter your **full street address**. The plugin shows what it matched; if it only found your street or town, choose **Fine-tune on map** and tap your exact spot.
4. Open the map any time with the 🗺️ ribbon icon.

### Where the map tiles live
Tiles are saved under `Prepper/.tiles/` (a hidden folder, so Obsidian doesn't index thousands of images). Defaults download ~25 km at overview zooms and ~5 km at full detail. Settings show the estimated size before you download. Re-running only fetches missing tiles. If your sync tool skips hidden folders, run *Download offline maps* once on each device.

Works on desktop, iPad and Android (`isDesktopOnly: false`). On phones/tablets keep *Max tiles per side* ≤ 16 so the map canvas fits in memory.

## Commands
- Set my location
- Build / refresh entire field guide
- Download offline maps
- Find local water sources & emergency resources
- Build local edible & poisonous plant guide
- Refresh weather & alerts
- Write survival guides

## Privacy
Your location is stored only in the plugin's `data.json`. A typed address is sent to the US Census Bureau geocoder (OpenStreetMap Nominatim as fallback). Coordinates are sent to: USGS Water Data API, Overpass/OpenStreetMap, iNaturalist, USGS tile server, and api.weather.gov. No accounts, no API keys, no telemetry.

## Notes & limits
- USGS tiles cover the US only. Elsewhere, add a custom tile source whose terms allow offline download (not tile.openstreetmap.org).
- The plant list is a conservative memory aid for North America — **not an identification tool**. A plant not on the list is *unknown*, not safe. The plugin never recommends eating wild mushrooms; fungi are a danger list only.
- Overpass/iNaturalist are rate-limited public services — the plugin throttles itself; if a step fails, re-run just that command later.

## Build from source
```
npm install
npm run build
```

## Free vs Pro
| | Free | ⭐ Pro |
|---|---|---|
| Interactive offline map, GPS, nearest water | 15 km overview, 3 km detail (zoom 15) | up to 100 km overview, 20 km detail (zoom 16) |
| Water sources & emergency resources | ✅ | ✅ |
| Edible & poisonous plants | ✅ | ✅ |
| Weather & alerts | ✅ | ✅ |
| Survival guides + family emergency plan | ✅ | ✅ |
| Local almanac | — | ✅ |
| Medicinal plants guide | — | ✅ |
| Pantry planner | — | ✅ |
| Map waypoints | — | ✅ |
| Printable map images | — | ✅ |

## Selling licenses (maintainer)
```
node tools/license.mjs keygen                      # once — creates keys/private.key (NEVER commit) and keys/public.key
node tools/license.mjs sign "Jane Doe <jane@x.com>" # issue a key for a buyer
node tools/license.mjs verify PFG-...               # check a key
```
Paste `keys/public.key` into `src/license.ts` (`PUBLIC_KEY`) and set `BUY_URL`. Losing the private key means you can't issue new keys that work with existing installs; leaking it lets anyone mint keys.

## Sales & automatic license delivery
`sales-worker/` is a Cloudflare Worker that hosts the sales page, takes payments through Stripe Checkout, and issues + emails license keys automatically. Setup: [sales-worker/DEPLOY.md](sales-worker/DEPLOY.md).

Releases: push a tag equal to the manifest version (e.g. `2.0.1`) and `.github/workflows/release.yml` builds and publishes the GitHub release.
