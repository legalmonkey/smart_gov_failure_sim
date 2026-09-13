from typing import List, Dict, Set, Optional
from impact.models import NetworkGraph, NetworkEdge, SimulationState, AssetStateInfo
from impact.impact_engine import ImpactEngine
from ..models import EdgeCriticality


def calculate_edge_criticality(
    network: NetworkGraph,
    impact_engine: ImpactEngine,
    scenario_id: str = "scenario_01",
    base_sim_state: Optional[SimulationState] = None
) -> List[EdgeCriticality]:
    """
    Section 4.2 Edge Criticality.
    Repeat for connections:
    EdgeCriticality_e = Impact(Network - {e})
    """
    baseline_impact = 0.0
    if base_sim_state:
        base_res = impact_engine.calculate_human_impact(base_sim_state, network)
        baseline_impact = base_res.impact_score

    # Incoming edges for redundancy checking
    incoming_map: Dict[str, List[str]] = {}
    for edge in network.edges:
        incoming_map.setdefault(edge.to_node, []).append(edge.id)

    results: List[EdgeCriticality] = []

    for target_edge in network.edges:
        target_node = network.node_map.get(target_edge.to_node)
        assets: Dict[str, AssetStateInfo] = {}
        degraded_nodes: List[str] = []
        backup_nodes: List[str] = []

        if target_node:
            other_incoming = [eid for eid in incoming_map.get(target_edge.to_node, []) if eid != target_edge.id]
            if not other_incoming:
                # Zero redundancy link!
                if target_node.backup_duration and target_node.backup_duration > 0:
                    backup_nodes.append(target_node.id)
                    assets[target_node.id] = AssetStateInfo(state="BACKUP", load=target_node.capacity * 0.7)
                else:
                    degraded_nodes.append(target_node.id)
                    assets[target_node.id] = AssetStateInfo(state="DEGRADED", load=target_node.capacity * 0.4)

        sim_state = SimulationState(
            scenario_id=scenario_id,
            time=2.0,
            assets=assets,
            failed_nodes=[],
            degraded_nodes=degraded_nodes,
            backup_nodes=backup_nodes,
            affected_edges=[target_edge.id]
        )

        impact_result = impact_engine.calculate_human_impact(sim_state, network)
        edge_score = impact_result.impact_score

        if target_edge.type == "power":
            edge_score = max(edge_score, 0.70)
        elif target_edge.type == "water":
            edge_score = max(edge_score, 0.60)

        final_score = min(0.99, max(0.12, edge_score))

        results.append(EdgeCriticality(
            edge_id=target_edge.id,
            criticality_score=final_score,
            baseline_impact=baseline_impact,
            removal_impact=impact_result.impact_score
        ))

    results.sort(key=lambda x: x.criticality_score, reverse=True)
    return results
