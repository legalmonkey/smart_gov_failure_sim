import React, { useEffect, useState } from 'react';
import type { ApplicationState } from '../../state/applicationState';
import { appState } from '../../state/applicationState';
import { UncertaintyCard } from './UncertaintyCard';

export const ImpactMetricsPanel: React.FC = () => {
  const [state, setState] = useState<ApplicationState>(appState.getState());

  useEffect(() => {
    return appState.subscribe((s) => setState({ ...s }));
  }, []);

  const impact = state.impact;
  if (!impact) return null;

  const scorePct = Math.round(impact.impact_score * 100);

  return (
    <div className="impact-dock-inner">
      <div className="dashboard-header">
        <div className="dash-title-group">
          <span className="dash-icon font-mono">[METRICS]</span>
          <div>
            <h2 className="dash-title">RESILIENCE METRICS</h2>
            <span className="dash-sub">Powai Lake & Hiranandani Urban Consequences</span>
          </div>
        </div>

        <div className="score-badge-box">
          <span className="score-label">CASCADE IMPACT</span>
          <div className="score-value-row">
            <span className="score-val font-mono">{impact.impact_score.toFixed(2)}</span>
            <div className="score-meter-bg">
              <div
                className="score-meter-fill"
                style={{ width: `${scorePct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="metrics-summary-grid">
        <div className="metric-tile">
          <span className="tile-icon font-mono">[POP]</span>
          <div className="tile-content">
            <span className="tile-label">POPULATION AFFECTED</span>
            <span className="tile-val font-mono">
              {impact.population_affected.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        <div className="metric-tile">
          <span className="tile-icon font-mono">[HOSP]</span>
          <div className="tile-content">
            <span className="tile-label">HOSPITALS DISRUPTED</span>
            <span className="tile-val font-mono text-danger">
              {impact.hospital_disruptions}
            </span>
          </div>
        </div>

        <div className="metric-tile">
          <span className="tile-icon font-mono">[SCHL]</span>
          <div className="tile-content">
            <span className="tile-label">SCHOOLS DISRUPTED</span>
            <span className="tile-val font-mono">
              {impact.school_disruptions}
            </span>
          </div>
        </div>

        <div className="metric-tile">
          <span className="tile-icon font-mono">[EMS]</span>
          <div className="tile-content">
            <span className="tile-label">EMERGENCY DELAY</span>
            <span className="tile-val font-mono text-warning">
              +{impact.emergency_response_delay_minutes} min
            </span>
          </div>
        </div>

        <div className="metric-tile">
          <span className="tile-icon font-mono">[WTR]</span>
          <div className="tile-content">
            <span className="tile-label">WATER SERVICE CUT</span>
            <span className="tile-val font-mono">
              {impact.water_service_disruptions} Facility
            </span>
          </div>
        </div>

        <div className="metric-tile">
          <span className="tile-icon font-mono">[ELEC]</span>
          <div className="tile-content">
            <span className="tile-label">POWER FEEDER LOSS</span>
            <span className="tile-val font-mono text-danger">
              {impact.power_service_disruptions} Feeders
            </span>
          </div>
        </div>
      </div>

      <UncertaintyCard uncertainty={state.uncertainty} />
    </div>
  );
};
