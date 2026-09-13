from typing import List
try:
    from .models import NetworkGraph, SimulationEvent, SimulationConfig
except ImportError:
    from models import NetworkGraph, SimulationEvent, SimulationConfig


class RecoveryManager:
    """
    Handles restoration and repair cycles for failed infrastructure.
    Implements Section 2.6 of the Implementation Guide.
    """

    def __init__(self, config: SimulationConfig):
        self.config = config

    def evaluate_recovery(
        self,
        graph: NetworkGraph,
        current_time: float,
        dt: float
    ) -> List[SimulationEvent]:
        """
        Transitions nodes through FAILED -> RECOVERING -> OPERATIONAL
        based on asset recovery_time and repair delay.
        """
        events: List[SimulationEvent] = []

        for node in graph.nodes:
            if node.current_state == "FAILED":
                # Check if repair delay has elapsed since failure
                time_in_failure = (current_time - node.time_failed) if node.time_failed is not None else 0.0
                if time_in_failure >= self.config.repair_delay_hours:
                    node.current_state = "RECOVERING"
                    node.recovery_elapsed_hours = 0.0
                    events.append(SimulationEvent(
                        time=current_time,
                        event="asset_recovering",
                        asset_id=node.id,
                        cause="emergency_clearing_crew"
                    ))

            elif node.current_state == "RECOVERING":
                node.recovery_elapsed_hours += dt
                if node.recovery_elapsed_hours >= node.recovery_time:
                    node.current_state = "OPERATIONAL"
                    node.current_load = node.load
                    node.available_capacity = node.capacity
                    node.remaining_backup_hours = node.backup_duration
                    node.degradation_hours = 0.0
                    node.critical_hours = 0.0
                    node.time_failed = None
                    events.append(SimulationEvent(
                        time=current_time,
                        event="asset_recovered",
                        asset_id=node.id,
                        cause="repair_completed"
                    ))

                    # Restore outgoing edges that failed due to this node
                    for edge in graph.downstream_edges.get(node.id, []):
                        if edge.current_state == "FAILED" and "parent_node" in edge.failure_cause:
                            edge.current_state = "OPERATIONAL"
                            edge.time_failed = None

        # Evaluate recovery for directly failed edges
        for edge in graph.edges:
            if edge.current_state == "FAILED" and "parent_node" not in edge.failure_cause:
                if edge.time_failed is not None:
                    time_in_failure = current_time - edge.time_failed
                    if time_in_failure >= edge.recovery_time:
                        edge.current_state = "OPERATIONAL"
                        edge.time_failed = None
                        events.append(SimulationEvent(
                            time=current_time,
                            event="edge_recovered",
                            edge_id=edge.id,
                            cause="line_repair_completed"
                        ))

        return events
