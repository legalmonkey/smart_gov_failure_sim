import pytest
from impact.models import (
    NetworkNode,
    NetworkEdge,
    NetworkGraph,
    SimulationState,
    AssetStateInfo,
)
from impact.population.population_impact import (
    calculate_population_affected,
    calculate_vulnerability_breakdown,
    calculate_service_disruptions,
)


@pytest.fixture
def sample_network():
    nodes = [
        NetworkNode(id="pwr_01", name="Main Substation", type="power_substation", lat=19.12, lon=72.91, capacity=500),
        NetworkNode(id="hosp_01", name="General Hospital", type="hospital", lat=19.12, lon=72.91, population_served=2500, properties={"icu_beds": 50, "general_beds": 200}),
        NetworkNode(id="sch_01", name="Public School", type="school", lat=19.12, lon=72.91, population_served=1200, properties={"student_count": 1200}),
        NetworkNode(id="res_01", name="Residential Ward A", type="residential", lat=19.12, lon=72.91, population_served=15000),
        NetworkNode(id="pump_01", name="Water Pump Station", type="water_pump", lat=19.12, lon=72.91, capacity=300),
    ]
    edges = [
        NetworkEdge(id="e1", from_node="pwr_01", to_node="hosp_01", type="power"),
        NetworkEdge(id="e2", from_node="pwr_01", to_node="res_01", type="power"),
        NetworkEdge(id="e3", from_node="pump_01", to_node="res_01", type="water"),
    ]
    return NetworkGraph(nodes=nodes, edges=edges)


def test_nominal_population_impact(sample_network):
    # Nominal state: all nodes OPERATIONAL
    sim_state = SimulationState(
        scenario_id="nominal_test",
        time=0.0,
        assets={n.id: AssetStateInfo("OPERATIONAL") for n in sample_network.nodes},
    )
    pop = calculate_population_affected(sim_state, sample_network)
    assert pop == 0

    disruptions = calculate_service_disruptions(sim_state, sample_network)
    assert disruptions["hospital_disruptions"] == 0
    assert disruptions["school_disruptions"] == 0
    assert disruptions["power_service_disruptions"] == 0


def test_failed_and_degraded_direct_impact(sample_network):
    sim_state = SimulationState(
        scenario_id="direct_failure_test",
        time=2.0,
        assets={
            "pwr_01": AssetStateInfo("OPERATIONAL"),
            "hosp_01": AssetStateInfo("FAILED"),      # 2500
            "sch_01": AssetStateInfo("DEGRADED"),    # 1200 * 0.40 = 480
            "res_01": AssetStateInfo("OPERATIONAL"),
            "pump_01": AssetStateInfo("OPERATIONAL"),
        },
        failed_nodes=["hosp_01"],
        degraded_nodes=["sch_01"],
    )
    pop = calculate_population_affected(sim_state, sample_network)
    assert pop == 2500 + 480

    disruptions = calculate_service_disruptions(sim_state, sample_network)
    assert disruptions["hospital_disruptions"] == 1
    assert disruptions["school_disruptions"] == 1


def test_vulnerability_breakdown(sample_network):
    sim_state = SimulationState(
        scenario_id="vuln_test",
        time=1.5,
        assets={
            "pwr_01": AssetStateInfo("FAILED"),
            "hosp_01": AssetStateInfo("BACKUP"),
            "sch_01": AssetStateInfo("FAILED"),
            "res_01": AssetStateInfo("DEGRADED"),
            "pump_01": AssetStateInfo("DEGRADED"),
        },
    )
    breakdown = calculate_vulnerability_breakdown(sim_state, sample_network)
    assert breakdown["hospital_patients_at_risk"] == 250  # 50 icu + 200 general
    assert breakdown["students_impacted"] == 1200
    assert breakdown["power_disrupted_population"] > 0
    assert breakdown["water_disrupted_population"] > 0
