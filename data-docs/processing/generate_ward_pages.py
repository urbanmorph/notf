#!/usr/bin/env python3
"""
Generate static HTML pages for all ward × sector combinations.

Output: 2,583 HTML files (369 wards × 7 sectors)
Location: /cities/bengaluru/climate/{sector}/wards/{ward-slug}/index.html

Author: NOTF Data Team
Date: 2026-01-23
"""

import json
import os
from pathlib import Path
from jinja2 import Template

# Sector definitions
SECTORS = [
    {
        'slug': 'energy',
        'title': 'Energy & Buildings',
        'color': '#F5B82E',
        'icon': 'fa-solid fa-bolt',
        'icon_brand': 'energy-climate.svg',
        'data_key': 'energy_buildings',
        'metrics': [
            {
                'key': 'solid_fuel_households',
                'name': 'Clean Cooking',
                'icon': 'fa-solid fa-fire',
                'unit': '%',
                'path': 'percentage',
                'inverted': True  # Lower is better
            },
            {
                'key': 'renewable_energy_share',
                'name': 'Renewable Energy',
                'icon': 'fa-solid fa-solar-panel',
                'unit': '%',
                'path': 'percentage',
                'inverted': False
            },
            {
                'key': 'electricity_consumption_kwh',
                'name': 'Electricity Use',
                'icon': 'fa-solid fa-gauge',
                'unit': ' kWh/capita',
                'path': 'per_capita',
                'inverted': True  # Lower is better
            },
            {
                'key': 'green_buildings',
                'name': 'Green Buildings',
                'icon': 'fa-solid fa-building',
                'unit': ' certified',
                'path': 'count',
                'inverted': False
            }
        ]
    },
    {
        'slug': 'transportation',
        'title': 'Transportation',
        'color': '#3F5F7A',
        'icon': 'fa-solid fa-bus',
        'icon_brand': 'mobility.svg',
        'data_key': 'transport',
        'metrics': [
            {
                'key': 'public_transport_share',
                'name': 'Public Transport',
                'icon': 'fa-solid fa-bus',
                'unit': '%',
                'path': 'percentage',
                'inverted': False
            },
            {
                'key': 'ev_vehicles',
                'name': 'EV Vehicles',
                'icon': 'fa-solid fa-car-battery',
                'unit': ' vehicles',
                'path': 'count',
                'inverted': False
            },
            {
                'key': 'cycling_infrastructure_km',
                'name': 'Cycling Lanes',
                'icon': 'fa-solid fa-bicycle',
                'unit': ' km',
                'path': 'value',
                'inverted': False
            }
        ]
    },
    {
        'slug': 'waste',
        'title': 'Waste Management',
        'color': '#B9C98A',
        'icon': 'fa-solid fa-recycle',
        'icon_brand': 'waste-circular.svg',
        'data_key': 'waste',
        'metrics': [
            {
                'key': 'segregation_rate',
                'name': 'Waste Segregation',
                'icon': 'fa-solid fa-trash-can',
                'unit': '%',
                'path': 'percentage',
                'inverted': False
            },
            {
                'key': 'waste_generation_kg_per_capita',
                'name': 'Waste Per Capita',
                'icon': 'fa-solid fa-weight-scale',
                'unit': ' kg/day',
                'path': 'value',
                'inverted': True  # Lower is better
            },
            {
                'key': 'recycling_rate',
                'name': 'Recycling Rate',
                'icon': 'fa-solid fa-recycle',
                'unit': '%',
                'path': 'percentage',
                'inverted': False
            }
        ]
    },
    {
        'slug': 'air-quality',
        'title': 'Air Quality',
        'color': '#C45A2A',
        'icon': 'fa-solid fa-wind',
        'icon_brand': None,  # no brand SVG for air quality — keep FA
        'data_key': 'air_quality',
        'metrics': [
            {
                'key': 'pm25_annual',
                'name': 'PM2.5 Levels',
                'icon': 'fa-solid fa-smog',
                'unit': ' μg/m³',
                'path': 'value',
                'inverted': True  # Lower is better
            },
            {
                'key': 'pm10_annual',
                'name': 'PM10 Levels',
                'icon': 'fa-solid fa-smog',
                'unit': ' μg/m³',
                'path': 'value',
                'inverted': True  # Lower is better
            },
            {
                'key': 'no2_annual',
                'name': 'NO2 Levels',
                'icon': 'fa-solid fa-wind',
                'unit': ' μg/m³',
                'path': 'value',
                'inverted': True  # Lower is better
            }
        ]
    },
    {
        'slug': 'water',
        'title': 'Water Resources',
        'color': '#3F5F7A',
        'icon': 'fa-solid fa-droplet',
        'icon_brand': 'water-ecology.svg',
        'data_key': 'water',
        'metrics': [
            {
                'key': 'water_consumption_lpcd',
                'name': 'Water Consumption',
                'icon': 'fa-solid fa-faucet',
                'unit': ' L/capita/day',
                'path': 'value',
                'inverted': True  # Lower is better
            },
            {
                'key': 'groundwater_dependence',
                'name': 'Groundwater Use',
                'icon': 'fa-solid fa-water',
                'unit': '%',
                'path': 'percentage',
                'inverted': True  # Lower is better
            },
            {
                'key': 'rainwater_harvesting',
                'name': 'Rainwater Harvesting',
                'icon': 'fa-solid fa-cloud-rain',
                'unit': '%',
                'path': 'percentage',
                'inverted': False
            }
        ]
    },
    {
        'slug': 'greening',
        'title': 'Urban Greening',
        'color': '#2F4A2C',
        'icon': 'fa-solid fa-tree',
        'icon_brand': 'plant.svg',
        'data_key': 'greening',
        'metrics': [
            {
                'key': 'tree_cover',
                'name': 'Tree Cover',
                'icon': 'fa-solid fa-tree',
                'unit': '%',
                'path': 'percentage',
                'inverted': False
            },
            {
                'key': 'green_space_sqm_per_capita',
                'name': 'Green Space',
                'icon': 'fa-solid fa-leaf',
                'unit': ' m²/capita',
                'path': 'value',
                'inverted': False
            },
            {
                'key': 'parks',
                'name': 'Parks',
                'icon': 'fa-solid fa-tree-city',
                'unit': ' parks',
                'path': 'count',
                'inverted': False
            }
        ]
    },
    {
        'slug': 'disaster',
        'title': 'Disaster Preparedness',
        'color': '#2B2B2B',
        'icon': 'fa-solid fa-shield-halved',
        'icon_brand': None,  # no brand SVG for disaster — keep FA
        'data_key': 'disaster',
        'metrics': [
            {
                'key': 'flood_risk',
                'name': 'Flood Risk',
                'icon': 'fa-solid fa-house-flood-water',
                'unit': '%',
                'path': 'percentage',
                'inverted': True  # Lower is better
            },
            {
                'key': 'heat_vulnerability_index',
                'name': 'Heat Vulnerability',
                'icon': 'fa-solid fa-temperature-high',
                'unit': '',
                'path': 'value',
                'inverted': True  # Lower is better
            },
            {
                'key': 'disaster_preparedness_score',
                'name': 'Preparedness Score',
                'icon': 'fa-solid fa-shield-halved',
                'unit': '/10',
                'path': 'value',
                'inverted': False
            }
        ]
    }
]


