import React, { useEffect, useState } from 'react';
import type { ApplicationState } from '../../state/applicationState';
import { appState } from '../../state/applicationState';
import type { SimulationEvent } from '../../types/simulation';

export const CascadeFeedPanel: React.FC = () => {
  const [state, setState] = useState<ApplicationState>(appState.getState());

  useEffect(() => {
    return appState.subscribe((s) => setState({ ...s }));
  }, []);

  const hours = Math.floor(state.simulationTime);
  const minutes = Math.floor((state.simulationTime - hours) * 60);
  const timeFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  // Filter events dynamically that have occurred at or prior to the current simulation time
  const activeEvents = state.events.filter((e) => e.time <= state.simulationTime);

  const getNode = (id?: string) => state.network?.nodes.find((n) => n.id === id);
  const getEdge = (id?: string) => state.network?.edges.find((e) => e.id === id);

  const formatEventClock = (evTime: number) => {
    // Base simulation clock starting at 04:00 AM IST (typical early morning disaster baseline)
    const baseHour = 4;
    const totalHours = baseHour + evTime;
    const h = Math.floor(totalHours) % 24;
    const m = Math.floor((totalHours - Math.floor(totalHours)) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} IST`;
  };

  const getEventBadge = (event: string) => {
    switch (event) {
      case 'asset_failed':
        return { tag: 'FAILED', tagClass: 'tag-failed', cardBorderClass: 'event-failed' };
      case 'asset_backup':
        return { tag: 'BACKUP PWR', tagClass: 'tag-backup', cardBorderClass: 'event-backup' };
      case 'asset_degraded':
        return { tag: 'DEGRADED', tagClass: 'tag-degraded', cardBorderClass: 'event-degraded' };
      case 'asset_critical':
        return { tag: 'CRITICAL', tagClass: 'tag-delay', cardBorderClass: 'event-critical' };
      case 'dependency_lost':
        return { tag: 'FEED LOST', tagClass: 'tag-degraded', cardBorderClass: 'event-feed' };
      case 'edge_failed':
        return { tag: 'ROUTE BLOCKED', tagClass: 'tag-delay', cardBorderClass: 'event-failed' };
      default:
        return { tag: 'EVENT', tagClass: 'tag-degraded', cardBorderClass: '' };
    }
  };

  const getEventTitle = (ev: SimulationEvent) => {
    if (ev.asset_id) {
      const node = getNode(ev.asset_id);
      const name = node?.name || ev.asset_id;
      if (ev.cause === 'user_initiated_break') return `${name} · Manual Breakdown`;
      if (ev.event === 'asset_failed') return `${name} · Offline`;
      if (ev.event === 'asset_backup') return `${name} · Auxiliary Engaged`;
      if (ev.event === 'asset_degraded') return `${name} · Degraded Throughput`;
      if (ev.event === 'asset_critical') return `${name} · Reserve Depleting`;
      return `${name} · Disruption`;
    }
    if (ev.edge_id) {
      const edge = getEdge(ev.edge_id);
      const name = edge ? `${edge.from} → ${edge.to}` : ev.edge_id;
      if (ev.event === 'dependency_lost') return `${name} · Feed Disrupted`;
      if (ev.event === 'edge_failed') return `${name} · Corridor Blocked`;
      return `${name} · Dependency Lost`;
    }
    return `Event @ T+${ev.time.toFixed(1)}h`;
  };

  const getEventDescription = (ev: SimulationEvent) => {
    const node = getNode(ev.asset_id);

    if (ev.cause === 'user_initiated_break') {
      return 'Manual breakdown induced by operator. Downstream dependent infrastructure alerted.';
    }
    if (ev.cause?.startsWith('initial_shock')) {
      const shockName = ev.cause.replace('initial_shock:', '');
      return `Initial disruption shock component: ${shockName}. Direct operational interruption.`;
    }
    if (ev.cause === 'main_power_lost' || ev.cause === 'main_feed_loss' || ev.cause === 'upstream_asset_break') {
      return `Primary electrical feeder offline. Switched to auxiliary on-site power reserves (${node?.backup_duration || 4}h endurance remaining).`;
    }
    if (ev.cause === 'backup_reserve_depleted') {
      return 'Auxiliary fuel reserves depleted below safe operating margin. Critical system brownout imminent.';
    }
    if (ev.cause === 'reserve_exhausted_shutdown') {
      return 'Auxiliary power fully exhausted. Total emergency shutdown of all local operations.';
    }
    if (ev.cause === 'supply_compromised' || ev.cause === 'upstream_feed_loss') {
      return 'Upstream utility feed degraded. Asset operating under emergency throttled load.';
    }
    if (ev.event === 'dependency_lost') {
      return `Substation/feeder link severed. Downstream facility disconnected from grid circuit.`;
    }
    if (ev.event === 'edge_failed') {
      return `Corridor transit blocked. Arterial emergency traffic rerouted.`;
    }
    if (ev.cause) {
      return `Operational state changed due to: ${ev.cause.replace(/_/g, ' ')}.`;
    }
    return 'Infrastructure telemetry alert recorded at current simulation milestone.';
  };

  return (
    <aside className="cascade-feed-panel emerging-panel glass-panel">
      {/* Header */}
      <div className="panel-top-bar">
        <div className="title-with-pill">
          <span className={`cascade-radar-dot ${activeEvents.length > 0 ? 'radar-active' : ''}`}></span>
          <h2 className="panel-main-title">CASCADE FEED</h2>
          <span className={`status-pill ${activeEvents.length > 0 ? 'pill-active' : 'pill-nominal'} font-mono`}>
            {activeEvents.length > 0 ? `T+${timeFormatted} ACTIVE (${activeEvents.length})` : `T+${timeFormatted} NOMINAL`}
          </span>
        </div>
        <button
          className="dock-close-btn"
          onClick={() => appState.toggleCascadePanel(false)}
          title="Dock Cascade Feed"
        >
          ×
        </button>
      </div>

      {/* Events List */}
      <div className="panel-scroll-content feed-timeline-list">
        {activeEvents.length === 0 ? (
          <div className="nominal-state-card">
            <div className="nominal-badge-row">
              <span className="nominal-pulsing-dot" />
              <span className="nominal-status font-mono">ALL SYSTEMS OPERATING NOMINALLY</span>
            </div>
            <h4 className="nominal-title">Pristine Network Baseline</h4>
            <p className="nominal-desc">
              Zero failure or cascade events detected across Powai Lake &amp; Central Hiranandani infrastructure.
            </p>
            <div className="nominal-hint font-mono">
              Hover over and break any asset on the map, or select a scenario from the Scenarios library to observe cascading failure propagation.
            </div>
          </div>
        ) : (
          activeEvents.map((ev, idx) => {
            const badge = getEventBadge(ev.event);
            const title = getEventTitle(ev);
            const desc = getEventDescription(ev);

            return (
              <div
                key={`ev-${idx}-${ev.asset_id || ev.edge_id}-${ev.time}`}
                className={`feed-entry-card ${badge.cardBorderClass} ${ev.cause === 'user_initiated_break' ? 'dynamic-break' : ''}`}
                onClick={() => ev.asset_id && appState.setSelectedAssetId(ev.asset_id)}
                style={{ cursor: ev.asset_id ? 'pointer' : 'default' }}
                title={ev.asset_id ? 'Click to view asset on 3D map' : undefined}
              >
                <div className="entry-header">
                  <span className="entry-timestamp font-mono">
                    {formatEventClock(ev.time)} · T+{String(Math.floor(ev.time)).padStart(2, '0')}:
                    {String(Math.floor((ev.time % 1) * 60)).padStart(2, '0')}
                  </span>
                  <span className={`entry-tag ${badge.tagClass} font-mono`}>{badge.tag}</span>
                </div>
                <h4 className="entry-title">{title}</h4>
                <p className="entry-desc">{desc}</p>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
