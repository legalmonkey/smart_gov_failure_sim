import json
import os
from typing import Dict, Any, Optional, Union
from .models import (
    NetworkGraph,
    NetworkNode,
    NetworkEdge,
    SimulationState,
    AssetStateInfo,
    Scenario,
    ImpactResult,
    UncertaintyResult,
)
from .population.population_impact import (
    calculate_population_affected,
    calculate_vulnerability_breakdown,
    calculate_service_disruptions,
)
from .response.response_delay import calculate_response_delay
from .uncertainty.monte_carlo import run_monte_carlo, get_uncertainty_distribution


class ImpactEngine:
    """
    Main Track 3 Engine implementing human consequences and uncertainty analysis.
    Follows Section 3.1–3.7 and Section 4.10–4.11 of the implementation guide.
    """

    # Study area total baseline population (Powai Lake & Hiranandani: ~120,000 residents)
    STUDY_AREA_POPULATION = 120000

    # Normalization weights for Cascade Impact Score (Section 3.3, sum = 1.0)
    WEIGHT_POPULATION = 0.30
    WEIGHT_DURATION = 0.20
    WEIGHT_VULNERABILITY = 0.20
    WEIGHT_RESPONSE_DELAY = 0.15
    WEIGHT_CRITICAL_SERVICES = 0.15

    def calculate_human_impact(
        self,
        sim_state: SimulationState,
        network: NetworkGraph,
        scenario: Optional[Scenario] = None,
    ) -> ImpactResult:
        """
        Translates infrastructure failure states into quantified human consequences
        and calculates the normalized Cascade Impact Score.
        """
        scenario_id = scenario.scenario_id if scenario else sim_state.scenario_id
        duration_hours = sim_state.time if sim_state.time > 0 else (scenario.duration_hours if scenario else 6.0)

        # 1. Population Impact
        pop_affected = calculate_population_affected(sim_state, network)

        # 2. Emergency Response Delays
        response_delay = calculate_response_delay(sim_state, network)

        # 3. Critical Service Disruptions
        disruptions = calculate_service_disruptions(sim_state, network)
        hospitals = disruptions["hospital_disruptions"]
        schools = disruptions["school_disruptions"]
        water = disruptions["water_service_disruptions"]
        power = disruptions["power_service_disruptions"]

        # 4. Vulnerability breakdown
        vuln = calculate_vulnerability_breakdown(sim_state, network)
        patients_at_risk = vuln["hospital_patients_at_risk"]

        # 5. Normalized Cascade Impact Score (Section 3.3)
        # Dynamically normalized against network topology
        total_pop = sum(n.population_served for n in network.nodes if n.population_served)
        study_pop = total_pop if total_pop > 0 else self.STUDY_AREA_POPULATION
        pop_term = min(1.0, pop_affected / (study_pop * 0.35))
        duration_term = min(1.0, duration_hours / 12.0)

        total_hosp_cap = sum(n.capacity or 200 for n in network.nodes if n.type == "hospital") or 200
        total_schools = max(1, sum(1 for n in network.nodes if n.type == "school"))
        vuln_term = min(1.0, (patients_at_risk / total_hosp_cap) * 0.6 + (schools / total_schools) * 0.4)
        delay_term = min(1.0, response_delay / 45.0)

        total_hospitals = max(1, sum(1 for n in network.nodes if n.type == "hospital"))
        total_water = max(1, sum(1 for n in network.nodes if n.type in ("water_pump", "water_treatment")))
        total_power = max(1, sum(1 for n in network.nodes if n.type in ("power_substation", "power_station")))

        services_term = (
            0.35 * min(1.0, hospitals / total_hospitals)
            + 0.25 * min(1.0, water / total_water)
            + 0.25 * min(1.0, power / total_power)
            + 0.15 * min(1.0, schools / total_schools)
        )

        # If completely nominal, score is strictly 0.0
        if pop_affected == 0 and response_delay == 0 and hospitals == 0 and water == 0 and power == 0:
            impact_score = 0.0
        else:
            raw_score = (
                self.WEIGHT_POPULATION * pop_term
                + self.WEIGHT_DURATION * duration_term
                + self.WEIGHT_VULNERABILITY * vuln_term
                + self.WEIGHT_RESPONSE_DELAY * delay_term
                + self.WEIGHT_CRITICAL_SERVICES * services_term
            )
            impact_score = min(1.0, max(0.08, raw_score))

        return ImpactResult(
            scenario_id=scenario_id,
            population_affected=pop_affected,
            duration_hours=duration_hours,
            emergency_response_delay_minutes=response_delay,
            hospital_disruptions=hospitals,
            school_disruptions=schools,
            water_service_disruptions=water,
            power_service_disruptions=power,
            impact_score=round(impact_score, 2),
        )

    def run_uncertainty(
        self,
        scenario: Scenario,
        network: NetworkGraph,
        sim_state: SimulationState,
        iterations: int = 1000,
        seed: Optional[int] = 42,
    ) -> UncertaintyResult:
        """Runs the Monte Carlo simulation to generate honest uncertainty bounds."""
        return run_monte_carlo(
            scenario=scenario,
            network=network,
            sim_state=sim_state,
            iterations=iterations,
            random_seed=seed,
        )


