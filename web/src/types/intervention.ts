export interface Intervention {
  id: string;
  name: string;
  target_types: string[];
  cost: number;
  effects: Record<string, number>;
  constraints: string[];
}

export interface InterventionRequest {
  scenario_id: string;
  target_asset_id: string;
  intervention_id: string;
}
