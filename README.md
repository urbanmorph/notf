# NOTF - Neighbourhoods of the Future

**Live site:** https://www.notf.in

A collaborative platform for building inclusive, resilient, and people-first
neighbourhoods through systems thinking, community engagement, and data-driven
insights.

## Stack at a glance

- **Frontend:** hand-written static HTML/CSS/JS in `website/public/`. **No build
  step, no framework, no Eleventy.** Files are deployed as-is.
- **Hosting:** **Vercel** — auto-deploys on every push to `main`
  (`vercel.json` serves `website/public`).
- **Backend:** **Supabase** project `abblyaukkoxmgzwretvm` — Postgres
  (`file_metadata`), Storage (`notf` bucket), and Deno **Edge Functions**
  (`supabase/functions/`). The site reads data at runtime via the public anon key.
- **i18n:** 11 languages, JSON locale files under
  `website/public/assets/i18n/locales/`. Updating all 11 is mandatory for any
  user-facing text change.

> ⚠️ An older version of this README described a GitHub Pages + Eleventy + YAML
> (`data/`, `docs/`, `_site/`, `npm run build`) setup. **That architecture is
> gone.** If you find references to it anywhere, they are stale.

## Repository layout

| Path | What it is |
|------|------------|
| `website/public/` | The deployed site (static HTML + `assets/`). |
| `website/tests/` | Playwright visual tests + Deno unit tests. |
| `supabase/functions/` | Edge Functions (admin write/delete, sync, deploy trigger). |
| `supabase/migrations/` | Database migrations (audit trigger, delete lockdown, …). |
| `scripts/` | Operational one-off scripts (sitemap, catalogue check, …). `scripts/archive/` is dead legacy tooling. |
| `data-docs/` | Public climate-dataset documentation (sources, credits, research) + the data-processing scripts. |

## Local development

```bash
cd website
npm install
npm run dev        # Vite dev server → http://localhost:5173 (serves public/)
```

The site fetches live data from Supabase via the **public anon key** (hardcoded in
`assets/js/data-loader.js`), so `npm run dev` shows real production content with **no
`.env` or secrets required** for read-only work. See `CONTRIBUTING.md` for the test
and deploy workflows, and `ACCESS.md` for what write access requires.

## Documentation map — start here

New to the project? Read these in order:

1. **[`ONBOARDING.md`](ONBOARDING.md)** — day-one setup and how the whole system fits together.
2. **[`ARCHITECTURE.md`](ARCHITECTURE.md)** — data flow, the two write paths, and the **Data Safety Invariants** (read before touching any admin write/delete path).
3. **[`CONTRIBUTING.md`](CONTRIBUTING.md)** — how to make changes: static pages, catalogue, edge functions, migrations, tests, i18n, and the PR/CI/deploy flow.
4. **[`CLAUDE.md`](CLAUDE.md)** — full project conventions (brand, i18n, icons, data-safety). Written for AI agents but the canonical rulebook for humans too.
5. **[`ACCESS.md`](ACCESS.md)** — the credentials/access matrix for maintainers (GitHub, Supabase, Vercel, secrets).
6. **[`RBAC-PLAN.md`](RBAC-PLAN.md)** — the planned admin roles / authorization work.

---

## 📊 Ward-Level Climate Data

### Overview

NOTF provides open ward-level climate baseline data for Indian cities, starting with **Bengaluru (369 wards)** and **Mumbai (227 wards)**. This granular data enables communities, policymakers, and researchers to track climate action progress at the neighbourhood level.

**Coverage:**
- **Bengaluru:** 7 climate sectors × 369 wards = 2,583 data points
  - ✅ Energy & Buildings (100% coverage)
  - ✅ Waste Management (100% coverage)
  - ⚠️ Transportation (partial data)
  - ⚠️ Air Quality (16 monitoring stations)
  - ⚠️ Water Resources (zone-level)
  - ✅ Urban Greening (100% coverage)
  - ⚠️ Disaster Resilience (flood risk 100%, heat partial)

