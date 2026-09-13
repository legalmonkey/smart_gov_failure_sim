import unittest
import json
import os

from track2.graph import load_network as load_t2_network
from track2.engine import SimulationEngine
from track2.models import Scenario as T2Scenario, SimulationState as T2SimState

from impact.impact_engine import ImpactEngine
from impact.models import (
    NetworkGraph as T3Graph,
    NetworkNode as T3Node,
    NetworkEdge as T3Edge,
    SimulationState as T3SimState,
    AssetStateInfo,
)
from track4.engine import Track4Engine


class TestTrack2Integration(unittest.TestCase):
    """
    End-to-end integration tests connecting:
    Track 1 (Data) -> Track 2 (Cascade Engine) -> Track 3 (Impact Engine) -> Track 4 (Criticality & Optimization)
    """

    @classmethod
    def setUpClass(cls):
        cls.fixture_path = os.path.join(
            os.path.dirname(__file__), "fixtures", "mock-network.json"
        )
        with open(cls.fixture_path, "r", encoding="utf-8") as f:
            cls.raw_network = json.load(f)

        cls.t2_network = load_t2_network(cls.fixture_path)

        # Build T3 graph for ImpactEngine
        t3_nodes = [
            T3Node(
                id=n["id"],
                name=n["name"],
                type=n["type"],
                lat=n.get("location", {}).get("latitude", 19.12),
                lon=n.get("location", {}).get("longitude", 72.91),
                population_served=n.get("population_served", 0),
                capacity=n.get("capacity", 100),
                backup_duration=n.get("backup_duration", 0),
            )
            for n in cls.raw_network["nodes"]
        ]
        t3_edges = [
            T3Edge(
                id=e["id"],
                from_node=e["from"],
                to_node=e["to"],
                type=e["type"],
                capacity=e.get("capacity", 100),
                weight=e.get("dependency_strength", 1.0),
            )
            for e in cls.raw_network["edges"]
        ]
        cls.t3_network = T3Graph(nodes=t3_nodes, edges=t3_edges)
        cls.impact_engine = ImpactEngine()
        cls.track4_engine = Track4Engine(cls.impact_engine)

    def test_track1_to_track2_loading(self):
        """Track 2 must load the real 26-node Powai network without modification."""
        self.assertEqual(len(self.t2_network.nodes), 26)
        self.assertEqual(len(self.t2_network.edges), 32)
        self.assertIn("substation_01", self.t2_network.node_map)
        self.assertIn("hospital_01", self.t2_network.node_map)

    def test_track2_cascade_simulation(self):
        """Simulate power substation failure and verify cascade propagation over time."""
        engine = SimulationEngine(self.t2_network)
        engine.trigger_failure("substation_01")

        # Initial state at t=0
        state_t0 = engine.get_network_state()
        self.assertIn("substation_01", state_t0.failed_nodes)

        # Step forward 2 hours
        for _ in range(20):
            engine.step_simulation(0.1)

        state_t2 = engine.get_network_state()
        self.assertAlmostEqual(state_t2.time, 2.0, places=1)
        # Downstream assets must reflect backup or degradation
        self.assertTrue(
            len(state_t2.backup_nodes) > 0 or len(state_t2.degraded_nodes) > 0,
            "Cascade must propagate to downstream dependencies."
        )

    def test_track2_to_track3_human_impact(self):
        """Track 3 ImpactEngine must directly consume Track 2 SimulationState."""
        engine = SimulationEngine(self.t2_network)
        engine.trigger_failure("substation_01")
        for _ in range(20):
            engine.step_simulation(0.1)

        t2_state = engine.get_network_state()

        # Convert to Track 3 state via helper
        t3_state = t2_state.to_impact_state()
        impact = self.impact_engine.calculate_human_impact(t3_state, self.t3_network)

        self.assertGreater(impact.impact_score, 0.0)
        self.assertGreater(impact.population_affected, 0)
        self.assertIsInstance(impact.hospital_disruptions, int)
        self.assertIsInstance(impact.emergency_response_delay_minutes, int)

    def test_track2_in_track4_criticality(self):
        """Track 4 Criticality calculation can evaluate node criticality using Track 2."""
        criticality = self.track4_engine.calculate_criticality(self.t3_network)
        self.assertGreater(len(criticality.nodes), 0)
        self.assertGreater(len(criticality.edges), 0)

        # Substation or power station should rank among top critical nodes
        ranked_ids = [n.asset_id for n in criticality.nodes]
        self.assertIn("substation_01", ranked_ids[:5])

    def test_contract_c11_c12_c13_conformance(self):
        """Verify that simulation outputs strictly conform to C11, C12, C13 schemas."""
        engine = SimulationEngine(self.t2_network)
        scenario = T2Scenario(
            id="test_sc_01",
            name="Test Flood Shock",
            failures=["substation_01"],
            duration=4.0
        )
        result = engine.run_simulation(scenario=scenario)

        # C13 SimulationResult
        self.assertEqual(result.schema_version, "1.0")
        self.assertEqual(result.status, "COMPLETED")
        self.assertEqual(result.duration_hours, 4.0)

        # C11 SimulationState
        state = result.final_state
        self.assertEqual(state.scenario_id, "test_sc_01")
        self.assertIn("substation_01", state.assets)
        self.assertIn("state", state.assets["substation_01"])
        self.assertIn("load", state.assets["substation_01"])

        # C12 SimulationEvent
        self.assertGreater(len(result.events), 0)
        first_ev = result.events[0]
        self.assertEqual(first_ev.event, "asset_failed")
        self.assertEqual(first_ev.asset_id, "substation_01")


if __name__ == "__main__":
    unittest.main()
