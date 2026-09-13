import json
import os
import subprocess
import sys
import unittest

from track2.graph import load_network as load_t2_network
from track2.engine import SimulationEngine
from impact.impact_engine import ImpactEngine, load_network_graph as load_t3_network
from impact.models import SimulationState as T3SimState, AssetStateInfo
from track4.engine import Track4Engine


class TestTrack1Integration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        cls.track1_dir = os.path.join(cls.root_dir, 'track1')
        cls.data_dir = os.path.join(cls.track1_dir, 'data')
        cls.network_path = os.path.join(cls.data_dir, 'network.json')
        cls.facilities_path = os.path.join(cls.data_dir, 'facilities.json')
        cls.population_path = os.path.join(cls.data_dir, 'population.json')
        cls.area_config_path = os.path.join(cls.data_dir, 'area_config.json')

        with open(cls.network_path, 'r', encoding='utf-8') as f:
            cls.network_data = json.load(f)
        with open(cls.facilities_path, 'r', encoding='utf-8') as f:
            cls.facilities_data = json.load(f)
        with open(cls.population_path, 'r', encoding='utf-8') as f:
            cls.population_data = json.load(f)

    def test_track1_data_integrity(self):
        self.assertEqual(len(self.network_data['nodes']), 46)
        self.assertEqual(len(self.network_data['edges']), 73)
        self.assertEqual(self.network_data['network_id'], 'powai_hiranandani')
        self.assertEqual(self.network_data['coordinate_reference_system'], 'EPSG:4326')
        self.assertGreater(len(self.facilities_data['facilities']), 0)
        self.assertGreater(len(self.population_data['population']), 0)

    def test_track1_to_track2_loading(self):
        t2_net = load_t2_network(self.network_path)
        self.assertEqual(len(t2_net.nodes), 46)
        self.assertEqual(len(t2_net.edges), 73)
        node_hosp = t2_net.node_map.get('node_hosp_hiranandani')
        self.assertIsNotNone(node_hosp)
        self.assertGreater(node_hosp.capacity, 0)
        self.assertGreater(node_hosp.backup_duration, 0)
        self.assertGreater(node_hosp.failure_threshold, 0)
        self.assertGreater(node_hosp.recovery_time, 0)

    def test_track1_track2_cascade_simulation(self):
        t2_net = load_t2_network(self.network_path)
        engine = SimulationEngine(t2_net)
        substation_nodes = [n.id for n in t2_net.nodes if n.type == 'substation']
        self.assertGreater(len(substation_nodes), 0)
        failed_sub = substation_nodes[0]
        engine.trigger_failure(failed_sub)
        for _ in range(15):
            engine.step_simulation(0.2)
        state = engine.get_network_state()
        self.assertIn(failed_sub, state.failed_nodes)
        self.assertAlmostEqual(state.time, 3.0, places=1)
        downstream_affected = len(state.failed_nodes) + len(state.backup_nodes) + len(state.degraded_nodes)
        self.assertGreater(downstream_affected, 1)

    def test_track1_to_track3_human_impact(self):
        t3_net = load_t3_network(self.network_path)
        self.assertEqual(len(t3_net.nodes), 46)
        self.assertEqual(len(t3_net.edges), 73)
        impact_engine = ImpactEngine()
        substation_id = next(n.id for n in t3_net.nodes if n.type == 'substation')
        water_id = next(n.id for n in t3_net.nodes if n.type == 'water_pump')
        sim_state = T3SimState(
            scenario_id="scenario_flood",
            time=2.0,
            assets={
                substation_id: AssetStateInfo(state='FAILED', load=0),
                water_id: AssetStateInfo(state='FAILED', load=0),
            },
            failed_nodes=[substation_id, water_id],
        )
        impact = impact_engine.calculate_human_impact(sim_state, t3_net)
        self.assertGreater(impact.population_affected, 0)
        self.assertGreater(impact.impact_score, 0.0)

    def test_track1_to_track4_criticality_ranking(self):
        t3_net = load_t3_network(self.network_path)
        impact_engine = ImpactEngine()
        track4_engine = Track4Engine(impact_engine)
        crits = track4_engine.calculate_criticality(t3_net)
        self.assertEqual(len(crits.nodes), 46)
        self.assertGreater(crits.nodes[0].criticality_score, 0.0)
        self.assertGreater(crits.nodes[0].removal_impact, 0.0)

    def test_track1_scripts_run_from_root(self):
        val_res = subprocess.run(
            [sys.executable, 'track1/scripts/validate_data.py'],
            cwd=self.root_dir,
            capture_output=True,
            text=True,
        )
        self.assertEqual(val_res.returncode, 0, f'validate_data failed: {val_res.stderr}')

        build_res = subprocess.run(
            [sys.executable, 'track1/scripts/build_network.py'],
            cwd=self.root_dir,
            capture_output=True,
            text=True,
        )
        self.assertEqual(build_res.returncode, 0, f'build_network failed: {build_res.stderr}')

        pop_res = subprocess.run(
            [sys.executable, 'track1/scripts/generate_population.py'],
            cwd=self.root_dir,
            capture_output=True,
            text=True,
        )
        self.assertEqual(pop_res.returncode, 0, f'generate_population failed: {pop_res.stderr}')

    def test_rule_a1_zero_hardcoding_in_track1(self):
        track1_scripts_dir = os.path.join(self.track1_dir, 'scripts')
        script_files = [f for f in os.listdir(track1_scripts_dir) if f.endswith('.py')]
        domain_tokens = [
            'node_hosp_hiranandani',
            'node_substation_powai',
            'Hiranandani Hospital',
            'IIT Bombay Substation',
            'JVLR Flyover',
            'S.M. Shetty High School',
        ]
        for sfile in script_files:
            spath = os.path.join(track1_scripts_dir, sfile)
            with open(spath, 'r', encoding='utf-8') as f:
                c = f.read()
            for token in domain_tokens:
                self.assertNotIn(
                    token,
                    c,
                    f'Violation of Rule A1: Found hardcoded domain fact {token} in script {sfile}!'
                )

if __name__ == '__main__':
    unittest.main()
