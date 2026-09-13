from typing import List, Dict, Optional, Tuple
try:
    from .models import NetworkGraph, NetworkNode, NetworkEdge, SimulationEvent, SimulationConfig
except ImportError:
    from models import NetworkGraph, NetworkNode, NetworkEdge, SimulationEvent, SimulationConfig


class CascadePropagator:
    """
    Mathematical propagation engine for infrastructure failure cascades.
    Implements Section 2.5 of the Implementation Guide.
    """

    def __init__(self, config: SimulationConfig):
        self.config = config

    def evaluate_step(
        self,
        graph: NetworkGraph,
        current_time: float,
        dt: float
    ) -> List[SimulationEvent]:
        """
        Advances the network state by dt, evaluating dependencies, backup exhaustion,
        degradation, and overload trips.
        """
        events: List[SimulationEvent] = []

        # 1. Evaluate Edge states based on upstream node status
        for edge in graph.edges:
            if edge.current_state == "FAILED":
                continue

            upstream = graph.node_map.get(edge.from_node)
            if not upstream:
                continue

            # If upstream source completely failed, edge loses active transmission
            if upstream.current_state in ("FAILED", "CRITICAL"):
                if edge.current_state != "FAILED":
                    edge.current_state = "FAILED"
                    edge.time_failed = current_time
                    edge.failure_cause = f"parent_node_{upstream.id}_failed"
                    events.append(SimulationEvent(
                        time=current_time,
                        event="edge_failed",
                        edge_id=edge.id,
                        cause=f"upstream_{upstream.type}_failure"
                    ))

        # 2. Evaluate Node states based on incoming dependencies & backup depletion
        for node in graph.nodes:
            # Skip if already failed or recovering (handled by recovery module)
            if node.current_state in ("FAILED", "RECOVERING"):
                continue

            incoming_edges = graph.upstream_edges.get(node.id, [])

            # Root nodes (e.g. power station) without upstream dependencies only fail if triggered
            if not incoming_edges:
                continue

            # Calculate available incoming supply ratio
            total_required_weight = 0.0
            supplied_weight = 0.0

            for edge in incoming_edges:
                weight = max(0.1, edge.dependency_strength)
                total_required_weight += weight
                upstream_node = graph.node_map.get(edge.from_node)

                if edge.current_state != "FAILED" and upstream_node and upstream_node.current_state in ("OPERATIONAL", "BACKUP", "DEGRADED"):
                    # Capacity proportion
                    supply_factor = 1.0 if upstream_node.current_state == "OPERATIONAL" else 0.6
                    supplied_weight += weight * supply_factor

            supply_ratio = (supplied_weight / total_required_weight) if total_required_weight > 0 else 1.0

            # Evaluate state transitions based on supply ratio
            if supply_ratio >= 0.95:
                # Normal operational supply
                if node.current_state in ("DEGRADED", "BACKUP", "CRITICAL"):
                    node.current_state = "OPERATIONAL"
                    node.degradation_hours = 0.0
                    node.critical_hours = 0.0
                    events.append(SimulationEvent(
                        time=current_time,
                        event="asset_recovered",
                        asset_id=node.id,
                        cause="primary_supply_restored"
                    ))
            elif supply_ratio > 0.0 and node.backup_duration <= 0:
                # Degraded supply without backup
                node.degradation_hours += dt
                if node.current_state == "OPERATIONAL":
                    node.current_state = "DEGRADED"
                    node.current_load = node.load * supply_ratio
                    events.append(SimulationEvent(
                        time=current_time,
                        event="asset_degraded",
                        asset_id=node.id,
                        cause="supply_deficit"
                    ))
                elif node.degradation_hours >= self.config.degradation_to_critical_hours and node.current_state == "DEGRADED":
                    node.current_state = "CRITICAL"
                    events.append(SimulationEvent(
                        time=current_time,
                        event="asset_critical",
                        asset_id=node.id,
                        cause="prolonged_degradation"
                    ))
            else:
                # Total or severe supply loss
                if node.backup_duration > 0 and node.remaining_backup_hours > 0:
                    # Switch to or continue on BACKUP
                    if node.current_state != "BACKUP":
                        node.current_state = "BACKUP"
                        events.append(SimulationEvent(
                            time=current_time,
                            event="asset_backup",
                            asset_id=node.id,
                            cause="main_power_lost_generator_engaged"
                        ))

                    # Deplete backup duration
                    node.remaining_backup_hours -= dt
                    if node.remaining_backup_hours <= 0:
                        node.remaining_backup_hours = 0.0
                        node.current_state = "FAILED"
                        node.current_load = 0.0
                        node.time_failed = current_time
                        events.append(SimulationEvent(
                            time=current_time,
                            event="asset_failed",
                            asset_id=node.id,
                            cause="backup_exhausted"
                        ))
                elif node.type in ("residential", "population", "community", "school", "clinic") or any(e.type in ("service_dependency", "road_connection", "emergency_route") for e in incoming_edges):
                    # Service or population zone degrades when service dependency is lost
                    if node.current_state != "DEGRADED":
                        node.current_state = "DEGRADED"
                        node.current_load = node.load * 0.7
                        events.append(SimulationEvent(
                            time=current_time,
                            event="asset_degraded",
                            asset_id=node.id,
                            cause="service_disruption"
                        ))
                else:
                    # Infrastructure without backup fails
                    if node.current_state != "FAILED":
                        node.current_state = "FAILED"
                        node.current_load = 0.0
                        node.time_failed = current_time
                        events.append(SimulationEvent(
                            time=current_time,
                            event="asset_failed",
                            asset_id=node.id,
                            cause="dependency_lost"
                        ))

        # 3. Capacity Overload check on surviving nodes
        for node in graph.nodes:
            if node.current_state in ("FAILED", "RECOVERING"):
                continue

            threshold_capacity = node.capacity * (node.failure_threshold / 100.0) * self.config.overload_threshold_multiplier
            if node.current_load > threshold_capacity and threshold_capacity > 0:
                node.current_state = "FAILED"
                node.current_load = 0.0
                node.time_failed = current_time
                events.append(SimulationEvent(
                    time=current_time,
                    event="capacity_exceeded",
                    asset_id=node.id,
                    cause="load_exceeded_threshold"
                ))

        return events
