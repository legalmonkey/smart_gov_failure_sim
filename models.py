from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any


@dataclass
class NetworkNode:
    id: str
    type: str
    name: str
    capacity: float = 100.0
    load: float = 0.0
    population_served: int = 0
    backup_duration: float = 0.0
    failure_threshold: float = 90.0  # percentage threshold or operational limit
    recovery_time: float = 8.0
    status: str = "OPERATIONAL"
    osm_id: Optional[str] = None
    location: Optional[Dict[str, float]] = None

    # Dynamic simulation states
    current_state: str = "OPERATIONAL"
    current_load: float = 0.0
    available_capacity: float = 0.0
    remaining_backup_hours: float = 0.0
    degradation_hours: float = 0.0
    critical_hours: float = 0.0
    time_failed: Optional[float] = None
    recovery_elapsed_hours: float = 0.0

    def __post_init__(self):
        if not self.current_load:
            self.current_load = float(self.load)
        if not self.available_capacity:
            self.available_capacity = float(self.capacity)
        if not self.remaining_backup_hours:
            self.remaining_backup_hours = float(self.backup_duration)
        if self.status:
            self.current_state = self.status

    def to_dict(self) -> Dict[str, Any]:
        data: Dict[str, Any] = {
            "id": self.id,
            "type": self.type,
            "name": self.name,
            "capacity": self.capacity,
            "load": self.load,
            "population_served": self.population_served,
            "backup_duration": self.backup_duration,
            "failure_threshold": self.failure_threshold,
            "recovery_time": self.recovery_time,
            "status": self.current_state,
        }
        if self.osm_id:
            data["osm_id"] = self.osm_id
        if self.location:
            data["location"] = self.location
        return data


@dataclass
class NetworkEdge:
    id: str
    from_node: str
    to_node: str
    type: str = "service_dependency"
    capacity: float = 100.0
    load: float = 0.0
    dependency_strength: float = 1.0
    failure_probability: float = 0.0
    state: str = "OPERATIONAL"

    # Dynamic simulation states
    current_state: str = "OPERATIONAL"
    current_load: float = 0.0
    time_failed: Optional[float] = None
    failure_cause: str = ""
    recovery_time: float = 8.0

    def __post_init__(self):
        if not self.current_load:
            self.current_load = float(self.load)
        if self.state:
            self.current_state = self.state

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "from": self.from_node,
            "to": self.to_node,
            "type": self.type,
            "capacity": self.capacity,
            "load": self.current_load,
            "dependency_strength": self.dependency_strength,
            "failure_probability": self.failure_probability,
            "state": self.current_state,
        }


@dataclass
class NetworkGraph:
    nodes: List[NetworkNode]
    edges: List[NetworkEdge]
    schema_version: str = "1.0"
    node_map: Dict[str, NetworkNode] = field(default_factory=dict)
    edge_map: Dict[str, NetworkEdge] = field(default_factory=dict)
    downstream_edges: Dict[str, List[NetworkEdge]] = field(default_factory=dict)
    upstream_edges: Dict[str, List[NetworkEdge]] = field(default_factory=dict)

    def __post_init__(self):
        self.node_map = {node.id: node for node in self.nodes}
        self.edge_map = {edge.id: edge for edge in self.edges}
        self.downstream_edges = {}
        self.upstream_edges = {}

        for edge in self.edges:
            self.downstream_edges.setdefault(edge.from_node, []).append(edge)
            self.upstream_edges.setdefault(edge.to_node, []).append(edge)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "nodes": [n.to_dict() for n in self.nodes],
            "edges": [e.to_dict() for e in self.edges],
        }


@dataclass
class SimulationEvent:
    time: float
    event: str  # asset_failed, asset_degraded, asset_backup, asset_critical, asset_recovering, asset_recovered, edge_failed, capacity_exceeded, dependency_lost
    asset_id: Optional[str] = None
    edge_id: Optional[str] = None
    cause: str = ""

    def to_dict(self) -> Dict[str, Any]:
        res: Dict[str, Any] = {
            "time": round(self.time, 2),
            "event": self.event,
        }
        if self.asset_id is not None:
            res["asset_id"] = self.asset_id
        if self.edge_id is not None:
            res["edge_id"] = self.edge_id
        res["cause"] = self.cause
        return res


@dataclass
class SimulationState:
    scenario_id: str
    time: float
    assets: Dict[str, Dict[str, Any]]
    failed_nodes: List[str] = field(default_factory=list)
    degraded_nodes: List[str] = field(default_factory=list)
    backup_nodes: List[str] = field(default_factory=list)
    critical_nodes: List[str] = field(default_factory=list)
    affected_edges: List[str] = field(default_factory=list)
    available_capacity: Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "scenario_id": self.scenario_id,
            "time": round(self.time, 2),
            "assets": self.assets,
            "failed_nodes": self.failed_nodes,
            "degraded_nodes": self.degraded_nodes,
            "backup_nodes": self.backup_nodes,
            "critical_nodes": self.critical_nodes,
            "affected_edges": self.affected_edges,
        }


@dataclass
class SimulationEventCollection:
    schema_version: str
    simulation_id: str
    events: List[SimulationEvent]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "simulation_id": self.simulation_id,
            "events": [e.to_dict() for e in self.events],
        }


@dataclass
class SimulationResult:
    schema_version: str
    simulation_id: str
    scenario_id: str
    status: str
    duration_hours: float
    final_state: SimulationState
    events: List[SimulationEvent]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "simulation_id": self.simulation_id,
            "scenario_id": self.scenario_id,
            "status": self.status,
            "duration_hours": round(self.duration_hours, 2),
            "final_state": self.final_state.to_dict(),
            "events": [e.to_dict() for e in self.events],
        }


@dataclass
class Scenario:
    id: str
    name: str
    failures: List[str]
    interventions: List[Dict[str, Any]] = field(default_factory=list)
    budget: int = 2000000
    duration: float = 24.0
    random_seed: Optional[int] = 42

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "failures": self.failures,
            "interventions": self.interventions,
            "budget": self.budget,
            "duration": self.duration,
            "random_seed": self.random_seed,
        }


@dataclass
class SimulationConfig:
    schema_version: str = "1.0"
    time_step_hours: float = 0.1
    states: List[str] = field(default_factory=lambda: [
        "OPERATIONAL", "DEGRADED", "BACKUP", "CRITICAL", "FAILED", "RECOVERING"
    ])
    default_monte_carlo_iterations: int = 1000
    overload_threshold_multiplier: float = 1.05
    degradation_to_critical_hours: float = 2.0
    critical_to_failed_hours: float = 4.0
    repair_delay_hours: float = 4.0
