# Cascading Failure Simulator
## Detailed 5-Person Implementation Guide
### Powai Lake & Hiranandani, Mumbai

---

# 1. Project Objective

Build an interactive infrastructure-resilience simulator for the **Powai Lake and Hiranandani area of Mumbai, Maharashtra**.

The system will represent a geographically grounded urban infrastructure network containing roads, junctions, residential areas, a hospital, schools, power infrastructure, water infrastructure, emergency-access routes, and relevant features around Powai Lake.

Users should be able to:

1. Explore infrastructure and its dependencies.
2. Introduce one or more failures.
3. Watch failures propagate through the network over time.
4. Measure the effect on infrastructure and people.
5. Identify critical assets and connections.
6. Introduce uncertainty into infrastructure parameters.
7. Allocate a limited intervention budget.
8. Compare alternative intervention and failure scenarios.
9. Receive an optimization-based recommendation and an AI explanation.

The project should be implemented as **five parallel tracks**, with clear interfaces between them.

---


# 1.1 NON-NEGOTIABLE ENGINEERING RULES

These rules apply to **all five people**. They are required specifically so that the five tracks can be developed independently and merged with minimal rewriting.

## A. NO HARDCODING

The final system must **not hardcode infrastructure facts, relationships, failure outcomes, criticality rankings, intervention winners, or scenario results**.

Anything describing the modeled city or its behavior must come from data/configuration or be calculated dynamically.

### Must be data/configuration driven

The following must NOT be embedded as special cases in source code:

- Infrastructure asset identities and properties
- Geographic locations
- Road and service connections
- Infrastructure dependencies
- Capacity and current load
- Backup duration
- Failure thresholds
- Recovery times
- Dependency strengths
- Population served
- Failure probabilities
- Failure propagation outcomes
- Critical asset or edge rankings
- Intervention recommendations
- Optimal budget allocation
- Scenario results
- Human-impact numbers

These values should come from files such as:

```text
/data/nodes.json
/data/edges.json
/data/network.json
/data/facilities.json
/data/population.json
/config/
/scenarios/
/interventions/
```

### Forbidden example

Do **not** write:

```python
if asset_id == "hospital_01":
    hospital_fails_after = 6
```

Instead, use the asset's configured/modelled parameter:

```python
hospital_fails_after = node["backup_duration"]
```

Similarly, do not write:

```python
critical_assets = ["substation_01", "hospital_01"]
```

Criticality must be calculated dynamically by removing assets/connections and measuring the resulting impact.

Do not write:

```python
best_intervention = "backup_generator"
```

The optimizer must determine the best intervention from the current network, scenario, intervention costs/effects, and available budget.

### What IS allowed to be hardcoded

Normal **software constants and implementation defaults** are allowed, for example:

```text
default simulation time step
default Monte Carlo iteration count
UI dimensions
animation speed
state names
API route names
numerical tolerances
default display settings
```

However, these constants must never encode facts about Powai/Hiranandani or predetermined simulation outcomes.

**Rule of thumb:**

> If changing the infrastructure dataset should change the result without changing source code, the implementation is correctly data-driven.

---

## B. MERGE-FIRST ARCHITECTURE

The five tracks are deliberately separated by **interfaces**, not merely by tasks.

The objective is:

> **Five people can develop in parallel, and their work can be merged without rewriting each other's core code.**

The dependency direction is:

```text
TRACK 1
Data + Infrastructure Graph
        |
        v
TRACK 2
Cascade Simulation
        |
        +-------------------+
        |                   |
        v                   v
TRACK 3               TRACK 4
Human Impact           Criticality +
+ Uncertainty          Optimization + AI
        |                   |
        +---------+---------+
                  |
                  v
               TRACK 5
             Unity + UI
```

### Ownership boundaries

Each person owns their own directory and core implementation:

```text
Person 1 → data/
Person 2 → simulation/
Person 3 → impact/
Person 4 → optimization/
Person 5 → unity/
```

A person should **consume another track's outputs through the agreed interface**, not copy or reimplement its internal logic.

### Interface rule

Every track should be treated as:

```text
INPUT
  ↓
PROCESSING
  ↓
STANDARDIZED OUTPUT
```

For example:

```text
Track 1:
network data → validation/loading → network graph

Track 2:
network graph + scenario → simulation → simulation state/events

Track 3:
simulation state → impact analysis → impact result

Track 4:
network + simulation/impact results → optimization → decision result

Track 5:
standardized outputs → visualization → user experience
```

### Shared contracts must be frozen early

Before heavy parallel development, agree on:

```text
1. Asset schema
2. Connection/edge schema
3. Scenario schema
4. Simulation-state schema
5. Simulation-event schema
6. Human-impact result schema
7. Intervention schema
8. Optimization-result schema
```

Once agreed, changes to these contracts should be discussed by the whole team before merging.

### Important merging rule

Do not have multiple people editing the same core implementation files.

Prefer:

```text
data/        → Person 1
simulation/  → Person 2
impact/      → Person 3
optimization/→ Person 4
unity/       → Person 5
```

Shared schemas and interfaces can be maintained collaboratively, but core logic should have one clear owner.

### No duplicated core logic

For example:

- Unity must not contain a second cascade engine.
- Track 3 must not recreate Track 2's propagation rules.
- Track 4 must not manually reproduce Track 2's failure calculations.
- Track 1 must not encode simulation outcomes into geographic data.

The source of truth for each concept must exist in **one place**.

---

# 2. High-Level Architecture

```text
                    REAL-WORLD / PUBLIC DATA
                             |
                             v
              +-------------------------------+
              | TRACK 1                       |
              | DATA + INFRASTRUCTURE GRAPH   |
              | Powai/Hiranandani network     |
              +---------------+---------------+
                              |
                              v
              +-------------------------------+
              | TRACK 2                       |
              | CASCADE SIMULATION ENGINE     |
              | Failure + time + dependencies |
              +---------------+---------------+
                              |
                +-------------+-------------+
                |                           |
                v                           v
     +-----------------------+   +-----------------------+
     | TRACK 3               |   | TRACK 4               |
     | HUMAN IMPACT +        |   | OPTIMIZATION +        |
     | UNCERTAINTY           |   | AI ADVISOR            |
     +-----------+-----------+   +-----------+-----------+
                 |                           |
                 +-------------+-------------+
                               |
                               v
              +-------------------------------+
              | TRACK 5                       |
              | UNITY UI + VISUAL EXPERIENCE  |
              +-------------------------------+
```

---

# 3. Division of Responsibility

| Track | Owner | Primary Responsibility |
|---|---|---|
| Track 1 | Person 1 | Geographic data, infrastructure assets, graph |
| Track 2 | Person 2 | Failure propagation and time simulation |
| Track 3 | Person 3 | Human impact, uncertainty, Monte Carlo |
| Track 4 | Person 4 | Criticality, intervention optimization, AI advisor |
| Track 5 | Person 5 | Unity city, interaction, visualization, scenario UI |

Development should happen in parallel after the **shared data contract** is agreed.

Person 5 can begin with mocked network data while Tracks 1–4 are being built.

---

# TRACK 1 — GEOGRAPHIC DATA & INFRASTRUCTURE GRAPH

## Owner: Person 1

## Goal

Create the geographically grounded infrastructure network for the Powai Lake–Hiranandani area.

The central question is:

> **What infrastructure exists, where is it, and how is it connected?**

---

## 1.1 Geographic scope

The prototype covers:

- Powai Lake
- Hiranandani area
- major roads
- road junctions
- bridges or critical crossings where applicable
- residential areas
- hospital
- schools
- relevant power infrastructure
- relevant water infrastructure
- emergency-access routes

Do not attempt to reproduce every asset in the real area.

Build a **small, representative network** that is sufficiently realistic to demonstrate cascading failures.

Recommended prototype size:

```text
30–100 nodes
50–200 edges
```

---

## 1.2 Data sources

Use a hybrid approach.

### Real/public information

Use:

- OpenStreetMap for roads, buildings, junctions and geographic features.
- Public geographic and administrative datasets for boundaries and spatial context.
- Publicly available information for facility locations.
- Public demographic/population information for approximate population impact.

### Simulated information

Operational parameters that are unavailable publicly should be simulated:

- infrastructure capacity
- current load
- backup duration
- failure threshold
- recovery time
- dependency strength
- population served
- failure probability

Do not present simulated operational parameters as real measurements.

---

## 1.3 Node schema

Every infrastructure asset must have a common structure.

```json
{
  "id": "hospital_01",
  "type": "hospital",
  "name": "Hospital",
  "latitude": 19.12,
  "longitude": 72.91,
  "capacity": 100,
  "load": 72,
  "population_served": 15000,
  "backup_duration": 6,
  "failure_threshold": 90,
  "recovery_time": 4,
  "status": "operational"
}
```

Required fields:

```text
id
type
location
capacity
load
population_served
failure_threshold
recovery_time
status
```

---

## 1.4 Edge schema

Edges represent physical connections or service dependencies.

```json
{
  "id": "power_connection_01",
  "from": "substation_01",
  "to": "hospital_01",
  "type": "power_dependency",
  "capacity": 100,
  "load": 75,
  "dependency_strength": 1.0,
  "failure_probability": 0.05
}
```

Possible edge types:

```text
power_dependency
water_dependency
road_connection
emergency_route
service_dependency
```

---

## 1.5 Node AND edge criticality

Do not only model important buildings.

A connection itself can be a single point of failure.

Therefore the graph must support:

```text
Node failure
AND
Edge failure
```

---

## 1.6 Deliverables

Person 1 must deliver:

```text
/data
    nodes.json
    edges.json
    network.json
    facilities.json
    population.json
```

and:

```text
network_validator.py
```

The validator must detect:

- duplicate IDs
- invalid node references
- disconnected infrastructure
- missing attributes
- invalid coordinates
- impossible dependency relationships

### Definition of done

Track 1 is complete when:

- The Powai/Hiranandani network can be loaded programmatically.
- Every node has coordinates.
- Every node has infrastructure metadata.
- Edges describe dependencies/connections.
- Node and edge failures are supported.
- The graph can be passed to Track 2 without manual modification.

---

# TRACK 2 — CASCADE & TIME SIMULATION ENGINE

## Owner: Person 2

## Goal

Create the mathematical engine that determines how disruptions propagate.

The central question is:

> **If something fails, what happens next, and when?**

This is the core simulation engine.

---

## 2.1 Infrastructure states

Every asset should support:

```text
OPERATIONAL
DEGRADED
BACKUP
CRITICAL
FAILED
RECOVERING
```

---

## 2.2 Failure types

Support at least:

- Single failure
- Multiple simultaneous failures
- Edge failure
- Capacity overload
- Resource depletion

---

## 2.3 Time-based simulation

Represent simulation time:

```text
t = 0
t = 1
t = 2
...
t = N
```

At every time step:

1. Update infrastructure state.
2. Recalculate available capacity.
3. Recalculate load.
4. Check dependency failures.
5. Propagate consequences.
6. Calculate recovery/degradation.
7. Send updated state to Track 3.

---

## 2.4 Example cascade

```text
Power station fails
       |
       v
Substation loses supply
       |
       v
Hospital loses primary power
       |
       v
Hospital enters BACKUP
       |
       v
Generator fuel decreases
       |
       v
Fuel reaches threshold
       |
       v
Hospital becomes CRITICAL
       |
       v
Hospital fails
       |
       v
Patients affected
```

---

## 2.5 Dependency rule

A simple first implementation:

```text
available_supply < required_supply
        |
        v
     DEGRADED
```

If degradation persists:

```text
degradation_time > threshold
        |
        v
     CRITICAL
```

Then:

```text
resource == 0
OR
capacity < minimum_required
        |
        v
      FAILED
```

Use configurable rules rather than hardcoding them.

---

## 2.6 Recovery

Support:

```text
FAILED
  |
repair begins
  |
RECOVERING
  |
OPERATIONAL
```

