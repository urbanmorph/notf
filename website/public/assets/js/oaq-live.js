/**
 * Live numbers for the home page's OAQ card.
 *
 * Reads the key-free mugilu mirror of the OAQ data broker (oaq.notf.in), so no
 * OAQ API key ever reaches the browser. The mirror sends CORS `*` and caches for
 * 15 minutes. The feed is ~66 KB compressed, so it is only fetched when the card
 * is near the viewport. If it fails, the live block hides and the card's text and
 * links stay.
 *
 * Cities shown come from the card's `data-oaq-cities` attribute (comma-separated).
 */

const OAQ_FEED_URL = 'https://mugilu.live/index.json';

// CPCB AQI bands, inclusive upper bounds. `key` is the i18n key under homepage.oaq.bands.
const AQI_BANDS = [
    { max: 50, key: 'good', label: 'Good', color: '#3E9B4F' },
    { max: 100, key: 'satisfactory', label: 'Satisfactory', color: '#9BBF3B' },
    { max: 200, key: 'moderate', label: 'Moderate', color: '#E0B527' },
    { max: 300, key: 'poor', label: 'Poor', color: '#E07B27' },
    { max: 400, key: 'very-poor', label: 'Very poor', color: '#C8382B' },
    { max: Infinity, key: 'severe', label: 'Severe', color: '#7E1F1F' },
];

function aqiBand(aqi) {
    return AQI_BANDS.find((band) => aqi <= band.max);
}

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Project a sensor onto the inline city outline: the same equirectangular
 * projection as scripts/build-oaq-outline.py. bbox is [minLon, minLat, maxLon, maxLat];
 * returns SVG {x, y}, or null when the point is missing or outside the bbox.
 */
function projectPoint(lon, lat, bbox, width) {
    const [minLon, minLat, maxLon, maxLat] = bbox;
    if (lon == null || lat == null || lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) return null;
    const kx = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
    const scale = width / ((maxLon - minLon) * kx);
    return { x: (lon - minLon) * kx * scale, y: (maxLat - lat) * scale };
}

/** Coverage counts plus each requested city's median AQI (cities with no reading are left out). */
function summariseStations(stations, cities) {
    const now = [];
    for (const city of cities) {
        const aqis = stations.filter((s) => s.city === city && s.aqi != null).map((s) => s.aqi);
        if (!aqis.length) continue;
        const aqi = Math.round(median(aqis));
        now.push({ city, aqi, band: aqiBand(aqi) });
    }
    return {
        stations: stations.length,
        cities: new Set(stations.map((s) => s.city).filter(Boolean)).size,
        networks: new Set(stations.map((s) => s.provider)).size,
        now,
    };
}

if (typeof document !== 'undefined') {
    // translator.t() returns the key itself when a string is missing.
    const t = (key, fallback) => {
        const value = window.translator?.t(key);
        return value && value !== key ? value : fallback;
    };
    const esc = (str) => String(str).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

    async function renderOaq(card) {
        const res = await fetch(OAQ_FEED_URL);
        if (!res.ok) throw new Error(`OAQ feed ${res.status}`);
        const { stations, generated_at: generatedAt } = await res.json();
        const cities = (card.dataset.oaqCities || '').split(',').map((c) => c.trim()).filter(Boolean);
        const summary = summariseStations(stations, cities);
        const fmt = (n) => n.toLocaleString('en-IN');

        card.querySelector('#oaqStations').textContent = fmt(summary.stations);
        card.querySelector('#oaqCities').textContent = fmt(summary.cities);
        card.querySelector('#oaqNetworks').textContent = fmt(summary.networks);
        card.querySelector('#oaqUpdated').textContent = new Date(generatedAt)
            .toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
        card.querySelector('#oaqNow').innerHTML = summary.now.map(({ city, aqi, band }) => `
            <li>
                <span class="oaq-dot" style="background:${band.color}" aria-hidden="true"></span>
                <span class="oaq-city">${esc(city)}</span>
                <span class="oaq-aqi">${aqi}</span>
                <span class="oaq-band" data-i18n="homepage.oaq.bands.${band.key}">${esc(t(`homepage.oaq.bands.${band.key}`, band.label))}</span>
            </li>`).join('');
        plotSensors(card.querySelector('#oaqMap'), stations);
    }

    function plotSensors(svg, stations) {
        if (!svg) return;
        const bbox = svg.dataset.bbox.split(',').map(Number);
        const width = svg.viewBox.baseVal.width;
        const dots = [];
        for (const s of stations) {
            const p = s.aqi != null && projectPoint(s.lon, s.lat, bbox, width);
            if (p) dots.push(`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="9" fill="${aqiBand(s.aqi).color}"/>`);
        }
        svg.querySelector('.oaq-map-dots').innerHTML = dots.join('');
    }

    document.addEventListener('DOMContentLoaded', () => {
        const card = document.getElementById('oaq');
        const live = document.getElementById('oaqLive');
        if (!card || !live) return;
        const run = () => renderOaq(card).catch((err) => {
            console.warn('OAQ live data unavailable:', err.message);
            live.hidden = true;
        });
        if (!('IntersectionObserver' in window)) return run();
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((e) => e.isIntersecting)) {
                observer.disconnect();
                run();
            }
        }, { rootMargin: '300px' });
        observer.observe(card);
    });
}
