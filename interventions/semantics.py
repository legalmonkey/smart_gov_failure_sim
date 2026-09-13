from typing import List, Dict, Any, Optional
from impact.models import NetworkGraph, NetworkNode, SimulationState, AssetStateInfo
from ..models import Intervention, SelectedIntervention


def apply_interventions_to_simulation(
    sim_state: SimulationState,
    network: NetworkGraph,
    interventions: List[SelectedIntervention],
    catalog: List[Intervention]
) -> SimulationState:
    """
    Applies physical intervention effects to the simulation state.
    (e.g. backup generator extends backup duration, preventing transition to FAILED).
    """
    catalog_map = {item.id: item for item in catalog}
    protected_assets: Dict[str, List[Intervention]] = {}

    for sel in interventions:
        inv = catalog_map.get(sel.intervention_id)
        if inv:
            protected_assets.setdefault(sel.target_asset_id, []).append(inv)

    new_assets = dict(sim_state.assets)
    new_failed = list(sim_state.failed_nodes)
    new_degraded = list(sim_state.degraded_nodes)
    new_backup = list(sim_state.backup_nodes)

    for asset_id, inv_list in protected_assets.items():
        node = network.node_map.get(asset_id)
        if not node:
            continue

        has_backup_boost = any("backup_duration_hours" in i.effects or "resilience_boost" in i.effects for i in inv_list)
        has_redundancy = any("dependency_redundancy" in i.effects or "redundancy_edges" in i.effects for i in inv_list)
        has_road_fix = any("capacity_increase" in i.effects or "delay_reduction_minutes" in i.effects for i in inv_list)
        has_threshold = any("failure_threshold_increase" in i.effects or "failure_probability_reduction" in i.effects for i in inv_list)

        # If asset was failed, strong interventions upgrade state to OPERATIONAL / BACKUP
        if asset_id in new_failed:
            if has_road_fix and node.type in ("road", "road_segment"):
                new_failed.remove(asset_id)
                new_assets[asset_id] = AssetStateInfo(state="OPERATIONAL", load=node.capacity)
            elif has_backup_boost or has_redundancy:
                new_failed.remove(asset_id)
                new_backup.append(asset_id)
                new_assets[asset_id] = AssetStateInfo(state="BACKUP", load=node.capacity * 0.8)
            elif has_threshold:
                new_failed.remove(asset_id)
                new_degraded.append(asset_id)
                new_assets[asset_id] = AssetStateInfo(state="DEGRADED", load=node.capacity * 0.5)

        # If asset was degraded or in backup, interventions restore towards OPERATIONAL
        elif asset_id in new_degraded:
            if has_backup_boost or has_redundancy:
                new_degraded.remove(asset_id)
                new_backup.append(asset_id)
                new_assets[asset_id] = AssetStateInfo(state="BACKUP", load=node.capacity * 0.9)
            elif has_threshold:
                new_degraded.remove(asset_id)
                new_assets[asset_id] = AssetStateInfo(state="OPERATIONAL", load=node.capacity)

    return SimulationState(
        scenario_id=sim_state.scenario_id,
        time=sim_state.time,
        assets=new_assets,
        failed_nodes=new_failed,
        degraded_nodes=new_degraded,
        backup_nodes=new_backup,
        critical_nodes=list(sim_state.critical_nodes),
        affected_edges=list(sim_state.affected_edges)
    )
