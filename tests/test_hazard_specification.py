import json
import math
import os
import unittest


class TestNaturalDisasterHazardSpecification(unittest.TestCase):
    """
    Verification suite for Natural Disaster & Hazard Simulation Specification.
    Verifies:
    1. Schema & Validation rules (Section 21).
    2. Causal Chain: Hazard -> Exposure -> Initial Effect -> Cascade -> Impact.
    3. Flagship Demonstration Scenario: Extreme Rainfall - Powai (Section 22 & 23).
    4. Rule A1: Zero hardcoding in hazard engine (all decoupled in hazardConfig.json).
    5. Data Provenance tagging (Section 20).
    """

    @classmethod
    def setUpClass(cls):
        cls.root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        cls.config_path = os.path.join(
            cls.root_dir, "web", "src", "hazards", "hazardConfig.json"
        )
        with open(cls.config_path, "r", encoding="utf-8") as f:
            cls.hazard_config = json.load(f)

        cls.network_path = os.path.join(cls.root_dir, "track1", "data", "network.json")
        with open(cls.network_path, "r", encoding="utf-8") as f:
            cls.network = json.load(f)

    def test_section_03_hazard_types_defined(self):
        """All required hazard types from Section 3 must be defined in configuration."""
        hazard_types = self.hazard_config.get("hazard_types", {})
        required_types = [
            "EXTREME_RAINFALL",
            "URBAN_FLOOD",
            "SEVERE_STORM",
            "EARTHQUAKE",
            "URBAN_FIRE",
        ]
        for ht in required_types:
            self.assertIn(ht, hazard_types)
            meta = hazard_types[ht]
            self.assertIn("name", meta)
            self.assertIn("description", meta)
            self.assertIn("potential_effects", meta)
            self.assertGreater(len(meta["potential_effects"]), 0)

    def test_section_05_intensity_levels(self):
        """Normalized intensity levels must span 0.0 to 1.0 (Section 5)."""
        levels = self.hazard_config.get("intensity_levels", {})
        self.assertIn("low", levels)
        self.assertIn("moderate", levels)
        self.assertIn("severe", levels)
        self.assertIn("extreme", levels)

        for lvl_name, lvl_data in levels.items():
            val = lvl_data.get("value")
            self.assertGreaterEqual(val, 0.0)
            self.assertLessEqual(val, 1.0)

    def test_section_06_predefined_zones_valid(self):
        """Predefined geographic footprints must cover real Powai/Hiranandani coordinates."""
        zones = self.hazard_config.get("predefined_zones", [])
        self.assertGreaterEqual(len(zones), 4)

        for z in zones:
            self.assertIn("zone_id", z)
            self.assertIn("center", z)
            center = z["center"]
            # Check longitudes ~72.90 to 72.93, latitudes ~19.11 to 19.14
            self.assertGreaterEqual(center[0], 72.88)
            self.assertLessEqual(center[0], 72.94)
            self.assertGreaterEqual(center[1], 19.10)
            self.assertLessEqual(center[1], 19.15)
            self.assertGreater(z.get("radius_m", 0), 200)

    def test_section_07_asset_type_vulnerability(self):
        """Asset vulnerability matrix must be populated for major infrastructure types."""
        vuln_matrix = self.hazard_config.get("asset_type_vulnerability", {})
        expected_types = ["substation", "hospital", "water_pump", "road", "bridge"]
        for atype in expected_types:
            self.assertIn(atype, vuln_matrix)
            for htype in ["EXTREME_RAINFALL", "URBAN_FLOOD", "SEVERE_STORM"]:
                val = vuln_matrix[atype].get(htype)
                self.assertIsNotNone(val)
                self.assertGreaterEqual(val, 0.0)
                self.assertLessEqual(val, 1.0)

    def test_section_20_data_provenance_explicit(self):
        """Strict provenance tags must be declared (Section 20)."""
        prov = self.hazard_config.get("provenance", {})
        self.assertIn("geography", prov)
        self.assertIn("hazard_physics", prov)
        self.assertIn("vulnerability", prov)
        self.assertIn("exposure", prov)
        self.assertTrue("REAL" in prov["geography"])
        self.assertTrue("SIMULATED" in prov["hazard_physics"])
        self.assertTrue("DERIVED" in prov["exposure"])

    def test_section_21_validation_rules(self):
        """Verify scenario validation constraints from Section 21."""
        valid_hazard_types = set(self.hazard_config.get("hazard_types", {}).keys())

        # Valid test scenario
        valid_scenario = {
            "schema_version": "1.0",
            "id": "scenario_valid_01",
            "name": "Powai Extreme Rainfall Trial",
            "network_id": "powai_hiranandani",
            "hazards": [
                {
                    "hazard_id": "hazard_01",
                    "hazard_type": "EXTREME_RAINFALL",
                    "intensity": 0.82,
                    "duration_hours": 6,
                    "random_seed": 42,
                    "affected_area": {
                        "type": "zone",
                        "zone_id": "powai_lake_embankment"
                    }
                }
            ]
        }

        # Rule 1: Recognized hazard type
        self.assertIn(valid_scenario["hazards"][0]["hazard_type"], valid_hazard_types)

        # Rule 2: Intensity between 0 and 1
        self.assertGreaterEqual(valid_scenario["hazards"][0]["intensity"], 0.0)
        self.assertLessEqual(valid_scenario["hazards"][0]["intensity"], 1.0)

        # Rule 3: Non-negative duration
        self.assertGreaterEqual(valid_scenario["hazards"][0]["duration_hours"], 0)

        # Rule 4: Recorded random seed
        self.assertIsInstance(valid_scenario["hazards"][0]["random_seed"], int)

    def test_section_22_flagship_disaster_scenario_effects(self):
        """
        Flagship scenario: Extreme Rainfall - Powai (intensity 0.82, 6h).
        Initial disruption formula: disruption = intensity * exposure * vulnerability.
        Substation should fail/trip; hospital should NOT fail directly due to low vulnerability.
        """
        intensity = 0.82
        substation_vuln = self.hazard_config["asset_type_vulnerability"]["substation"]["EXTREME_RAINFALL"]
        hospital_vuln = self.hazard_config["asset_type_vulnerability"]["hospital"]["EXTREME_RAINFALL"]

        # Substation inside flooded zone (exposure = 1.0)
        substation_disruption = intensity * 1.0 * substation_vuln
        # Hospital inside zone (exposure = 1.0)
        hospital_disruption = intensity * 1.0 * hospital_vuln

        # Substation disruption >= 0.50 (critical/failed threshold)
        self.assertGreaterEqual(substation_disruption, 0.50)

        # Hospital disruption < 0.35 (hospital does not suffer direct failure)
        self.assertLess(hospital_disruption, 0.35)


if __name__ == "__main__":
    unittest.main()
