import React, { useEffect, useState } from 'react';
import type { ApplicationState } from '../../state/applicationState';
import { appState } from '../../state/applicationState';

interface Props {
  onResetCamera?: () => void;
}

export const FloatingSimulationDock: React.FC<Props> = ({ onResetCamera }) => {
  const [state, setState] = useState<ApplicationState>(appState.getState());

  useEffect(() => {
    return appState.subscribe((s) => setState({ ...s }));
  }, []);

  const hours = Math.floor(state.simulationTime);
  const minutes = Math.floor((state.simulationTime - hours) * 60);
  const timeFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  const progressPercent = (state.simulationTime / 24) * 100;

  const activeEventCount = state.events.filter((e) => e.time <= state.simulationTime).length;
  const remainingHours = Math.max(0, 24 - state.simulationTime);
  const remH = Math.floor(remainingHours);
  const remM = Math.floor((remainingHours - remH) * 60);

  const hoursMarks = [0, 3, 6, 9, 12, 15, 18, 21, 24];

  const isCascadeActive =
    state.failedNodes.length > 0 ||
    state.degradedNodes.length > 0 ||
    state.backupNodes.length > 0;

  const isAtStart = state.simulationTime === 0;
  const isComplete = state.simulationTime >= 24;

  const currentImpact = state.impact?.impact_score ?? (isCascadeActive ? 0.35 : 0.0);
  const popAffected = state.impact?.population_affected ?? 0;
  const hospDisruptions = state.impact?.hospital_disruptions ?? 0;

  const handleRunScenario = () => {
    if (isComplete) {
      appState.resetSimulation();
      setTimeout(() => appState.play(), 50);
    } else {
      appState.play();
    }
  };

  const handleExportMetrics = () => {
    const report = {
      scenario: state.activeScenario ? state.activeScenario.name : 'Custom / Live Baseline',
      simulationTime: timeFormatted,
      impactScore: currentImpact,
      populationAffected: popAffected,
      hospitalsDisrupted: hospDisruptions,
      schoolsImpacted: state.impact?.school_disruptions ?? 0,
      emergencyDelay: state.impact?.emergency_response_delay_minutes ?? 0,
      failedNodes: state.failedNodes,
      backupNodes: state.backupNodes,
      appliedInterventions: state.appliedInterventions,
      eventsCount: state.events.length,
      timestamp: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cascade-sim-${(state.activeScenario?.id || 'live')}-t${timeFormatted.replace(':', '')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Group events by approximate timestamp to display clean milestone markers on rail
  const eventMarkers = state.events.filter(
    (ev, idx, arr) => arr.findIndex((x) => Math.abs(x.time - ev.time) < 0.25) === idx
  );

  return (
    <div className="floating-simulation-bar glass-panel emerging-panel">
      {/* Top Controls & Telemetry Row */}
      <div className="sim-dock-top-row">
        <div className="sim-left-controls">
          {/* Prominent Run Button when at T=0 */}
          {isAtStart && !state.isPlaying && (
            <button
              className="sim-run-scenario-cta font-mono"
              onClick={handleRunScenario}
              title="Execute dynamic cascading failure simulation"
            >
              ▶ RUN SCENARIO
            </button>
          )}

          {/* Main Playback Buttons */}
          <div className="sim-playback-btn-group font-mono">
            <button
              className="sim-ctrl-square-btn"
              onClick={() => appState.resetSimulation()}
              title="Rewind to 00:00"
            >
              |&lt;
            </button>

            {state.isPlaying ? (
              <button
                className="sim-ctrl-primary-btn active-pause"
                onClick={() => appState.pause()}
                title="Pause simulation playback"
              >
                ||
              </button>
            ) : (
              <button
                className="sim-ctrl-primary-btn active-play"
                onClick={handleRunScenario}
                title={isComplete ? 'Replay simulation' : 'Start/Resume simulation playback'}
              >
                {isComplete ? '↺' : '▶'}
              </button>
            )}

            <button
              className="sim-ctrl-square-btn"
              onClick={() => appState.stepForward(0.5)}
              title="Step Forward +30 Minutes"
            >
              &gt;|
            </button>
          </div>

          {/* Speed Selector Pills */}
          <div className="sim-speed-pill-group font-mono">
            {[1, 2, 4].map((spd) => (
              <button
                key={spd}
                className={`sim-speed-pill ${state.playbackSpeed === spd ? 'active' : ''}`}
                onClick={() => appState.setPlaybackSpeed(spd)}
                title={`Playback Speed: ${spd}x real-time`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Active Scenario Pill / Context Badge */}
          {state.activeScenario ? (
            <div className="sim-scenario-pill font-mono">
              <span className="sim-sc-badge">SCENARIO</span>
              <span className="sim-sc-name" title={state.activeScenario.description}>
                {state.activeScenario.name}
              </span>
              <button
                className="sim-sc-switch-btn"
                onClick={() => appState.setActiveTab('compare')}
                title="Switch or Browse Scenarios Library"
              >
                SWITCH
              </button>
            </div>
          ) : (
            <div className="sim-scenario-pill nominal font-mono">
              <span className="sim-sc-badge">NOMINAL</span>
              <span className="sim-sc-name">Powai Infrastructure</span>
              <button
                className="sim-sc-switch-btn cta-load"
                onClick={() => appState.setActiveTab('compare')}
                title="Load a Disaster Scenario from Library"
              >
                LOAD SCENARIO
              </button>
            </div>
          )}

          {/* Current Simulation Clock */}
          <div className="sim-clock-display font-mono">
            <span className="sim-clock-hours">{timeFormatted}</span>
            <span className="sim-clock-total">/ 24:00</span>
          </div>

          {/* Peak / Live Impact Badge */}
          <span
            className={`sim-peak-impact-badge font-mono ${
              currentImpact > 0.45 ? 'badge-danger' : currentImpact > 0.15 ? 'badge-warning' : 'badge-success'
            }`}
          >
            IMPACT: {currentImpact.toFixed(2)}
          </span>
        </div>

        {/* Center/Right Status Indicators & Actions */}
        <div className="sim-right-status-group">
          <div className="sim-status-telemetry font-mono">
            <span className="sim-event-count">
              <span className="c-dot dot-red">●</span> {activeEventCount}/{state.events.length} Events
            </span>
            {popAffected > 0 && (
              <span className="sim-pop-count">
                POP: {popAffected.toLocaleString('en-IN')} Affected
              </span>
            )}
            {hospDisruptions > 0 && (
              <span className="sim-hosp-count text-danger">
                HOSP: {hospDisruptions} In Risk
              </span>
            )}
            <span className="sim-time-remaining">
              <span className="c-dot dot-indigo">●</span> Rem: {remH}h {String(remM).padStart(2, '0')}m
            </span>
          </div>

          {/* View Resilience Advice CTA */}
          {(isComplete || (state.simulationTime > 2 && currentImpact > 0)) && (
            <button
              className="sim-advice-cta-btn font-mono"
              onClick={() => appState.openSummaryModal(true)}
              title="View AI Advisor plan comparison and mitigation insights"
            >
              VIEW ADVICE
            </button>
          )}

          <button
            className="sim-export-btn font-mono"
            onClick={handleExportMetrics}
            title="Download telemetry metrics report"
          >
            EXPORT
          </button>

          {state.activeHazard && (
            <button
              className="sim-reset-cam-btn font-mono"
              style={{
                background: state.hazardOverlayVisible ? '#f0f9ff' : '#ffffff',
                borderColor: state.hazardOverlayVisible ? '#0284c7' : '#cbd5e1',
                color: state.hazardOverlayVisible ? '#0369a1' : '#64748b',
                fontWeight: 800,
              }}
              onClick={() => appState.setHazardOverlayVisible(!state.hazardOverlayVisible)}
              title="Toggle 3D Hazard Footprint Overlay"
            >
              {state.hazardOverlayVisible ? 'HAZARD ON' : 'HAZARD OFF'}
            </button>
          )}

          {onResetCamera && (
            <button
              className="sim-reset-cam-btn font-mono"
              onClick={onResetCamera}
              title="Reset Isometric Camera Angle"
            >
              CAMERA
            </button>
          )}

          <button
            className="dock-close-btn sim-dock-x-btn"
            onClick={() => appState.toggleSimulationBar(false)}
            title="Minimize simulation timeline"
          >
            ×
          </button>
        </div>
      </div>

      {/* Bottom Scrubber Track Row */}
      <div className="sim-scrubber-timeline-row">
        <div className="scrubber-track-container">
          <input
            type="range"
            min="0"
            max="24"
            step="0.1"
            value={state.simulationTime}
            onChange={(e) => appState.setSimulationTime(parseFloat(e.target.value))}
            className="sim-range-input"
          />

          {/* Multi-stage risk colored progress rail */}
          <div className="sim-colored-rail">
            <div
              className="rail-risk-fill"
              style={{ width: `${progressPercent}%` }}
            />

            {/* Event Markers along the rail */}
            <div className="sim-event-markers">
              {eventMarkers.map((ev, i) => {
                const tickPct = Math.min(100, Math.max(0, (ev.time / 24) * 100));
                const tickClass =
                  ev.event === 'asset_failed'
                    ? 'tick-failed'
                    : ev.event === 'asset_degraded'
                    ? 'tick-degraded'
                    : ev.event === 'asset_backup'
                    ? 'tick-backup'
                    : 'tick-edge';

                return (
                  <div
                    key={i}
                    className={`sim-event-tick ${tickClass}`}
                    style={{ left: `${tickPct}%` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      appState.setSimulationTime(ev.time);
                    }}
                    title={`T=${ev.time}h: ${ev.event} (${ev.asset_id || ev.edge_id || 'system'})`}
                  />
                );
              })}
            </div>

            <div
              className="scrubber-active-indicator font-mono"
              style={{ left: `${progressPercent}%` }}
            >
              <div className="scrubber-handle-pill" />
              <span className="scrubber-live-label">
                {timeFormatted} (
                {state.isPlaying
                  ? 'SIMULATING CASCADE...'
                  : isAtStart
                  ? 'READY TO SIMULATE'
                  : isComplete
                  ? 'SIMULATION COMPLETE'
                  : isCascadeActive
                  ? 'PAUSED MID-CASCADE'
                  : 'NOMINAL BASELINE'}
                )
              </span>
            </div>
          </div>
        </div>

        {/* Milestone hour markers along timeline */}
        <div className="sim-timeline-milestones font-mono">
          {hoursMarks.map((h) => (
            <span
              key={h}
              className={`timeline-hour-mark ${Math.abs(state.simulationTime - h) < 1.2 ? 'mark-near' : ''}`}
              onClick={() => appState.setSimulationTime(h)}
            >
              {String(h).padStart(2, '0')}:00
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