Recovery time should be an asset parameter.

---

## 2.7 Simulation API

Track 2 should expose functions similar to:

```python
initialize_simulation(network)
trigger_failure(asset_id)
trigger_failures(asset_ids)
step_simulation(delta_time)
run_simulation(duration)
get_network_state()
reset_simulation()
```

---

## 2.8 Simulation output

```json
{
  "time": 4,
  "failed_nodes": ["substation_01"],
  "degraded_nodes": ["hospital_01"],
  "backup_nodes": ["water_pump_01"],
  "affected_edges": ["road_12"],
  "available_capacity": {
    "hospital_01": 40
  }
}
```

### Definition of done

Track 2 is complete when:

- A user can fail one or more nodes.
- A user can fail edges.
- Failure propagates through dependencies.
- Propagation happens over time.
- Backup/degradation states exist.
- Recovery can be represented.
- The simulation runs independently of Unity.
- Output can be consumed by Tracks 3–5.

---

# TRACK 3 — HUMAN IMPACT & UNCERTAINTY ENGINE

## Owner: Person 3

## Goal

Translate infrastructure failure into **human consequences** and quantify uncertainty.

The central question is:

> **How many people are affected, how badly, for how long, and how certain are we?**

---

## 3.1 Human-impact metrics

Calculate:

### Population affected

Number of people losing or receiving degraded services.

### Duration of impact

How long people remain affected.

### Emergency response delay

For roads:

```text
Normal travel time
vs.
Failure scenario travel time
```

### Critical service disruption

Count affected:

- hospital services
- schools
- water access
- emergency routes
- power-dependent services

---

## 3.2 Vulnerability classes

Where appropriate, distinguish:

```text
General population
Hospital patients
Students
Emergency-dependent population
Other high-dependency groups
```

---

## 3.3 Cascade Impact Score

Create a normalized score:

\[
Impact =
w_1(Population)
+w_2(Duration)
+w_3(Vulnerability)
+w_4(ResponseDelay)
+w_5(CriticalServices)
\]

Normalize:

```text
0 = negligible
1 = extreme
```

Keep the individual metrics visible so the score is not a black box.

---

## 3.4 Uncertainty model

Represent operational parameters as ranges.

Example:

```text
Generator duration:
5–7 hours

Hospital load:
65–80%

Water demand:
80–100%

Recovery time:
2–6 hours
```

---

## 3.5 Monte Carlo simulation

For each scenario:

```text
Run 1 → random parameters
Run 2 → random parameters
Run 3 → random parameters
...
Run N → random parameters
```

Collect:

```text
population affected
cascade size
critical services affected
time-to-failure
impact score
```

Calculate:

```text
mean
median
percentiles
confidence range
probability of specific outcomes
```

---

## 3.6 Example output

```text
Estimated hospital failure time

Median: 6.1 hours
Likely range: 5.2–7.4 hours

Probability of failure within 6 hours: 61%
```

And:

```text
Expected population affected: 12,400

90% range:
8,100 – 19,700
```

---

## 3.7 Track 3 API

```python
calculate_human_impact(simulation_state)
calculate_population_affected(simulation_state)
calculate_response_delay(simulation_state)
run_monte_carlo(scenario, iterations)
get_uncertainty_distribution()
```

### Definition of done

Track 3 is complete when:

- Infrastructure failures produce human-impact numbers.
- Impact duration is calculated.
- Emergency response delays can be calculated.
- Critical services are identified.
- Operational parameters support ranges.
- Monte Carlo simulations produce distributions.
- Results can be displayed by Track 5.

---

# TRACK 4 — CRITICALITY, OPTIMIZATION & AI ADVISOR

## Owner: Person 4

## Goal

Determine **where intervention provides the greatest benefit** and explain the result.

The central question is:

> **If I have limited money, where should I spend it?**

---

## 4.1 Node criticality

For every infrastructure asset:

1. Remove the asset.
2. Run the cascade simulation.
3. Calculate resulting impact.
4. Restore the asset.
5. Repeat.

Conceptually:

\[
NodeCriticality_i = Impact(Network-i)
\]

---

## 4.2 Edge criticality

Repeat for connections:

\[
EdgeCriticality_e = Impact(Network-e)
\]

This directly identifies disproportionately important **assets and connections**.

---

## 4.3 Intervention library

Create intervention objects.

```json
{
  "id": "backup_generator",
  "target_type": "hospital",
  "cost": 500000,
  "effects": {
    "backup_duration": "+6 hours"
  }
}
```

Possible interventions:

```text
Backup generator
Redundant power connection
Reinforced bridge
Alternate road route
Water storage tank
Additional water connection
Additional emergency route
```

Each intervention needs:

```text
cost
target
effect
constraints
```

---

## 4.4 Budget optimization

Input:

```text
Budget = ₹X
```

Find the intervention combination minimizing:

```text
Cascade Impact Score
```

subject to:

\[
TotalCost \le Budget
\]

For a small prototype, brute-force or combinatorial search is acceptable.

---

## 4.5 Intervention ROI

\[
ROI =
rac{Impact_{before}-Impact_{after}}
{Cost}
\]

Use a normalized, human-readable metric in the interface.

---

## 4.6 User plan vs optimal plan

The user creates:

```text
USER PLAN
₹2,000,000
```

The optimization engine creates:

```text
OPTIMAL PLAN
₹2,000,000
```

Run identical scenarios against both.

Display:

```text
Your plan
Impact reduction: 34%

Optimal plan
Impact reduction: 61%
```

Then identify what the optimizer prioritized differently.

---

## 4.7 AI Advisor

The AI should **not** calculate the mathematical optimum.

Use:

```text
Simulation
    ↓
Optimization
    ↓
Structured results
    ↓
AI explanation
```

The AI receives structured results such as:

```json
{
  "user_plan_score": 0.52,
  "optimal_score": 0.31,
  "budget": 2000000,
  "missed_assets": [
    "substation_02",
    "water_pump_01"
  ]
}
```

Then explains:

- why the optimal plan performed better
- which dependency caused the largest cascade
- which intervention provides the highest resilience improvement

### Definition of done

Track 4 is complete when:

- Assets can be ranked by simulated removal impact.
- Connections can be ranked by simulated removal impact.
- Interventions have costs and effects.
- A budget can be supplied.
- An optimal intervention combination can be calculated.
- User and optimal plans can be compared.
- AI explains numerical results rather than inventing them.

---

# MASTER ENGINEERING CONTRACT — ALL FIVE TRACKS

This section is **NON-NEGOTIABLE**. It is the single source of truth for how the five people build and merge the system.

The project must be developed as **one system with five modules**, not five separate projects.

```text
                         ┌───────────────┐
                         │    TRACK 1    │
                         │ Data + OSM    │
                         └───────┬───────┘
                                 │
                         network.json
                                 │
                                 ▼
                         ┌───────────────┐
                         │    TRACK 2    │
                         │ Simulation    │
                         └───────┬───────┘
                                 │
                  ┌──────────────┴──────────────┐
                  │                             │
                  ▼                             ▼
           ┌───────────────┐             ┌───────────────┐
           │    TRACK 3    │             │    TRACK 4    │
           │ Impact +      │             │ Criticality + │
           │ Uncertainty   │             │ Optimization  │
           └───────┬───────┘             └───────┬───────┘
                   │                             │
                   └──────────────┬──────────────┘
                                  ▼
                         ┌───────────────┐
                         │    TRACK 5    │
                         │ React +       │
                         │ Three.js      │
                         └───────────────┘
```

## A. Non-negotiable engineering rules

### A1. No hardcoding of domain facts

Forbidden:

```text
if asset_id == "hospital_01" then fail_after = 6
critical_assets = ["substation_01", "hospital_01"]
population_affected = 12400
road_17 is the ambulance route
```

Allowed:

```text
software defaults
UI dimensions
animation speeds
state labels
API route strings
numerical tolerances
default Monte Carlo iteration count
```

Domain facts must live in data/configuration:

```text
OSM data
public datasets
nodes.json
edges.json
network.json
scenario files
simulation configuration
intervention definitions
population data
```

### A2. One source of truth per concept

| Concept | Owner |
|---|---|
| Geographic location/geometry | Track 1 |
| OSM identity and provenance | Track 1 |
| Infrastructure assets | Track 1 |
| Infrastructure connections | Track 1 |
| Failure propagation | Track 2 |
| Simulation time/state/events | Track 2 |
| Human impact | Track 3 |
| Uncertainty/Monte Carlo | Track 3 |
| Node criticality | Track 4 |
| Edge criticality | Track 4 |
| Intervention catalogue | Track 4 |
| Optimization | Track 4 |
| AI explanation | Track 4 |
| 3D rendering | Track 5 |
| Browser UI/presentation state | Track 5 |

No track silently creates a competing version.

### A3. Stable identifiers

Every node and edge has a unique immutable `id`.

```text
hospital_01
school_01
substation_01
road_17
power_connection_01
```

Cross-track references use IDs only.

Never use:

```text
array index
Three.js object index
Unity/GameObject name
display name
latitude/longitude as an ID
```

### A4. Canonical states

All backend tracks use exactly:

```text
OPERATIONAL
DEGRADED
BACKUP
CRITICAL
FAILED
RECOVERING
```

The frontend may display friendly labels, but must not change the canonical values.

### A5. Canonical coordinate convention

GeoJSON:

```text
[longitude, latitude]
```

Geographic coordinate system:

```text
WGS84 / EPSG:4326
```

Track 5 converts WGS84 to a local Cartesian scene:

```text
longitude → X
latitude  → Z
elevation  → Y
```

No track may invent a second coordinate convention.

### A6. Canonical units

```text
latitude/longitude      → decimal degrees
distance                → meters
time                    → hours unless field says otherwise
response delay          → minutes
population              → people
cost                    → Indian Rupees
probability             → 0–1
impact score            → 0–1
```

Prefer explicit names:

```text
backup_duration_hours
response_delay_minutes
cost_inr
```

### A7. Determinism

Every deterministic simulation accepts:

```text
random_seed
```

Same:

```text
network
scenario
configuration
random seed
```

must produce the same deterministic result.

Monte Carlo results must record:

```text
iterations
random_seed
model/configuration version
```

### A8. Version everything important

Shared data uses:

```json
{
  "schema_version": "1.0"
}
```

Model changes require a schema/model version change and team agreement.

### A9. No direct internal coupling

Track 5 does not import Python implementation code.

Track 4 does not copy Track 2's propagation algorithm.

Track 3 does not recalculate Track 2 propagation.

Track 2 does not calculate human-impact scores.

Use interfaces/contracts.

---

# B. Canonical file and API layout

```text
data/
├── osm_features.geojson
├── nodes.json
├── edges.json
├── network.json
├── facilities.json
├── population.json
├── simulation_config.json
└── source_manifest.json

scenarios/
└── scenario_*.json

interventions/
└── interventions.json

results/
└── ...

web/
└── ...

simulation/
├── ...
└── API/service
```

`network.json` is the **canonical assembled infrastructure graph**.

`nodes.json` and `edges.json` are source/inspection-friendly normalized files.

Track 2 consumes `network.json`.

Track 5 consumes both:

```text
osm_features.geojson
network.json
```

and analytical results through the API/results contract.

---

# C. Canonical schemas

## C1. `network.json`

```json
{
  "schema_version": "1.0",
  "network_id": "powai_hiranandani",
  "name": "Powai-Hiranandani Infrastructure Network",
  "coordinate_reference_system": "EPSG:4326",
  "nodes": [],
  "edges": []
}
```

Rules:

- `network_id` is stable.
- `nodes` contains the complete node set.
- `edges` contains the complete edge set.
- Every edge references an existing node.
- No duplicate IDs.
- No dangling references.
- Geographic geometry remains in Track 1 data.

---

## C2. Node / infrastructure asset

