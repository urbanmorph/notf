#!/usr/bin/env python3
"""
Add OpenCity.in source metadata to climate JSON files
"""

import json
import os
from pathlib import Path

# Source metadata for each metric based on DATA_SOURCES_AND_CREDITS.md
SOURCE_METADATA = {
    "energy_buildings": {
        "clean_cooking": {
            "provider": "Census 2011 + OpenCity.in HCE Survey",
            "url": "https://data.opencity.in/dataset/bengaluru-household-consumption-expenditure-survey-2022-23",
            "confidence_score": 0.64,
            "confidence_stars": "★★★☆☆",
            "methodology": "City average (16%) × ward adjustment factor based on SC/ST income proxy from Census 2011",
            "limitations": [
                "Census data 14 years old",
                "SC/ST income proxy assumption",
                "Solid fuel use trending down faster than modeled"
            ],
            "data_year": "2011-2023",
            "notes": "Solid fuel households metric - lower values indicate better performance (inverted metric)"
        },
        "renewable_energy": {
            "provider": "KREDL + OpenCity.in Karnataka Renewable Energy Data",
            "url": "https://data.opencity.in/dataset/karnataka-renewable-energy-data",
            "confidence_score": 0.85,
            "confidence_stars": "★★★★☆",
            "methodology": "Karnataka grid mix (35% renewable) applied uniformly to all wards. Ward-level solar rooftop data not yet available.",
            "limitations": [
                "State-level average, not ward-specific",
                "Rooftop solar installations not tracked at ward level",
                "BESCOM data at feeder level, not ward level"
            ],
            "data_year": "2023",
            "notes": "State grid renewable share - same value for all wards until ward-level metering available"
        },
        "electricity_consumption": {
            "provider": "BESCOM + OpenCity.in estimate",
            "url": "https://data.opencity.in/dataset/bengaluru-household-consumption-expenditure-survey-2022-23",
            "confidence_score": 0.55,
            "confidence_stars": "★★★☆☆",
            "methodology": "National average electricity consumption (900 kWh/capita) applied uniformly. BESCOM feeder data not disaggregated to ward level.",
            "limitations": [
                "National average, not Bengaluru-specific",
                "No ward-level consumption data available",
                "Does not account for commercial/industrial usage variations"
            ],
            "data_year": "2023",
            "notes": "Placeholder estimate - awaiting BESCOM ward-level consumption data"
        },
        "green_buildings": {
            "provider": "IGBC + GRIHA registries",
            "url": "https://igbc.in/igbc/redirectHtml.htm?redVal=showAboutusnosign",
            "confidence_score": 0.70,
            "confidence_stars": "★★★★☆",
            "methodology": "Manual geocoding of IGBC/GRIHA certified buildings to ward boundaries. Only includes registered certifications.",
            "limitations": [
                "Only includes certified buildings, not all green buildings",
                "Small numbers make ward comparisons difficult",
                "Address-to-ward mapping may have errors"
            ],
            "data_year": "2024",
            "notes": "Count of certified green buildings - higher is better"
        }
    },
    "waste": {
        "waste_segregation": {
            "provider": "BBMP Solid Waste Management + OpenCity.in",
            "url": "https://data.opencity.in/dataset/solid-waste-management",
            "confidence_score": 0.60,
            "confidence_stars": "★★★☆☆",
            "methodology": "BBMP city average (30%) applied uniformly to all wards. Ward-level segregation tracking not yet implemented.",
            "limitations": [
                "City-level average, not ward-specific",
                "Self-reported data from waste collectors",
                "No systematic ward-level monitoring"
            ],
            "data_year": "2023",
            "notes": "Waste segregation at source - higher values indicate better performance"
        },
        "recycling_rate": {
            "provider": "BBMP + OpenCity.in DWCC Data",
            "url": "https://data.opencity.in/dataset/list-of-dry-waste-collection-centres-in-bengaluru",
            "confidence_score": 0.55,
            "confidence_stars": "★★★☆☆",
            "methodology": "City average (15%) based on DWCC throughput. Ward-level recycling rates not measured.",
            "limitations": [
                "City-level estimate, not ward-specific",
                "Informal recycling sector not included",
                "DWCC coverage varies by ward"
            ],
            "data_year": "2023",
            "notes": "Recycling rate - higher values indicate better performance"
        },
        "composting_adoption": {
            "provider": "BBMP estimate",
            "url": "https://data.opencity.in/dataset/solid-waste-management",
            "confidence_score": 0.50,
            "confidence_stars": "★★★☆☆",
            "methodology": "Estimated from wet waste processing capacity. No household-level tracking.",
            "limitations": [
                "Rough estimate based on infrastructure capacity",
                "No direct measurement of household composting",
                "Community composting not systematically tracked"
            ],
            "data_year": "2023",
            "notes": "Composting adoption rate - higher values indicate better performance"
        },
        "waste_generation": {
            "provider": "BBMP + OpenCity.in",
            "url": "https://data.opencity.in/dataset/solid-waste-management",
            "confidence_score": 0.65,
            "confidence_stars": "★★★☆☆",
            "methodology": "Ward-level waste collection data from BBMP divided by population",
            "limitations": [
                "Assumes all waste is collected and measured",
                "Commercial waste not separated from residential",
                "Seasonal variations not captured"
            ],
            "data_year": "2023",
            "notes": "Per capita waste generation - lower values indicate better performance (inverted metric)"
        }
    }
}

