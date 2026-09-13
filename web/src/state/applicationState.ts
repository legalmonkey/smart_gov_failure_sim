import type { Network, InfrastructureState } from '../types/asset';
import type { Scenario } from '../types/scenario';
import type { SimulationEvent, SimulationAssetStatus } from '../types/simulation';
import type { ImpactResult, UncertaintyResult } from '../types/impact';
import type { CriticalityResult } from '../types/criticality';
import type { Intervention, InterventionRequest } from '../types/intervention';
import type { OptimizationResult, SelectedIntervention } from '../types/optimization';
import type { AdvisorResult } from '../types/advisor';
import type { GeoJsonFeatureCollection } from '../geo/geojsonTypes';
import type { HazardDefinition, DisasterScenario, HazardPreviewSummary } from '../types/hazard';
import { calculateAssetExposure, calculateHazardPreview } from '../hazards/hazardEngine';
import { simulationClient } from '../api/simulationClient';
import { PRESET_SCENARIOS } from '../infrastructure/scenariosData';
import { ImpactEngine, type SimStateInput } from '../impact/impactEngine';
import { CriticalityEngine } from '../criticality/criticalityEngine';
import { OptimizerEngine } from '../optimization/optimizerEngine';
import { AdvisorEngine } from '../advisor/advisorEngine';
import { CascadeEngine } from '../simulation/cascadeEngine';

export type AppTabMode = 'explore' | 'failures' | 'interventions' | 'compare' | 'advisor';

export interface ApplicationState {
  network: Network | null;
  geoJson: GeoJsonFeatureCollection | null;
  selectedAssetId: string | null;
  hoveredAssetId: string | null;
  activeScenario: Scenario | null;
  activeHazard: HazardDefinition | null;
  activeDisasterScenario: DisasterScenario | null;
  hazardPreview: HazardPreviewSummary | null;
  hazardOverlayVisible: boolean;
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
  showMapControls: boolean;
}

type StateListener = (state: ApplicationState) => void;