- **Mumbai:** 2 climate sectors × 227 wards = 454 data points
  - ✅ Energy & Buildings (100% coverage)
  - ✅ Waste Management (100% coverage)
  - ⏳ Transportation (pending)
  - ⏳ Air Quality (pending)
  - ⏳ Water Resources (pending)
  - ⏳ Urban Greening (pending)
  - ⏳ Disaster Resilience (pending)

**Data Quality:**
- Bengaluru: ★★★☆☆ (63%) - See [`DATA_SOURCES_AND_CREDITS.md`](data-docs/DATA_SOURCES_AND_CREDITS.md)
- Mumbai: ★★★☆☆ (60%) - See [`MUMBAI_DATA_SOURCES_AND_CREDITS.md`](data-docs/MUMBAI_DATA_SOURCES_AND_CREDITS.md)

---

### 📥 Download Climate Datasets

#### Bengaluru (369 Wards)

**Option 1: Full Dataset (3.8 MB)**
```bash
# Clone repository
git clone https://github.com/urbanmorph/notf.git
cd notf/website/public/assets/data/climate/bengaluru/

# All files:
# - city_climate.json (10 KB) - City-level aggregates
# - ward_index.json (96 KB) - Ward metadata
# - climate_central.json (621 KB) - 63 wards
# - climate_east.json (492 KB) - 50 wards
# - climate_west.json (1.1 MB) - 112 wards
# - climate_north.json (709 KB) - 72 wards
# - climate_south.json (709 KB) - 72 wards
```

**Option 2: Direct Download Links**
```bash
# City summary (10 KB)
wget https://raw.githubusercontent.com/urbanmorph/notf/main/website/public/assets/data/climate/bengaluru/city_climate.json

# Ward index (96 KB)
wget https://raw.githubusercontent.com/urbanmorph/notf/main/website/public/assets/data/climate/bengaluru/ward_index.json

# Corporation data (download specific corporation or all 5)
wget https://raw.githubusercontent.com/urbanmorph/notf/main/website/public/assets/data/climate/bengaluru/climate_central.json
wget https://raw.githubusercontent.com/urbanmorph/notf/main/website/public/assets/data/climate/bengaluru/climate_east.json
wget https://raw.githubusercontent.com/urbanmorph/notf/main/website/public/assets/data/climate/bengaluru/climate_west.json
wget https://raw.githubusercontent.com/urbanmorph/notf/main/website/public/assets/data/climate/bengaluru/climate_north.json
wget https://raw.githubusercontent.com/urbanmorph/notf/main/website/public/assets/data/climate/bengaluru/climate_south.json
```

**Option 3: Python Script**
```python
import json
import requests

# Load city summary
city_data = requests.get(
    'https://raw.githubusercontent.com/urbanmorph/notf/main/website/public/assets/data/climate/bengaluru/city_climate.json'
).json()

print(f"Total wards: {city_data['total_wards']}")
print(f"Total population: {city_data['total_population']:,}")

# Load specific corporation
central_wards = requests.get(
    'https://raw.githubusercontent.com/urbanmorph/notf/main/website/public/assets/data/climate/bengaluru/climate_central.json'
).json()

for ward in central_wards['wards']:
    print(f"{ward['ward_name']}: {ward['population']:,} people")
```

#### Mumbai (227 Wards)

**Option 1: Full Dataset (2.4 MB)**
```bash
# Clone repository
git clone https://github.com/urbanmorph/notf.git
cd notf/website/public/assets/data/climate/mumbai/

# All files:
# - city_climate.json (10 KB) - City-level aggregates
# - ward_index.json (60 KB) - Ward metadata
# - climate_south.json (221 KB) - 21 wards
# - climate_central.json (369 KB) - 35 wards
# - climate_western.json (463 KB) - 44 wards
# - climate_eastern.json (515 KB) - 49 wards
# - climate_northern.json (820 KB) - 78 wards
```

