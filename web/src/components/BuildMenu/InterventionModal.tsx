import React, { useEffect, useState } from 'react';
import type { ApplicationState } from '../../state/applicationState';
import { appState } from '../../state/applicationState';
import type { Intervention } from '../../types/intervention';

interface Props {
  onClose: () => void;
}

export const InterventionModal: React.FC<Props> = ({ onClose }) => {
  const [state, setState] = useState<ApplicationState>(appState.getState());
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention | null>(null);
  const [targetAssetId, setTargetAssetId] = useState<string>('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  useEffect(() => {
    return appState.subscribe((s) => {
      setState({ ...s });
      if (s.selectedAssetId && !targetAssetId) {
        setTargetAssetId(s.selectedAssetId);
      }
    });
  }, [targetAssetId]);

  const remainingBudget = state.budgetTotal - state.budgetSpent;

  const eligibleAssets = state.network
    ? state.network.nodes.filter((node) => {
        if (!selectedIntervention) return true;
        return selectedIntervention.target_types.includes(node.type);
      })
    : [];

  const handleApply = () => {
    if (!selectedIntervention || !targetAssetId) return;

    if (selectedIntervention.cost > remainingBudget) {
      setFeedbackMsg('[ALERT] Insufficient budget remaining for this intervention.');
      return;
    }

    const ok = appState.applyIntervention(selectedIntervention.id, targetAssetId);
    if (ok) {
      setFeedbackMsg(`[SUCCESS] Deployed ${selectedIntervention.name}.`);
      setTimeout(() => setFeedbackMsg(null), 3000);
    } else {
      setFeedbackMsg('[FAILED] Could not deploy intervention.');
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container glass-panel build-modal">
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-code-tag font-mono">[HARDENING]</span>
            <div>
              <h2 className="modal-title">INFRASTRUCTURE INTERVENTION & HARDENING</h2>
              <span className="modal-sub">Deploy resilience upgrades to prevent cascading breakdown</span>
            </div>
          </div>
          <button className="dock-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="budget-bar-section">
          <div className="budget-row">
            <div className="budget-item">
              <span className="b-label">TOTAL BUDGET</span>
              <span className="b-val font-mono">₹{state.budgetTotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="budget-item">
              <span className="b-label">SPENT</span>
              <span className="b-val font-mono text-warning">
                ₹{state.budgetSpent.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="budget-item">
              <span className="b-label">REMAINING</span>
              <span className="b-val font-mono text-success">
                ₹{remainingBudget.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
          <div className="budget-progress-track">
            <div
              className="budget-progress-fill"
              style={{
                width: `${Math.min(100, (state.budgetSpent / state.budgetTotal) * 100)}%`,
              }}
            />
          </div>
        </div>

        {feedbackMsg && <div className="feedback-banner">{feedbackMsg}</div>}

        <div className="build-catalog-grid">
          {state.interventionsCatalog.map((item) => {
            const isSelected = selectedIntervention?.id === item.id;
            const canAfford = item.cost <= remainingBudget;

            return (
              <div
                key={item.id}
                className={`catalog-card ${isSelected ? 'selected' : ''} ${
                  !canAfford ? 'disabled' : ''
                }`}
                onClick={() => {
                  if (canAfford) {
                    setSelectedIntervention(item);
                  }
                }}
              >
                <div className="card-top">
                  <span className="item-name">{item.name}</span>
                  <span className="item-cost font-mono">
                    ₹{item.cost.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="targets-row">
                  <span className="target-label">Target Assets:</span>
                  {item.target_types.map((t) => (
                    <span key={t} className="target-tag">
                      {t.toUpperCase()}
                    </span>
                  ))}
                </div>

                <div className="effects-row font-mono">
                  {Object.entries(item.effects).map(([k, v]) => (
                    <div key={k} className="effect-item">
                      + {k.replace(/_/g, ' ')}: <strong>{v}</strong>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {selectedIntervention && (
          <div className="deployment-target-panel">
            <h3 className="subheading">
              Select Target Asset for {selectedIntervention.name}
            </h3>
            <div className="target-select-row">
              <select
                className="target-select"
                value={targetAssetId}
                onChange={(e) => setTargetAssetId(e.target.value)}
              >
                <option value="">-- Choose Eligible Infrastructure Node --</option>
                {eligibleAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} ({asset.type.toUpperCase()})
                  </option>
                ))}
              </select>

              <button
                className="deploy-btn btn-primary"
                onClick={handleApply}
                disabled={!targetAssetId || selectedIntervention.cost > remainingBudget}
              >
                Deploy Upgrade (₹{selectedIntervention.cost.toLocaleString('en-IN')})
              </button>
            </div>
          </div>
        )}

        <div className="applied-interventions-section">
          <h3 className="subheading">
            Applied Interventions ({state.appliedInterventions.length})
          </h3>
          {state.appliedInterventions.length === 0 ? (
            <p className="empty-hint">No upgrades deployed yet in this scenario.</p>
          ) : (
            <div className="applied-chips">
              {state.appliedInterventions.map((app, idx) => {
                const item = state.interventionsCatalog.find((i) => i.id === app.intervention_id);
                const node = state.network?.nodes.find((n) => n.id === app.target_asset_id);
                return (
                  <div key={idx} className="applied-chip font-mono">
                    <span className="chip-code">[UPGRADE]</span>
                    <span className="chip-name">{item?.name || app.intervention_id}</span>
                    <span className="chip-target">&rarr; {node?.name || app.target_asset_id}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
