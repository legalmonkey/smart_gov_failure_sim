import React, { useEffect, useState } from 'react';
import type { ApplicationState } from '../../state/applicationState';
import { appState } from '../../state/applicationState';
import { getAssetDescriptor, STATE_COLORS, STATE_LABELS } from '../../infrastructure/assetRegistry';

export const HoverActionCard: React.FC = () => {
  const [state, setState] = useState<ApplicationState>(appState.getState());

  useEffect(() => {
    return appState.subscribe((s) => setState({ ...s }));
  }, []);

  const hoveredId = state.hoveredAssetId;
  const hoverPos = state.hoverScreenPos;

  if (!hoveredId || !hoverPos || !state.network) {
    return null;
  }

  const asset = state.network.nodes.find((n) => n.id === hoveredId);
  if (!asset) {
    return null;
  }

  const desc = getAssetDescriptor(asset.type);
  const statusInfo = state.assetStates[asset.id];
  const currentState = statusInfo ? statusInfo.state : asset.status;
  const currentLoad = statusInfo ? statusInfo.load : asset.load;
  const stateColorHex = STATE_COLORS[currentState]
    ? STATE_COLORS[currentState].toString(16).padStart(6, '0')
    : '059669';

  const isFailed = currentState === 'FAILED';

  // Count dependencies
  const upstreamCount = state.network.edges.filter((e) => e.to === asset.id).length;
  const downstreamCount = state.network.edges.filter((e) => e.from === asset.id).length;

  // Viewport clamping
  const cardWidth = 270;
  const cardHeight = 175;
  let posX = hoverPos.x + 18;
  let posY = hoverPos.y - 25;

  const rightMargin = (state.selectedAssetId || state.showCascadePanel) ? 415 : 10;
  if (posX + cardWidth > window.innerWidth - rightMargin) {
    posX = hoverPos.x - cardWidth - 18;
  }
  if (posX < 10) {
    posX = 10;
  }

  const bottomLimit = state.showSimulationBar ? window.innerHeight - 145 : window.innerHeight - 10;
  if (posY + cardHeight > bottomLimit) {
    posY = bottomLimit - cardHeight;
  }
  if (posY < 10) {
    posY = 10;
  }

  const handleBreak = (e: React.MouseEvent) => {
    e.stopPropagation();
    appState.triggerManualFailure(asset.id);
  };

  const handleRepair = (e: React.MouseEvent) => {
    e.stopPropagation();
    appState.repairAsset(asset.id);
  };

  const handleInspect = (e: React.MouseEvent) => {
    e.stopPropagation();
    appState.setSelectedAssetId(asset.id);
  };

  const handleProtect = (e: React.MouseEvent) => {
    e.stopPropagation();
    appState.setSelectedAssetId(asset.id);
    appState.setActiveTab('interventions');
  };

  return (
    <div
      className="hover-action-card emerging-panel glass-panel"
      style={{
        left: `${posX}px`,
        top: `${posY}px`,
      }}
      onMouseEnter={() => {}}
      onMouseLeave={() => {
        appState.setHoveredAsset(null, null);
      }}
    >
      <div className="hover-card-header">
        <div className="hover-title-group">
          <span className="hover-node-badge font-mono">[+]</span>
          <div className="hover-text-block">
            <h4 className="hover-title">{asset.name}</h4>
            <span className="hover-type font-mono">{desc.displayName.toUpperCase()}</span>
          </div>
        </div>
        <span
          className="hover-status-badge font-mono"
          style={{
            backgroundColor: `#${stateColorHex}15`,
            color: `#${stateColorHex}`,
            borderColor: `#${stateColorHex}44`,
          }}
        >
          ● {STATE_LABELS[currentState] || currentState}
        </span>
      </div>

      <div className="hover-card-stats font-mono">
        <div className="hover-stat">
          <span className="stat-name">LOAD</span>
          <span className="stat-val">{currentLoad} / {asset.capacity}</span>
        </div>
        <div className="hover-stat">
          <span className="stat-name">FEEDERS</span>
          <span className="stat-val">{upstreamCount}</span>
        </div>
        <div className="hover-stat">
          <span className="stat-name">SERVES</span>
          <span className="stat-val">
            {asset.population_served ? `${asset.population_served.toLocaleString('en-IN')}` : `${downstreamCount} links`}
          </span>
        </div>
      </div>

      <div className="hover-card-actions">
        {isFailed ? (
          <button
            className="hover-btn btn-repair font-mono"
            onClick={handleRepair}
            title="Restore this asset"
          >
            RESTORE
          </button>
        ) : (
          <button
            className="hover-btn btn-break font-mono"
            onClick={handleBreak}
            title="Simulate failure / break this asset"
          >
            BREAK ASSET
          </button>
        )}

        <button
          className="hover-btn btn-inspect font-mono"
          onClick={handleInspect}
          title="Open full dependency inspector"
        >
          INSPECT
        </button>

        <button
          className="hover-btn btn-upgrade font-mono"
          onClick={handleProtect}
          title="Deploy resilience protection"
        >
          PROTECT
        </button>
      </div>
    </div>
  );
};
