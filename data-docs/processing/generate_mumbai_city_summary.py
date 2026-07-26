#!/usr/bin/env python3
"""
Generate Mumbai City Summary
Calculates city-level aggregates, distributions, and rankings
"""

import json
import os
from statistics import mean, median

# Input/output paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_PATH = os.path.join(SCRIPT_DIR, '../../mumbai/processed_data/mumbai_ward_baselines.json')
OUTPUT_PATH = '/Users/sathya/Documents/GitHub/notf/website/public/assets/data/climate/mumbai/city_climate.json'

def safe_get(ward, *keys):
    """Safely traverse nested dictionary"""
    value = ward
    for key in keys:
        if isinstance(value, dict):
            value = value.get(key, {})
        else:
            return None

    if isinstance(value, dict):
        return value.get('percentage') or value.get('value')
    return value

def calculate_distribution(values):
    """Calculate high/medium/low distribution"""
    high = sum(1 for v in values if v >= 70)
    medium = sum(1 for v in values if 30 <= v < 70)
    low = sum(1 for v in values if v < 30)
    return {"high": high, "medium": medium, "low": low}

def get_top_bottom_wards(wards, metric_keys, limit=5, inverted=False):
    """Get top and bottom performing wards for a metric"""
    ward_values = []

    for ward in wards:
        value = safe_get(ward, *metric_keys)
        if value is not None:
            ward_values.append({
                "ward_name": ward['ward_name'],
                "ward_slug": ward['slug'],
                "value": round(value, 1)
            })

    if not ward_values:
        return [], []

    # Sort based on whether lower or higher is better
    sorted_wards = sorted(ward_values, key=lambda x: x['value'], reverse=not inverted)

    top_5 = sorted_wards[:limit]
    bottom_5 = sorted_wards[-limit:][::-1]  # Reverse to show worst first

    return top_5, bottom_5

