#!/usr/bin/env python3
"""
scripts/build_network.py

Assembles normalized nodes.json, edges.json, canonical network.json,
facilities.json, and source_manifest.json from OSM GeoJSON and configuration.

Completely data-driven: no domain facts or infrastructure IDs hardcoded in Python.
"""

import argparse
import json
import logging
import os
import random
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("build_network")


def load_json(path: str) -> Dict[str, Any]:
    if not os.path.exists(path):
        raise FileNotFoundError(f"File not found: {path}")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(data: Any, path: str) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    logger.info(f"Saved: {path}")


def extract_coordinates(geometry: Dict[str, Any]) -> List[Tuple[float, float]]:
    """Extracts all [lon, lat] pairs from any GeoJSON geometry."""
    gtype = geometry.get("type")
    coords = geometry.get("coordinates", [])

    points: List[Tuple[float, float]] = []
    if gtype == "Point":
        points.append((coords[0], coords[1]))
    elif gtype in ("LineString", "MultiPoint"):
        for pt in coords:
            points.append((pt[0], pt[1]))
    elif gtype in ("Polygon", "MultiLineString"):
        for ring in coords:
            for pt in ring:
                points.append((pt[0], pt[1]))
    elif gtype == "MultiPolygon":
        for poly in coords:
            for ring in poly:
                for pt in ring:
                    points.append((pt[0], pt[1]))
    return points


def compute_centroid(coords: List[Tuple[float, float]]) -> Tuple[float, float]:
    """Computes (latitude, longitude) centroid in decimal degrees from [lon, lat] coords."""
    if not coords:
        return (0.0, 0.0)
    avg_lon = sum(c[0] for c in coords) / len(coords)
    avg_lat = sum(c[1] for c in coords) / len(coords)
    return (round(avg_lat, 6), round(avg_lon, 6))


def generate_node_attributes(
    node_type: str,
    profiles: Dict[str, Any],
    rng: random.Random
) -> Dict[str, Any]:
    """Generates deterministic simulated operational attributes based on type profiles."""
    profile = profiles.get(node_type, {})
    cap_range = profile.get("capacity_range", [100, 200])
    load_range = profile.get("load_range", [50, 100])
    pop_range = profile.get("population_served_range", [1000, 5000])
    backup_range = profile.get("backup_duration_hours_range", [2.0, 8.0])
    fail_range = profile.get("failure_threshold_range", [80, 95])
    rec_range = profile.get("recovery_time_hours_range", [2.0, 6.0])

    capacity = rng.randint(cap_range[0], cap_range[1])
    # Load cannot exceed capacity
    max_load = min(load_range[1], capacity)
    min_load = min(load_range[0], max_load)
    load = rng.randint(min_load, max_load)

    population_served = rng.randint(pop_range[0], pop_range[1])
    backup_duration_hours = round(rng.uniform(backup_range[0], backup_range[1]), 1)
    failure_threshold = rng.randint(fail_range[0], fail_range[1])
    recovery_time_hours = round(rng.uniform(rec_range[0], rec_range[1]), 1)

    return {
        "capacity": capacity,
        "load": load,
        "population_served": population_served,
        "backup_duration_hours": backup_duration_hours,
        "failure_threshold": failure_threshold,
        "recovery_time_hours": recovery_time_hours
    }


def generate_edge_attributes(
    edge_type: str,
    defaults: Dict[str, Any],
    rng: random.Random
) -> Dict[str, Any]:
    """Generates deterministic simulated operational attributes for an edge."""
    cfg = defaults.get(edge_type, {})
    cap_range = cfg.get("capacity_range", [100, 500])
    load_ratio_range = cfg.get("load_ratio_range", [0.5, 0.8])
    dep_range = cfg.get("dependency_strength_range", [0.7, 1.0])
    fail_range = cfg.get("failure_probability_range", [0.01, 0.05])

    capacity = rng.randint(cap_range[0], cap_range[1])
    load_ratio = rng.uniform(load_ratio_range[0], load_ratio_range[1])
    load = int(round(capacity * load_ratio))
    dependency_strength = round(rng.uniform(dep_range[0], dep_range[1]), 2)
    failure_probability = round(rng.uniform(fail_range[0], fail_range[1]), 3)

    return {
        "capacity": capacity,
        "load": load,
        "dependency_strength": dependency_strength,
        "failure_probability": failure_probability
    }


