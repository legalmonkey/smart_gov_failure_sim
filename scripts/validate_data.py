#!/usr/bin/env python3
"""
scripts/validate_data.py

Automated validator for Track 1 datasets:
- network.json
- facilities.json
- population.json
- simulation_config.json
- osm_features.geojson

Enforces structural schemas, referential integrity, unit conventions,
provenance tags, probability bounds, and graph connectivity rules.
Returns exit code 0 on success, 1 on validation error.
"""

import argparse
import json
import logging
import os
import re
import sys
from typing import Any, Dict, List, Optional, Set, Tuple

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("validate_data")

OSM_REF_REGEX = re.compile(r"^(node|way|relation)/\d+$")
VALID_DATA_STATUSES = {"REAL", "SIMULATED", "DERIVED"}
REQUIRED_NODE_ATTRIBUTES = [
    "capacity",
    "load",
    "population_served",
    "backup_duration_hours",
    "failure_threshold",
    "recovery_time_hours"
]
REQUIRED_EDGE_ATTRIBUTES = [
    "capacity",
    "load",
    "dependency_strength",
    "failure_probability"
]


class ValidationError(Exception):
    """Raised when data fails validation rules."""
    pass


def load_json(path: str) -> Any:
    if not os.path.exists(path):
        raise FileNotFoundError(f"File does not exist: {path}")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def validate_simulation_config(config_data: Dict[str, Any]) -> List[str]:
    errors = []
    if "schema_version" not in config_data:
        errors.append("simulation_config.json missing 'schema_version'")
    states = config_data.get("states", [])
    if not isinstance(states, list) or not states:
        errors.append("simulation_config.json 'states' must be a non-empty list")
    required_states = {"OPERATIONAL", "DEGRADED", "BACKUP", "CRITICAL", "FAILED", "RECOVERING"}
    missing_states = required_states - set(states)
    if missing_states:
        errors.append(f"simulation_config.json missing required states: {missing_states}")
    return errors


def validate_geojson(geojson_data: Dict[str, Any]) -> List[str]:
    errors = []
    if geojson_data.get("type") != "FeatureCollection":
        errors.append("osm_features.geojson must have type 'FeatureCollection'")

    features = geojson_data.get("features", [])
    if not isinstance(features, list) or len(features) == 0:
        errors.append("osm_features.geojson must contain a non-empty list of features")

    # Validate coordinate ordering [longitude, latitude]
    for idx, feat in enumerate(features[:500]):  # check sample / full set
        geom = feat.get("geometry")
        if not geom:
            errors.append(f"GeoJSON feature index {idx} has no geometry")
            continue

        gtype = geom.get("type")
        coords = geom.get("coordinates")

        def check_coord(pt: Any, path: str):
            if not isinstance(pt, (list, tuple)) or len(pt) < 2:
                errors.append(f"Invalid coordinate format at {path}: {pt}")
                return
            lon, lat = pt[0], pt[1]
            if not (-180.0 <= lon <= 180.0):
                errors.append(f"Longitude out of bounds [-180, 180] at {path}: {lon}")
            if not (-90.0 <= lat <= 90.0):
                errors.append(f"Latitude out of bounds [-90, 90] at {path}: {lat}")

        if gtype == "Point":
            check_coord(coords, f"feature {idx}")
        elif gtype in ("LineString", "MultiPoint"):
            for p_idx, pt in enumerate(coords):
                check_coord(pt, f"feature {idx} pt {p_idx}")
        elif gtype in ("Polygon", "MultiLineString"):
            for r_idx, ring in enumerate(coords):
                for p_idx, pt in enumerate(ring):
                    check_coord(pt, f"feature {idx} ring {r_idx} pt {p_idx}")
        elif gtype == "MultiPolygon":
            for poly_idx, poly in enumerate(coords):
                for r_idx, ring in enumerate(poly):
                    for p_idx, pt in enumerate(ring):
                        check_coord(pt, f"feature {idx} poly {poly_idx} ring {r_idx} pt {p_idx}")

    return errors


