import random
import pytest
from impact.models import (
    NetworkNode,
    NetworkGraph,
    SimulationState,
    AssetStateInfo,
    Scenario,
)
from impact.uncertainty.parameter_sampler import ParameterSampler
from impact.uncertainty.monte_carlo import (
    calculate_percentile,
    get_uncertainty_distribution,
    run_monte_carlo,
)


def test_percentile_calculation():
    data = [10.0, 20.0, 30.0, 40.0, 50.0]
    # Median
    assert calculate_percentile(data, 50.0) == 30.0
    # Minimum & maximum
    assert calculate_percentile(data, 0.0) == 10.0
    assert calculate_percentile(data, 100.0) == 50.0
    # Monotonicity
    assert calculate_percentile(data, 5.0) <= calculate_percentile(data, 50.0) <= calculate_percentile(data, 95.0)


def test_parameter_sampler_bounds():
    rng = random.Random(42)
    sampler = ParameterSampler(rng)
    for _ in range(100):
        sample = sampler.sample()
        assert 5.0 <= sample.generator_duration_hours <= 7.5
        assert 0.65 <= sample.hospital_load_ratio <= 0.85
        assert 0.80 <= sample.water_demand_ratio <= 1.00
        assert 2.0 <= sample.recovery_time_hours <= 6.0
        assert 0.85 <= sample.road_delay_multiplier <= 1.35


def test_monte_carlo_distribution_reproducibility():
    nodes = [
        NetworkNode(id="hosp_01", name="Powai Hospital", type="hospital", lat=19.12, lon=72.91, population_served=5000),
        NetworkNode(id="sub_01", name="Main Substation", type="power_substation", lat=19.12, lon=72.91),
    ]
    network = NetworkGraph(nodes=nodes, edges=[])
    scenario = Scenario(scenario_id="mc_test", name="Power Outage", description="")

    sim_state = SimulationState(
        scenario_id="mc_test",
        time=3.5,
        assets={
            "sub_01": AssetStateInfo("FAILED"),
            "hosp_01": AssetStateInfo("BACKUP"),
        },
        failed_nodes=["sub_01"],
        backup_nodes=["hosp_01"],
    )

    # Run twice with the exact same seed
    res1 = run_monte_carlo(scenario, network, sim_state, iterations=500, random_seed=123)
    res2 = run_monte_carlo(scenario, network, sim_state, iterations=500, random_seed=123)

    assert res1.population_affected.median == res2.population_affected.median
    assert res1.population_affected.p05 == res2.population_affected.p05
    assert res1.population_affected.p95 == res2.population_affected.p95
    assert res1.hospital_failure_probability == res2.hospital_failure_probability

    # Verify statistical consistency: p05 <= median <= p95
    assert res1.population_affected.p05 <= res1.population_affected.median <= res1.population_affected.p95
    assert res1.hospital_failure_time_hours["p05"] <= res1.hospital_failure_time_hours["median"] <= res1.hospital_failure_time_hours["p95"]
    assert 0.0 <= res1.hospital_failure_probability <= 1.0