def assemble_network(
    config_path: str,
    geojson_path: str,
    output_dir: str
) -> Dict[str, Any]:
    """Assembles all Track 1 graph datasets."""
    config = load_json(config_path)
    geojson = load_json(geojson_path)

    seed = config.get("random_seed", 42)
    rng = random.Random(seed)

    # Index GeoJSON features by OSM ID (e.g. "way/353139106")
    feature_index: Dict[str, Dict[str, Any]] = {}
    for feat in geojson.get("features", []):
        fid = feat.get("id") or feat.get("properties", {}).get("osm_id")
        if fid:
            feature_index[fid] = feat

    node_profiles = config.get("node_type_profiles", {})
    edge_defaults = config.get("edge_type_defaults", {})
    configured_nodes = config.get("infrastructure_nodes", [])
    configured_edges = config.get("topology_edges", [])

    nodes: List[Dict[str, Any]] = []
    node_id_set = set()

    for nspec in configured_nodes:
        nid = nspec["id"]
        ntype = nspec["type"]
        nname = nspec["name"]
        osm_ref = nspec.get("osm_ref")
        data_status = nspec.get("data_status", "SIMULATED")

        osm_refs: List[str] = []
        source: Dict[str, Any] = {}
        location: Dict[str, float] = {}

        if osm_ref and osm_ref in feature_index:
            feat = feature_index[osm_ref]
            coords = extract_coordinates(feat.get("geometry", {}))
            lat, lon = compute_centroid(coords)
            location = {"latitude": lat, "longitude": lon}
            osm_refs = [osm_ref]
            source = {
                "type": "osm",
                "provider": "OpenStreetMap",
                "reference": osm_ref,
                "retrieved_at": feat.get("properties", {}).get("retrieved_at", datetime.now(timezone.utc).isoformat())
            }
        else:
            if osm_ref:
                logger.warning(f"OSM reference '{osm_ref}' for node '{nid}' not found in GeoJSON. Using configured coordinates.")
            loc = nspec.get("location", {})
            location = {
                "latitude": float(loc.get("latitude", 0.0)),
                "longitude": float(loc.get("longitude", 0.0))
            }
            osm_refs = []
            source = {
                "type": "simulated" if data_status == "SIMULATED" else "derived",
                "basis": nspec.get("source_basis", "Configured area infrastructure specification")
            }

        attributes = generate_node_attributes(ntype, node_profiles, rng)

        node_obj = {
            "id": nid,
            "type": ntype,
            "name": nname,
            "osm_refs": osm_refs,
            "location": location,
            "attributes": attributes,
            "status": "OPERATIONAL",
            "source": source,
            "data_status": data_status
        }
        nodes.append(node_obj)
        node_id_set.add(nid)

    # Validate and assemble edges
    edges: List[Dict[str, Any]] = []
    edge_id_set = set()

    for espec in configured_edges:
        eid = espec["id"]
        from_id = espec["from"]
        to_id = espec["to"]
        etype = espec["type"]

        if from_id not in node_id_set:
            raise ValueError(f"Edge '{eid}' references non-existent 'from' node '{from_id}'")
        if to_id not in node_id_set:
            raise ValueError(f"Edge '{eid}' references non-existent 'to' node '{to_id}'")

        edef = edge_defaults.get(etype, {})
        directed = espec.get("directed", edef.get("directed", True))
        attributes = generate_edge_attributes(etype, edge_defaults, rng)

        is_simulated = etype in ("power_dependency", "water_dependency", "service_dependency")
        edge_obj = {
            "id": eid,
            "from": from_id,
            "to": to_id,
            "type": etype,
            "directed": directed,
            "attributes": attributes,
            "state": "OPERATIONAL",
            "source": {
                "type": "simulated" if is_simulated else "derived",
                "basis": "Physical adjacency and municipal infrastructure dependency model"
            },
            "data_status": "SIMULATED" if is_simulated else "DERIVED"
        }
        edges.append(edge_obj)
        edge_id_set.add(eid)

    # Canonical network.json
    network = {
        "schema_version": "1.0",
        "network_id": config.get("study_area", {}).get("name", "powai_hiranandani").lower().replace("-", "_"),
        "name": f"{config.get('study_area', {}).get('name', 'Powai-Hiranandani')} Infrastructure Network",
        "coordinate_reference_system": "EPSG:4326",
        "nodes": nodes,
        "edges": edges
    }

    # Normalized nodes.json and edges.json
    nodes_payload = {
        "schema_version": "1.0",
        "nodes": nodes
    }
    edges_payload = {
        "schema_version": "1.0",
        "edges": edges
    }

    # Canonical facilities.json
    facility_types = {"hospital", "school", "water_facility", "substation", "power_station"}
    facilities = []
    fac_counter = 1
    for node in nodes:
        if node["type"] in facility_types:
            fac_id = f"facility_{fac_counter:02d}_{node['id']}"
            facilities.append({
                "id": fac_id,
                "asset_id": node["id"],
                "facility_type": node["type"],
                "source": node["source"]
            })
            fac_counter += 1

    facilities_payload = {
        "schema_version": "1.0",
        "facilities": facilities
    }

    # Source manifest auditing provenance
    real_nodes = sum(1 for n in nodes if n["data_status"] == "REAL")
    simulated_nodes = sum(1 for n in nodes if n["data_status"] == "SIMULATED")
    derived_nodes = sum(1 for n in nodes if n["data_status"] == "DERIVED")

    real_edges = sum(1 for e in edges if e["data_status"] == "REAL")
    simulated_edges = sum(1 for e in edges if e["data_status"] == "SIMULATED")
    derived_edges = sum(1 for e in edges if e["data_status"] == "DERIVED")

    manifest = {
        "schema_version": "1.0",
        "preprocessing_version": "1.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "study_area": config.get("study_area", {}),
        "datasets": [
            {
                "name": "OpenStreetMap",
                "provider": "OpenStreetMap Contributors",
                "retrieval_method": "OSM API 0.6 /map endpoint query",
                "endpoint": config.get("osm_source", {}).get("primary_endpoint"),
                "license": "ODbL (Open Database License)",
                "data_types": ["roads", "bridges", "water_bodies", "hospitals", "schools", "substations"]
            },
            {
                "name": "MCGM & Census of India Ward S Demographics",
                "provider": "Municipal Corporation of Greater Mumbai / Census 2011 & Ward Projections",
                "data_types": ["residential_zone_population", "vulnerability_index"]
            },
            {
                "name": "Engineered Infrastructure Dependency Model",
                "provider": "Powai-Hiranandani Cascading Failure Prototype",
                "data_types": ["power_dependencies", "water_dependencies", "operational_attributes"]
            }
        ],
        "provenance_summary": {
            "nodes": {
                "total": len(nodes),
                "REAL": real_nodes,
                "SIMULATED": simulated_nodes,
                "DERIVED": derived_nodes
            },
            "edges": {
                "total": len(edges),
                "REAL": real_edges,
                "SIMULATED": simulated_edges,
                "DERIVED": derived_edges
            },
            "osm_features_extracted": len(geojson.get("features", []))
        },
        "operational_parameters_policy": {
            "status": "All numerical operational parameters (capacity, load, backup_duration_hours, recovery_time_hours, failure_threshold) are SIMULATED based on engineering standards and deterministic seeds. They MUST NOT be treated as live sensor measurements."
        }
    }

    # Write files
    save_json(nodes_payload, os.path.join(output_dir, "nodes.json"))
    save_json(edges_payload, os.path.join(output_dir, "edges.json"))
    save_json(network, os.path.join(output_dir, "network.json"))
    save_json(facilities_payload, os.path.join(output_dir, "facilities.json"))
    save_json(manifest, os.path.join(output_dir, "source_manifest.json"))

    logger.info(f"Assembled network with {len(nodes)} nodes and {len(edges)} edges.")
    return network


def main():
    parser = argparse.ArgumentParser(description="Assemble Track 1 infrastructure network.")
    parser.add_argument("--config", default="data/area_config.json", help="Path to area configuration.")
    parser.add_argument("--geojson", default="data/osm_features.geojson", help="Path to OSM GeoJSON.")
    parser.add_argument("--output-dir", default="data", help="Output directory for generated JSON files.")
    args = parser.parse_args()

    assemble_network(
        config_path=args.config,
        geojson_path=args.geojson,
        output_dir=args.output_dir
    )


if __name__ == "__main__":
    main()
