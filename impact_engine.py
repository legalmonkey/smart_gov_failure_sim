import json
import random
import os
from typing import Dict, Any, List
from models import SimulationState, ImpactResult, UncertaintyResult, PopulationAffectedStats

class ImpactEngine:
    def __init__(self, config_path: str = "config.json"):
        # Load weights from config file to avoid hidden constants
        dir_path = os.path.dirname(os.path.realpath(__file__))
        full_config_path = os.path.join(dir_path, config_path)
        with open(full_config_path, 'r') as f:
            self.config = json.load(f)
        
        self.weights = self.config["impact_weights"]
        self.max_vals = self.config["max_normalization_values"]

    def calculate_human_impact(self, simulation_state: SimulationState) -> ImpactResult:
        """
        Translates infrastructure failure into human consequences.
        Returns a populated ImpactResult.
        """
        pop_affected = self.calculate_population_affected(simulation_state)
        delay = self.calculate_response_delay(simulation_state)
        
        # Mocking calculation based on simulation_state
        hospital_disruptions = len([n for n in simulation_state.failed_nodes if 'hospital' in n])
        school_disruptions = len([n for n in simulation_state.failed_nodes if 'school' in n])
        water_disruptions = len([n for n in simulation_state.failed_nodes if 'water' in n])
        power_disruptions = len([n for n in simulation_state.failed_nodes if 'power' or 'substation' in n])
        
        # Determine total duration (mock logic using time)
        duration = float(simulation_state.time)

        # Calculate impact score
        impact_score = self._calculate_impact_score(
            population=pop_affected,
            duration=duration,
            vulnerability_score=0.5, # Mock vulnerability for now
            response_delay=delay,
            critical_services=hospital_disruptions + school_disruptions + water_disruptions + power_disruptions
        )

        return ImpactResult(
            schema_version="1.0",
            scenario_id="scenario_01",
            population_affected=pop_affected,
            duration_hours=duration,
            emergency_response_delay_minutes=delay,
            hospital_disruptions=hospital_disruptions,
            school_disruptions=school_disruptions,
            water_service_disruptions=water_disruptions,
            power_service_disruptions=power_disruptions,
            impact_score=impact_score
        )

    def calculate_population_affected(self, simulation_state: SimulationState) -> int:
        """
        Calculate number of people losing or receiving degraded services.
        Do not hardcode population affected; it should be derived from the network/nodes.
        """
        # Mock calculation: 500 people per failed node, 100 per degraded node
        return len(simulation_state.failed_nodes) * 500 + len(simulation_state.degraded_nodes) * 100

    def calculate_response_delay(self, simulation_state: SimulationState) -> float:
        """
        Calculate emergency response delay by comparing normal travel time vs failure scenario travel time.
        """
        # Mock calculation: 2 minutes delay per affected edge
        return len(simulation_state.affected_edges) * 2.0

    def run_monte_carlo(self, base_scenario_state: SimulationState, iterations: int) -> UncertaintyResult:
        """
        Run N iterations with random operational parameters to generate probability distributions.
        """
        pop_results = []
        hospital_failures = 0
        
        for _ in range(iterations):
            # Introduce uncertainty/randomness into the simulation evaluation
            # Example: randomizing the number of people affected per failed node
            random_pop_factor = random.uniform(0.8, 1.2)
            pop = int(self.calculate_population_affected(base_scenario_state) * random_pop_factor)
            pop_results.append(pop)
            
            # Simulate random chance of hospital failure based on degraded state
            if len(base_scenario_state.degraded_nodes) > 0 and random.random() < 0.3:
                hospital_failures += 1

        pop_results.sort()
        
        p05_idx = int(iterations * 0.05)
        p95_idx = int(iterations * 0.95)

        stats = PopulationAffectedStats(
            mean=sum(pop_results) / iterations,
            median=pop_results[iterations // 2],
            p05=pop_results[p05_idx],
            p95=pop_results[p95_idx]
        )

        return UncertaintyResult(
            schema_version="1.0",
            scenario_id="scenario_01",
            iterations=iterations,
            random_seed=42, # Mock seed for now
            population_affected=stats,
            hospital_failure_probability=hospital_failures / iterations
        )

    def get_uncertainty_distribution(self):
        """
        Returns confidence ranges and percentiles (implemented via run_monte_carlo).
        """
        pass
        
    def _calculate_impact_score(self, population: int, duration: float, 
                                vulnerability_score: float, response_delay: float, 
                                critical_services: int) -> float:
        """
        Calculates the normalized Cascade Impact Score.
        """
        n_pop = min(population / self.max_vals["max_population"], 1.0)
        n_dur = min(duration / self.max_vals["max_duration_hours"], 1.0)
        n_delay = min(response_delay / self.max_vals["max_delay_minutes"], 1.0)
        n_crit = min(critical_services / self.max_vals["max_critical_services"], 1.0)
        
        score = (
            self.weights["population"] * n_pop +
            self.weights["duration"] * n_dur +
            self.weights["vulnerability"] * vulnerability_score +
            self.weights["response_delay"] * n_delay +
            self.weights["critical_services"] * n_crit
        )
        return min(score, 1.0)
