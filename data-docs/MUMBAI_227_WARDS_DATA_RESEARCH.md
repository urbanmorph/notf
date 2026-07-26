# Mumbai 227 Electoral Wards - Data Research Summary

**Date:** 2026-01-23
**Research Goal:** Find structured data for Mumbai's 227 electoral wards (prabhags) with population data

---

## ✅ FOUND: Complete 227 Electoral Ward Data!

### Primary Data Source

**DataMeet Municipal Spatial Data Repository**
- **URL:** https://github.com/datameet/Municipal_Spatial_Data/tree/master/Mumbai
- **File:** `bmc_electoral_wards_2017` (2.91 MB GeoJSON)
- **Direct Link:** https://raw.githubusercontent.com/datameet/Municipal_Spatial_Data/master/Mumbai/bmc_electoral_wards_2017
- **License:** Creative Commons Attribution-ShareAlike 2.5 India

### Data Structure

**Format:** GeoJSON FeatureCollection
**Total Features:** 227 electoral wards (prabhags)

**Properties per ward:**
```json
{
  "FID": 1,
  "OBJECTID": 1,
  "POPULATION": 60695,
  "WARD": "A",
  "PRABHAG_NO": "227",
  "SC_POP": 2656,
  "ST_POP": 228,
  "Corporator": "Name",
  "Caste": "Reserved/Unreserved",
  "Reserve": "Yes/No",
  "Shape_Leng": 12345.67,
  "Shape_Area": 1234567.89
}
```

**Available Fields:**
- ✅ Electoral ward number (PRABHAG_NO: 1-227)
- ✅ Administrative ward assignment (WARD: A-T)
- ✅ Total population (POPULATION)
- ✅ SC population (SC_POP)
- ✅ ST population (ST_POP)
- ✅ Corporator name (2017 election data)
- ✅ Reservation status (SC/ST/General)
- ✅ Geographic boundaries (GeoJSON polygons)
- ✅ Area measurements (Shape_Area, Shape_Leng)

### Sample Data

| Ward | Prabhag No. | Population | SC Pop | ST Pop | Admin Ward |
|------|-------------|------------|--------|--------|------------|
| 227 | A | 60,695 | 2,656 | 228 | Ward A (Colaba) |
| 225 | A | 61,341 | 6,735 | 1,321 | Ward A (Colaba) |
| 224 | B | 64,245 | 558 | 330 | Ward B (Sandhurst Road) |
| 226 | A | 62,978 | 4,243 | 1,644 | Ward A (Colaba) |
| 208 | E | 57,121 | 2,152 | 347 | Ward E (Byculla) |

**Average Population per Electoral Ward:** ~54,000-65,000 residents

---

## Data Quality Assessment

### Strengths ✅

1. **Complete Coverage:** All 227 electoral wards included
2. **Population Data:** Total, SC, ST populations available
3. **Geographic Boundaries:** Full GeoJSON polygons for mapping
4. **Verified Source:** DataMeet community-verified data
5. **Open License:** CC BY-SA 2.5 India (freely usable with attribution)
6. **Ready to Use:** No additional processing needed for basic use

### Limitations ⚠️

1. **Data Year:** 2017 (based on file name and 2017 election data)
2. **Age:** Census 2011 population base (9 years old when filed, now 15 years old)
3. **Missing Demographics:**
   - No gender breakdown (male/female)
   - No age groups (0-6, working age, elderly)
   - No literacy data
   - No household count
   - No employment data
4. **Political Data:** Corporator names are from 2017 (outdated after 2026 election)
5. **No Climate Metrics:** Would need to be estimated/modeled

### Confidence Score: ★★★☆☆ (60%)

**Reasoning:**
- ✅ Authoritative population data from Census 2011
- ✅ Complete geographic coverage (227/227 wards)
- ✅ Community-verified boundaries
- ⚠️ Data is 15 years old (Census 2011)
- ⚠️ Limited demographic breakdown
- ⚠️ No recent survey updates

---

## How to Use This Data

### 1. Download the GeoJSON

