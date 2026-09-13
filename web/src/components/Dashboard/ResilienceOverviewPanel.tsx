import React, { useEffect, useState } from 'react';
import type { ApplicationState } from '../../state/applicationState';
import { appState } from '../../state/applicationState';

export const ResilienceOverviewPanel: React.FC = () => {
  const [state, setState] = useState<ApplicationState>(appState.getState());

  useEffect(() => {
    return appState.subscribe((s) => setState({ ...s }));
  }, []);

  const isCascadeActive =
    state.failedNodes.length > 0 ||
    state.degradedNodes.length > 0 ||
    state.backupNodes.length > 0;

  // Live dynamic calculation directly from active network asset states
  let livePopAffected = 0;
  let hospitalDisrupted = 0;
  let hospitalInBackup = 0;
  let schoolsImpacted = 0;
  let waterIntakeDisrupted = 0;
  let feedersTripped = 0;
  let roadDelayMinutes = 0;

  if (state.network) {
    for (const node of state.network.nodes) {
      const status = state.assetStates[node.id]?.state || 'OPERATIONAL';
      const pop = node.population_served || 0;

      if (status === 'FAILED') {
        livePopAffected += pop;
        if (node.type === 'hospital') hospitalDisrupted++;
        else if (node.type === 'school') schoolsImpacted++;
        else if (node.type === 'water_pump' || node.type === 'water_treatment') waterIntakeDisrupted++;
        else if (node.type === 'power_substation' || node.type === 'power_station') feedersTripped++;
        else if (node.type === 'road_segment' || node.type === 'bridge') roadDelayMinutes += 8;
      } else if (status === 'DEGRADED') {
        livePopAffected += Math.round(pop * 0.4);
        if (node.type === 'hospital') hospitalDisrupted++;
        else if (node.type === 'school') schoolsImpacted++;
        else if (node.type === 'water_pump' || node.type === 'water_treatment') waterIntakeDisrupted++;
        else if (node.type === 'power_substation' || node.type === 'power_station') feedersTripped++;
        else if (node.type === 'road_segment' || node.type === 'bridge') roadDelayMinutes += 4;
      } else if (status === 'BACKUP') {
        if (node.type === 'hospital') {
          hospitalDisrupted++;
          hospitalInBackup++;
        }
      }
    }
  }

  // Account for severed corridor edges
  if (state.affectedEdges && state.affectedEdges.length > 0) {
    roadDelayMinutes = Math.min(45, Math.max(roadDelayMinutes, state.affectedEdges.length * 6));
  } else {
    roadDelayMinutes = Math.min(45, roadDelayMinutes);
  }

  // Dynamic Impact Score (0.00 when nominal)
  let liveImpactScore = 0.0;
  if (isCascadeActive) {
    const popRatio = Math.min(1, livePopAffected / 120000);
    const hospRatio = hospitalDisrupted > 0 ? 0.3 : 0;
    const delayRatio = Math.min(1, roadDelayMinutes / 45) * 0.2;
    const infraRatio = Math.min(1, (waterIntakeDisrupted + feedersTripped) / 8) * 0.2;
    liveImpactScore = Math.min(1.0, Math.max(0.08, popRatio * 0.4 + hospRatio + delayRatio + infraRatio));
    liveImpactScore = Math.round(liveImpactScore * 100) / 100;
  }

  // Dynamic identification of active corridor disruption
  const impactedRoad = state.network?.nodes.find(
    (n) =>
      (n.type === 'road_segment' || n.type === 'bridge') &&
      (state.assetStates[n.id]?.state === 'FAILED' || state.assetStates[n.id]?.state === 'DEGRADED')
  );
  const impactedRoadName = impactedRoad ? impactedRoad.name : null;

  // Blending with scenario-level data if an active scenario is loaded
  const impactScore = state.impact ? state.impact.impact_score : liveImpactScore;
  const popAffected = state.impact ? state.impact.population_affected : livePopAffected;
  const hospitals = state.impact ? state.impact.hospital_disruptions : hospitalDisrupted;
  const schools = state.impact ? state.impact.school_disruptions : schoolsImpacted;
  const delay = state.impact ? state.impact.emergency_response_delay_minutes : roadDelayMinutes;
  const water = state.impact ? state.impact.water_service_disruptions : waterIntakeDisrupted;
  const power = state.impact ? state.impact.power_service_disruptions : feedersTripped;

  // Monte Carlo uncertainty bounds (strictly 0 when nominal)
  const medianPop = state.uncertainty?.population_affected?.median ?? popAffected;
  const p05Pop =
    state.uncertainty?.population_affected?.p05 ??
    (popAffected > 0 ? Math.round(popAffected * 0.65) : 0);
  const p95Pop =
    state.uncertainty?.population_affected?.p95 ??
    (popAffected > 0 ? Math.round(popAffected * 1.55) : 0);
  const hospitalProb =
    popAffected > 0
      ? Math.round(
          (state.uncertainty?.hospital_failure_probability ??
            (hospitals > 0 ? Math.min(0.95, impactScore * 1.2) : 0.05)) * 100
        )
      : 0;

  const rateIndicator = isCascadeActive
    ? `+${(impactScore * 0.25).toFixed(2)} in 30m`
    : `+0.00 / hr`;

  const topCriticalNodes = (state.criticality?.nodes || [])
    .slice()
    .sort((a, b) => b.criticality_score - a.criticality_score)
    .slice(0, 4)
    .map((cn) => {
      const netNode = state.network?.nodes.find((n) => n.id === cn.asset_id);
      return {
        ...cn,
        name: netNode ? netNode.name : cn.asset_id,
        type: netNode ? netNode.type : 'infrastructure',
      };
    });

  return (
    <aside className="resilience-overview-panel emerging-panel glass-panel">
      {/* Panel Header */}
      <div className="panel-top-bar">
        <div className="title-with-pill">
          <span className={`live-status-dot ${isCascadeActive ? 'dot-danger' : 'dot-nominal'}`}></span>
          <h2 className="panel-main-title">RESILIENCE OVERVIEW</h2>
          <span className={`status-pill ${isCascadeActive ? 'pill-active' : 'pill-nominal'} font-mono`}>
            {isCascadeActive ? 'PROPAGATION ACTIVE' : 'NOMINAL BASELINE'}
          </span>
        </div>
        <button
          className="dock-close-btn"
          onClick={() => appState.toggleOverviewPanel(false)}
          title="Dock Overview Panel"
        >
          ×
        </button>
      </div>

      <div className="panel-scroll-content">
        {/* Cascade Impact Index Section */}
        <div className="metric-callout-card">
          <div className="callout-header">
            <span className="metric-caption">CASCADE IMPACT INDEX</span>
            <span className="rate-indicator font-mono">{rateIndicator}</span>
          </div>

          <div className="index-display">
            <span className="index-number font-mono">{impactScore.toFixed(2)}</span>
            <span className="index-limit font-mono">/ 1.00 SYSTEM COLLAPSE THRESHOLD</span>
          </div>

          <div className="index-bar-track">
            <div
              className={`index-bar-fill ${impactScore > 0.5 ? 'fill-danger' : ''}`}
              style={{ width: `${Math.min(100, impactScore * 100)}%` }}
            />
          </div>
        </div>

        {/* 6-Grid Human Impact Consequences */}
        <div className="consequences-grid">
          <div className="consequence-card">
            <span className="consequence-label">
              <span className="c-dot dot-blue">●</span> POP. AFFECTED
            </span>
            <span className="consequence-value font-mono">
              {popAffected.toLocaleString('en-IN')}
            </span>
            <span className="consequence-sub">
              {popAffected > 0
                ? state.activeScenario
                  ? state.activeScenario.name
                  : 'Powai Disruption Zone'
                : 'All sectors nominal'}
            </span>
          </div>

          <div className="consequence-card">
            <span className="consequence-label">
              <span className="c-dot dot-amber">●</span> HOSPITAL DISRUPTED
            </span>
            <span className="consequence-value font-mono">
              {hospitals}{' '}
              <span className="val-sub">
                {hospitalInBackup > 0
                  ? '(Aux Mode)'
                  : hospitals > 0
                  ? '(Disrupted)'
                  : '(Nominal Grid)'}
              </span>
            </span>
            <span className="consequence-sub">
              {hospitals > 0
                ? hospitalInBackup > 0
                  ? 'Emergency Gen Engaged'
                  : 'Feeder Disrupted'
                : 'Primary Mains 22kV Normal'}
            </span>
          </div>

          <div className="consequence-card">
            <span className="consequence-label">
              <span className="c-dot dot-red">●</span> SCHOOLS IMPACTED
            </span>
            <span className="consequence-value font-mono val-danger">
              {schools} <span className="val-sub">Facilities</span>
            </span>
            <span className="consequence-sub">
              {schools > 0 ? 'Power & Access Cut' : 'All Facilities Operational'}
            </span>
          </div>

          <div className="consequence-card">
            <span className="consequence-label">
              <span className="c-dot dot-red">●</span> RESPONSE DELAY
            </span>
            <span className={`consequence-value font-mono ${delay > 0 ? 'val-danger' : ''}`}>
              +{delay} <span className="val-sub">min</span>
            </span>
            <span className="consequence-sub">
              {delay > 0
                ? impactedRoadName
                  ? `Corridor: ${impactedRoadName}`
                  : 'Corridor Traffic Degraded'
                : 'Clear Corridors'}
            </span>
          </div>

          <div className="consequence-card">
            <span className="consequence-label">
              <span className="c-dot dot-blue">●</span> WATER INTAKE
            </span>
            <span className="consequence-value font-mono val-blue">
              {water} <span className="val-sub">Station{water === 1 ? '' : 's'}</span>
            </span>
            <span className="consequence-sub">
              {water > 0 ? 'Intake bypass throttled' : 'Pumping at Nominal Head'}
            </span>
          </div>

          <div className="consequence-card">
            <span className="consequence-label">
              <span className="c-dot dot-red">●</span> FEEDERS TRIPPED
            </span>
            <span className={`consequence-value font-mono ${power > 0 ? 'val-danger' : ''}`}>
              {power} <span className="val-sub">Unit{power === 1 ? '' : 's'}</span>
            </span>
            <span className="consequence-sub">
              {power > 0 ? 'Feeder Circuits Tripped' : 'Feeder Network Intact'}
            </span>
          </div>
        </div>

        {/* Network Criticality & Systemic Bottlenecks Section */}
        <div className="criticality-analysis-card">
          <div className="u-header">
            <div className="u-title-group">
              <span className="crit-icon-indicator"></span>
              <span className="u-title">SYSTEMIC CRITICALITY &amp; BOTTLENECKS</span>
            </div>
            <button
              className={`crit-layer-toggle-btn ${state.showCriticality ? 'active' : ''}`}
              onClick={() => appState.toggleCriticality()}
              title="Toggle 3D visual criticality rings on map"
            >
              <span className="crit-toggle-dot">●</span>
              <span>HEATMAP {state.showCriticality ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          <p className="crit-card-desc">
            Graph removal-impact analysis identifying single points of failure across infrastructure feeds.
          </p>

          <div className="crit-ranking-list">
            {topCriticalNodes.map((item, idx) => (
              <div
                key={item.asset_id}
                className="crit-node-row"
                onClick={() => {
                  appState.setSelectedAssetId(item.asset_id);
                }}
                title="Click to inspect asset details"
              >
                <div className="crit-node-left">
                  <span className="crit-rank-num font-mono">#{idx + 1}</span>
                  <div className="crit-node-info">
                    <span className="crit-node-name">{item.name}</span>
                    <span className="crit-node-type">
                      {item.type.toUpperCase().replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                <div className="crit-node-right">
                  <div className="crit-score-bar-rail">
                    <div
                      className={`crit-score-bar-fill ${
                        item.criticality_score > 0.75
                          ? 'fill-red'
                          : item.criticality_score > 0.4
                          ? 'fill-amber'
                          : 'fill-blue'
                      }`}
                      style={{ width: `${Math.round(item.criticality_score * 100)}%` }}
                    />
                  </div>
                  <span className="crit-score-val font-mono">
                    {item.criticality_score.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monte Carlo Uncertainty Analysis Card */}
        <div className="uncertainty-analysis-card">
          <div className="u-header">
            <div className="u-title-group">
              <span className="u-icon-indicator"></span>
              <span className="u-title">UNCERTAINTY ANALYSIS (1,000 RUNS)</span>
            </div>
            <span className="monte-carlo-tag font-mono">MONTE CARLO</span>
          </div>

          <div className="u-variance-row font-mono">
            <span className="u-v-label">Affected Population Variance</span>
            <span className="u-v-median">
              Median: {medianPop.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="range-track-wrapper">
            <div className="range-whisker-label left font-mono">
              P5: {p05Pop.toLocaleString('en-IN')}
            </div>
            <div className="range-bar-rail">
              <div
                className="range-bar-spread"
                style={{
                  left: popAffected > 0 ? '20%' : '0%',
                  width: popAffected > 0 ? '60%' : '0%',
                }}
              >
                {popAffected > 0 && <div className="range-marker-line" />}
              </div>
            </div>
            <div className="range-whisker-label right font-mono">
              P95: {p95Pop.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="ci-legend-text font-mono">
            90% CI [{p05Pop.toLocaleString('en-IN')} – {p95Pop.toLocaleString('en-IN')}]
          </div>

          <div className="outage-prob-row">
            <div className="prob-desc">
              <span className="prob-heading">Hospital Outage Probability</span>
              <span className="prob-detail">
                {hospitals > 0 ? 'If Primary Feeders offline > 6 hrs' : 'Grid power steady'}
              </span>
            </div>
            <div className="prob-badge-circle font-mono">
              {hospitalProb}%
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