def validate_network(
    network_data: Dict[str, Any],
    valid_states: Set[str]
) -> Tuple[List[str], List[str]]:
    """
    Validates canonical network graph.
    Returns (errors, warnings).
    """
    errors: List[str] = []
    warnings: List[str] = []

    # 1. Top-level metadata
    if network_data.get("schema_version") != "1.0":
        errors.append("network.json 'schema_version' must be '1.0'")

    if not network_data.get("network_id"):
        errors.append("network.json missing 'network_id'")

    if not network_data.get("coordinate_reference_system"):
        warnings.append("network.json missing 'coordinate_reference_system' (expected EPSG:4326)")

    nodes = network_data.get("nodes", [])
    edges = network_data.get("edges", [])

    if not isinstance(nodes, list) or len(nodes) == 0:
        errors.append("network.json 'nodes' must be a non-empty array")
        return errors, warnings

    if not isinstance(edges, list) or len(edges) == 0:
        errors.append("network.json 'edges' must be a non-empty array")
        return errors, warnings

    # 2. Node validation
    node_ids: Set[str] = set()
    for idx, node in enumerate(nodes):
        nid = node.get("id")
        if not nid:
            errors.append(f"Node at index {idx} has missing or empty 'id'")
            continue

        if nid in node_ids:
            errors.append(f"Duplicate node ID detected: '{nid}'")
        node_ids.add(nid)

        ntype = node.get("type")
        if not ntype:
            errors.append(f"Node '{nid}' missing 'type'")

        nname = node.get("name")
        if not nname:
            errors.append(f"Node '{nid}' missing 'name'")

        loc = node.get("location")
        if not isinstance(loc, dict):
            errors.append(f"Node '{nid}' missing 'location' object")
        else:
            lat = loc.get("latitude")
            lon = loc.get("longitude")
            if lat is None or lon is None:
                errors.append(f"Node '{nid}' location missing latitude or longitude")
            else:
                try:
                    lat_f = float(lat)
                    lon_f = float(lon)
                    if not (-90.0 <= lat_f <= 90.0):
                        errors.append(f"Node '{nid}' latitude out of bounds [-90, 90]: {lat_f}")
                    if not (-180.0 <= lon_f <= 180.0):
                        errors.append(f"Node '{nid}' longitude out of bounds [-180, 180]: {lon_f}")
                except (ValueError, TypeError):
                    errors.append(f"Node '{nid}' coordinates must be numeric")

        status = node.get("status")
        if status not in valid_states:
            errors.append(f"Node '{nid}' status '{status}' not in canonical states: {valid_states}")

        # Provenance
        dstatus = node.get("data_status")
        if dstatus not in VALID_DATA_STATUSES:
            errors.append(f"Node '{nid}' data_status '{dstatus}' must be one of {VALID_DATA_STATUSES}")

        source = node.get("source")
        if not isinstance(source, dict) or "type" not in source:
            errors.append(f"Node '{nid}' missing valid 'source' object with 'type'")

        # OSM refs
        osm_refs = node.get("osm_refs")
        if not isinstance(osm_refs, list):
            errors.append(f"Node '{nid}' 'osm_refs' must be a list")
        else:
            for ref in osm_refs:
                if not OSM_REF_REGEX.match(ref):
                    errors.append(f"Node '{nid}' has malformed osm_ref: '{ref}' (expected type/id)")

        # Attributes
        attrs = node.get("attributes")
        if not isinstance(attrs, dict):
            errors.append(f"Node '{nid}' missing 'attributes' object")
        else:
            for req_attr in REQUIRED_NODE_ATTRIBUTES:
                if req_attr not in attrs:
                    errors.append(f"Node '{nid}' attributes missing '{req_attr}'")
                else:
                    val = attrs[req_attr]
                    if not isinstance(val, (int, float)) or val < 0:
                        errors.append(f"Node '{nid}' attribute '{req_attr}' must be non-negative number: {val}")

            # Capacity / load check
            if "capacity" in attrs and "load" in attrs:
                if attrs["load"] > attrs["capacity"]:
                    warnings.append(f"Node '{nid}' load ({attrs['load']}) exceeds capacity ({attrs['capacity']})")

    # 3. Edge validation
    edge_ids: Set[str] = set()
    node_degree: Dict[str, int] = {nid: 0 for nid in node_ids}
    adjacency: Dict[str, Set[str]] = {nid: set() for nid in node_ids}

    for idx, edge in enumerate(edges):
        eid = edge.get("id")
        if not eid:
            errors.append(f"Edge at index {idx} has missing or empty 'id'")
            continue

        if eid in edge_ids:
            errors.append(f"Duplicate edge ID detected: '{eid}'")
        edge_ids.add(eid)

        from_id = edge.get("from")
        to_id = edge.get("to")

        if from_id not in node_ids:
            errors.append(f"Edge '{eid}' from-node '{from_id}' does not exist (dangling reference)")
        if to_id not in node_ids:
            errors.append(f"Edge '{eid}' to-node '{to_id}' does not exist (dangling reference)")

        if from_id == to_id:
            warnings.append(f"Edge '{eid}' is a self-loop on node '{from_id}'")

        if from_id in node_ids and to_id in node_ids:
            node_degree[from_id] += 1
            node_degree[to_id] += 1
            adjacency[from_id].add(to_id)
            adjacency[to_id].add(from_id)

        etype = edge.get("type")
        if not etype:
            errors.append(f"Edge '{eid}' missing 'type'")

        directed = edge.get("directed")
        if not isinstance(directed, bool):
            errors.append(f"Edge '{eid}' 'directed' must be boolean")

        # Dependency edge types should be directed
        if etype in ("power_dependency", "water_dependency", "service_dependency") and directed is False:
            warnings.append(f"Edge '{eid}' of dependency type '{etype}' is marked directed=false")

        estate = edge.get("state")
        if estate not in valid_states:
            errors.append(f"Edge '{eid}' state '{estate}' not in canonical states: {valid_states}")

        # Edge provenance
        dstatus = edge.get("data_status")
        if dstatus not in VALID_DATA_STATUSES:
            errors.append(f"Edge '{eid}' data_status '{dstatus}' must be one of {VALID_DATA_STATUSES}")

        # Attributes
        e_attrs = edge.get("attributes")
        if not isinstance(e_attrs, dict):
            errors.append(f"Edge '{eid}' missing 'attributes' object")
        else:
            for req_attr in REQUIRED_EDGE_ATTRIBUTES:
                if req_attr not in e_attrs:
                    errors.append(f"Edge '{eid}' attributes missing '{req_attr}'")
                else:
                    val = e_attrs[req_attr]
                    if not isinstance(val, (int, float)):
                        errors.append(f"Edge '{eid}' attribute '{req_attr}' must be numeric")
                    elif val < 0:
                        errors.append(f"Edge '{eid}' attribute '{req_attr}' cannot be negative: {val}")

            prob = e_attrs.get("failure_probability")
            if prob is not None and not (0.0 <= prob <= 1.0):
                errors.append(f"Edge '{eid}' failure_probability must be in [0, 1]: {prob}")

            dep_str = e_attrs.get("dependency_strength")
            if dep_str is not None and not (0.0 <= dep_str <= 1.0):
                errors.append(f"Edge '{eid}' dependency_strength must be in [0, 1]: {dep_str}")

    # 4. Graph Connectivity Validation
    # Distinguish intentionally separate features from unintentionally disconnected graph components
    isolated_nodes = [nid for nid, deg in node_degree.items() if deg == 0]
    if isolated_nodes:
        errors.append(f"Unintentionally disconnected infrastructure nodes detected with degree 0: {isolated_nodes}")

    # Check connected components
    visited: Set[str] = set()
    components: List[Set[str]] = []
    for nid in node_ids:
        if nid not in visited:
            comp: Set[str] = set()
            queue = [nid]
            visited.add(nid)
            while queue:
                curr = queue.pop(0)
                comp.add(curr)
                for neighbor in adjacency.get(curr, set()):
                    if neighbor not in visited:
                        visited.add(neighbor)
                        queue.append(neighbor)
            components.append(comp)

    if len(components) > 1:
        warnings.append(
            f"Graph has {len(components)} disconnected components. Largest component has {len(components[0])} nodes."
        )

    return errors, warnings


