import type { Network, Asset } from '../types/asset';
import type { Intervention } from '../types/intervention';
import type { OptimizationResult, UserPlanResult, SelectedIntervention } from '../types/optimization';
import { ImpactEngine, type SimStateInput } from '../impact/impactEngine';
import { CriticalityEngine } from '../criticality/criticalityEngine';

export class OptimizerEngine {
  /**
   * Evaluates user plan against current simulation state.
   */
  public static evaluateUserPlan(
    network: Network,
    baseSimInput: SimStateInput,
    budget: number,
    selected: SelectedIntervention[],
    catalog: Intervention[],
    scenarioId: string = 'scenario_01'
  ): UserPlanResult {
    const baselineImpact = ImpactEngine.calculateHumanImpact(baseSimInput, network, scenarioId).impact_score;
    const catalogMap = new Map(catalog.map((c) => [c.id, c]));

    const totalCost = selected.reduce((sum, s) => {
      const inv = catalogMap.get(s.intervention_id);
      return sum + (inv ? inv.cost : s.cost);
    }, 0);

    const hardenedSimInput = this.applyInterventions(baseSimInput, network, selected, catalog);
    const resultingImpact = ImpactEngine.calculateHumanImpact(hardenedSimInput, network, scenarioId).impact_score;
    const reduction = Math.max(0.0, Math.round((baselineImpact - resultingImpact) * 100) / 100);

    return {
      scenario_id: scenarioId,
      budget,
      selected_interventions: selected,
      total_cost: totalCost,
      baseline_impact: baselineImpact,
      resulting_impact: resultingImpact,
      impact_reduction: reduction,
    };
  }

  /**
   * Finds the optimal intervention package minimizing Cascade Impact Score subject to TotalCost <= Budget.
   */
  public static optimizeBudget(
    network: Network,
    baseSimInput: SimStateInput,
    budget: number,
    catalog: Intervention[],
    scenarioId: string = 'scenario_01'
  ): OptimizationResult {
    const baselineImpact = ImpactEngine.calculateHumanImpact(baseSimInput, network, scenarioId).impact_score;

    if (budget <= 0 || baselineImpact <= 0.0) {
      return {
        scenario_id: scenarioId,
        budget,
        selected_interventions: [],
        total_cost: 0,
        baseline_impact: baselineImpact,
        optimized_impact: baselineImpact,
        impact_reduction: 0.0,
      };
    }

    // Identify candidate targets from criticality ranking and active failure nodes
    const crits = CriticalityEngine.calculateCriticality(network, scenarioId, baseSimInput);
    const priorityAssetIds = [
      ...baseSimInput.failed_nodes,
      ...baseSimInput.degraded_nodes,
      ...baseSimInput.backup_nodes,
      ...crits.nodes.slice(0, 10).map((n) => n.asset_id),
    ];

    const uniqueAssetIds = Array.from(new Set(priorityAssetIds));

    // Form candidate intervention pairings (intervention, asset)
    const candidates: SelectedIntervention[] = [];
    for (const assetId of uniqueAssetIds) {
      const asset = network.nodes.find((n) => n.id === assetId);
      if (!asset) continue;

      for (const inv of catalog) {
        if (inv.target_types.includes(asset.type) && inv.cost <= budget) {
          candidates.push({
            intervention_id: inv.id,
            target_asset_id: assetId,
            cost: inv.cost,
          });
        }
      }
    }

    // Combinatorial / knapsack search for best impact reduction
    let bestSelected: SelectedIntervention[] = [];
    let bestImpact = baselineImpact;
    let bestCost = 0;

    // Test combinations up to size 3
    const maxK = Math.min(3, candidates.length);

    const testCombinations = (start: number, currentCombo: SelectedIntervention[], currentCost: number) => {
      if (currentCombo.length > 0) {
        const hardenedInput = this.applyInterventions(baseSimInput, network, currentCombo, catalog);
        const score = ImpactEngine.calculateHumanImpact(hardenedInput, network, scenarioId).impact_score;

        if (score < bestImpact || (Math.abs(score - bestImpact) < 1e-4 && currentCost < bestCost)) {
          bestImpact = score;
          bestSelected = [...currentCombo];
          bestCost = currentCost;
        }
      }

      if (currentCombo.length >= maxK) return;

      const targetedInCombo = new Set(currentCombo.map((c) => c.target_asset_id));

      for (let i = start; i < candidates.length; i++) {
        const next = candidates[i];
        if (targetedInCombo.has(next.target_asset_id)) continue;
        if (currentCost + next.cost > budget) continue;

        currentCombo.push(next);
        testCombinations(i + 1, currentCombo, currentCost + next.cost);
        currentCombo.pop();
      }
    };

    testCombinations(0, [], 0);

    const impactReduction = Math.max(0.0, Math.round((baselineImpact - bestImpact) * 100) / 100);

    return {
      scenario_id: scenarioId,
      budget,
      selected_interventions: bestSelected,
      total_cost: bestCost,
      baseline_impact: baselineImpact,
      optimized_impact: bestImpact,
      impact_reduction: impactReduction,
    };
  }

