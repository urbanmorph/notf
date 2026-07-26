#!/usr/bin/env python3
"""
Generate ward index JSON for ward selector dropdown.

Input: bengaluru_ward_baselines.json
Output: ward_index.json (50 KB - ward metadata only)

Author: NOTF Data Team
Date: 2026-01-23
"""

import json
from pathlib import Path


def generate_slug(ward_name):
    """Generate URL-friendly slug from ward name."""
    slug = ward_name.lower()
    slug = slug.replace(' ', '-').replace(',', '').replace('.', '').replace('(', '').replace(')', '')
    slug = slug.replace('/', '-').replace('&', 'and').replace("'", '')
    return slug


def extract_ward_metadata(ward):
    """Extract minimal ward metadata for index."""
    return {
        'id': ward['ward_id'],
        'name': ward['ward_name'],
        'name_local': ward['ward_name_local'],
        'slug': generate_slug(ward['ward_name']),
        'corporation': ward['corporation'],
        'assembly': ward['assembly_constituency'],
        'population': int(ward['population']) if ward['population'] else 0,
        'households': ward.get('energy_buildings', {}).get('total_households', 0)
    }


def main():
    # Paths
    base_dir = Path(__file__).parent.parent.parent
    source_file = base_dir / 'bengaluru' / 'processed_data' / 'bengaluru_ward_baselines.json'
    output_dir = base_dir.parent / 'website' / 'public' / 'assets' / 'data' / 'climate' / 'bengaluru'
    output_file = output_dir / 'ward_index.json'

    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)

    # Load source data
    print(f"Loading source data from {source_file}...")
    with open(source_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    wards = data['wards']
    print(f"✓ Loaded {len(wards)} wards")

    # Extract metadata
    print("\nExtracting ward metadata...")
    ward_index = [extract_ward_metadata(ward) for ward in wards]

    # Sort by ward name
    ward_index.sort(key=lambda w: w['name'])

    # Create index structure
    index_data = {
        'city': 'Bengaluru',
        'total_wards': len(ward_index),
        'corporations': list(set(w['corporation'] for w in ward_index)),
        'last_updated': '2026-01-23',
        'wards': ward_index
    }

    # Save ward index
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(index_data, f, ensure_ascii=False, indent=2)

    file_size = output_file.stat().st_size / 1024  # KB
    print(f"✓ Saved ward index: {len(ward_index)} wards, {file_size:.1f} KB → {output_file}")

    # Print corporation breakdown
    from collections import Counter
    corp_counts = Counter(w['corporation'] for w in ward_index)
    print(f"\nCorporation breakdown:")
    for corp, count in sorted(corp_counts.items()):
        print(f"  {corp}: {count} wards")

    print(f"\n✓ Complete!")


if __name__ == '__main__':
    main()