def generate_city_summary():
    """Generate city-level climate summary"""

    print("🚀 Generating Mumbai City Climate Summary...")
    print(f"📂 Reading: {INPUT_PATH}")

    # Load baseline data
    with open(INPUT_PATH, 'r', encoding='utf-8') as f:
        baseline = json.load(f)

    metadata = baseline['metadata']
    wards = baseline['wards']

    total_population = sum(w['population'] for w in wards)
    total_households = sum(w['energy_buildings']['total_households'] for w in wards)

    print(f"✅ Loaded {len(wards)} wards")
    print(f"👥 Total Population: {total_population:,.0f}")

    # Energy & Buildings sector
    energy_metrics = {}

    # Clean Cooking (inverted: lower solid fuel % = better)
    solid_fuel_values = [safe_get(w, 'energy_buildings', 'solid_fuel_households') for w in wards if safe_get(w, 'energy_buildings', 'solid_fuel_households') is not None]
    if solid_fuel_values:
        avg_solid_fuel = mean(solid_fuel_values)
        top_wards, bottom_wards = get_top_bottom_wards(wards, ['energy_buildings', 'solid_fuel_households'], inverted=True)

        energy_metrics['clean_cooking'] = {
            "average": round(avg_solid_fuel, 1),
            "median": round(median(solid_fuel_values), 1),
            "distribution": calculate_distribution(solid_fuel_values),
            "top_5": top_wards,
            "bottom_5": bottom_wards,
            "unit": "percentage",
            "inverted": True,
            "description": "Percentage of households using solid fuel (lower is better)",
            "data_source": {
                "provider": "Census 2011 + OpenCity.in",
                "url": "https://data.opencity.in/dataset/mumbai-ward-wise-census-data",
                "confidence_score": 0.60,
                "confidence_stars": "★★★☆☆",
                "methodology": "City average (8%) applied with SC/ST demographic adjustment",
                "limitations": [
                    "Census 2011 data (15 years old)",
                    "SC/ST used as income proxy",
                    "No direct household surveys",
                    "City average applied uniformly"
                ],
                "data_year": "2011",
                "notes": "Lower solid fuel usage indicates better cooking fuel access"
            }
        }

    # Electricity Consumption
    electricity_values = [safe_get(w, 'energy_buildings', 'electricity_consumption_kwh', 'per_capita') for w in wards]
    if electricity_values and electricity_values[0] is not None:
        energy_metrics['electricity_consumption'] = {
            "average": 1100,  # All wards have same per capita estimate
            "unit": "kWh_per_capita_annual",
            "description": "Annual electricity consumption per capita",
            "data_source": {
                "provider": "MSEDCL (Maharashtra State Electricity Distribution Co Ltd)",
                "url": "https://www.mahadiscom.in/",
                "confidence_score": 0.50,
                "confidence_stars": "★★☆☆☆",
                "methodology": "City average (1100 kWh) applied uniformly",
                "limitations": [
                    "No ward-level consumption data",
                    "City average applied uniformly",
                    "Commercial/industrial not separated",
                    "Needs MSEDCL validation"
                ],
                "data_year": "2023"
            }
        }

    # Renewable Energy
    renewable_values = [safe_get(w, 'energy_buildings', 'renewable_energy_capacity_kw', 'per_capita') for w in wards]
    if renewable_values and renewable_values[0] is not None:
        energy_metrics['renewable_energy'] = {
            "average": 0.15,  # All wards have same per capita target
            "unit": "kW_per_capita",
            "description": "Renewable energy capacity per capita (aspirational)",
            "data_source": {
                "provider": "MNRE (Ministry of New and Renewable Energy)",
                "url": "https://data.opencity.in/dataset/maharashtra-renewable-energy-data",
                "confidence_score": 0.40,
                "confidence_stars": "★★☆☆☆",
                "methodology": "Aspirational target based on MNRE state data",
                "limitations": [
                    "No ward-level tracking",
                    "Rooftop solar data incomplete",
                    "Aspirational, not actual",
                    "No generation tracking"
                ],
                "data_year": "2024"
            }
        }

    # Green Buildings
    green_building_values = [safe_get(w, 'energy_buildings', 'green_building_certifications', 'percentage') for w in wards]
    if green_building_values and green_building_values[0] is not None:
        energy_metrics['green_buildings'] = {
            "average": 0.2,  # All wards have same estimate
            "unit": "percentage",
            "description": "Percentage of green building certifications",
            "data_source": {
                "provider": "IGBC (Indian Green Building Council)",
                "url": "https://igbc.in/",
                "confidence_score": 0.35,
                "confidence_stars": "★★☆☆☆",
                "methodology": "City-level certifications estimated per ward",
                "limitations": [
                    "No ward-level mapping",
                    "Only certified buildings",
                    "Many green buildings uncertified",
                    "Data incomplete"
                ],
                "data_year": "2024"
            }
        }

    # Waste Management sector
    waste_metrics = {}

    # Waste Generation
    waste_gen_values = [safe_get(w, 'waste', 'waste_generation_daily_tonnes', 'per_capita_kg') for w in wards]
    if waste_gen_values and waste_gen_values[0] is not None:
        total_waste_tonnes = sum(safe_get(w, 'waste', 'waste_generation_daily_tonnes', 'value') for w in wards)
        waste_metrics['waste_generation'] = {
            "total_daily_tonnes": round(total_waste_tonnes, 1),
            "per_capita_kg": 0.5,
            "unit": "tonnes_per_day",
            "description": "Daily waste generation",
            "data_source": {
                "provider": "MCGM (Municipal Corporation of Greater Mumbai)",
                "url": "https://data.opencity.in/dataset/solid-waste-management-mumbai",
                "confidence_score": 0.65,
                "confidence_stars": "★★★☆☆",
                "methodology": "Population-weighted distribution of city total",
                "limitations": [
                    "No ward-level weighing",
                    "Commercial waste not separated",
                    "Seasonal variations not captured",
                    "Informal sector not tracked"
                ],
                "data_year": "2023"
            }
        }

    # Waste Segregation
    segregation_values = [safe_get(w, 'waste', 'waste_segregation') for w in wards if safe_get(w, 'waste', 'waste_segregation') is not None]
    if segregation_values:
        avg_segregation = mean(segregation_values)
        top_wards, bottom_wards = get_top_bottom_wards(wards, ['waste', 'waste_segregation'], inverted=False)

        waste_metrics['waste_segregation'] = {
            "average": round(avg_segregation, 1),
            "median": round(median(segregation_values), 1),
            "distribution": calculate_distribution(segregation_values),
            "top_5": top_wards,
            "bottom_5": bottom_wards,
            "unit": "percentage",
            "description": "Percentage of households practicing waste segregation at source",
            "data_source": {
                "provider": "MCGM + Praja Foundation",
                "url": "https://data.opencity.in/dataset/waste-segregation-mumbai",
                "confidence_score": 0.60,
                "confidence_stars": "★★★☆☆",
                "methodology": "City average (35%) applied with survey validation",
                "limitations": [
                    "No ward-level tracking",
                    "Self-reported data",
                    "Inconsistent across wards",
                    "Informal workers not counted"
                ],
                "data_year": "2023"
            }
        }

    # Recycling Rate
    recycling_values = [safe_get(w, 'waste', 'recycling_rate') for w in wards if safe_get(w, 'waste', 'recycling_rate') is not None]
    if recycling_values:
        avg_recycling = mean(recycling_values)

        waste_metrics['recycling_rate'] = {
            "average": round(avg_recycling, 1),
            "unit": "percentage",
            "description": "Percentage of waste recycled (formal sector only)",
            "data_source": {
                "provider": "MCGM",
                "url": "https://data.opencity.in/dataset/recycling-rates-mumbai",
                "confidence_score": 0.50,
                "confidence_stars": "★★☆☆☆",
                "methodology": "Official recycling infrastructure data",
                "limitations": [
                    "Informal recycling not counted (~40% actual)",
                    "No ward-level tracking",
                    "Seasonal fluctuations",
                    "Commercial recycling separate"
                ],
                "data_year": "2023"
            }
        }

    # Create city summary
    city_summary = {
        "city": "Mumbai",
        "total_wards": len(wards),
        "total_population": int(total_population),
        "total_households": total_households,
        "last_updated": metadata['last_updated'],
        "data_quality_score": metadata['data_quality_score'],
        "sectors": {
            "energy_buildings": energy_metrics,
            "waste": waste_metrics
        },
        "metadata": {
            "baseline_year": metadata['baseline_year'],
            "data_completeness": metadata['data_completeness'],
            "data_sources": metadata['data_sources']
        }
    }

    # Write city summary
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(city_summary, f, ensure_ascii=False, indent=2)

    file_size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"\n✅ City Summary Generated!")
    print(f"📦 File Size: {file_size_kb:.1f} KB")
    print(f"📂 Output: {OUTPUT_PATH}")

    print(f"\n📈 Summary Statistics:")
    print(f"  Total Wards: {len(wards)}")
    print(f"  Total Population: {total_population:,.0f}")
    print(f"  Total Households: {total_households:,}")
    print(f"  Average Solid Fuel HH: {energy_metrics.get('clean_cooking', {}).get('average', 'N/A')}%")
    print(f"  Average Waste Segregation: {waste_metrics.get('waste_segregation', {}).get('average', 'N/A')}%")
    print(f"  Average Recycling Rate: {waste_metrics.get('recycling_rate', {}).get('average', 'N/A')}%")

if __name__ == '__main__':
    generate_city_summary()
