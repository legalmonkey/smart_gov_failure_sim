import React, { useEffect, useState } from 'react';
import type { ApplicationState } from '../../state/applicationState';
import { appState } from '../../state/applicationState';

export const SimulateTriggerButton: React.FC = () => {
  const [state, setState] = useState<ApplicationState>(appState.getState());

  useEffect(() => {
    return appState.subscribe((s) => setState({ ...s }));
  }, []);

  const hours = Math.floor(state.simulationTime);
  const minutes = Math.floor((state.simulationTime - hours) * 60);
  const timeFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  const isActive = state.showSimulationBar;

  return (
    <div className="bottom-right-simulate-wrapper">
      <button
        className={`simulate-trigger-btn ${isActive ? 'active' : ''} ${
          state.isPlaying ? 'is-playing' : ''
        }`}
        onClick={() => appState.toggleSimulationBar()}
        title={isActive ? 'Hide simulation controls' : 'Open simulation controls'}
      >
        <span className="sim-btn-radar-dot"></span>
        <span className="sim-btn-label">
          {state.isPlaying ? 'SIMULATING' : 'SIMULATE'}
        </span>
        <span className="sim-btn-time">{timeFormatted}</span>
      </button>
    </div>
  );
};
