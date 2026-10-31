/**
 * City map for the listing pages (/communities/, /catalog/): an India outline with
 * a bubble per city, sized by how many items are there, plus a row of city chips.
 * Picking a city (chip or bubble) filters the page's list through `onChange`.
 *
 * Needs map-projection.js (projectPoint) and india-outline.js (window.INDIA_OUTLINE)
 * loaded first. The selected city is kept in the URL as ?city=, so a city's view
 * can be linked to.
 */

// [lat, lon] of every city a community or catalogue project names. Add a city here
// when a catalogue project names a new one (tests/unit/city-map.test.ts checks).
const CITY_POINTS = {
    Ahmedabad: [23.02, 72.57], Alibaug: [18.64, 72.87], Bengaluru: [12.97, 77.59],
    Bhopal: [23.26, 77.41], Bhubaneswar: [20.30, 85.82], Bir: [32.04, 76.72],
    Bokaro: [23.67, 86.15], Chennai: [13.08, 80.27], 'Chhatrapati Sambhajinagar': [19.88, 75.34],
    Chikhaldara: [21.40, 77.32], Chintamani: [13.40, 78.06], Dehradun: [30.32, 78.03],
    Delhi: [28.61, 77.21], Dharamshala: [32.22, 76.32], Dhubri: [26.02, 89.98],
    Dibrugarh: [27.47, 94.91], Gandhinagar: [23.22, 72.65], Ghaziabad: [28.67, 77.45],
    Gorakhpur: [26.76, 83.37], Gurugram: [28.46, 77.03], Guwahati: [26.14, 91.74],
    Gwalior: [26.22, 78.18], Hazaribagh: [23.99, 85.36], Hyderabad: [17.39, 78.49],
    Jabalpur: [23.18, 79.99], Jaipur: [26.91, 75.79], Kagal: [16.58, 74.32],
    Kangra: [32.10, 76.27], Kanpur: [26.45, 80.33], Kasauli: [30.90, 76.96],
    Kochi: [9.93, 76.27], Kolkata: [22.57, 88.36], Lucknow: [26.85, 80.95],
    Manali: [32.24, 77.19], Meerut: [28.98, 77.71], Mumbai: [19.08, 72.88],
    Nagpur: [21.15, 79.09], Nashik: [20.00, 73.79], 'Navi Mumbai': [19.03, 73.03],
    Nellore: [14.44, 79.99], Panvel: [18.99, 73.12], Patan: [23.85, 72.13],
    'Pimpri-Chinchwad': [18.63, 73.80], Puducherry: [11.94, 79.81], Pune: [18.52, 73.86],
    Ramgarh: [23.63, 85.52], Ranchi: [23.34, 85.31], Silchar: [24.83, 92.78],
    Sivasagar: [26.98, 94.64], Solan: [30.91, 77.10], Solapur: [17.66, 75.91],
    Surat: [21.17, 72.83], Thane: [19.22, 72.98], Una: [31.47, 76.27],
    Varanasi: [25.32, 82.97], 'Vasai-Virar': [19.45, 72.81], Visakhapatnam: [17.69, 83.22],
};

// Other spellings people type, lower-cased.
const CITY_ALIASES = {
    bangalore: 'Bengaluru', bengalooru: 'Bengaluru', bombay: 'Mumbai', madras: 'Chennai',
    calcutta: 'Kolkata', gurgaon: 'Gurugram', 'new delhi': 'Delhi', vizag: 'Visakhapatnam',
    cochin: 'Kochi', pondicherry: 'Puducherry', aurangabad: 'Chhatrapati Sambhajinagar',
};

const CANONICAL = Object.fromEntries(Object.keys(CITY_POINTS).map((c) => [c.toLowerCase(), c]));

/** One spelling per city: "Karnataka, Bengaluru", " bangalore " → "Bengaluru". */
function normaliseCity(raw) {
    const parts = String(raw ?? '').split(',').map((p) => p.trim()).filter(Boolean);
    for (const part of [...parts].reverse()) {
        const key = part.toLowerCase();
        if (CITY_ALIASES[key] || CANONICAL[key]) return CITY_ALIASES[key] || CANONICAL[key];
    }
    return parts.at(-1) ?? '';
}

// Every spelling we know, longest first, so "navi mumbai" wins over "mumbai".
const CITY_NAMES = [...Object.keys(CANONICAL), ...Object.keys(CITY_ALIASES)]
    .sort((a, b) => b.length - a.length);

/** The city a question names, as {city, phrase}: "waste in bangalore?" → {city: "Bengaluru", phrase: "bangalore"}. */
function findCityIn(text) {
    const words = ` ${String(text ?? '').toLowerCase().replace(/[^\p{L}\p{N}-]+/gu, ' ')} `;
    const phrase = CITY_NAMES.find((name) => words.includes(` ${name} `));
    return phrase ? { city: normaliseCity(phrase), phrase } : null;
}

/** [{city, count, point}] for the cities `citiesOf(item)` names, busiest first. */
function countByCity(items, citiesOf) {
    const counts = new Map();
    for (const item of items) {
        for (const city of new Set(citiesOf(item).map(normaliseCity).filter(Boolean))) {
            counts.set(city, (counts.get(city) || 0) + 1);
        }
    }
    return [...counts]
        .map(([city, count]) => ({ city, count, point: CITY_POINTS[city] || null }))
        .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city));
}

