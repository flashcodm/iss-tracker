/* ORBITAL — real-time ISS ground track
   Position data: https://wheretheiss.at (no API key required)
*/

const ISS_API = 'https://api.wheretheiss.at/v1/satellites/25544';
const REFRESH_MS = 5000;
const MAX_TRAIL_POINTS = 1080; // ~90 min at 5s intervals

// ---------- Map setup ----------
const map = L.map('map', {
  worldCopyJump: true,
  zoomControl: true,
  attributionControl: true
}).setView([20, 0], 2);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_matter/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap &copy; CARTO',
  subdomains: 'abcd',
  maxZoom: 19
}).addTo(map);

// custom ISS icon
const issIcon = L.divIcon({
  className: 'iss-icon',
  html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:#ffb020;box-shadow:0 0 12px 4px rgba(255,176,32,0.7);
      border:2px solid #0a0f1a;"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9]
});

const issMarker = L.marker([0, 0], { icon: issIcon, zIndexOffset: 1000 }).addTo(map);

const trail = L.polyline([], {
  color: '#4fd8e0',
  weight: 2,
  opacity: 0.6,
  dashArray: '1 6'
}).addTo(map);

let terminatorLayer = null;
const trailPoints = [];

// ---------- Day/night terminator ----------
// Approximate subsolar point, then draw the great-circle 90° from it.
function getSubsolarPoint(date) {
  const rad = Math.PI / 180;
  const dayMs = 1000 * 60 * 60 * 24;
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((date - start) / dayMs);

  // Solar declination (approximation)
  const decl = -23.44 * Math.cos(rad * (360 / 365) * (dayOfYear + 10));

  // Equation of time correction (minutes) — simplified
  const B = (360 / 365) * (dayOfYear - 81) * rad;
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);

  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const solarTime = utcHours + eot / 60;
  const subsolarLon = 180 - solarTime * 15;

  return { lat: decl, lon: ((subsolarLon + 180) % 360) - 180 };
}

function buildTerminatorPolygon(date) {
  const { lat: subLat, lon: subLon } = getSubsolarPoint(date);
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;
  const points = [];

  // Trace the circle 90 degrees away from the subsolar point
  for (let i = 0; i <= 360; i += 2) {
    const bearing = i * rad;
    const latRad = 0; // 90 degrees from subsolar point along varying bearings
    const subLatRad = subLat * rad;
    const subLonRad = subLon * rad;
    const angDist = 90 * rad;

    const lat2 = Math.asin(
      Math.sin(subLatRad) * Math.cos(angDist) +
      Math.cos(subLatRad) * Math.sin(angDist) * Math.cos(bearing)
    );
    const lon2 = subLonRad + Math.atan2(
      Math.sin(bearing) * Math.sin(angDist) * Math.cos(subLatRad),
      Math.cos(angDist) - Math.sin(subLatRad) * Math.sin(lat2)
    );

    points.push([lat2 * deg, ((lon2 * deg + 540) % 360) - 180]);
  }
  return { points, subLat, subLon };
}

function drawTerminator() {
  const now = new Date();
  const { points, subLat, subLon } = buildTerminatorPolygon(now);

  if (terminatorLayer) map.removeLayer(terminatorLayer.night);
  if (terminatorLayer && terminatorLayer.sun) map.removeLayer(terminatorLayer.sun);

  // Night-side shading: polygon from terminator line wrapped to cover the anti-solar hemisphere
  const night = L.polygon(points, {
    color: 'transparent',
    fillColor: '#000000',
    fillOpacity: 0.38,
    stroke: false
  }).addTo(map);

  const sun = L.circleMarker([subLat, subLon], {
    radius: 6,
    color: '#ffe27a',
    weight: 1,
    fillColor: '#ffe27a',
    fillOpacity: 0.9
  }).bindTooltip('Subsolar point', { direction: 'top' }).addTo(map);

  terminatorLayer = { night, sun };
}

// ---------- Telemetry / ISS fetch ----------
const elLat = document.getElementById('val-lat');
const elLon = document.getElementById('val-lon');
const elAlt = document.getElementById('val-alt');
const elVel = document.getElementById('val-vel');
const elVis = document.getElementById('val-vis');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const refreshBar = document.getElementById('refresh-bar');

let hasCentered = false;

async function fetchIssPosition() {
  const res = await fetch(ISS_API, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API responded ${res.status}`);
  return res.json();
}

function fmt(n, digits = 2) {
  return Number(n).toFixed(digits);
}

async function updateIss() {
  try {
    const data = await fetchIssPosition();
    const { latitude, longitude, altitude, velocity, visibility } = data;

    issMarker.setLatLng([latitude, longitude]);

    trailPoints.push([latitude, longitude]);
    if (trailPoints.length > MAX_TRAIL_POINTS) trailPoints.shift();
    trail.setLatLngs(trailPoints);

    if (!hasCentered) {
      map.setView([latitude, longitude], 3);
      hasCentered = true;
    }

    elLat.textContent = `${fmt(latitude)}°`;
    elLon.textContent = `${fmt(longitude)}°`;
    elAlt.textContent = `${fmt(altitude)} km`;
    elVel.textContent = `${fmt(velocity)} km/h`;
    elVis.textContent = visibility === 'daylight' ? 'Daylight' : 'Eclipsed';

    statusDot.classList.add('live');
    statusText.textContent = 'SIGNAL LOCKED';
  } catch (err) {
    statusDot.classList.remove('live');
    statusText.textContent = 'SIGNAL LOST — RETRYING';
    console.error('ISS fetch failed:', err);
  }
}

// ---------- Clock ----------
function updateClock() {
  const now = new Date();
  const h = String(now.getUTCHours()).padStart(2, '0');
  const m = String(now.getUTCMinutes()).padStart(2, '0');
  const s = String(now.getUTCSeconds()).padStart(2, '0');
  document.getElementById('utc-clock').textContent = `${h}:${m}:${s}`;
}

// ---------- Refresh progress bar ----------
let refreshStart = Date.now();
function tickProgress() {
  const elapsed = Date.now() - refreshStart;
  const pct = Math.min(100, (elapsed / REFRESH_MS) * 100);
  refreshBar.style.width = `${pct}%`;
}

// ---------- Main loop ----------
function cycle() {
  updateIss();
  refreshStart = Date.now();
}

cycle();
drawTerminator();
setInterval(cycle, REFRESH_MS);
setInterval(drawTerminator, 60 * 1000); // reposition sun/terminator every minute
setInterval(updateClock, 1000);
setInterval(tickProgress, 100);
updateClock();
