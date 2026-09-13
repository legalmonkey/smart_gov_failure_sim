import type { Network } from '../types/asset';
import type { Scenario } from '../types/scenario';
import type { SimulationEvent, SimulationAssetStatus } from '../types/simulation';
import type { ImpactResult, UncertaintyResult } from '../types/impact';
import type { CriticalityResult } from '../types/criticality';
import type { Intervention, InterventionRequest } from '../types/intervention';
import type { OptimizationResult } from '../types/optimization';
import type { AdvisorResult } from '../types/advisor';
import type { GeoJsonFeatureCollection } from '../geo/geojsonTypes';
import { simulationClient } from '../api/simulationClient';
import { PRESET_SCENARIOS } from '../infrastructure/scenariosData';

export type AppTabMode = 'explore' | 'failures' | 'interventions' | 'compare' | 'advisor';

export interface ApplicationState {
  network: Network | null;
  geoJson: GeoJsonFeatureCollection | null;
  selectedAssetId: string | null;
  hoveredAssetId: string | null;
  activeScenario: Scenario | null;
  scenariosList: Scenario[];
  simulationTime: number; // in simulation hours (0 - 24)
  isPlaying: boolean;
  playbackSpeed: number; // 1x, 2x, 3x
  assetStates: Record<string, SimulationAssetStatus>;
  failedNodes: string[];
  degradedNodes: string[];
  backupNodes: string[];
  criticalNodes: string[];
  affectedEdges: string[];
  events: SimulationEvent[];
  impact: ImpactResult | null;
  uncertainty: UncertaintyResult | null;
  criticality: CriticalityResult | null;
  optimization: OptimizationResult | null;
  advisor: AdvisorResult | null;
  interventionsCatalog: Intervention[];
  appliedInterventions: InterventionRequest[];
  budgetTotal: number;
  budgetSpent: number;
  showCriticality: boolean;
  activeTab: AppTabMode;
  hoverScreenPos: { x: number; y: number } | null;
  isSetBudgetOpen: boolean;
  isSummaryOpen: boolean;
  showOverviewPanel: boolean;
  showCascadePanel: boolean;
  showMapIndex: boolean;
  showSimulationBar: boolean;
}

type StateListener = (state: ApplicationState) => void;

class StateStore {
  private state: ApplicationState = {
    network: null,
    geoJson: null,
    selectedAssetId: null,
    hoveredAssetId: null,
    activeScenario: null,
    scenariosList: PRESET_SCENARIOS,
    simulationTime: 0,
    isPlaying: false,
    playbackSpeed: 1,
    assetStates: {},
    failedNodes: [],
    degradedNodes: [],
    backupNodes: [],
    criticalNodes: [],
    affectedEdges: [],
    events: [],
    impact: null,
    uncertainty: null,
    criticality: null,
    optimization: null,
    advisor: null,
    interventionsCatalog: [],
    appliedInterventions: [],
    budgetTotal: 2000000,
    budgetSpent: 0,
    showCriticality: true,
    activeTab: 'explore',
    hoverScreenPos: null,
    isSetBudgetOpen: false,
    isSummaryOpen: false,
    showOverviewPanel: true,
    showCascadePanel: true,
    showMapIndex: false,
    showSimulationBar: true,
  };

  private listeners: Set<StateListener> = new Set();
  private timerId: any = null;

