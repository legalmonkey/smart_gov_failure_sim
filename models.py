from dataclasses import dataclass, field
from typing import Dict, List, Optional

@dataclass
class ImpactResult:
    schema_version: str
    scenario_id: str
    population_affected: int
    duration_hours: float
    emergency_response_delay_minutes: float
    hospital_disruptions: int
    school_disruptions: int
    water_service_disruptions: int
    power_service_disruptions: int
    impact_score: float

@dataclass
class PopulationAffectedStats:
    mean: float
    median: float
    p05: float
    p95: float

@dataclass
class UncertaintyResult:
    schema_version: str
    scenario_id: str
    iterations: int
    random_seed: int
    population_affected: PopulationAffectedStats
    hospital_failure_probability: float

# These are mock representations of Track 2's output schemas for Track 3 to consume.
# We do not depend on Track 2's internal classes.
@dataclass
class SimulationState:
    time: int
    failed_nodes: List[str] = field(default_factory=list)
    degraded_nodes: List[str] = field(default_factory=list)
    backup_nodes: List[str] = field(default_factory=list)
    affected_edges: List[str] = field(default_factory=list)
    available_capacity: Dict[str, int] = field(default_factory=dict)
