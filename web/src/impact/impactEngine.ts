import type { ImpactResult, UncertaintyResult } from '../types/impact';
import type { Network, Asset } from '../types/asset';

export interface SimStateInput {
  scenario_id?: string;
  time: number;
  assets?: Record<string, { state: string; load?: number }>;
  failed_nodes: string[];
  degraded_nodes: string[];
  backup_nodes: string[];
  critical_nodes: string[];
  affected_edges: string[];
}

/**
 * Track 3 — Human Impact & Uncertainty Engine (Client-Side Engine for Track 5).
 * Mirrors impact/ Python algorithms with identical normalization,
 * vulnerability multipliers, detour penalties, and Monte Carlo sampling.
 */
export class ImpactEngine {
  public static readonly STUDY_AREA_POPULATION = 120000;

  // Normalized weight constants (Section 3.3, sum = 1.0)
  public static readonly WEIGHT_POPULATION = 0.30;
  public static readonly WEIGHT_DURATION = 0.20;
  public static readonly WEIGHT_VULNERABILITY = 0.20;
  public static readonly WEIGHT_RESPONSE_DELAY = 0.15;
  public static readonly WEIGHT_CRITICAL_SERVICES = 0.15;

  private static getNodeStatus(nodeId: string, sim: SimStateInput): string {
    if (sim.assets && sim.assets[nodeId]) {
      return sim.assets[nodeId].state;
    }
    if (sim.failed_nodes.includes(nodeId)) return 'FAILED';
    if (sim.degraded_nodes.includes(nodeId)) return 'DEGRADED';
    if (sim.backup_nodes.includes(nodeId)) return 'BACKUP';
    if (sim.critical_nodes.includes(nodeId)) return 'CRITICAL';
    return 'OPERATIONAL';
  }

  /**
   * Calculates population experiencing outage or degraded services (Section 3.1).
   */
  public static calculatePopulationAffected(sim: SimStateInput, network: Network | null): number {
    if (!network || !network.nodes) {
      return 0;
    }

    let total = 0;
    const counted = new Set<string>();

    // Direct node population impact
    for (const node of network.nodes) {
      const status = this.getNodeStatus(node.id, sim);
      const pop = node.population_served || 0;
      if (pop <= 0) continue;

      if (status === 'FAILED') {
        total += pop;
        counted.add(node.id);
      } else if (status === 'DEGRADED') {
        total += Math.ceil(pop * 0.40);
        counted.add(node.id);
      } else if (status === 'CRITICAL') {
        total += Math.ceil(pop * 0.25);
        counted.add(node.id);
      } else if (status === 'BACKUP') {
        total += Math.ceil(pop * 0.15);
        counted.add(node.id);
      }
    }

    // Indirect downstream dependency propagation (Power substations & Water pumps)
    const failedUtilities = new Set(
      network.nodes
        .filter((n: Asset) =>
          ['power_substation', 'power_station', 'water_pump', 'water_treatment'].includes(n.type) &&
          ['FAILED', 'DEGRADED'].includes(this.getNodeStatus(n.id, sim))
        )
        .map((n: Asset) => n.id)
    );

    if (failedUtilities.size > 0 && network.edges) {
      for (const edge of network.edges) {
        if (failedUtilities.has(edge.from) && !counted.has(edge.to)) {
          const target = network.nodes.find((n: Asset) => n.id === edge.to);
          if (target && (target.population_served || 0) > 0) {
            const utilityStatus = this.getNodeStatus(edge.from, sim);
            const ratio = utilityStatus === 'FAILED' ? 0.50 : 0.25;
            total += Math.ceil((target.population_served || 0) * ratio);
            counted.add(target.id);
          }
        }
      }
    }

    return total;
  }

  /**
   * Calculates emergency ambulance / responder delay in minutes (Section 3.1).
   */
  public static calculateResponseDelay(sim: SimStateInput, network: Network | null): number {
    let delay = 0;

    if (network && network.nodes) {
      for (const node of network.nodes) {
        if (['road_segment', 'bridge', 'intersection'].includes(node.type)) {
          const status = this.getNodeStatus(node.id, sim);
          if (status === 'FAILED') {
            const isArterial = (node as any).properties?.road_class === 'arterial' || node.type === 'bridge';
            delay += isArterial ? 8 : 5;
          } else if (status === 'CRITICAL') {
            delay += 4;
          } else if (status === 'DEGRADED') {
            delay += 2;
          }
        }
      }
    }

    // Edge closures
    for (const edgeId of sim.affected_edges) {
      if (network && network.edges) {
        const edge = network.edges.find((e) => e.id === edgeId);
        if (edge && ['road_connection', 'emergency_route', 'transport'].includes(edge.type)) {
          delay += 5;
          continue;
        }
      }
      if (edgeId.toLowerCase().includes('road') || edgeId.toLowerCase().includes('bridge') || edgeId.toLowerCase().includes('route')) {
        delay += 5;
      }
    }

    // Direct road failures in list
    for (const nid of sim.failed_nodes) {
      if (!network || !network.nodes.some((n: Asset) => n.id === nid)) {
        if (nid.toLowerCase().includes('road') || nid.toLowerCase().includes('bridge')) {
          delay += 6;
        }
      }
    }

    return Math.min(45, Math.max(0, delay));
  }