```bash
# Download 227 electoral wards GeoJSON
wget https://raw.githubusercontent.com/datameet/Municipal_Spatial_Data/master/Mumbai/bmc_electoral_wards_2017 -O mumbai-227-electoral-wards.geojson

# Verify structure
python3 -c "import json; data=json.load(open('mumbai-227-electoral-wards.geojson')); print(f'Total wards: {len(data[\"features\"])}')"
```

### 2. Extract Population Data to CSV

```python
import json
import csv

# Load GeoJSON
with open('mumbai-227-electoral-wards.geojson', 'r') as f:
    data = json.load(f)

# Extract to CSV
with open('mumbai-227-wards-population.csv', 'w', newline='') as csvfile:
    fieldnames = ['prabhag_no', 'admin_ward', 'population', 'sc_pop', 'st_pop', 'area_sqm']
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

    writer.writeheader()
    for feature in data['features']:
        props = feature['properties']
        writer.writerow({
            'prabhag_no': props['PRABHAG_NO'],
            'admin_ward': props['WARD'],
            'population': props['POPULATION'],
            'sc_pop': props['SC_POP'],
            'st_pop': props['ST_POP'],
            'area_sqm': props['Shape_Area']
        })

print("✅ Exported to mumbai-227-wards-population.csv")
```

### 3. Generate Ward Baseline JSON

Similar to Bengaluru's `bengaluru_ward_baselines.json`, create:

```python
import json

# Template for Mumbai ward baseline
mumbai_baseline = {
    "city": "Mumbai",
    "total_wards": 227,
    "data_year": "2011",
    "confidence": 0.60,
    "wards": []
}

# Load electoral wards GeoJSON
with open('mumbai-227-electoral-wards.geojson', 'r') as f:
    geojson = json.load(f)

# Convert to ward baseline format
for feature in geojson['features']:
    props = feature['properties']

    ward = {
        "ward_id": int(props['PRABHAG_NO']),
        "ward_name": f"Prabhag {props['PRABHAG_NO']} ({props['WARD']} Ward)",
        "ward_name_local": f"प्रभाग {props['PRABHAG_NO']}",  # Marathi
        "slug": f"prabhag-{props['PRABHAG_NO'].zfill(3)}",
        "administrative_ward": props['WARD'],
        "population": int(props['POPULATION']),
        "sc_population": int(props['SC_POP']),
        "st_population": int(props['ST_POP']),
        "area_sqm": float(props['Shape_Area']),

        # Climate data would be estimated here (like Bengaluru methodology)
        "energy_buildings": {
            # To be populated
        },
        "waste": {
            # To be populated
        }
        # ... other sectors
    }

    mumbai_baseline['wards'].append(ward)

# Save
with open('mumbai_ward_baselines.json', 'w') as f:
    json.dump(mumbai_baseline, f, indent=2)

print("✅ Mumbai baseline JSON created")
```

---

## Additional Data Sources

### 1. Administrative Ward Data (24 wards)

**For more detailed demographics (gender, literacy, employment):**

- **OpenCity:** https://data.opencity.in/dataset/mumbai-ward-wise-census-data
  - Census 2011 data
  - Formats: CSV, XLSX, JSON, XML
  - Covers 24 administrative wards (A-T)

- **GitHub:** https://github.com/mickeykedia/Mumbai-Population-Map
  - `ward_level_collated.csv` - Detailed demographics for 24 wards
  - Population, age groups, SC/ST, literacy, employment

**Challenge:** Map 24 administrative ward data → 227 electoral wards
- Each administrative ward (e.g., "A") contains multiple prabhags
- Would need to distribute/estimate metrics across prabhags

### 2. BMC Official Sources

**Ward Delimitation Document (150 pages):**
- **Google Drive:** https://drive.google.com/file/d/1aMM8ZchLadZ_EAa-3QusPrUgHI8gfIJh/view
- **File:** "bmc delimitation.pdf" (1.3 MB)
- **Contents:** Official ward boundaries, population, reservation status
- **Status:** PDF format (would need manual extraction or OCR)

