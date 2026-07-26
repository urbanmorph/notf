#!/usr/bin/env python3
"""
Generate Mumbai Ward Index
Creates lightweight index for ward routing and dropdown
"""

import json
import os

# Input/output paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_PATH = os.path.join(SCRIPT_DIR, '../../mumbai/processed_data/mumbai_ward_baselines.json')
OUTPUT_PATH = '/Users/sathya/Documents/GitHub/notf/website/public/assets/data/climate/mumbai/ward_index.json'

def generate_ward_index():
    """Extract ward metadata for lightweight index"""

    print("🚀 Generating Mumbai Ward Index...")
    print(f"📂 Reading: {INPUT_PATH}")

    # Load baseline data
    with open(INPUT_PATH, 'r', encoding='utf-8') as f:
        baseline = json.load(f)

    all_wards = baseline['wards']
    print(f"✅ Loaded {len(all_wards)} wards")

    # Zone mapping (for routing to correct zone file)
    ZONE_MAPPING = {
        'A': 'south', 'B': 'south', 'C': 'south', 'D': 'south', 'E': 'south',
        'F - North': 'central', 'F - South': 'central', 'G - North': 'central', 'G - South': 'central',
        'H - East': 'western', 'H - West': 'western', 'K - East': 'western', 'K - West': 'western',
        'L': 'eastern', 'M - East': 'eastern', 'M - West': 'eastern', 'N': 'eastern',
        'P - North': 'northern', 'P - South': 'northern', 'R - Central': 'northern',
        'R - North': 'northern', 'R - South': 'northern', 'S': 'northern', 'T': 'northern'
    }

    # Create lightweight ward index
    ward_index = {
        "city": "Mumbai",
        "total_wards": len(all_wards),
        "last_updated": baseline['metadata']['last_updated'],
        "wards": []
    }

    for ward in all_wards:
        admin_ward = ward['corporation']
        zone = ZONE_MAPPING.get(admin_ward, 'unknown')

        ward_index['wards'].append({
            "id": ward['ward_id'],
            "name": ward['ward_name'],
            "name_local": ward['ward_name_local'],
            "slug": ward['slug'],
            "zone": zone,  # Geographic zone (south/central/western/eastern/northern)
            "administrative_ward": admin_ward,  # Original ward letter (A-T)
            "assembly": ward['assembly_constituency'],
            "population": int(ward['population'])
        })

    # Write ward index
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(ward_index, f, ensure_ascii=False, indent=2)

    file_size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"\n✅ Ward Index Generated!")
    print(f"📊 Total Wards: {len(ward_index['wards'])}")
    print(f"📦 File Size: {file_size_kb:.1f} KB")
    print(f"📂 Output: {OUTPUT_PATH}")

if __name__ == '__main__':
    generate_ward_index()