```json
{
  "id": "hospital_01",
  "type": "hospital",
  "name": "Example Hospital",
  "osm_refs": ["way/123456"],
  "location": {
    "latitude": 19.120000,
    "longitude": 72.910000
  },
  "attributes": {
    "capacity": 100,
    "load": 72,
    "population_served": 15000,
    "backup_duration_hours": 6,
    "failure_threshold": 90,
    "recovery_time_hours": 4
  },
  "status": "OPERATIONAL"
}
```

Required:

```text
id
type
name
location
status
```

`osm_refs` may contain one or more OSM object references because real mapped facilities can be represented by nodes, ways, or relations.

Operational fields are real only when sourced. Otherwise their provenance must say they are simulated.

---

## C3. Edge / connection

```json
{
  "id": "power_connection_01",
  "from": "substation_01",
  "to": "hospital_01",
  "type": "power_dependency",
  "directed": true,
  "attributes": {
    "capacity": 100,
    "load": 75,
    "dependency_strength": 1.0,
    "failure_probability": 0.05
  },
  "state": "OPERATIONAL"
}
```

Required:

```text
id
from
to
type
directed
state
```

Rules:

- `from` and `to` must reference valid node IDs.
- Directed dependency and physical bidirectional connectivity must not be conflated.
- `directed=false` is appropriate for undirected physical connectivity where applicable.
- `dependency_strength` is a model parameter, not a claim about publicly measured infrastructure behavior.

---

## C4. OSM GeoJSON

File:

```text
data/osm_features.geojson
```

Canonical structure:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "osm_id": "way/123456",
        "feature_type": "road",
        "name": "Example Road",
        "source": "OpenStreetMap"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [72.9100, 19.1200],
          [72.9110, 19.1210]
        ]
      }
    }
  ]
}
```

Rules:

- `[longitude, latitude]`.
- Preserve `osm_id`.
- Preserve useful source tags where practical.
- `feature_type` is normalized by Track 1.
- Track 5 does not alter source geometry to create analytical facts.

---

## C5. OSM ↔ asset mapping

Every asset that originates from mapped OSM data must preserve the relationship:

```text
OSM object
    ↓
osm_ref
    ↓
asset_id
    ↓
simulation state
    ↓
Three.js object
```

Example:

```text
way/123456 → road_17
way/987654 → hospital_01
```

If an asset is simulated rather than mapped, use:

```text
osm_refs: []
```

and identify it as simulated in provenance/configuration.

---

## C6. Provenance contract

All data sources must be distinguishable.

Recommended structure:

```json
{
  "source": {
    "type": "osm",
    "provider": "OpenStreetMap",
    "reference": "way/123456",
    "retrieved_at": "2026-09-12T10:00:00Z"
  },
  "data_status": "REAL"
}
```

For simulated operational values:

```json
{
  "source": {
    "type": "simulated",
    "basis": "hackathon_model_default"
  },
  "data_status": "SIMULATED"
}
```

Use:

```text
REAL
SIMULATED
DERIVED
```

where appropriate.

The UI should be able to distinguish real geographic facts from modeled assumptions.

---

## C7. Population contract

```json
{
  "schema_version": "1.0",
  "population": [
    {
      "id": "population_zone_01",
      "name": "Residential Zone 01",
      "population": 4200,
      "geometry_ref": "feature_or_zone_id",
      "vulnerability": {
        "general": 0.5,
        "emergency_dependent": 0.2
      },
      "source": {
        "type": "public_dataset"
      }
    }
  ]
}
```

Track 3 uses this data for human-impact calculations.

Do not embed population numbers in simulation code.

---

## C8. Facility contract

```json
{
  "schema_version": "1.0",
  "facilities": [
    {
      "id": "facility_01",
      "asset_id": "hospital_01",
      "facility_type": "hospital",
      "source": {
        "type": "public"
      }
    }
  ]
}
```

`asset_id` links the facility to the infrastructure graph.

---

## C9. Scenario contract

```json
{
  "schema_version": "1.0",
  "id": "scenario_01",
  "name": "Power + Road Disruption",
  "network_id": "powai_hiranandani",
  "initial_failures": [
    {
      "target_type": "node",
      "target_id": "substation_01"
    },
    {
      "target_type": "edge",
      "target_id": "road_17"
    }
  ],
  "interventions": [
    {
      "intervention_id": "backup_generator",
      "target_asset_id": "hospital_01"
    }
  ],
  "budget_inr": 2000000,
  "duration_hours": 24,
  "random_seed": 42
}
```

Use `initial_failures`, not a vague `failures` string array.

This explicitly supports:

```text
node failure
edge failure
multiple simultaneous failures
```

---

## C10. Simulation configuration

```json
{
  "schema_version": "1.0",
  "time_step_hours": 0.1,
  "states": [
    "OPERATIONAL",
    "DEGRADED",
    "BACKUP",
    "CRITICAL",
    "FAILED",
    "RECOVERING"
  ],
  "default_monte_carlo_iterations": 1000
}
```

Track 2 owns the interpretation of this configuration.

---

## C11. Simulation state

```json
{
  "schema_version": "1.0",
  "scenario_id": "scenario_01",
  "simulation_id": "sim_001",
  "time_hours": 4.5,
  "assets": {
    "substation_01": {
      "state": "FAILED",
      "load": 0
    },
    "hospital_01": {
      "state": "BACKUP",
      "load": 78
    }
  },
  "edges": {
    "power_connection_01": {
      "state": "FAILED"
    }
  }
}
```

The state is a **snapshot**, not an event log.

---

## C12. Simulation event

A single event:

```json
{
  "schema_version": "1.0",
  "event_id": "event_001",
  "simulation_id": "sim_001",
  "time_hours": 4.5,
  "event_type": "asset_failed",
  "target_type": "node",
  "target_id": "hospital_01",
  "cause": "backup_exhausted"
}
```

Event collection:

```json
{
  "schema_version": "1.0",
  "simulation_id": "sim_001",
  "events": []
}
```

This distinction prevents Track 5 from confusing one event with an entire event history.

---

## C13. Simulation result

Every completed simulation should have a standardized summary:

```json
{
  "schema_version": "1.0",
  "simulation_id": "sim_001",
  "scenario_id": "scenario_01",
  "status": "COMPLETED",
  "duration_hours": 24,
  "final_state_ref": "simulation_state.json",
  "event_log_ref": "simulation_events.json",
  "impact_result_ref": "impact_result.json"
}
```

---

## C14. Human impact result

```json
{
  "schema_version": "1.0",
  "scenario_id": "scenario_01",
  "population_affected": 12400,
  "duration_hours": 6.1,
  "emergency_response_delay_minutes": 14,
  "hospital_disruptions": 1,
  "school_disruptions": 2,
  "water_service_disruptions": 1,
  "power_service_disruptions": 3,
  "impact_score": 0.51
}
```

Track 3 owns these calculations.

The formula and weights used to generate the score must be configuration/versioned data, not hidden constants.

---

## C15. Uncertainty result

```json
{
  "schema_version": "1.0",
  "scenario_id": "scenario_01",
  "iterations": 1000,
  "random_seed": 42,
  "population_affected": {
    "mean": 12400,
    "median": 11900,
    "p05": 8100,
    "p95": 19700
  },
  "hospital_failure_probability": 0.67
}
```

All probability values are in `[0,1]`.

Track 3 owns the statistical calculations.

---

## C16. Criticality result

```json
{
  "schema_version": "1.0",
  "scenario_id": "scenario_01",
  "nodes": [
    {
      "asset_id": "substation_01",
      "criticality_score": 0.91
    }
  ],
  "edges": [
    {
      "edge_id": "power_connection_01",
      "criticality_score": 0.87
    }
  ]
}
```

Track 4 owns the calculations.

Criticality is produced by **removal-impact simulation**, not a hardcoded ranking.

---

## C17. Intervention catalogue

```json
{
  "schema_version": "1.0",
  "interventions": [
    {
      "id": "backup_generator",
      "name": "Backup Generator",
      "target_types": ["hospital"],
      "cost_inr": 500000,
      "effects": {
        "backup_duration_hours_add": 6
      },
      "constraints": []
    }
  ]
}
```

Track 4 owns intervention semantics.

Track 5 displays available interventions.

---

## C18. Intervention request

```json
{
  "schema_version": "1.0",
  "scenario_id": "scenario_01",
  "intervention_id": "backup_generator",
  "target_asset_id": "hospital_01"
}
```

---

## C19. Optimization result

```json
{
  "schema_version": "1.0",
  "scenario_id": "scenario_01",
  "budget_inr": 2000000,
  "selected_interventions": [
    {
      "intervention_id": "backup_generator",
      "target_asset_id": "hospital_01",
      "cost_inr": 500000
    }
  ],
  "total_cost_inr": 1800000,
  "baseline_impact_score": 0.72,
  "optimized_impact_score": 0.31,
  "impact_reduction": 0.41
}
```

---

## C20. User-plan result

```json
{
  "schema_version": "1.0",
  "scenario_id": "scenario_01",
  "budget_inr": 2000000,
  "selected_interventions": [],
  "total_cost_inr": 1700000,
  "baseline_impact_score": 0.72,
  "resulting_impact_score": 0.48,
  "impact_reduction": 0.24
}
```

---

## C21. Advisor result

```json
{
  "schema_version": "1.0",
  "scenario_id": "scenario_01",
  "user_plan_impact": 0.48,
  "optimal_plan_impact": 0.31,
  "missed_critical_assets": ["substation_01"],
  "missed_critical_edges": ["power_connection_01"],
  "priority_reasons": [
    "major hospital power bottleneck",
    "low redundancy"
  ],
  "explanation": "..."
}
```

The AI receives structured facts from Tracks 2–4 and explains them.

It must not invent:

```text
scores
probabilities
asset rankings
costs
simulation outcomes
```

---

# D. Runtime API Contract

The file schemas define the data. The API defines how modules communicate.

## D1. Network

```text
GET /api/v1/network
```

Returns:

```text
Network
```

## D2. Asset

```text
GET /api/v1/assets/{asset_id}
```

Returns:

```text
Asset
```

## D3. Create scenario

```text
POST /api/v1/scenarios
```

Body:

```text
Scenario
```

Returns:

```text
scenario_id
```

## D4. Run simulation

```text
POST /api/v1/simulations
```

Body:

```json
{
  "scenario_id": "scenario_01"
}
```

Returns:

```json
{
  "simulation_id": "sim_001",
  "status": "RUNNING"
}
```

## D5. Simulation state

```text
GET /api/v1/simulations/{simulation_id}/state
```

Returns:

```text
SimulationState
```

## D6. Simulation events

```text
GET /api/v1/simulations/{simulation_id}/events
```

Returns:

```text
EventCollection
```

## D7. Live events

Optional WebSocket:

```text
WS /api/v1/simulations/{simulation_id}/stream
```

Messages use the canonical event schema.

## D8. Impact

```text
GET /api/v1/scenarios/{scenario_id}/impact
```

## D9. Uncertainty

```text
GET /api/v1/scenarios/{scenario_id}/uncertainty
```

## D10. Criticality

```text
GET /api/v1/scenarios/{scenario_id}/criticality
```

## D11. Optimization

```text
POST /api/v1/scenarios/{scenario_id}/optimize
```

Body:

```json
{
  "budget_inr": 2000000
}
```

## D12. User intervention

```text
POST /api/v1/scenarios/{scenario_id}/interventions
```

Body:

```text
InterventionRequest
```

---

# E. Error Contract

Every API error must use one structure:

```json
{
  "schema_version": "1.0",
  "error": {
    "code": "INVALID_ASSET_ID",
    "message": "Asset does not exist",
    "details": {
      "asset_id": "hospital_999"
    }
  }
}
```

Track 5 must not crash because an API request failed.

It should show:

```text
Unable to load simulation
Retry
```

rather than silently displaying invented values.

---

# F. Mock Contract for Parallel Development

All tracks must be able to work independently.

The repository must contain:

```text
tests/fixtures/
├── mock-osm.geojson
├── mock-network.json
├── mock-scenario.json
├── mock-simulation-state.json
├── mock-simulation-events.json
├── mock-impact-result.json
├── mock-uncertainty-result.json
├── mock-criticality-result.json
├── mock-optimization-result.json
└── mock-advisor-result.json
```

The mock network should contain:

```text
power station
substation
hospital
school
water facility
3+ roads
population zone
```

All mock files must obey the same schemas as production files.

Therefore:

```text
Track 5 can start immediately.
Track 2 can start immediately.
Track 3 can start with mock simulation output.
Track 4 can start with mock simulation/impact output.
Track 1 can replace mock geographic data later.
```

---

# G. Exact ownership boundaries

## Person 1 — Track 1

OWNS:

```text
data/
osm extraction
GeoJSON
nodes
edges
network assembly
provenance
population/facility datasets
data validation
```

MUST NOT:

```text
implement cascade logic
implement optimizer
implement React/Three.js
hardcode simulation outcomes
```

OUTPUT:

```text
osm_features.geojson
nodes.json
edges.json
network.json
facilities.json
population.json
source_manifest.json
```

---

## Person 2 — Track 2

OWNS:

```text
simulation/
state transitions
dependency propagation
capacity/load logic
failure
recovery
simulation time
events
simulation API
```

MUST NOT:

```text
implement UI
hardcode specific Powai assets
calculate human-impact score
calculate optimization
```

INPUT:

```text
network.json
scenario.json
simulation_config.json
```

OUTPUT:

```text
SimulationState
EventCollection
SimulationResult
```

---

## Person 3 — Track 3

OWNS:

```text
impact/
population impact
service disruption
response delay
vulnerability
impact score
uncertainty
Monte Carlo
```

MUST NOT:

```text
change Track 2 propagation rules just to improve numbers
hardcode population affected
implement criticality ranking
implement budget optimization
```

INPUT:

```text
network
population
simulation state
simulation events
```

OUTPUT:

```text
ImpactResult
UncertaintyResult
```

---

## Person 4 — Track 4

OWNS:

```text
criticality
interventions
ROI
optimization
scenario evaluation
AI advisor
```

MUST NOT:

```text
hardcode critical assets
hardcode winning interventions
copy Track 2 propagation code
invent simulation/impact results
```

INPUT:

```text
network
simulation service
impact service
intervention catalogue
budget
```

OUTPUT:

```text
CriticalityResult
OptimizationResult
UserPlanResult
AdvisorResult
```

---

## Person 5 — Track 5

OWNS:

```text
web/
React
TypeScript
Three.js
GeoJSON rendering
3D models
camera
interaction
animation
dashboard
```

MUST NOT:

```text
recalculate simulation
calculate impact
calculate criticality
run optimization independently
hardcode asset IDs
hardcode geographic coordinates
```

INPUT:

```text
osm_features.geojson
network.json
simulation results
impact results
criticality results
optimization results
advisor results
```

OUTPUT:

```text
interactive browser application
```

---

# H. Merge-first development protocol

Before coding:

```text
1. Agree on schemas
2. Agree on ownership
3. Create mock fixtures
4. Create API/interface stubs
```

Then:

```text
5. Each person develops only inside their owned module
6. Unit test their module
7. Commit to feature branch
8. Merge feature branch into develop
9. Run integration tests
10. Fix contract/interface issues
11. Only then merge develop into main
```

Branches:

```text
main
develop

