import type { InfrastructureState } from './asset';

export interface SimulationAssetStatus {
  state: InfrastructureState;
  load: number;
}

export interface SimulationState {
  scenario_id: string;
  time: number;
  assets: Record<string, SimulationAssetStatus>;
  failed_nodes: string[];
  degraded_nodes: string[];
  backup_nodes: string[];
  critical_nodes: string[];
  affected_edges: string[];
}

export type SimulationEventType =
  | 'asset_failed'
  | 'asset_degraded'
  | 'asset_backup'
  | 'asset_critical'
  | 'asset_recovering'
  | 'asset_recovered'
  | 'edge_failed'
  | 'capacity_exceeded'
  | 'dependency_lost';

export interface SimulationEvent {
  time: number;
  event: SimulationEventType | string;
  asset_id?: string;
  edge_id?: string;
  cause?: string;
}
