import type { Network, Asset } from '../types/asset';
import type { OptimizationResult, UserPlanResult } from '../types/optimization';
import type { CriticalityResult } from '../types/criticality';
import type { AdvisorResult } from '../types/advisor';

export class AdvisorEngine {
  /**
   * Generates factual, deterministic plan comparison and structured explanations (Section 4.7).
   */
  public static generateAdvice(
    userPlan: UserPlanResult,
    optimalPlan: OptimizationResult,
    criticality: CriticalityResult | null,
    network: Network | null
  ): AdvisorResult {
    const userTargets = new Set(userPlan.selected_interventions.map((i) => i.target_asset_id));
    const optimalTargets = new Set(optimalPlan.selected_interventions.map((i) => i.target_asset_id));

    // Identify critical assets protected by optimizer that user omitted
    const missedAssets: string[] = [];
    for (const target of optimalTargets) {
      if (!userTargets.has(target)) {
        missedAssets.push(target);
      }
    }

    // Identify critical dependency edges
    const missedEdges: string[] = [];
    if (criticality && criticality.edges) {
      for (const edge of criticality.edges.slice(0, 4)) {
        if (missedAssets.some((m) => edge.edge_id.includes(m))) {
          missedEdges.push(edge.edge_id);
        }
      }
    }

    // Data-driven priority reasons based on actual network topology
    const priorityReasons: string[] = [];

    if (network) {
      for (const missedId of missedAssets) {
        const node = network.nodes.find((n: Asset) => n.id === missedId);
        if (!node) continue;

        if (node.type === 'hospital') {
          priorityReasons.push(
            `Critical Care Bottleneck: ${node.name} protects ${(node.population_served || 0).toLocaleString()} residents with continuous emergency and ICU care.`
          );
        } else if (['substation', 'power_station'].includes(node.type)) {
          priorityReasons.push(
            `Grid Distribution Hub: ${node.name} serves as the primary high-voltage feed for regional lifelines and water pumping stations.`
          );
        } else if (node.type === 'water_pump') {
          priorityReasons.push(
            `Potable Water Hub: ${node.name} supplies continuous municipal flow to residential high-rises and medical centers.`
          );
        } else if (node.type === 'road') {
          priorityReasons.push(
            `Emergency Arterial Spine: ${node.name} prevents critical delays for emergency response vehicles and ambulance transit.`
          );
        } else {
          priorityReasons.push(
            `Key Infrastructure Node: ${node.name} supports downstream urban resilience.`
          );
        }
      }
    }

    if (priorityReasons.length === 0) {
      if (optimalPlan.impact_reduction > userPlan.impact_reduction) {
        priorityReasons.push(
          'The optimizer selected higher cost-efficiency interventions with greater cascading mitigation value.'
        );
      } else {
        priorityReasons.push(
          'Your plan matches the optimal protective allocation for this budget threshold.'
        );
      }
    }

    return {
      scenario_id: userPlan.scenario_id,
      user_plan: {
        impact: userPlan.resulting_impact,
        impact_reduction: userPlan.impact_reduction,
        total_cost: userPlan.total_cost,
        selected_interventions: userPlan.selected_interventions,
      },
      optimal_plan: {
        impact: optimalPlan.optimized_impact,
        impact_reduction: optimalPlan.impact_reduction,
        total_cost: optimalPlan.total_cost,
        selected_interventions: optimalPlan.selected_interventions,
      },
      missed_critical_assets: missedAssets,
      missed_critical_edges: missedEdges,
      priority_reasons: priorityReasons,
    };
  }
}
