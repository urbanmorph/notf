#!/usr/bin/env python3
"""
Generate city-level summary statistics for climate dashboard.

Input: bengaluru_ward_baselines.json
Output: city_climate.json (8 KB - city aggregates, top/bottom wards, distribution)

Author: NOTF Data Team
Date: 2026-01-23
"""

import json
import statistics
from pathlib import Path
from collections import defaultdict


def generate_slug(ward_name):
    """Generate URL-friendly slug from ward name."""
    slug = ward_name.lower()
    slug = slug.replace(' ', '-').replace(',', '').replace('.', '').replace('(', '').replace(')', '')
    slug = slug.replace('/', '-').replace('&', 'and').replace("'", '')
    return slug


def safe_get_value(obj, default=0):
    """Safely extract numeric value from metric object."""
    if obj is None:
        return default
    if isinstance(obj, dict):
        val = obj.get('value') or obj.get('percentage')
        return val if val is not None else default
    return obj


def calculate_metric_stats(wards, sector, metric_path):
    """Calculate statistics for a specific metric across all wards."""
    values = []
    ward_values = []

    for ward in wards:
        # Navigate metric path (e.g., "energy_buildings.solid_fuel_households.percentage")
        obj = ward
        for key in sector.split('.') + metric_path.split('.'):
            obj = obj.get(key, {}) if isinstance(obj, dict) else {}

        val = safe_get_value(obj)
        if val is not None and val > 0:
            values.append(val)
            ward_values.append({
                'name': ward['ward_name'],
                'slug': generate_slug(ward['ward_name']),
                'corporation': ward['corporation'],
                'value': val
            })

    if not values:
        return None

    # Calculate distribution (high/medium/low)
    distribution = {
        'high': sum(1 for v in values if v >= 71),  # 71-100%
        'medium': sum(1 for v in values if 31 <= v < 71),  # 31-70%
        'low': sum(1 for v in values if v < 31)  # 0-30%
    }

    # Sort wards by value
    ward_values.sort(key=lambda x: x['value'], reverse=True)

    return {
        'average': round(statistics.mean(values), 1),
        'median': round(statistics.median(values), 1),
        'min': round(min(values), 1),
        'max': round(max(values), 1),
        'distribution': distribution,
        'top_5': ward_values[:5],
        'bottom_5': ward_values[-5:][::-1]  # Reverse to show lowest first
    }


def calculate_sector_summary(wards, sector_name, metrics):
    """Calculate summary for a specific sector."""
    sector_data = {}

    for metric_key, metric_path in metrics.items():
        stats = calculate_metric_stats(wards, sector_name, metric_path)
        if stats:
            sector_data[metric_key] = stats

    return sector_data


def main():
    # Paths
    base_dir = Path(__file__).parent.parent.parent
    source_file = base_dir / 'bengaluru' / 'processed_data' / 'bengaluru_ward_baselines.json'
    output_dir = base_dir.parent / 'website' / 'public' / 'assets' / 'data' / 'climate' / 'bengaluru'
    output_file = output_dir / 'city_climate.json'

    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)

    # Load source data
    print(f"Loading source data from {source_file}...")
    with open(source_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    wards = data['wards']
    print(f"✓ Loaded {len(wards)} wards")

    # Define metrics to track per sector
    sector_metrics = {
        'energy_buildings': {
            'clean_cooking': 'solid_fuel_households.percentage',
            'renewable_energy': 'renewable_energy_share.percentage',
            'electricity_consumption': 'electricity_consumption_kwh.per_capita',
            'green_buildings': 'green_buildings.count'
        },
        'transport': {
            'public_transport_share': 'public_transport_share.percentage',
            'ev_vehicles': 'ev_vehicles.count',
            'cycling_infrastructure': 'cycling_infrastructure_km.value'
        },
        'waste': {
            'waste_segregation': 'segregation_rate.percentage',
            'waste_per_capita': 'waste_generation_kg_per_capita.value',
            'recycling_rate': 'recycling_rate.percentage'
        },
        'air_quality': {
            'pm25': 'pm25_annual.value',
            'pm10': 'pm10_annual.value',
            'no2': 'no2_annual.value'
        },
        'water': {
            'water_consumption': 'water_consumption_lpcd.value',
            'groundwater_dependence': 'groundwater_dependence.percentage',
            'rainwater_harvesting': 'rainwater_harvesting.percentage'
        },
        'greening': {
            'tree_cover': 'tree_cover.percentage',
            'green_space_per_capita': 'green_space_sqm_per_capita.value',
            'parks_count': 'parks.count'
        },
        'disaster': {
            'flood_prone': 'flood_risk.percentage',
            'heat_vulnerability': 'heat_vulnerability_index.value',
            'disaster_preparedness': 'disaster_preparedness_score.value'
        }
    }

    # Calculate city summary
    print("\nCalculating city-level statistics...")
    city_summary = {
        'city': 'Bengaluru',
        'total_wards': len(wards),
        'total_population': sum(int(w.get('population', 0)) for w in wards),
        'last_updated': '2026-01-23',
        'sectors': {}
    }

    for sector, metrics in sector_metrics.items():
        print(f"  Processing {sector}...")
        sector_summary = calculate_sector_summary(wards, sector, metrics)
        if sector_summary:
            city_summary['sectors'][sector] = sector_summary

    # Calculate corporation-level averages
    print("\nCalculating corporation-level statistics...")
    corporations = defaultdict(list)
    for ward in wards:
        corporations[ward['corporation']].append(ward)

    city_summary['corporations'] = {}
    for corp, corp_wards in corporations.items():
        city_summary['corporations'][corp] = {
            'ward_count': len(corp_wards),
            'population': sum(int(w.get('population', 0)) for w in corp_wards)
        }

    # Save city summary
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(city_summary, f, ensure_ascii=False, indent=2)

    file_size = output_file.stat().st_size / 1024  # KB
    print(f"\n✓ Saved city summary: {file_size:.1f} KB → {output_file}")

    # Print summary
    print(f"\nCity Summary:")
    print(f"  Total Wards: {city_summary['total_wards']}")
    print(f"  Total Population: {city_summary['total_population']:,}")
    print(f"  Sectors Analyzed: {len(city_summary['sectors'])}")

    print(f"\n✓ Complete!")


if __name__ == '__main__':
    main()
