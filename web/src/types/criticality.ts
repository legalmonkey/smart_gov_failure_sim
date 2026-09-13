export interface NodeCriticality {
  asset_id: string;
  criticality_score: number;
  baseline_impact: number;
  removal_impact: number;
}

export interface EdgeCriticality {
  edge_id: string;
  criticality_score: number;
  baseline_impact: number;
  removal_impact: number;
}

export interface CriticalityResult {
  scenario_id: string;
  nodes: NodeCriticality[];
  edges: EdgeCriticality[];
}
