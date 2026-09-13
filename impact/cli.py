import argparse
import json
import os
import sys
from pathlib import Path

from .impact_engine import (
    ImpactEngine,
    load_network_graph,
    load_simulation_state,
    load_scenario,
)


def main():
    parser = argparse.ArgumentParser(
        description="Track 3 — Human Impact & Uncertainty Engine CLI runner"
    )
    parser.add_argument(
        "--network",
        type=str,
        required=True,
        help="Path to network.json (infrastructure graph)",
    )
    parser.add_argument(
        "--sim-state",
        type=str,
        required=True,
        help="Path to simulation_state.json (cascade state)",
    )
    parser.add_argument(
        "--scenario",
        type=str,
        default=None,
        help="Path to scenario.json (optional scenario specifications)",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=".",
        help="Directory where impact_result.json and uncertainty_result.json will be saved",
    )
    parser.add_argument(
        "--iterations",
        type=int,
        default=1000,
        help="Number of Monte Carlo iterations (default: 1000)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for reproducible Monte Carlo runs (default: 42)",
    )

    args = parser.parse_args()

    # Load Inputs
    network_path = Path(args.network)
    if not network_path.exists():
        print(f"Error: Network file not found at {network_path}", file=sys.stderr)
        sys.exit(1)

    sim_state_path = Path(args.sim_state)
    if not sim_state_path.exists():
        print(f"Error: Simulation state file not found at {sim_state_path}", file=sys.stderr)
        sys.exit(1)

    with open(network_path, "r", encoding="utf-8") as f:
        network = load_network_graph(json.load(f))

    with open(sim_state_path, "r", encoding="utf-8") as f:
        sim_state = load_simulation_state(json.load(f))

    scenario = None
    if args.scenario:
        scenario_path = Path(args.scenario)
        if scenario_path.exists():
            with open(scenario_path, "r", encoding="utf-8") as f:
                scenario = load_scenario(json.load(f))

    engine = ImpactEngine()

    # 1. Calculate Human Impact (Section 3.1–3.3, Contract 4.10)
    impact_res = engine.calculate_human_impact(sim_state, network, scenario)

    # 2. Run Monte Carlo Uncertainty (Section 3.4–3.5, Contract 4.11)
    unc_res = engine.run_uncertainty(
        scenario=scenario or load_scenario({"scenario_id": sim_state.scenario_id}),
        network=network,
        sim_state=sim_state,
        iterations=args.iterations,
        seed=args.seed,
    )

    # Write Outputs
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    impact_out_path = out_dir / "impact_result.json"
    unc_out_path = out_dir / "uncertainty_result.json"

    with open(impact_out_path, "w", encoding="utf-8") as f:
        json.dump(impact_res.to_dict(), f, indent=2)

    with open(unc_out_path, "w", encoding="utf-8") as f:
        json.dump(unc_res.to_dict(), f, indent=2)

    print(f"[OK] Track 3 generated:")
    print(f"   -> {impact_out_path}")
    print(f"      Population Affected: {impact_res.population_affected:,}")
    print(f"      Response Delay: +{impact_res.emergency_response_delay_minutes} min")
    print(f"      Impact Score: {impact_res.impact_score:.2f}")
    print(f"   -> {unc_out_path}")
    print(f"      Monte Carlo 90% CI: [{unc_res.population_affected.p05:,.0f} - {unc_res.population_affected.p95:,.0f}]")
    print(f"      Hospital Failure Probability: {unc_res.hospital_failure_probability * 100:.1f}%")


if __name__ == "__main__":
    main()
