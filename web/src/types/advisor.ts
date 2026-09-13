import type { SelectedIntervention } from './optimization';

export interface PlanSummary {
  impact: number;
  impact_reduction: number;
  total_cost?: number;
  selected_interventions?: SelectedIntervention[];
}

export interface AdvisorResult {
  scenario_id: string;
  user_plan: PlanSummary;
  optimal_plan: PlanSummary;
  missed_critical_assets: string[];
  missed_critical_edges: string[];
  priority_reasons: string[];
}
