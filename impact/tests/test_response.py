import pytest
from impact.models import (
    NetworkNode,
    NetworkEdge,
    NetworkGraph,
    SimulationState,
    AssetStateInfo,
)
from impact.response.response_delay import calculate_response_delay


@pytest.fixture
def road_network():
    nodes = [
        NetworkNode(id="road_jvlr", name="JVLR Arterial", type="road_segment", lat=19.12, lon=72.91, properties={"road_class": "arterial"}),
        NetworkNode(id="road_sec", name="Secondary Link", type="road_segment", lat=19.12, lon=72.91, properties={"road_class": "secondary"}),
        NetworkNode(id="bridge_powai", name="Lake Bridge", type="bridge", lat=19.12, lon=72.91),
    ]
    edges = [
        NetworkEdge(id="road_conn_1", from_node="road_jvlr", to_node="road_sec", type="road"),
    ]
    return NetworkGraph(nodes=nodes, edges=edges)


def test_nominal_response_delay(road_network):
    sim_state = SimulationState(
        scenario_id="nominal_response",
        time=0.0,
        assets={n.id: AssetStateInfo("OPERATIONAL") for n in road_network.nodes},
    )
    delay = calculate_response_delay(sim_state, road_network)
    assert delay == 0


def test_arterial_road_closure(road_network):
    sim_state = SimulationState(
        scenario_id="road_closure",
        time=1.0,
        assets={
            "road_jvlr": AssetStateInfo("FAILED"),
            "road_sec": AssetStateInfo("OPERATIONAL"),
            "bridge_powai": AssetStateInfo("OPERATIONAL"),
        },
        failed_nodes=["road_jvlr"],
        affected_edges=["road_conn_1"],
    )
    delay = calculate_response_delay(sim_state, road_network)
    # Arterial road failure (8) + affected road edge (5) = 13
    assert delay == 13


def test_delay_capped_at_threshold(road_network):
    # Multiple major simultaneous closures should not exceed 45 minutes
    sim_state = SimulationState(
        scenario_id="severe_gridlock",
        time=4.0,
        assets={n.id: AssetStateInfo("FAILED") for n in road_network.nodes},
        failed_nodes=["road_jvlr", "road_sec", "bridge_powai", "road_extra_1", "road_extra_2"],
        affected_edges=["road_conn_1", "road_conn_2", "road_conn_3", "road_conn_4", "road_conn_5", "road_conn_6"],
    )
    delay = calculate_response_delay(sim_state, road_network)
    assert delay <= 45
    assert delay == 45