**BMC Election Data Portal:**
- **URL:** https://electiondata.mcgm.gov.in/
- **Contents:** Voter lists, booth-wise data, ward maps
- **Challenge:** SSL certificate issues, data in PDF format

### 3. Ward Boundaries

**Existing in NOTF repo:**
- ✅ `/website/public/assets/data/boundaries/mumbai-wards.geojson` (24 administrative wards)
- ✅ `/supporting documents/mumbai/mumbai-wards.kml` (24 administrative wards)

**New data needed:**
- ✅ DataMeet `bmc_electoral_wards_2017` (227 electoral wards) - **DOWNLOAD THIS**

---

## Comparison: 24 Admin Wards vs 227 Electoral Wards

| Aspect | 24 Admin Wards | 227 Electoral Wards |
|--------|----------------|---------------------|
| **Primary Use** | Governance, services | Elections, representation |
| **Population Data** | ✅ Detailed (Census full dataset) | ✅ Basic (total, SC, ST) |
| **Demographics** | ✅ Gender, age, literacy, employment | ❌ Limited |
| **Climate Data** | ❌ Need to estimate | ❌ Need to estimate |
| **Boundaries** | ✅ Available (GeoJSON) | ✅ **FOUND** (DataMeet) |
| **Granularity** | Coarse (~500k per ward) | Fine (~54k per ward) |
| **Data Quality** | ★★★★☆ (80%) | ★★★☆☆ (60%) |
| **Implementation Effort** | 1 day | 2-3 days |
| **Ward Pages** | 168 pages (24×7) | 1,589 pages (227×7) |

---

## Recommendation

### Option A: Use 227 Electoral Wards ✅ RECOMMENDED

**Pros:**
- ✅ **Found complete data!** (DataMeet GeoJSON)
- ✅ More granular than Bengaluru (227 vs 369 wards, but Mumbai is smaller)
- ✅ Matches election structure (227 corporators)
- ✅ Population data available for all 227 wards
- ✅ Geographic boundaries included
- ✅ Ready to use (no scraping/parsing needed)

**Cons:**
- ⚠️ Limited demographics (no gender/age/literacy breakdown per electoral ward)
- ⚠️ Census 2011 data (15 years old)
- ⚠️ Climate metrics would need same estimation methodology as Bengaluru

**Effort:** 2-3 days
1. Download DataMeet GeoJSON
2. Generate Mumbai ward baseline JSON
3. Apply same climate estimation methodology as Bengaluru
4. Generate 1,589 ward pages (227×7 sectors)
5. Update Mumbai map with climate overlay

### Option B: Hybrid Approach

Use 227 electoral wards with enhanced data from 24 administrative wards:
1. Primary structure: 227 electoral wards (for pages, map)
2. Demographic enrichment: Map 24-ward data → 227 wards (population-weighted distribution)
3. Best of both: Granularity + detailed demographics

**Effort:** 3-4 days (additional data mapping step)

---

## Next Steps

### Immediate Actions

1. **Download DataMeet 227 Electoral Wards GeoJSON**
   ```bash
   cd /Users/sathya/Documents/GitHub/notf/supporting documents/mumbai
   wget https://raw.githubusercontent.com/datameet/Municipal_Spatial_Data/master/Mumbai/bmc_electoral_wards_2017 -O mumbai-227-electoral-wards-2017.geojson
   ```

2. **Copy to website boundaries folder**
   ```bash
   cp mumbai-227-electoral-wards-2017.geojson /Users/sathya/Documents/GitHub/notf/website/public/assets/data/boundaries/mumbai-electoral-wards.geojson
   ```

3. **Extract population CSV**
   - Use Python script above to create `mumbai-227-wards-population.csv`

4. **Generate Mumbai Ward Baseline JSON**
   - Create `mumbai_ward_baselines.json` (similar structure to Bengaluru)
   - Apply climate metric estimation methodology
   - Add source metadata (DataMeet, Census 2011, OpenCity)

5. **Run Mumbai Ward Page Generator**
   - Adapt Bengaluru scripts for Mumbai
   - Generate 1,589 HTML pages (227 wards × 7 sectors)

