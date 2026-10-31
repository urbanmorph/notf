#!/usr/bin/env python3
"""Build the inline SVG outline of Bengaluru used by the home page's OAQ card.

Reads the five GBA corporation polygons, simplifies them, and prints an <svg>
whose data-bbox ("minLon,minLat,maxLon,maxLat") and width/height let
assets/js/oaq-live.js project live sensor positions onto it with the same
equirectangular projection.

    python3 scripts/build-oaq-outline.py > /tmp/outline.svg
    # paste into the #oaqMap block in website/public/index.html
"""

import json
import math
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "website/public/assets/data/bengaluru-corporations.geojson"
WIDTH = 600
TOLERANCE = 0.0015  # degrees (~150 m): keeps the shape, drops most points


def simplify(points, tol):
    """Douglas-Peucker line simplification."""
    if len(points) < 3:
        return points
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = math.hypot(dx, dy) or 1e-12
    idx, dmax = 0, 0.0
    for i in range(1, len(points) - 1):
        px, py = points[i]
        d = abs(dy * px - dx * py + x2 * y1 - y2 * x1) / norm
        if d > dmax:
            idx, dmax = i, d
    if dmax <= tol:
        return [points[0], points[-1]]
    return simplify(points[: idx + 1], tol)[:-1] + simplify(points[idx:], tol)


def main():
    features = json.loads(SRC.read_text())["features"]
    rings = [f["geometry"]["coordinates"][0] for f in features]
    lons = [p[0] for r in rings for p in r]
    lats = [p[1] for r in rings for p in r]
    pad = 0.02
    min_lon, max_lon = min(lons) - pad, max(lons) + pad
    min_lat, max_lat = min(lats) - pad, max(lats) + pad
    kx = math.cos(math.radians((min_lat + max_lat) / 2))
    scale = WIDTH / ((max_lon - min_lon) * kx)
    height = round((max_lat - min_lat) * scale)

    def project(lon, lat):
        return round((lon - min_lon) * kx * scale, 1), round((max_lat - lat) * scale, 1)

    paths = []
    for ring in rings:
        # A closed ring starts and ends on the same point, which Douglas-Peucker
        # can't measure against, so simplify its two halves separately.
        mid = len(ring) // 2
        pts = simplify(ring[: mid + 1], TOLERANCE)[:-1] + simplify(ring[mid:], TOLERANCE)
        xy = [project(lon, lat) for lon, lat in pts]
        paths.append("M" + "L".join(f"{x} {y}" for x, y in xy) + "Z")

    bbox = f"{min_lon:.4f},{min_lat:.4f},{max_lon:.4f},{max_lat:.4f}"
    print(
        f'<svg class="oaq-map" id="oaqMap" viewBox="0 0 {WIDTH} {height}" data-bbox="{bbox}" '
        f'role="img" aria-labelledby="oaqMapTitle">'
    )
    print('<title id="oaqMapTitle" data-i18n="homepage.oaq.mapTitle">Live air quality sensors across Bengaluru</title>')
    print(f'<path class="oaq-map-land" d="{"".join(paths)}"/>')
    print('<g class="oaq-map-dots"></g>')
    print("</svg>")


if __name__ == "__main__":
    main()