feature/data-graph
feature/simulation
feature/impact-uncertainty
feature/optimization-ai
feature/web-threejs
```

Do not have two people simultaneously rewrite the same core file.

---

# I. Integration checkpoints

## Checkpoint 1

Track 1 provides:

```text
network.json
```

Track 2 loads it **without modifying Track 1's file**.

## Checkpoint 2

Track 2 produces deterministic:

```text
simulation_state
simulation_events
```

Track 3 consumes them.

## Checkpoint 3

Track 3 produces:

```text
impact_result
uncertainty_result
```

Track 4 consumes them.

## Checkpoint 4

Track 4 produces:

```text
criticality_result
optimization_result
advisor_result
```

Track 5 consumes them.

## Checkpoint 5

Complete pipeline:

```text
OSM/Public Data
      ↓
Track 1
      ↓
network.json
      ↓
Track 2
      ↓
simulation state/events
      ↓
Track 3
      ↓
impact + uncertainty
      ↓
Track 4
      ↓
criticality + optimization + advisor
      ↓
Track 5
      ↓
React + Three.js
      ↓
Browser
```

---

# J. Contract validation tests

Before integration, automatically validate:

```text
[ ] schema_version exists
[ ] all asset IDs are unique
[ ] all edge IDs are unique
[ ] every edge.from exists
[ ] every edge.to exists
[ ] every OSM reference is well formed
[ ] GeoJSON coordinates are [longitude, latitude]
[ ] all states are canonical
[ ] all probabilities are 0–1
[ ] all impact scores are 0–1
[ ] all costs are non-negative
[ ] all scenario target IDs exist
[ ] intervention target types are valid
[ ] no duplicate intervention IDs
[ ] simulation seed is recorded
[ ] Monte Carlo iteration count is positive
[ ] no dangling references
```

Track 1 should provide a validator that can be run before every integration.

---

# K. End-to-end deterministic test network

Maintain one tiny permanent test fixture:

```text
Power Station
      |
      v
Substation
      |
      v
Hospital
      |
      v
Population Zone
```

and:

```text
Road A ---- Hospital ---- Road B
```

Test:

```text
Scenario:
Substation fails at t=0
```

Expected behavior must be generated by the model, not hardcoded in Track 5.

The same:

```text
network
scenario
configuration
seed
```

must always give the same deterministic result.

This test is the team's **integration canary**.

---

# L. Definition of "integrated"

The project is not considered integrated merely because all five folders exist.

It is integrated only when:

```text
Track 1 data loads
        ↓
Track 2 runs on that data
        ↓
Track 3 calculates impact from Track 2 output
        ↓
Track 4 calculates criticality/optimization using the shared simulation
        ↓
Track 5 renders the same assets and results
```

and:

```text
Replacing the mock network with the real Powai/Hiranandani network
does not require rewriting Tracks 2–5.
```

That is the final architectural test.

---

# TRACK 5 — THREE.JS 3D CITY, WEB VISUALIZATION & USER EXPERIENCE

## Owner: Person 5

## Goal

Build a **browser-based interactive 3D infrastructure resilience interface** using:

```text
React
TypeScript
Three.js
```

The central question is:

> **How does the planner interact with, understand, and act on the infrastructure model?**

Track 5 is the presentation and interaction layer. It must consume the outputs of Tracks 1–4 rather than reimplement their analytical logic.

---

## 5.1 Technology Stack

Use:

```text
Frontend:
    React
    TypeScript
    Vite

3D:
    Three.js
    WebGLRenderer
    OrthographicCamera
    OrbitControls
    GLTFLoader

Data:
    JSON
    GeoJSON

Communication:
    REST API or WebSocket

Charts/UI:
    React components
    HTML/CSS
```

Three.js provides the 3D renderer and addons such as `OrbitControls` and `GLTFLoader`. Use one consistent Three.js version across the project.

For this project, use `WebGLRenderer` as the default renderer. The system should not depend on WebGPU-specific functionality.

---

## 5.2 Why Three.js Instead of Unity

The final application is a **decision-support and infrastructure-visualization system**, not primarily a game.

Three.js is therefore appropriate because:

- the final application runs directly in a browser
- HTML/CSS can handle complex dashboards naturally
- JSON/API integration is straightforward
- geographic data can be converted into 3D geometry
- infrastructure state can be animated directly
- scenario comparison and analytics can appear beside the 3D map
- deployment is simpler for a hackathon
- Track 5 can remain completely independent of the simulation engine

The target architecture is:

```text
                    TRACK 1
              Geographic Data
                     |
                     | GeoJSON + network.json
                     v
              +--------------+
              |              |
              |   TRACK 2    |
              | Simulation   |
              +------+-------+
                     |
                     | simulation state/events
             +-------+-------+
             |               |
             v               v
        TRACK 3          TRACK 4
     Human Impact      Optimization
     + Uncertainty      + Criticality
             |               |
             +-------+-------+
                     |
                     | standardized JSON/API
                     v
              +--------------+
              |    TRACK 5   |
              | React +       |
              | Three.js      |
              +--------------+
                     |
                     v
                Browser UI
```

---

## 5.3 CRITICAL OWNERSHIP RULE

Track 5 must **never become a second simulation engine**.

Three.js is responsible for:

```text
rendering
camera
interaction
animation
selection
visual state
UI
scenario controls
data presentation
```

Tracks 1–4 remain responsible for:

```text
geographic data preparation
graph construction
failure propagation
time simulation
human impact
uncertainty
criticality
optimization
AI explanation
```

If Track 5 needs a value, it requests or consumes the value from the owning track.

---

# 5.4 OpenStreetMap → Track 1 → GeoJSON → Three.js Pipeline

This is one of the most important parts of Track 5.

The city shown in Three.js must be **geographically grounded**, not manually invented.

The complete pipeline should be:

```text
OpenStreetMap
      |
      v
Overpass API
      |
      v
Track 1 data extraction
      |
      v
Raw OSM data
      |
      v
Filtering + cleaning + normalization
      |
      +----------------------+
      |                      |
      v                      v
osm_features.geojson     network.json
      |                      |
      +----------+-----------+
                 |
                 v
          Track 5 loader
                 |
                 v
       Geographic projection
                 |
                 v
        Three.js coordinates
                 |
                 v
            3D CITY
```

The Overpass API is designed for consumers that need selected OpenStreetMap data and supports queries by location, object type, and tags. Overpass responses can be converted into GeoJSON; Overpass Turbo uses `osmtogeojson` for this conversion.

### Important separation

**Track 1 owns the OSM extraction and geographic data preparation.**

**Track 5 owns the conversion of prepared geographic data into a 3D scene.**

Do NOT have Track 5 silently fetch a different version of OpenStreetMap data from Track 1.

This prevents:

```text
Track 1 map ≠ Track 5 map
```

and makes the final system reproducible.

---

# 5.5 What Track 1 Must Provide to Track 5

Track 1 should provide at minimum:

```text
/data/osm_features.geojson
/data/network.json
/data/nodes.json
/data/edges.json
```

`osm_features.geojson` should contain geographic features such as:

```text
roads
building footprints
water bodies
schools
hospitals
bridges
parks
other relevant mapped features
```

`network.json` should contain the simulation-ready infrastructure graph.

The distinction is:

```text
GeoJSON
    =
Where things physically are

network.json
    =
What things mean to the simulation
```

For example:

```json
{
  "osm_id": "way/123456",
  "geometry_type": "LineString",
  "feature_type": "road",
  "name": "Example Road"
}
```

can be used for rendering.

A separate normalized asset might be:

```json
{
  "id": "road_17",
  "type": "road",
  "osm_id": "way/123456",
  "capacity": 1200,
  "load": 850,
  "status": "OPERATIONAL"
}
```

which is used by the simulation.

---

# 5.6 OpenStreetMap Extraction

Track 1 should use an Overpass query appropriate to the selected Powai Lake–Hiranandani geographic boundary.

Do NOT hardcode a random rectangular map into Track 5.

Instead:

```text
Project geographic boundary
        ↓
Track 1 defines boundary
        ↓
Overpass query
        ↓
OSM features
```

A typical Overpass query structure is:

```text
[out:json];

(
  way["highway"](AREA_OR_BBOX);
  way["building"](AREA_OR_BBOX);
  way["bridge"](AREA_OR_BBOX);
  way["waterway"](AREA_OR_BBOX);
  relation["multipolygon"](AREA_OR_BBOX);
  node["amenity"="hospital"](AREA_OR_BBOX);
  node["amenity"="school"](AREA_OR_BBOX);
);