**Option 2: Direct Download Links**
```bash
# City summary (10 KB)
wget https://raw.githubusercontent.com/urbanmorph/notf/main/website/public/assets/data/climate/mumbai/city_climate.json

# Ward index (60 KB)
wget https://raw.githubusercontent.com/urbanmorph/notf/main/website/public/assets/data/climate/mumbai/ward_index.json

# Zone data (download specific zone or all 5)
wget https://raw.githubusercontent.com/urbanmorph/notf/main/website/public/assets/data/climate/mumbai/climate_south.json
wget https://raw.githubusercontent.com/urbanmorph/notf/main/website/public/assets/data/climate/mumbai/climate_central.json
wget https://raw.githubusercontent.com/urbanmorph/notf/main/website/public/assets/data/climate/mumbai/climate_western.json
wget https://raw.githubusercontent.com/urbanmorph/notf/main/website/public/assets/data/climate/mumbai/climate_eastern.json
wget https://raw.githubusercontent.com/urbanmorph/notf/main/website/public/assets/data/climate/mumbai/climate_northern.json
```

**Option 3: Python Script**
```python
import json
import requests

# Load city summary
city_data = requests.get(
    'https://raw.githubusercontent.com/urbanmorph/notf/main/website/public/assets/data/climate/mumbai/city_climate.json'
).json()

print(f"Total wards: {city_data['total_wards']}")
print(f"Total population: {city_data['total_population']:,}")

# Load specific zone
south_wards = requests.get(
    'https://raw.githubusercontent.com/urbanmorph/notf/main/website/public/assets/data/climate/mumbai/climate_south.json'
).json()

for ward in south_wards['wards']:
    print(f"{ward['ward_name']}: {ward['population']:,} people")
```

**Documentation:**
- [`MUMBAI_DATA_SOURCES_AND_CREDITS.md`](data-docs/MUMBAI_DATA_SOURCES_AND_CREDITS.md) - Comprehensive data source documentation
- [`MUMBAI_227_WARDS_DATA_RESEARCH.md`](data-docs/MUMBAI_227_WARDS_DATA_RESEARCH.md) - Ward data research findings

---

### 📄 License: CC BY-NC-SA 4.0

<a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="license noopener noreferrer">
    <img src="https://mirrors.creativecommons.org/presskit/buttons/88x31/svg/by-nc-sa.svg" alt="CC BY-NC-SA 4.0" width="120">
</a>

**You are free to:**
- ✅ **Share** — copy and redistribute the material in any medium or format
- ✅ **Adapt** — remix, transform, and build upon the material

**Under the following terms:**
- **Attribution (BY)** — You must give appropriate credit, provide a link to the license, and indicate if changes were made
- **NonCommercial (NC)** — You may not use the material for commercial purposes
- **ShareAlike (SA)** — If you remix, transform, or build upon the material, you must distribute your contributions under the same license

**Full License:** https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode

---

### 📝 How to Cite

#### Academic Citation (APA)
```
Neighbourhoods of the Future. (2026). Ward-Level Climate Baseline Data for Bengaluru.
Retrieved from https://github.com/urbanmorph/notf/tree/main/website/public/assets/data/climate/bengaluru
Licensed under CC BY-NC-SA 4.0.
```

#### Data Attribution (Required)
When using this data in reports, visualizations, or derivative works, include:

```
Data Source: Neighbourhoods of the Future (NOTF)
GitHub: https://github.com/urbanmorph/notf
License: CC BY-NC-SA 4.0
Original Sources: Census of India 2011, OpenCity.in, BBMP, KSPCB
```

#### BibTeX
```bibtex
@dataset{notf_bengaluru_climate_2026,
  author = {{Neighbourhoods of the Future}},
  title = {Ward-Level Climate Baseline Data for Bengaluru},
  year = {2026},
  publisher = {GitHub},
  url = {https://github.com/urbanmorph/notf},
  license = {CC-BY-NC-SA-4.0}
}
```