def load_template():
    """Load Jinja2 template."""
    template_path = Path(__file__).parent / 'ward_page_template.html'
    with open(template_path, 'r', encoding='utf-8') as f:
        return Template(f.read())


def load_corporation_data(data_dir):
    """Load all corporation JSON files."""
    corporations = {}
    for corp in ['central', 'east', 'west', 'north', 'south']:
        file_path = data_dir / f'climate_{corp}.json'
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            corporations[corp.capitalize()] = data['wards']
    return corporations


def load_city_summary(data_dir):
    """Load city summary for rankings."""
    with open(data_dir / 'city_climate.json', 'r', encoding='utf-8') as f:
        return json.load(f)


def safe_get_metric(ward, sector_key, metric_key, value_path):
    """Safely extract metric value from ward data."""
    try:
        sector = ward.get(sector_key, {})
        metric = sector.get(metric_key, {})

        if isinstance(metric, dict):
            value = metric.get(value_path)
            confidence = metric.get('confidence', 'Unknown')
            source = metric.get('source', 'Data pending')
            data_source = metric.get('data_source', None)  # Get source metadata
            return value, confidence, source, data_source
        return None, 'Unknown', 'Data pending', None
    except Exception:
        return None, 'Unknown', 'Data pending', None


def calculate_rank(ward_value, all_values, inverted=False):
    """Calculate ward rank (1 = best)."""
    if ward_value is None:
        return 369  # Last place if no data

    sorted_vals = sorted([v for v in all_values if v is not None], reverse=not inverted)
    try:
        return sorted_vals.index(ward_value) + 1
    except ValueError:
        return 369


