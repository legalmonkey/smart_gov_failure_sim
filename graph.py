import json
import copy
from typing import Dict, List, Optional, Union, Any
try:
    from .models import NetworkNode, NetworkEdge, NetworkGraph
except ImportError:
    from models import NetworkNode, NetworkEdge, NetworkGraph


def load_network(source: Union[str, Dict[str, Any]]) -> NetworkGraph:
    """
    Loads a NetworkGraph from a JSON file path or a dictionary matching the C1 schema.
    """
    if isinstance(source, str):
        with open(source, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = source

    nodes: List[NetworkNode] = []
    for n in data.get("nodes", []):
        node = NetworkNode(
            id=n["id"],
            type=n.get("type", "unknown"),
            name=n.get("name", n["id"]),
            capacity=float(n.get("capacity", 100.0)),
            load=float(n.get("load", 0.0)),
            population_served=int(n.get("population_served", 0)),
            backup_duration=float(n.get("backup_duration", 0.0)),
            failure_threshold=float(n.get("failure_threshold", 90.0)),
            recovery_time=float(n.get("recovery_time", 8.0)),
            status=n.get("status", "OPERATIONAL"),
            osm_id=n.get("osm_id"),
            location=n.get("location"),
        )
        nodes.append(node)

    edges: List[NetworkEdge] = []
    for e in data.get("edges", []):
        edge = NetworkEdge(
            id=e["id"],
            from_node=e.get("from") or e.get("from_node", ""),
            to_node=e.get("to") or e.get("to_node", ""),
            type=e.get("type", "service_dependency"),
            capacity=float(e.get("capacity", 100.0)),
            load=float(e.get("load", 0.0)),
            dependency_strength=float(e.get("dependency_strength", 1.0)),
            failure_probability=float(e.get("failure_probability", 0.0)),
            state=e.get("state", "OPERATIONAL"),
        )
        edges.append(edge)

    return NetworkGraph(
        schema_version=data.get("schema_version", "1.0"),
        nodes=nodes,
        edges=edges,
    )


def clone_network(graph: NetworkGraph) -> NetworkGraph:
    """
    Creates an independent deep-copy clone of the NetworkGraph for simulation isolation.
    """
    nodes_copy = [
        NetworkNode(
            id=n.id,
            type=n.type,
            name=n.name,
            capacity=n.capacity,
            load=n.load,
            population_served=n.population_served,
            backup_duration=n.backup_duration,
            failure_threshold=n.failure_threshold,
            recovery_time=n.recovery_time,
            status=n.status,
            osm_id=n.osm_id,
            location=copy.deepcopy(n.location) if n.location else None,
            current_state=n.status,
            current_load=n.load,
            available_capacity=n.capacity,
            remaining_backup_hours=n.backup_duration,
            degradation_hours=0.0,
            critical_hours=0.0,
            time_failed=None,
            recovery_elapsed_hours=0.0,
        )
        for n in graph.nodes
    ]

    edges_copy = [
        NetworkEdge(
            id=e.id,
            from_node=e.from_node,
            to_node=e.to_node,
            type=e.type,
            capacity=e.capacity,
            load=e.load,
            dependency_strength=e.dependency_strength,
            failure_probability=e.failure_probability,
            state=e.state,
            current_state=e.state,
            current_load=e.load,
        )
        for e in graph.edges
    ]

    return NetworkGraph(
        schema_version=graph.schema_version,
        nodes=nodes_copy,
        edges=edges_copy,
    )
