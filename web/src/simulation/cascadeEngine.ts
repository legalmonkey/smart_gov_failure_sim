import type { Network, Asset } from '../types/asset';
import type { SimulationEvent } from '../types/simulation';
import type { Intervention, InterventionRequest } from '../types/intervention';

export class CascadeEngine {
  /**
   * Dynamically generates the chronological sequence of cascading failure events
   * based on the real network topology, initial shocks, and deployed interventions.
   */
  public static generateCascadeEvents(
    network: Network,
    initialFailures: string[],
    appliedInterventions: InterventionRequest[] = [],
    catalog: Intervention[] = [],
    durationHours: number = 24
  ): SimulationEvent[] {
    if (!network || initialFailures.length === 0) return [];

    const events: SimulationEvent[] = [];
    const catalogMap = new Map<string, Intervention>(catalog.map((c) => [c.id, c]));

    // Map interventions targeting each asset
    const interventionsByAsset = new Map<string, Intervention[]>();
    for (const req of appliedInterventions) {
      const item = catalogMap.get(req.intervention_id);
      if (item) {
        if (!interventionsByAsset.has(req.target_asset_id)) {
          interventionsByAsset.set(req.target_asset_id, []);
        }
        interventionsByAsset.get(req.target_asset_id)!.push(item);
      }
    }

    // Track simulated failure and degradation times
    const nodeStateTime = new Map<string, { state: string; time: number }>();
    const affectedEdges = new Set<string>();

    // Step 1: Initial Hazard Shocks at T=0
    for (const fid of initialFailures) {
      const node = network.nodes.find((n) => n.id === fid);
      if (!node) continue;

      // Check if flood barrier or structural hardening protects node from initial shock
      const applied = interventionsByAsset.get(fid) || [];
      const hasThresholdHardening = applied.some(
        (i) => i.effects.failure_threshold_increase && i.effects.failure_threshold_increase >= 0.2
      );

      if (hasThresholdHardening && applied.length > 1) {
        events.push({
          time: 0.2,
          event: 'asset_degraded',
          asset_id: fid,
          cause: 'shock_absorbed_by_reinforcement',
        });
        nodeStateTime.set(fid, { state: 'DEGRADED', time: 0.2 });
      } else {
        events.push({
          time: 0.0,
          event: 'asset_failed',
          asset_id: fid,
          cause: 'initial_hazard_shock',
        });
        nodeStateTime.set(fid, { state: 'FAILED', time: 0.0 });
      }
    }

    // Step 2: Breadth-first iterative cascade propagation across graph dependencies
    interface QueueItem {
      nodeId: string;
      failTime: number;
      hop: number;
    }

    const queue: QueueItem[] = Array.from(nodeStateTime.entries())
      .filter(([_, val]) => val.state === 'FAILED')
      .map(([id, val]) => ({ nodeId: id, failTime: val.time, hop: 0 }));

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.failTime >= durationHours) continue;

      // Find all downstream outgoing dependencies
      const outgoingEdges = network.edges.filter((e) => e.from === current.nodeId);

