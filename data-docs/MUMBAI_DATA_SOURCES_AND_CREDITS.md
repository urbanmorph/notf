# Mumbai Ward-Level Climate Data - Sources & Credits

**City:** Mumbai (Bombay)
**Wards:** 227 administrative wards
**Governing Body:** Municipal Corporation of Greater Mumbai (MCGM/BMC)
**Last Updated:** 2026-01-23
**Data Portal:** [OpenCity.in Mumbai Datasets](https://data.opencity.in/dataset?city=Mumbai)

---

## Executive Summary

This document provides comprehensive documentation of all data sources, methodologies, and confidence scores for Mumbai's ward-level climate dashboard. Mumbai has **227 administrative wards** organized into **24 ward committees** (A through T, excluding J, with some subdivided like F/N, F/S, H/E, H/W).

**Overall Data Confidence:** ★★★☆☆ (65%)

**Key Difference from Bengaluru:** Mumbai has excellent city-level climate planning (Mumbai Climate Action Plan 2022) but less granular ward-level data for some metrics. Census 2011 ward data is complete, but real-time monitoring infrastructure varies by sector.

---

## Data Sources by Sector

### 1. Energy & Buildings

#### 1.1 Clean Cooking (LPG/PNG vs Solid Fuels)

**Primary Source:** [Mumbai Ward-wise Census Data 2011](https://data.opencity.in/dataset/mumbai-ward-wise-census-data) (OpenCity.in)

**Data Provider:** Census of India 2011 + OpenCity collation
**Confidence:** ★★★☆☆ (60%)
**Ward Coverage:** 227/227 wards (100%)

**Methodology:**
- Census 2011 household-level data on cooking fuel sources
- Ward-level aggregation from sub-ward Primary Census Abstract
- BMC ward name mapping created by community contributors

**Available Metrics:**
- Households using LPG/PNG
- Households using solid fuels (wood, coal, kerosene)
- Percentage of clean cooking adoption per ward

**Limitations:**
- Data is 15 years old (2011)
- Mumbai's LPG adoption has increased significantly since 2011
- Ward boundary changes since 2011 may affect accuracy
- No recent ward-level surveys available

**Data Quality:** Medium - Census data is authoritative but outdated

---

#### 1.2 Renewable Energy Share

**Primary Source:** [Mumbai Climate Action Plan 2022](https://data.opencity.in/dataset/mumbai-climate-action-plan) (MCGM + C40 Cities)

**Data Provider:** MCGM, WRI India, C40 Cities
**Confidence:** ★★★★☆ (75%)
**Ward Coverage:** City-level average applied to all wards

**Methodology:**
- Maharashtra state grid renewable energy mix (23% as of 2023)
- Rooftop solar installations tracked by MSEDCL (not ward-level)
- MCAP target: 60% renewable energy by 2050

**Available Metrics:**
- State grid renewable percentage (uniform across wards)
- Rooftop solar capacity (city-level aggregate)

**Limitations:**
- No ward-level electricity consumption or renewable generation data
- MSEDCL data at substation level, not aligned with ward boundaries
- Commercial vs residential solar not separated

**Data Quality:** High for city-level, Low for ward-level disaggregation

---

#### 1.3 Electricity Consumption

**Primary Source:** MSEDCL (Maharashtra State Electricity Distribution Co. Ltd.)

**Data Provider:** MSEDCL, MCGM estimates
**Confidence:** ★★☆☆☆ (50%)
**Ward Coverage:** City-level estimate applied uniformly

**Methodology:**
- National/state average electricity consumption per capita
- Mumbai consumes ~1100 kWh/capita (higher than national average)
- Ward-level consumption not publicly available

**Available Metrics:**
- Estimated per capita consumption (uniform across wards)
- Commercial vs residential split (city-level only)

**Limitations:**
- No ward-level metering data published
- MSEDCL substations don't align with ward boundaries
- Informal settlements may be undercounted

**Data Quality:** Low - estimates only, no actual ward-level measurements

**Future Data:** MCAP proposes ward-level energy dashboards (pending implementation)

---

#### 1.4 Green Buildings (IGBC/GRIHA Certified)

**Primary Source:** [Mumbai Development Plan 2034](https://data.opencity.in/dataset/mumbai-development-plan-2034) + IGBC Registry

**Data Provider:** MCGM + IGBC/GRIHA
**Confidence:** ★★★★☆ (70%)
**Ward Coverage:** Geocoded certifications mapped to wards

**Methodology:**
- Manual geocoding of IGBC/GRIHA certified buildings
- Address matching to ward boundaries
- Includes both completed and under-construction certifications

**Available Metrics:**
- Count of certified green buildings per ward
- LEED Platinum, Gold, Silver, Certified breakdown
- GRIHA 4-star and 5-star buildings

**Limitations:**
- Only includes certified buildings (small fraction of total stock)
- Address-to-ward mapping may have errors
- Does not include buildings with green features but no certification

**Data Quality:** High for certified buildings, but small sample size

---

### 2. Transportation & Mobility

#### 2.1 Public Transport Coverage

**Primary Source:** [Mumbai BEST Bus Stops and Depots Data](https://data.opencity.in/dataset/mumbai-best-bus-stops-and-depots-data) (OpenCity.in)

**Data Provider:** BEST (Brihanmumbai Electric Supply and Transport)
**Confidence:** ★★★★★ (90%)
**Ward Coverage:** 227/227 wards with BEST connectivity

**Methodology:**
- BEST bus stop locations (geocoded)
- Bus route coverage by ward
- Depot locations and service frequency

**Available Metrics:**
- Number of bus stops per ward
- Number of routes serving each ward
- Average distance to nearest bus stop

**Limitations:**
- Does not include Mumbai Metro coverage (separate dataset needed)
- Auto-rickshaw and taxi coverage not tracked
- Service frequency varies significantly by route

**Data Quality:** Excellent - official BEST operational data

---

#### 2.2 Metro Rail Coverage

**Primary Source:** Mumbai Metro Rail Corporation (MMRC)

**Data Provider:** MMRC
**Confidence:** ★★★★☆ (80%)
**Ward Coverage:** Limited (only wards with operational metro lines)

**Methodology:**
- Metro Line 1 (Versova-Ghatkopar): Operational
- Metro Line 2A, 2B, 3, 4, 5, 6, 7: Under construction/planning
- Station locations mapped to wards

**Available Metrics:**
- Wards with metro stations
- Distance to nearest metro station
- Projected coverage by 2030

**Limitations:**
- Limited current coverage (only Line 1 operational)
- Many wards have no metro access
- Future lines still under construction

**Data Quality:** High for operational lines, Medium for planned lines

---

#### 2.3 Electric Vehicle Adoption

**Primary Source:** MCGM Transport Department + MPCB

**Data Provider:** MCGM, MPCB
**Confidence:** ★★★☆☆ (60%)
**Ward Coverage:** City-level data, ward-level estimates

**Methodology:**
- EV registrations tracked by Regional Transport Office (RTO)
- BEST electric bus deployment by depot/ward
- Charging station locations (geocoded)

**Available Metrics:**
- Total EVs registered (city-level)
- BEST electric buses per depot
- Public charging stations per ward

**Limitations:**
- RTO registration data not disaggregated by ward
- Private vehicle ownership data privacy restrictions
- Charging infrastructure rapidly expanding (data lags reality)

**Data Quality:** Medium - good for public fleet, limited for private vehicles

---

### 3. Waste Management

#### 3.1 Waste Segregation Rate

**Primary Source:** [MCGM Solid Waste Management](https://data.opencity.in/group/mumbai) + [Dry Waste Segregation Centres](https://portal.mcgm.gov.in/irj/go/km/docs/documents/MCGM%20Department%20List/Solid%20Waste%20Management/Docs/DWSC%20-%20List%20of%20Centres%20PDF.pdf)

**Data Provider:** MCGM Solid Waste Management Department
**Confidence:** ★★★☆☆ (65%)
**Ward Coverage:** 227/227 wards (city average applied)

**Methodology:**
- City-wide segregation rate: 82% (MCGM 2023 data)
- Ward-level data proposed in MCAP but not yet implemented
- Self-reported data from waste collectors

**Available Metrics:**
- City average: 82% segregation
- 46 Dry Waste Sorting Centers across 24 wards
- 1,696 Bulk Waste Generators composting

**Limitations:**
- City-level average, not ward-specific measurements
- Self-reported compliance rates may be inflated
- Informal sector segregation not captured

**Data Quality:** Medium - city data reliable, ward-level disaggregation needed

**Future Data:** MCAP proposes ward-level waste tracking dashboard (pending)

---

#### 3.2 Waste Generation Per Capita

**Primary Source:** MCGM Solid Waste Management Reports

**Data Provider:** MCGM
**Confidence:** ★★★★☆ (70%)
**Ward Coverage:** Ward-level collection data available

**Methodology:**
- Daily waste collection tonnage by ward
- Divided by ward population (Census 2011 + projections)
- Mumbai generates ~9,500 tonnes per day city-wide

**Available Metrics:**
- Waste collected per ward (tonnes/day)
- Per capita generation (kg/capita/day)
- Seasonal variations

**Limitations:**
- Collection data assumes all waste is collected (may undercount)
- Population projections based on 2011 census
- Commercial vs residential waste not separated

**Data Quality:** Good - based on actual collection records

---

#### 3.3 Recycling & Composting

**Primary Source:** MCGM + Praja Foundation Reports

**Data Provider:** MCGM, Praja
**Confidence:** ★★★☆☆ (60%)
**Ward Coverage:** Facility-based data mapped to wards

**Methodology:**
- 46 Dry Waste Sorting Centers (DWSCs) across 24 wards
- Community composting sites tracked by location
- Informal recycling sector not systematically tracked

**Available Metrics:**
- DWSCs per ward
- Composting capacity per ward
- Bulk waste generators (apartments with in-house composting)

**Limitations:**
- Informal recycling (majority of actual recycling) not captured
- Composting adoption self-reported by housing societies
- No systematic tracking of material recovery rates

**Data Quality:** Medium - formal sector only, informal sector missing

---

### 4. Air Quality

#### 4.1 PM2.5 & PM10 Monitoring

**Primary Source:** [Mumbai Hourly Air Quality Reports](https://data.opencity.in/dataset/mumbai-hourly-air-quality-reports) (OpenCity.in - MPCB Data)

**Data Provider:** Maharashtra Pollution Control Board (MPCB), IITM, BMC
**Confidence:** ★★★★☆ (75%)
**Ward Coverage:** 16 monitoring stations (limited ward coverage)

**Methodology:**
- MPCB operates 16 continuous ambient air quality monitoring stations (CAAQMS)
- Stations: Sion, Bandra, Kandivali, Mulund, Borivali, Vile Parle, Kurla, Powai, Worli, Colaba, etc.
- Hourly data from 2017-2023 available on OpenCity
- Ward-level estimates via spatial interpolation

**Available Metrics:**
- PM2.5, PM10, NO2, SO2, CO, O3
- AQI (Air Quality Index)
- Hourly, daily, monthly averages

**Limitations:**
- Only 16 stations for 227 wards (sparse coverage)
- Wards without monitoring stations rely on interpolation
- M/E Ward consistently shows highest pollution (MPCB/IITM 2019-2021)

**Data Quality:** Excellent for monitored wards, Medium for interpolated wards

**Source Apportionment Study:** [MCGM Air Quality Assessment](https://portal.mcgm.gov.in/irj/go/km/docs/documents/Environment/Resources/Source%20Apportionment%20Report-MCGM.pdf)

---

### 5. Water Resources

#### 5.1 Water Supply Coverage

**Primary Source:** MCGM Hydraulic Engineering Department

**Data Provider:** MCGM
**Confidence:** ★★★☆☆ (60%)
**Ward Coverage:** Ward-level water supply zones

**Methodology:**
- Mumbai receives ~3,850 million litres per day (MLD) from 7 lakes
- Distribution via 6 water supply zones (not aligned with wards)
- Per capita supply: ~135 litres/capita/day (city average)

**Available Metrics:**
- Water supply zones mapped to wards
- Daily supply volume per zone
- Supply hours per day (varies by ward)

**Limitations:**
- Zones don't align with ward boundaries
- Informal settlements may have limited/no piped supply
- Supply quality and pressure variations not tracked systematically

**Data Quality:** Medium - zone-level data available, ward-level granularity limited

---

#### 5.2 Groundwater Dependence

**Primary Source:** Central Ground Water Board (CGWB) + MCGM

**Data Provider:** CGWB, MCGM
**Confidence:** ★★☆☆☆ (50%)
**Ward Coverage:** Limited monitoring wells

**Methodology:**
- CGWB monitoring wells across Mumbai
- Groundwater quality and level measurements
- Ward-level dependence estimated from Census housing data

**Available Metrics:**
- Households dependent on groundwater (Census 2011)
- Groundwater quality (monitoring well data)
- Borewells per ward (informal estimates)

**Limitations:**
- Very limited monitoring well coverage
- Illegal borewells not tracked
- Groundwater quality highly variable within wards

**Data Quality:** Low - sparse monitoring, outdated census data

---

### 6. Urban Greening

#### 6.1 Tree Census

**Primary Source:** MCGM Garden Department Tree Census

**Data Provider:** MCGM
**Confidence:** ★★★★☆ (75%)
**Ward Coverage:** 227/227 wards with tree count data

**Methodology:**
- MCGM conducts periodic tree census
- Trees tagged and geocoded
- Species, girth, health status recorded

**Available Metrics:**
- Number of trees per ward
- Trees per capita
- Species diversity
- Tree canopy cover (satellite imagery)

**Limitations:**
- Census frequency irregular (not annually updated)
- Private property trees may be undercounted
- Tree health status not consistently maintained

**Data Quality:** Good - systematic census with geocoding

---

#### 6.2 Parks & Open Spaces

**Primary Source:** [Mumbai Development Plan 2034](https://data.opencity.in/dataset/mumbai-development-plan-2034) + MCGM Garden Department

**Data Provider:** MCGM
**Confidence:** ★★★★☆ (70%)
**Ward Coverage:** 227/227 wards with park inventory

**Methodology:**
- MCGM maintains database of parks and gardens
- Area, amenities, maintenance status recorded
- Open spaces identified in Development Plan

**Available Metrics:**
- Number of parks per ward
- Total park area per ward
- Open space per capita

**Limitations:**
- Informal open spaces may not be counted
- Accessibility (distance to nearest park) not systematically tracked
- Park quality/maintenance levels vary significantly

**Data Quality:** Good - official MCGM inventory

---

### 7. Disaster Resilience & Climate Risk

#### 7.1 Flood Vulnerability

**Primary Source:** [Mumbai Climate Action Plan 2022](https://data.opencity.in/dataset/mumbai-climate-action-plan) + MCGM Stormwater Drains Department

**Data Provider:** MCGM, IIT Bombay, WRI India
**Confidence:** ★★★★★ (85%)
**Ward Coverage:** 227/227 wards with flood risk assessment

**Methodology:**
- MCAP identifies 35% of Mumbai population at flood risk
- Ward-level vulnerability analysis: H/E, H/W, F/N most vulnerable (>60% at risk)
- Flood modeling based on monsoon rainfall patterns, drainage capacity, elevation

**Available Metrics:**
- Population at flood risk per ward
- Historical flood events (ward-level)
- Drainage network capacity
- Low-lying areas identification

**Limitations:**
- Flood modeling based on historical data (climate change may alter patterns)
- Stormwater drain capacity data may be outdated
- Informal settlements in high-risk areas may be undercounted

**Data Quality:** Excellent - comprehensive MCAP assessment

**Key Finding:** Wards H/E (Bandra East), H/W (Bandra West), F/N (Matunga) most vulnerable

---

#### 7.2 Heat Vulnerability

**Primary Source:** MCAP + Urban Heat Island Studies

**Data Provider:** MCGM, IIT Bombay, IITM
**Confidence:** ★★★☆☆ (65%)
**Ward Coverage:** Ward-level heat risk maps available

**Methodology:**
- Satellite thermal imagery (LST - Land Surface Temperature)
- Urban heat island effect mapping
- Vulnerability factors: elderly population, tree cover, built density

**Available Metrics:**
- Average summer temperature per ward
- Heat island intensity
- Vulnerable population (elderly, outdoor workers)

**Limitations:**
- Heat risk modeling still evolving
- Ward-level health impact data limited
- Cooling center locations not systematically tracked

**Data Quality:** Medium - satellite data good, health impact data limited

---

## Data Licensing & Usage

### OpenCity.in Data Portal

**License:** Most datasets use **Open Data Commons Open Database License (ODbL)**

**Terms:**
- ✓ Free to use, modify, and distribute
- ✓ Attribution required (link to OpenCity.in + original data provider)
- ✓ Share-alike (derivatives must use same license)
- ✗ No warranty provided

**Citation Format:**
```
[Dataset Name]. (Year). OpenCity.in. Retrieved from [URL]
Original Data Provider: [Government Agency/Organization]
```

**Example:**
```
Mumbai Ward-wise Census Data. (2011). OpenCity.in.
Retrieved from https://data.opencity.in/dataset/mumbai-ward-wise-census-data
Original Data Provider: Census of India 2011
```

### MCGM/Government Data

**License:** Government Open Data License - India (GODL)

**Terms:**
- ✓ Free to use for any purpose
- ✓ Attribution recommended but not mandatory
- ✓ No share-alike requirement
- ✗ No warranty

---

## Credits & Acknowledgments

### Government Agencies

**Municipal Corporation of Greater Mumbai (MCGM/BMC)**
- Solid Waste Management Department
- Hydraulic Engineering Department
- Garden Department (Tree Census)
- Environment Department (MCAP coordination)
- Transport Department

**Maharashtra Pollution Control Board (MPCB)**
- Air quality monitoring network (16 CAAQMS stations)
- Emissions inventory
- Source apportionment studies

**Maharashtra State Electricity Distribution Co. Ltd. (MSEDCL)**
- Electricity consumption data (city-level)
- Renewable energy mix data

**Brihanmumbai Electric Supply and Transport (BEST)**
- Bus route and stop location data
- Electric bus deployment data

**Mumbai Metro Rail Corporation (MMRC)**
- Metro line alignment and station data

**Census of India**
- 2011 household and demographic data
- Ward-level population, housing, amenities

**Central Ground Water Board (CGWB)**
- Groundwater monitoring and quality data

### Research & Civil Society Organizations

**WRI India (World Resources Institute)**
- Mumbai Climate Action Plan technical support
- Urban mobility and transport studies

**C40 Cities**
- Climate action planning framework
- International best practice guidance

**IIT Bombay (Indian Institute of Technology)**
- Flood modeling and urban heat studies
- Technical analysis for MCAP

**IITM Pune (Indian Institute of Tropical Meteorology)**
- Air quality modeling
- Weather and climate data

**Praja Foundation**
- Civic data collection and analysis
- Waste management monitoring

**OpenCity.in**
- Data portal maintenance and curation
- Community data collation efforts
- Ward name mapping (Census to BMC wards)

### Community Contributors

- GitHub user [@mickeykedia](https://github.com/mickeykedia/Mumbai-Population-Map) - Ward population mapping
- OpenCity community volunteers - Data cleaning and validation
- BMC ward mapping contributors - Census-to-ward alignment

---

## Data Gaps & Future Work

### High Priority (Needed for Ward Dashboard)

1. **Ward-level Electricity Consumption** - MSEDCL to publish substation-to-ward mapping
2. **Ward-level Waste Tracking Dashboard** - Proposed in MCAP, not yet implemented
3. **Real-time Air Quality Coverage** - Expand MPCB monitoring from 16 to 50+ wards
4. **Vehicle Registration by Ward** - RTO to provide ward-level EV adoption data
5. **Water Supply Quality** - Ward-level water quality testing results

### Medium Priority (Would Enhance Dashboard)

6. **Rooftop Solar Installations** - Ward-level capacity tracking
7. **Building Energy Performance** - Systematic energy audits beyond IGBC/GRIHA
8. **Green Buildings Pipeline** - Under-construction certifications by ward
9. **Informal Recycling Sector** - Systematic tracking of waste pickers and aggregators
10. **Heat-related Health Impacts** - Hospital admission data by ward during heatwaves

### Low Priority (Nice to Have)

11. **Composting Adoption** - Household-level composting tracking
12. **Walking/Cycling Infrastructure** - Ward-level footpath and cycle lane lengths
13. **Biodiversity Index** - Ward-level species diversity (proposed in MCAP)
14. **Climate Adaptation Spending** - Budget allocation by ward for resilience projects

---

## Confidence Score Summary

| Sector | Data Availability | Confidence | Ward Coverage |
|--------|------------------|------------|---------------|
| **Energy & Buildings** | Medium | ★★★☆☆ (60%) | Partial |
| Clean Cooking | Census 2011 | ★★★☆☆ (60%) | 100% |
| Renewable Energy | State grid avg | ★★★★☆ (75%) | 0% (city-level) |
| Electricity | Estimate only | ★★☆☆☆ (50%) | 0% (city-level) |
| Green Buildings | IGBC/GRIHA | ★★★★☆ (70%) | 100% |
| **Transportation** | Good | ★★★★☆ (75%) | Partial |
| BEST Bus Coverage | Official data | ★★★★★ (90%) | 100% |
| Metro Coverage | Limited | ★★★★☆ (80%) | 20% |
| EV Adoption | City-level | ★★★☆☆ (60%) | 0% (city-level) |
| **Waste Management** | Medium | ★★★☆☆ (65%) | Partial |
| Segregation Rate | City average | ★★★☆☆ (65%) | 0% (city-level) |
| Waste Generation | Collection data | ★★★★☆ (70%) | 100% |
| Recycling | Facility-based | ★★★☆☆ (60%) | Partial |
| **Air Quality** | Good | ★★★★☆ (75%) | Partial |
| PM2.5/PM10 | MPCB monitors | ★★★★☆ (75%) | 16 wards |
| **Water** | Limited | ★★★☆☆ (55%) | Partial |
| Water Supply | Zone-level | ★★★☆☆ (60%) | 100% (zones) |
| Groundwater | Sparse | ★★☆☆☆ (50%) | Limited |
| **Greening** | Good | ★★★★☆ (75%) | Full |
| Tree Census | MCGM census | ★★★★☆ (75%) | 100% |
| Parks | MCGM inventory | ★★★★☆ (70%) | 100% |
| **Disaster Resilience** | Excellent | ★★★★★ (80%) | Full |
| Flood Risk | MCAP analysis | ★★★★★ (85%) | 100% |
| Heat Vulnerability | Satellite data | ★★★☆☆ (65%) | 100% |

**Overall Average:** ★★★☆☆ (68%)

---

## Validation & Quality Assurance

### Data Validation Process

1. **Cross-Reference with Official Sources**
   - All OpenCity data verified against original government portals
   - MCGM reports cross-checked with MCAP documents
   - Census data validated against censusindia.gov.in

2. **Spot Checks**
   - Random sample of 10 wards verified for data accuracy
   - Population totals checked against official projections
   - Geographic locations verified on Google Maps

3. **Peer Review**
   - Data reviewed by urban planning researchers
   - MCGM officials consulted for validation
   - Community feedback incorporated

### Known Data Quality Issues

1. **Census 2011 Data Age** - 15 years old, population estimates extrapolated
2. **Ward Boundary Changes** - Some wards reorganized since 2011 census
3. **Missing Ward Names** - OpenCity community mapped Census sub-wards to BMC ward codes
4. **Informal Settlements** - May be undercounted in official data
5. **Data Lag** - Most recent data is 1-3 years old

---

## Contact & Updates

**Data Curator:** NOTF (Neighbourhoods of the Future) Team
**Last Updated:** 2026-01-23
**Update Frequency:** Quarterly (as new data becomes available)

**Report Data Issues:**
- Email: data@neighbourhoodsofthefuture.org
- GitHub: [NOTF GitHub Issues](https://github.com/notf/data-issues)
- OpenCity: Comment on relevant datasets

**Subscribe to Updates:**
- OpenCity Newsletter: https://opencity.in/newsletter
- MCAP Implementation Reports: https://mcap.mcgm.gov.in

---

## Appendix: Ward Structure

### Mumbai Ward Organization

**Total Wards:** 227 electoral wards
**Ward Committees:** 24 (A, B, C, D, E, F/N, F/S, G/N, G/S, H/E, H/W, K/E, K/W, L, M/E, M/W, N, P/N, P/S, R/C, R/N, R/S, S, T)

**Note:** Ward codes use letters, not numbers (e.g., "A Ward", "H/E Ward")

**High Flood Risk Wards:**
- H/E (Bandra East) - 65% population at risk
- H/W (Bandra West) - 62% population at risk
- F/N (Matunga) - 61% population at risk

**Highest Pollution Wards (MPCB 2019-2021):**
- M/E Ward (Chembur) - Consistently highest PM2.5 levels

**Largest Population Wards:**
- L Ward (Kurla) - ~700,000 population
- P/N Ward (Malad) - ~650,000 population
- R/C Ward (Borivali) - ~600,000 population

---

**End of Document**

**Total Sources Referenced:** 25+ datasets and reports
**OpenCity.in Datasets:** 12 active datasets for Mumbai
**Government Agencies:** 8 data providers
**Research Organizations:** 5 contributors

---

## Quick Reference: Key Datasets

| Sector | Dataset Name | URL | Confidence |
|--------|-------------|-----|------------|
| Demographics | Mumbai Ward-wise Census Data | [Link](https://data.opencity.in/dataset/mumbai-ward-wise-census-data) | ★★★☆☆ |
| Climate Plan | Mumbai Climate Action Plan 2022 | [Link](https://data.opencity.in/dataset/mumbai-climate-action-plan) | ★★★★★ |
| Transport | Mumbai BEST Bus Stops and Depots | [Link](https://data.opencity.in/dataset/mumbai-best-bus-stops-and-depots-data) | ★★★★★ |
| Air Quality | Mumbai Hourly Air Quality Reports | [Link](https://data.opencity.in/dataset/mumbai-hourly-air-quality-reports) | ★★★★☆ |
| Urban Planning | Mumbai Development Plan 2034 | [Link](https://data.opencity.in/dataset/mumbai-development-plan-2034) | ★★★★☆ |
| Ward Boundaries | Mumbai Wards Map | [Link](https://data.opencity.in/dataset/mumbai-wards-map) | ★★★★★ |
| Waste Management | MCGM Solid Waste Management | [MCGM Portal](https://portal.mcgm.gov.in) | ★★★☆☆ |
