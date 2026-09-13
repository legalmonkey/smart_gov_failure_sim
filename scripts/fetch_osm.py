#!/usr/bin/env python3
"""
scripts/fetch_osm.py

Reproducible OpenStreetMap data extraction pipeline for Track 1.
Extracts geographic features for Powai Lake & Hiranandani study area.
Saves raw XML cache and generates canonical data/osm_features.geojson.
"""

import argparse
import json
import logging
import os
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("fetch_osm")


def load_config(config_path: str) -> Dict[str, Any]:
    if not os.path.exists(config_path):
        raise FileNotFoundError(f"Configuration file not found at: {config_path}")
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


def fetch_osm_xml(
    config: Dict[str, Any],
    cache_path: str,
    force_refresh: bool = False
) -> str:
    """Fetches OSM XML from primary API or cache."""
    if not force_refresh and os.path.exists(cache_path):
        logger.info(f"Loading cached OSM XML from: {cache_path}")
        with open(cache_path, "r", encoding="utf-8") as f:
            return f.read()

    study_area = config.get("study_area", {})
    bbox = study_area.get("bbox")
    if not bbox:
        raise ValueError("Configuration missing 'study_area.bbox' definition.")

    south = bbox["south"]
    west = bbox["west"]
    north = bbox["north"]
    east = bbox["east"]

    osm_source = config.get("osm_source", {})
    primary_url = osm_source.get("primary_endpoint", "https://api.openstreetmap.org/api/0.6/map")
    user_agent = osm_source.get("user_agent", "CascadingEffectSim-Track1/1.0")

    # Bounding box format for OSM 0.6 API: left,bottom,right,top (min_lon, min_lat, max_lon, max_lat)
    query_url = f"{primary_url}?bbox={west},{south},{east},{north}"
    headers = {"User-Agent": user_agent}

    logger.info(f"Querying OpenStreetMap API: {query_url}")
    try:
        response = requests.get(query_url, headers=headers, timeout=60)
        response.raise_for_status()
        xml_content = response.text
    except Exception as exc:
        logger.warning(f"Primary OSM endpoint failed: {exc}. Attempting cached data fallback...")
        if os.path.exists(cache_path):
            logger.info(f"Using fallback cache: {cache_path}")
            with open(cache_path, "r", encoding="utf-8") as f:
                return f.read()
        raise RuntimeError(f"Failed to fetch OSM data and no cache exists: {exc}") from exc

    os.makedirs(os.path.dirname(os.path.abspath(cache_path)), exist_ok=True)
    with open(cache_path, "w", encoding="utf-8") as f:
        f.write(xml_content)
    logger.info(f"Cached OSM XML to: {cache_path} ({len(xml_content)} bytes)")

    return xml_content


def classify_feature(tags: Dict[str, str]) -> Optional[str]:
    """Classifies an OSM element into a canonical infrastructure/geographic feature type."""
    amenity = tags.get("amenity", "").lower()
    highway = tags.get("highway", "").lower()
    power = tags.get("power", "").lower()
    natural = tags.get("natural", "").lower()
    water = tags.get("water", "").lower()
    bridge = tags.get("bridge", "").lower()
    name = tags.get("name", "").lower()

    if bridge not in ("", "no", "false"):
        return "bridge"

    if amenity in ("hospital", "clinic"):
        return "hospital"

    if amenity in ("school", "college", "university", "kindergarten"):
        return "school"

    if amenity in ("police", "fire_station"):
        return "emergency_service"

    if power in ("substation", "generator", "plant", "transformer"):
        return "power_infrastructure"

    if natural == "water" or water != "" or "lake" in name or "dam" in name:
        if "dam" in name or tags.get("waterway") == "dam":
            return "water_dam"
        return "water_body"

    if highway in (
        "primary", "secondary", "tertiary", "trunk",
        "primary_link", "secondary_link", "tertiary_link",
        "residential", "living_street", "service", "unclassified"
    ):
        return "road"

    if tags.get("building") in ("residential", "apartments") or "gardens" in name or "complex" in name:
        return "residential"

    return None


def calculate_centroid(coords: List[Tuple[float, float]]) -> Tuple[float, float]:
    """Calculates [lon, lat] centroid of coordinate points."""
    if not coords:
        return (0.0, 0.0)
    avg_lon = sum(c[0] for c in coords) / len(coords)
    avg_lat = sum(c[1] for c in coords) / len(coords)
    return (round(avg_lon, 6), round(avg_lat, 6))


