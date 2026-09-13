# Cascading Failure Simulator — Powai Lake & Hiranandani, Mumbai
## Track 1: Geographic Data & Infrastructure Graph

---

### Overview
Track 1 is the foundational data and geographic infrastructure module for the **Cascading Failure Simulator (Powai Lake & Hiranandani, Mumbai)**. It extracts real-world geospatial features from OpenStreetMap (OSM), integrates municipal demographic data from MCGM / Census of India, enriches nodes and edges with engineering operational parameters, and produces canonical, strictly validated graph datasets for downstream consumption by **Track 2 (Simulation Engine)** and subsequent tracks.

---

### Key Architectural Principles
1. **Zero Hardcoded Domain Facts in Python**:
   - All spatial boundaries, OSM query filters, asset selection criteria, operational attribute profiles, and network topology rules are decoupled into `data/area_config.json`.
   - The Python code contains purely generic algorithms and parsers. Changing `area_config.json` automatically reconfigures the network without modifying a single line of Python code.
2. **Strict Data Provenance**:
   - Every node and edge explicitly states its data provenance:
     - **`REAL`**: Sourced directly from verified OpenStreetMap objects with exact `osm_refs` (e.g., `way/353139106` for Dr. L. H. Hiranandani Hospital, `relation/8546709` for Powai Lake), provider attribution, and retrieval timestamps.
     - **`SIMULATED`**: Engineered operational assumptions that cannot be queried publicly (e.g., generator capacity, backup duration, failure thresholds, service dependency strengths).
     - **`DERIVED`**: Computed spatial or topological entities (e.g., road intersection junctions derived from intersecting way geometries, residential cluster centroids).
3. **No Analytical Simulation in Track 1**:
   - Track 1 does NOT implement cascade algorithms, Monte Carlo, UI, or failure propagation. It delivers pure, validated, self-contained data.

---

### Directory Structure

```
CascadingEffect_Sim/
├── data/
│   ├── area_config.json             # Geographic bbox, OSM query filters, attribute profiles, topology rules
│   ├── simulation_config.json       # Canonical simulation states and time step definitions
│   ├── raw_osm.xml                  # Cached raw OSM XML for 100% offline reproducibility
│   ├── osm_features.geojson         # Valid GeoJSON FeatureCollection ([lon, lat], EPSG:4326)
│   ├── nodes.json                   # Normalized infrastructure nodes
│   ├── edges.json                   # Normalized physical connections and dependencies
│   ├── network.json                 # Canonical assembled graph (nodes + edges)
│   ├── facilities.json              # Mapped facilities (hospitals, schools, water, power)
│   ├── population.json              # Residential zone populations and vulnerability scores
│   └── source_manifest.json         # Auditable provenance manifest (REAL, SIMULATED, DERIVED)
├── scripts/
│   ├── fetch_osm.py                 # Fetches and parses OSM features to GeoJSON
│   ├── build_network.py             # Assembles nodes.json, edges.json, and network.json from GeoJSON + config
│   ├── generate_population.py       # Generates population.json from demographic profiles
│   └── validate_data.py             # Validates graph integrity, schemas, coordinates, and references
├── tests/
│   ├── fixtures/
│   │   ├── mock-osm.geojson         # Minimal valid GeoJSON fixture
│   │   ├── mock-network.json        # Minimal valid network graph fixture
│   │   ├── mock-facilities.json     # Minimal valid facilities fixture
│   │   └── mock-population.json     # Minimal valid population fixture
│   └── test_track1.py               # 17 automated tests verifying schemas, validation, and negative cases
└── README.md                        # Documentation and pipeline reproduction guide
```

---

### Quickstart & Reproduction Commands

To execute the entire data generation and validation pipeline from scratch:

```bash
# 1. Fetch real OSM features for Powai & Hiranandani (with automatic local caching)
python scripts/fetch_osm.py

# 2. Build the infrastructure graph (nodes.json, edges.json, network.json, facilities.json, source_manifest.json)
python scripts/build_network.py

# 3. Generate the demographic and vulnerability dataset (population.json)
python scripts/generate_population.py

# 4. Run automated validation against all schemas and graph constraints
python scripts/validate_data.py

# 5. Run the complete pytest test suite (17 unit and integration tests)
python -m pytest -v tests/test_track1.py
```

---

### Data Sources & Attribution