/** Bubble radius in SVG units: area grows with the count. */
function bubbleRadius(count, max) {
    return 5 + 23 * Math.sqrt(count / Math.max(max, 1));
}

/** Labels for the biggest bubbles first, skipping any that would overlap one already placed. */
function placeLabels(bubbles, { charWidth = 10, height = 20, max = 8 } = {}) {
    const boxes = [];
    const placed = [];
    for (const b of [...bubbles].sort((p, q) => q.r - p.r)) {
        if (placed.length >= max) break;
        const box = { x1: b.x + b.r + 4, y1: b.y - height / 2, x2: b.x + b.r + 4 + b.city.length * charWidth, y2: b.y + height / 2 };
        if (boxes.some((o) => box.x1 < o.x2 && o.x1 < box.x2 && box.y1 < o.y2 && o.y1 < box.y2)) continue;
        boxes.push(box);
        placed.push({ ...b, x: box.x1, y: b.y });
    }
    return placed;
}

// Chips shown before "More cities" is pressed.
const CHIPS_SHOWN = 12;

if (typeof document !== 'undefined') {
    const esc = (str) => String(str).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

    function drawMap(svg, outline, rows) {
        const max = rows[0]?.count || 1;
        svg.setAttribute('viewBox', `0 0 ${outline.width} ${outline.height}`);
        svg.querySelector('.city-map-land').setAttribute('d', outline.d);
        const bubbles = rows
            .filter((r) => r.point)
            .map((r) => {
                const p = projectPoint(r.point[1], r.point[0], outline.bbox, outline.width);
                return p && { city: r.city, count: r.count, x: p.x, y: p.y, r: bubbleRadius(r.count, max) };
            })
            .filter(Boolean);
        // Small bubbles on top, so a big city never hides a neighbour.
        svg.querySelector('.city-map-bubbles').innerHTML = [...bubbles].sort((a, b) => b.r - a.r).map((b) => `
            <circle class="city-bubble" data-city="${esc(b.city)}" cx="${b.x.toFixed(1)}" cy="${b.y.toFixed(1)}" r="${b.r.toFixed(1)}">
                <title>${esc(b.city)}: ${b.count}</title>
            </circle>`).join('');
        svg.querySelector('.city-map-labels').innerHTML = placeLabels(bubbles).map((l) => `
            <text class="city-label" data-city="${esc(l.city)}" x="${l.x.toFixed(1)}" y="${l.y.toFixed(1)}" dy="0.35em">${esc(l.city)}</text>`).join('');
    }

    /**
     * Fill `root` (a .city-map block holding .city-chips and svg.city-map-figure) from
     * `items`. Calls onChange(city) on every pick, '' for all cities, and once at
     * start with the city from ?city=. Returns the starting city.
     */
    window.mountCityMap = function mountCityMap(root, { items, citiesOf, onChange }) {
        const rows = countByCity(items, citiesOf);
        const outline = window.INDIA_OUTLINE;
        const svg = root.querySelector('.city-map-figure');
        const chips = root.querySelector('.city-chips');

        // Without the outline (it failed to load), the chips still filter.
        if (outline) drawMap(svg, outline, rows);
        else svg.style.display = 'none';

        const allCount = chips.querySelector('[data-city=""] .city-chip-count');
        if (allCount) allCount.textContent = items.length;
        chips.insertAdjacentHTML('beforeend', rows.map((r, i) => `
            <button type="button" class="city-chip${i >= CHIPS_SHOWN ? ' is-extra' : ''}" data-city="${esc(r.city)}" aria-pressed="false">
                ${esc(r.city)} <span class="city-chip-count">${r.count}</span>
            </button>`).join(''));

        const more = root.querySelector('.city-chips-more');
        if (more && rows.length > CHIPS_SHOWN) {
            more.hidden = false;
            more.querySelector('.city-chips-more-count').textContent = rows.length - CHIPS_SHOWN;
            more.addEventListener('click', () => {
                more.setAttribute('aria-expanded', String(root.classList.toggle('show-all')));
            });
        }

        const known = new Set(rows.map((r) => r.city));
        function select(city, { updateUrl = true } = {}) {
            const current = known.has(city) ? city : '';
            root.querySelectorAll('[data-city]').forEach((el) => {
                const on = el.dataset.city === current;
                el.classList.toggle('is-selected', on);
                if (el.matches('button')) el.setAttribute('aria-pressed', String(on));
            });
            root.classList.toggle('has-selection', Boolean(current));
            if (updateUrl) {
                const url = new URL(location.href);
                if (current) url.searchParams.set('city', current);
                else url.searchParams.delete('city');
                history.replaceState(null, '', url);
            }
            onChange(current);
            return current;
        }

        root.addEventListener('click', (e) => {
            const target = e.target.closest('[data-city]');
            if (!target) return;
            const city = target.dataset.city;
            // Picking the selected city again (or "All cities") clears the filter.
            select(city && !target.classList.contains('is-selected') ? city : '');
        });

        return select(normaliseCity(new URL(location.href).searchParams.get('city')), { updateUrl: false });
    };
}
