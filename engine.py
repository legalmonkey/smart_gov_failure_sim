import json
import os
from typing import List, Dict, Optional, Union, Any

try:
    from .models import (
        NetworkGraph,
        NetworkNode,
        NetworkEdge,
        SimulationState,
        SimulationEvent,
        SimulationEventCollection,
        SimulationResult,
        Scenario,
        SimulationConfig,
    )
    from .graph import load_network, clone_network
    from .propagation import CascadePropagator
    from .recovery import RecoveryManager
except ImportError:
    from models import (
        NetworkGraph,
        NetworkNode,
        NetworkEdge,
        SimulationState,
        SimulationEvent,
        SimulationEventCollection,
        SimulationResult,
        Scenario,
        SimulationConfig,
    )
    from graph import load_network, clone_network
    from propagation import CascadePropagator
    from recovery import RecoveryManager


class SimulationEngine:
    """
    Master Track 2 Simulation Engine: Cascade & Time Simulation Engine.
    Conforms to Section 2 of the 5-Person Implementation Guide.
    """

    def __init__(
        self,
        network: Optional[NetworkGraph] = None,
        config: Optional[Union[SimulationConfig, str, Dict[str, Any]]] = None,
        scenario_id: str = "scenario_01"
    ):
        self.scenario_id = scenario_id
        self.config = self._load_config(config)
        self.base_network: Optional[NetworkGraph] = None
        self.network: Optional[NetworkGraph] = None
        self.current_time: float = 0.0
        self.events: List[SimulationEvent] = []
        self.propagator = CascadePropagator(self.config)
        self.recovery_mgr = RecoveryManager(self.config)

        if network is not None:
            self.initialize_simulation(network)

    def _load_config(
        self,
        config: Optional[Union[SimulationConfig, str, Dict[str, Any]]]
    ) -> SimulationConfig:
        if isinstance(config, SimulationConfig):
            return config
        elif isinstance(config, dict):
            return SimulationConfig(
                schema_version=config.get("schema_version", "1.0"),
                time_step_hours=float(config.get("time_step_hours", 0.1)),
                states=config.get("states", ["OPERATIONAL", "DEGRADED", "BACKUP", "CRITICAL", "FAILED", "RECOVERING"]),
                default_monte_carlo_iterations=int(config.get("default_monte_carlo_iterations", 1000)),
                overload_threshold_multiplier=float(config.get("overload_threshold_multiplier", 1.05)),
                degradation_to_critical_hours=float(config.get("degradation_to_critical_hours", 2.0)),
                critical_to_failed_hours=float(config.get("critical_to_failed_hours", 4.0)),
                repair_delay_hours=float(config.get("repair_delay_hours", 4.0)),
            )
        elif isinstance(config, str) and os.path.exists(config):
            with open(config, "r", encoding="utf-8") as f:
                data = json.load(f)
            return self._load_config(data)

        # Default fallback config
        default_path = os.path.join(os.path.dirname(__file__), "config.json")
        if os.path.exists(default_path):
            try:
                with open(default_path, "r", encoding="utf-8") as f:
                    return self._load_config(json.load(f))
            except Exception:
                pass
        return SimulationConfig()

    def initialize_simulation(self, network: Union[NetworkGraph, str, Dict[str, Any]]) -> None:
        """
        Loads the initial network and resets simulation state.
        """
        if isinstance(network, NetworkGraph):
            self.base_network = network
        else:
            self.base_network = load_network(network)

        self.reset_simulation()

    def reset_simulation(self) -> None:
        """
        Resets simulation time to 0.0 and restores baseline network state.
        """
        self.current_time = 0.0
        self.events = []
        if self.base_network:
            self.network = clone_network(self.base_network)

    def trigger_failure(self, asset_id: str, cause: str = "manual_trigger") -> None:
        """
        Manually trips an asset (node or edge).
        """
        if not self.network:
            raise RuntimeError("Simulation not initialized with a network graph.")

        # Check if node
        node = self.network.node_map.get(asset_id)
        if node:
            node.current_state = "FAILED"
            node.current_load = 0.0
            node.time_failed = self.current_time
            self.events.append(SimulationEvent(
                time=self.current_time,
                event="asset_failed",
                asset_id=node.id,
                cause=cause
            ))
            # Sever outgoing edges
            for edge in self.network.downstream_edges.get(node.id, []):
                edge.current_state = "FAILED"
                edge.time_failed = self.current_time
                edge.failure_cause = f"parent_node_{node.id}_failed"
                self.events.append(SimulationEvent(
                    time=self.current_time,
                    event="edge_failed",
                    edge_id=edge.id,
                    cause=f"parent_node_{node.id}_failed"
                ))
            return

        # Check if edge
        edge = self.network.edge_map.get(asset_id)
        if edge:
            edge.current_state = "FAILED"
            edge.time_failed = self.current_time
            edge.failure_cause = cause
            self.events.append(SimulationEvent(
                time=self.current_time,
                event="edge_failed",
                edge_id=edge.id,
                cause=cause
            ))
            return

        # If neither, log warning
        self.events.append(SimulationEvent(
            time=self.current_time,
            event="asset_failed",
            asset_id=asset_id,
            cause=cause
        ))

    def trigger_failures(self, asset_ids: List[str], cause: str = "initial_scenario_disruption") -> None:
        """
        Triggers multiple simultaneous failures at the current time tick.
        """
        for asset_id in asset_ids:
            self.trigger_failure(asset_id, cause=cause)

    def apply_interventions(self, interventions: List[Dict[str, Any]]) -> None:
        """
        Applies pre-simulation hardening or interventions to the network.
        Example: backup generator increases backup_duration.
        """
        if not self.network:
            return

        for inv in interventions:
            target_id = inv.get("target_asset_id")
            effects = inv.get("effects", {})
            node = self.network.node_map.get(target_id)
            if node:
                if "backup_duration" in effects:
                    node.backup_duration += float(effects["backup_duration"])
                    node.remaining_backup_hours = node.backup_duration
                if "capacity" in effects:
                    node.capacity += float(effects["capacity"])
                    node.available_capacity = node.capacity
                if "failure_threshold" in effects:
                    node.failure_threshold = float(effects["failure_threshold"])

    def step_simulation(self, delta_time: Optional[float] = None) -> SimulationState:
        """
        Advances the simulation by one discrete time step delta_time (in hours).
        """
        if not self.network:
            raise RuntimeError("Simulation not initialized with a network graph.")

        dt = delta_time if delta_time is not None else self.config.time_step_hours
        self.current_time = round(self.current_time + dt, 3)

        # 1. Evaluate recovery first
        recovery_events = self.recovery_mgr.evaluate_recovery(self.network, self.current_time, dt)
        self.events.extend(recovery_events)

        # 2. Evaluate cascade propagation
        propagation_events = self.propagator.evaluate_step(self.network, self.current_time, dt)
        self.events.extend(propagation_events)

        return self.get_network_state()

    def run_simulation(
        self,
        duration: Optional[float] = None,
        scenario: Optional[Scenario] = None,
        step_dt: Optional[float] = None
    ) -> SimulationResult:
        """
        Executes a complete simulation run from t=0.0 to t=duration.
        """
        self.reset_simulation()

        total_duration = duration or 24.0
        if scenario:
            self.scenario_id = scenario.id
            total_duration = scenario.duration or total_duration
            if scenario.interventions:
                self.apply_interventions(scenario.interventions)
            if scenario.failures:
                self.trigger_failures(scenario.failures)

        dt = step_dt or self.config.time_step_hours
        steps = int(total_duration / dt)

        for _ in range(steps):
            self.step_simulation(dt)

        final_state = self.get_network_state()

        return SimulationResult(
            schema_version="1.0",
            simulation_id=f"sim_{self.scenario_id}",
            scenario_id=self.scenario_id,
            status="COMPLETED",
            duration_hours=total_duration,
            final_state=final_state,
            events=self.events,
        )

    def get_network_state(self) -> SimulationState:
        """
        Returns a standardized SimulationState snapshot conforming to Contract C11.
        """
        if not self.network:
            raise RuntimeError("Simulation not initialized.")

        assets_map: Dict[str, Dict[str, Any]] = {}
        failed_nodes: List[str] = []
        degraded_nodes: List[str] = []
        backup_nodes: List[str] = []
        critical_nodes: List[str] = []
        available_capacity: Dict[str, float] = {}

        for n in self.network.nodes:
            assets_map[n.id] = {
                "state": n.current_state,
                "load": round(n.current_load, 1),
            }
            available_capacity[n.id] = round(n.available_capacity if n.current_state != "FAILED" else 0.0, 1)

            if n.current_state == "FAILED":
                failed_nodes.append(n.id)
            elif n.current_state == "DEGRADED":
                degraded_nodes.append(n.id)
            elif n.current_state == "BACKUP":
                backup_nodes.append(n.id)
            elif n.current_state == "CRITICAL":
                critical_nodes.append(n.id)

        affected_edges: List[str] = [
            e.id for e in self.network.edges if e.current_state in ("FAILED", "DEGRADED")
        ]

        return SimulationState(
            scenario_id=self.scenario_id,
            time=self.current_time,
            assets=assets_map,
            failed_nodes=failed_nodes,
            degraded_nodes=degraded_nodes,
            backup_nodes=backup_nodes,
            critical_nodes=critical_nodes,
            affected_edges=affected_edges,
            available_capacity=available_capacity,
        )

    def get_event_history(self) -> List[SimulationEvent]:
        """
        Returns all simulation events generated so far.
        """
        return self.events

    def export_state_json(self, path: Optional[str] = None) -> str:
        """
        Exports the current SimulationState to a JSON string or file.
        """
        state = self.get_network_state()
        data = state.to_dict()
        res = json.dumps(data, indent=2)
        if path:
            with open(path, "w", encoding="utf-8") as f:
                f.write(res)
        return res

    def export_events_json(self, path: Optional[str] = None) -> str:
        """
        Exports the simulation event history to a JSON string or file.
        """
        data = [e.to_dict() for e in self.events]
        res = json.dumps(data, indent=2)
        if path:
            with open(path, "w", encoding="utf-8") as f:
                f.write(res)
        return res