  public getState(): ApplicationState {
    return this.state;
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.state));
  }

  public async initialize(): Promise<void> {
    try {
      const [network, geoJson, _events, _initState, _impact, _uncertainty, criticality, opt, adv, catalog] =
        await Promise.all([
          simulationClient.getNetwork(),
          simulationClient.getGeoJson(),
          simulationClient.getSimulationEvents(),
          simulationClient.getSimulationState(),
          simulationClient.getImpactResult('scenario_01'),
          simulationClient.getUncertaintyResult('scenario_01'),
          simulationClient.getCriticalityResult('scenario_01'),
          simulationClient.getOptimizationResult('scenario_01'),
          simulationClient.getAdvisorResult('scenario_01'),
          simulationClient.getInterventions(),
        ]);

      // Initialize all asset states to clean OPERATIONAL baseline from the network dataset
      const initialStates: Record<string, SimulationAssetStatus> = {};
      network.nodes.forEach((n) => {
        initialStates[n.id] = { state: 'OPERATIONAL', load: n.load ?? 0 };
      });

      this.state = {
        ...this.state,
        network,
        geoJson,
        selectedAssetId: null,
        showOverviewPanel: true,
        showCascadePanel: true,
        showSimulationBar: true,
        showCriticality: false,
        events: [], // Clean baseline: zero events until failure triggered or scenario loaded
        assetStates: initialStates,
        failedNodes: [],
        degradedNodes: [],
        backupNodes: [],
        criticalNodes: [],
        affectedEdges: [],
        simulationTime: 0,
        impact: null, // Strictly calculated dynamically from network graph
        uncertainty: null,
        criticality,
        optimization: opt,
        advisor: adv,
        interventionsCatalog: catalog,
        activeScenario: null, // No scenario pre-selected at launch
      };

      this.notify();
    } catch (err) {
      console.error('Failed to initialize application state:', err);
    }
  }

  public setSelectedAssetId(id: string | null): void {
    if (this.state.selectedAssetId !== id) {
      this.state = {
        ...this.state,
        selectedAssetId: id,
      };
      this.notify();
    }
  }

  public setHoveredAsset(id: string | null, pos?: { x: number; y: number } | null): void {
    if (this.state.hoveredAssetId !== id || (pos && this.state.hoverScreenPos !== pos)) {
      this.state = {
        ...this.state,
        hoveredAssetId: id,
        hoverScreenPos: pos !== undefined ? pos : (id ? this.state.hoverScreenPos : null),
      };
      this.notify();
    }
  }

  public setHoveredAssetId(id: string | null): void {
    this.setHoveredAsset(id);
  }

  public openSetBudgetModal(open: boolean): void {
    if (open) {
      this.state = {
        ...this.state,
        isSetBudgetOpen: true,
        showOverviewPanel: false,
        showCascadePanel: false,
        showMapIndex: false,
        activeTab: 'explore',
      };
    } else {
      this.state = { ...this.state, isSetBudgetOpen: false };
    }
    this.notify();
  }

  public openSummaryModal(open: boolean): void {
    if (open) {
      this.state = {
        ...this.state,
        isSummaryOpen: true,
        showOverviewPanel: false,
        showCascadePanel: false,
        showMapIndex: false,
        activeTab: 'explore',
      };
    } else {
      this.state = { ...this.state, isSummaryOpen: false };
    }
    this.notify();
  }

  public toggleOverviewPanel(show?: boolean): void {
    const next = show !== undefined ? show : !this.state.showOverviewPanel;
    this.state = {
      ...this.state,
      showOverviewPanel: next,
    };
    this.notify();
  }

  public toggleCascadePanel(show?: boolean): void {
    const next = show !== undefined ? show : !this.state.showCascadePanel;
    this.state = {
      ...this.state,
      showCascadePanel: next,
    };
    this.notify();
  }

  public toggleMapIndex(show?: boolean): void {
    const next = show !== undefined ? show : !this.state.showMapIndex;
    this.state = {
      ...this.state,
      showMapIndex: next,
    };
    this.notify();
  }

  public toggleSimulationBar(show?: boolean): void {
    const next = show !== undefined ? show : !this.state.showSimulationBar;
    this.state = { ...this.state, showSimulationBar: next };
    this.notify();
  }

  public setBudget(total: number): void {
    const clamped = Math.max(0, Math.round(total));
    this.state = {
      ...this.state,
      budgetTotal: clamped,
      isSetBudgetOpen: false,
      activeScenario: this.state.activeScenario
        ? { ...this.state.activeScenario, budget: clamped }
        : null,
    };
    this.notify();
  }

  public setActiveTab(tab: AppTabMode): void {
    const nextTab = (tab !== 'explore' && this.state.activeTab === tab) ? 'explore' : tab;
    if (nextTab !== 'explore') {
      this.state = {
        ...this.state,
        activeTab: nextTab,
        showOverviewPanel: false,
        showCascadePanel: false,
        showMapIndex: false,
        selectedAssetId: null,
      };
    } else {
      this.state = { ...this.state, activeTab: 'explore' };
    }
    this.notify();
  }

  public loadScenario(scenarioId: string): void {
    const scenario = this.state.scenariosList.find((s) => s.id === scenarioId);
    if (!scenario || !this.state.network) return;

    this.pause();
    this.state.budgetTotal = scenario.budget;
    this.state.budgetSpent = 0;
    this.state.appliedInterventions = [];
    this.state.activeScenario = { ...scenario };

    // Set initial failed nodes from scenario
    const initialStates: Record<string, SimulationAssetStatus> = {};
    this.state.network.nodes.forEach((n) => {
      initialStates[n.id] = { state: 'OPERATIONAL', load: n.load ?? 0 };
    });

    scenario.failures.forEach((fid) => {
      initialStates[fid] = { state: 'FAILED', load: 0 };
    });

    // Build timeline of cascading events for this scenario
    const newEvents: SimulationEvent[] = [];
    scenario.failures.forEach((fid) => {
      newEvents.push({
        time: 0,
        event: 'asset_failed',
        asset_id: fid,
        cause: `initial_shock:${scenario.name}`,
      });

      // Downstream dependency propagation
      const outgoing = this.state.network?.edges.filter((e) => e.from === fid) || [];
      outgoing.forEach((edge, idx) => {
        newEvents.push({
          time: Math.round((0.5 + 0.3 * idx) * 10) / 10,
          event: 'dependency_lost',
          edge_id: edge.id,
          cause: 'upstream_shock',
        });
        const target = this.state.network?.nodes.find((n) => n.id === edge.to);
        if (target && !scenario.failures.includes(target.id)) {
          if (target.backup_duration && target.backup_duration > 0) {
            newEvents.push({
              time: Math.round((1.0 + 0.4 * idx) * 10) / 10,
              event: 'asset_backup',
              asset_id: target.id,
              cause: 'main_power_lost',
            });
            newEvents.push({
              time: Math.round((1.0 + target.backup_duration) * 10) / 10,
              event: 'asset_critical',
              asset_id: target.id,
              cause: 'backup_reserve_depleted',
            });
            newEvents.push({
              time: Math.round((2.0 + target.backup_duration) * 10) / 10,
              event: 'asset_failed',
              asset_id: target.id,
              cause: 'reserve_exhausted_shutdown',
            });
          } else {
            newEvents.push({
              time: Math.round((0.8 + 0.3 * idx) * 10) / 10,
              event: 'asset_degraded',
              asset_id: target.id,
              cause: 'supply_compromised',
            });
          }
        }
      });
    });

    newEvents.sort((a, b) => a.time - b.time);

    // Compute dynamic scenario impact & uncertainty values based on scenario specifications
    const popAffected = scenario.populationAffected || scenario.failures.length * 12000;
    const hospDisrupted =
      scenario.hospitalDisruptions ??
      (scenario.failures.some((f) => f.includes('hospital') || f.includes('substation') || f.includes('power'))
        ? 1
        : 0);
    const emgDelay =
      scenario.emergencyDelayMinutes ??
      (scenario.failures.some((f) => f.includes('road') || f.includes('jvlr') || f.includes('bridge'))
        ? 18
        : 6);
    const dynamicImpactScore =
      scenario.impactScore ?? Math.min(0.95, Math.max(0.15, scenario.failures.length * 0.22));

    this.state = {
      ...this.state,
      activeScenario: scenario,
      events: newEvents,
      assetStates: initialStates,
      failedNodes: [...scenario.failures],
      degradedNodes: [],
      backupNodes: [],
      criticalNodes: [],
      affectedEdges: [],
      simulationTime: 0,
      impact: {
        scenario_id: scenario.id,
        duration_hours: scenario.duration || 24,
        impact_score: dynamicImpactScore,
        population_affected: popAffected,
        hospital_disruptions: hospDisrupted,
        school_disruptions: scenario.failures.filter((f) => f.includes('school')).length,
        emergency_response_delay_minutes: emgDelay,
        water_service_disruptions: scenario.failures.filter((f) => f.includes('water')).length,
        power_service_disruptions: scenario.failures.filter((f) => f.includes('power') || f.includes('substation')).length,
      },
      uncertainty: {
        scenario_id: scenario.id,
        iterations: 1000,
        population_affected: {
          mean: popAffected,
          median: popAffected,
          p05: Math.round(popAffected * 0.65),
          p95: Math.round(popAffected * 1.5),
        },
        hospital_failure_probability: hospDisrupted > 0 ? 0.65 : 0.05,
        hospital_failure_time_hours: {
          median: 4.5,
          p05: 2.1,
          p95: 7.8,
        },
      },
    };

    this.setSimulationTime(0);
    this.notify();
  }

  public createCustomScenario(
    name: string,
    description: string,
    failures: string[],
    budget: number
  ): Scenario {
    const id = `custom_${Date.now()}`;
    const newScenario: Scenario = {
      id,
      name,
      description,
      category: 'custom',
      failures,
      interventions: [],
      budget,
      duration: 24,
      impactScore: Math.min(0.95, Math.max(0.3, failures.length * 0.22)),
      populationAffected: Math.min(65000, failures.length * 15000),
      hospitalDisruptions: failures.some((f) => f.includes('hospital') || f.includes('substation')) ? 1 : 0,
      emergencyDelayMinutes: failures.some((f) => f.includes('road')) ? 24 : 12,
    };

    this.state = {
      ...this.state,
      scenariosList: [newScenario, ...this.state.scenariosList],
    };
    this.notify();
    return newScenario;
  }

  public saveCurrentAsScenario(name: string): Scenario {
    const currentBroken =
      this.state.failedNodes.length > 0
        ? [...this.state.failedNodes]
        : ['power_station_01', 'road_jvlr_01'];
    const currentBudget = this.state.budgetTotal;
    const desc = `User What-If scenario with ${currentBroken.length} initial failed assets and ₹${currentBudget.toLocaleString('en-IN')} budget.`;
    const sc = this.createCustomScenario(name, desc, currentBroken, currentBudget);
    this.loadScenario(sc.id);
    return sc;
  }

  public toggleCriticality(show?: boolean): void {
    this.state = {
      ...this.state,
      showCriticality: show !== undefined ? show : !this.state.showCriticality,
    };
    this.notify();
  }

  public setPlaybackSpeed(speed: number): void {
    this.state = { ...this.state, playbackSpeed: speed };
    this.notify();
  }

  public play(): void {
    if (this.state.isPlaying) return;
    this.state = { ...this.state, isPlaying: true };
    this.notify();

    if (this.timerId) clearInterval(this.timerId);
    this.timerId = setInterval(() => {
      const dt = 0.05 * this.state.playbackSpeed;
      const newTime = this.state.simulationTime + dt;
      if (newTime >= 24) {
        this.setSimulationTime(24);
        this.pause();
        this.openSummaryModal(true); // Auto-show Sims advisor summary when simulation concludes
      } else {
        this.setSimulationTime(newTime);
      }
    }, 100);
  }

  public pause(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.state = { ...this.state, isPlaying: false };
    this.notify();
  }

  public stepForward(hours: number = 0.5): void {
    this.pause();
    const newTime = Math.min(24, this.state.simulationTime + hours);
    this.setSimulationTime(newTime);
    if (newTime >= 24) {
      this.openSummaryModal(true);
    }
  }

  public resetSimulation(): void {
    this.pause();
    this.setSimulationTime(0);
  }

  public resetToNominal(): void {
    this.pause();
    const nominalStates: Record<string, SimulationAssetStatus> = {};
    if (this.state.network) {
      this.state.network.nodes.forEach((n) => {
        nominalStates[n.id] = { state: 'OPERATIONAL', load: n.load ?? 0 };
      });
    }

    this.state = {
      ...this.state,
      activeScenario: null,
      events: [],
      assetStates: nominalStates,
      failedNodes: [],
      degradedNodes: [],
      backupNodes: [],
      criticalNodes: [],
      affectedEdges: [],
      simulationTime: 0,
      impact: null,
      uncertainty: null,
      appliedInterventions: [],
      budgetSpent: 0,
    };
    this.notify();
  }

  public setSimulationTime(time: number): void {
    const clampedTime = Math.max(0, Math.min(24, time));
    if (!this.state.network) return;

    // Evaluate state at current simulation time based on ordered events
    const newStates: Record<string, SimulationAssetStatus> = {};
    this.state.network.nodes.forEach((n) => {
      newStates[n.id] = { state: 'OPERATIONAL', load: n.load ?? 0 };
    });

    const failedNodes = new Set<string>();
    const degradedNodes = new Set<string>();
    const backupNodes = new Set<string>();
    const criticalNodes = new Set<string>();
    const affectedEdges = new Set<string>();

    for (const ev of this.state.events) {
      if (ev.time > clampedTime) break;

      if (ev.asset_id) {
        if (ev.event === 'asset_failed') {
          newStates[ev.asset_id] = { state: 'FAILED', load: 0 };
          failedNodes.add(ev.asset_id);
          degradedNodes.delete(ev.asset_id);
          backupNodes.delete(ev.asset_id);
          criticalNodes.delete(ev.asset_id);
        } else if (ev.event === 'asset_backup') {
          newStates[ev.asset_id] = {
            state: 'BACKUP',
            load: (this.state.network.nodes.find((n) => n.id === ev.asset_id)?.load ?? 70) + 6,
          };
          backupNodes.add(ev.asset_id);
          degradedNodes.delete(ev.asset_id);
          criticalNodes.delete(ev.asset_id);
        } else if (ev.event === 'asset_degraded') {
          newStates[ev.asset_id] = {
            state: 'DEGRADED',
            load: Math.floor((this.state.network.nodes.find((n) => n.id === ev.asset_id)?.load ?? 50) * 0.6),
          };
          degradedNodes.add(ev.asset_id);
        } else if (ev.event === 'asset_critical') {
          newStates[ev.asset_id] = {
            state: 'CRITICAL',
            load: (this.state.network.nodes.find((n) => n.id === ev.asset_id)?.load ?? 800) * 1.3,
          };
          criticalNodes.add(ev.asset_id);
        } else if (ev.event === 'asset_recovering') {
          newStates[ev.asset_id] = { state: 'RECOVERING', load: 300 };
          failedNodes.delete(ev.asset_id);
        } else if (ev.event === 'asset_recovered') {
          newStates[ev.asset_id] = {
            state: 'OPERATIONAL',
            load: this.state.network.nodes.find((n) => n.id === ev.asset_id)?.load ?? 1000,
          };
          failedNodes.delete(ev.asset_id);
          degradedNodes.delete(ev.asset_id);
        }
      }

      if (ev.edge_id) {
        if (ev.event === 'edge_failed' || ev.event === 'dependency_lost') {
          affectedEdges.add(ev.edge_id);
        }
      }
    }

    this.state = {
      ...this.state,
      simulationTime: clampedTime,
      assetStates: newStates,
      failedNodes: Array.from(failedNodes),
      degradedNodes: Array.from(degradedNodes),
      backupNodes: Array.from(backupNodes),
      criticalNodes: Array.from(criticalNodes),
      affectedEdges: Array.from(affectedEdges),
    };

    this.notify();
  }

  public triggerManualFailure(assetId: string): void {
    const currentTime = this.state.simulationTime;
    const failureEvent: SimulationEvent = {
      time: Math.round(currentTime * 10) / 10,
      event: 'asset_failed',
      asset_id: assetId,
      cause: 'user_initiated_break',
    };

    // Cascade to immediate downstream dependencies
    const downstreamEvents: SimulationEvent[] = [];
    if (this.state.network) {
      const outgoingEdges = this.state.network.edges.filter((e) => e.from === assetId);
      outgoingEdges.forEach((edge, idx) => {
        downstreamEvents.push({
          time: Math.round((currentTime + 0.1 * (idx + 1)) * 10) / 10,
          event: 'dependency_lost',
          edge_id: edge.id,
          cause: 'upstream_asset_break',
        });
        const targetNode = this.state.network?.nodes.find((n) => n.id === edge.to);
        if (targetNode) {
          if (targetNode.backup_duration && targetNode.backup_duration > 0) {
            downstreamEvents.push({
              time: Math.round((currentTime + 0.2 * (idx + 1)) * 10) / 10,
              event: 'asset_backup',
              asset_id: targetNode.id,
              cause: 'main_feed_loss',
            });
          } else {
            downstreamEvents.push({
              time: Math.round((currentTime + 0.2 * (idx + 1)) * 10) / 10,
              event: 'asset_degraded',
              asset_id: targetNode.id,
              cause: 'upstream_feed_loss',
            });
          }
        }
      });
    }

    const updatedEvents = [...this.state.events, failureEvent, ...downstreamEvents].sort(
      (a, b) => a.time - b.time
    );

    this.state = {
      ...this.state,
      events: updatedEvents,
    };
    this.setSimulationTime(currentTime);
  }

  public repairAsset(assetId: string): void {
    const updatedEvents = this.state.events.filter(
      (ev) => !(ev.asset_id === assetId && (ev.event === 'asset_failed' || ev.event === 'asset_degraded'))
    );
    this.state = {
      ...this.state,
      events: updatedEvents,
    };
    this.setSimulationTime(this.state.simulationTime);
  }

  public applyIntervention(interventionId: string, targetAssetId: string): boolean {
    const item = this.state.interventionsCatalog.find((i) => i.id === interventionId);
    if (!item) return false;

    if (this.state.budgetSpent + item.cost > this.state.budgetTotal) {
      return false; // Exceeds budget
    }

    const req: InterventionRequest = {
      scenario_id: this.state.activeScenario?.id || 'scenario_01',
      intervention_id: interventionId,
      target_asset_id: targetAssetId,
    };

    this.state = {
      ...this.state,
      appliedInterventions: [...this.state.appliedInterventions, req],
      budgetSpent: this.state.budgetSpent + item.cost,
    };

    simulationClient.applyIntervention(req);
    this.notify();
    return true;
  }
}

export const appState = new StateStore();
