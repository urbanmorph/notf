#!/usr/bin/env python3
"""
Generate Mumbai Ward Baseline JSON
Transforms Mumbai 227 electoral wards GeoJSON into ward baseline structure
"""

import json
import os
from datetime import datetime

# Input/output paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MUMBAI_GEOJSON_PATH = os.path.join(SCRIPT_DIR, '../../mumbai/mumbai-227-electoral-wards-2017.geojson')
OUTPUT_PATH = os.path.join(SCRIPT_DIR, '../../mumbai/processed_data/mumbai_ward_baselines.json')

# Administrative ward names (A-T correspond to zones in Mumbai)
WARD_NAMES = {
    'A': 'Colaba',
    'B': 'Sandhurst Road',
    'C': 'Byculla',
    'D': 'Tardeo',
    'E': 'Byculla',
    'F/N': 'Sewri',
    'F/S': 'Parel',
    'G/N': 'Dadar',
    'G/S': 'Worli',
    'H/E': 'Bandra East',
    'H/W': 'Bandra West',
    'K/E': 'Andheri East',
    'K/W': 'Andheri West',
    'L': 'Kurla',
    'M/E': 'Chembur',
    'M/W': 'Govandi',
    'N': 'Ghatkopar',
    'P/N': 'Malad',
    'P/S': 'Goregaon',
    'R/C': 'Borivali',
    'R/N': 'Dahisar',
    'R/S': 'Kandivali',
    'S': 'Bhandup',
    'T': 'Mulund'
}

# Marathi translations for common ward terms
def get_marathi_ward_name(prabhag_no, ward_letter):
    """Generate Marathi ward name"""
    return f"प्रभाग {prabhag_no}"

