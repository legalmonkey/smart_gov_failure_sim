from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any


@dataclass
class NetworkNode:
    id: str
    name: str
    type: str  # 'hospital', 'school', 'power_station', 'power_substation', 'water_pump', 'road_segment', etc.
    lat: float
    lon: float
    population_served: int = 0
    capacity: float = 100.0
    backup_duration: Optional[float] = None  # Hours of backup generator/fuel
    properties: Dict[str, Any] = field(default_factory=dict)


@dataclass
class NetworkEdge:
    id: str
    from_node: str
    to_node: str
    type: str  # 'power', 'water', 'road', 'dependency'
    capacity: float = 100.0
    weight: float = 1.0


@dataclass
class NetworkGraph:
    nodes: List[NetworkNode]
    edges: List[NetworkEdge]
    node_map: Dict[str, NetworkNode] = field(init=False)
    edge_map: Dict[str, NetworkEdge] = field(init=False)

    def __post_init__(self):
        self.node_map = {n.id: n for n in self.nodes}
        self.edge_map = {e.id: e for e in self.edges}


@dataclass
class AssetStateInfo:
    state: str  # 'OPERATIONAL', 'DEGRADED', 'BACKUP', 'CRITICAL', 'FAILED'
    load: float = 0.0


@dataclass
class SimulationState:
    scenario_id: str
    time: float
    assets: Dict[str, AssetStateInfo]
    failed_nodes: List[str] = field(default_factory=list)
    degraded_nodes: List[str] = field(default_factory=list)
    backup_nodes: List[str] = field(default_factory=list)
    critical_nodes: List[str] = field(default_factory=list)
    affected_edges: List[str] = field(default_factory=list)


@dataclass
class Scenario:
    scenario_id: str
    name: str
    description: str
    duration_hours: float = 24.0
    initial_failures: List[str] = field(default_factory=list)
    parameters: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ImpactResult:
    scenario_id: str
    population_affected: int
    duration_hours: float
    emergency_response_delay_minutes: int
    hospital_disruptions: int
    school_disruptions: int
    water_service_disruptions: int
    power_service_disruptions: int
    impact_score: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "scenario_id": self.scenario_id,
            "population_affected": self.population_affected,
            "duration_hours": round(self.duration_hours, 2),
            "emergency_response_delay_minutes": self.emergency_response_delay_minutes,
            "hospital_disruptions": self.hospital_disruptions,
            "school_disruptions": self.school_disruptions,
            "water_service_disruptions": self.water_service_disruptions,
            "power_service_disruptions": self.power_service_disruptions,
            "impact_score": round(self.impact_score, 2),
        }


@dataclass
class UncertaintyDistribution:
    mean: float
    median: float
    p05: float
    p95: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "mean": round(self.mean, 1),
            "median": round(self.median, 1),
            "p05": round(self.p05, 1),
            "p95": round(self.p95, 1),
        }


@dataclass
class UncertaintyResult:
    scenario_id: str
    iterations: int
    random_seed: Optional[int]
    population_affected: UncertaintyDistribution
    hospital_failure_probability: float
    hospital_failure_time_hours: Dict[str, float]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "scenario_id": self.scenario_id,
            "iterations": self.iterations,
            "random_seed": self.random_seed,
            "population_affected": self.population_affected.to_dict(),
            "hospital_failure_probability": round(self.hospital_failure_probability, 2),
            "hospital_failure_time_hours": {
                k: round(v, 2) for k, v in self.hospital_failure_time_hours.items()
            },
        }
