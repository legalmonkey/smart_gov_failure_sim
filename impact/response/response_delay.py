from typing import Optional
from ..models import SimulationState, NetworkGraph


def calculate_response_delay(sim_state: SimulationState, network: Optional[NetworkGraph] = None) -> int:
    """
    Calculates the added emergency response delay (in minutes) for ambulances
    and first responders due to road disruptions, traffic chokepoints, and severed corridors.
    
    Section 3.1:
    Normal travel time vs. Failure scenario travel time
    """
    total_delay = 0

    # 1. Delay from failed or congested road nodes
    if network:
        for node in network.nodes:
            if node.type in ("road_segment", "bridge", "intersection"):
                status = sim_state.assets.get(node.id, None)
                state = status.state if status else (
                    "FAILED" if node.id in sim_state.failed_nodes else
                    "DEGRADED" if node.id in sim_state.degraded_nodes else
                    "CRITICAL" if node.id in sim_state.critical_nodes else "OPERATIONAL"
                )

                if state == "FAILED":
                    # Major corridor severance (e.g. arterial road or bridge)
                    is_arterial = "arterial" in str(node.properties.get("road_class", "")).lower() or node.type == "bridge"
                    total_delay += 8 if is_arterial else 5
                elif state == "CRITICAL":
                    total_delay += 4
                elif state == "DEGRADED":
                    total_delay += 2

    # 2. Delay from affected network edges
    for edge_id in sim_state.affected_edges:
        if network:
            edge = next((e for e in network.edges if e.id == edge_id), None)
            if edge and edge.type in ("road_connection", "emergency_route", "transport"):
                total_delay += 5
                continue
        if "road" in edge_id.lower() or "bridge" in edge_id.lower() or "route" in edge_id.lower():
            total_delay += 5

    # 3. If road nodes were explicitly listed in failed_nodes but not in network nodes
    for node_id in sim_state.failed_nodes:
        if not network or node_id not in network.node_map:
            if "road" in node_id.lower() or "bridge" in node_id.lower():
                total_delay += 6

    # 4. Realistic bounds: Cap delay at 45 minutes (maximum citywide detour threshold)
    return min(45, max(0, total_delay))
