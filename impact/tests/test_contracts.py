import json
from pathlib import Path
import pytest
from impact.impact_engine import (
    ImpactEngine,
    load_network_graph,
    load_simulation_state,
    load_scenario,
)

FIXTURES_DIR = Path("tests/fixtures")


@pytest.fixture
def mock_fixtures():
    with open(FIXTURES_DIR / "mock-network.json", "r", encoding="utf-8") as f:
        network = load_network_graph(json.load(f))
    with open(FIXTURES_DIR / "mock-simulation-state.json", "r", encoding="utf-8") as f:
        sim_state = load_simulation_state(json.load(f))
    with open(FIXTURES_DIR / "mock-scenario.json", "r", encoding="utf-8") as f:
        scenario = load_scenario(json.load(f))
    return network, sim_state, scenario


def test_human_impact_contract_schema(mock_fixtures):
    network, sim_state, scenario = mock_fixtures
    engine = ImpactEngine()
    impact = engine.calculate_human_impact(sim_state, network, scenario)
    impact_dict = impact.to_dict()

    # Verify all keys from Section 4.10 are present
    required_keys = {
        "scenario_id",
        "population_affected",
        "duration_hours",
        "emergency_response_delay_minutes",
        "hospital_disruptions",
        "school_disruptions",
        "water_service_disruptions",
        "power_service_disruptions",
        "impact_score",
    }
    assert set(impact_dict.keys()) == required_keys
    assert isinstance(impact_dict["scenario_id"], str)
    assert isinstance(impact_dict["population_affected"], int)
    assert isinstance(impact_dict["duration_hours"], (int, float))
    assert isinstance(impact_dict["emergency_response_delay_minutes"], int)
    assert isinstance(impact_dict["hospital_disruptions"], int)
    assert isinstance(impact_dict["school_disruptions"], int)
    assert isinstance(impact_dict["water_service_disruptions"], int)
    assert isinstance(impact_dict["power_service_disruptions"], int)
    assert 0.0 <= impact_dict["impact_score"] <= 1.0


def test_uncertainty_contract_schema(mock_fixtures):
    network, sim_state, scenario = mock_fixtures
    engine = ImpactEngine()
    unc = engine.run_uncertainty(scenario, network, sim_state, iterations=200, seed=42)
    unc_dict = unc.to_dict()

    # Verify all keys from Section 4.11 are present
    required_keys = {
        "scenario_id",
        "iterations",
        "random_seed",
        "population_affected",
        "hospital_failure_probability",
        "hospital_failure_time_hours",
    }
    assert set(unc_dict.keys()) == required_keys

    pop_dist = unc_dict["population_affected"]
    assert set(pop_dist.keys()) == {"mean", "median", "p05", "p95"}
    assert pop_dist["p05"] <= pop_dist["median"] <= pop_dist["p95"]

    assert 0.0 <= unc_dict["hospital_failure_probability"] <= 1.0
    hosp_times = unc_dict["hospital_failure_time_hours"]
    assert set(hosp_times.keys()) == {"median", "p05", "p95"}
    assert hosp_times["p05"] <= hosp_times["median"] <= hosp_times["p95"]
