/**
 * The equirectangular projection shared by the inline map outlines
 * (scripts/outline_lib.py) and the points plotted on them in the browser
 * (oaq-live.js on the home page, city-map.js on the listing pages).
 *
 * bbox is [minLon, minLat, maxLon, maxLat]; returns SVG {x, y}, or null when the
 * point is missing or outside the bbox.
 */
function projectPoint(lon, lat, bbox, width) {
    const [minLon, minLat, maxLon, maxLat] = bbox;
    if (lon == null || lat == null || lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) return null;
    const kx = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
    const scale = width / ((maxLon - minLon) * kx);
    return { x: (lon - minLon) * kx * scale, y: (maxLat - lat) * scale };
}