out body;
>;
out skel qt;
```

The exact area/bounding geometry must be maintained by Track 1 as project data/configuration, not embedded into Three.js source code.

### Required Track 1 preprocessing

Track 1 should:

```text
1. Download OSM data
2. Filter relevant features
3. Convert/normalize geometry
4. Preserve OSM IDs
5. Preserve useful OSM tags
6. Validate geometry
7. Export GeoJSON
8. Build simulation graph
9. Export network.json
```

---

# 5.7 Geographic Coordinates → Three.js Coordinates

Latitude/longitude cannot simply be used as Three.js X/Y coordinates.

Track 5 must convert:

```text
latitude
longitude
```

into a local Cartesian coordinate system:

```text
longitude → X
latitude  → Z
elevation  → Y
```

Use a local origin near the center of the selected study area.

Conceptually:

```text
                 North
                   Z
                   ↑
                   |
         (-X) -----+----- (+X)
                   |
                   |
                   ↓
                 South

                   Y
                   ↑
                 height
```

A simple local projection is sufficient for the hackathon if the geographic area is small.

Do not use raw latitude/longitude as scene coordinates.

### Coordinate conversion requirements

Create one reusable module:

```text
src/geo/coordinateTransform.ts
```

with functions similar to:

```typescript
latLonToWorld(lat, lon)
worldToLatLon(x, z)
```

Every geographic feature must use this same transformation.

This prevents:

```text
road location ≠ building location ≠ hospital location
```

---

# 5.8 Rendering OpenStreetMap Roads

Roads from GeoJSON should become Three.js geometry.

Pipeline:

```text
GeoJSON LineString
       ↓
extract coordinates
       ↓
lat/lon → local X/Z
       ↓
Three.js Line / Tube / custom road mesh
       ↓
city road network
```

For the initial implementation:

```text
minor road      → narrow flat mesh
major road      → wider flat mesh
emergency route → visually distinguishable overlay
bridge          → elevated road mesh
```

Do not create hundreds of individual expensive meshes if they can be batched or grouped.

---

# 5.9 Rendering Buildings

For OSM building footprints:

```text
GeoJSON Polygon
       ↓
local coordinates
       ↓
ShapeGeometry / ExtrudeGeometry
       ↓
3D building
```

Basic extrusion:

```text
building footprint
       +
simulated height
       ↓
3D building
```

### Important data distinction

OSM may provide a building footprint without reliable operational information.

Therefore:

```text
OSM:
    location
    footprint
    tags

SIMULATED:
    height when unavailable
    occupancy
    service load
    infrastructure capacity
```

Do not pretend simulated building properties came from OpenStreetMap.

---

# 5.10 Special Infrastructure Models

For important assets, use custom low-poly GLB/GLTF models.

Examples:

```text
hospital.glb
school.glb
substation.glb
water-pump.glb
power-station.glb
bridge.glb
```

Use the asset's geographic coordinates from Track 1.

Pipeline:

```text
network.json
    ↓
asset ID
    ↓
lat/lon
    ↓
coordinate transform
    ↓
GLTF model
    ↓
Three.js scene
```

Three.js `GLTFLoader` should be used for these models.

---

# 5.11 Infrastructure Asset Registry

Create a single frontend registry:

```text
src/infrastructure/assetRegistry.ts
```

The registry maps **asset type**, not individual asset IDs, to rendering behavior.

Example:

```typescript
const assetVisuals = {
  hospital: hospitalModel,
  school: schoolModel,
  substation: substationModel,
  water_pump: waterPumpModel,
  road: roadRenderer
};
```

Do NOT write:

```typescript
hospital_01 = ...
hospital_02 = ...
substation_01 = ...
```

The renderer must work for any asset coming from `network.json`.

This is essential for the project's **no-hardcoding rule**.

---

# 5.12 Asset Selection

Users must be able to click:

```text
road
building
hospital
school
substation
water pump
bridge
```

Use Three.js raycasting:

```text
Mouse click
    ↓
Raycaster
    ↓
3D object
    ↓
asset_id
    ↓
lookup current state
    ↓
open React side panel
```

The selected asset panel should show:

```text
Asset name
Type
Current state
Capacity
Current load
Population served
Criticality
Dependencies
Dependent services
Location
```

All values must come from backend/data outputs.

---

# 5.13 Dependency Visualization

When an asset is selected:

```text
Hospital
    |
    +---- Power Line
    |
    +---- Water Pump
    |
    +---- Emergency Road
```

The frontend should request or consume dependency relationships from Track 1/2.

Render them as animated Three.js connections.

Example:

```text
POWER STATION
      ║
      ║
      ▼
SUBSTATION
      ║
      ║
      ▼
HOSPITAL
```

When the dependency fails:

```text
SUBSTATION
     X
     ║
     ▼
HOSPITAL
   BACKUP
```

This visualizes the actual graph rather than creating a separate UI-only dependency model.

---

# 5.14 Isometric 3D Camera

Use:

```text
OrthographicCamera
+
OrbitControls
```

Recommended behavior:

```text
Rotation: limited or disabled
Zoom: enabled
Pan: enabled
Tilt: fixed
```

This produces a clean isometric/SimCity-like presentation.

Controls should support:

```text
Mouse wheel → zoom
Middle/right drag → pan
Optional controlled rotation
```

Three.js `OrbitControls` provides orbiting, dollying/zooming, and panning.

---

# 5.15 Main Application Layout

Use normal HTML/CSS for the interface and Three.js only for the 3D scene.

```text
┌──────────────────────────────────────────────────────────────┐
│ CASCADE CITY     ₹2,000,000     ● SIMULATING     04:32      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                    THREE.JS CITY                             │
│                                                              │
│             🏥 Hospital                                     │
│                  ║                                           │
│            ⚡───╨────💧                                       │
│                                                              │
│                                                              │
├──────────────────────┬───────────────────────────────────────┤
│ SELECTED ASSET       │ SIMULATION                            │
│                      │                                       │
│ Hospital             │ ▶  ❚❚  1x  2x  3x                 │
│ Status: BACKUP       │                                       │
│ Load: 78%            │ Time: 04:32                          │
│ Criticality: HIGH    │                                       │
│ Population: 12,400   │                                       │
└──────────────────────┴───────────────────────────────────────┘
```

---

# 5.16 Failure Visualization

Map simulation states to visual behavior.

```text
OPERATIONAL
    ↓
normal model

DEGRADED
    ↓
yellow/orange indicator

BACKUP
    ↓
backup icon + animated indicator

CRITICAL
    ↓
strong warning indicator + pulse

FAILED
    ↓
red/disabled model + failed connection visualization

RECOVERING
    ↓
repair indicator + progress
```

The exact state values must come from Track 2.

The frontend should only map:

```text
state → visual representation
```

It must not determine when a state changes.

---

# 5.17 Animated Cascade Propagation

When Track 2 emits:

```json
{
  "time": 4.0,
  "event": "asset_failed",
  "asset_id": "substation_01",
  "cause": "capacity_exceeded"
}
```

Track 5 should animate:

```text
Substation
    ↓
failure pulse
    ↓
dependency connection
    ↓
Hospital
    ↓
BACKUP
```

For a chain:

```text
A → B → C → D
```

the visualization should reveal:

```text
A fails
 ↓
connection pulses
 ↓
B degrades
 ↓
connection pulses
 ↓
C enters backup
 ↓
connection pulses
 ↓
D fails
```

This makes the cascade understandable to a judge.

---

# 5.18 Simulation Timeline

Implement:

```text
PLAY
PAUSE
STEP
1x
2x
3x
RESET
```

Also include a timeline:

```text
0h ───── 1h ───── 2h ───── 3h ───── 4h ───── 5h
                         ▲
                       NOW
```

The timeline should reflect the simulation time supplied by Track 2.

Do not make the browser clock the source of truth.

---

# 5.19 Failure Mode

Allow:

```text
Select asset
      ↓
Trigger Failure
      ↓
Choose:
    Single failure
    Multiple failure
```

For multiple failures:

```text
Select assets
      ↓
Create Scenario
      ↓
Run Simulation
```

The frontend sends:

```json
{
  "scenario_id": "scenario_01",
  "failures": [
    "substation_01",
    "road_17"
  ]
}
```

Track 2 determines what actually happens.

---

# 5.20 Build / Intervention Mode

Display interventions supplied by Track 4:

```text
BUILD

[Backup Generator]
Cost: ₹500K

[Redundant Power]
Cost: ₹800K

[Water Tank]
Cost: ₹300K

[Alternate Road]
Cost: ₹700K
```

When the user chooses one:

```text
intervention_id
target_asset_id
```

is sent to Track 4.

Track 5 must not decide whether the intervention is mathematically effective.

Track 4 evaluates it.

---

# 5.21 Budget UI

Display:

```text
AVAILABLE BUDGET
₹2,000,000

SPENT
₹1,300,000

REMAINING
₹700,000
```

Budget values come from the scenario/optimization layer.

Do not hardcode:

```text
budget = 2000000
```

The ₹2,000,000 value may be the demo default configuration, but it must be supplied through scenario/configuration data.

---

# 5.22 Human Impact Dashboard

Display:

```text
POPULATION AFFECTED
12,400

HOSPITAL DISRUPTIONS
1

SCHOOLS AFFECTED
2

EMERGENCY DELAY
14 min

CASCADE IMPACT SCORE
0.51
```

For uncertainty:

```text
EXPECTED POPULATION
12,400

LIKELY RANGE
8,100 – 19,700

PROBABILITY OF HOSPITAL FAILURE
67%
```

All numbers are outputs from Track 3.

Track 5 only visualizes them.

---

# 5.23 Criticality Visualization

When Track 4 returns:

```json
{
  "critical_assets": [
    {
      "asset_id": "substation_01",
      "criticality": 0.91
    }
  ]
}
```

show it visually:

```text
HIGH CRITICALITY
██████████████████ 0.91
```

On the map:

```text
substation
    ↓
criticality halo
```

Similarly for edges:

```text
critical road
══════════════════
        ↑
   high criticality
```

Do not calculate criticality in React/Three.js.

---

# 5.24 Scenario Comparison

Allow:

```text
Scenario A
Scenario B
Scenario C
```

Then:

```text
                         A        B        C

Population affected    18,200    9,400    12,100

Impact Score             0.72     0.39      0.51

Hospital disruptions        2        1         1

Response delay            22m       9m       14m
```

The scenario results must come from the backend.

The frontend only compares and visualizes them.

---

# 5.25 Advisor Screen

Display Track 4's structured recommendation:

```text
RESILIENCE ADVISOR

Your plan reduced cascade damage by 34%.

The best allocation for the same budget
reduces damage by 61%.

WHY?

1. The hospital's power connection was a major
   bottleneck.

2. The water pump had no redundancy.

3. Your bridge intervention improved response
   time but did not reduce the largest cascade.

[SHOW OPTIMAL PLAN]
```

The AI explanation itself comes from Track 4.

Three.js should highlight the recommended assets when the user clicks:

```text
SHOW OPTIMAL PLAN
```

---

# 5.26 Uncertainty Visualization

Use simple visual distributions rather than only percentages.

Example:

```text
Population affected

8,100 ├───────────────████████████████──────────────┤ 19,700
                    likely range

                 12,400
                  median
```

For probability:

```text
Hospital failure within 6h

██████████████░░░░░░
       67%
```

Optional:

```text
Monte Carlo histogram
```

The raw Monte Carlo simulation belongs to Track 3.

---

# 5.27 3D Visual Effects

Use visual effects to communicate the cascade, not merely to make the application decorative.

Recommended effects:

```text
failure pulse
dependency-line animation
warning halo
repair animation
emergency-route highlighting
capacity/load indicators
water/power flow indicators
camera focus on failed asset
```

Example:

```text
Power failure
     ↓
camera focuses on substation
     ↓
failure pulse
     ↓
animated dependency line
     ↓
camera transitions to hospital
     ↓
hospital switches to BACKUP
```

This should be triggered by simulation events, not hardcoded story sequences.

---

# 5.28 Data Communication Architecture

Recommended architecture:

```text
React / Three.js
       |
       | HTTP REST
       v
