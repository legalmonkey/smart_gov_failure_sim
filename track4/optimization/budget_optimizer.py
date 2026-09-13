import itertools
from typing import List, Dict, Any, Optional
from impact.models import NetworkGraph, SimulationState, Scenario
from impact.impact_engine import ImpactEngine
from ..models import (
    Intervention,
    SelectedIntervention,
    OptimizationResult,
    UserPlanResult
)
from ..interventions.semantics import apply_interventions_to_simulation
from ..criticality.node_criticality import calculate_node_criticality


class BudgetOptimizer:
    """
    Section 4.4 & 4.5 Budget Optimization.
    Minimizes: Cascade Impact Score
    Subject to: TotalCost <= Budget
    """

    def __init__(self, impact_engine: ImpactEngine):
        self.impact_engine = impact_engine

    def evaluate_user_plan(
        self,
        network: NetworkGraph,
        sim_state: SimulationState,
        scenario: Scenario,
        budget: int,
        selected: List[SelectedIntervention],
        catalog: List[Intervention]
    ) -> UserPlanResult:
        baseline_res = self.impact_engine.calculate_human_impact(sim_state, network, scenario)
        baseline_impact = baseline_res.impact_score

        # Calculate user plan cost
        catalog_map = {item.id: item for item in catalog}
        total_cost = sum(catalog_map[s.intervention_id].cost for s in selected if s.intervention_id in catalog_map)

        # Evaluate resulting impact
        hardened_state = apply_interventions_to_simulation(sim_state, network, selected, catalog)
        result_res = self.impact_engine.calculate_human_impact(hardened_state, network, scenario)
        resulting_impact = result_res.impact_score
        impact_reduction = max(0.0, baseline_impact - resulting_impact)

        return UserPlanResult(
            scenario_id=scenario.scenario_id,
            budget=budget,
            selected_interventions=selected,
            total_cost=total_cost,
            baseline_impact=baseline_impact,
            resulting_impact=resulting_impact,
            impact_reduction=impact_reduction
        )

    def optimize(
        self,
        network: NetworkGraph,
        sim_state: SimulationState,
        scenario: Scenario,
        budget: int,
        catalog: List[Intervention],
        max_candidates: int = 12
    ) -> OptimizationResult:
        baseline_res = self.impact_engine.calculate_human_impact(sim_state, network, scenario)
        baseline_impact = baseline_res.impact_score

        if baseline_impact <= 0.0 or budget <= 0:
            return OptimizationResult(
                scenario_id=scenario.scenario_id,
                budget=budget,
                selected_interventions=[],
                total_cost=0,
                baseline_impact=baseline_impact,
                optimized_impact=baseline_impact,
                impact_reduction=0.0,
                roi_score=0.0
            )

        # Target candidate assets prioritised by systemic criticality and active failures
        node_crits = calculate_node_criticality(network, self.impact_engine, scenario.scenario_id, sim_state)
        critical_order = [nc.asset_id for nc in node_crits[:max_candidates]]

        # Candidate pool: (intervention, target_asset)
        candidates: List[SelectedIntervention] = []
        for asset_id in critical_order:
            node = network.node_map.get(asset_id)
            if not node:
                continue
            for inv in catalog:
                if node.type in inv.target_types and inv.cost <= budget:
                    candidates.append(SelectedIntervention(
                        intervention_id=inv.id,
                        target_asset_id=asset_id,
                        cost=inv.cost
                    ))

        # Knapsack / combinatorial search across feasible combinations (k=1 to 4)
        best_selected: List[SelectedIntervention] = []
        best_impact = baseline_impact
        best_cost = 0

        # Sort candidates by greedy cost-benefit heuristic
        candidates = candidates[:18]

        for k in range(1, min(5, len(candidates) + 1)):
            for combo in itertools.combinations(candidates, k):
                # Ensure no duplicate interventions on the same asset
                assets_in_combo = [c.target_asset_id for c in combo]
                if len(assets_in_combo) != len(set(assets_in_combo)):
                    continue

                cost = sum(c.cost for c in combo)
                if cost > budget:
                    continue

                hardened_state = apply_interventions_to_simulation(sim_state, network, list(combo), catalog)
                res = self.impact_engine.calculate_human_impact(hardened_state, network, scenario)
                score = res.impact_score

                if score < best_impact or (abs(score - best_impact) < 1e-4 and cost < best_cost):
                    best_impact = score
                    best_selected = list(combo)
                    best_cost = cost

        impact_reduction = max(0.0, baseline_impact - best_impact)
        roi = (impact_reduction / best_cost * 1_000_000.0) if best_cost > 0 else 0.0

        return OptimizationResult(
            scenario_id=scenario.scenario_id,
            budget=budget,
            selected_interventions=best_selected,
            total_cost=best_cost,
            baseline_impact=baseline_impact,
            optimized_impact=best_impact,
            impact_reduction=impact_reduction,
            roi_score=roi
        )
