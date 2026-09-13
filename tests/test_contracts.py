import json
import os
from track4.models import (
    NodeCriticality,
    EdgeCriticality,
    CriticalityResult,
    OptimizationResult,
    SelectedIntervention,
    AdvisorResult,
    AdvisorPlanSummary,
    Intervention
)


def test_contract_c16_criticality_schema():
    crit = CriticalityResult(
        scenario_id="scenario_01",
        nodes=[NodeCriticality(asset_id="substation_01", criticality_score=0.91, baseline_impact=0.31, removal_impact=0.91)],
        edges=[EdgeCriticality(edge_id="power_connection_01", criticality_score=0.87, baseline_impact=0.31, removal_impact=0.87)]
    )
    data = crit.to_dict()
    assert "scenario_id" in data
    assert "nodes" in data
    assert "edges" in data
    assert data["nodes"][0]["asset_id"] == "substation_01"
    assert data["nodes"][0]["criticality_score"] == 0.91


def test_contract_c17_optimization_schema():
    opt = OptimizationResult(
        scenario_id="scenario_01",
        budget=2000000,
        selected_interventions=[SelectedIntervention(intervention_id="backup_generator", target_asset_id="hospital_01", cost=500000)],
        total_cost=1800000,
        baseline_impact=0.72,
        optimized_impact=0.31,
        impact_reduction=0.41
    )
    data = opt.to_dict()
    assert data["budget"] == 2000000
    assert data["impact_reduction"] == 0.41
    assert len(data["selected_interventions"]) == 1


def test_contract_c18_advisor_schema():
    adv = AdvisorResult(
        scenario_id="scenario_01",
        user_plan=AdvisorPlanSummary(impact=0.48, impact_reduction=0.24),
        optimal_plan=AdvisorPlanSummary(impact=0.31, impact_reduction=0.41),
        missed_critical_assets=["substation_01"],
        missed_critical_edges=["power_connection_01"],
        priority_reasons=["major hospital power bottleneck", "low redundancy"]
    )
    data = adv.to_dict()
    assert data["user_plan"]["impact"] == 0.48
    assert data["optimal_plan"]["impact"] == 0.31
    assert "substation_01" in data["missed_critical_assets"]