Python Backend
       |
       +------ Track 1
       +------ Track 2
       +------ Track 3
       +------ Track 4
```

For live simulation:

```text
React / Three.js
       |
       | WebSocket
       v
Simulation Backend
       |
       v
Events / State Updates
```

Use REST for:

```text
load network
load scenarios
load asset information
submit interventions
request optimization
```

Use WebSocket for:

```text
simulation time
state changes
cascade events
live updates
```

A simpler hackathon MVP can use REST polling first and add WebSocket updates later.

---

# 5.29 Frontend API Contract

Create:

```text
src/api/simulationClient.ts
```

with functions such as:

```typescript
getNetwork()
getAsset(assetId)
createScenario(scenario)
startSimulation(scenarioId)
pauseSimulation()
resetSimulation()
getSimulationState()
getImpactResult(scenarioId)
getCriticality()
getOptimizationResult(scenarioId)
applyIntervention(intervention)
```

The exact endpoint names are a team-level interface decision.

Do not embed Track 2/3/4 internal Python functions directly into the frontend.

---

# 5.30 Frontend Data Model

Create TypeScript interfaces matching the shared contract.

Example:

```typescript
interface Asset {
    id: string;
    type: string;
    name: string;
    location: {
        latitude: number;
        longitude: number;
    };
    capacity?: number;
    load?: number;
    population_served?: number;
    state: InfrastructureState;
}
```

Simulation state:

```typescript
interface SimulationState {
    time: number;
    failed_nodes: string[];
    degraded_nodes: string[];
    backup_nodes: string[];
    affected_edges: string[];
}
```

Scenario:

```typescript
interface Scenario {
    id: string;
    failures: string[];
    interventions: string[];
    budget: number;
}
```

These interfaces must mirror the agreed shared data contract.

---

# 5.31 Recommended Repository Structure

Replace the old Unity Track 5 directory with:

```text
web/
│
├── public/
│   ├── models/
│   └── textures/
│
├── src/
│   ├── api/
│   │   └── simulationClient.ts
│   │
│   ├── components/
│   │   ├── Dashboard/
│   │   ├── AssetPanel/
│   │   ├── SimulationControls/
│   │   ├── BuildMenu/
│   │   ├── ScenarioComparison/
│   │   ├── Advisor/
│   │   └── ImpactPanel/
│   │
│   ├── three/
│   │   ├── SceneManager.ts
│   │   ├── CameraManager.ts
│   │   ├── RaycastManager.ts
│   │   ├── GeoJSONRenderer.ts
│   │   ├── RoadRenderer.ts
│   │   ├── BuildingRenderer.ts
│   │   ├── AssetRenderer.ts
│   │   ├── DependencyRenderer.ts
│   │   └── CascadeEffects.ts
│   │
│   ├── geo/
│   │   ├── coordinateTransform.ts
│   │   └── geojsonTypes.ts
│   │
│   ├── state/
│   │   └── applicationState.ts
│   │
│   ├── types/
│   │   ├── asset.ts
│   │   ├── simulation.ts
│   │   ├── scenario.ts
│   │   └── impact.ts
│   │
│   └── App.tsx
│
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

# 5.32 Installation

Initialize:

```bash
npm create vite@latest web -- --template react-ts
cd web
npm install
```

Install Three.js:

```bash
npm install three
npm install -D @types/three
```

For the first version, do not add a large collection of unnecessary libraries.

Recommended additional libraries only if needed:

```text
react-router
charting library
state management library
```

Keep the dependency tree small during the hackathon.

---

# 5.33 Initial Development Sequence

Do NOT start by building the beautiful city.

Build in this order:

### Step 1 — Empty Three.js scene

```text
React
  ↓
Three.js
  ↓
camera
  ↓
renderer
```

### Step 2 — Load a test GeoJSON

Use a tiny test:

```text
3 roads
2 buildings
1 hospital
```

### Step 3 — Coordinate transformation

Verify that all features line up correctly.

### Step 4 — Render real OSM GeoJSON

Load:

```text
osm_features.geojson
```

and render:

```text
roads
buildings
water
facilities
```

### Step 5 — Add simulation asset mapping

Connect:

```text
OSM feature
    ↓
network asset
    ↓
asset_id
```

### Step 6 — Asset selection

Click a building/road and display its metadata.

### Step 7 — Connect Track 2

Trigger a real simulation and visualize:

```text
OPERATIONAL
→ DEGRADED
→ BACKUP
→ CRITICAL
→ FAILED
```

### Step 8 — Human impact

Connect Track 3.

### Step 9 — Criticality and interventions

Connect Track 4.

### Step 10 — Polish

Only now add:

```text
animations
camera transitions
particles
better models
charts
visual effects
```

---

# 5.34 Definition of Done

Track 5 is complete when:

### Geographic visualization

- Real Powai/Hiranandani geographic data is displayed.
- OpenStreetMap roads/buildings/features are rendered.
- Geographic coordinates are converted consistently.
- Hospital, schools and important infrastructure can be represented.
- OSM attribution is visible in the application.

### 3D interaction

- Isometric-style camera works.
- Users can pan and zoom.
- Assets can be selected.
- Selected assets are highlighted.
- Dependency relationships can be displayed.

### Simulation

- User can trigger failures.
- Single and multiple failure scenarios are supported.
- Simulation playback works.
- State transitions are visually represented.
- Cascade propagation is animated.

### Human impact

- Population affected is displayed.
- Emergency response delay is displayed.
- Critical-service disruption is displayed.
- Uncertainty ranges are displayed.

### Decision support

- Critical assets are highlighted.
- Critical connections are highlighted.
- Interventions can be selected.
- Budget is visible.
- User and optimal plans can be compared.
- Advisor explanation is displayed.

### Scenario analysis

- Scenarios can be saved.
- Scenarios can be compared.
- Results can be visualized side-by-side.

### Architecture

- No simulation logic is duplicated in the frontend.
- No infrastructure outcomes are hardcoded.
- No specific Powai/Hiranandani asset IDs are embedded into renderer logic.
- Track 5 consumes standardized Track 1–4 outputs.
- The application can run against a different valid network dataset without rewriting the rendering engine.

---

# 5.35 NO-HARDCODING RULES SPECIFIC TO TRACK 5

The following are forbidden:

```typescript
if (asset.id === "hospital_01") {
    showCritical();
}
```

Forbidden:

```typescript
const hospitalPosition = [19.12, 72.91];
```

Forbidden:

```typescript
const criticalAssets = [
    "substation_01",
    "hospital_01"
];
```

Forbidden:

```typescript
if (time > 6) {
    hospitalFails();
}
```

Instead:

```text
asset data
    ↓
simulation state
    ↓
frontend visualization
```

The renderer must be generic.

If Track 1 changes:

```text
hospital_01
```

to:

```text
hospital_07
```

Track 5 should continue working.

If Track 1 changes the geographic area, Track 5 should render the new valid GeoJSON without requiring a new renderer.

---

# 5.36 Performance Rules

The real Powai/Hiranandani area may contain many OSM features.

Therefore:

```text
DO:
- group meshes
- reuse geometries/materials
- reuse GLTF models
- avoid unnecessary per-frame calculations
- simplify distant buildings
- avoid creating thousands of unnecessary objects
```

For roads/buildings:

```text
OSM data
    ↓
filter
    ↓
simplify
    ↓
batch/group
    ↓
Three.js
```

The objective is not to render every OSM detail.

The objective is to create a visually convincing **infrastructure-resilience model**.

---

# 5.37 OpenStreetMap Attribution

Because the application uses OpenStreetMap data, include visible attribution in the UI:

```text
© OpenStreetMap contributors
```

and provide a link to the OpenStreetMap copyright/license information.

Place it in a map corner or another clearly visible location.

Do not imply that all geographic information comes from OpenStreetMap if additional datasets are used.

The project should distinguish:

```text
OpenStreetMap:
roads
buildings
mapped geographic features

Other public datasets:
demographics
facility information
administrative information

Simulated:
capacity
load
backup duration
failure threshold
recovery time
dependency strength
population served where not sourced
failure probability
```

---

# 5.38 Track 5 Final Deliverable

Person 5 must deliver:

```text
A browser-based 3D infrastructure resilience interface
```

with this pipeline working:

```text
             OpenStreetMap
                  ↓
              Track 1
                  ↓
        GeoJSON + Network Graph
                  ↓
              Track 5
                  ↓
        Geographic Projection
                  ↓
           Three.js 3D City
                  ↓
       +----------+----------+
       |          |          |
       v          v          v
   Simulation   Impact   Optimization
       |          |          |
       +----------+----------+
                  ↓
          Interactive UI
```

The final judge experience should be:

```text
1. Open browser
       ↓
2. See real Powai/Hiranandani geography
       ↓
3. Click hospital
       ↓
4. See its dependencies
       ↓
5. Trigger power failure
       ↓
6. Watch cascade propagate
       ↓
7. See hospital enter BACKUP
       ↓
8. See road/emergency consequences
       ↓
9. See population affected
       ↓
10. See uncertainty
       ↓
11. Highlight critical connection
       ↓
12. Give planner a budget
       ↓
13. Buy intervention
       ↓
14. Run same scenario again
       ↓
15. See improvement
       ↓
16. Show optimal plan
       ↓
17. Compare user vs optimal
       ↓
18. AI explains the difference
```

This is the Track 5 implementation target.


# 4. COMMON DATA & INTERFACE CONTRACT — ALL FIVE TRACKS

This section is the **single source of truth for communication between the five tracks**.

The purpose is to ensure that:

```text
Track 1 → Track 2 → Track 3
              ↓        ↓
             Track 4
                ↓
             Track 5
```

can be developed independently while remaining completely coherent when merged.

**No track should invent its own version of these structures.**

If a track needs information that is not present in the contract, the team must extend the shared contract rather than creating a private incompatible format.

---

## 4.1 Contract Principles

### Principle 1 — Data flows forward

The intended dependency direction is:

```text
TRACK 1
Geographic + Infrastructure Data
        ↓
TRACK 2
Simulation State + Events
        ↓
TRACK 3
Human Impact + Uncertainty
        ↓
TRACK 4
Criticality + Intervention + Optimization
        ↓
TRACK 5
Visualization + User Interaction
```

Track 4 may consume outputs from Tracks 1–3 directly because criticality and optimization require the network and impact model.

Track 5 consumes outputs from all analytical tracks.

---

### Principle 2 — One source of truth

Each concept has one owner:

| Information | Owner |
|---|---|
| Geographic features | Track 1 |
| Infrastructure graph | Track 1 |
| Asset properties | Track 1 |
| Failure propagation | Track 2 |
| Simulation time/state | Track 2 |
| Cascade events | Track 2 |
| Human impact | Track 3 |
| Uncertainty / Monte Carlo | Track 3 |
| Node criticality | Track 4 |
| Edge criticality | Track 4 |
| Intervention definitions | Track 4 |
| Budget optimization | Track 4 |
| AI explanation | Track 4 |
| 3D rendering | Track 5 |
| UI state / presentation | Track 5 |

A track may consume another track's output, but must not recreate its source of truth.

---

### Principle 3 — IDs are the glue

Every infrastructure object must have a globally unique, stable `id`.

Example:

```text
hospital_01
substation_01
water_pump_01
road_17
bridge_03
```

Connections reference these IDs:

```text
from → substation_01
to   → hospital_01
```

Simulation events reference them:

```text
asset_id → hospital_01
```

Track 5 uses the same IDs to locate and visualize objects.

**Never use array position, object name, or scene hierarchy position as the cross-track identifier.**

---

### Principle 4 — No hidden assumptions

A receiving track must not assume:

```text
hospital_01 always exists
substation_01 is always critical
time = 6 means hospital failure
road_17 is always the ambulance route
```

Those are model/data results, not frontend assumptions.

---

