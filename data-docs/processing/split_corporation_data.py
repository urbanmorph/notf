#!/usr/bin/env python3
"""
Split Bengaluru ward climate baselines into corporation-specific files.

Input: bengaluru_ward_baselines.json (3.5 MB, 369 wards)
Output: 5 corporation JSON files (central, east, west, north, south)

Author: NOTF Data Team
Date: 2026-01-23
"""

import json
import os
from pathlib import Path
from collections import defaultdict


def load_source_data(source_path):
    """Load the source ward baselines JSON."""
    print(f"Loading source data from {source_path}...")
    with open(source_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    print(f"✓ Loaded {len(data['wards'])} wards")
    return data


def split_by_corporation(wards_data):
    """Split wards into corporation groups."""
    corporations = defaultdict(list)

    for ward in wards_data:
        corp = ward['corporation']
        corporations[corp].append(ward)

    return corporations


def add_ward_slug(ward):
    """Generate URL-friendly slug from ward name."""
    slug = ward['ward_name'].lower()
    # Remove special characters, replace spaces with hyphens
    slug = slug.replace(' ', '-').replace(',', '').replace('.', '').replace('(', '').replace(')', '')
    slug = slug.replace('/', '-').replace('&', 'and').replace("'", '')
    ward['slug'] = slug
    return ward


def save_corporation_file(corporation_name, wards, output_dir):
    """Save corporation-specific JSON file."""
    corp_lower = corporation_name.lower()
    output_path = output_dir / f'climate_{corp_lower}.json'

    # Add slugs to all wards
    wards_with_slugs = [add_ward_slug(ward) for ward in wards]

    data = {
        'corporation': corporation_name,
        'ward_count': len(wards_with_slugs),
        'last_updated': wards_with_slugs[0].get('energy_buildings', {}).get('solid_fuel_households', {}).get('last_updated', '2026-01-23'),
        'wards': wards_with_slugs
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    file_size = os.path.getsize(output_path) / 1024  # KB
    print(f"✓ Saved {corporation_name}: {len(wards)} wards, {file_size:.1f} KB → {output_path}")

    return output_path


def main():
    # Paths
    base_dir = Path(__file__).parent.parent.parent
    source_file = base_dir / 'bengaluru' / 'processed_data' / 'bengaluru_ward_baselines.json'
    output_dir = base_dir.parent / 'website' / 'public' / 'assets' / 'data' / 'climate' / 'bengaluru'

    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)

    # Load source data
    source_data = load_source_data(source_file)
    wards = source_data['wards']

    # Split by corporation
    print(f"\nSplitting {len(wards)} wards into corporations...")
    corporations = split_by_corporation(wards)

    print(f"\nCorporation breakdown:")
    for corp, corp_wards in sorted(corporations.items()):
        print(f"  {corp}: {len(corp_wards)} wards")

    # Save corporation files
    print(f"\nSaving corporation files to {output_dir}...")
    for corp_name, corp_wards in corporations.items():
        save_corporation_file(corp_name, corp_wards, output_dir)

    print(f"\n✓ Complete! Generated {len(corporations)} corporation files")
    print(f"  Total wards: {sum(len(w) for w in corporations.values())}")


if __name__ == '__main__':
    main()