6. **Update Mumbai Map**
   - Apply climate overlay to `/cities/mumbai/map/index.html`
   - Use 227 electoral ward boundaries instead of 24 administrative

### Data Processing Pipeline

```bash
# Mumbai Ward Dashboard Generation Pipeline

# Step 1: Download electoral wards GeoJSON
wget https://raw.githubusercontent.com/datameet/Municipal_Spatial_Data/master/Mumbai/bmc_electoral_wards_2017 -O mumbai-227-electoral-wards.geojson

# Step 2: Generate ward baseline JSON (with climate estimates)
python3 generate_mumbai_baseline.py

# Step 3: Split into corporation-like zones (7 zones: A-G, H-N, P-T, etc.)
python3 split_corporation_data.py --city mumbai --input mumbai_ward_baselines.json

# Step 4: Generate ward index
python3 generate_ward_index.py --city mumbai

# Step 5: Generate city summary
python3 generate_city_summary.py --city mumbai

# Step 6: Add source metadata
python3 add_source_metadata.py --city mumbai

# Step 7: Generate 1,589 ward pages
python3 generate_ward_pages.py --city mumbai

# Step 8: Update Mumbai map with climate overlay
# Manual: Update /cities/mumbai/map/index.html
```

---

## Attribution Requirements

When using DataMeet Municipal Spatial Data:

**Required Attribution:**
```
Data Source: DataMeet India Community
Dataset: BMC Electoral Wards 2017
URL: https://github.com/datameet/Municipal_Spatial_Data
License: Creative Commons Attribution-ShareAlike 2.5 India
Original Data: Municipal Corporation of Greater Mumbai (MCGM)
Population Data: Census of India 2011
```

**In README / Documentation:**
```markdown
## Mumbai Ward Data Sources

**Primary Source:** DataMeet Municipal Spatial Data
**Dataset:** BMC Electoral Wards 2017 (227 wards)
**URL:** https://github.com/datameet/Municipal_Spatial_Data/tree/master/Mumbai
**License:** CC BY-SA 2.5 India
**Population Data:** Census of India 2011 via MCGM
**Confidence:** ★★★☆☆ (60%)
```

---

## References

### Data Sources
1. [DataMeet Municipal Spatial Data - Mumbai](https://github.com/datameet/Municipal_Spatial_Data/tree/master/Mumbai)
2. [OpenCity Mumbai Ward-wise Census Data](https://data.opencity.in/dataset/mumbai-ward-wise-census-data)
3. [GitHub: Mumbai Population Map](https://github.com/mickeykedia/Mumbai-Population-Map)
4. [BMC Election Data Portal](https://electiondata.mcgm.gov.in/)
5. [BMC Ward Delimitation PDF (Google Drive)](https://drive.google.com/file/d/1aMM8ZchLadZ_EAa-3QusPrUgHI8gfIJh/view)

### Documentation
6. [2026 BMC Election - Wikipedia](https://en.wikipedia.org/wiki/2026_Brihanmumbai_Municipal_Corporation_election)
7. [BMC Elections 2025: Final Boundaries Published](https://www.freepressjournal.in/mumbai/bmc-elections-2025-final-boundaries-for-227-wards-published-officials-working-on-voter-list)
8. [Voting in Mumbai Guide - Citizen Matters](https://citizenmatters.in/voting-in-mumbai-complete-guide-to-bmc-elections-and-making-your-voice-heard/)

---

## Summary

✅ **SUCCESS:** Found complete data for all 227 Mumbai electoral wards!

**Key Finding:** DataMeet repository contains GeoJSON with all 227 electoral wards including:
- Population (total, SC, ST)
- Geographic boundaries
- Administrative ward assignment
- Open license (CC BY-SA 2.5)

**Ready to Proceed:** Can now implement Mumbai ward-level climate dashboard with same architecture as Bengaluru.

**Estimated Timeline:** 2-3 days to replicate Bengaluru implementation for Mumbai's 227 wards.

---

**Status:** ✅ Research Complete - Data Found!
**Next Action:** Download GeoJSON and begin Mumbai ward baseline generation.
