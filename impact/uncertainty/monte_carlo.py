import random
import math
from typing import List, Optional
from ..models import (
    SimulationState,
    NetworkGraph,
    Scenario,
    UncertaintyResult,
    UncertaintyDistribution,
)
from .parameter_sampler import ParameterSampler
from ..population.population_impact import calculate_population_affected


def calculate_percentile(data: List[float], percentile: float) -> float:
    """Calculates the specified percentile (0 to 100) using linear interpolation."""
    if not data:
        return 0.0
    sorted_data = sorted(data)
    n = len(sorted_data)
    if n == 1:
        return float(sorted_data[0])

    k = (n - 1) * (percentile / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return float(sorted_data[int(k)])
    d0 = sorted_data[int(f)] * (c - k)
    d1 = sorted_data[int(c)] * (k - f)
    return float(d0 + d1)


def get_uncertainty_distribution(samples: List[float]) -> UncertaintyDistribution:
    """Computes mean, median, p05, and p95 from a sample array."""
    if not samples:
        return UncertaintyDistribution(mean=0.0, median=0.0, p05=0.0, p95=0.0)

    mean_val = sum(samples) / len(samples)
    median_val = calculate_percentile(samples, 50.0)
    p05_val = calculate_percentile(samples, 5.0)
    p95_val = calculate_percentile(samples, 95.0)

    return UncertaintyDistribution(
        mean=mean_val,
        median=median_val,
        p05=p05_val,
        p95=p95_val,
    )


def run_monte_carlo(
    scenario: Scenario,
    network: NetworkGraph,
    sim_state: SimulationState,
    iterations: int = 1000,
    random_seed: Optional[int] = 42,
) -> UncertaintyResult:
    """
    Executes an N-iteration Monte Carlo simulation over stochastic parameter distributions.
    Follows Section 3.5 & Section 4.11 of the implementation guide.
    """
    rng = random.Random(random_seed) if random_seed is not None else random.Random()
    sampler = ParameterSampler(rng)

    base_pop_affected = calculate_population_affected(sim_state, network)

    # Check if critical facilities (hospital) are in backup or failed state
    is_hospital_in_backup = False
    for node in network.nodes:
        if node.type == "hospital":
            st = sim_state.assets.get(node.id)
            state_val = st.state if st else (
                "FAILED" if node.id in sim_state.failed_nodes else
                "BACKUP" if node.id in sim_state.backup_nodes else
                "CRITICAL" if node.id in sim_state.critical_nodes else "OPERATIONAL"
            )
            if state_val in ("BACKUP", "FAILED", "CRITICAL"):
                is_hospital_in_backup = True
                break

    pop_samples: List[float] = []
    failure_times: List[float] = []
    hospital_failure_count = 0

    for _ in range(iterations):
        sample = sampler.sample()

        # 1. Population variation based on load & demand fluctuations
        if base_pop_affected > 0:
            # Combine hospital load and water demand ratios
            demand_variance = (sample.hospital_load_ratio * 0.5 + sample.water_demand_ratio * 0.5)
            # Add stochastic Gaussian noise around baseline
            simulated_pop = max(
                0,
                int(base_pop_affected * demand_variance * rng.uniform(0.92, 1.08))
            )
            pop_samples.append(float(simulated_pop))
        else:
            pop_samples.append(0.0)

        # 2. Hospital failure modeling over time (Section 3.5)
        # Evaluates generator exhaustion vs. grid feeder recovery duration
        gen_duration = sample.generator_duration_hours
        recovery_time = sample.recovery_time_hours

        failure_times.append(gen_duration)

        if is_hospital_in_backup:
            # If restoration time exceeds fuel reserves, backup fails
            if recovery_time > gen_duration:
                hospital_failure_count += 1
        else:
            # When nominal baseline, hospital has negligible probability of sudden generator failure
            if rng.random() < 0.05:
                hospital_failure_count += 1

    pop_dist = get_uncertainty_distribution(pop_samples)

    hosp_failure_prob = (
        hospital_failure_count / iterations if is_hospital_in_backup else 0.05
    )

    hosp_time_median = calculate_percentile(failure_times, 50.0)
    hosp_time_p05 = calculate_percentile(failure_times, 5.0)
    hosp_time_p95 = calculate_percentile(failure_times, 95.0)

    return UncertaintyResult(
        scenario_id=scenario.scenario_id,
        iterations=iterations,
        random_seed=random_seed,
        population_affected=pop_dist,
        hospital_failure_probability=hosp_failure_prob,
        hospital_failure_time_hours={
            "median": hosp_time_median,
            "p05": hosp_time_p05,
            "p95": hosp_time_p95,
        },
    )
