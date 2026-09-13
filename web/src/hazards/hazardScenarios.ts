import type { DisasterScenario } from '../types/hazard';

/**
 * Predefined canonical disaster scenarios conforming strictly to
 * Sections 22, 23 & 24 of the Natural Disaster Hazard Specification.
 */
export const PREDEFINED_DISASTER_SCENARIOS: DisasterScenario[] = [
  {
    schema_version: '1.0',
    id: 'scenario_extreme_rainfall_01',
    name: 'Powai Extreme Rainfall & Monsoon Inundation',
    network_id: 'powai_hiranandani',
    description:
      'Flagship demonstration: Monsoonal cloudburst (120 mm/h) producing drainage overload, arterial road degradation, and tripping of the primary power substation while hospital shifts to backup power.',
    duration_hours: 6,
    random_seed: 42,
    budget: 2000000,
    hazards: [
      {
        hazard_id: 'hazard_rain_01',
        hazard_type: 'EXTREME_RAINFALL',
        name: 'Extreme Rainfall — Powai',
        intensity: 0.82,
        duration_hours: 6,
        start_time: '04:00',
        peak_time_hours: 4,
        affected_area: {
          type: 'zone',
          zone_id: 'powai_lake_embankment',
          name: 'Powai Lake Southern Embankment',
          coordinates: [
            [72.898, 19.118],
            [72.908, 19.118],
            [72.909, 19.123],
            [72.897, 19.122],
            [72.898, 19.118],
          ],
          center: [72.9035, 19.1195],
          radius_m: 650,
        },
        parameters: {
          rainfall_intensity_mm_per_hour: 120,
          peak_time_hours: 4,
          drainage_capacity_factor: 0.65,
        },
        random_seed: 42,
        provenance: {
          geometry: 'REAL',
          parameters: 'SIMULATED',
          exposure: 'DERIVED',
        },
      },
    ],
  },
  {
    schema_version: '1.0',
    id: 'scenario_urban_flood_01',
    name: 'Powai Lake Catchment Overflow & Urban Surge',
    network_id: 'powai_hiranandani',
    description:
      'Extreme lake level surge inundating low-lying water pumping works and access routes across the Rambaug basin.',
    duration_hours: 12,
    random_seed: 108,
    budget: 2500000,
    hazards: [
      {
        hazard_id: 'hazard_flood_01',
        hazard_type: 'URBAN_FLOOD',
        name: 'Urban Flooding — Catchment Overflow',
        intensity: 0.78,
        duration_hours: 12,
        start_time: '02:00',
        peak_time_hours: 5,
        affected_area: {
          type: 'zone',
          zone_id: 'rambaug_lowlands',
          name: 'Rambaug Lowland Basin',
          coordinates: [
            [72.897, 19.111],
            [72.906, 19.111],
            [72.906, 19.118],
            [72.897, 19.118],
            [72.897, 19.111],
          ],
          center: [72.9015, 19.1145],
          radius_m: 550,
        },
        parameters: {
          flood_depth_m: 1.35,
          recession_hours: 12,
        },
        random_seed: 108,
        provenance: {
          geometry: 'REAL',
          parameters: 'SIMULATED',
          exposure: 'DERIVED',
        },
      },
    ],
  },
  {
    schema_version: '1.0',
    id: 'scenario_severe_storm_01',
    name: 'Severe Monsoon Squall & Grid Feeder Severance',
    network_id: 'powai_hiranandani',
    description:
      'High cyclonic wind gusts (95 km/h) and flying debris causing transmission feeder trips and road blockages along the JVLR arterial corridor.',
    duration_hours: 8,
    random_seed: 77,
    budget: 1800000,
    hazards: [
      {
        hazard_id: 'hazard_storm_01',
        hazard_type: 'SEVERE_STORM',
        name: 'Severe Storm — JVLR Corridor',
        intensity: 0.65,
        duration_hours: 8,
        start_time: '06:00',
        peak_time_hours: 3,
        affected_area: {
          type: 'zone',
          zone_id: 'jvlr_transport_corridor',
          name: 'JVLR Arterial Transport Corridor',
          coordinates: [
            [72.899, 19.124],
            [72.92, 19.124],
            [72.92, 19.13],
            [72.899, 19.13],
            [72.899, 19.124],
          ],
          center: [72.9095, 19.1265],
          radius_m: 750,
        },
        parameters: {
          wind_speed_kmh: 95,
          gust_factor: 1.4,
        },
        random_seed: 77,
        provenance: {
          geometry: 'REAL',
          parameters: 'SIMULATED',
          exposure: 'DERIVED',
        },
      },
    ],
  },
  {
    schema_version: '1.0',
    id: 'scenario_earthquake_01',
    name: 'Thane Fault Moderate Earthquake & Pipe Stress',
    network_id: 'powai_hiranandani',
    description:
      'Magnitude 5.8 regional seismic tremor producing peak ground acceleration, water distribution mains fractures, and surge in trauma admissions.',
    duration_hours: 24,
    random_seed: 999,
    budget: 3000000,
    hazards: [
      {
        hazard_id: 'hazard_quake_01',
        hazard_type: 'EARTHQUAKE',
        name: 'Earthquake — Local Swarm',
        intensity: 0.72,
        duration_hours: 24,
        start_time: '08:00',
        peak_time_hours: 1,
        affected_area: {
          type: 'zone',
          zone_id: 'hiranandani_core',
          name: 'Hiranandani Gardens Commercial Core',
          coordinates: [
            [72.908, 19.114],
            [72.918, 19.114],
            [72.918, 19.123],
            [72.908, 19.123],
            [72.908, 19.114],
          ],
          center: [72.9125, 19.1185],
          radius_m: 600,
        },
        parameters: {
          magnitude: 5.8,
          epicenter: [72.905, 19.112],
          depth_km: 10,
        },
        random_seed: 999,
        provenance: {
          geometry: 'REAL',
          parameters: 'SIMULATED',
          exposure: 'DERIVED',
        },
      },
    ],
  },
  {
    schema_version: '1.0',
    id: 'scenario_urban_fire_01',
    name: 'Commercial High-Rise Fire & Access Corridor Gridlock',
    network_id: 'powai_hiranandani',
    description:
      'Major electrical fire in commercial SEZ building requiring immediate evacuation, perimeter cordoning, and emergency vehicle routing.',
    duration_hours: 8,
    random_seed: 333,
    budget: 1500000,
    hazards: [
      {
        hazard_id: 'hazard_fire_01',
        hazard_type: 'URBAN_FIRE',
        name: 'Urban Fire — Commercial Strip',
        intensity: 0.85,
        duration_hours: 8,
        start_time: '14:00',
        peak_time_hours: 2,
        affected_area: {
          type: 'zone',
          zone_id: 'hiranandani_core',
          name: 'Hiranandani Gardens Commercial Core',
          coordinates: [
            [72.908, 19.114],
            [72.918, 19.114],
            [72.918, 19.123],
            [72.908, 19.123],
            [72.908, 19.114],
          ],
          center: [72.9125, 19.1185],
          radius_m: 400,
        },
        parameters: {
          spread_rate_m_per_hour: 45,
          thermal_radius_m: 350,
        },
        random_seed: 333,
        provenance: {
          geometry: 'REAL',
          parameters: 'SIMULATED',
          exposure: 'DERIVED',
        },
      },
    ],
  },
];
