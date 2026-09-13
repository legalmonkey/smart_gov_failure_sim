"""
tests/test_track1.py

Unit and integration tests for Track 1: Geographic Data & Infrastructure Graph.
Verifies all 15 required acceptance test items plus negative tests and boundary assertions.
"""

import copy
import json
import os
import re
import sys
import tempfile
from typing import Any, Dict

import pytest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from scripts.build_network import assemble_network
from scripts.validate_data import (
    REQUIRED_EDGE_ATTRIBUTES,
    REQUIRED_NODE_ATTRIBUTES,
    VALID_DATA_STATUSES,
    validate_dataset,
    validate_facilities,
    validate_geojson,
    validate_network,
    validate_population,
    validate_simulation_config,
)
DATA_DIR = os.path.join(BASE_DIR, "data")
FIXTURES_DIR = os.path.join(BASE_DIR, "tests", "fixtures")


def load_json_file(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def production_network():
    return load_json_file(os.path.join(DATA_DIR, "network.json"))


@pytest.fixture(scope="module")
def production_geojson():
    return load_json_file(os.path.join(DATA_DIR, "osm_features.geojson"))


@pytest.fixture(scope="module")
def production_facilities():
    return load_json_file(os.path.join(DATA_DIR, "facilities.json"))


@pytest.fixture(scope="module")
def production_population():
    return load_json_file(os.path.join(DATA_DIR, "population.json"))


@pytest.fixture(scope="module")
def simulation_config():
    return load_json_file(os.path.join(DATA_DIR, "simulation_config.json"))


@pytest.fixture(scope="module")
def mock_network():
    return load_json_file(os.path.join(FIXTURES_DIR, "mock-network.json"))


@pytest.fixture(scope="module")
def mock_geojson():
    return load_json_file(os.path.join(FIXTURES_DIR, "mock-osm.geojson"))


# 1. OSM GeoJSON is valid
def test_01_osm_geojson_is_valid(production_geojson):
    assert production_geojson.get("type") == "FeatureCollection"
    features = production_geojson.get("features", [])
    assert len(features) > 0
    errors = validate_geojson(production_geojson)
    assert len(errors) == 0, f"GeoJSON errors: {errors}"


# 2. All GeoJSON coordinates follow [longitude, latitude]
def test_02_geojson_coordinates_follow_lon_lat(production_geojson):
    # Mumbai bounding region approx: lon 72.8 to 73.0, lat 19.0 to 19.3
    # Check that coordinate[0] is longitude (~72.9) and coordinate[1] is latitude (~19.1)
    features = production_geojson.get("features", [])
    assert len(features) > 0

    checked_points = 0
    for feat in features:
        geom = feat.get("geometry", {})
        gtype = geom.get("type")
        coords = geom.get("coordinates", [])

        pts = []
        if gtype == "Point":
            pts.append(coords)
        elif gtype in ("LineString", "MultiPoint"):
            pts.extend(coords)
        elif gtype in ("Polygon", "MultiLineString"):
            for ring in coords:
                pts.extend(ring)
        elif gtype == "MultiPolygon":
            for poly in coords:
                for ring in poly:
                    pts.extend(ring)

        for pt in pts:
            lon, lat = pt[0], pt[1]
            assert -180.0 <= lon <= 180.0, f"Longitude {lon} out of global bounds"
            assert -90.0 <= lat <= 90.0, f"Latitude {lat} out of global bounds"
            # For Mumbai, longitude is ~72.8-73.1 and latitude is ~19.0-19.3.
            # If swapped ([lat, lon]), lon would be ~19 and lat would be ~72!
            assert lon > lat, f"Coordinates appear swapped ([lat, lon] instead of [lon, lat]): pt={pt}"
            assert 72.5 <= lon <= 73.3, f"Longitude {lon} outside Mumbai metropolitan region"
            assert 18.8 <= lat <= 19.5, f"Latitude {lat} outside Mumbai metropolitan region"
            checked_points += 1

    assert checked_points > 100


# 3. Node IDs are unique
def test_03_node_ids_are_unique(production_network, mock_network):
    for net in (production_network, mock_network):
        node_ids = [n["id"] for n in net.get("nodes", [])]
        assert len(node_ids) == len(set(node_ids)), "Duplicate node IDs detected!"


# 4. Edge IDs are unique
def test_04_edge_ids_are_unique(production_network, mock_network):
    for net in (production_network, mock_network):
        edge_ids = [e["id"] for e in net.get("edges", [])]
        assert len(edge_ids) == len(set(edge_ids)), "Duplicate edge IDs detected!"


# 5. All edge references resolve
def test_05_all_edge_references_resolve(production_network, mock_network):
    for net in (production_network, mock_network):
        node_ids = {n["id"] for n in net.get("nodes", [])}
        for edge in net.get("edges", []):
            assert edge["from"] in node_ids, f"Dangling edge from: {edge['from']}"
            assert edge["to"] in node_ids, f"Dangling edge to: {edge['to']}"


# 6. Required node fields exist
def test_06_required_node_fields_exist(production_network):
    nodes = production_network.get("nodes", [])
    assert len(nodes) > 0

    for node in nodes:
        assert "id" in node
        assert "type" in node
        assert "name" in node
        assert "location" in node
        assert "latitude" in node["location"]
        assert "longitude" in node["location"]
        assert "status" in node
        assert "attributes" in node
        assert "source" in node
        assert "data_status" in node

        attrs = node["attributes"]
        for req_attr in REQUIRED_NODE_ATTRIBUTES:
            assert req_attr in attrs, f"Node {node['id']} missing attribute: {req_attr}"
            assert attrs[req_attr] >= 0, f"Node {node['id']} attribute {req_attr} is negative"


# 7. Required edge fields exist
def test_07_required_edge_fields_exist(production_network):
    edges = production_network.get("edges", [])
    assert len(edges) > 0

    for edge in edges:
        assert "id" in edge
        assert "from" in edge
        assert "to" in edge
        assert "type" in edge
        assert "directed" in edge
        assert isinstance(edge["directed"], bool)
        assert "state" in edge
        assert "attributes" in edge

        attrs = edge["attributes"]
        for req_attr in REQUIRED_EDGE_ATTRIBUTES:
            assert req_attr in attrs, f"Edge {edge['id']} missing attribute: {req_attr}"

        assert 0.0 <= attrs["failure_probability"] <= 1.0
        assert 0.0 <= attrs["dependency_strength"] <= 1.0


# 8. Network assembly works
def test_08_network_assembly_works():
    with tempfile.TemporaryDirectory() as tmpdir:
        net = assemble_network(
            config_path=os.path.join(DATA_DIR, "area_config.json"),
            geojson_path=os.path.join(DATA_DIR, "osm_features.geojson"),
            output_dir=tmpdir
        )
        assert net["schema_version"] == "1.0"
        assert len(net["nodes"]) >= 30
        assert len(net["edges"]) >= 50
        assert os.path.exists(os.path.join(tmpdir, "nodes.json"))
        assert os.path.exists(os.path.join(tmpdir, "edges.json"))
        assert os.path.exists(os.path.join(tmpdir, "network.json"))
        assert os.path.exists(os.path.join(tmpdir, "facilities.json"))
        assert os.path.exists(os.path.join(tmpdir, "source_manifest.json"))


# 9. Facility references resolve
def test_09_facility_references_resolve(production_facilities, production_network):
    node_ids = {n["id"] for n in production_network.get("nodes", [])}
    facilities = production_facilities.get("facilities", [])
    assert len(facilities) > 0

    for fac in facilities:
        assert fac["asset_id"] in node_ids, f"Facility asset_id not in nodes: {fac['asset_id']}"


# 10. Population references resolve
def test_10_population_references_resolve(production_population, production_network):
    node_ids = {n["id"] for n in production_network.get("nodes", [])}
    pop_list = production_population.get("population", [])
    assert len(pop_list) > 0

    for pop in pop_list:
        assert pop["geometry_ref"] in node_ids, f"Population geometry_ref not in nodes: {pop['geometry_ref']}"
        assert pop["population"] > 0
        vuln = pop["vulnerability"]
        assert 0.0 <= vuln["general"] <= 1.0
        assert 0.0 <= vuln["emergency_dependent"] <= 1.0


# 11. Provenance fields exist
def test_11_provenance_fields_exist(production_network):
    for node in production_network.get("nodes", []):
        assert node["data_status"] in VALID_DATA_STATUSES
        assert "source" in node
        assert "type" in node["source"]
        if node["data_status"] == "REAL":
            assert node["source"]["type"] == "osm"
            assert len(node["osm_refs"]) > 0

    for edge in production_network.get("edges", []):
        assert edge["data_status"] in VALID_DATA_STATUSES
        assert "source" in edge
        assert "type" in edge["source"]


# 12. Invalid data is correctly rejected
def test_12_invalid_data_is_correctly_rejected(production_network, simulation_config):
    valid_states = set(simulation_config.get("states", []))

    # Dangling reference test
    broken_net = copy.deepcopy(production_network)
    broken_net["edges"].append({
        "id": "bad_edge_dangling",
        "from": "non_existent_node_xyz",
        "to": broken_net["nodes"][0]["id"],
        "type": "road_connection",
        "directed": False,
        "state": "OPERATIONAL",
        "attributes": {
            "capacity": 100,
            "load": 50,
            "dependency_strength": 0.8,
            "failure_probability": 0.02
        },
        "source": {"type": "derived"},
        "data_status": "DERIVED"
    })
    errors, _ = validate_network(broken_net, valid_states)
    assert any("dangling" in e.lower() for e in errors)

    # Invalid probability test
    broken_prob = copy.deepcopy(production_network)
    broken_prob["edges"][0]["attributes"]["failure_probability"] = 1.8
    errors, _ = validate_network(broken_prob, valid_states)
    assert any("failure_probability" in e.lower() for e in errors)

    # Missing schema_version test
    broken_schema = copy.deepcopy(production_network)
    broken_schema["schema_version"] = "99.9"
    errors, _ = validate_network(broken_schema, valid_states)
    assert any("schema_version" in e.lower() for e in errors)

    # Invalid coordinates test
    broken_coord = copy.deepcopy(production_network)
    broken_coord["nodes"][0]["location"]["latitude"] = 195.0
    errors, _ = validate_network(broken_coord, valid_states)
    assert any("latitude" in e.lower() for e in errors)


# 13. Mock network passes validation
def test_13_mock_network_passes_validation():
    success = validate_dataset(
        network_path=os.path.join(FIXTURES_DIR, "mock-network.json"),
        facilities_path=os.path.join(FIXTURES_DIR, "mock-facilities.json"),
        population_path=os.path.join(FIXTURES_DIR, "mock-population.json"),
        simulation_config_path=os.path.join(DATA_DIR, "simulation_config.json"),
        geojson_path=os.path.join(FIXTURES_DIR, "mock-osm.geojson")
    )
    assert success is True


# 14. Production network passes validation
def test_14_production_network_passes_validation():
    success = validate_dataset(
        network_path=os.path.join(DATA_DIR, "network.json"),
        facilities_path=os.path.join(DATA_DIR, "facilities.json"),
        population_path=os.path.join(DATA_DIR, "population.json"),
        simulation_config_path=os.path.join(DATA_DIR, "simulation_config.json"),
        geojson_path=os.path.join(DATA_DIR, "osm_features.geojson")
    )
    assert success is True


# 15. No dangling references exist
def test_15_no_dangling_references_exist(
    production_network,
    production_facilities,
    production_population
):
    node_ids = {n["id"] for n in production_network.get("nodes", [])}

    for edge in production_network.get("edges", []):
        assert edge["from"] in node_ids
        assert edge["to"] in node_ids

    for fac in production_facilities.get("facilities", []):
        assert fac["asset_id"] in node_ids

    for pop in production_population.get("population", []):
        assert pop["geometry_ref"] in node_ids


# 16. Target node and edge count bounds (30–100 nodes, 50–200 edges)
def test_16_target_node_and_edge_counts(production_network):
    node_count = len(production_network.get("nodes", []))
    edge_count = len(production_network.get("edges", []))
    assert 30 <= node_count <= 100, f"Node count {node_count} not in [30, 100]"
    assert 50 <= edge_count <= 200, f"Edge count {edge_count} not in [50, 200]"


# 17. No hardcoded domain facts in Python source scripts
def test_17_no_hardcoded_domain_facts_in_python_scripts():
    scripts_dir = os.path.join(BASE_DIR, "scripts")
    forbidden_terms = [
        "hospital_01",
        "substation_01",
        "node_hosp_hiranandani",
        "res_zone_hiranandani",
        "powai_lake",
        "12400",
        "road_17_is_ambulance_route"
    ]
    for fname in os.listdir(scripts_dir):
        if fname.endswith(".py"):
            fpath = os.path.join(scripts_dir, fname)
            with open(fpath, "r", encoding="utf-8") as f:
                content = f.read().lower()
                for term in forbidden_terms:
                    assert term.lower() not in content, (
                        f"Forbidden hardcoded domain fact '{term}' detected in script {fname}!"
                    )