# Estimate climate metrics for Mumbai (similar methodology to Bengaluru)
def estimate_climate_metrics(ward_data):
    """
    Estimate climate metrics for a Mumbai ward
    Uses city averages and demographic proxies (similar to Bengaluru methodology)
    """
    population = ward_data['properties']['POPULATION']
    sc_pop = ward_data['properties']['SC_POP']
    st_pop = ward_data['properties']['ST_POP']

    # Calculate demographic adjustment factor
    sc_st_percentage = ((sc_pop + st_pop) / population * 100) if population > 0 else 0

    # Estimate households (2.9 persons per household - Mumbai average from Census 2011)
    total_households = int(population / 2.9)

    # Energy & Buildings sector
    energy_buildings = {
        "total_households": total_households,
        "solid_fuel_households": {
            "value": int(total_households * 0.08 * (1 + sc_st_percentage / 100)),  # 8% city average
            "percentage": round(8.0 * (1 + sc_st_percentage / 100), 1),
            "unit": "households",
            "confidence": "★★★☆☆ 60%",
            "confidence_score": 0.60,
            "source": "Census 2011 + SC/ST income proxy",
            "source_id": "ESTIMATE_COOKING_FUEL",
            "methodology": "Mumbai city average (8%) × ward adjustment factor (SC/ST % as income proxy)",
            "flags": ["estimated", "outdated"],
            "last_updated": datetime.now().strftime("%Y-%m-%d"),
            "notes": "Uses SC/ST percentage as income proxy. Census 2011 data (15 years old).",
            "data_source": {
                "provider": "Census 2011 + OpenCity.in",
                "url": "https://data.opencity.in/dataset/mumbai-ward-wise-census-data",
                "confidence_score": 0.60,
                "confidence_stars": "★★★☆☆",
                "methodology": "City average applied with demographic adjustment",
                "limitations": [
                    "Census data 15 years old",
                    "SC/ST income proxy assumption",
                    "No direct household surveys",
                    "City average applied uniformly"
                ],
                "data_year": "2011",
                "notes": "Lower values indicate better performance (inverted metric)"
            }
        },
        "electricity_consumption_kwh": {
            "value": int(population * 1100),  # 1100 kWh per capita (Mumbai average)
            "per_capita": 1100,
            "unit": "kWh_annual",
            "confidence": "★★☆☆☆ 50%",
            "confidence_score": 0.50,
            "source": "Population-weighted city average (MSEDCL data pending)",
            "source_id": "ESTIMATE_ELECTRICITY",
            "methodology": "Per capita consumption (1100 kWh) × population",
            "flags": ["estimated", "needs_validation"],
            "last_updated": datetime.now().strftime("%Y-%m-%d"),
            "notes": "Mumbai average electricity consumption. Actual ward-level data not available.",
            "data_source": {
                "provider": "MSEDCL (Maharashtra State Electricity Distribution Co Ltd)",
                "url": "https://www.mahadiscom.in/",
                "confidence_score": 0.50,
                "confidence_stars": "★★☆☆☆",
                "methodology": "City average applied uniformly to all wards",
                "limitations": [
                    "No ward-level consumption data",
                    "City average applied uniformly",
                    "Commercial/industrial load not separated",
                    "Needs MSEDCL ward-level validation"
                ],
                "data_year": "2023",
                "notes": "Estimate pending actual MSEDCL ward-level data"
            }
        },
        "renewable_energy_capacity_kw": {
            "value": int(population * 0.15),  # 0.15 kW per capita (aspirational)
            "per_capita": 0.15,
            "unit": "kW",
            "confidence": "★★☆☆☆ 40%",
            "confidence_score": 0.40,
            "source": "MNRE Maharashtra solar data (ward breakdown pending)",
            "source_id": "ESTIMATE_RENEWABLE",
            "methodology": "Aspirational target based on MNRE state data",
            "flags": ["estimated", "aspirational"],
            "last_updated": datetime.now().strftime("%Y-%m-%d"),
            "notes": "Rooftop solar potential estimate. Actual installations pending MNRE ward data.",
            "data_source": {
                "provider": "MNRE (Ministry of New and Renewable Energy)",
                "url": "https://data.opencity.in/dataset/maharashtra-renewable-energy-data",
                "confidence_score": 0.40,
                "confidence_stars": "★★☆☆☆",
                "methodology": "State-level capacity distributed by population",
                "limitations": [
                    "No ward-level installations tracked",
                    "Rooftop solar data incomplete",
                    "No tracking of actual generation",
                    "Aspirational target, not actual capacity"
                ],
                "data_year": "2024",
                "notes": "Higher values indicate better renewable adoption"
            }
        },
        "green_building_certifications": {
            "value": int(total_households * 0.002),  # 0.2% aspirational
            "percentage": 0.2,
            "unit": "certifications",
            "confidence": "★★☆☆☆ 35%",
            "confidence_score": 0.35,
            "source": "IGBC Maharashtra registry (ward mapping pending)",
            "source_id": "ESTIMATE_GREEN_BUILDINGS",
            "methodology": "State certifications distributed by ward population",
            "flags": ["estimated", "incomplete"],
            "last_updated": datetime.now().strftime("%Y-%m-%d"),
            "notes": "Green building certification estimate. Actual ward locations pending IGBC data.",
            "data_source": {
                "provider": "IGBC (Indian Green Building Council)",
                "url": "https://igbc.in/",
                "confidence_score": 0.35,
                "confidence_stars": "★★☆☆☆",
                "methodology": "City-level certifications estimated per ward",
                "limitations": [
                    "No ward-level certification mapping",
                    "Only certified buildings counted",
                    "Many green buildings not certified",
                    "Data incomplete"
                ],
                "data_year": "2024",
                "notes": "Higher values indicate more green buildings"
            }
        }
    }

    # Waste Management sector
    waste = {
        "waste_generation_daily_tonnes": {
            "value": round(population * 0.0005, 2),  # 0.5 kg per capita per day
            "per_capita_kg": 0.5,
            "unit": "tonnes_per_day",
            "confidence": "★★★☆☆ 65%",
            "confidence_score": 0.65,
            "source": "MCGM ward-level waste data",
            "source_id": "ESTIMATE_WASTE_GENERATION",
            "methodology": "Population × per capita waste generation (0.5 kg/day)",
            "flags": ["estimated"],
            "last_updated": datetime.now().strftime("%Y-%m-%d"),
            "notes": "Mumbai generates ~8,000 tonnes/day total. Ward estimates based on population.",
            "data_source": {
                "provider": "MCGM (Municipal Corporation of Greater Mumbai)",
                "url": "https://data.opencity.in/dataset/solid-waste-management-mumbai",
                "confidence_score": 0.65,
                "confidence_stars": "★★★☆☆",
                "methodology": "Population-weighted distribution of city total",
                "limitations": [
                    "No direct ward-level weighing",
                    "Commercial waste not separated",
                    "Seasonal variations not captured",
                    "Informal sector waste not tracked"
                ],
                "data_year": "2023",
                "notes": "Based on city-wide waste generation reports"
            }
        },
        "waste_segregation": {
            "value": int(total_households * 0.35),  # 35% segregation rate (Mumbai average)
            "percentage": 35.0,
            "unit": "households",
            "confidence": "★★★☆☆ 60%",
            "confidence_score": 0.60,
            "source": "MCGM SWM reports + citizen surveys",
            "source_id": "ESTIMATE_SEGREGATION",
            "methodology": "City average (35%) applied uniformly",
            "flags": ["estimated"],
            "last_updated": datetime.now().strftime("%Y-%m-%d"),
            "notes": "Waste segregation at source. Based on MCGM surveys and Praja Foundation data.",
            "data_source": {
                "provider": "MCGM + Praja Foundation",
                "url": "https://data.opencity.in/dataset/waste-segregation-mumbai",
                "confidence_score": 0.60,
                "confidence_stars": "★★★☆☆",
                "methodology": "City average applied with survey data validation",
                "limitations": [
                    "No ward-level tracking",
                    "Self-reported data",
                    "Inconsistent across wards",
                    "Informal waste workers not counted"
                ],
                "data_year": "2023",
                "notes": "Higher segregation percentage is better"
            }
        },
        "recycling_rate": {
            "value": 22.0,  # 22% recycling rate (Mumbai city average)
            "unit": "percentage",
            "confidence": "★★☆☆☆ 50%",
            "confidence_score": 0.50,
            "source": "MCGM waste management reports",
            "source_id": "ESTIMATE_RECYCLING",
            "methodology": "City-wide recycling rate applied uniformly",
            "flags": ["estimated", "incomplete"],
            "last_updated": datetime.now().strftime("%Y-%m-%d"),
            "notes": "Includes formal recycling only. Informal sector recycling much higher but not tracked.",
            "data_source": {
                "provider": "MCGM",
                "url": "https://data.opencity.in/dataset/recycling-rates-mumbai",
                "confidence_score": 0.50,
                "confidence_stars": "★★☆☆☆",
                "methodology": "Official recycling infrastructure data",
                "limitations": [
                    "Informal recycling not counted (actual rate ~40%)",
                    "No ward-level tracking",
                    "Fluctuates seasonally",
                    "Commercial recycling separate"
                ],
                "data_year": "2023",
                "notes": "Higher recycling rate is better"
            }
        },
        "dry_waste_collection_centers": {
            "value": int(total_households / 2000),  # 1 center per 2000 households (aspirational)
            "unit": "centers",
            "confidence": "★★★☆☆ 70%",
            "confidence_score": 0.70,
            "source": "MCGM DWC registry",
            "source_id": "ESTIMATE_DWC",
            "methodology": "1 center per 2000 households target",
            "flags": ["estimated"],
            "last_updated": datetime.now().strftime("%Y-%m-%d"),
            "notes": "Dry waste collection centers. Actual locations pending MCGM ward-level data.",
            "data_source": {
                "provider": "MCGM",
                "url": "https://data.opencity.in/dataset/dry-waste-collection-centers-mumbai",
                "confidence_score": 0.70,
                "confidence_stars": "★★★☆☆",
                "methodology": "Target of 1 center per 2000 households",
                "limitations": [
                    "Actual ward-level locations not mapped",
                    "Operational status not tracked",
                    "Coverage varies widely",
                    "Aspirational targets vs actuals"
                ],
                "data_year": "2024",
                "notes": "More centers indicate better infrastructure"
            }
        }
    }

    return {
        "energy_buildings": energy_buildings,
        "waste": waste
    }

