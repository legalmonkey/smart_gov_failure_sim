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

export interface NodeAttributes {
  capacity?: number;
  load?: number;
  population_served?: number;
  backup_duration_hours?: number;
  failure_threshold?: number;
  recovery_time_hours?: number;
}

export interface EdgeAttributes {
  capacity?: number;
  load?: number;
  dependency_strength?: number;
  failure_probability?: number;
}

export interface Asset {
  id: string;
  type: string;
  name: string;
  osm_id?: string;
  osm_refs?: string[];
  location: LocationCoordinates;
  capacity?: number;
  load?: number;
  population_served?: number;
  backup_duration?: number;
  failure_threshold?: number;
  recovery_time?: number;
  status: InfrastructureState;
  attributes?: NodeAttributes;
  data_status?: string;
}

export interface Edge {
  id: string;
  from: string;
  to: string;
  type: string;
  directed?: boolean;
  capacity?: number;
  load?: number;
  dependency_strength?: number;
  failure_probability?: number;
  state: InfrastructureState;
  attributes?: EdgeAttributes;
  data_status?: string;
}

export interface Network {
  schema_version?: string;
  network_id?: string;
  name?: string;
  coordinate_reference_system?: string;
  nodes: Asset[];
  edges: Edge[];
}
