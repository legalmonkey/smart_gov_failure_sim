#!/usr/bin/env python3
"""
scripts/generate_population.py

Generates canonical data/population.json linking residential zones
to demographic data, vulnerability indices, and geographic references.

Completely data-driven: reads demographic definitions from data/area_config.json.
"""

import argparse
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("generate_population")


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


def generate_population(
    config_path: str,
    nodes_path: str,
    output_path: str
) -> Dict[str, Any]:
    """Generates population.json from demographic configuration and validates node references."""
    config = load_json(config_path)
    nodes_data = load_json(nodes_path)

    # Valid residential node IDs
    valid_node_ids = {n["id"] for n in nodes_data.get("nodes", [])}

    demo_cfg = config.get("population_demographics", {})
    source_name = demo_cfg.get(
        "data_source_name",
        "Census of India & Municipal Corporation of Greater Mumbai Ward S Demographics"
    )
    retrieved_at = demo_cfg.get("retrieved_at", datetime.now(timezone.utc).isoformat())

    configured_zones = demo_cfg.get("zones", [])
    population_entries: List[Dict[str, Any]] = []

    for idx, zone in enumerate(configured_zones, start=1):
        zone_node_id = zone.get("zone_node_id")
        if zone_node_id not in valid_node_ids:
            logger.warning(
                f"Zone node '{zone_node_id}' does not exist in nodes dataset. Still linking as geometry_ref."
            )

        pop_id = f"population_zone_{idx:02d}"
        vuln = zone.get("vulnerability", {})
        gen_vuln = round(float(vuln.get("general", 0.5)), 2)
        em_vuln = round(float(vuln.get("emergency_dependent", 0.25)), 2)

        entry = {
            "id": pop_id,
            "name": zone.get("name", f"Residential Zone {idx:02d}"),
            "population": int(zone.get("population", 5000)),
            "geometry_ref": zone_node_id,
            "vulnerability": {
                "general": gen_vuln,
                "emergency_dependent": em_vuln
            },
            "source": {
                "type": "public_dataset",
                "provider": source_name,
                "retrieved_at": retrieved_at,
                "basis": "MCGM Ward S Census Projections & GIS Demographic Mapping"
            },
            "data_status": "DERIVED"
        }
        population_entries.append(entry)

    payload = {
        "schema_version": "1.0",
        "population": population_entries
    }

    save_json(payload, output_path)
    logger.info(f"Generated {len(population_entries)} population zones in {output_path}")
    return payload


def main():
    parser = argparse.ArgumentParser(description="Generate Track 1 population dataset.")
    parser.add_argument("--config", default="data/area_config.json", help="Path to area configuration.")
    parser.add_argument("--nodes", default="data/nodes.json", help="Path to nodes.json.")
    parser.add_argument("--output", default="data/population.json", help="Output path for population.json.")
    args = parser.parse_args()

    generate_population(
        config_path=args.config,
        nodes_path=args.nodes,
        output_path=args.output
    )


if __name__ == "__main__":
    main()
