export interface SelectedIntervention {
  intervention_id: string;
  target_asset_id: string;
  cost: number;
}

export interface OptimizationResult {
  scenario_id: string;
  budget: number;
  selected_interventions: SelectedIntervention[];
  total_cost: number;
  baseline_impact: number;
  optimized_impact: number;
  impact_reduction: number;
}

export interface UserPlanResult {
  scenario_id: string;
  budget: number;
  selected_interventions: SelectedIntervention[];
  total_cost: number;
  baseline_impact: number;
  resulting_impact: number;
  impact_reduction: number;
}
