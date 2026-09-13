import React, { useEffect, useState } from 'react';
import type { ApplicationState } from '../../state/applicationState';
import { appState } from '../../state/applicationState';

export const TimelineBar: React.FC = () => {
  const [state, setState] = useState<ApplicationState>(appState.getState());

  useEffect(() => {
    return appState.subscribe((s) => setState({ ...s }));
  }, []);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    appState.setSimulationTime(time);
  };

  const hours = Math.floor(state.simulationTime);
  const minutes = Math.floor((state.simulationTime - hours) * 60);
  const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  return (
    <div className="timeline-container glass-card">
      <div className="timeline-controls">
        {state.isPlaying ? (
          <button
            className="ctrl-btn btn-primary"
            onClick={() => appState.pause()}
            title="Pause simulation"
          >
            || Pause
          </button>
        ) : (
          <button
            className="ctrl-btn btn-primary"
            onClick={() => appState.play()}
            title="Start simulation playback"
          >
            ▶ Play
          </button>
        )}

        <button
          className="ctrl-btn btn-outline"
          onClick={() => appState.stepForward(0.5)}
          title="Step forward 30 minutes in simulation time"
        >
          +30m
        </button>

        <button
          className="ctrl-btn btn-outline"
          onClick={() => appState.resetSimulation()}
          title="Reset to 0h"
        >
          ↺ Reset
        </button>

        <div className="speed-group">
          {[1, 2, 3].map((spd) => (
            <button
              key={spd}
              className={`speed-btn ${state.playbackSpeed === spd ? 'active' : ''}`}
              onClick={() => appState.setPlaybackSpeed(spd)}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      <div className="timeline-scrubber-wrapper">
        <div className="timeline-track-info">
          <span className="time-label">T = 00:00h</span>
          <span className="time-current font-mono">
            SIMULATION TIME: <strong>{formattedTime} hrs</strong> / 24:00 hrs
          </span>
          <span className="time-label">T = 24:00h</span>
        </div>

        <div className="slider-wrapper">
          <input
            type="range"
            min={0}
            max={24}
            step={0.1}
            value={state.simulationTime}
            onChange={handleSeek}
            className="timeline-slider"
          />

          <div className="timeline-markers">
            {state.events.map((ev, i) => {
              const leftPct = (ev.time / 24) * 100;
              const isPast = ev.time <= state.simulationTime;
              return (
                <div
                  key={i}
                  className={`marker-tick ${isPast ? 'tick-passed' : ''}`}
                  style={{ left: `${leftPct}%` }}
                  title={`T=${ev.time}h: ${ev.event} (${ev.asset_id || ev.edge_id})`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
