import React, { useEffect, useState } from 'react';
import type { ApplicationState } from '../../state/applicationState';
import { appState } from '../../state/applicationState';
import { getAssetDescriptor } from '../../infrastructure/assetRegistry';

interface Props {
  onFocusAsset?: (assetId: string) => void;
}

export const AssetDetailPanel: React.FC<Props> = ({ onFocusAsset }) => {
  const [state, setState] = useState<ApplicationState>(appState.getState());

  useEffect(() => {
    return appState.subscribe((s) => setState({ ...s }));
  }, []);

  if (!state.selectedAssetId || !state.network) {
    return null;
  }

  const asset = state.network.nodes.find((n) => n.id === state.selectedAssetId);
  if (!asset) return null;

  const statusInfo = state.assetStates[asset.id] || { state: asset.status, load: asset.load ?? 0 };
  const currentState = statusInfo.state;
  const currentLoad = statusInfo.load;
  const capacity = asset.capacity ?? 100;
  const loadPercent = Math.min(100, Math.round((currentLoad / (capacity || 1)) * 100));

  const upstreamEdges = state.network.edges.filter((e) => e.to === asset.id);
  const downstreamEdges = state.network.edges.filter((e) => e.from === asset.id);

  const upstreamFailedNode = upstreamEdges
    .map((e) => state.network?.nodes.find((n) => n.id === e.from))
    .find((n) => n && (state.failedNodes.includes(n.id) || state.degradedNodes.includes(n.id)));

  const isFailed = currentState === 'FAILED';
  const critNode = state.criticality?.nodes?.find((n) => n.asset_id === asset.id);
  const critScore = critNode ? critNode.criticality_score : null;

  return (
    <aside className="asset-detail-panel emerging-panel glass-panel">
      {/* Header matching reference image */}
      <div className="panel-top-bar">
        <div className="title-with-pill">
          <span className="node-icon-box">[+]</span>
          <h2 className="panel-main-title">SELECTED ASSET</h2>
        </div>

        {/* Conduit Legend Matching Screenshot */}
        <div className="conduit-legend-block">
          <div className="conduit-legend-header font-mono">
            <span>NETWORK CONDUIT LEGEND</span>
            <span className="conduit-twin-tag">POWAI TWIN</span>
          </div>
          <div className="conduit-legend-items">
            <span className="leg-item"><span className="c-dot dot-red">●</span> Failed Node</span>
            <span className="leg-item"><span className="c-dot dot-amber">●</span> Degraded/Aux</span>
            <span className="leg-item"><span className="c-dot dot-blue">●</span> Nominal Path</span>
            <span className="leg-item"><span className="c-dot dot-green">●</span> Active Bypass</span>
          </div>
        </div>

        <button
          className="dock-close-btn"
          onClick={() => appState.setSelectedAssetId(null)}
          title="Close asset inspector"
        >
          ×
        </button>
      </div>

      <div className="panel-scroll-content">
        {/* Title and ID */}
        <div className="asset-hero-section">
          <h3 className="asset-hero-name">{asset.name}</h3>
          <div className="asset-meta-tags font-mono">
            <span className="meta-tag">NODE ID: {asset.id.toUpperCase()}</span>
            <span className="meta-divider">•</span>
            <span className="meta-tag">
              {getAssetDescriptor(asset.type).displayName.toUpperCase()}
            </span>
            {critScore !== null && (
              <>
                <span className="meta-divider">•</span>
                <span
                  className={`meta-tag ${
                    critScore > 0.75
                      ? 'tag-crit-high'
                      : critScore > 0.4
                      ? 'tag-crit-med'
                      : 'tag-crit-low'
                  }`}
                >
                  CRITICALITY: {critScore.toFixed(2)} ({critScore > 0.75 ? 'HIGH' : critScore > 0.4 ? 'MED' : 'LOW'})
                </span>
              </>
            )}
          </div>
        </div>

        {/* Load & Capacity Dual Bars */}
        <div className="asset-meters-grid">
          <div className="meter-card">
            <div className="meter-header">
              <span className="meter-label">CURRENT LOAD</span>
              <span className="meter-val font-mono">{currentLoad} / {capacity}</span>
            </div>
            <div className="meter-track">
              <div
                className="meter-fill fill-blue"
                style={{ width: `${loadPercent}%` }}
              />
            </div>
            <span className="meter-sub">
              {isFailed
                ? 'Zero throughput (Offline)'
                : currentState === 'DEGRADED'
                ? 'Operating under throttled load'
                : currentState === 'BACKUP'
                ? 'Supplied via auxiliary reserve'
                : 'Nominal distribution throughput'}
            </span>
          </div>

          <div className="meter-card">
            <div className="meter-header">
              <span className="meter-label">
                {asset.backup_duration ? 'AUX GENERATOR' : 'GRID FEED'}
              </span>
              <span className="meter-val font-mono val-amber">
                {asset.backup_duration ? `${asset.backup_duration}H REM.` : 'DIRECT'}
              </span>
            </div>
            <div className="meter-track">
              <div
                className="meter-fill fill-amber"
                style={{ width: `${asset.backup_duration ? (currentState === 'BACKUP' ? 65 : 100) : (isFailed ? 0 : 100)}%` }}
              />
            </div>
            <span className="meter-sub">
              {asset.backup_duration
                ? (currentState === 'BACKUP' ? 'Active diesel fuel burn' : 'Standby reserve ready')
                : 'No on-site generator installed'}
            </span>
          </div>
        </div>

        {/* Direct Upstream Failure Alert Box */}
        {(isFailed || currentState === 'BACKUP' || upstreamFailedNode) && (
          <div className="direct-failure-alert-box">
            <div className="alert-content">
              <span className="alert-badge font-mono">!</span>
              <div className="alert-text">
                <strong className="alert-head">
                  {upstreamFailedNode
                    ? 'Direct Upstream Failure'
                    : isFailed
                    ? 'Primary Asset Disrupted'
                    : 'Auxiliary Power Engaged'}
                </strong>
                <span className="alert-sub font-mono">
                  {upstreamFailedNode
                    ? `${upstreamFailedNode.name} (Offline)`
                    : isFailed
                    ? 'Terminal disconnected from circuit'
                    : 'Feeder Offline · Backup generator active'}
                </span>
              </div>
            </div>
            <button
              className="alert-action-btn font-mono"
              onClick={() => (isFailed ? appState.repairAsset(asset.id) : appState.triggerManualFailure(asset.id))}
            >
              {isFailed ? 'RESTORE' : 'ISOLATE'}
            </button>
          </div>
        )}

        {/* Control Actions */}
        <div className="asset-actions-row">
          {isFailed ? (
            <button
              className="action-btn btn-success font-mono"
              onClick={() => appState.repairAsset(asset.id)}
            >
              RESTORE ASSET
            </button>
          ) : (
            <button
              className="action-btn btn-danger font-mono"
              onClick={() => appState.triggerManualFailure(asset.id)}
            >
              BREAK ASSET (SIMULATE)
            </button>
          )}

          {onFocusAsset && (
            <button
              className="action-btn btn-secondary font-mono"
              onClick={() => onFocusAsset(asset.id)}
            >
              FOCUS VIEW
            </button>
          )}
        </div>

        {/* Upstream & Downstream Dependencies */}
        <div className="asset-dependency-group">
          <span className="dep-group-title font-mono">UPSTREAM FEEDERS ({upstreamEdges.length})</span>
          {upstreamEdges.length === 0 ? (
            <span className="dep-empty-note">Primary Generation Node</span>
          ) : (
            <div className="dep-items-list">
              {upstreamEdges.map((e) => {
                const src = state.network?.nodes.find((n) => n.id === e.from);
                const isDown = state.affectedEdges.includes(e.id);
                return (
                  <div
                    key={e.id}
                    className={`dep-entry ${isDown ? 'dep-down' : ''}`}
                    onClick={() => appState.setSelectedAssetId(e.from)}
                  >
                    <span className="dep-name">{src?.name || e.from}</span>
                    <span className={`dep-state-tag font-mono ${isDown ? 'tag-down' : 'tag-active'}`}>
                      {isDown ? 'OFFLINE' : 'ACTIVE'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="asset-dependency-group">
          <span className="dep-group-title font-mono">DOWNSTREAM CONSUMERS ({downstreamEdges.length})</span>
          {downstreamEdges.length === 0 ? (
            <span className="dep-empty-note">Terminal Node (End Consumer)</span>
          ) : (
            <div className="dep-items-list">
              {downstreamEdges.map((e) => {
                const target = state.network?.nodes.find((n) => n.id === e.to);
                const isDown = state.affectedEdges.includes(e.id);
                return (
                  <div
                    key={e.id}
                    className={`dep-entry ${isDown ? 'dep-down' : ''}`}
                    onClick={() => appState.setSelectedAssetId(e.to)}
                  >
                    <span className="dep-name">{target?.name || e.to}</span>
                    <span className={`dep-state-tag font-mono ${isDown ? 'tag-down' : 'tag-active'}`}>
                      {isDown ? 'CUT OFF' : 'SUPPLIED'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
