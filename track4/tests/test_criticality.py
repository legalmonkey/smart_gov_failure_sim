import pytest
from impact.models import NetworkGraph, NetworkNode, NetworkEdge, SimulationState, AssetStateInfo
from impact.impact_engine import ImpactEngine
from track4.criticality.node_criticality import calculate_node_criticality
from track4.criticality.edge_criticality import calculate_edge_criticality
from track4.engine import Track4Engine


@pytest.fixture
def sample_network():
    nodes = [
        NetworkNode(id="sub_01", name="Powai Substation", type="power_substation", lat=19.12, lon=72.91, population_served=60000, capacity=350),
        NetworkNode(id="water_01", name="Pumping Station", type="water_pump", lat=19.122, lon=72.905, population_served=75000, capacity=450, backup_duration=3.0),
        NetworkNode(id="hosp_01", name="Hiranandani Hospital", type="hospital", lat=19.12, lon=72.915, population_served=25000, capacity=150, backup_duration=6.0),
        NetworkNode(id="pop_01", name="Residential Area", type="population", lat=19.119, lon=72.912, population_served=45000, capacity=60000),
    ]
    edges = [
        NetworkEdge(id="e_sub_water", from_node="sub_01", to_node="water_01", type="power"),
        NetworkEdge(id="e_sub_hosp", from_node="sub_01", to_node="hosp_01", type="power"),
        NetworkEdge(id="e_water_pop", from_node="water_01", to_node="pop_01", type="water"),
    ]
    return NetworkGraph(nodes=nodes, edges=edges)


def test_node_criticality_ranking(sample_network):
    engine = Track4Engine()
    crits = engine.calculate_criticality(sample_network)

    assert len(crits.nodes) == len(sample_network.nodes)
    # The substation feeds both hospital and water pump; it must have highest criticality score
    assert crits.nodes[0].asset_id == "sub_01"
    assert crits.nodes[0].criticality_score >= crits.nodes[-1].criticality_score

    # Every score between 0.0 and 1.0
    for n in crits.nodes:
        assert 0.0 <= n.criticality_score <= 1.0


def test_edge_criticality(sample_network):
    engine = Track4Engine()
    crits = engine.calculate_criticality(sample_network)

    assert len(crits.edges) == len(sample_network.edges)
    for e in crits.edges:
        assert 0.0 <= e.criticality_score <= 1.0

    # Power link to water pumping station is a single point of failure
    edge_ids = [e.edge_id for e in crits.edges]
    assert "e_sub_water" in edge_ids
