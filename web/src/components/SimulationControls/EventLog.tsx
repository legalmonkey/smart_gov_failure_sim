import React, { useEffect, useState } from 'react';
import type { ApplicationState } from '../../state/applicationState';
import { appState } from '../../state/applicationState';

export const EventLog: React.FC = () => {
  const [state, setState] = useState<ApplicationState>(appState.getState());

  useEffect(() => {
    return appState.subscribe((s) => setState({ ...s }));
  }, []);

  const passedEvents = state.events.filter((e) => e.time <= state.simulationTime);

  return (
    <div className="event-feed-inner">
      <div className="feed-header">
        <div className="feed-header-left">
          <span className="log-indicator">●</span>
          <span className="feed-title">CASCADE TIMELINE STREAM</span>
        </div>
        <span className="feed-count font-mono">
          {passedEvents.length} of {state.events.length} Events
        </span>
      </div>

      <div className="feed-list">
        {passedEvents.length === 0 ? (
          <div className="feed-empty">
            <span className="empty-icon">⏳</span>
            <span>No failure events triggered yet. Press <strong>▶ Play</strong> on the timeline to start cascade propagation.</span>
          </div>
        ) : (
          passedEvents.map((ev, idx) => {
            const node = state.network?.nodes.find((n) => n.id === ev.asset_id);
            const edge = state.network?.edges.find((e) => e.id === ev.edge_id);
            const targetName = node?.name || edge?.id || ev.asset_id || ev.edge_id || 'System';

            let badgeClass = 'event-failed';
            if (ev.event === 'asset_backup') badgeClass = 'event-backup';
            else if (ev.event === 'asset_degraded') badgeClass = 'event-degraded';
            else if (ev.event === 'asset_recovered') badgeClass = 'event-recovered';

            return (
              <div key={idx} className="feed-item">
                <span className="feed-time font-mono">T+{ev.time.toFixed(1)}h</span>
                <span className={`event-badge ${badgeClass}`}>
                  {ev.event.replace('asset_', '').replace('edge_', '').toUpperCase()}
                </span>
                <div className="feed-desc">
                  <strong className="feed-target">{targetName}</strong>
                  {ev.cause && <span className="feed-cause"> — {ev.cause.replace(/_/g, ' ')}</span>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