| Dataset | Provider | Description & Usage | Provenance |
| :--- | :--- | :--- | :--- |
| **OpenStreetMap** | OpenStreetMap Contributors (ODbL) | Road geometry (JVLR, Central Ave, Orchard Ave), bridges (Gandhinagar Flyover, JVLR Flyover), water bodies (Powai Lake), hospitals (Dr. L. H. Hiranandani Hospital, Powai Hospital), schools (HFS, S.M. Shetty), and substations. | `REAL` |
| **MCGM / Census of India** | Municipal Corporation of Greater Mumbai | Population estimates and vulnerability weights for Powai Vihar, Hiranandani Gardens, Lake Homes, IIT South, and Rambaug. | `DERIVED` |
| **Engineered Infrastructure Model** | Hackathon Simulation Model | Capacities, baseline loads, battery/generator backup hours, failure thresholds, and restoration hours. | `SIMULATED` |

---

### Canonical Schemas

#### Node Schema (`data/network.json` & `data/nodes.json`)
```json
{
  "id": "node_hosp_hiranandani",
  "type": "hospital",
  "name": "Dr. L. H. Hiranandani Hospital",
  "osm_refs": ["way/353139106"],
  "location": {
    "latitude": 19.116500,
    "longitude": 72.913000
  },
  "attributes": {
    "capacity": 220,
    "load": 175,
    "population_served": 24000,
    "backup_duration_hours": 8.5,
    "failure_threshold": 92,
    "recovery_time_hours": 4.5
  },
  "status": "OPERATIONAL",
  "source": {
    "type": "osm",
    "provider": "OpenStreetMap",
    "reference": "way/353139106",
    "retrieved_at": "2026-09-12T10:36:40Z"
  },
  "data_status": "REAL"
}
```

#### Edge Schema (`data/network.json` & `data/edges.json`)
```json
{
  "id": "edge_power_sub_hosp_hiranandani",
  "from": "node_substation_powai",
  "to": "node_hosp_hiranandani",
  "type": "power_dependency",
  "directed": true,
  "attributes": {
    "capacity": 220,
    "load": 165,
    "dependency_strength": 0.95,
    "failure_probability": 0.035
  },
  "state": "OPERATIONAL",
  "source": {
    "type": "simulated",
    "basis": "Physical adjacency and municipal infrastructure dependency model"
  },
  "data_status": "SIMULATED"
}
```

#### Facilities Schema (`data/facilities.json`)
```json
{
  "schema_version": "1.0",
  "facilities": [
    {
      "id": "facility_01_node_hosp_hiranandani",
      "asset_id": "node_hosp_hiranandani",
      "facility_type": "hospital",
      "source": {
        "type": "osm",
        "provider": "OpenStreetMap",
        "reference": "way/353139106"
      }
    }
  ]
}
```

#### Population Schema (`data/population.json`)
```json
{
  "schema_version": "1.0",
  "population": [
    {
      "id": "population_zone_01",
      "name": "Hiranandani Gardens Residential Sector",
      "population": 9800,
      "geometry_ref": "res_zone_hiranandani_gardens",
      "vulnerability": {
        "general": 0.42,
        "emergency_dependent": 0.28
      },
      "source": {
        "type": "public_dataset",
        "provider": "Census of India & Municipal Corporation of Greater Mumbai Ward S Demographics",
        "basis": "MCGM Ward S Census Projections & GIS Demographic Mapping"
      },
      "data_status": "DERIVED"
    }
  ]
}
```

---

### Canonical Units Reference
- **Latitude / Longitude**: Decimal degrees (WGS84 / EPSG:4326)
- **Coordinate Tuple in GeoJSON**: `[longitude, latitude]`
- **Distance**: Meters ($m$)
- **Time / Durations**: Hours ($h$) with explicit unit names (`backup_duration_hours`, `recovery_time_hours`)
- **Population**: Number of individuals
- **Failure Probability**: Normalized $[0.0, 1.0]$
- **Dependency Strength**: Normalized $[0.0, 1.0]$
- **Vulnerability Scores**: Normalized $[0.0, 1.0]$

---

### How Track 2 (Simulation Engine) Consumes Track 1 Data

Track 2 can directly load `data/network.json`, `data/simulation_config.json`, and `data/population.json` without any manual data preprocessing:

```python
import json

# 1. Load canonical network graph
with open("data/network.json", "r", encoding="utf-8") as f:
    network = json.load(f)

nodes = network["nodes"]  # Complete node list with location, attributes, status
edges = network["edges"]  # Complete edge list with from, to, type, directed, state

# 2. Load simulation configuration
with open("data/simulation_config.json", "r", encoding="utf-8") as f:
    sim_config = json.load(f)

time_step = sim_config["time_step_hours"]  # 0.1 hours
allowed_states = sim_config["states"]      # ['OPERATIONAL', 'DEGRADED', 'BACKUP', 'CRITICAL', 'FAILED', 'RECOVERING']

# 3. Load population impact baseline
with open("data/population.json", "r", encoding="utf-8") as f:
    population_data = json.load(f)
```

No data cleanup or ID translation is required. All foreign keys (`from`, `to`, `asset_id`, `geometry_ref`) are guaranteed to resolve cleanly.
