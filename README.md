# ORBITAL — Real-Time ISS Ground Track

A single-page, no-build-step tracker for the International Space Station. Shows its live position on a dark map, a fading ground-track trail, the current day/night terminator, and a mission-control-style telemetry readout (lat/lon, altitude, velocity, sunlight status).

No frameworks, no backend, no API key. Just HTML/CSS/JS and two public APIs.

## How it works

- **Position data** comes from [wheretheiss.at](https://wheretheiss.at), polled every 5 seconds.
- **Map tiles** are CARTO's dark basemap, rendered with [Leaflet](https://leafletjs.com/).
- **The terminator** (day/night line) is calculated client-side from the current UTC time using a standard subsolar-point approximation — no external API needed for that part.
- Everything runs in the browser. Open `index.html` and it just works.

## Running it locally

Because it fetches from an API, some browsers are picky about `file://` pages. Easiest fix — serve it locally:

```bash
cd iss-tracker
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploying to GitHub Pages

1. Push this folder to a new GitHub repo.
2. In the repo, go to **Settings → Pages**.
3. Under "Build and deployment," set **Source** to `Deploy from a branch`, branch `main`, folder `/ (root)`.
4. Save — your tracker will be live at `https://<your-username>.github.io/<repo-name>/` in a minute or two.

## File structure

```
iss-tracker/
├── index.html      # page structure
├── css/style.css   # mission-control visual design
├── js/script.js    # ISS polling, map, terminator math, clock
└── README.md
```

## Ideas to extend it

- Add other satellites (Hubble, Tiangong) — wheretheiss.at supports other NORAD IDs.
- Plug in [n2yo.com](https://www.n2yo.com/api/)'s API (needs a free key) to show upcoming visible passes for your location.
- Add a click-to-set observer location and draw a visibility radius circle.
- Store trail history in `localStorage` alt... actually, browser storage isn't reliable in some sandboxed contexts — keep it in-memory per session, like this version does.

## Credits

Position data © [wheretheiss.at](https://wheretheiss.at). Map tiles © OpenStreetMap contributors, style by CARTO.
