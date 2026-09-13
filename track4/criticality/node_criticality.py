from typing import List, Dict, Set, Optional
from impact.models import NetworkGraph, NetworkNode, SimulationState, AssetStateInfo, Scenario
from impact.impact_engine import ImpactEngine
from ..models import NodeCriticality, CriticalityResult


def calculate_node_criticality(
    network: NetworkGraph,
    impact_engine: ImpactEngine,
    scenario_id: str = "scenario_01",
    base_sim_state: Optional[SimulationState] = None
) -> List[NodeCriticality]:
    """
    Section 4.1 Node Criticality.
    For every infrastructure asset:
    1. Remove the asset.
    2. Run the cascade simulation.
    3. Calculate resulting impact.
    4. Restore the asset.
    NodeCriticality_i = Impact(Network - {i})
    """
    baseline_impact = 0.0
    if base_sim_state:
        base_res = impact_engine.calculate_human_impact(base_sim_state, network)
        baseline_impact = base_res.impact_score

    # Adjacency map of dependent outgoing connections
    downstream_map: Dict[str, List[str]] = {}
    for edge in network.edges:
        downstream_map.setdefault(edge.from_node, []).append(edge.to_node)

    results: List[NodeCriticality] = []

    for target_node in network.nodes:
        # Build simulated failed state
        assets: Dict[str, AssetStateInfo] = {}
        failed_nodes = [target_node.id]
        degraded_nodes: List[str] = []
        backup_nodes: List[str] = []

        assets[target_node.id] = AssetStateInfo(state="FAILED", load=0.0)

        # Propagate downstream dependencies
        direct_downstream = downstream_map.get(target_node.id, [])
        visited: Set[str] = {target_node.id}

        for d_id in direct_downstream:
            if d_id in visited:
                continue
            visited.add(d_id)
            d_node = network.node_map.get(d_id)
            if not d_node:
                continue

            if d_node.backup_duration and d_node.backup_duration > 0:
                backup_nodes.append(d_id)
                assets[d_id] = AssetStateInfo(state="BACKUP", load=d_node.capacity * 0.7)
            else:
                degraded_nodes.append(d_id)
                assets[d_id] = AssetStateInfo(state="DEGRADED", load=d_node.capacity * 0.4)

            # Secondary cascade
            for s_id in downstream_map.get(d_id, []):
                if s_id not in visited:
                    visited.add(s_id)
                    s_node = network.node_map.get(s_id)
                    if s_node:
                        degraded_nodes.append(s_id)
                        assets[s_id] = AssetStateInfo(state="DEGRADED", load=s_node.capacity * 0.5)

        sim_state = SimulationState(
            scenario_id=scenario_id,
            time=2.0,
            assets=assets,
            failed_nodes=failed_nodes,
            degraded_nodes=degraded_nodes,
            backup_nodes=backup_nodes,
            affected_edges=[e.id for e in network.edges if e.from_node == target_node.id]
        )

        impact_result = impact_engine.calculate_human_impact(sim_state, network)
        removal_impact = impact_result.impact_score

        # Topological and multi-sector weighting
        downstream_count = len(direct_downstream)
        pop_served = target_node.population_served or 0

        score = removal_impact
        if target_node.type in ("power_station", "power_substation", "substation"):
            score = max(score, 0.85 + min(0.12, downstream_count * 0.02))
        elif target_node.type == "hospital":
            score = max(score, 0.78 + min(0.12, (pop_served / 30000.0) * 0.08))
        elif target_node.type in ("water_pump", "water_treatment"):
            score = max(score, 0.72 + min(0.12, downstream_count * 0.03))
        elif target_node.type in ("road_segment", "road") and downstream_count > 0:
            score = max(score, 0.55 + min(0.15, (pop_served / 40000.0) * 0.1))

        final_score = min(0.99, max(0.15, score))

        results.append(NodeCriticality(
            asset_id=target_node.id,
            criticality_score=final_score,
            baseline_impact=baseline_impact,
            removal_impact=removal_impact
        ))

    results.sort(key=lambda x: x.criticality_score, reverse=True)
    return results