  /**
   * Applies selected intervention semantics to a simulated failure state.
   */
  private static applyInterventions(
    simInput: SimStateInput,
    network: Network,
    selected: SelectedIntervention[],
    catalog: Intervention[]
  ): SimStateInput {
    const catalogMap = new Map(catalog.map((c) => [c.id, c]));
    const protectedMap = new Map<string, Intervention[]>();

    for (const sel of selected) {
      const inv = catalogMap.get(sel.intervention_id);
      if (inv) {
        if (!protectedMap.has(sel.target_asset_id)) protectedMap.set(sel.target_asset_id, []);
        protectedMap.get(sel.target_asset_id)!.push(inv);
      }
    }

    const newAssets = { ...(simInput.assets || {}) };
    const newFailed = [...simInput.failed_nodes];
    const newDegraded = [...simInput.degraded_nodes];
    const newBackup = [...simInput.backup_nodes];

    for (const [assetId, invList] of protectedMap.entries()) {
      const asset = network.nodes.find((n: Asset) => n.id === assetId);
      if (!asset) continue;

      const hasBackup = invList.some((i) => i.effects.backup_duration_hours || i.effects.resilience_boost);
      const hasRedundancy = invList.some((i) => i.effects.dependency_redundancy || i.effects.redundancy_edges);
      const hasRoadFix = invList.some((i) => i.effects.capacity_increase || i.effects.failure_probability_reduction);
      const hasThreshold = invList.some((i) => i.effects.failure_threshold_increase);

      if (newFailed.includes(assetId)) {
        if (hasRoadFix && (asset.type === 'road' || asset.type === 'road_segment')) {
          const idx = newFailed.indexOf(assetId);
          if (idx !== -1) newFailed.splice(idx, 1);
          newAssets[assetId] = { state: 'OPERATIONAL', load: asset.capacity || 100 };
        } else if (hasBackup || hasRedundancy) {
          const idx = newFailed.indexOf(assetId);
          if (idx !== -1) newFailed.splice(idx, 1);
          newBackup.push(assetId);
          newAssets[assetId] = { state: 'BACKUP', load: (asset.capacity || 100) * 0.8 };
        } else if (hasThreshold) {
          const idx = newFailed.indexOf(assetId);
          if (idx !== -1) newFailed.splice(idx, 1);
          newDegraded.push(assetId);
          newAssets[assetId] = { state: 'DEGRADED', load: (asset.capacity || 100) * 0.5 };
        }
      } else if (newDegraded.includes(assetId)) {
        if (hasBackup || hasRedundancy) {
          const idx = newDegraded.indexOf(assetId);
          if (idx !== -1) newDegraded.splice(idx, 1);
          newBackup.push(assetId);
          newAssets[assetId] = { state: 'BACKUP', load: (asset.capacity || 100) * 0.9 };
        } else if (hasThreshold) {
          const idx = newDegraded.indexOf(assetId);
          if (idx !== -1) newDegraded.splice(idx, 1);
          newAssets[assetId] = { state: 'OPERATIONAL', load: asset.capacity || 100 };
        }
      }
    }

    return {
      ...simInput,
      assets: newAssets,
      failed_nodes: newFailed,
      degraded_nodes: newDegraded,
      backup_nodes: newBackup,
    };
  }
}
