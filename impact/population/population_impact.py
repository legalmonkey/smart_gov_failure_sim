import math
from typing import Dict, Set, Any
from ..models import SimulationState, NetworkGraph, NetworkNode


def get_node_status(node_id: str, sim_state: SimulationState) -> str:
    """Helper to resolve a node's operational status from simulation state."""
    if node_id in sim_state.assets:
        return sim_state.assets[node_id].state
    if node_id in sim_state.failed_nodes:
        return "FAILED"
    if node_id in sim_state.degraded_nodes:
        return "DEGRADED"
    if node_id in sim_state.backup_nodes:
        return "BACKUP"
    if node_id in sim_state.critical_nodes:
        return "CRITICAL"
    return "OPERATIONAL"


def calculate_population_affected(sim_state: SimulationState, network: NetworkGraph) -> int:
    """
    Calculates total human population experiencing outage or service degradation.
    Follows Section 3.1: Number of people losing or receiving degraded services.
    """
    total_affected = 0
    counted_nodes: Set[str] = set()

    # 1. Direct population attached to failed/degraded nodes
    for node in network.nodes:
        status = get_node_status(node.id, sim_state)
        pop = node.population_served or 0
        if pop <= 0:
            continue

        if status == "FAILED":
            total_affected += pop
            counted_nodes.add(node.id)
        elif status == "DEGRADED":
            total_affected += math.ceil(pop * 0.40)
            counted_nodes.add(node.id)
        elif status == "CRITICAL":
            total_affected += math.ceil(pop * 0.25)
            counted_nodes.add(node.id)
        elif status == "BACKUP":
            # Running on temporary backup reduces full impact but still represents vulnerable population
            total_affected += math.ceil(pop * 0.15)
            counted_nodes.add(node.id)

    # 2. Indirect population loss from upstream utility failures (water pumps, power substations)
    # If a feeder or water pump fails, residential nodes downstream without backup are impacted
    failed_utility_nodes = {
        n.id for n in network.nodes
        if n.type in ("power_substation", "power_station", "water_pump", "water_treatment")
        and get_node_status(n.id, sim_state) in ("FAILED", "DEGRADED")
    }

    if failed_utility_nodes:
        for edge in network.edges:
            if edge.from_node in failed_utility_nodes and edge.to_node not in counted_nodes:
                target_node = network.node_map.get(edge.to_node)
                if target_node and (target_node.population_served or 0) > 0:
                    pop = target_node.population_served
                    utility_status = get_node_status(edge.from_node, sim_state)
                    ratio = 0.50 if utility_status == "FAILED" else 0.25
                    total_affected += math.ceil(pop * ratio)
                    counted_nodes.add(target_node.id)

    return total_affected


def calculate_vulnerability_breakdown(sim_state: SimulationState, network: NetworkGraph) -> Dict[str, Any]:
    """
    Distinguishes vulnerable population classes (Section 3.2):
    - Hospital patients (highest dependency)
    - Students (educational continuity)
    - Households losing clean water or grid power
    """
    patients_at_risk = 0
    students_impacted = 0
    water_disrupted_pop = 0
    power_disrupted_pop = 0

    for node in network.nodes:
        status = get_node_status(node.id, sim_state)
        if status not in ("FAILED", "DEGRADED", "BACKUP", "CRITICAL"):
            continue

        pop = node.population_served or 0
        cap = node.capacity or 0
        if node.type == "hospital":
            # Hospital patient capacity at risk based on properties or node capacity
            icu = int(node.properties.get("icu_beds", 0)) if "icu_beds" in node.properties else 0
            gen = int(node.properties.get("general_beds", 0)) if "general_beds" in node.properties else 0
            patient_count = (icu + gen) if (icu + gen) > 0 else cap
            if status in ("FAILED", "BACKUP"):
                patients_at_risk += patient_count
        elif node.type == "school":
            students_impacted += pop or (int(node.properties.get("student_count", 0)) if "student_count" in node.properties else cap)
        elif node.type in ("water_pump", "water_treatment"):
            water_disrupted_pop += pop or cap
        elif node.type in ("power_substation", "power_station"):
            power_disrupted_pop += pop or cap

    return {
        "hospital_patients_at_risk": patients_at_risk,
        "students_impacted": students_impacted,
        "water_disrupted_population": water_disrupted_pop,
        "power_disrupted_population": power_disrupted_pop,
    }


def calculate_service_disruptions(sim_state: SimulationState, network: NetworkGraph) -> Dict[str, int]:
    """
    Counts critical facility disruptions (Section 3.1):
    hospitals, schools, water treatment/pumping, power feeders.
    """
    hospitals = 0
    schools = 0
    water = 0
    power = 0

    for node in network.nodes:
        status = get_node_status(node.id, sim_state)
        # Any non-operational state constitutes a service disruption
        if status in ("FAILED", "DEGRADED", "BACKUP"):
            if node.type == "hospital":
                hospitals += 1
            elif node.type == "school":
                schools += 1
            elif node.type in ("water_pump", "water_treatment"):
                water += 1
            elif node.type in ("power_substation", "power_station"):
                power += 1

    return {
        "hospital_disruptions": hospitals,
        "school_disruptions": schools,
        "water_service_disruptions": water,
        "power_service_disruptions": power,
    }
