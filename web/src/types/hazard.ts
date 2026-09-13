export type HazardType =
  | 'EXTREME_RAINFALL'
  | 'URBAN_FLOOD'
  | 'SEVERE_STORM'
  | 'EARTHQUAKE'
  | 'URBAN_FIRE'
  | string;

export type HazardIntensityLevel = 'low' | 'moderate' | 'severe' | 'extreme';

export type ExposureLevel = 'none' | 'low' | 'moderate' | 'high' | 'extreme';

export type HazardAreaType = 'polygon' | 'circle' | 'zone' | 'point';

export interface HazardSpatialFootprint {
  type: HazardAreaType;
  coordinates: [number, number][]; // [longitude, latitude]
  center?: [number, number]; // [longitude, latitude]
  radius_m?: number;
  zone_id?: string;
  name?: string;
}

export interface HazardParameters {
  rainfall_intensity_mm_per_hour?: number;
  flood_depth_m?: number;
  wind_speed_kmh?: number;
  magnitude?: number;
  epicenter?: [number, number] | number[];
  spread_rate_m_per_hour?: number;
  drainage_capacity_factor?: number;
  peak_time_hours?: number;
  [key: string]: any;
}

export interface HazardDefinition {
  hazard_id: string;
  hazard_type: HazardType;
  name: string;
  intensity: number; // 0.0 to 1.0
  duration_hours: number;
  start_time: string; // e.g. '04:00'
  peak_time_hours?: number;
  affected_area: HazardSpatialFootprint;
  parameters?: HazardParameters;
  random_seed: number;
  provenance?: {
    geometry: 'REAL';
    parameters: 'SIMULATED';
    exposure: 'DERIVED';
  };
}

export type InitialOperationalEffect =
  | 'no_effect'
  | 'degraded'
  | 'backup'
  | 'critical'
  | 'failed'
  | 'access_restricted'
  | 'capacity_reduced'
  | 'load_increased'
  | 'temporary_closure';

export interface AssetExposureInfo {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  location: { latitude: number; longitude: number };
  direct_exposure: boolean;
  distance_m: number;
  exposure_level: ExposureLevel;
  exposure_score: number; // 0.0 to 1.0
  vulnerability: number; // 0.0 to 1.0
  disruption_score: number; // intensity * exposure * vulnerability
  expected_effect: InitialOperationalEffect;
  reasons: string[];
}

export interface HazardPreviewSummary {
  hazard_id: string;
  hazard_type: HazardType;
  hazard_name: string;
  intensity: number;
  intensity_level: HazardIntensityLevel;
  duration_hours: number;
  start_time: string;
  affected_area_name: string;
  exposed_assets: AssetExposureInfo[];
  expected_initial_disruptions: AssetExposureInfo[];
  population_exposed: number;
  uncertainty: {
    level: string;
    p05: number;
    median: number;
    p95: number;
  };
  provenance: {
    geometry: 'REAL';
    parameters: 'SIMULATED';
    exposure: 'DERIVED';
  };
}

export interface DisasterScenario {
  schema_version: string;
  id: string;
  name: string;
  network_id: string;
  description?: string;
  hazards: HazardDefinition[];
  duration_hours: number;
  random_seed: number;
  budget?: number;
}
