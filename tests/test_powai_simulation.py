import unittest
import os
import json
from engine import SimulationEngine
from graph import load_network
from models import Scenario


class TestPowaiSimulation(unittest.TestCase):
    """
    Simulates the flagship Powai / Hiranandani scenario defined on Page 74
    using the 26-node realistic network.
    """

    def setUp(self):
        self.fixture_path = os.path.join(os.path.dirname(__file__), "..", "fixtures", "test_network.json")
        self.engine = SimulationEngine(load_network(self.fixture_path))

    def test_flagship_cascade(self):
        scenario = Scenario(
            id="scenario_01",
            name="Powai Grid Trip & Arterial Disruption",
            failures=["power_station_01"],
            interventions=[],
            duration=24.0,
            random_seed=42
        )

        result = self.engine.run_simulation(scenario=scenario)
        self.assertEqual(result.status, "COMPLETED")
        self.assertGreater(len(result.events), 0)

        # Confirm that hospital was placed on backup, exhausted it, and failed
        hospital_events = [e for e in result.events if e.asset_id == "hospital_01"]
        event_types = [e.event for e in hospital_events]
        self.assertIn("asset_backup", event_types)
        self.assertIn("asset_failed", event_types)

        # Check final state export
        state_json = self.engine.export_state_json()
        parsed = json.loads(state_json)
        self.assertEqual(parsed["scenario_id"], "scenario_01")
        self.assertIn("assets", parsed)
        self.assertIn("failed_nodes", parsed)

        # Check events export
        events_json = self.engine.export_events_json()
        events_parsed = json.loads(events_json)
        self.assertIsInstance(events_parsed, list)


if __name__ == "__main__":
    unittest.main()
