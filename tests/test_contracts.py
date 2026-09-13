import unittest
import json
import os
from models import (
    SimulationState,
    SimulationEvent,
    SimulationEventCollection,
    SimulationResult,
    Scenario,
)
from engine import SimulationEngine
from graph import load_network


class TestContracts(unittest.TestCase):
    def setUp(self):
        fixture_path = os.path.join(os.path.dirname(__file__), "..", "fixtures", "test_network.json")
        self.network = load_network(fixture_path)
        self.engine = SimulationEngine(self.network, scenario_id="scenario_01")

    def test_contract_c11_simulation_state_schema(self):
        self.engine.trigger_failure("substation_01")
        self.engine.step_simulation(1.0)
        state = self.engine.get_network_state()
        data = state.to_dict()

        # Contract C11 required fields
        self.assertIn("scenario_id", data)
        self.assertIn("time", data)
        self.assertIn("assets", data)
        self.assertIn("failed_nodes", data)
        self.assertIn("degraded_nodes", data)
        self.assertIn("backup_nodes", data)
        self.assertIn("critical_nodes", data)
        self.assertIn("affected_edges", data)

        # Asset internal schema: state, load
        self.assertIn("state", data["assets"]["substation_01"])
        self.assertIn("load", data["assets"]["substation_01"])
        self.assertEqual(data["assets"]["substation_01"]["state"], "FAILED")

        # Serializability check
        json_str = json.dumps(data)
        self.assertTrue(len(json_str) > 0)

    def test_contract_c12_simulation_event_schema(self):
        self.engine.trigger_failure("power_station_01", cause="generator_trip")
        events = self.engine.get_event_history()
        self.assertGreater(len(events), 0)

        ev = events[0]
        data = ev.to_dict()

        self.assertIn("time", data)
        self.assertIn("event", data)
        self.assertIn("cause", data)
        self.assertEqual(data["event"], "asset_failed")
        self.assertEqual(data["cause"], "generator_trip")
        self.assertEqual(data["asset_id"], "power_station_01")

        # Event collection
        collection = SimulationEventCollection(
            schema_version="1.0",
            simulation_id="sim_001",
            events=events
        )
        coll_data = collection.to_dict()
        self.assertEqual(coll_data["schema_version"], "1.0")
        self.assertIsInstance(coll_data["events"], list)

    def test_contract_c13_simulation_result_schema(self):
        scenario = Scenario(
            id="scenario_01",
            name="Test Scenario",
            failures=["power_station_01"],
            interventions=[],
            duration=6.0
        )
        result = self.engine.run_simulation(scenario=scenario)
        data = result.to_dict()

        self.assertIn("schema_version", data)
        self.assertIn("simulation_id", data)
        self.assertIn("scenario_id", data)
        self.assertIn("status", data)
        self.assertIn("duration_hours", data)
        self.assertIn("final_state", data)
        self.assertIn("events", data)
        self.assertEqual(data["status"], "COMPLETED")
        self.assertEqual(data["duration_hours"], 6.0)


if __name__ == "__main__":
    unittest.main()
