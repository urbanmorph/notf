"""Shared helpers for the inline map outlines (scripts/build-*-outline.py).

Both outlines use the same equirectangular projection as
website/public/assets/js/map-projection.js, so points plotted in the browser
land on the shapes drawn here.
"""

import math


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


def simplify_ring(ring, tol):
    """Simplify a closed ring. Its first and last points coincide, which
    Douglas-Peucker can't measure against, so simplify the two halves separately."""
    mid = len(ring) // 2
    return simplify(ring[: mid + 1], tol)[:-1] + simplify(ring[mid:], tol)


def projector(rings, width, pad):
    """Fit `rings` (lists of [lon, lat]) into `width` px. Returns
    (project, (min_lon, min_lat, max_lon, max_lat), height)."""
    lons = [p[0] for r in rings for p in r]
    lats = [p[1] for r in rings for p in r]
    min_lon, max_lon = min(lons) - pad, max(lons) + pad
    min_lat, max_lat = min(lats) - pad, max(lats) + pad
    kx = math.cos(math.radians((min_lat + max_lat) / 2))
    scale = width / ((max_lon - min_lon) * kx)
    height = round((max_lat - min_lat) * scale)

    def project(lon, lat):
        return round((lon - min_lon) * kx * scale, 1), round((max_lat - lat) * scale, 1)

    return project, (min_lon, min_lat, max_lon, max_lat), height


def ring_path(xy):
    return "M" + "L".join(f"{x} {y}" for x, y in xy) + "Z"
