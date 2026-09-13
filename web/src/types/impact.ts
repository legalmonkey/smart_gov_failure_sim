export interface ImpactResult {
  scenario_id: string;
  population_affected: number;
  duration_hours: number;
  emergency_response_delay_minutes: number;
  hospital_disruptions: number;
  school_disruptions: number;
  water_service_disruptions: number;
  power_service_disruptions: number;
  impact_score: number;
}

export interface UncertaintyDistribution {
  mean: number;
  median: number;
  p05: number;
  p95: number;
}

export interface UncertaintyResult {
  scenario_id: string;
  iterations: number;
  random_seed?: number;
  population_affected: UncertaintyDistribution;
  hospital_failure_probability: number;
  hospital_failure_time_hours: {
    median: number;
    p05: number;
    p95: number;
  };
}