# Module-level convenience functions matching Section 3.7 API signatures
_default_engine = ImpactEngine()


def calculate_human_impact(
    sim_state: SimulationState,
    network: NetworkGraph,
    scenario: Optional[Scenario] = None,
) -> ImpactResult:
    return _default_engine.calculate_human_impact(sim_state, network, scenario)


def calculate_population(sim_state: SimulationState, network: NetworkGraph) -> int:
    return calculate_population_affected(sim_state, network)


def calculate_delay(sim_state: SimulationState, network: Optional[NetworkGraph] = None) -> int:
    return calculate_response_delay(sim_state, network)


def run_monte_carlo_analysis(
    scenario: Scenario,
    network: NetworkGraph,
    sim_state: SimulationState,
    iterations: int = 1000,
    seed: Optional[int] = 42,
) -> UncertaintyResult:
    return _default_engine.run_uncertainty(scenario, network, sim_state, iterations, seed)


# JSON Serialization Loaders
def load_network_graph(data: Union[str, Dict[str, Any]]) -> NetworkGraph:
    """Constructs a NetworkGraph dataclass from a JSON file path, JSON string, or dict."""
    if isinstance(data, str):
        if os.path.exists(data):
            with open(data, "r", encoding="utf-8") as f:
                data = json.load(f)
        else:
            data = json.loads(data)

    nodes: list[NetworkNode] = []
    for n in data.get("nodes", []):
        attrs = n.get("attributes") or {}
        loc = n.get("location") or {}
        lat = n.get("lat") if n.get("lat") is not None else loc.get("latitude", 0.0)
        lon = n.get("lon") if n.get("lon") is not None else loc.get("longitude", 0.0)
        pop = n.get("population_served") if n.get("population_served") is not None else attrs.get("population_served", 0)
        capacity = n.get("capacity") if n.get("capacity") is not None else attrs.get("capacity", 100.0)
        backup = (
            n.get("backup_duration")
            if "backup_duration" in n and n["backup_duration"] is not None
            else attrs.get("backup_duration_hours", attrs.get("backup_duration"))
        )
        nodes.append(
            NetworkNode(
                id=n["id"],
                name=n.get("name", n["id"]),
                type=n.get("type", "infrastructure"),
                lat=float(lat),
                lon=float(lon),
                population_served=int(pop),
                capacity=float(capacity),
                backup_duration=float(backup) if backup is not None else None,
                properties=n.get("properties", {}),
            )
        )

    edges: list[NetworkEdge] = []
    for e in data.get("edges", []):
        attrs = e.get("attributes") or {}
        weight = e.get("weight") if e.get("weight") is not None else attrs.get("dependency_strength", 1.0)
        capacity = e.get("capacity") if e.get("capacity") is not None else attrs.get("capacity", 100.0)
        edges.append(
            NetworkEdge(
                id=e["id"],
                from_node=e.get("from", e.get("from_node", "")),
                to_node=e.get("to", e.get("to_node", "")),
                type=e.get("type", "dependency"),
                capacity=float(capacity),
                weight=float(weight),
            )
        )

    return NetworkGraph(nodes=nodes, edges=edges)


def load_simulation_state(data: Union[str, Dict[str, Any]]) -> SimulationState:
    """Constructs a SimulationState dataclass from a JSON file path, JSON string, or dict."""
    if isinstance(data, str):
        if os.path.exists(data):
            with open(data, "r", encoding="utf-8") as f:
                data = json.load(f)
        else:
            data = json.loads(data)

    assets: Dict[str, AssetStateInfo] = {}
    for aid, ainfo in data.get("assets", {}).items():
        if isinstance(ainfo, dict):
            assets[aid] = AssetStateInfo(
                state=ainfo.get("state", "OPERATIONAL"),
                load=float(ainfo.get("load", 0.0)),
            )
        else:
            assets[aid] = AssetStateInfo(state=str(ainfo), load=0.0)

    return SimulationState(
        scenario_id=data.get("scenario_id", "scenario_01"),
        time=float(data.get("time", 0.0)),
        assets=assets,
        failed_nodes=list(data.get("failed_nodes", [])),
        degraded_nodes=list(data.get("degraded_nodes", [])),
        backup_nodes=list(data.get("backup_nodes", [])),
        critical_nodes=list(data.get("critical_nodes", [])),
        affected_edges=list(data.get("affected_edges", [])),
    )


def load_scenario(data: Union[str, Dict[str, Any]]) -> Scenario:
    """Constructs a Scenario dataclass from a JSON string or dict."""
    if isinstance(data, str):
        data = json.loads(data)

    return Scenario(
        scenario_id=data.get("scenario_id", "scenario_01"),
        name=data.get("name", "Scenario"),
        description=data.get("description", ""),
        duration_hours=float(data.get("duration_hours", 24.0)),
        initial_failures=list(data.get("initial_failures", [])),
        parameters=data.get("parameters", {}),
    )