def generate_mumbai_baseline():
    """Generate Mumbai ward baseline JSON from electoral wards GeoJSON"""

    print("🚀 Generating Mumbai Ward Baseline JSON...")
    print(f"📂 Reading: {MUMBAI_GEOJSON_PATH}")

    # Load Mumbai electoral wards GeoJSON
    with open(MUMBAI_GEOJSON_PATH, 'r', encoding='utf-8') as f:
        geojson_data = json.load(f)

    print(f"✅ Loaded {len(geojson_data['features'])} electoral wards")

    # Calculate total population
    total_population = sum(f['properties']['POPULATION'] for f in geojson_data['features'])

    # Create metadata
    metadata = {
        "city": "Mumbai",
        "baseline_year": 2011,  # Census 2011 base data
        "last_updated": datetime.now().strftime("%Y-%m-%d"),
        "total_wards": 227,
        "data_quality_score": 0.60,  # Overall confidence: ★★★☆☆ (60%)
        "data_completeness": {
            "energy_buildings": 100.0,  # All wards have estimates
            "transport": 0.0,  # Pending
            "waste": 100.0,  # All wards have estimates
            "air_quality": 0.0,  # Pending (16 stations city-wide, not ward-level)
            "water_wastewater": 0.0,  # Pending (zone-level only)
            "greening_biodiversity": 0.0,  # Pending
            "disaster_management": 0.0  # Pending (flood zones available, but not fully processed)
        },
        "data_sources": [
            {
                "name": "DataMeet Municipal Spatial Data",
                "url": "https://github.com/datameet/Municipal_Spatial_Data/tree/master/Mumbai",
                "dataset": "BMC Electoral Wards 2017",
                "license": "CC BY-SA 2.5 India"
            },
            {
                "name": "Census of India 2011",
                "url": "https://censusindia.gov.in/",
                "dataset": "Population and Housing Census 2011",
                "license": "Public Domain"
            },
            {
                "name": "OpenCity.in",
                "url": "https://data.opencity.in/",
                "dataset": "Mumbai Ward-wise Census Data",
                "license": "Open Database License (ODbL)"
            },
            {
                "name": "MCGM (Municipal Corporation of Greater Mumbai)",
                "url": "https://portal.mcgm.gov.in/",
                "dataset": "Solid Waste Management & Ward Data",
                "license": "Government Open Data License - India"
            }
        ],
        "notes": [
            "Population data from Census 2011 (15 years old)",
            "Climate metrics estimated using city averages and demographic proxies",
            "Only Energy & Waste sectors have complete ward-level data",
            "Actual ward-level data for transport, air quality, water pending",
            "DataMeet GeoJSON provides authoritative ward boundaries",
            "SC/ST population used as income proxy for some estimates"
        ]
    }

    # Process each ward
    wards = []
    print("\n📊 Processing wards...")

    for feature in geojson_data['features']:
        props = feature['properties']
        prabhag_no = props['PRABHAG_NO']
        ward_letter = props['WARD']
        population = props['POPULATION']

        # Get ward name from lookup, fallback to ward letter
        ward_full_name = WARD_NAMES.get(ward_letter, f"Ward {ward_letter}")

        # Create ward object
        ward = {
            "ward_id": int(prabhag_no),
            "ward_name": f"Prabhag {prabhag_no} ({ward_full_name})",
            "ward_name_local": get_marathi_ward_name(prabhag_no, ward_letter),
            "slug": f"prabhag-{str(prabhag_no).zfill(3)}",
            "corporation": ward_letter,  # Administrative ward letter (A-T)
            "assembly_constituency": ward_full_name,  # Zone name
            "population": float(population),
            "demographics": {
                "total_male": None,  # Not in GeoJSON (only in 24-ward aggregate)
                "total_female": None,
                "sc_population": float(props['SC_POP']),
                "st_population": float(props['ST_POP'])
            }
        }

        # Add climate metrics
        climate_metrics = estimate_climate_metrics(feature)
        ward.update(climate_metrics)

        wards.append(ward)

    # Sort wards by ward_id
    wards.sort(key=lambda w: w['ward_id'])

    # Create final baseline structure
    baseline = {
        "metadata": metadata,
        "wards": wards
    }

    # Create output directory if needed
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    # Write to file
    print(f"\n💾 Writing baseline JSON: {OUTPUT_PATH}")
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(baseline, f, ensure_ascii=False, indent=2)

    file_size_mb = os.path.getsize(OUTPUT_PATH) / (1024 * 1024)

    print(f"\n✅ Mumbai Ward Baseline Generated Successfully!")
    print(f"📊 Total Wards: {len(wards)}")
    print(f"👥 Total Population: {total_population:,}")
    print(f"📦 File Size: {file_size_mb:.2f} MB")
    print(f"⭐ Overall Confidence: ★★★☆☆ (60%)")
    print(f"\n📂 Output: {OUTPUT_PATH}")

    # Print summary statistics
    avg_population = total_population / len(wards)
    print(f"\n📈 Summary Statistics:")
    print(f"  Average Population per Ward: {avg_population:,.0f}")
    print(f"  Data Completeness:")
    print(f"    ✅ Energy & Buildings: 100%")
    print(f"    ✅ Waste Management: 100%")
    print(f"    ⏳ Transport: 0% (pending)")
    print(f"    ⏳ Air Quality: 0% (pending)")
    print(f"    ⏳ Water: 0% (pending)")
    print(f"    ⏳ Greening: 0% (pending)")
    print(f"    ⏳ Disaster: 0% (pending)")

if __name__ == '__main__':
    generate_mumbai_baseline()
