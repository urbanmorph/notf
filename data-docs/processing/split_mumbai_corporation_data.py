#!/usr/bin/env python3
"""
Split Mumbai Ward Baseline Data into Zone Files
Similar to Bengaluru's corporation structure
"""

import json
import os

# Input/output paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_PATH = os.path.join(SCRIPT_DIR, '../../mumbai/processed_data/mumbai_ward_baselines.json')
OUTPUT_DIR = '/Users/sathya/Documents/GitHub/notf/website/public/assets/data/climate/mumbai'

# Group administrative wards into 5 geographic zones (similar to Bengaluru corporations)
ZONE_MAPPING = {
    'south': {
        'name': 'South Mumbai',
        'wards': ['A', 'B', 'C', 'D', 'E']
    },
    'central': {
        'name': 'Central Mumbai',
        'wards': ['F - North', 'F - South', 'G - North', 'G - South']
    },
    'western': {
        'name': 'Western Suburbs',
        'wards': ['H - East', 'H - West', 'K - East', 'K - West']
    },
    'eastern': {
        'name': 'Eastern Suburbs',
        'wards': ['L', 'M - East', 'M - West', 'N']
    },
    'northern': {
        'name': 'Northern Suburbs',
        'wards': ['P - North', 'P - South', 'R - Central', 'R - North', 'R - South', 'S', 'T']
    }
}

def split_mumbai_data():
    """Split Mumbai ward baseline into 5 zone files"""

    print("🚀 Splitting Mumbai Ward Data into Zone Files...")
    print(f"📂 Reading: {INPUT_PATH}")

    # Load baseline data
    with open(INPUT_PATH, 'r', encoding='utf-8') as f:
        baseline = json.load(f)

    metadata = baseline['metadata']
    all_wards = baseline['wards']

    print(f"✅ Loaded {len(all_wards)} wards")

    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Split wards by zone
    for zone_key, zone_info in ZONE_MAPPING.items():
        zone_name = zone_info['name']
        zone_ward_letters = zone_info['wards']

        # Filter wards belonging to this zone
        zone_wards = [w for w in all_wards if w['corporation'] in zone_ward_letters]

        # Create zone file structure
        zone_data = {
            "zone": zone_key,
            "zone_name": zone_name,
            "ward_count": len(zone_wards),
            "total_population": sum(w['population'] for w in zone_wards),
            "administrative_wards": zone_ward_letters,
            "last_updated": metadata['last_updated'],
            "wards": zone_wards
        }

        # Write zone file
        output_path = os.path.join(OUTPUT_DIR, f'climate_{zone_key}.json')
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(zone_data, f, ensure_ascii=False, indent=2)

        file_size_kb = os.path.getsize(output_path) / 1024
        print(f"✅ {zone_name:20s}: {len(zone_wards):3d} wards → {file_size_kb:7.1f} KB")

    print(f"\n📂 Zone files written to: {OUTPUT_DIR}")
    print(f"\nFiles created:")
    print(f"  - climate_south.json")
    print(f"  - climate_central.json")
    print(f"  - climate_western.json")
    print(f"  - climate_eastern.json")
    print(f"  - climate_northern.json")

if __name__ == '__main__':
    split_mumbai_data()