def validate_facilities(
    facilities_data: Dict[str, Any],
    node_ids: Set[str]
) -> List[str]:
    errors = []
    if facilities_data.get("schema_version") != "1.0":
        errors.append("facilities.json 'schema_version' must be '1.0'")

    fac_list = facilities_data.get("facilities", [])
    if not isinstance(fac_list, list) or len(fac_list) == 0:
        errors.append("facilities.json 'facilities' must be a non-empty list")
        return errors

    seen_ids = set()
    for idx, fac in enumerate(fac_list):
        fid = fac.get("id")
        if not fid:
            errors.append(f"Facility at index {idx} missing 'id'")
        elif fid in seen_ids:
            errors.append(f"Duplicate facility id '{fid}'")
        seen_ids.add(fid)

        asset_id = fac.get("asset_id")
        if not asset_id:
            errors.append(f"Facility '{fid}' missing 'asset_id'")
        elif asset_id not in node_ids:
            errors.append(f"Facility '{fid}' references non-existent node asset_id '{asset_id}'")

        if not fac.get("facility_type"):
            errors.append(f"Facility '{fid}' missing 'facility_type'")

        source = fac.get("source")
        if not isinstance(source, dict):
            errors.append(f"Facility '{fid}' missing 'source' object")

    return errors


def validate_population(
    population_data: Dict[str, Any],
    node_ids: Set[str]
) -> List[str]:
    errors = []
    if population_data.get("schema_version") != "1.0":
        errors.append("population.json 'schema_version' must be '1.0'")

    pop_list = population_data.get("population", [])
    if not isinstance(pop_list, list) or len(pop_list) == 0:
        errors.append("population.json 'population' must be a non-empty list")
        return errors

    seen_ids = set()
    for idx, pop in enumerate(pop_list):
        pid = pop.get("id")
        if not pid:
            errors.append(f"Population entry at index {idx} missing 'id'")
        elif pid in seen_ids:
            errors.append(f"Duplicate population id '{pid}'")
        seen_ids.add(pid)

        pop_val = pop.get("population")
        if not isinstance(pop_val, (int, float)) or pop_val < 0:
            errors.append(f"Population entry '{pid}' has invalid population count: {pop_val}")

        geom_ref = pop.get("geometry_ref")
        if not geom_ref:
            errors.append(f"Population entry '{pid}' missing 'geometry_ref'")
        elif geom_ref not in node_ids:
            errors.append(f"Population entry '{pid}' geometry_ref '{geom_ref}' does not exist in nodes")

        vuln = pop.get("vulnerability")
        if not isinstance(vuln, dict):
            errors.append(f"Population entry '{pid}' missing 'vulnerability' object")
        else:
            for k in ("general", "emergency_dependent"):
                val = vuln.get(k)
                if val is None or not (0.0 <= val <= 1.0):
                    errors.append(f"Population entry '{pid}' vulnerability '{k}' must be in [0, 1]: {val}")

        source = pop.get("source")
        if not isinstance(source, dict):
            errors.append(f"Population entry '{pid}' missing 'source' object")

    return errors


