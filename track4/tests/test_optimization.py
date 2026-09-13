import pytest
from impact.models import NetworkGraph, NetworkNode, NetworkEdge, SimulationState, AssetStateInfo, Scenario
from track4.engine import Track4Engine
from track4.models import SelectedIntervention


@pytest.fixture
def test_setup():
    nodes = [
        NetworkNode(id="sub_01", name="Substation", type="substation", lat=19.12, lon=72.91, population_served=50000),
        NetworkNode(id="hosp_01", name="Hospital", type="hospital", lat=19.12, lon=72.915, population_served=25000, backup_duration=4.0),
    ]
    edges = [
        NetworkEdge(id="e1", from_node="sub_01", to_node="hosp_01", type="power"),
    ]
    network = NetworkGraph(nodes=nodes, edges=edges)

    sim_state = SimulationState(
        scenario_id="sc_test",
        time=4.0,
        assets={
            "sub_01": AssetStateInfo(state="FAILED", load=0.0),
            "hosp_01": AssetStateInfo(state="BACKUP", load=80.0),
        },
        failed_nodes=["sub_01"],
        backup_nodes=["hosp_01"],
    )

    scenario = Scenario(
        scenario_id="sc_test",
        name="Grid Trip",
        description="Grid failure scenario",
        duration_hours=6.0,
        initial_failures=["sub_01"],
    )

    return network, sim_state, scenario


def test_optimization_budget_constraint(test_setup):
    network, sim_state, scenario = test_setup
    engine = Track4Engine()

    budget = 1000000
    opt = engine.optimize_budget(network, sim_state, scenario, budget)

    assert opt.total_cost <= budget
    assert opt.optimized_impact <= opt.baseline_impact
    assert opt.impact_reduction >= 0.0


def test_user_plan_vs_optimal(test_setup):
    network, sim_state, scenario = test_setup
    engine = Track4Engine()

    budget = 1200000
    # User selects backup generator on hospital
    user_interventions = [
        SelectedIntervention(intervention_id="backup_generator", target_asset_id="hosp_01", cost=500000)
    ]

    user_plan = engine.evaluate_user_plan(network, sim_state, scenario, budget, user_interventions)
    optimal_plan = engine.optimize_budget(network, sim_state, scenario, budget)

    assert user_plan.total_cost <= budget
    assert user_plan.resulting_impact <= user_plan.baseline_impact
    # Optimal plan should perform at least as well as user plan
    assert optimal_plan.optimized_impact <= user_plan.resulting_impact + 1e-4
