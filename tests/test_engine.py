import unittest
import os
from models import NetworkGraph, NetworkNode, NetworkEdge, Scenario
from engine import SimulationEngine
from graph import load_network


class TestSimulationEngine(unittest.TestCase):
    def setUp(self):
        fixture_path = os.path.join(os.path.dirname(__file__), "..", "fixtures", "test_network.json")
        self.network = load_network(fixture_path)
        self.engine = SimulationEngine(self.network)

    def test_initialization(self):
        state = self.engine.get_network_state()
        self.assertEqual(state.time, 0.0)
        self.assertEqual(len(state.failed_nodes), 0)
        self.assertEqual(len(state.backup_nodes), 0)
        self.assertEqual(state.assets["power_station_01"]["state"], "OPERATIONAL")

    def test_trigger_single_failure(self):
        self.engine.trigger_failure("power_station_01", cause="manual_test")
        state = self.engine.get_network_state()
        self.assertIn("power_station_01", state.failed_nodes)
        self.assertEqual(state.assets["power_station_01"]["state"], "FAILED")

        # Downstream edge should be failed
        self.assertIn("power_connection_00", state.affected_edges)

    def test_trigger_multiple_failures(self):
        self.engine.trigger_failures(["power_station_01", "substation_01"])
        state = self.engine.get_network_state()
        self.assertIn("power_station_01", state.failed_nodes)
        self.assertIn("substation_01", state.failed_nodes)

    def test_edge_failure_propagation(self):
        self.engine.trigger_failure("power_connection_01")
        state = self.engine.get_network_state()
        self.assertIn("power_connection_01", state.affected_edges)

        # Advance simulation: hospital should enter BACKUP because its power supply is cut
        self.engine.step_simulation(0.5)
        new_state = self.engine.get_network_state()
        self.assertIn("hospital_01", new_state.backup_nodes)

    def test_backup_depletion_and_failure(self):
        # Fail substation which feeds hospital
        self.engine.trigger_failure("substation_01")
        self.engine.step_simulation(0.1)

        state = self.engine.get_network_state()
        self.assertIn("hospital_01", state.backup_nodes)

        # Hospital has backup_duration = 6 hours. Advance by 5.5 hours -> still on backup
        for _ in range(55):
            self.engine.step_simulation(0.1)

        state_mid = self.engine.get_network_state()
        self.assertIn("hospital_01", state_mid.backup_nodes)

        # Advance past 6.0 hours -> backup exhausts and hospital fails
        for _ in range(10):
            self.engine.step_simulation(0.1)

        state_exhausted = self.engine.get_network_state()
        self.assertIn("hospital_01", state_exhausted.failed_nodes)

        # Event log should contain asset_backup and asset_failed with backup_exhausted
        events = self.engine.get_event_history()
        backup_exhausted_events = [
            e for e in events if e.asset_id == "hospital_01" and e.cause == "backup_exhausted"
        ]
        self.assertEqual(len(backup_exhausted_events), 1)

    def test_interventions(self):
        # Apply intervention: add 4 hours backup to hospital
        interventions = [
            {
                "target_asset_id": "hospital_01",
                "effects": {"backup_duration": 4.0}
            }
        ]
        self.engine.apply_interventions(interventions)
        hospital = self.engine.network.node_map["hospital_01"]
        self.assertEqual(hospital.backup_duration, 10.0)
        self.assertEqual(hospital.remaining_backup_hours, 10.0)

    def test_reset_simulation(self):
        self.engine.trigger_failure("power_station_01")
        self.engine.step_simulation(2.0)
        self.assertGreater(self.engine.current_time, 0.0)

        self.engine.reset_simulation()
        reset_state = self.engine.get_network_state()
        self.assertEqual(reset_state.time, 0.0)
        self.assertEqual(len(reset_state.failed_nodes), 0)
        self.assertEqual(len(self.engine.events), 0)


if __name__ == "__main__":
    unittest.main()
