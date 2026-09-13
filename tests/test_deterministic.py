import unittest
import os
from engine import SimulationEngine
from graph import load_network
from models import Scenario


class TestDeterministicBenchmark(unittest.TestCase):
    """
    Mandatory regression test defined in Section 7 (Integration Plan):
    Power Station -> Substation -> Hospital -> Population.
    Ensures identical inputs and scenario produce deterministic outputs.
    """

    def setUp(self):
        self.fixture_path = os.path.join(os.path.dirname(__file__), "..", "fixtures", "test_network.json")
        self.scenario = Scenario(
            id="benchmark_01",
            name="Deterministic Cascade Benchmark",
            failures=["power_station_01"],
            interventions=[],
            duration=15.0,
            random_seed=42
        )

    def test_deterministic_execution(self):
        # Run 1
        net1 = load_network(self.fixture_path)
        engine1 = SimulationEngine(net1)
        res1 = engine1.run_simulation(scenario=self.scenario)

        # Run 2
        net2 = load_network(self.fixture_path)
        engine2 = SimulationEngine(net2)
        res2 = engine2.run_simulation(scenario=self.scenario)

        # Ensure run 1 and run 2 produce identical final states
        self.assertEqual(res1.status, res2.status)
        self.assertEqual(res1.duration_hours, res2.duration_hours)
        self.assertEqual(res1.final_state.failed_nodes, res2.final_state.failed_nodes)
        self.assertEqual(res1.final_state.assets, res2.final_state.assets)
        self.assertEqual(len(res1.events), len(res2.events))

        for ev1, ev2 in zip(res1.events, res2.events):
            self.assertEqual(ev1.time, ev2.time)
            self.assertEqual(ev1.event, ev2.event)
            self.assertEqual(ev1.asset_id, ev2.asset_id)
            self.assertEqual(ev1.cause, ev2.cause)

    def test_cascade_timeline_progression(self):
        net = load_network(self.fixture_path)
        engine = SimulationEngine(net)
        engine.initialize_simulation(net)

        # Step 0: Power Station fails
        engine.trigger_failure("power_station_01")
        s0 = engine.get_network_state()
        self.assertIn("power_station_01", s0.failed_nodes)

        # Step 1: Substation loses incoming transmission and enters BACKUP
        engine.step_simulation(0.2)
        s1 = engine.get_network_state()
        self.assertIn("substation_01", s1.backup_nodes)

        # Substation backup duration is 2 hours. Advance 2 hours -> Substation fails
        for _ in range(20):
            engine.step_simulation(0.1)

        s2 = engine.get_network_state()
        self.assertIn("substation_01", s2.failed_nodes)

        # Hospital was receiving power from Substation. Now Hospital switches to BACKUP
        self.assertIn("hospital_01", s2.backup_nodes)

        # Hospital backup duration is 6 hours. Advance 6 hours -> Hospital fails
        for _ in range(60):
            engine.step_simulation(0.1)

        s3 = engine.get_network_state()
        self.assertIn("hospital_01", s3.failed_nodes)

        # Residential zone loses hospital healthcare service and degrades
        self.assertIn("population_hiranandani_01", s3.degraded_nodes)


if __name__ == "__main__":
    unittest.main()