# 4.2 Track-to-Track Interface Contract

## TRACK 1 → TRACK 2

### Track 1 INPUT

```text
OpenStreetMap
Public geographic datasets
Public facility information
Public demographic information
Simulated operational parameters
```

### Track 1 OUTPUT

```text
osm_features.geojson
nodes.json
edges.json
network.json
facilities.json
population.json
```

Track 2 must be able to load the network programmatically.

---

## TRACK 2 → TRACK 3

### Track 2 INPUT

```text
network.json
scenario.json
simulation configuration
```

### Track 2 OUTPUT

```text
simulation_state.json
simulation_events.json
```

Track 3 must calculate human consequences from these outputs rather than recreating propagation.

---

## TRACK 2 → TRACK 4

Track 4 uses Track 2 to evaluate:

```text
node removal
edge removal
failure scenarios
intervention effects
```

Track 4 should call the simulation through a defined interface or consume standardized simulation results.

It must not copy Track 2's propagation algorithm.

---

## TRACK 3 → TRACK 4

### Track 3 OUTPUT

```text
impact_result.json
uncertainty_result.json
```

Track 4 uses these outputs to compare:

```text
baseline impact
failure impact
intervention impact
criticality impact
```

---

## TRACK 1 + TRACK 2 + TRACK 3 + TRACK 4 → TRACK 5

Track 5 consumes:

```text
network.json
osm_features.geojson
simulation_state.json
simulation_events.json
impact_result.json
uncertainty_result.json
criticality_result.json
optimization_result.json
advisor_result.json
```

Track 5 does not calculate these analytical results.

---

# 4.3 Geographic Feature Contract

File:

```text
/data/osm_features.geojson
```

Use standard GeoJSON structure.

Example:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "osm_id": "way/123456",
        "feature_type": "road",
        "name": "Example Road"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [72.91, 19.12],
          [72.92, 19.13]
        ]
      }
    }
  ]
}
```

### Required rules

- Coordinates remain in GeoJSON `[longitude, latitude]` order.
- Preserve the original OSM identifier when available.
- `feature_type` identifies the rendering/feature category.
- Track 5 performs the conversion from geographic coordinates to local Three.js coordinates.
- Track 1 owns geographic extraction and cleaning.

Possible `feature_type` values:

```text
road
building
water
bridge
hospital
school
park
other
```

The list can be extended without changing the rendering architecture.

---

# 4.4 Infrastructure Asset Contract

File:

```text
/data/nodes.json
```

Example:

```json
{
  "id": "hospital_01",
  "type": "hospital",
  "name": "Hospital",
  "osm_id": "node/123456",
  "location": {
    "latitude": 19.12,
    "longitude": 72.91
  },
  "capacity": 100,
  "load": 72,
  "population_served": 15000,
  "backup_duration": 6,
  "failure_threshold": 90,
  "recovery_time": 4,
  "status": "OPERATIONAL"
}
```

### Required identity fields

```text
id
type
name
location
```

### Operational fields

Where available:

```text
capacity
load
population_served
backup_duration
failure_threshold
recovery_time
```

These operational values may be simulated when public values are unavailable.

---

# 4.5 Connection / Edge Contract

File:

```text
/data/edges.json
```

Example:

```json
{
  "id": "power_connection_01",
  "from": "substation_01",
  "to": "hospital_01",
  "type": "power_dependency",
  "capacity": 100,
  "load": 75,
  "dependency_strength": 1.0,
  "failure_probability": 0.05,
  "state": "OPERATIONAL"
}
```

### Required fields

```text
id
from
to
type
```

Optional/model fields:

```text
capacity
load
dependency_strength
failure_probability
state
```

Possible connection types:

```text
power_dependency
water_dependency
road_connection
emergency_route
service_dependency
```

Both **node failure and edge failure** must be supported.

---

# 4.6 Scenario Contract

File:

```text
/scenarios/<scenario_id>.json
```

Example:

```json
{
  "id": "scenario_01",
  "name": "Power + Road Disruption",
  "failures": [
    "substation_01",
    "road_17"
  ],
  "interventions": [],
  "budget": 2000000,
  "duration": 24,
  "random_seed": 42
}
```

### Required fields

```text
id
failures
interventions
budget
duration
```

`random_seed` should be provided whenever reproducibility is required.

This is especially important for Monte Carlo testing.

---

# 4.7 Simulation Configuration Contract

Simulation rules must be configurable.

Example:

```json
{
  "time_step": 0.1,
  "states": [
    "OPERATIONAL",
    "DEGRADED",
    "BACKUP",
    "CRITICAL",
    "FAILED",
    "RECOVERING"
  ],
  "default_monte_carlo_iterations": 1000
}
```

The exact configuration may evolve, but it must be externalized rather than hidden inside propagation code.

---

# 4.8 Simulation State Contract

File/output:

```text
simulation_state.json
```

Example:

```json
{
  "scenario_id": "scenario_01",
  "time": 4.5,
  "assets": {
    "substation_01": {
      "state": "FAILED",
      "load": 0
    },
    "hospital_01": {
      "state": "BACKUP",
      "load": 78
    }
  },
  "failed_nodes": [
    "substation_01"
  ],
  "degraded_nodes": [],
  "backup_nodes": [
    "hospital_01"
  ],
  "critical_nodes": [],
  "affected_edges": [
    "power_connection_01"
  ]
}
```

### Track 2 owns

```text
time
state transitions
load/capacity consequences
propagation
recovery
```

### Track 5 owns only

```text
state → visual representation
```

---

# 4.9 Simulation Event Contract

File/output:

```text
simulation_events.json
```

Example:

```json
{
  "time": 4.5,
  "event": "asset_failed",
  "asset_id": "hospital_01",
  "cause": "backup_exhausted"
}
```

Possible event types:

```text
asset_failed
asset_degraded
asset_backup
asset_critical
asset_recovering
asset_recovered
edge_failed
capacity_exceeded
dependency_lost
```

Track 5 uses these events to drive animations.

Example:

```text
asset_failed
      ↓
failure pulse
      ↓
dependency animation
      ↓
UI update
```

---

# 4.10 Human Impact Contract

File/output:

```text
impact_result.json
```

Example:

```json
{
  "scenario_id": "scenario_01",
  "population_affected": 12400,
  "duration_hours": 6.1,
  "emergency_response_delay_minutes": 14,
  "hospital_disruptions": 1,
  "school_disruptions": 2,
  "water_service_disruptions": 1,
  "power_service_disruptions": 3,
  "impact_score": 0.51
}
```

### Track 3 owns these calculations.

Track 5 must display them without changing the underlying values.

---

# 4.11 Uncertainty Contract

File/output:

```text
uncertainty_result.json
```

Example:

```json
{
  "scenario_id": "scenario_01",
  "iterations": 1000,
  "random_seed": 42,
  "population_affected": {
    "mean": 12400,
    "median": 11900,
    "p05": 8100,
    "p95": 19700
  },
  "hospital_failure_probability": 0.67,
  "hospital_failure_time_hours": {
    "median": 6.1,
    "p05": 5.2,
    "p95": 7.4
  }
}
```

Track 3 owns:

```text
parameter sampling
Monte Carlo
distribution generation
probability calculation
percentiles
```

Track 5 owns:

```text
histogram
range display
probability display
```

---

# 4.12 Criticality Contract

File/output:

```text
criticality_result.json
```

Example:

```json
{
  "scenario_id": "scenario_01",
  "nodes": [
    {
      "asset_id": "substation_01",
      "criticality_score": 0.91,
      "baseline_impact": 0.31,
      "removal_impact": 0.91
    }
  ],
  "edges": [
    {
      "edge_id": "power_connection_01",
      "criticality_score": 0.87,
      "baseline_impact": 0.31,
      "removal_impact": 0.87
    }
  ]
}
```

Track 4 owns criticality calculations.

The ranking must be generated dynamically.

Track 5 only visualizes:

```text
criticality score
ranking
map highlight
```

---

# 4.13 Intervention Contract

File:

```text
/interventions/interventions.json
```

Example:

```json
{
  "id": "backup_generator",
  "name": "Backup Generator",
  "target_types": [
    "hospital"
  ],
  "cost": 500000,
  "effects": {
    "backup_duration_hours": 6
  },
  "constraints": []
}
```

Every intervention should define:

```text
id
name
target_types
cost
effects
constraints
```

The intervention library must be data-driven.

Track 4 determines whether and where an intervention is beneficial.

Track 5 displays and submits the user's selected intervention.

---

# 4.14 User Intervention Request Contract

When the user selects an intervention:

```json
{
  "scenario_id": "scenario_01",
  "target_asset_id": "hospital_01",
  "intervention_id": "backup_generator"
}
```

Track 5 sends this request.

Track 4 evaluates it.

Track 5 does not determine its effectiveness.

---

# 4.15 Optimization Result Contract

File/output:

```text
optimization_result.json
```

Example:

```json
{
  "scenario_id": "scenario_01",
  "budget": 2000000,
  "selected_interventions": [
    {
      "intervention_id": "backup_generator",
      "target_asset_id": "hospital_01",
      "cost": 500000
    }
  ],
  "total_cost": 1800000,
  "baseline_impact": 0.72,
  "optimized_impact": 0.31,
  "impact_reduction": 0.41
}
```

Track 4 owns:

```text
optimization
budget constraint
intervention combination
impact comparison
ROI
```

Track 5 visualizes the result.

---

# 4.16 User Plan Result Contract

Example:

```json
{
  "scenario_id": "scenario_01",
  "budget": 2000000,
  "selected_interventions": [
    {
      "intervention_id": "reinforced_bridge",
      "target_asset_id": "bridge_03",
      "cost": 700000
    }
  ],
  "total_cost": 1700000,
  "baseline_impact": 0.72,
  "resulting_impact": 0.48,
  "impact_reduction": 0.24
}
```

Track 4 evaluates this.

Track 5 displays it.

---

# 4.17 Advisor Result Contract

Track 4 should give the AI structured information rather than asking the AI to infer the entire simulation.

Example:

```json
{
  "scenario_id": "scenario_01",
  "user_plan": {
    "impact": 0.48,
    "impact_reduction": 0.24
  },
  "optimal_plan": {
    "impact": 0.31,
    "impact_reduction": 0.41
  },
  "missed_critical_assets": [
    "substation_01"
  ],
  "missed_critical_edges": [
    "power_connection_01"
  ],
  "priority_reasons": [
    "major hospital power bottleneck",
    "low redundancy"
  ]
}
```

The AI generates the explanation from these structured facts.

It must not invent numerical results.

---

# 4.18 Track 5 Frontend Contract

Track 5 should expose a clean frontend interface around the backend.

```typescript
interface SimulationClient {
    getNetwork(): Promise<Network>;
    getAsset(assetId: string): Promise<Asset>;
    createScenario(scenario: Scenario): Promise<Scenario>;
    startSimulation(scenarioId: string): Promise<void>;
    pauseSimulation(): Promise<void>;
    resetSimulation(): Promise<void>;
    getSimulationState(): Promise<SimulationState>;
    getImpactResult(scenarioId: string): Promise<ImpactResult>;
    getUncertaintyResult(scenarioId: string): Promise<UncertaintyResult>;
    getCriticalityResult(scenarioId: string): Promise<CriticalityResult>;
    getOptimizationResult(scenarioId: string): Promise<OptimizationResult>;
    applyIntervention(request: InterventionRequest): Promise<void>;
}
```

The exact API technology may be:

```text
REST
WebSocket
local JSON during early development
```

but the **data structures remain the same**.

---

# 4.19 Track 5 Internal Rendering Contract

Track 5 should have a strict separation between:

```text
DATA
  ↓
DOMAIN STATE
  ↓
3D RENDERING
  ↓
UI
```

Example:

```text
simulation_state.json
        ↓
applicationState
        ↓
AssetRenderer
        ↓