---

### 📚 Data Sources & Credits

All data compiled from authoritative government and research sources. Full documentation available in [`DATA_SOURCES_AND_CREDITS.md`](data-docs/DATA_SOURCES_AND_CREDITS.md).

#### Primary Data Providers

**Government Agencies:**
- **Census of India 2011** - Population, households, demographics (★★★★☆ 75%)
- **BBMP (Bruhat Bengaluru Mahanagara Palike)** - Waste management, tree census, ward boundaries (★★★☆☆ 65%)
- **KSPCB (Karnataka State Pollution Control Board)** - Air quality monitoring network (★★★★☆ 80%)
- **BESCOM** - Electricity consumption estimates (★★☆☆☆ 50%)
- **KREDL (Karnataka Renewable Energy Development Limited)** - Renewable energy data (★★★★☆ 85%)
- **BWSSB (Bangalore Water Supply and Sewerage Board)** - Water supply data (★★★☆☆ 60%)
- **BMTC (Bangalore Metropolitan Transport Corporation)** - Public transport coverage (★★★★☆ 75%)

**Research & Data Portals:**
- **OpenCity.in** - Urban data portal aggregating official government datasets
  - [Bengaluru Household Consumption Expenditure Survey 2022-23](https://data.opencity.in/dataset/bengaluru-household-consumption-expenditure-survey-2022-23)
  - [Karnataka Renewable Energy Data](https://data.opencity.in/dataset/karnataka-renewable-energy-data)
  - [Solid Waste Management](https://data.opencity.in/dataset/solid-waste-management)
  - [List of Dry Waste Collection Centres](https://data.opencity.in/dataset/list-of-dry-waste-collection-centres-in-bengaluru)
  - [Bengaluru Air Quality Data (2017-2023)](https://data.opencity.in/dataset/bengaluru-air-quality-data)
  - [BMTC Bus Stops and Routes by Ward](https://data.opencity.in/dataset/bus-stops-and-routes-map-by-ward)
- **IISc (Indian Institute of Science)** - Urban research, water resources, urban heat studies
- **Praja Foundation** - Civic data analysis, waste management monitoring
- **IGBC/GRIHA** - Green building certifications

**Data Licensing:**
- OpenCity.in: Open Database License (ODbL)
- Government data: Government Open Data License - India (GODL)
- Census data: Public domain

**Confidence Scores:**
- ★★★★★ (85-100%) - High quality, verified, recent data
- ★★★★☆ (70-84%) - Good quality, some limitations
- ★★★☆☆ (55-69%) - Medium quality, estimates or proxy data
- ★★☆☆☆ (40-54%) - Limited quality, significant gaps
- ★☆☆☆☆ (25-39%) - Low quality, placeholder estimates

---

### 🔧 Data Processing Scripts

Python scripts for generating ward-level climate data are available in [`data-docs/processing/`](data-docs/processing/):

1. **`split_corporation_data.py`** - Split 3.5 MB baseline JSON into 5 corporation files
2. **`generate_ward_index.py`** - Extract ward metadata for routing
3. **`generate_city_summary.py`** - Calculate city-level aggregates and rankings
4. **`generate_ward_pages.py`** - Generate 738 static HTML ward pages
5. **`add_source_metadata.py`** - Add OpenCity.in source attributions

```bash
# Run data pipeline
cd data-docs/processing
python3 split_corporation_data.py
python3 generate_ward_index.py
python3 generate_city_summary.py
python3 add_source_metadata.py
python3 generate_ward_pages.py
```

---

### 🗺️ Ward Boundaries (GeoJSON)

```bash
# Bengaluru ward boundaries
wget https://raw.githubusercontent.com/urbanmorph/notf/main/website/public/assets/data/boundaries/bengaluru-wards.geojson

# Mumbai ward boundaries (227 electoral wards)
wget https://raw.githubusercontent.com/urbanmorph/notf/main/website/public/assets/data/boundaries/mumbai-electoral-wards.geojson

# Mumbai administrative wards (24 wards - legacy)
wget https://raw.githubusercontent.com/urbanmorph/notf/main/website/public/assets/data/boundaries/mumbai-wards.geojson
```

**Format:** GeoJSON (RFC 7946)
**Projection:** WGS84 (EPSG:4326)
**Sources:**
- Bengaluru: OpenCity.in + BBMP official boundaries
- Mumbai: DataMeet Municipal Spatial Data (CC BY-SA 2.5 India) + MCGM

---

### 📊 Data Structure

#### City Summary (`city_climate.json`)
```json
{
  "city": "Bengaluru",
  "total_wards": 369,
  "total_population": 8402887,
  "last_updated": "2026-01-23",
  "sectors": {
    "energy_buildings": {
      "clean_cooking": {
        "average": 16.2,
        "distribution": {"high": 0, "medium": 38, "low": 331},
        "top_5": [...],
        "bottom_5": [...],
        "data_source": {
          "provider": "Census 2011 + OpenCity.in",
          "url": "https://data.opencity.in/dataset/...",
          "confidence_score": 0.64,
          "confidence_stars": "★★★☆☆",
          "methodology": "...",
          "limitations": [...]
        }
      }
    }
  }
}
```

#### Ward Data (`climate_*.json`)
```json
{
  "corporation": "South",
  "ward_count": 72,
  "wards": [
    {
      "ward_id": 42,
      "ward_name": "Jayanagar 4th Block",
      "ward_name_local": "ಜಯನಗರ 4ನೇ ಬ್ಲಾಕ್",
      "slug": "jayanagar-4th-block",
      "corporation": "South",
      "population": 18542,
      "energy_buildings": {
        "solid_fuel_households": {
          "value": 12.5,
          "percentage": 12.5,
          "confidence": 0.64,
          "source": "Census 2011",
          "data_source": {
            "provider": "Census 2011 + OpenCity.in",
            "url": "...",
            "confidence_score": 0.64,
            "methodology": "...",
            "limitations": [...]
          }
        }
      }
    }
  ]
}
```

---

### 🚀 Future Cities

**Planned for 2026:**
- Delhi (272 wards)
- Chennai (200 wards)
- Hyderabad (150 wards)
- Pune (144 wards)

**Contribute:** If you have ward-level climate data for other Indian cities, please open an issue or submit a pull request.

---

### ⚠️ Data Limitations & Validation

**Known Limitations:**
1. **Data Age** - Census 2011 is 15 years old; population estimates extrapolated
2. **Ward Boundaries** - Some wards reorganized since 2011
3. **Incomplete Coverage** - Only Energy & Waste sectors have 100% ward-level data
4. **Estimates** - Many metrics use city averages applied uniformly (electricity, renewable energy)
5. **Informal Sector** - Waste segregation by informal workers not captured

**Validation Process:**
- Cross-referenced with official government portals
- Spot checks on 10% random sample
- Peer review by urban planning researchers
- BBMP/KSPCB officials consulted

**Report Data Issues:**
- GitHub Issues: https://github.com/urbanmorph/notf/issues
- Email: data@neighbourhoodsofthefuture.org

---

### 📖 Additional Documentation

- **Full Methodology:** [`DATA_SOURCES_AND_CREDITS.md`](data-docs/DATA_SOURCES_AND_CREDITS.md)
- **Mumbai Data Sources:** [`MUMBAI_DATA_SOURCES_AND_CREDITS.md`](data-docs/MUMBAI_DATA_SOURCES_AND_CREDITS.md)
- **Architecture:** [`ARCHITECTURE.md`](ARCHITECTURE.md)

---

## Contact

Nudge Unit: nudge-unit@notf.in