def parse_osm_to_geojson(
    xml_content: str,
    retrieved_at: Optional[str] = None
) -> Dict[str, Any]:
    """Parses raw OSM XML and outputs a valid GeoJSON FeatureCollection."""
    if retrieved_at is None:
        retrieved_at = datetime.now(timezone.utc).isoformat()

    root = ET.fromstring(xml_content)

    # 1. Parse all nodes for coordinate lookups
    node_coords: Dict[str, Tuple[float, float]] = {}
    node_tags: Dict[str, Dict[str, str]] = {}
    for node in root.findall("node"):
        nid = node.get("id")
        if not nid:
            continue
        lon = float(node.get("lon", 0.0))
        lat = float(node.get("lat", 0.0))
        node_coords[nid] = (lon, lat)

        tags = {t.get("k", ""): t.get("v", "") for t in node.findall("tag")}
        if tags:
            node_tags[nid] = tags

    features: List[Dict[str, Any]] = []

    # 2. Process tagged nodes
    for nid, tags in node_tags.items():
        feature_type = classify_feature(tags)
        if feature_type:
            lon, lat = node_coords[nid]
            features.append({
                "type": "Feature",
                "id": f"node/{nid}",
                "geometry": {
                    "type": "Point",
                    "coordinates": [lon, lat]  # [longitude, latitude]
                },
                "properties": {
                    "osm_id": f"node/{nid}",
                    "osm_type": "node",
                    "feature_type": feature_type,
                    "name": tags.get("name", f"Unnamed {feature_type}"),
                    "source": "OpenStreetMap",
                    "provider": "OpenStreetMap",
                    "retrieved_at": retrieved_at,
                    "tags": tags
                }
            })

    # 3. Process ways
    way_nodes_map: Dict[str, List[Tuple[float, float]]] = {}
    for way in root.findall("way"):
        wid = way.get("id")
        if not wid:
            continue

        tags = {t.get("k", ""): t.get("v", "") for t in way.findall("tag")}
        nds = [nd.get("ref") for nd in way.findall("nd") if nd.get("ref")]
        coords = [node_coords[ref] for ref in nds if ref in node_coords]

        if not coords:
            continue

        way_nodes_map[wid] = coords
        feature_type = classify_feature(tags)

        if feature_type:
            is_closed = len(coords) >= 4 and coords[0] == coords[-1]
            geom_type = "Polygon" if (is_closed and feature_type in ("water_body", "residential", "hospital", "school", "power_infrastructure")) else "LineString"

            geom_coords = [coords] if geom_type == "Polygon" else coords

            features.append({
                "type": "Feature",
                "id": f"way/{wid}",
                "geometry": {
                    "type": geom_type,
                    "coordinates": geom_coords
                },
                "properties": {
                    "osm_id": f"way/{wid}",
                    "osm_type": "way",
                    "feature_type": feature_type,
                    "name": tags.get("name", f"Unnamed {feature_type}"),
                    "source": "OpenStreetMap",
                    "provider": "OpenStreetMap",
                    "retrieved_at": retrieved_at,
                    "tags": tags
                }
            })

    # 4. Process relations (e.g. Powai Lake)
    for rel in root.findall("relation"):
        rid = rel.get("id")
        if not rid:
            continue

        tags = {t.get("k", ""): t.get("v", "") for t in rel.findall("tag")}
        feature_type = classify_feature(tags)

        if feature_type:
            # Collect member way coordinates
            member_coords: List[List[Tuple[float, float]]] = []
            for member in rel.findall("member"):
                if member.get("type") == "way":
                    m_ref = member.get("ref")
                    if m_ref and m_ref in way_nodes_map:
                        member_coords.append(way_nodes_map[m_ref])

            if member_coords:
                all_pts = [pt for way_pts in member_coords for pt in way_pts]
                centroid = calculate_centroid(all_pts)
                features.append({
                    "type": "Feature",
                    "id": f"relation/{rid}",
                    "geometry": {
                        "type": "MultiLineString",
                        "coordinates": member_coords
                    },
                    "properties": {
                        "osm_id": f"relation/{rid}",
                        "osm_type": "relation",
                        "feature_type": feature_type,
                        "name": tags.get("name", f"Unnamed {feature_type}"),
                        "centroid": list(centroid),
                        "source": "OpenStreetMap",
                        "provider": "OpenStreetMap",
                        "retrieved_at": retrieved_at,
                        "tags": tags
                    }
                })

    geojson: Dict[str, Any] = {
        "type": "FeatureCollection",
        "crs": {
            "type": "name",
            "properties": {
                "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
            }
        },
        "features": features
    }

    return geojson


def main():
    parser = argparse.ArgumentParser(description="Fetch OSM data and produce GeoJSON.")
    parser.add_argument("--config", default="data/area_config.json", help="Path to area configuration.")
    parser.add_argument("--output", default="data/osm_features.geojson", help="Output GeoJSON path.")
    parser.add_argument("--cache", default="data/raw_osm.xml", help="OSM XML cache path.")
    parser.add_argument("--force-refresh", action="store_true", help="Force refresh from OSM API.")
    args = parser.parse_args()

    config = load_config(args.config)
    xml_content = fetch_osm_xml(config, cache_path=args.cache, force_refresh=args.force_refresh)

    geojson = parse_osm_to_geojson(xml_content)
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(geojson, f, indent=2)

    logger.info(f"Successfully generated {args.output} with {len(geojson['features'])} features.")


if __name__ == "__main__":
    main()