Three.js mesh
```

Do not allow UI components to directly manipulate backend data.

---

# 4.20 Mock Data Contract for Parallel Development

Track 5 can start before Track 1 is complete.

The team must therefore maintain a small mock dataset conforming to the **same shared schemas**.

Example:

```text
/tests/fixtures/
    mock-osm.geojson
    mock-network.json
    mock-scenario.json
    mock-simulation-state.json
    mock-impact-result.json
    mock-uncertainty-result.json
    mock-criticality-result.json
    mock-optimization-result.json
```

The mock data should represent:

```text
Power Station
      ↓
Substation
      ↓
Hospital
      ↓
Population
```

plus a few roads/buildings.

The critical requirement is:

> **Mock data must have exactly the same structure as production data.**

Therefore Track 5 can develop against mock data and later replace:

```text
mock-osm.geojson
```

with:

```text
osm_features.geojson
```

without changing the renderer.

---

# 4.21 Contract Versioning

Add a version to the shared contract.

Example:

```json
{
  "schema_version": "1.0"
}
```

All major shared files should carry the version where practical.

If the team changes a field:

```text
schema_version 1.0
        ↓
schema_version 1.1
```

the change must be communicated to all affected tracks before merging.

Do not silently change:

```text
field names
ID formats
state names
units
coordinate conventions
```

---

# 4.22 Units Contract

The team must agree on units.

Recommended:

```text
distance        → meters
time            → hours
speed           → km/h
capacity        → asset-specific documented unit
load             → same unit as capacity
population       → people
response delay   → minutes
cost             → Indian Rupees
probability      → 0–1
impact score     → 0–1
latitude         → decimal degrees
longitude        → decimal degrees
```

If a field uses another unit, it must be explicitly named or documented.

Examples:

```text
backup_duration_hours
response_delay_minutes
cost_inr
```

Avoid ambiguous fields such as:

```text
duration
cost
capacity
```

when the unit is not obvious.

---

# 4.23 State Contract

Use exactly the following canonical infrastructure states:

```text
OPERATIONAL
DEGRADED
BACKUP
CRITICAL
FAILED
RECOVERING
```

All tracks must use these exact values.

Do not create:

```text
broken
dead
warning
almost_failed
```

as alternate backend state names.

Track 5 may translate them into human-readable UI labels:

```text
FAILED → Failed
BACKUP → Running on Backup
```

but the underlying state remains canonical.

---

# 4.24 Contract Checklist Before Integration

Before merging tracks, verify:

```text
[ ] Same asset IDs
[ ] Same edge IDs
[ ] Same state names
[ ] Same coordinate convention
[ ] Same units
[ ] Same scenario format
[ ] Same simulation-state format
[ ] Same event format
[ ] Same impact format
[ ] Same uncertainty format
[ ] Same criticality format
[ ] Same intervention format
[ ] Same optimization format
[ ] Same schema version
[ ] No duplicated analytical logic
[ ] No hardcoded infrastructure outcomes
```

If any item fails, fix the contract/interface before attempting full integration.

---

# 5. Repository Structure

```text
cascading-failure/
│
├── data/
│   ├── nodes.json
│   ├── edges.json
│   ├── network.json
│   └── population.json
│
├── simulation/
│   ├── graph/
│   ├── propagation/
│   ├── states/
│   └── recovery/
│
├── impact/
│   ├── population/
│   ├── response/
│   └── uncertainty/
│
├── optimization/
│   ├── criticality/
│   ├── interventions/
│   ├── budget/
│   └── advisor/
│
├── unity/
│   ├── Assets/
│   ├── Scenes/
│   ├── Scripts/
│   └── UI/
│
├── tests/
│
└── README.md
```

---

# 6. Git Branches

Use:

```text
main
develop
```

Feature branches:

```text
feature/data-graph
feature/simulation
feature/impact-uncertainty
feature/optimization-ai
feature/unity-ui
```

Nobody should directly push experimental work to `main`.

---


# 6.1 MERGE PROTOCOL

Use the following process for every track:

```text
1. Agree on schema/interface
        ↓
2. Person develops independently
        ↓
3. Write unit tests
        ↓
4. Commit to feature branch
        ↓
5. Merge into develop
        ↓
6. Run integration tests
        ↓
7. Fix interface issues
        ↓
8. Only then merge into main
```

### Integration checkpoints

The team should verify the pipeline incrementally.

#### Checkpoint 1 — Track 1 → Track 2

Track 1 provides:

```text
network.json
```

Track 2 must be able to load and use it **without modifying Track 1's implementation or embedding replacement data**.

#### Checkpoint 2 — Track 2 → Track 3

Track 2 provides a deterministic test scenario and standardized simulation output.

Track 3 consumes that output **without depending on Track 2's internal classes or propagation implementation**.

#### Checkpoint 3 — Track 3 → Track 4

Track 3 provides a standardized human-impact result.

Track 4 consumes that result for criticality/optimization evaluation.

#### Checkpoint 4 — Track 4 → Track 5

Track 4 provides a standardized optimization/decision result.

Track 5 visualizes that result; it does not recalculate it.

### End-to-end contract

The final architecture must preserve this pipeline:

```text
Network Data
     ↓
Failure Scenario
     ↓
Cascade Simulation
     ↓
Human Impact
     ↓
Criticality / Optimization
     ↓
Unity Visualization
```

### Deterministic integration test

Maintain one tiny deterministic network for regression testing:

```text
Power Station
      ↓
Substation
      ↓
Hospital
      ↓
Population
```

The same input data, scenario, configuration, and random seed should produce the same result.

This test network is for **software integration testing only**. It must not replace the real Powai/Hiranandani network in the final demonstration.

# 7. Integration Plan

## Phase 1 — Foundation

All five people agree on:

- node schema
- edge schema
- state definitions
- simulation time representation
- scenario format
- intervention format

### Deliverable

A tiny test network:

```text
Power Station
      |
Substation
      |
Hospital
      |
Population
```

---

## Phase 2 — Minimal End-to-End Prototype

First make this work:

```text
Unity
  ↓
select substation
  ↓
fail substation
  ↓
simulation engine
  ↓
hospital enters backup
  ↓
backup expires
  ↓
hospital fails
  ↓
human impact calculated
  ↓
Unity displays affected population
```

If this works, the architecture works.

---

## Phase 3 — Real Geographic Network

Replace the toy network with:

**Powai Lake + Hiranandani**

Add:

- roads
- hospital
- schools
- residential areas
- power
- water
- emergency routes

---

## Phase 4 — Advanced Features

Add:

```text
Multiple failures
       ↓
Edge failures
       ↓
Criticality
       ↓
Monte Carlo
       ↓
Interventions
       ↓
Budget optimization
       ↓
Scenario comparison
       ↓
AI advisor
```

---

## Phase 5 — Presentation Polish

Only after the analytical pipeline works:

- improve Unity visuals
- improve animations
- improve map readability
- improve UI
- add advisor presentation
- improve scenario comparison

Do not spend the first half of the project making the city beautiful.

---

# 8. Testing Strategy

Every track must have tests.

## Track 1

Test:

```text
Can every edge resolve its nodes?
Are coordinates valid?
Is the graph connected where expected?
```

## Track 2

Test:

```text
One failure → expected secondary failure
Two failures → correct combined result
Backup → eventual failure
Recovery → correct restoration
```

## Track 3

Test:

```text
Population counts
Travel-time changes
Impact score
Monte Carlo distribution
```

## Track 4

Test:

```text
Critical asset ranking
Critical edge ranking
Budget constraint
Optimal intervention
User vs optimal plan
```

## Track 5

Test:

```text
Click asset
Trigger failure
Play/pause
Display state
Place intervention
Display results
```

---

# 9. Flagship Integration Scenario

Create one scenario that demonstrates the whole system.

## Power Failure + Road Disruption

```text
Power infrastructure fails
          +
Critical road connection fails
          |
          v
Hospital loses primary power
          |
          v
Hospital switches to backup
          |
          +------------------+
          |                  |
          v                  v
Generator fuel         Ambulance route
decreases              becomes longer
          |                  |
          v                  v
Hospital approaches    Emergency response
failure                time increases
          |                  |
          +--------+---------+
                   |
                   v
              HUMAN IMPACT
```

The simulator should produce:

```text
Assets affected
Population affected
Hospital impact
School impact
Emergency delay
Cascade Impact Score
Probability distribution
Most critical asset
Most critical connection
Best intervention
Optimal budget allocation
```

If this works convincingly, the project demonstrates essentially the entire problem statement.

---

# 10. Work Distribution Summary

## Person 1 — The Mapper

Owns:

```text
OpenStreetMap
Powai/Hiranandani data
Nodes
Edges
Geographic representation
Data validation
```

Deliverable:

**A usable infrastructure graph.**

## Person 2 — The Simulator

Owns:

```text
Failure
Propagation
Capacity
Dependencies
Time
Backup
Recovery
```

Deliverable:

**A functioning cascade engine.**

## Person 3 — The Impact Analyst

Owns:

```text
Population
Human impact
Emergency response
Impact score
Uncertainty
Monte Carlo
```

Deliverable:

**A quantified consequence model.**

## Person 4 — The Decision Engine

Owns:

```text
Criticality
Edge criticality
Interventions
ROI
Budget optimization
AI advisor
```

Deliverable:

**A system that tells planners where intervention matters most.**

## Person 5 — The City Builder

Owns:

```text
Unity
Isometric city
Asset interaction
Failure visualization
Timeline
Build mode
Scenario comparison
Advisor UI
```

Deliverable:

**A compelling interactive interface for the entire system.**

---

# 11. What Each Person Should NOT Do

### Person 1
Do not build the Unity map.

### Person 2
Do not write UI propagation logic.

### Person 3
Do not modify core propagation rules to make impact numbers look better.

### Person 4
Do not hardcode "AI recommendations."

### Person 5
Do not recreate the simulation engine inside Unity.

This separation prevents integration problems.

---

# 12. MVP Priority

## MUST HAVE

```text
Real Powai/Hiranandani geographic network
        ↓
Interconnected infrastructure graph
        ↓
Single + multiple failures
        ↓
Time-based cascade
        ↓
Human impact
        ↓
Critical asset identification
        ↓
One or two interventions
        ↓
Budget comparison
        ↓
Unity visualization
```

## SHOULD HAVE

```text
Edge criticality
Monte Carlo uncertainty
Scenario comparison
Optimal budget allocation
```

## NICE TO HAVE

```text
Sophisticated AI advisor
Complex recovery model
Large number of infrastructure types
High-end graphics
Advanced optimization
```

---

# 13. Final Demo Flow

```text
1. SHOW POWAI + HIRANANDANI
       ↓
2. CLICK HOSPITAL
       ↓
3. SHOW ITS DEPENDENCIES
       ↓
4. FAIL POWER INFRASTRUCTURE
       ↓
5. PLAY SIMULATION
       ↓
6. HOSPITAL SWITCHES TO BACKUP
       ↓
7. BACKUP DEPLETES
       ↓
8. CASCADE CONTINUES
       ↓
9. SHOW PEOPLE AFFECTED
       ↓
10. SHOW UNCERTAINTY
       ↓
11. IDENTIFY CRITICAL CONNECTION
       ↓
12. GIVE USER ₹2M
       ↓
13. USER BUYS AN INTERVENTION
       ↓
14. RUN SAME SCENARIO AGAIN
       ↓
15. SHOW IMPROVEMENT
       ↓
16. SHOW OPTIMAL PLAN
       ↓
17. COMPARE USER VS OPTIMAL
       ↓
18. AI EXPLAINS WHY
```

---

# 14. Final Success Criterion

The project is successful if a judge can interact with it and understand this chain without a technical explanation:

> **"This is a real geographic area. These systems depend on one another. I can break one or several things. I can watch the consequences propagate over time. I can see how many people are affected and how uncertain that prediction is. I can identify the infrastructure or connection causing disproportionate damage. I can spend a limited budget to make the system more resilient, and the simulator can show me whether my intervention was actually the best use of that money."**
