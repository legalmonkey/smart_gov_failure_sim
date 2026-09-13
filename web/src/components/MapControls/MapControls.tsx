import React, { useEffect, useState, useCallback } from 'react';
import type { ApplicationState } from '../../state/applicationState';
import { appState } from '../../state/applicationState';

interface MapControlsProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onRotateLeft?: () => void;
  onRotateRight?: () => void;
  onResetView?: () => void;
  onToggle2D3D?: () => void;
  onNavigate?: (dx: number, dz: number) => void;
  onFocusCoordinates?: (lat: number, lon: number) => void;
  onClose?: () => void;
}

export const MapControls: React.FC<MapControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onRotateLeft,
  onRotateRight,
  onResetView,
  onToggle2D3D,
  onNavigate,
  onFocusCoordinates,
  onClose,
}) => {
  const [state, setState] = useState<ApplicationState>(appState.getState());
  const [isTopDown, setIsTopDown] = useState<boolean>(false);

  useEffect(() => {
    // Ensure layers are always automatically on
    if (!state.hazardOverlayVisible) {
      appState.setHazardOverlayVisible(true);
    }
    if (!state.showCriticality) {
      appState.toggleCriticality(true);
    }
    return appState.subscribe((s) => setState({ ...s }));
  }, []);

  const handleToggle2D3D = () => {
    if (onToggle2D3D) {
      onToggle2D3D();
      setIsTopDown((prev) => !prev);
    }
  };

  const handleReset = () => {
    if (onResetView) {
      onResetView();
      setIsTopDown(false);
    }
  };

  // Keyboard navigation support (WASD and Arrow Keys)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't intercept when user is typing in an input
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement instanceof HTMLSelectElement
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          onNavigate?.(0, 1);
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          onNavigate?.(0, -1);
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          onNavigate?.(-1, 0);
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          onNavigate?.(1, 0);
          break;
        case '+':
        case '=':
          e.preventDefault();
          onZoomIn?.();
          break;
        case '-':
        case '_':
          e.preventDefault();
          onZoomOut?.();
          break;
        case 'c':
        case 'C':
          handleReset();
          break;
      }
    },
    [onNavigate, onZoomIn, onZoomOut, handleReset]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="map-controls-widget glass-panel">
      {/* Header */}
      <div className="map-ctrl-header">
        <div className="map-ctrl-title-row">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
            <line x1="8" y1="2" x2="8" y2="18"></line>
            <line x1="16" y1="6" x2="16" y2="22"></line>
          </svg>
          <span className="map-ctrl-label font-mono">MAP CONTROLS</span>
        </div>
        <button
          className="map-ctrl-close-btn"
          onClick={onClose || (() => appState.toggleMapControls(false))}
          title="Minimize Map Controls"
        >
          ✕
        </button>
      </div>

      {/* 4-Way Directional Navigation D-Pad */}
      <div className="map-dpad-section">
        <div className="dpad-heading-row">
          <span className="map-section-heading font-mono">NAVIGATE</span>
          <span className="dpad-hint font-mono">WASD / ARROWS</span>
        </div>
        
        <div className="map-dpad-grid">
          <div className="dpad-cell empty"></div>
          <button
            className="dpad-btn dpad-up"
            onClick={() => onNavigate?.(0, 1)}
            title="Navigate North / Forward (↑ / W)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="18 15 12 9 6 15"></polyline>
            </svg>
            <span className="dpad-cardinal font-mono">N</span>
          </button>
          <div className="dpad-cell empty"></div>

          <button
            className="dpad-btn dpad-left"
            onClick={() => onNavigate?.(-1, 0)}
            title="Navigate West / Left (← / A)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            <span className="dpad-cardinal font-mono">W</span>
          </button>

          <button
            className="dpad-btn dpad-center"
            onClick={handleReset}
            title="Center Powai (⌖ / C)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9"></circle>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>

          <button
            className="dpad-btn dpad-right"
            onClick={() => onNavigate?.(1, 0)}
            title="Navigate East / Right (→ / D)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
            <span className="dpad-cardinal font-mono">E</span>
          </button>

          <div className="dpad-cell empty"></div>
          <button
            className="dpad-btn dpad-down"
            onClick={() => onNavigate?.(0, -1)}
            title="Navigate South / Backward (↓ / S)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
            <span className="dpad-cardinal font-mono">S</span>
          </button>
          <div className="dpad-cell empty"></div>
        </div>
      </div>

      {/* Camera Movement & Zoom Cluster */}
      <div className="map-ctrl-actions">
        {/* Zoom In */}
        <button
          className="map-ctrl-btn"
          onClick={onZoomIn}
          title="Zoom In (+)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span className="ctrl-btn-text">Zoom In</span>
        </button>

        {/* Zoom Out */}
        <button
          className="map-ctrl-btn"
          onClick={onZoomOut}
          title="Zoom Out (−)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span className="ctrl-btn-text">Zoom Out</span>
        </button>

        {/* Orbit Left */}
        <button
          className="map-ctrl-btn"
          onClick={onRotateLeft}
          title="Rotate View Left (CCW)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 2v6h6"></path>
            <path d="M2.66 15.57a10 10 0 1 0 .57-8.38L2.5 8"></path>
          </svg>
          <span className="ctrl-btn-text">Orbit Left</span>
        </button>

        {/* Orbit Right */}
        <button
          className="map-ctrl-btn"
          onClick={onRotateRight}
          title="Rotate View Right (CW)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6"></path>
            <path d="M21.34 15.57a10 10 0 1 1-.57-8.38L21.5 8"></path>
          </svg>
          <span className="ctrl-btn-text">Orbit Right</span>
        </button>

        {/* 3D / 2D Perspective Mode */}
        <button
          className={`map-ctrl-btn mode-toggle ${isTopDown ? 'is-2d' : 'is-3d'}`}
          onClick={handleToggle2D3D}
          title="Switch between 3D Isometric and 2D Top-Down View"
        >
          <span className="mode-badge font-mono">{isTopDown ? '2D' : '3D'}</span>
          <span className="ctrl-btn-text">{isTopDown ? 'Top-Down 2D' : 'Isometric 3D'}</span>
        </button>
      </div>

      {/* Quick Landmark Navigation Jump */}
      <div className="map-landmarks-jump">
        <span className="map-section-heading font-mono">QUICK JUMP</span>
        <div className="landmarks-jump-chips">
          <button
            className="landmark-jump-btn"
            onClick={() => onFocusCoordinates?.(19.123, 72.905)}
            title="Fly to Powai Lake Shoreline"
          >
            Powai Lake
          </button>
          <button
            className="landmark-jump-btn"
            onClick={() => onFocusCoordinates?.(19.117, 72.908)}
            title="Fly to Hiranandani Gardens Core"
          >
            Hiranandani
          </button>
          <button
            className="landmark-jump-btn"
            onClick={() => onFocusCoordinates?.(19.133, 72.914)}
            title="Fly to IIT Bombay Campus"
          >
            IIT Bombay
          </button>
          <button
            className="landmark-jump-btn"
            onClick={() => onFocusCoordinates?.(19.128, 72.898)}
            title="Fly to JVLR Transport Corridor"
          >
            JVLR Corridor
          </button>
        </div>
      </div>
    </div>
  );
};
