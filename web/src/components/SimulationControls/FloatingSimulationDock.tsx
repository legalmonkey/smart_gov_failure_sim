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

  const handleExportMetrics = () => {
    const report = {
      simulationTime: timeFormatted,
      impactScore: state.impact?.impact_score ?? (isCascadeActive ? 0.45 : 0.0),
      populationAffected: state.impact?.population_affected ?? (isCascadeActive ? 12000 : 0),
      hospitalsDisrupted: state.impact?.hospital_disruptions ?? (isCascadeActive ? 1 : 0),
      schoolsImpacted: state.impact?.school_disruptions ?? (isCascadeActive ? 1 : 0),
      emergencyDelay: state.impact?.emergency_response_delay_minutes ?? (isCascadeActive ? 14 : 0),
      failedNodes: state.failedNodes,
      backupNodes: state.backupNodes,
      timestamp: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cascade-city-telemetry-t${timeFormatted.replace(':', '')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="floating-simulation-bar glass-panel emerging-panel">
      {/* Top Controls & Telemetry Row */}
      <div className="sim-dock-top-row">
        <div className="sim-left-controls">
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
                onClick={() => appState.play()}
                title="Resume simulation playback"
              >
                ▶
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
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Current Simulation Clock & Peak Impact Badge */}
          <div className="sim-clock-display font-mono">
            <span className="sim-clock-hours">{timeFormatted}</span>
            <span className="sim-clock-total">/ 24:00</span>
          </div>

          <span className="sim-peak-impact-badge font-mono">
            PEAK IMPACT: {(state.impact?.impact_score ?? (isCascadeActive ? 0.45 : 0.0)).toFixed(2)}
          </span>
        </div>

        {/* Center/Right Status Indicators & Actions */}
        <div className="sim-right-status-group">
          <div className="sim-status-telemetry font-mono">
            <span className="sim-event-count">
              <span className="c-dot dot-red">●</span> {activeEventCount} Events Triggered
            </span>
            <span className="sim-time-remaining">
              <span className="c-dot dot-indigo">●</span> Time Remaining: {remH}h {String(remM).padStart(2, '0')}m
            </span>
          </div>

          <button
            className="sim-export-btn font-mono"
            onClick={handleExportMetrics}
            title="Download telemetry metrics report (JSON)"
          >
            EXPORT METRICS
          </button>

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
            <div
              className="scrubber-active-indicator font-mono"
              style={{ left: `${progressPercent}%` }}
            >
              <div className="scrubber-handle-pill" />
              <span className="scrubber-live-label">
                {timeFormatted} ({isCascadeActive ? 'LIVE CASCADING' : 'NOMINAL BASELINE'})
              </span>
            </div>
          </div>
        </div>

        {/* Milestone hour markers along timeline */}
        <div className="sim-timeline-milestones font-mono">
          {hoursMarks.map((h) => (
            <span
              key={h}
              className={`timeline-hour-mark ${Math.abs(state.simulationTime - h) < 1.5 ? 'mark-near' : ''}`}
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
