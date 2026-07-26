# NOTF Scripts

Operational one-off scripts for maintaining NOTF. These are **not** part of the site
build (there is no build) — they're run by hand when needed.

> **Data model note:** NOTF no longer uses a `/data/` YAML/Markdown tree or an
> Excel-import pipeline. Community / solution-provider / story data lives in the
> Supabase `file_metadata` table and Storage bucket. See
> [`../ARCHITECTURE.md`](../ARCHITECTURE.md). The old Excel→YAML→`/data/` scripts have
> been moved to [`archive/`](archive/) and are **dead** — don't use them.

## Current scripts

### `check-catalogue-consistency.mjs`
Reports mismatches between the catalogue (`catalog/catalog-data.js`) and the solution
providers, so archiving/renaming a provider doesn't silently orphan a catalogue entry.
Runs on Deno:
```bash
deno run --allow-net --allow-read scripts/check-catalogue-consistency.mjs
```

### `generate-sitemap.py`
Generates `sitemap.xml` for the public site.
```bash
python3 scripts/generate-sitemap.py
```

### `seed-bengaluru-stories.js`
One-off seed that inserts sample Bengaluru community stories into Supabase. Requires the
**service-role key** (a secret — see [`../ACCESS.md`](../ACCESS.md)):
```bash
export SUPABASE_SERVICE_ROLE_KEY="…"     # from a password manager, never commit
cd website && node ../scripts/seed-bengaluru-stories.js
```

### `README-geocoding.md`
Documents community geocoding. **Note:** day-to-day geocoding is now done through the
admin UI at `website/public/admin/geocode-tool.html`; the batch Python scripts it
describes now live in [`archive/`](archive/).

## Reference data (not scripts)

- `bangalore-neighborhood-coordinates.md` — lookup table of Bengaluru neighbourhood
  coordinates used when fixing map locations.

## Secrets

Some scripts need the Supabase **service-role key**. It goes in `scripts/.env`
(gitignored — see `.env.example`) or an exported env var, and must **never** be
committed or shared outside a password manager. Full handling in
[`../ACCESS.md`](../ACCESS.md).

## `archive/` — dead legacy (do not use)

The pre-Supabase pipeline: `excel-to-yaml`, `categorize-existing-yamls`,
`validate_data.py`, `match_asks_offers.py`, `weekly_digest.py`, `sync-to-supabase.py`,
`upload-and-sync-supabase.py`, `download-from-storage.sh`, `setup-database.sh`,
`geocode-communities.py`, `propagate_all_translations.py`. Kept for historical
reference only — they assume the removed `/data/` tree and will not work against the
current system.
