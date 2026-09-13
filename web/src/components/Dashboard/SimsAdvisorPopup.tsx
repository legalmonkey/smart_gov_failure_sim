import React, { useEffect, useState } from 'react';
import type { ApplicationState } from '../../state/applicationState';
import { appState } from '../../state/applicationState';

interface Props {
  onClose: () => void;
  onShowOptimalPlan?: (assetIds: string[]) => void;
}

export const SimsAdvisorPopup: React.FC<Props> = ({ onClose, onShowOptimalPlan }) => {
  const [state, setState] = useState<ApplicationState>(appState.getState());

  useEffect(() => {
    return appState.subscribe((s) => setState({ ...s }));
  }, []);

  const impact = state.impact;
  const uncertainty = state.uncertainty;
  const advisor = state.advisor;

  const handleShowOptimal = () => {
    if (advisor?.optimal_plan && onShowOptimalPlan) {
      const assetIds = advisor.optimal_plan.selected_interventions
        ? advisor.optimal_plan.selected_interventions.map((i) => i.target_asset_id)
        : [];
      if (assetIds.length > 0) {
        onShowOptimalPlan(assetIds);
      }
    }
    onClose();
  };

  // Calculate live state metrics
  const isCascadeActive =
    state.failedNodes.length > 0 ||
    state.degradedNodes.length > 0 ||
    state.backupNodes.length > 0;

  const popVal = impact?.population_affected ?? 0;
  const hospVal = impact?.hospital_disruptions ?? 0;
  const waterVal = impact?.water_service_disruptions ?? 0;
  const delayVal = impact?.emergency_response_delay_minutes ?? 0;

  // Monte Carlo bounds directly from Track 3 stochastic results
  const medianVal = uncertainty?.population_affected?.median ?? popVal;
  const p05Val = uncertainty?.population_affected?.p05 ?? popVal;
  const p95Val = uncertainty?.population_affected?.p95 ?? popVal;
  const hospProb = Math.round((uncertainty?.hospital_failure_probability ?? 0) * 100);

  // Dynamic user plan reduction and optimal reduction directly from Track 4
  const userPlanReduction = Math.round((advisor?.user_plan?.impact_reduction ?? 0) * 100);
  const optimalReduction = Math.round((advisor?.optimal_plan?.impact_reduction ?? 0) * 100);

  return (
    <div className="modal-backdrop">
      <div className="modal-container glass-panel sims-advisor-dialog">
        {/* Executive Header */}
        <div className="sims-header">
          <div className="sims-avatar-bubble font-mono">VR</div>
          <div className="sims-dialog-header">
            <div className="sims-speaker-tag font-mono">EXECUTIVE RESILIENCE DIRECTIVE</div>
            <h2 className="sims-dialog-quote">
              {isCascadeActive
                ? '“Director, here is the post-cascade infrastructure impact synthesis.”'
                : '“Director, all Powai and Hiranandani infrastructure systems are operating nominally.”'}
            </h2>
          </div>
          <button className="dock-close-btn" onClick={onClose} title="Close summary">
            ×
          </button>
        </div>

        <div className="sims-content-grid">
          {/* 1. Human Impact Cards */}
          <div className="sims-section impact-box">
            <h3 className="sims-section-title font-mono">HUMAN CONSEQUENCES &amp; SERVICE LOSS</h3>
            <div className="sims-metrics-cards">
              <div className="sims-metric-card primary">
                <span className="metric-tag-box font-mono">POP</span>
                <div className="metric-body">
                  <span className="metric-label">PEOPLE AFFECTED</span>
                  <span className="metric-big font-mono">
                    {popVal.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="sims-metric-card danger">
                <span className="metric-tag-box font-mono">HOSP</span>
                <div className="metric-body">
                  <span className="metric-label">HOSPITAL DISRUPTIONS</span>
                  <span className="metric-big font-mono">
                    {hospVal} {hospVal === 1 ? 'facility' : 'facilities'}
                  </span>
                  <span className="metric-sub">
                    {hospVal > 0 ? 'Auxiliary power engaged' : 'Primary grid supply stable'}
                  </span>
                </div>
              </div>

              <div className="sims-metric-card warning">
                <span className="metric-tag-box font-mono">WTR</span>
                <div className="metric-body">
                  <span className="metric-label">WATER LOSS</span>
                  <span className="metric-big font-mono">
                    {waterVal.toLocaleString('en-IN')}
                  </span>
                  <span className="metric-sub">
                    {waterVal > 0 ? 'Households lost clean water' : 'All pumping stations nominal'}
                  </span>
                </div>
              </div>

              <div className="sims-metric-card alert">
                <span className="metric-tag-box font-mono">EMS</span>
                <div className="metric-body">
                  <span className="metric-label">EMERGENCY DELAY</span>
                  <span className="metric-big font-mono">+{delayVal} min</span>
                  <span className="metric-sub">
                    {delayVal > 0 ? 'Arterial corridor congestion' : 'Clear ambulance corridors'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Honest Uncertainty Spread */}
          <div className="sims-section uncertainty-box">
            <h3 className="sims-section-title font-mono">HONEST UNCERTAINTY (MONTE CARLO SAMPLING)</h3>
            <div className="uncertainty-range-display">
              <div className="range-labels font-mono">
                <span>p05: {p05Val.toLocaleString('en-IN')}</span>
                <span className="range-median font-bold">
                  MEDIAN: {medianVal.toLocaleString('en-IN')}
                </span>
                <span>p95: {p95Val.toLocaleString('en-IN')}</span>
              </div>
              <div className="range-bar-track">
                <div
                  className="range-bar-likely"
                  style={{
                    left: popVal > 0 ? '20%' : '0%',
                    width: popVal > 0 ? '60%' : '0%',
                  }}
                >
                  {popVal > 0 && <div className="range-median-marker" style={{ left: '50%' }} />}
                </div>
              </div>
              <span className="range-caption font-mono">
                90% confidence interval across dynamic load fluctuations &amp; reserve duration
              </span>
            </div>

            <div className="probability-gauge-row">
              <div className="prob-label-group">
                <span className="prob-title">Hospital Failure Probability within 6h</span>
                <span className="prob-val font-mono">{hospProb}%</span>
              </div>
              <div className="prob-bar-track">
                <div
                  className="prob-bar-fill"
                  style={{
                    width: `${hospProb}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* 3. AI Advisor Plan Evaluation */}
          <div className="sims-section advisor-box">
            <h3 className="sims-section-title font-mono">AI RESILIENCE EVALUATION</h3>
            <div className="advisor-verdict-card">
              <p className="advisor-speech">
                {isCascadeActive ? (
                  <>
                    “Your plan reduced cascade damage by{' '}
                    <strong className="text-primary font-mono">{userPlanReduction}%</strong>.
                    However, the mathematically best allocation for this exact same budget would have reduced damage by{' '}
                    <strong className="text-success font-mono">{optimalReduction}%</strong>!”
                  </>
                ) : (
                  '“Baseline grid is currently intact. Introduce infrastructure disruptions or test scenarios to analyze AI resilience optimization.”'
                )}
              </p>

              <div className="advisor-reasons">
                <h4 className="reasons-head font-mono">KEY VULNERABILITY FINDINGS:</h4>
                <ul className="reasons-list">
                  {advisor?.priority_reasons && advisor.priority_reasons.length > 0 ? (
                    advisor.priority_reasons.map((r: string, i: number) => (
                      <li key={i}>
                        <span className="reason-num font-mono">{i + 1}.</span> {r}
                      </li>
                    ))
                  ) : (
                    <li>
                      <span className="reason-num font-mono">1.</span> All critical infrastructure assets are currently within normal operating safety margins.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sims-dialog-footer">
          <button className="btn btn-secondary font-mono" onClick={onClose}>
            DISMISS
          </button>
          <button className="btn btn-primary btn-optimal font-mono" onClick={handleShowOptimal}>
            SHOW OPTIMAL PLAN ON 3D MAP
          </button>
        </div>
      </div>
    </div>
  );
};