  /**
   * Counts disrupted critical service facilities (Section 3.1).
   */
  public static calculateServiceDisruptions(sim: SimStateInput, network: Network | null): {
    hospitals: number;
    schools: number;
    water: number;
    power: number;
  } {
    let hospitals = 0;
    let schools = 0;
    let water = 0;
    let power = 0;

    if (network && network.nodes) {
      for (const node of network.nodes) {
        const status = this.getNodeStatus(node.id, sim);
        if (['FAILED', 'DEGRADED', 'BACKUP'].includes(status)) {
          if (node.type === 'hospital') hospitals++;
          else if (node.type === 'school') schools++;
          else if (['water_pump', 'water_treatment'].includes(node.type)) water++;
          else if (['power_substation', 'power_station'].includes(node.type)) power++;
        }
      }
    } else {
      hospitals = sim.failed_nodes.filter((f) => f.includes('hospital')).length +
        sim.backup_nodes.filter((f) => f.includes('hospital')).length;
      schools = sim.failed_nodes.filter((f) => f.includes('school')).length;
      water = sim.failed_nodes.filter((f) => f.includes('water')).length;
      power = sim.failed_nodes.filter((f) => f.includes('power') || f.includes('substation')).length;
    }

    return { hospitals, schools, water, power };
  }

  /**
   * Calculates normalized Cascade Impact Score (Section 3.3).
   */
  public static calculateHumanImpact(
    sim: SimStateInput,
    network: Network | null,
    scenarioId: string = 'scenario_01',
    durationHours: number = 6.1
  ): ImpactResult {
    const popAffected = this.calculatePopulationAffected(sim, network);
    const responseDelay = this.calculateResponseDelay(sim, network);
    const disruptions = this.calculateServiceDisruptions(sim, network);

    // If completely nominal, score is strictly 0.00
    if (
      popAffected === 0 &&
      responseDelay === 0 &&
      disruptions.hospitals === 0 &&
      disruptions.water === 0 &&
      disruptions.power === 0
    ) {
      return {
        scenario_id: scenarioId,
        population_affected: 0,
        duration_hours: durationHours,
        emergency_response_delay_minutes: 0,
        hospital_disruptions: 0,
        school_disruptions: 0,
        water_service_disruptions: 0,
        power_service_disruptions: 0,
        impact_score: 0.0,
      };
    }

    // Dynamically normalized components against network topology
    const totalPop = network?.nodes.reduce((acc, n) => acc + (n.population_served || 0), 0) || this.STUDY_AREA_POPULATION;
    const popTerm = Math.min(1.0, popAffected / (totalPop * 0.35));
    const durationTerm = Math.min(1.0, durationHours / 12.0);

    const totalHospCap = (network?.nodes.filter((n) => n.type === 'hospital').reduce((acc, n) => acc + (n.capacity || 200), 0)) || 200;
    const totalSchools = Math.max(1, network?.nodes.filter((n) => n.type === 'school').length || 1);
    const vulnTerm = Math.min(1.0, (disruptions.hospitals * (totalHospCap / totalSchools) + disruptions.schools * 100) / totalHospCap);
    const delayTerm = Math.min(1.0, responseDelay / 45.0);

    const totalHospitals = Math.max(1, network?.nodes.filter((n) => n.type === 'hospital').length || 1);
    const totalWater = Math.max(1, network?.nodes.filter((n) => ['water_pump', 'water_treatment'].includes(n.type)).length || 1);
    const totalPower = Math.max(1, network?.nodes.filter((n) => ['power_substation', 'power_station'].includes(n.type)).length || 1);

    const servicesTerm = Math.min(
      1.0,
      0.35 * (disruptions.hospitals / totalHospitals) +
      0.25 * (disruptions.water / totalWater) +
      0.25 * (disruptions.power / totalPower) +
      0.15 * (disruptions.schools / totalSchools)
    );

    const rawScore =
      this.WEIGHT_POPULATION * popTerm +
      this.WEIGHT_DURATION * durationTerm +
      this.WEIGHT_VULNERABILITY * vulnTerm +
      this.WEIGHT_RESPONSE_DELAY * delayTerm +
      this.WEIGHT_CRITICAL_SERVICES * servicesTerm;

    const finalScore = Math.min(1.0, Math.max(0.08, Math.round(rawScore * 100) / 100));

    return {
      scenario_id: scenarioId,
      population_affected: popAffected,
      duration_hours: Math.round(durationHours * 10) / 10,
      emergency_response_delay_minutes: responseDelay,
      hospital_disruptions: disruptions.hospitals,
      school_disruptions: disruptions.schools,
      water_service_disruptions: disruptions.water,
      power_service_disruptions: disruptions.power,
      impact_score: finalScore,
    };
  }