def get_progress_status(value, inverted=False):
    """Determine progress bar color status."""
    if value is None:
        return 'low'

    if inverted:
        # Lower is better (e.g., pollution, waste)
        if value < 30:
            return 'high'
        elif value < 70:
            return 'medium'
        else:
            return 'low'
    else:
        # Higher is better (e.g., renewable energy, recycling)
        if value >= 70:
            return 'high'
        elif value >= 30:
            return 'medium'
        else:
            return 'low'


def number_format(value):
    """Format number with commas."""
    if value is None:
        return '0'
    return f'{int(value):,}'


def generate_ward_page(ward, sector, all_wards, template, output_dir):
    """Generate a single ward page for a specific sector."""
    sector_data = ward.get(sector['data_key'], {})

    if not sector_data:
        return None  # Skip if no data for this sector

    # Extract metrics
    metrics = []
    for metric_def in sector['metrics']:
        value, confidence, source, data_source = safe_get_metric(
            ward, sector['data_key'], metric_def['key'], metric_def['path']
        )

        if value is None:
            continue  # Skip missing metrics

        # Collect all ward values for ranking
        all_values = []
        for w in all_wards:
            v, _, _, _ = safe_get_metric(w, sector['data_key'], metric_def['key'], metric_def['path'])
            if v is not None:
                all_values.append(v)

        # Calculate city average
        city_avg = sum(all_values) / len(all_values) if all_values else 0

        # Calculate rank
        rank = calculate_rank(value, all_values, metric_def['inverted'])

        # Calculate % difference
        if city_avg > 0:
            diff = ((value - city_avg) / city_avg) * 100
            if metric_def['inverted']:
                diff = -diff  # Invert so positive is good
        else:
            diff = 0

        # Determine progress status
        status = get_progress_status(value, metric_def['inverted'])

        # Normalize to 0-100% for progress bar
        if all_values:
            if metric_def['inverted']:
                max_val = max(all_values)
                percentage = ((max_val - value) / max_val) * 100 if max_val > 0 else 0
            else:
                max_val = max(all_values)
                percentage = (value / max_val) * 100 if max_val > 0 else 0
        else:
            percentage = 0

        metrics.append({
            'key': metric_def['key'],  # Add key for source toggle ID
            'name': metric_def['name'],
            'icon': metric_def['icon'],
            'value': round(value, 1),
            'unit': metric_def['unit'],
            'city_avg': round(city_avg, 1),
            'difference': round(diff, 1),
            'rank': rank,
            'percentage': min(100, max(0, percentage)),
            'status': status,
            'confidence': confidence,
            'source': source,
            'data_source': data_source  # Add source metadata
        })

    if not metrics:
        return None  # Skip if no valid metrics

    # Render template
    html = template.render(
        ward_name=ward['ward_name'],
        ward_name_local=ward['ward_name_local'],
        ward_slug=ward['slug'],
        corporation=ward['corporation'],
        population=number_format(ward.get('population', 0)),
        households=number_format(sector_data.get('total_households', 0)),
        sector_title=sector['title'],
        sector_slug=sector['slug'],
        sector_color=sector['color'],
        metrics=metrics,
        all_sectors=SECTORS,
        number_format=number_format,
        abs=abs
    )

    # Write file
    output_path = output_dir / sector['slug'] / 'wards' / ward['slug'] / 'index.html'
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

    return output_path


def main():
    # Paths
    base_dir = Path(__file__).parent.parent.parent
    data_dir = base_dir.parent / 'website' / 'public' / 'assets' / 'data' / 'climate' / 'bengaluru'
    output_dir = base_dir.parent / 'website' / 'public' / 'cities' / 'bengaluru' / 'climate'

    # Load data
    print("Loading data...")
    template = load_template()
    corporations = load_corporation_data(data_dir)
    city_summary = load_city_summary(data_dir)

    # Flatten all wards
    all_wards = []
    for corp_name, wards in corporations.items():
        all_wards.extend(wards)

    print(f"✓ Loaded {len(all_wards)} wards from {len(corporations)} corporations")

    # Generate pages
    print(f"\nGenerating ward pages for {len(SECTORS)} sectors...")
    total_generated = 0

    for sector in SECTORS:
        print(f"  Processing {sector['title']}...")
        sector_count = 0

        for ward in all_wards:
            output_path = generate_ward_page(ward, sector, all_wards, template, output_dir)
            if output_path:
                sector_count += 1
                total_generated += 1

        print(f"    ✓ Generated {sector_count} ward pages")

    print(f"\n✓ Complete! Generated {total_generated} HTML pages")
    print(f"  Expected: {len(all_wards)} wards × {len(SECTORS)} sectors = {len(all_wards) * len(SECTORS)} pages")


if __name__ == '__main__':
    main()
