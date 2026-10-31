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
from pathlib import Path

from outline_lib import projector, ring_path, simplify_ring

SRC = Path(__file__).resolve().parent.parent / "website/public/assets/data/bengaluru-corporations.geojson"
WIDTH = 600
TOLERANCE = 0.0015  # degrees (~150 m): keeps the shape, drops most points


def main():
    features = json.loads(SRC.read_text())["features"]
    rings = [f["geometry"]["coordinates"][0] for f in features]
    project, (min_lon, min_lat, max_lon, max_lat), height = projector(rings, WIDTH, pad=0.02)
    paths = [ring_path([project(lon, lat) for lon, lat in simplify_ring(r, TOLERANCE)]) for r in rings]

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