def add_metadata_to_city_summary(input_path, output_path):
    """Add source metadata to city_climate.json"""
    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Add metadata to each metric
    for sector, sector_data in data.get('sectors', {}).items():
        if sector in SOURCE_METADATA:
            for metric, metric_data in sector_data.items():
                if metric in SOURCE_METADATA[sector]:
                    # Add data_source object
                    metric_data['data_source'] = SOURCE_METADATA[sector][metric]

    # Save updated file
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✓ Updated {output_path}")
    print(f"  Added source metadata for {len([m for s in SOURCE_METADATA.values() for m in s])} metrics")

def add_metadata_to_corporation_files(base_dir):
    """Add source metadata to all corporation JSON files"""
    corporation_files = [
        'climate_central.json',
        'climate_east.json',
        'climate_west.json',
        'climate_north.json',
        'climate_south.json'
    ]

    for filename in corporation_files:
        filepath = os.path.join(base_dir, filename)
        if not os.path.exists(filepath):
            print(f"⚠ Skipping {filename} (not found)")
            continue

        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Add metadata to each ward's metrics
        updated_count = 0
        for ward in data.get('wards', []):
            for sector in ['energy_buildings', 'waste']:
                if sector in ward:
                    sector_data = ward[sector]
                    if sector in SOURCE_METADATA:
                        for metric in sector_data:
                            if metric in SOURCE_METADATA[sector]:
                                if 'data_source' not in sector_data[metric]:
                                    sector_data[metric]['data_source'] = SOURCE_METADATA[sector][metric]
                                    updated_count += 1

        # Save updated file
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"✓ Updated {filename}")
        print(f"  Added source metadata to {updated_count} metric instances")

def main():
    print("Adding OpenCity.in source metadata to climate JSON files...")
    print("=" * 60)

    base_dir = "/Users/sathya/Documents/GitHub/notf/website/public/assets/data/climate/bengaluru"

    # Update city summary
    city_summary_path = os.path.join(base_dir, "city_climate.json")
    city_summary_output = os.path.join(base_dir, "city_climate.json")

    if os.path.exists(city_summary_path):
        add_metadata_to_city_summary(city_summary_path, city_summary_output)
    else:
        print(f"⚠ City summary not found: {city_summary_path}")

    print()

    # Update corporation files
    add_metadata_to_corporation_files(base_dir)

    print()
    print("=" * 60)
    print("✓ All files updated with source metadata")
    print()
    print("Next steps:")
    print("1. Test that ward pages display source information correctly")
    print("2. Research Mumbai data sources similarly")
    print("3. Create Mumbai data sources documentation")

if __name__ == "__main__":
    main()
