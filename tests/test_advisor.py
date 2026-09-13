import pytest
from impact.models import NetworkGraph, NetworkNode, NetworkEdge, SimulationState, AssetStateInfo, Scenario
from track4.engine import Track4Engine
from track4.models import SelectedIntervention


def test_ai_advisor_generation():
    nodes = [
        NetworkNode(id="sub_01", name="Powai Substation", type="substation", lat=19.12, lon=72.91, population_served=60000),
        NetworkNode(id="hosp_01", name="Dr LH Hiranandani Hospital", type="hospital", lat=19.12, lon=72.915, population_served=25000),
    ]
    edges = [
        NetworkEdge(id="e1", from_node="sub_01", to_node="hosp_01", type="power")
    ]
    network = NetworkGraph(nodes=nodes, edges=edges)

    sim_state = SimulationState(
        scenario_id="sc_01",
        time=3.0,
        assets={"sub_01": AssetStateInfo(state="FAILED"), "hosp_01": AssetStateInfo(state="FAILED")},
        failed_nodes=["sub_01", "hosp_01"]
    )
    scenario = Scenario(scenario_id="sc_01", name="Blackout", description="Blackout scenario", duration_hours=6.0, initial_failures=["sub_01"])

    engine = Track4Engine()
    crits = engine.calculate_criticality(network, scenario.scenario_id, sim_state)

    user_plan = engine.evaluate_user_plan(
        network, sim_state, scenario, 2000000,
        [SelectedIntervention(intervention_id="backup_generator", target_asset_id="hosp_01", cost=500000)]
    )
    optimal_plan = engine.optimize_budget(network, sim_state, scenario, 2000000)

    advice = engine.generate_advisor_analysis(user_plan, optimal_plan, crits, network)

    assert advice.scenario_id == "sc_01"
    assert len(advice.advisor_text) > 20
    assert len(advice.priority_reasons) > 0
    assert isinstance(advice.missed_critical_assets, list)
