import React, { useEffect, useState } from 'react';
import type { ApplicationState } from '../../state/applicationState';
import { appState } from '../../state/applicationState';

interface Props {
  onClose: () => void;
  onHighlightOptimalAssets?: (assetIds: string[]) => void;
}

export const AdvisorModal: React.FC<Props> = ({ onClose, onHighlightOptimalAssets }) => {
  const [state, setState] = useState<ApplicationState>(appState.getState());

  useEffect(() => {
    return appState.subscribe((s) => setState({ ...s }));
  }, []);

  const advisor = state.advisor;
  if (!advisor) return null;

  const userReduction = Math.round((advisor.user_plan?.impact_reduction ?? 0) * 100);
  const optimalReduction = Math.round((advisor.optimal_plan?.impact_reduction ?? 0) * 100);

  const handleShowOptimalPlan = () => {
    const optimalAssetIds = advisor.optimal_plan.selected_interventions?.map(
      (i) => i.target_asset_id
    ) || [];

    if (optimalAssetIds.length > 0) {
      if (onHighlightOptimalAssets) {
        onHighlightOptimalAssets(optimalAssetIds);
      }
      appState.setSelectedAssetId(optimalAssetIds[0]);
    }
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container glass-panel advisor-modal">
        <div className="modal-header">
          <div className="modal-title-group">
            <div>
              <h2 className="modal-title">RESILIENCE DECISION ADVISOR</h2>
              <span className="modal-sub">AI Infrastructure Optimization &amp; Explanation (Track 4)</span>
            </div>
          </div>
          <button className="dock-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="advisor-callout-box">
          <div className="callout-card user-card">
            <span className="callout-tag font-mono">YOUR CURRENT PLAN</span>
            <div className="callout-stat font-mono text-warning">+{userReduction}%</div>
            <span className="callout-sub">Cascade damage reduction</span>
          </div>

          <div className="callout-vs font-mono">VS</div>

          <div className="callout-card optimal-card">
            <span className="callout-tag font-mono">OPTIMAL ALLOCATION</span>
            <div className="callout-stat font-mono text-success">+{optimalReduction}%</div>
            <span className="callout-sub">Cascade damage reduction</span>
          </div>
        </div>

        <div className="reasons-section">
          <h3 className="reasons-title font-mono">ROOT CAUSE ANALYSIS: OPTIMAL PLAN COMPARISON</h3>
          <ol className="reasons-list">
            {advisor.priority_reasons.map((reason, idx) => (
              <li key={idx} className="reason-item">
                <span className="reason-num font-mono">{idx + 1}.</span>
                <span className="reason-text">{reason}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="missed-assets-box">
          <h4 className="missed-title font-mono">CRITICAL UNPROTECTED BOTTLENECKS:</h4>
          <div className="missed-chips font-mono">
            {advisor.missed_critical_assets.map((id) => {
              const node = state.network?.nodes.find((n) => n.id === id);
              return (
                <span key={id} className="missed-chip">
                  [NODE] {node?.name || id}
                </span>
              );
            })}
            {advisor.missed_critical_edges.map((edgeId) => (
              <span key={edgeId} className="missed-chip edge-chip">
                [EDGE] {edgeId}
              </span>
            ))}
          </div>
        </div>

        <div className="advisor-footer">
          <button className="optimal-plan-btn btn-primary font-mono" onClick={handleShowOptimalPlan}>
            SHOW OPTIMAL PLAN ON 3D MAP
          </button>
        </div>
      </div>
    </div>
  );
};
