export type InfrastructureState =
  | 'OPERATIONAL'
  | 'DEGRADED'
  | 'BACKUP'
  | 'CRITICAL'
  | 'FAILED'
  | 'RECOVERING';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface Asset {
  id: string;
  type: string;
  name: string;
  osm_id?: string;
  location: LocationCoordinates;
  capacity?: number;
  load?: number;
  population_served?: number;
  backup_duration?: number;
  failure_threshold?: number;
  recovery_time?: number;
  status: InfrastructureState;
}

export interface Edge {
  id: string;
  from: string;
  to: string;
  type: string;
  capacity?: number;
  load?: number;
  dependency_strength?: number;
  failure_probability?: number;
  state: InfrastructureState;
}

export interface Network {
  schema_version?: string;
  nodes: Asset[];
  edges: Edge[];
}