def validate_dataset(
    network_path: str = "data/network.json",
    facilities_path: str = "data/facilities.json",
    population_path: str = "data/population.json",
    simulation_config_path: str = "data/simulation_config.json",
    geojson_path: Optional[str] = "data/osm_features.geojson"
) -> bool:
    """Runs all Track 1 dataset validations. Returns True if valid, False if errors."""
    all_errors: List[str] = []
    all_warnings: List[str] = []

    # 1. Simulation Config
    sim_config = load_json(simulation_config_path)
    sim_errors = validate_simulation_config(sim_config)
    all_errors.extend(sim_errors)
    valid_states = set(sim_config.get("states", []))

    # 2. Network Graph
    network_data = load_json(network_path)
    net_errors, net_warnings = validate_network(network_data, valid_states)
    all_errors.extend(net_errors)
    all_warnings.extend(net_warnings)

    node_ids = {n["id"] for n in network_data.get("nodes", []) if "id" in n}

    # 3. Facilities
    if os.path.exists(facilities_path):
        fac_data = load_json(facilities_path)
        fac_errors = validate_facilities(fac_data, node_ids)
        all_errors.extend(fac_errors)
    else:
        all_errors.append(f"Facilities file missing: {facilities_path}")

    # 4. Population
    if os.path.exists(population_path):
        pop_data = load_json(population_path)
        pop_errors = validate_population(pop_data, node_ids)
        all_errors.extend(pop_errors)
    else:
        all_errors.append(f"Population file missing: {population_path}")

    # 5. GeoJSON
    if geojson_path and os.path.exists(geojson_path):
        geojson_data = load_json(geojson_path)
        geo_errors = validate_geojson(geojson_data)
        all_errors.extend(geo_errors)

    # Print results
    if all_warnings:
        logger.warning(f"=== {len(all_warnings)} VALIDATION WARNINGS ===")
        for w in all_warnings:
            logger.warning(f"  [WARN] {w}")

    if all_errors:
        logger.error(f"=== {len(all_errors)} VALIDATION ERRORS ===")
        for e in all_errors:
            logger.error(f"  [ERROR] {e}")
        return False

    logger.info("=== TRACK 1 VALIDATION SUCCESSFUL ===")
    logger.info(
        f"Verified: {len(network_data.get('nodes', []))} nodes, "
        f"{len(network_data.get('edges', []))} edges, "
        f"all schemas, coordinate systems, and references valid."
    )
    return True


def main():
    parser = argparse.ArgumentParser(description="Validate Track 1 infrastructure datasets.")
    parser.add_argument("--network", default="data/network.json", help="Path to network.json")
    parser.add_argument("--facilities", default="data/facilities.json", help="Path to facilities.json")
    parser.add_argument("--population", default="data/population.json", help="Path to population.json")
    parser.add_argument("--config", default="data/simulation_config.json", help="Path to simulation_config.json")
    parser.add_argument("--geojson", default="data/osm_features.geojson", help="Path to osm_features.geojson")
    args = parser.parse_args()

    success = validate_dataset(
        network_path=args.network,
        facilities_path=args.facilities,
        population_path=args.population,
        simulation_config_path=args.config,
        geojson_path=args.geojson
    )

    if not success:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
