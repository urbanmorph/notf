#!/usr/bin/env python3
"""Generate sitemap.xml for the NOTF site.

Walks website/public/ looking for every index.html (excluding admin,
test files, and error pages), emits an ISO-dated sitemap at
website/public/sitemap.xml.

Re-run after adding or removing pages:
    python3 scripts/generate-sitemap.py
"""

import os
from datetime import datetime
from pathlib import Path

BASE_URL = "https://notf.in"
PUBLIC_DIR = Path(__file__).resolve().parent.parent / "website" / "public"

# Skip these path prefixes (relative to public/)
SKIP_PREFIXES = (
    "admin",
    "test-",
    "_",
)

# Pages kept live but hidden from search engines (they carry a noindex meta)
HIDDEN = {"map", "search"}

# Priority + changefreq by path pattern
def get_priority(rel_path: str) -> tuple[float, str]:
    if rel_path == "":
        return (1.0, "weekly")
    if rel_path in ("about", "communities", "solution-providers", "catalog", "stories", "join"):
        return (0.9, "weekly")
    if rel_path == "cities" or rel_path.startswith("cities/") and rel_path.count("/") == 1:
        return (0.8, "weekly")
    return (0.7, "monthly")


def main() -> None:
    today = datetime.utcnow().strftime("%Y-%m-%d")
    urls: list[tuple[str, float, str]] = []

    for dirpath, _dirnames, filenames in os.walk(PUBLIC_DIR):
        if "index.html" not in filenames:
            continue
        rel = Path(dirpath).relative_to(PUBLIC_DIR).as_posix()
        if rel == ".":
            rel = ""
        if any(rel == p.rstrip("/") or rel.startswith(p + "/") or rel.startswith(p) for p in SKIP_PREFIXES):
            if rel.startswith(("admin", "test-", "_")):
                continue
        if rel in HIDDEN:
            continue
        priority, changefreq = get_priority(rel)
        path = "/" if rel == "" else f"/{rel}/"
        urls.append((path, priority, changefreq))

    urls.sort(key=lambda u: (-u[1], u[0]))

    out = PUBLIC_DIR / "sitemap.xml"
    with out.open("w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        f.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for path, priority, changefreq in urls:
            f.write("  <url>\n")
            f.write(f"    <loc>{BASE_URL}{path}</loc>\n")
            f.write(f"    <lastmod>{today}</lastmod>\n")
            f.write(f"    <changefreq>{changefreq}</changefreq>\n")
            f.write(f"    <priority>{priority:.1f}</priority>\n")
            f.write("  </url>\n")
        f.write("</urlset>\n")

    print(f"✓ Wrote {len(urls)} URLs to {out.relative_to(PUBLIC_DIR.parent.parent)}")


if __name__ == "__main__":
    main()