class StateStore {
  private state: ApplicationState = {
    network: null,
    geoJson: null,
    selectedAssetId: null,
    hoveredAssetId: null,
    activeScenario: null,
    activeHazard: null,
    activeDisasterScenario: null,
    hazardPreview: null,
    hazardOverlayVisible: true,
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
    showOverviewPanel: false,
    showCascadePanel: false,
    showMapIndex: false,
    showSimulationBar: true,
    showMapControls: true,
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
      const [network, geoJson, _events, _initState, _impact, _uncertainty, _criticality, opt, adv, catalog] =
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

      // Dynamically compute baseline impact metrics for all preset scenarios using Track 3
      const dynamicallyCalculatedPresets = PRESET_SCENARIOS.map((sc) => {
        const dummyStates: Record<string, SimulationAssetStatus> = {};
        network.nodes.forEach((n) => {
          dummyStates[n.id] = { state: sc.failures.includes(n.id) ? 'FAILED' : 'OPERATIONAL', load: n.load ?? 0 };
        });
        const simInput: SimStateInput = {
          scenario_id: sc.id,
          time: 0,
          assets: dummyStates,
          failed_nodes: [...sc.failures],
          degraded_nodes: [],
          backup_nodes: [],
          critical_nodes: [],
          affected_edges: [],
        };
        const calc = ImpactEngine.calculateHumanImpact(simInput, network, sc.id, sc.duration || 24);
        return {
          ...sc,
          impactScore: calc.impact_score,
          populationAffected: calc.population_affected,
          hospitalDisruptions: calc.hospital_disruptions,
          emergencyDelayMinutes: calc.emergency_response_delay_minutes,
        };
      });

      // Dynamically compute baseline systemic criticality using Track 4 graph removal-impact simulation
      const dynamicCriticality = CriticalityEngine.calculateCriticality(network, 'scenario_01');

      this.state = {
        ...this.state,
        network,
        geoJson,
        selectedAssetId: null,
        showOverviewPanel: false,
        showCascadePanel: false,
        showMapIndex: false,
        showSimulationBar: true,
        showMapControls: true,
        showCriticality: true,
        hazardOverlayVisible: true,
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
        criticality: dynamicCriticality,
        optimization: opt,
        advisor: adv,
        interventionsCatalog: catalog,
        activeScenario: null, // No scenario pre-selected at launch
        scenariosList: dynamicallyCalculatedPresets,
      };

      this.recalculateOptimizationAndAdvice();
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

  public toggleMapControls(show?: boolean): void {
    const next = show !== undefined ? show : !this.state.showMapControls;
    this.state = { ...this.state, showMapControls: next };
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
    this.recalculateOptimizationAndAdvice();
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

    // Dynamically generate cascading failure timeline based on graph dependencies & interventions
    const dynamicEvents = CascadeEngine.generateCascadeEvents(
      this.state.network,
      scenario.failures,
      this.state.appliedInterventions,
      this.state.interventionsCatalog,
      scenario.duration || 24
    );

    // Track 3 integration: Compute real human impact & Monte Carlo uncertainty
    const simInput: SimStateInput = {
      scenario_id: scenario.id,
      time: 0,
      assets: initialStates,
      failed_nodes: [...scenario.failures],
      degraded_nodes: [],
      backup_nodes: [],
      critical_nodes: [],
      affected_edges: [],
    };

    const dynamicImpact = ImpactEngine.calculateHumanImpact(
      simInput,
      this.state.network,
      scenario.id,
      scenario.duration || 6.1
    );

    const dynamicUncertainty = ImpactEngine.runMonteCarlo(
      simInput,
      this.state.network,
      scenario.id,
      500,
      42
    );

    const dynamicCriticality = this.state.network
      ? CriticalityEngine.calculateCriticality(this.state.network, scenario.id, simInput)
      : this.state.criticality;

    this.state = {
      ...this.state,
      activeScenario: scenario,
      events: dynamicEvents,
      assetStates: initialStates,
      failedNodes: [...scenario.failures],
      degradedNodes: [],
      backupNodes: [],
      criticalNodes: [],
      affectedEdges: [],
      simulationTime: 0,
      impact: dynamicImpact,
      uncertainty: dynamicUncertainty,
      criticality: dynamicCriticality,
      showSimulationBar: true,
      selectedAssetId: scenario.failures.length > 0 ? scenario.failures[0] : null,
      activeTab: 'explore',
    };

    this.setSimulationTime(0);
    this.notify();
  }

  public setHazardOverlayVisible(visible: boolean): void {
    this.state = {
      ...this.state,
      hazardOverlayVisible: visible,
    };
    this.notify();
  }

  public previewHazard(hazard: HazardDefinition): HazardPreviewSummary | null {
    if (!this.state.network) return null;
    const summary = calculateHazardPreview(hazard, this.state.network);
    this.state = {
      ...this.state,
      activeHazard: hazard,
      hazardPreview: summary,
      hazardOverlayVisible: true,
    };
    this.notify();
    return summary;
  }

  public loadDisasterScenario(disaster: DisasterScenario): void {
    if (!this.state.network) return;

    const hazard = disaster.hazards[0];
    const failedNodes: string[] = [];
    const degradedNodes: string[] = [];
    const backupNodes: string[] = [];
    const criticalNodes: string[] = [];
    const initialStates: Record<string, SimulationAssetStatus> = {};

    this.state.network.nodes.forEach((n) => {
      const exp = calculateAssetExposure(n, hazard, this.state.network!);
      let stateStr: InfrastructureState = 'OPERATIONAL';
      if (exp.expected_effect === 'failed') {
        failedNodes.push(n.id);
        stateStr = 'FAILED';
      } else if (exp.expected_effect === 'critical') {
        criticalNodes.push(n.id);
        stateStr = 'CRITICAL';
      } else if (exp.expected_effect === 'backup') {
        backupNodes.push(n.id);
        stateStr = 'BACKUP';
      } else if (exp.expected_effect === 'degraded') {
        degradedNodes.push(n.id);
        stateStr = 'DEGRADED';
      }
      initialStates[n.id] = {
        state: stateStr,
        load: n.load ?? 0,
      };
    });

    const initialFailures =
      failedNodes.length > 0
        ? failedNodes
        : criticalNodes.length > 0
        ? criticalNodes
        : degradedNodes.length > 0
        ? [degradedNodes[0]]
        : [];

    const dynamicEvents = CascadeEngine.generateCascadeEvents(
      this.state.network,
      initialFailures,
      this.state.appliedInterventions,
      this.state.interventionsCatalog,
      disaster.duration_hours || 6
    );

    const simInput: SimStateInput = {
      scenario_id: disaster.id,
      time: 0,
      assets: initialStates,
      failed_nodes: [...failedNodes],
      degraded_nodes: [...degradedNodes],
      backup_nodes: [...backupNodes],
      critical_nodes: [...criticalNodes],
      affected_edges: [],
    };

    const dynamicImpact = ImpactEngine.calculateHumanImpact(
      simInput,
      this.state.network,
      disaster.id,
      disaster.duration_hours || 6
    );

    const dynamicUncertainty = ImpactEngine.runMonteCarlo(
      simInput,
      this.state.network,
      disaster.id,
      500,
      disaster.random_seed || 42
    );

    const dynamicCriticality = CriticalityEngine.calculateCriticality(
      this.state.network,
      disaster.id,
      simInput
    );

    const preview = calculateHazardPreview(hazard, this.state.network);

    const scenarioWrapper: Scenario = {
      id: disaster.id,
      name: disaster.name,
      description: disaster.description,
      category:
        hazard.hazard_type === 'URBAN_FLOOD' || hazard.hazard_type === 'EXTREME_RAINFALL'
          ? 'flood'
          : 'custom',
      failures: initialFailures,
      interventions: [],
      budget: disaster.budget || 2000000,
      duration: disaster.duration_hours || 6,
      random_seed: disaster.random_seed || 42,
      impactScore: dynamicImpact.impact_score,
      populationAffected: dynamicImpact.population_affected,
      hospitalDisruptions: dynamicImpact.hospital_disruptions,
      emergencyDelayMinutes: dynamicImpact.emergency_response_delay_minutes,
    };

    this.state = {
      ...this.state,
      activeHazard: hazard,
      activeDisasterScenario: disaster,
      hazardPreview: preview,
      hazardOverlayVisible: true,
      activeScenario: scenarioWrapper,
      events: dynamicEvents,
      assetStates: initialStates,
      failedNodes: [...failedNodes],
      degradedNodes: [...degradedNodes],
      backupNodes: [...backupNodes],
      criticalNodes: [...criticalNodes],
      affectedEdges: [],
      simulationTime: 0,
      impact: dynamicImpact,
      uncertainty: dynamicUncertainty,
      criticality: dynamicCriticality,
      showSimulationBar: true,
      selectedAssetId: initialFailures.length > 0 ? initialFailures[0] : null,
      activeTab: 'explore',
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

    const initialStates: Record<string, SimulationAssetStatus> = {};
    if (this.state.network) {
      this.state.network.nodes.forEach((n) => {
        initialStates[n.id] = {
          state: failures.includes(n.id) ? 'FAILED' : 'OPERATIONAL',
          load: n.load ?? 0,
        };
      });
    }

    const simInput: SimStateInput = {
      scenario_id: id,
      time: 0,
      assets: initialStates,
      failed_nodes: [...failures],
      degraded_nodes: [],
      backup_nodes: [],
      critical_nodes: [],
      affected_edges: [],
    };

    const realImpact = ImpactEngine.calculateHumanImpact(
      simInput,
      this.state.network,
      id,
      24
    );

    const newScenario: Scenario = {
      id,
      name,
      description,
      category: 'custom',
      failures,
      interventions: [],
      budget,
      duration: 24,
      impactScore: realImpact.impact_score,
      populationAffected: realImpact.population_affected,
      hospitalDisruptions: realImpact.hospital_disruptions,
      emergencyDelayMinutes: realImpact.emergency_response_delay_minutes,
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

    const dynamicCriticality = this.state.network
      ? CriticalityEngine.calculateCriticality(this.state.network, 'scenario_01')
      : null;

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
      criticality: dynamicCriticality,
      appliedInterventions: [],
      budgetSpent: 0,
    };
    this.recalculateOptimizationAndAdvice();
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

    const failedArr = Array.from(failedNodes);
    const degradedArr = Array.from(degradedNodes);
    const backupArr = Array.from(backupNodes);
    const criticalArr = Array.from(criticalNodes);
    const affectedEdgesArr = Array.from(affectedEdges);

    const hasStateChanged =
      failedArr.length !== this.state.failedNodes.length ||
      degradedArr.length !== this.state.degradedNodes.length ||
      backupArr.length !== this.state.backupNodes.length ||
      criticalArr.length !== this.state.criticalNodes.length ||
      affectedEdgesArr.length !== this.state.affectedEdges.length ||
      failedArr.some((id) => !this.state.failedNodes.includes(id)) ||
      degradedArr.some((id) => !this.state.degradedNodes.includes(id)) ||
      backupArr.some((id) => !this.state.backupNodes.includes(id));

    // Fast-path: When time advances but no new failures/degradations occurred, advance time smoothly with zero lag
    if (!hasStateChanged && this.state.impact !== null) {
      this.state = {
        ...this.state,
        simulationTime: clampedTime,
      };
      this.notify();
      return;
    }

    const hasActiveFailures = failedArr.length > 0 || degradedArr.length > 0 || backupArr.length > 0 || criticalArr.length > 0;

    let dynamicImpact: ImpactResult | null = this.state.impact;
    let dynamicUncertainty: UncertaintyResult | null = this.state.uncertainty;

    const simInput: SimStateInput = {
      scenario_id: this.state.activeScenario?.id ?? 'live_simulation',
      time: clampedTime,
      assets: newStates,
      failed_nodes: failedArr,
      degraded_nodes: degradedArr,
      backup_nodes: backupArr,
      critical_nodes: criticalArr,
      affected_edges: affectedEdgesArr,
    };

    if (hasActiveFailures || clampedTime > 0) {
      dynamicImpact = ImpactEngine.calculateHumanImpact(
        simInput,
        this.state.network,
        this.state.activeScenario?.id ?? 'live_simulation',
        clampedTime > 0 ? clampedTime : (this.state.activeScenario?.duration ?? 6.1)
      );

      dynamicUncertainty = ImpactEngine.runMonteCarlo(
        simInput,
        this.state.network,
        this.state.activeScenario?.id ?? 'live_simulation',
        500,
        42
      );
    }

    const dynamicCriticality = this.state.network
      ? CriticalityEngine.calculateCriticality(
          this.state.network,
          this.state.activeScenario?.id ?? 'live_simulation',
          simInput
        )
      : this.state.criticality;

    this.state = {
      ...this.state,
      simulationTime: clampedTime,
      assetStates: newStates,
      failedNodes: failedArr,
      degradedNodes: degradedArr,
      backupNodes: backupArr,
      criticalNodes: criticalArr,
      affectedEdges: affectedEdgesArr,
      impact: dynamicImpact,
      uncertainty: dynamicUncertainty,
      criticality: dynamicCriticality,
    };

    this.recalculateOptimizationAndAdvice();
    this.notify();
  }

  private syncDynamicEvents(): void {
    if (!this.state.network) return;
    const initialBroken = this.state.activeScenario
      ? this.state.activeScenario.failures
      : this.state.failedNodes;
    if (initialBroken.length > 0) {
      this.state.events = CascadeEngine.generateCascadeEvents(
        this.state.network,
        initialBroken,
        this.state.appliedInterventions,
        this.state.interventionsCatalog,
        this.state.activeScenario?.duration || 24
      );
    }
  }

  public triggerManualFailure(assetId: string): void {
    if (!this.state.network) return;
    const currentBroken = Array.from(new Set([...this.state.failedNodes, assetId]));
    const dynamicEvents = CascadeEngine.generateCascadeEvents(
      this.state.network,
      currentBroken,
      this.state.appliedInterventions,
      this.state.interventionsCatalog,
      24
    );

    this.state = {
      ...this.state,
      events: dynamicEvents,
      showSimulationBar: true,
    };
    this.setSimulationTime(this.state.simulationTime);
  }

  public repairAsset(assetId: string): void {
    if (!this.state.network) return;
    const remainingBroken = this.state.failedNodes.filter((id) => id !== assetId);
    const dynamicEvents = CascadeEngine.generateCascadeEvents(
      this.state.network,
      remainingBroken,
      this.state.appliedInterventions,
      this.state.interventionsCatalog,
      24
    );
    this.state = {
      ...this.state,
      events: dynamicEvents,
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

    this.syncDynamicEvents();
    simulationClient.applyIntervention(req);
    this.recalculateOptimizationAndAdvice();
    this.notify();
    return true;
  }

  public removeIntervention(index: number): void {
    if (index < 0 || index >= this.state.appliedInterventions.length) return;
    const removed = this.state.appliedInterventions[index];
    const catItem = this.state.interventionsCatalog.find((i) => i.id === removed.intervention_id);
    const cost = catItem ? catItem.cost : 0;
    const updated = [...this.state.appliedInterventions];
    updated.splice(index, 1);
    this.state = {
      ...this.state,
      appliedInterventions: updated,
      budgetSpent: Math.max(0, this.state.budgetSpent - cost),
    };
    this.syncDynamicEvents();
    this.recalculateOptimizationAndAdvice();
    this.notify();
  }

  public clearInterventions(): void {
    this.state = {
      ...this.state,
      appliedInterventions: [],
      budgetSpent: 0,
    };
    this.syncDynamicEvents();
    this.recalculateOptimizationAndAdvice();
    this.notify();
  }

  public recalculateOptimizationAndAdvice(): void {
    if (!this.state.network || !this.state.interventionsCatalog || this.state.interventionsCatalog.length === 0) return;

    const currentScenarioId = this.state.activeScenario?.id || 'scenario_01';

    const baseSimInput: SimStateInput = {
      scenario_id: currentScenarioId,
      time: this.state.simulationTime,
      assets: this.state.assetStates,
      failed_nodes: this.state.failedNodes,
      degraded_nodes: this.state.degradedNodes,
      backup_nodes: this.state.backupNodes,
      critical_nodes: this.state.criticalNodes,
      affected_edges: this.state.affectedEdges,
    };

    const selected: SelectedIntervention[] = this.state.appliedInterventions.map((app) => {
      const item = this.state.interventionsCatalog.find((i) => i.id === app.intervention_id);
      return {
        intervention_id: app.intervention_id,
        target_asset_id: app.target_asset_id,
        cost: item?.cost || 0,
      };
    });

    const userPlan = OptimizerEngine.evaluateUserPlan(
      this.state.network,
      baseSimInput,
      this.state.budgetTotal,
      selected,
      this.state.interventionsCatalog,
      currentScenarioId
    );

    const optimalPlan = OptimizerEngine.optimizeBudget(
      this.state.network,
      baseSimInput,
      this.state.budgetTotal,
      this.state.interventionsCatalog,
      currentScenarioId
    );

    const advisor = AdvisorEngine.generateAdvice(
      userPlan,
      optimalPlan,
      this.state.criticality,
      this.state.network
    );

    this.state = {
      ...this.state,
      optimization: optimalPlan,
      advisor,
    };
  }
}

export const appState = new StateStore();
