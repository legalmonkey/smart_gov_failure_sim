import urllib.request
import urllib.parse
import json
import sys

# 2km radius around Hiranandani Gardens, Powai, Mumbai
LAT = 19.1197
LON = 72.9073
RADIUS = 2000

# Overpass query to extract water, roads, buildings, hospitals, schools, and infrastructure
query = f"""[out:json][timeout:60];
(
  // Powai Lake & water bodies
  relation["natural"="water"](around:{RADIUS},{LAT},{LON});
  way["natural"="water"](around:{RADIUS},{LAT},{LON});
  way["waterway"](around:{RADIUS},{LAT},{LON});
  
  // Roads (arterials, primaries, secondaries, residential in Hiranandani/Powai)
  way["highway"~"primary|secondary|tertiary|residential|trunk|motorway|living_street"](around:{RADIUS},{LAT},{LON});
  
  // Key facilities: hospitals, clinics, schools, power, water
  node["amenity"~"hospital|clinic|school|college|university|police|fire_station"](around:{RADIUS},{LAT},{LON});
  way["amenity"~"hospital|clinic|school|college|university|police|fire_station"](around:{RADIUS},{LAT},{LON});
  
  // Buildings in Hiranandani and surrounding Powai
  way["building"](around:{RADIUS},{LAT},{LON});
  
  // Power & Water infrastructure
  node["power"~"substation|plant|generator"](around:{RADIUS},{LAT},{LON});
  way["power"~"substation|plant|generator"](around:{RADIUS},{LAT},{LON});
  node["man_made"~"water_works|storage_tank|wastewater_plant"](around:{RADIUS},{LAT},{LON});
  way["man_made"~"water_works|storage_tank|wastewater_plant"](around:{RADIUS},{LAT},{LON});
);
out body;
>;
out skel qt;
"""

print(f"Querying Overpass API for {RADIUS}m radius around ({LAT}, {LON})...")
url = "https://overpass-api.de/api/interpreter"
data = urllib.parse.urlencode({'data': query}).encode('utf-8')

req = urllib.request.Request(url, data=data, headers={'User-Agent': 'CascadingFailureSimulator/1.0'})
try:
    with urllib.request.urlopen(req, timeout=90) as resp:
        content = resp.read()
        osm_json = json.loads(content)
        print(f"Received {len(osm_json.get('elements', []))} OSM elements.")
        with open("scripts/raw_osm.json", "w", encoding="utf-8") as f:
            f.write(json.dumps(osm_json))
        print("Saved to scripts/raw_osm.json")
except Exception as e:
    print(f"Error fetching from Overpass API: {e}")
    sys.exit(1)
