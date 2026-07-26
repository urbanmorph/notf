# Ward-Level Climate Data - Sources, Confidence & Credits

**Last Updated:** 2026-01-23
**City:** Bengaluru
**Total Wards:** 369
**Data License:** CC BY-NC-SA 4.0 (NOTF), ODbL (OpenCity.in sources)

---

## Overview

This document provides detailed attribution, confidence scores, and methodology for all climate data used in the ward-level dashboard. Data is sourced from official government agencies, research institutions, and OpenCity.in's urban data portal.

---

## 1. Energy & Buildings Sector

### Primary Data Sources

**1.1 Household Cooking Fuel (Solid Fuel Usage)**
- **Source:** Census of India 2011 + SC/ST income proxy
- **OpenCity Dataset:** [Bengaluru Household Consumption Expenditure Survey 2022-23](https://data.opencity.in/dataset/bengaluru-household-consumption-expenditure-survey-2022-23)
- **Confidence:** ★★★☆☆ (64%)
- **Coverage:** 369/369 wards (100%)
- **Methodology:** City average solid fuel usage (16.2%) adjusted by ward SC/ST percentage as income proxy
- **Data Age:** Census 2011 (14 years old)
- **Credits:**
  - Office of the Registrar General & Census Commissioner, India
  - Ministry of Statistics and Programme Implementation (for 2022-23 survey)
- **Limitations:**
  - Census data is outdated (2011)
  - SC/ST percentage is an imperfect proxy for income levels
  - Needs validation with actual household surveys
- **Validation Status:** Pending ground-truthing

**1.2 Electricity Consumption**
- **Source:** BESCOM + population-weighted estimates
- **OpenCity Dataset:** [India - Electricity Consumption in Cities](https://data.opencity.in/dataset/electricity-consumption)
- **Confidence:** ★★★★☆ (76%)
- **Coverage:** 369/369 wards (estimated)
- **Methodology:** Per capita consumption (900 kWh/year) × ward population × urbanization factor
- **Data Age:** 2023 estimates
- **Credits:**
  - Bangalore Electricity Supply Company Limited (BESCOM)
  - Karnataka Electricity Regulatory Commission
- **Limitations:**
  - Ward-level actual data pending from BESCOM
  - Currently uses city-wide averages
- **Validation Status:** Requires BESCOM API integration

**1.3 Renewable Energy Share**
- **Source:** KREDL Karnataka Renewable Energy Policy
- **OpenCity Dataset:** [Karnataka Electricity Data](https://data.opencity.in/dataset/india-statewise-electricity-data)
- **Confidence:** ★★★★☆ (85%)
- **Coverage:** 369/369 wards (state grid-level)
- **Methodology:** State grid renewable share (35%) applies uniformly to all wards
- **Data Age:** 2024
- **Credits:**
  - Karnataka Renewable Energy Development Limited (KREDL)
  - Ministry of New and Renewable Energy (MNRE)
- **Limitations:**
  - Grid-level data, not ward-specific
  - Doesn't account for rooftop solar installations
- **Validation Status:** Accurate for state grid, needs rooftop solar overlay

**1.4 Green Buildings (IGBC/GRIHA Certified)**
- **Source:** IGBC/GRIHA database (manual lookup)
- **Confidence:** ★★☆☆☆ (55%)
- **Coverage:** 369/369 wards (incomplete)
- **Methodology:** Manual lookup from publicly available certified buildings lists
- **Data Age:** 2024
- **Credits:**
  - Indian Green Building Council (IGBC)
  - Green Rating for Integrated Habitat Assessment (GRIHA)
- **Limitations:**
  - Incomplete database access
  - Many certified buildings not geocoded to ward level
  - Pending comprehensive building-level mapping
- **Validation Status:** Needs spatial geocoding of all certified buildings

---

## 2. Transportation Sector

### Primary Data Sources

**2.1 Public Transport Share**
- **Source:** BMTC + BMRCL ridership data
- **OpenCity Datasets:**
  - [Bengaluru Public Transport Infrastructure](https://data.opencity.in/dataset/bengaluru-public-transport-infrastructure)
  - [BMTC Bus Stops and Routes Map by Ward](https://data.opencity.in/dataset/bus-stops-and-routes-map-by-ward)
  - [Comprehensive Traffic & Transportation Plan](https://data.opencity.in/dataset/10823d68-9a4d-4e9d-84ec-d7d8008ff992)
- **Confidence:** ★★★☆☆ (65%)
- **Coverage:** 369/369 wards (estimated)
- **Methodology:** Bus stop density + metro station proximity + ridership modelling
- **Data Age:** 2023-2024
- **Credits:**
  - Bangalore Metropolitan Transport Corporation (BMTC)
  - Bangalore Metro Rail Corporation Limited (BMRCL)
  - Directorate of Urban Land Transport (DULT)
- **Limitations:**
  - Ward-level modal split data not available
  - Modelled based on infrastructure availability
- **Validation Status:** Requires origin-destination surveys

**2.2 Electric Vehicle (EV) Adoption**
- **Source:** Karnataka Transport Department + BESCOM EV charging data
- **OpenCity Dataset:** [Vehicle Registration & EV Consumption Data](https://data.opencity.in/dataset/electricity-consumption)
- **Confidence:** ★★☆☆☆ (50%)
- **Coverage:** Partial (RTO data by sub-district, not ward)
- **Methodology:** RTO vehicle registration data aggregated to ward level (approximate)
- **Data Age:** 2020-2023
- **Credits:**
  - Department of Transport, Karnataka
  - BESCOM (EV charger locations: 2020-21 to 2022-23)
- **Limitations:**
  - RTO data not geocoded to ward boundaries
  - EV charger data shows infrastructure, not ownership
- **Validation Status:** Needs spatial mapping of RTO registrations

**2.3 Cycling Infrastructure**
- **Source:** BBMP + DULT
- **OpenCity Dataset:** [Traffic & Transportation Plan](https://data.opencity.in/dataset/10823d68-9a4d-4e9d-84ec-d7d8008ff992)
- **Confidence:** ★★☆☆☆ (50%)
- **Coverage:** Incomplete
- **Methodology:** Manual mapping of dedicated cycle tracks
- **Data Age:** 2024
- **Credits:**
  - Directorate of Urban Land Transport (DULT)
  - Bruhat Bengaluru Mahanagara Palike (BBMP)
- **Limitations:**
  - No comprehensive database of cycle infrastructure
  - Many planned lanes not yet built
- **Validation Status:** Requires field verification

---

## 3. Waste Management Sector

### Primary Data Sources

**3.1 Waste Segregation Rate**
- **Source:** BBMP Solid Waste Management Data
- **OpenCity Datasets:**
  - [BBMP Solid Waste Management Data](https://data.opencity.in/dataset/bbmp-solid-waste-management-data)
  - [BBMP Ward-Level Micro Plans 2017](https://data.opencity.in/dataset/bbmp-solid-waste-management-plans)
- **Confidence:** ★★★☆☆ (60%)
- **Coverage:** 369/369 wards (estimated baseline)
- **Methodology:** City average (30%) applied to all wards (pending ward-specific audits)
- **Data Age:** 2017-2020 baseline
- **Credits:**
  - Bruhat Bengaluru Mahanagara Palike (BBMP)
  - Solid Waste Management Department
- **Limitations:**
  - Baseline estimates, not measured ward-by-ward
  - Ward micro plans from 2017 need updating
- **Validation Status:** Quarterly audits planned for 2026

**3.2 Waste Generation Per Capita**
- **Source:** BBMP collection data + population estimates
- **OpenCity Dataset:** [BBMP Solid Waste Management](https://data.opencity.in/dataset/bbmp-solid-waste-management)
- **Confidence:** ★★★☆☆ (65%)
- **Coverage:** 369/369 wards (estimated)
- **Methodology:** Total collected waste ÷ population by ward
- **Data Age:** 2019-2020
- **Credits:**
  - BBMP Solid Waste Management Department
  - Census 2011 population (with projections)
- **Limitations:**
  - Collection data may not capture all generated waste
  - Population projections introduce uncertainty
- **Validation Status:** Requires waste characterization studies

**3.3 Recycling Rate**
- **Source:** BBMP Dry Waste Collection Centres (DWCC)
- **OpenCity Datasets:**
  - [BBMP Operating Dry Waste Collection Centres](https://data.opencity.in/dataset/bbmp-operating-dry-waste-collection-centres)
  - [RRR Centres in Bengaluru](https://data.opencity.in/dataset/rrr-reduce-reuse-recycle-centres-in-bengaluru)
  - [BBMP DWCC and SWM Processing Plants List](https://data.opencity.in/dataset/2340c8b4-3524-4ee5-93e5-57cf2fec8a2a)
- **Confidence:** ★★★☆☆ (60%)
- **Coverage:** 369/369 wards (estimated baseline)
- **Methodology:** City average recycling rate (15%) based on DWCC throughput
- **Data Age:** 2020
- **Credits:**
  - BBMP Solid Waste Management Department
  - Hasiru Dala (waste picker cooperative)
- **Limitations:**
  - Informal sector recycling not fully captured
  - Ward-level data pending
- **Validation Status:** Material flow analysis needed

---

## 4. Air Quality Sector

### Primary Data Sources

**4.1 PM2.5 and PM10 Annual Averages**
- **Source:** Karnataka State Pollution Control Board (KSPCB)
- **OpenCity Datasets:**
  - [Bengaluru Monthly Air Quality Reports](https://data.opencity.in/dataset/bengaluru-monthly-air-quality-reports)
  - [Bengaluru's Rising Air Quality Crisis](https://data.opencity.in/dataset/bengalurus-rising-air-quality-crisis)
  - [Bengaluru Clean Air Action Plan](https://data.opencity.in/dataset/bengaluru-clean-air-action-plan)
- **Confidence:** ★★★☆☆ (65%)
- **Coverage:** 11 monitoring stations (insufficient for 369 wards)
- **Methodology:** Spatial interpolation from 11 CAAQM stations + land use modeling
- **Data Age:** 2022-2024
- **Credits:**
  - Karnataka State Pollution Control Board (KSPCB)
  - Central Pollution Control Board (CPCB)
  - OpenCity.in Air Quality Datajam team
- **Limitations:**
  - Only 11 monitors for entire city (need 41+ monitors)
  - Gaps in eastern/southeastern areas (Marathahalli, Whitefield, Electronics City)
  - Interpolation introduces uncertainty
- **Validation Status:** Requires dense monitoring network

**4.2 Ward-Level Predictive AQI**
- **Source:** OpenCity.in Air Quality Datajam (March 2025)
- **OpenCity Resource:** [Bengaluru Air Quality Datajam](https://opencity.in/bengaluru-air-quality-datajam-march-2025/)
- **Confidence:** ★★★☆☆ (70%)
- **Coverage:** 369/369 wards (modeled)
- **Methodology:** Machine learning model using green cover, built-up density, industrial zones
- **Data Age:** 2024-2025
- **Credits:**
  - OpenCity.in community data scientists
  - IISc Energy & Wetlands Research Group
- **Limitations:**
  - Model-based predictions, not direct measurements
  - Requires validation with actual monitors
- **Validation Status:** Model validation ongoing

---

## 5. Water Resources Sector

### Primary Data Sources

**5.1 Water Consumption (LPCD)**
- **Source:** BWSSB supply data + population estimates
- **OpenCity Datasets:**
  - [BWSSB Stage-wise Cauvery Water Supply Areas](https://data.opencity.in/dataset/bwssb-stage-wise-cauvery-water-supply-areas)
  - [BWSSB Water Supply Lines Maps](https://data.opencity.in/dataset/bwssb-water-supply-lines-map-of-bengaluru)
  - [BWSSB Data Collection](https://data.opencity.in/dataset/bwssb-data)
- **Confidence:** ★★★☆☆ (70%)
- **Coverage:** 369/369 wards (estimated)
- **Methodology:** BWSSB supply data ÷ population by supply zone, mapped to wards
- **Data Age:** 2023-2024
- **Credits:**
  - Bangalore Water Supply and Sewerage Board (BWSSB)
  - Karnataka Urban Water Supply and Drainage Board
- **Limitations:**
  - Supply zones don't align perfectly with ward boundaries
  - Doesn't capture groundwater consumption
- **Validation Status:** Requires smart meter data

**5.2 Groundwater Dependence**
- **Source:** IISc Groundwater Outlook + BWSSB data
- **OpenCity Datasets:**
  - [Groundwater Outlook of Bengaluru City - April 2025](https://data.opencity.in/dataset/groundwater-outlook-of-bengaluru-city-april-2025)
  - [Bengaluru Ground Water Depth](https://data.opencity.in/dataset/bengaluru-ground-water-depth)
  - [Status of Groundwater Quality](https://data.opencity.in/dataset/status-of-groundwater-quality)
- **Confidence:** ★★★★☆ (75%)
- **Coverage:** 369/369 wards (modeled)
- **Methodology:** Extraction estimates (800 MLD total) distributed by BWSSB coverage gaps
- **Data Age:** 2025
- **Credits:**
  - Prof. Lakshminarayana & Prof. Sekhar Muddu, Indian Institute of Science (IISc)
  - BWSSB
- **Limitations:**
  - Based on modelling, not direct borewell metering
  - Highest stress in South-East Bangalore and Whitefield
- **Validation Status:** Borewell registry integration needed

**5.3 Rainwater Harvesting**
- **Source:** BBMP/BWSSB compliance data
- **Confidence:** ★★☆☆☆ (50%)
- **Coverage:** Incomplete
- **Methodology:** Building plan approvals with RWH mandate (post-2009)
- **Data Age:** 2015-2024
- **Credits:**
  - BWSSB (RWH compliance database)
  - BBMP Building Plan Approval Department
- **Limitations:**
  - Compliance data incomplete
  - Actual functionality of installed systems unknown
- **Validation Status:** Requires field audits

---

## 6. Urban Greening Sector

### Primary Data Sources

**6.1 Tree Cover Percentage**
- **Source:** BBMP Tree Census + remote sensing
- **OpenCity Datasets:**
  - [Bengaluru Trees - Ward-wise Tree Plantation Data](https://data.opencity.in/dataset/bengaluru-trees/resource/bbmp:-ward-wise-data-on-tree-plantation)
  - [Geotagged Trees in Bengaluru](https://data.opencity.in/dataset/geotagged-trees-in-bengaluru-data)
- **Confidence:** ★★★☆☆ (70%)
- **Coverage:** 369/369 wards (census data)
- **Methodology:** Tree census count (Nov 2024, Jan 2025, April 2025) + canopy cover estimation
- **Data Age:** 2024-2025
- **Credits:**
  - BBMP Horticulture Department
  - Forest Department, Karnataka
  - IISc Energy & Wetlands Research Group (remote sensing)
- **Limitations:**
  - Census counts trees on public land only (not private)
  - Canopy cover estimates from satellite data (resolution limits)
- **Validation Status:** Requires high-resolution satellite imagery

**6.2 Green Space Per Capita**
- **Source:** BBMP Parks database + open space mapping
- **OpenCity Datasets:**
  - [BBMP Parks - Detailed Park List](https://data.opencity.in/dataset/bbmp-parks/resource/bbmp:-detailed-park-list)
  - [Map of Parks Under BBMP](https://data.opencity.in/dataset/bbmp-parks/resource/map-of-parks-under-bbmp)
  - [Bangalore Parks and Playgrounds](https://data.opencity.in/dataset/bangalore-parks-and-playgrounds)
- **Confidence:** ★★★☆☆ (65%)
- **Coverage:** 369/369 wards
- **Methodology:** Total park area (from BBMP) ÷ ward population
- **Data Age:** 2024
- **Credits:**
  - BBMP Horticulture Department
  - Forest Manual for Urban Forestry (Dr K. N. Murthy, IFS Rtd, Treelands Foundation)
- **Limitations:**
  - Doesn't include private gardens or informal green spaces
  - Park area data may be outdated
- **Validation Status:** Requires GIS verification

**6.3 Parks Count**
- **Source:** BBMP Horticulture Department
- **OpenCity Dataset:** [BBMP Parks](https://data.opencity.in/dataset/bbmp-parks)
- **Confidence:** ★★★★☆ (80%)
- **Coverage:** 369/369 wards
- **Methodology:** Direct count from BBMP parks registry
- **Data Age:** 2024
- **Credits:**
  - BBMP Horticulture Department
- **Limitations:**
  - Only counts BBMP-maintained parks (not private or other agencies)
- **Validation Status:** Verified

---

## 7. Disaster Preparedness Sector

### Primary Data Sources

**7.1 Flood Risk Percentage**
- **Source:** BBMP flood mapping + stormwater drain coverage
- **OpenCity Datasets:**
  - [Flooding Locations in Bengaluru Urban](https://data.opencity.in/dataset/flooding-locations-in-bengaluru-urban)
  - [Bengaluru Stormwater Drains Maps](https://data.opencity.in/dataset/bengaluru-stormwater-drains-maps)
  - [BBMP Stormwater Drain Buffer Notification](https://data.opencity.in/dataset/flooding-locations-in-bengaluru-urban)
- **Confidence:** ★★★☆☆ (65%)
- **Coverage:** 369/369 wards (mapped)
- **Methodology:** Historical flood locations + drainage network analysis + topography
- **Data Age:** 2019-2024
- **Credits:**
  - BBMP Stormwater Drain Department
  - Karnataka State Natural Disaster Monitoring Centre (KSNDMC)
  - Government of Karnataka (SWD buffer notification)
- **Limitations:**
  - Historical data may not capture recent urban changes
  - Climate change increasing frequency/intensity not fully modeled
- **Validation Status:** Requires flood modeling with climate scenarios

**7.2 Heat Vulnerability Index**
- **Source:** Urban Heat Island studies + socioeconomic data
- **OpenCity Datasets:**
  - [Rising Heat and Waste Workers Report](https://data.opencity.in/dataset?groups=environment) (Hasiru Dala & HeatWatch)
  - [Urban Heat Island Effect Report](https://data.opencity.in/dataset?groups=environment) (TERI for EMPRI)
  - [Climate & Air Pollution Vulnerability Assessment](https://data.opencity.in/dataset/f561b852-74bf-4ae7-b4a5-a8bf538ee52b)
- **Confidence:** ★★★☆☆ (70%)
- **Coverage:** 369/369 wards (modeled)
- **Methodology:** Land surface temperature + green cover + vulnerable populations
- **Data Age:** 2024-2025
- **Credits:**
  - The Energy and Resources Institute (TERI)
  - Environmental Management & Policy Research Institute (EMPRI)
  - Hasiru Dala & HeatWatch
- **Limitations:**
  - Model-based, not direct temperature monitoring at ward level
  - Social vulnerability data from Census 2011 (outdated)
- **Validation Status:** Requires ward-level temperature sensors

**7.3 Disaster Preparedness Score**
- **Source:** NDMA guidelines compliance assessment
- **Confidence:** ★★☆☆☆ (50%)
- **Coverage:** Limited
- **Methodology:** Qualitative assessment of emergency response infrastructure
- **Data Age:** 2024
- **Credits:**
  - National Disaster Management Authority (NDMA)
  - Karnataka State Disaster Management Authority (KSDMA)
  - BBMP Disaster Management Cell
- **Limitations:**
  - No standardized ward-level preparedness metrics
  - Data collection ongoing
- **Validation Status:** Framework under development

**7.4 Climate Action Plan**
- **Source:** Bengaluru Climate Action and Resilience Plan (BCAP)
- **OpenCity Dataset:** [Bengaluru Climate Action Plan](https://data.opencity.in/dataset/bengaluru-clean-air-action-plan)
- **Confidence:** ★★★★☆ (85%)
- **Coverage:** City-wide
- **Data Age:** 2024
- **Credits:**
  - BBMP
  - World Resources Institute (WRI) India
  - ICLEI South Asia
- **Validation Status:** Official city plan

---

## Cross-Cutting Data Sources

### 1. Ward Boundaries & Demographics

**Source:** Census 2011 + BBMP Ward Delimitation
- **OpenCity Datasets:**
  - [BBMP Ward Information - 2022](https://data.opencity.in/dataset/bbmp-ward-information)
  - [BBMP Wards Delimitation 2023](https://data.opencity.in/dataset/bbmp-wards-delimitation-2023)
  - [Ward-wise Street Maps](https://data.opencity.in/dataset/bengaluru-ward-wise-street-map)
- **Confidence:** ★★★★★ (95%)
- **Coverage:** 369 wards (243 wards in 2022, 225 wards in 2023 final delimitation)
- **Credits:**
  - Office of the Registrar General & Census Commissioner, India
  - Bruhat Bengaluru Mahanagara Palike (BBMP)
  - Election Commission of India
- **Data Age:** Census 2011, Boundaries updated 2022-2023
- **Formats:** GeoJSON, KML, CSV, TSV, JSON, XML
- **Validation Status:** Official government data

**Note:** Current dashboard uses 369 wards from older delimitation. Should migrate to 225 wards from 2023 final delimitation.

### 2. Rainfall Data

**Source:** KSNDMC
- **OpenCity Datasets:**
  - [Bengaluru Urban Annual Rainfall - Taluks and Hoblis](https://data.opencity.in/dataset/bengaluru-urban-annual-rainfall-taluks-and-hoblis)
  - [Bengaluru Rainfall from 1901](https://data.opencity.in/dataset/bengaluru-rainfall)
- **Confidence:** ★★★★☆ (85%)
- **Coverage:** 2017-2023 (Taluk/Hobli level)
- **Credits:**
  - Karnataka State Natural Disaster Monitoring Centre (KSNDMC)
  - India Meteorological Department (IMD)
- **Validation Status:** Official weather data

---

## Data Confidence Scoring Methodology

### Confidence Levels

| Score | Rating | Description | Typical Sources |
|-------|--------|-------------|-----------------|
| ★★★★★ | 90-100% | Verified, official, recent data | Census, Official surveys, Direct measurements |
| ★★★★☆ | 75-89% | Reliable, documented methodology | Government reports, Peer-reviewed studies |
| ★★★☆☆ | 60-74% | Modeled with validation | Satellite data, Statistical models |
| ★★☆☆☆ | 50-59% | Estimated, needs validation | Projections, Proxies, Outdated surveys |
| ★☆☆☆☆ | <50% | Preliminary, limited evidence | Anecdotal, Very old data, Unverified |

### Confidence Factors

**Increases Confidence (+):**
- Direct measurement
- Recent data (<2 years old)
- Official government source
- Peer-reviewed methodology
- Ward-level granularity
- Multiple corroborating sources
- Independent validation

**Decreases Confidence (-):**
- Modeled/estimated data
- Old data (>5 years)
- Proxy indicators
- City-wide averages applied to wards
- Incomplete coverage
- Single source
- No validation

---

## Data Update Schedule

| Sector | Current Frequency | Target Frequency | Next Update |
|--------|------------------|------------------|-------------|
| Energy & Buildings | Baseline only | Annual | Q2 2026 |
| Transportation | Baseline only | Quarterly | Q2 2026 |
| Waste Management | Baseline only | Monthly | Q1 2026 |
| Air Quality | Monthly (monitors) | Daily (when dense network) | Ongoing |
| Water Resources | Annual | Quarterly | Q2 2026 |
| Urban Greening | Annual (census) | Annual | Q4 2025 |
| Disaster Preparedness | Event-based | Annual | Q3 2026 |

---

## Credits & Acknowledgments

### Government Agencies
- **Bruhat Bengaluru Mahanagara Palike (BBMP)** - Ward administration, solid waste, parks, stormwater drains
- **Bangalore Water Supply and Sewerage Board (BWSSB)** - Water supply infrastructure
- **Bangalore Electricity Supply Company (BESCOM)** - Electricity distribution
- **Karnataka State Pollution Control Board (KSPCB)** - Air quality monitoring
- **Bangalore Metropolitan Transport Corporation (BMTC)** - Public bus transport
- **Bangalore Metro Rail Corporation Limited (BMRCL)** - Metro rail infrastructure
- **Karnataka State Natural Disaster Monitoring Centre (KSNDMC)** - Weather and disaster data
- **Directorate of Urban Land Transport (DULT)** - Transportation planning
- **Department of Transport, Karnataka** - Vehicle registration data
- **Karnataka Renewable Energy Development Limited (KREDL)** - Renewable energy policy

### Research Institutions
- **Indian Institute of Science (IISc), Bengaluru**
  - Energy & Wetlands Research Group (remote sensing, environmental data)
  - Prof. Lakshminarayana & Prof. Sekhar Muddu (groundwater modeling)
- **The Energy and Resources Institute (TERI)** - Urban heat island research
- **Environmental Management & Policy Research Institute (EMPRI)** - Climate vulnerability assessment

### Civil Society & Non-Profits
- **OpenCity.in** - Urban data portal and community data initiatives
- **Hasiru Dala** - Waste worker welfare and informal sector data
- **HeatWatch** - Heat stress monitoring
- **World Resources Institute (WRI) India** - Climate action planning
- **ICLEI South Asia** - Local governments for sustainability
- **Treelands Foundation** - Urban forestry

### Data Licensing
- **NOTF Dashboard Data:** CC BY-NC-SA 4.0
- **OpenCity.in Datasets:** CC BY-NC-SA 4.0 and ODbL (Open Database License)
- **Government Data:** Open Government Data (OGD) Policy, India

---

## How to Cite This Data

### General Citation
```
Neighbourhoods of the Future (2026). Ward-Level Climate Dashboard for Bengaluru.
Data sources: Census 2011, BBMP, BWSSB, BESCOM, KSPCB, OpenCity.in.
Retrieved from https://notf.org/cities/bengaluru/climate/
License: CC BY-NC-SA 4.0
```

### Academic Citation (APA)
```
Neighbourhoods of the Future. (2026). Ward-level climate action data for Bengaluru
(369 wards across 7 climate sectors) [Data set]. OpenCity.in & Government of
Karnataka. https://notf.org/cities/bengaluru/climate/
```

### Data DOI
*(To be assigned when deposited in research repository)*

---

## Contact & Feedback

**Data Errors or Updates:**
- Report issues: https://github.com/anthropics/notf/issues
- Email: data@notf.org

**Partnership Inquiries:**
- For data partnerships: partnerships@notf.org
- For OpenCity.in datasets: contact via https://opencity.in/contact

**Last Reviewed:** 2026-01-23
**Next Review:** 2026-07-23 (6 months)

---

## Appendix: OpenCity.in Dataset Links

### Complete Dataset Index by Sector

**Energy & Buildings:**
- https://data.opencity.in/dataset/electricity-consumption
- https://data.opencity.in/dataset/bengaluru-household-consumption-expenditure-survey-2022-23
- https://data.opencity.in/dataset/india-statewise-electricity-data

**Transportation:**
- https://data.opencity.in/dataset/bengaluru-public-transport-infrastructure
- https://data.opencity.in/dataset/bus-stops-and-routes-map-by-ward
- https://data.opencity.in/dataset/bengaluru-bus-stops-and-routes

**Waste Management:**
- https://data.opencity.in/dataset/bbmp-solid-waste-management-data
- https://data.opencity.in/dataset/bbmp-operating-dry-waste-collection-centres
- https://data.opencity.in/dataset/bbmp-solid-waste-management-plans
- https://data.opencity.in/dataset/rrr-reduce-reuse-recycle-centres-in-bengaluru

**Air Quality:**
- https://data.opencity.in/dataset/bengaluru-monthly-air-quality-reports
- https://data.opencity.in/dataset/bengalurus-rising-air-quality-crisis
- https://data.opencity.in/dataset/bengaluru-clean-air-action-plan

**Water Resources:**
- https://data.opencity.in/dataset/bwssb-stage-wise-cauvery-water-supply-areas
- https://data.opencity.in/dataset/groundwater-outlook-of-bengaluru-city-april-2025
- https://data.opencity.in/dataset/bengaluru-ground-water-depth
- https://data.opencity.in/dataset/bwssb-water-supply-lines-map-of-bengaluru

**Urban Greening:**
- https://data.opencity.in/dataset/bengaluru-trees
- https://data.opencity.in/dataset/bbmp-parks
- https://data.opencity.in/dataset/geotagged-trees-in-bengaluru-data

**Disaster Preparedness:**
- https://data.opencity.in/dataset/flooding-locations-in-bengaluru-urban
- https://data.opencity.in/dataset/bengaluru-stormwater-drains-maps
- https://data.opencity.in/dataset/bengaluru-urban-annual-rainfall-taluks-and-hoblis

**Cross-Cutting:**
- https://data.opencity.in/dataset/bbmp-ward-information
- https://data.opencity.in/dataset/bbmp-wards-delimitation-2023
- https://data.opencity.in/dataset/bengaluru-ward-wise-street-map

---

**End of Document**
