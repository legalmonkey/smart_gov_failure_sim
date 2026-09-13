from typing import List, Dict, Any
from ..models import Intervention


DEFAULT_INTERVENTIONS: List[Intervention] = [
    Intervention(
        id="backup_generator",
        name="Industrial Diesel Backup Generator (750kVA)",
        target_types=["hospital", "water_pump"],
        cost=500000,
        effects={"backup_duration_hours": 6, "resilience_boost": 0.35},
        constraints=["space_requirement_sqm: 40"]
    ),
    Intervention(
        id="microgrid_solar_bess",
        name="Microgrid Solar + BESS 1MWh Storage",
        target_types=["hospital", "substation", "power_station", "school"],
        cost=1200000,
        effects={"backup_duration_hours": 12, "resilience_boost": 0.50},
        constraints=["rooftop_or_yard_access"]
    ),
    Intervention(
        id="redundant_feeder",
        name="Dual-Ring 110kV Underground Redundant Feeder",
        target_types=["substation", "hospital", "commercial"],
        cost=800000,
        effects={"redundancy_edges": 1, "failure_probability_reduction": 0.75},
        constraints=["utility_easement_clearance"]
    ),
    Intervention(
        id="flood_barrier",
        name="Automated Flood Protection Perimeter Barriers",
        target_types=["substation", "water_pump", "road"],
        cost=600000,
        effects={"failure_threshold_increase": 20, "water_resilience": 0.60},
        constraints=["foundation_depth_m: 2"]
    ),
    Intervention(
        id="mobile_water_purifier",
        name="Mobile Containerized Water Filtration & Pump Unit",
        target_types=["water_pump", "population", "hospital"],
        cost=450000,
        effects={"backup_water_mld": 5.0, "backup_duration_hours": 8},
        constraints=["road_access_clearance"]
    ),
    Intervention(
        id="emergency_corridor_signaling",
        name="Smart Traffic Signal Preemption & Evacuation Gate",
        target_types=["road"],
        cost=350000,
        effects={"delay_reduction_minutes": 15, "evacuation_throughput": 0.40},
        constraints=["traffic_control_box_interface"]
    ),
    Intervention(
        id="structural_reinforcement",
        name="Seismic & Geo-Structural Hardening",
        target_types=["hospital", "substation", "school", "commercial"],
        cost=900000,
        effects={"failure_threshold_increase": 25, "structural_longevity": 10},
        constraints=["building_code_audit"]
    )
]


def get_default_catalog() -> List[Intervention]:
    return [Intervention(**inv.to_dict()) for inv in DEFAULT_INTERVENTIONS]


def load_catalog(path: str = "tests/fixtures/mock-interventions.json") -> List[Intervention]:
    import json, os
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return [Intervention(**item) for item in data]
        except Exception:
            pass
    return get_default_catalog()
