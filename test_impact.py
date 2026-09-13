import unittest
from models import SimulationState
from impact_engine import ImpactEngine

class TestImpactEngine(unittest.TestCase):
    def setUp(self):
        self.engine = ImpactEngine()
        # Create mock fixture matching Checkpoint 2 (Track 2 -> Track 3)
        self.mock_simulation_state = SimulationState(
            time=6,
            failed_nodes=["substation_01", "water_pump_01"],
            degraded_nodes=["hospital_01", "school_01"],
            backup_nodes=["hospital_01_gen"],
            affected_edges=["road_12", "road_15", "road_18"],
            available_capacity={"hospital_01": 40}
        )

    def test_calculate_population_affected(self):
        pop = self.engine.calculate_population_affected(self.mock_simulation_state)
        self.assertGreater(pop, 0)
        # 2 failed (500 each) + 2 degraded (100 each) = 1200
        self.assertEqual(pop, 1200)

    def test_calculate_human_impact(self):
        result = self.engine.calculate_human_impact(self.mock_simulation_state)
        
        self.assertEqual(result.schema_version, "1.0")
        self.assertEqual(result.population_affected, 1200)
        self.assertEqual(result.duration_hours, 6.0)
        self.assertEqual(result.emergency_response_delay_minutes, 6.0)
        self.assertGreater(result.impact_score, 0.0)
        self.assertLessEqual(result.impact_score, 1.0)
        
        # Checking schema conformity
        self.assertTrue(hasattr(result, 'hospital_disruptions'))

    def test_run_monte_carlo(self):
        result = self.engine.run_monte_carlo(self.mock_simulation_state, iterations=100)
        
        self.assertEqual(result.iterations, 100)
        self.assertGreater(result.population_affected.mean, 0)
        self.assertGreater(result.population_affected.p95, result.population_affected.p05)
        self.assertGreaterEqual(result.hospital_failure_probability, 0.0)
        self.assertLessEqual(result.hospital_failure_probability, 1.0)

if __name__ == '__main__':
    unittest.main()
