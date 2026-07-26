# Community Geocoding Scripts

> ⚠️ **Status: legacy reference.** Day-to-day geocoding is now done through the admin
> UI at `website/public/admin/geocode-tool.html`. The batch Python scripts described
> below (`geocode-communities.py`, `check-community-locations.py`) now live in
> [`archive/`](archive/) and assume the removed `/data/` tree — they will not work
> against the current Supabase-backed system. This doc is kept for reference on the
> geocoding approach (Nominatim, neighbourhood+city lookup).

These scripts help geocode community organizations to fix incorrect map locations.

## Overview

The scripts use OpenStreetMap's Nominatim API (free, no API key needed) to geocode communities based on their neighborhood and city information.

## Prerequisites

1. **Python 3** installed

2. **Required Python packages**:
   ```bash
   pip install supabase requests
   ```

   **Note**: The `requests` library is highly recommended for better SSL handling. If you get SSL certificate errors, install it with:
   ```bash
   pip install requests
   ```

3. **Fix SSL certificates (macOS only)**:
   If you see SSL certificate errors, run:
   ```bash
   /Applications/Python\ 3.*/Install\ Certificates.command
   ```
   Or find and double-click "Install Certificates.command" in your Python installation folder.

4. **Environment variable** set with your Supabase service role key:
   ```bash
   export SUPABASE_SERVICE_KEY="your-service-role-key-here"
   ```

## Scripts

### 1. Check Community Locations (`check-community-locations.py`)

Shows the current geocoding status of all communities.

**Run:**
```bash
python3 scripts/check-community-locations.py
```

**Output:**
- Total communities count
- How many have coordinates vs don't have coordinates
- How many have neighborhood specified
- List of communities that need geocoding

### 2. Geocode Communities (`geocode-communities.py`)

Geocodes all communities using their neighborhood and city information, then updates the database.

**Run:**
```bash
python3 scripts/geocode-communities.py
```

**What it does:**
1. Fetches all communities from Supabase
2. For each community with a neighborhood:
   - Builds search queries: "Neighborhood, City, State, Country"
   - Uses OpenStreetMap Nominatim API to find coordinates
   - Updates the database with new latitude/longitude
3. Shows progress and summary

**Geocoding Strategy:**

The script tries multiple search strategies in order:
1. `Neighborhood, City, State, Country` (most specific)
2. `Community Name, City, State, Country` (if name contains area info)
3. `Neighborhood, City, Country`
4. `City, State, Country` (fallback - city center)

**Rate Limiting:**
- Waits 1 second between each request
- Respects Nominatim usage policy
- If you have many communities, this will take time

## Example Usage

```bash
# Step 1: Set your Supabase key
export SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Step 2: Check current status
python3 scripts/check-community-locations.py

# Step 3: Run geocoding
python3 scripts/geocode-communities.py
```

## Sample Output

```
🌍 Community Geocoding Script
============================================================

📥 Fetching communities from database...
✅ Found 38 communities

🚀 Starting geocoding process...
============================================================

[1/38] Women of Wisdom
  📍 Neighborhood: JP Nagar
  🏙️  City: Bengaluru
  🔄 Re-geocoding to verify location...
  ✅ Found: JP Nagar, Bengaluru, Karnataka, India → (12.9077, 77.5858)
  💾 Updated database with new coordinates

[2/38] HSR Layout Residents
  📍 Neighborhood: HSR Layout
  🏙️  City: Bengaluru
  ✅ Found: HSR Layout, Bengaluru, Karnataka, India → (12.9116, 77.6389)
  💾 Updated database with new coordinates

...

============================================================
📊 GEOCODING SUMMARY
============================================================
Total communities: 38
✅ Successfully geocoded: 36
💾 Database updated: 36
❌ Failed to geocode: 2
============================================================
```

## Troubleshooting

### "SUPABASE_SERVICE_KEY environment variable not set"
- Make sure you've exported the environment variable in your current terminal session
- Or add it to your `~/.bashrc` or `~/.zshrc` file

### "Rate limited" or "HTTP Error 429"
- Nominatim has usage limits (1 request per second)
- The script automatically waits between requests
- If you see this error, the script will wait 2 seconds and retry

### "No results for" a specific location
- Check if the neighborhood name is spelled correctly
- Try adding the neighborhood name manually in the admin interface
- Some very new or very small neighborhoods might not be in OpenStreetMap

### Network errors
- Check your internet connection
- Verify Supabase URL is accessible
- Try running the script again

## Notes

- **Backup**: The script overwrites existing coordinates. If you want to preserve old coordinates, export your data first.
- **Accuracy**: Geocoding accuracy depends on:
  - How well the neighborhood name matches OpenStreetMap data
  - Whether the neighborhood has clear boundaries in OSM
  - Spelling and format of location names
- **Manual Override**: You can always manually set coordinates in the admin interface if geocoding doesn't work well for a specific location.

## OpenStreetMap Nominatim Usage Policy

This script uses OpenStreetMap's Nominatim API, which is free but has usage requirements:
- Maximum 1 request per second
- Must include a valid User-Agent header
- For heavy usage, consider setting up your own Nominatim server

See: https://operations.osmfoundation.org/policies/nominatim/