  /**
   * Percentile calculation using linear interpolation.
   */
  public static calculatePercentile(data: number[], p: number): number {
    if (!data.length) return 0;
    const sorted = [...data].sort((a, b) => a - b);
    const n = sorted.length;
    if (n === 1) return sorted[0];

    const k = (n - 1) * (p / 100.0);
    const f = Math.floor(k);
    const c = Math.ceil(k);
    if (f === c) return sorted[k];
    return sorted[f] * (c - k) + sorted[c] * (k - f);
  }

  /**
   * Runs N-iteration Monte Carlo simulation over stochastic parameter distributions (Section 3.5).
   */
  public static runMonteCarlo(
    sim: SimStateInput,
    network: Network | null,
    scenarioId: string = 'scenario_01',
    iterations: number = 1000,
    seed: number = 42
  ): UncertaintyResult {
    const basePop = this.calculatePopulationAffected(sim, network);

    const isHospitalInBackup =
      (network?.nodes.some(
        (n: Asset) => n.type === 'hospital' && ['BACKUP', 'FAILED', 'CRITICAL'].includes(this.getNodeStatus(n.id, sim))
      ) ?? false) ||
      sim.backup_nodes.some((n) => n.toLowerCase().includes('hospital')) ||
      sim.failed_nodes.some((n) => n.toLowerCase().includes('hospital'));

    // Simple deterministic LCG random generator for reproducible seed runs
    let currentSeed = seed;
    const pseudoRandom = () => {
      currentSeed = (currentSeed * 1664525 + 1013904223) % 4294967296;
      return currentSeed / 4294967296;
    };

    const popSamples: number[] = [];
    const failureTimes: number[] = [];
    let hospitalFailedRuns = 0;

    for (let i = 0; i < iterations; i++) {
      // Stochastic parameter ranges (Section 3.4)
      const genHours = 5.0 + pseudoRandom() * 2.5; // 5.0 to 7.5 hours
      const hospLoad = 0.65 + pseudoRandom() * 0.20; // 0.65 to 0.85
      const waterDemand = 0.80 + pseudoRandom() * 0.20; // 0.80 to 1.00
      const recoveryTime = 2.0 + pseudoRandom() * 4.0; // 2.0 to 6.0 hours

      failureTimes.push(genHours);

      // Population variance
      if (basePop > 0) {
        const demandVariance = hospLoad * 0.5 + waterDemand * 0.5;
        const noise = 0.92 + pseudoRandom() * 0.16;
        popSamples.push(Math.round(basePop * demandVariance * noise));
      } else {
        popSamples.push(0);
      }

      // Hospital backup failure condition
      if (isHospitalInBackup) {
        if (recoveryTime > genHours) {
          hospitalFailedRuns++;
        }
      } else {
        if (pseudoRandom() < 0.05) {
          hospitalFailedRuns++;
        }
      }
    }

    const meanPop = Math.round(popSamples.reduce((a, b) => a + b, 0) / iterations);
    const medianPop = Math.round(this.calculatePercentile(popSamples, 50));
    const p05Pop = Math.round(this.calculatePercentile(popSamples, 5));
    const p95Pop = Math.round(this.calculatePercentile(popSamples, 95));

    const hospProb = isHospitalInBackup
      ? Math.round((hospitalFailedRuns / iterations) * 100) / 100
      : 0.05;

    const timeMedian = Math.round(this.calculatePercentile(failureTimes, 50) * 10) / 10;
    const timeP05 = Math.round(this.calculatePercentile(failureTimes, 5) * 10) / 10;
    const timeP95 = Math.round(this.calculatePercentile(failureTimes, 95) * 10) / 10;

    return {
      scenario_id: scenarioId,
      iterations,
      random_seed: seed,
      population_affected: {
        mean: meanPop,
        median: medianPop,
        p05: p05Pop,
        p95: p95Pop,
      },
      hospital_failure_probability: hospProb,
      hospital_failure_time_hours: {
        median: timeMedian,
        p05: timeP05,
        p95: timeP95,
      },
    };
  }
}
