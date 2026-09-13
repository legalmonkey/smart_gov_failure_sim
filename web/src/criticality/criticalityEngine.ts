import type { CriticalityResult, NodeCriticality, EdgeCriticality } from '../types/criticality';
import type { Network, Asset } from '../types/asset';
import { ImpactEngine, type SimStateInput } from '../impact/impactEngine';

/**
 * Track 4 — Criticality Engine (Section 4.1 & 4.2).
 *
 * Implements graph removal-impact simulation:
 *   NodeCriticality_i = Impact(Network - {node_i})
 *   EdgeCriticality_e = Impact(Network - {edge_e})
 *
 * Automatically evaluates cascading human fallout when each asset or connection
 * is removed, identifying true single points of failure across power, water,
 * healthcare, education, and transportation networks.
 */
export class CriticalityEngine {
  /**
   * Computes dynamic node and edge criticality for a given network topology.
   */
  public static calculateCriticality(
    network: Network,
    scenarioId: string = 'scenario_01',
    baselineSimInput?: SimStateInput
  ): CriticalityResult {
    if (!network || !network.nodes || network.nodes.length === 0) {
      return {
        scenario_id: scenarioId,
        nodes: [],
        edges: [],
      };
    }

    const baselineImpact = baselineSimInput
      ? ImpactEngine.calculateHumanImpact(baselineSimInput, network, scenarioId).impact_score
      : 0.0;

    // Build directed adjacency map for dependency tracing
    const downstreamMap = new Map<string, string[]>();
    const upstreamMap = new Map<string, string[]>();

    if (network.edges) {
      for (const edge of network.edges) {
        if (!downstreamMap.has(edge.from)) downstreamMap.set(edge.from, []);
        downstreamMap.get(edge.from)!.push(edge.to);

        if (!upstreamMap.has(edge.to)) upstreamMap.set(edge.to, []);
        upstreamMap.get(edge.to)!.push(edge.from);
      }
    }

    // 1. Compute Node Criticality via Removal Simulation
    const nodeResults: NodeCriticality[] = [];

    for (const targetNode of network.nodes) {
      // Step 1: Isolate target asset
      const assets: Record<string, { state: string; load?: number }> = {};
      const failedNodes: string[] = [targetNode.id];
      const degradedNodes: string[] = [];
      const backupNodes: string[] = [];

      assets[targetNode.id] = { state: 'FAILED', load: 0 };

      // Step 2: Trace 1st and 2nd degree downstream cascade fallout
      const directDownstream = downstreamMap.get(targetNode.id) || [];
      const visited = new Set<string>([targetNode.id]);

      for (const dId of directDownstream) {
        if (visited.has(dId)) continue;
        visited.add(dId);

        const childNode = network.nodes.find((n: Asset) => n.id === dId);
        if (!childNode) continue;

        // Check if child node has backup capability
        if (childNode.backup_duration && childNode.backup_duration > 0) {
          backupNodes.push(dId);
          assets[dId] = { state: 'BACKUP', load: childNode.load };
        } else {
          degradedNodes.push(dId);
          assets[dId] = {
            state: 'DEGRADED',
            load: Math.round((childNode.load || 100) * 0.4),
          };
        }

        // Secondary cascade (e.g. Substation -> Water Pump -> Residential)
        const secondary = downstreamMap.get(dId) || [];
        for (const sId of secondary) {
          if (visited.has(sId)) continue;
          visited.add(sId);
          const sNode = network.nodes.find((n: Asset) => n.id === sId);
          if (sNode) {
            degradedNodes.push(sId);
            assets[sId] = {
              state: 'DEGRADED',
              load: Math.round((sNode.load || 100) * 0.6),
            };
          }
        }
      }

      // Step 3: Run impact calculation on the degraded state
      const simInput: SimStateInput = {
        scenario_id: scenarioId,
        time: 2.0,
        assets,
        failed_nodes: failedNodes,
        degraded_nodes: degradedNodes,
        backup_nodes: backupNodes,
        critical_nodes: [],
        affected_edges: network.edges
          ? network.edges.filter((e) => e.from === targetNode.id).map((e) => e.id)
          : [],
      };

      const removalImpact = ImpactEngine.calculateHumanImpact(simInput, network, scenarioId, 6.0);
      let removalScore = removalImpact.impact_score;

      // Topological weighting: single points of failure with high downstream connectivity
      const downstreamCount = directDownstream.length;
      const popServed = targetNode.population_served || 0;

      if (['power_station', 'substation'].includes(targetNode.type)) {
        removalScore = Math.max(removalScore, 0.85 + Math.min(0.12, downstreamCount * 0.02));
      } else if (targetNode.type === 'hospital') {
        removalScore = Math.max(removalScore, 0.78 + Math.min(0.12, (popServed / 30000) * 0.08));
      } else if (targetNode.type === 'water_pump') {
        removalScore = Math.max(removalScore, 0.72 + Math.min(0.12, downstreamCount * 0.03));
      } else if (targetNode.type === 'road' && downstreamCount > 0) {
        removalScore = Math.max(removalScore, 0.55 + Math.min(0.15, (popServed / 40000) * 0.1));
      }

      const finalCriticality = Math.min(0.99, Math.max(0.15, Math.round(removalScore * 100) / 100));

      nodeResults.push({
        asset_id: targetNode.id,
        criticality_score: finalCriticality,
        baseline_impact: baselineImpact,
        removal_impact: removalImpact.impact_score,
      });
    }

    // Sort nodes descending by systemic criticality
    nodeResults.sort((a, b) => b.criticality_score - a.criticality_score);

    // 2. Compute Edge Criticality via Connection Removal
    const edgeResults: EdgeCriticality[] = [];

    if (network.edges) {
      for (const edge of network.edges) {
        const targetNode = network.nodes.find((n: Asset) => n.id === edge.to);
        const assets: Record<string, { state: string; load?: number }> = {};
        const degradedNodes: string[] = [];
        const backupNodes: string[] = [];

        if (targetNode) {
          // Check for alternative redundant incoming paths
          const incoming = upstreamMap.get(edge.to) || [];
          const hasRedundancy = incoming.length > 1;

          if (!hasRedundancy) {
            // Critical link with zero redundancy
            if (targetNode.backup_duration && targetNode.backup_duration > 0) {
              backupNodes.push(targetNode.id);
              assets[targetNode.id] = { state: 'BACKUP', load: targetNode.load };
            } else {
              degradedNodes.push(targetNode.id);
              assets[targetNode.id] = {
                state: 'DEGRADED',
                load: Math.round((targetNode.load || 100) * 0.4),
              };
            }
          }
        }

        const simInput: SimStateInput = {
          scenario_id: scenarioId,
          time: 2.0,
          assets,
          failed_nodes: [],
          degraded_nodes: degradedNodes,
          backup_nodes: backupNodes,
          critical_nodes: [],
          affected_edges: [edge.id],
        };

        const removalImpact = ImpactEngine.calculateHumanImpact(simInput, network, scenarioId, 6.0);
        let edgeScore = removalImpact.impact_score;

        if (edge.type === 'power') {
          edgeScore = Math.max(edgeScore, 0.70);
        } else if (edge.type === 'water') {
          edgeScore = Math.max(edgeScore, 0.60);
        }

        const finalScore = Math.min(0.99, Math.max(0.12, Math.round(edgeScore * 100) / 100));

        edgeResults.push({
          edge_id: edge.id,
          criticality_score: finalScore,
          baseline_impact: baselineImpact,
          removal_impact: removalImpact.impact_score,
        });
      }

      edgeResults.sort((a, b) => b.criticality_score - a.criticality_score);
    }

    return {
      scenario_id: scenarioId,
      nodes: nodeResults,
      edges: edgeResults,
    };
  }
}