      outgoingEdges.forEach((edge, edgeIdx) => {
        // Edge failure or loss of transmission
        const edgeDelay = Math.round((0.2 + 0.15 * edgeIdx) * 10) / 10;
        const edgeLossTime = Math.min(durationHours, Math.round((current.failTime + edgeDelay) * 10) / 10);

        if (!affectedEdges.has(edge.id)) {
          affectedEdges.add(edge.id);
          events.push({
            time: edgeLossTime,
            event: 'dependency_lost',
            edge_id: edge.id,
            cause: 'upstream_loss:' + current.nodeId,
          });
        }

        const targetNode = network.nodes.find((n: Asset) => n.id === edge.to);
        if (!targetNode) return;

        // Skip if target already recorded as failed
        const existing = nodeStateTime.get(targetNode.id);
        if (existing && existing.state === 'FAILED') return;

        // Check if target has alternative operational power/supply feed
        const incomingEdges = network.edges.filter((e) => e.to === targetNode.id);
        const hasAlternateOperationalSource = incomingEdges.some((inc) => {
          if (inc.id === edge.id || inc.from === current.nodeId) return false;
          const srcState = nodeStateTime.get(inc.from);
          return !srcState || srcState.state === 'OPERATIONAL';
        });

        // Interventions on target node
        const targetInterventions = interventionsByAsset.get(targetNode.id) || [];
        const hasRedundancyIntervention = targetInterventions.some(
          (i) => i.effects.dependency_redundancy || i.effects.redundancy_edges
        );
        const extraBackupHours = targetInterventions.reduce((sum, i) => {
          return sum + (i.effects.backup_duration_hours || 0);
        }, 0);

        // If target has active redundancy feed, it switches over and survives
        if (hasAlternateOperationalSource || hasRedundancyIntervention) {
          const switchoverTime = Math.round((edgeLossTime + 0.2) * 10) / 10;
          if (!existing) {
            events.push({
              time: switchoverTime,
              event: 'asset_recovering',
              asset_id: targetNode.id,
              cause: hasRedundancyIntervention
                ? 'redundant_circuit_engaged'
                : 'switched_to_alternate_grid_feeder',
            });
            nodeStateTime.set(targetNode.id, { state: 'OPERATIONAL', time: switchoverTime });
          }
          return;
        }

        // Calculate total available emergency reserve
        const baseBackup = targetNode.backup_duration || 0;
        const totalBackup = baseBackup + extraBackupHours;

        if (totalBackup > 0) {
          // Engages auxiliary backup
          const backupStartTime = Math.round((edgeLossTime + 0.2) * 10) / 10;
          events.push({
            time: backupStartTime,
            event: 'asset_backup',
            asset_id: targetNode.id,
            cause: 'auxiliary_power_active:' + totalBackup + 'h_reserve',
          });
          nodeStateTime.set(targetNode.id, { state: 'BACKUP', time: backupStartTime });

          // Backup runs out after totalBackup hours
          const criticalTime = Math.round((backupStartTime + totalBackup) * 10) / 10;
          if (criticalTime < durationHours) {
            events.push({
              time: criticalTime,
              event: 'asset_critical',
              asset_id: targetNode.id,
              cause: 'reserve_fuel_depleted',
            });
            nodeStateTime.set(targetNode.id, { state: 'CRITICAL', time: criticalTime });

            const shutdownTime = Math.round((criticalTime + 0.6) * 10) / 10;
            if (shutdownTime <= durationHours) {
              events.push({
                time: shutdownTime,
                event: 'asset_failed',
                asset_id: targetNode.id,
                cause: 'reserve_exhausted_blackout',
              });
              nodeStateTime.set(targetNode.id, { state: 'FAILED', time: shutdownTime });

              // Propagate downstream
              queue.push({
                nodeId: targetNode.id,
                failTime: shutdownTime,
                hop: current.hop + 1,
              });
            }
          }
        } else {
          // No backup reserves: immediate unmitigated degradation followed by failure
          const degradedTime = Math.round((edgeLossTime + 0.3) * 10) / 10;
          events.push({
            time: degradedTime,
            event: 'asset_degraded',
            asset_id: targetNode.id,
            cause: 'supply_compromised',
          });
          nodeStateTime.set(targetNode.id, { state: 'DEGRADED', time: degradedTime });

          const failureDelay = targetNode.type === 'hospital' ? 2.5 : targetNode.type === 'water_pump' ? 1.8 : 3.0;
          const failTime = Math.round((degradedTime + failureDelay) * 10) / 10;

          if (failTime <= durationHours) {
            events.push({
              time: failTime,
              event: 'asset_failed',
              asset_id: targetNode.id,
              cause: 'unmitigated_supply_deprivation',
            });
            nodeStateTime.set(targetNode.id, { state: 'FAILED', time: failTime });

            queue.push({
              nodeId: targetNode.id,
              failTime: failTime,
              hop: current.hop + 1,
            });
          }
        }
      });
    }

    events.sort((a, b) => a.time - b.time);
    return events;
  }
}
