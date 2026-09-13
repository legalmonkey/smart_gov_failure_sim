import type { Asset, Network } from '../types/asset';
import type { Scenario } from '../types/scenario';
import type { SimulationEvent, SimulationState } from '../types/simulation';
import type { ImpactResult, UncertaintyResult } from '../types/impact';
import type { CriticalityResult } from '../types/criticality';
import type { Intervention, InterventionRequest } from '../types/intervention';
import type { OptimizationResult } from '../types/optimization';
import type { AdvisorResult } from '../types/advisor';
import type { GeoJsonFeatureCollection } from '../geo/geojsonTypes';
import { CriticalityEngine } from '../criticality/criticalityEngine';

/**
 * Section 4.18 Frontend Client Interface Boundary.
 * Implemented against local mock fixtures, structured so it can be swapped
 * later for real REST / WebSocket calls without touching rendering code.
 */
export interface SimulationClient {
  getNetwork(): Promise<Network>;
  getAsset(assetId: string): Promise<Asset>;
  createScenario(scenario: Scenario): Promise<Scenario>;
  startSimulation(scenarioId: string): Promise<void>;
  pauseSimulation(): Promise<void>;
  resetSimulation(): Promise<void>;
  getSimulationState(): Promise<SimulationState>;
  getSimulationEvents(): Promise<SimulationEvent[]>;
  getImpactResult(scenarioId: string): Promise<ImpactResult>;
  getUncertaintyResult(scenarioId: string): Promise<UncertaintyResult>;
  getCriticalityResult(scenarioId: string): Promise<CriticalityResult>;
  getOptimizationResult(scenarioId: string): Promise<OptimizationResult>;
  getAdvisorResult(scenarioId: string): Promise<AdvisorResult>;
  getInterventions(): Promise<Intervention[]>;
  applyIntervention(request: InterventionRequest): Promise<void>;
  getGeoJson(): Promise<GeoJsonFeatureCollection>;
}

export class MockSimulationClient implements SimulationClient {
  private basePath: string = '/fixtures';
  private cachedNetwork: Network | null = null;
  private cachedGeoJson: GeoJsonFeatureCollection | null = null;
  private cachedEvents: SimulationEvent[] | null = null;
  private cachedState: SimulationState | null = null;
  private appliedInterventions: InterventionRequest[] = [];

  private async fetchJson<T>(filename: string): Promise<T> {
    const res = await fetch(`${this.basePath}/${filename}`);
    if (!res.ok) {
      throw new Error(`Failed to load fixture ${filename}: ${res.statusText}`);
    }
    return (await res.json()) as T;
  }

  public async getNetwork(): Promise<Network> {
    if (!this.cachedNetwork) {
      const net = await this.fetchJson<Network>('mock-network.json');
      net.nodes.forEach((node) => {
        if (node.attributes) {
          node.capacity = node.capacity ?? node.attributes.capacity;
          node.load = node.load ?? node.attributes.load;
          node.population_served = node.population_served ?? node.attributes.population_served;
          node.backup_duration = node.backup_duration ?? node.attributes.backup_duration_hours;
          node.failure_threshold = node.failure_threshold ?? node.attributes.failure_threshold;
          node.recovery_time = node.recovery_time ?? node.attributes.recovery_time_hours;
        }
      });
      net.edges.forEach((edge) => {
        if (edge.attributes) {
          edge.capacity = edge.capacity ?? edge.attributes.capacity;
          edge.load = edge.load ?? edge.attributes.load;
          edge.dependency_strength = edge.dependency_strength ?? edge.attributes.dependency_strength;
          edge.failure_probability = edge.failure_probability ?? edge.attributes.failure_probability;
        }
      });
      this.cachedNetwork = net;
    }
    return JSON.parse(JSON.stringify(this.cachedNetwork));
  }

  public async getAsset(assetId: string): Promise<Asset> {
    const net = await this.getNetwork();
    const asset = net.nodes.find((n) => n.id === assetId);
    if (!asset) {
      throw new Error(`Asset not found: ${assetId}`);
    }
    return asset;
  }

  public async getGeoJson(): Promise<GeoJsonFeatureCollection> {
    if (!this.cachedGeoJson) {
      this.cachedGeoJson = await this.fetchJson<GeoJsonFeatureCollection>('mock-osm.geojson');
    }
    return this.cachedGeoJson;
  }

  public async createScenario(scenario: Scenario): Promise<Scenario> {
    return scenario;
  }

  public async startSimulation(_scenarioId: string): Promise<void> {
    // Live simulation is stepped or run via timeline
  }

  public async pauseSimulation(): Promise<void> {}

  public async resetSimulation(): Promise<void> {
    this.appliedInterventions = [];
  }

  public async getSimulationState(): Promise<SimulationState> {
    if (!this.cachedState) {
      this.cachedState = await this.fetchJson<SimulationState>('mock-simulation-state.json');
    }
    return JSON.parse(JSON.stringify(this.cachedState));
  }

  public async getSimulationEvents(): Promise<SimulationEvent[]> {
    if (!this.cachedEvents) {
      this.cachedEvents = await this.fetchJson<SimulationEvent[]>('mock-simulation-events.json');
    }
    return JSON.parse(JSON.stringify(this.cachedEvents));
  }

  public async getImpactResult(_scenarioId: string): Promise<ImpactResult> {
    return await this.fetchJson<ImpactResult>('mock-impact-result.json');
  }

  public async getUncertaintyResult(_scenarioId: string): Promise<UncertaintyResult> {
    return await this.fetchJson<UncertaintyResult>('mock-uncertainty-result.json');
  }

  public async getCriticalityResult(scenarioId: string): Promise<CriticalityResult> {
    if (this.cachedNetwork) {
      return CriticalityEngine.calculateCriticality(this.cachedNetwork, scenarioId);
    }
    return await this.fetchJson<CriticalityResult>('mock-criticality-result.json');
  }

  public async getOptimizationResult(_scenarioId: string): Promise<OptimizationResult> {
    return await this.fetchJson<OptimizationResult>('mock-optimization-result.json');
  }

  public async getAdvisorResult(_scenarioId: string): Promise<AdvisorResult> {
    return await this.fetchJson<AdvisorResult>('mock-advisor-result.json');
  }

  public async getInterventions(): Promise<Intervention[]> {
    return await this.fetchJson<Intervention[]>('mock-interventions.json');
  }

  public async applyIntervention(request: InterventionRequest): Promise<void> {
    this.appliedInterventions.push(request);
  }

  public getAppliedInterventions(): InterventionRequest[] {
    return [...this.appliedInterventions];
  }
}

export const simulationClient = new MockSimulationClient();
