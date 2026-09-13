import React, { useEffect, useState } from 'react';
import type { ApplicationState } from '../../state/applicationState';
import { appState } from '../../state/applicationState';

export const Header: React.FC = () => {
  const [state, setState] = useState<ApplicationState>(appState.getState());

  useEffect(() => {
    return appState.subscribe((newState) => setState({ ...newState }));
  }, []);

  const budgetRemaining = state.budgetTotal - state.budgetSpent;

  return (
    <header className="command-dock-header glass-panel">
      {/* Brand Section */}
      <div className="dock-brand-group">
        <div className="brand-logo-line">
          <span className="brand-title font-mono">RESILIO</span>
          <span className="brand-code-badge font-mono">MUM-01</span>
        </div>
        <span className="brand-tagline">Powai Lake &amp; Hiranandani · Infrastructure Resilience</span>
      </div>

      {/* Central Command Navigation Tabs */}
      <nav className="dock-nav-tabs">
        <button
          className={`dock-tab-btn ${state.showOverviewPanel ? 'active' : ''}`}
          onClick={() => appState.toggleOverviewPanel()}
          title="Toggle Resilience Overview Panel"
        >
          Overview
        </button>

        <button
          className={`dock-tab-btn ${state.showCascadePanel ? 'active' : ''}`}
          onClick={() => appState.toggleCascadePanel()}
          title="Toggle Cascade Propagation Feed"
        >
          Cascade
        </button>

        <button
          className={`dock-tab-btn ${state.activeTab === 'compare' ? 'active' : ''}`}
          onClick={() => appState.setActiveTab('compare')}
          title="Toggle Scenario Library & Disaster Hub"
        >
          Scenarios
        </button>

        <button
          className={`dock-tab-btn ${state.activeTab === 'interventions' ? 'active' : ''}`}
          onClick={() => appState.setActiveTab('interventions')}
          title="Toggle Hardening & Interventions"
        >
          Interventions
        </button>

        <button
          className={`dock-tab-btn ${state.activeTab === 'advisor' ? 'active' : ''}`}
          onClick={() => appState.setActiveTab('advisor')}
          title="Toggle AI Resilience Advisor"
        >
          AI Advisor
        </button>

        <button
          className={`dock-tab-btn ${state.showMapIndex ? 'active' : ''}`}
          onClick={() => appState.toggleMapIndex()}
          title="Toggle Map Index"
        >
          Map Index
        </button>
      </nav>

      {/* Right Stats & Budget */}
      <div className="dock-budget-profile-group">
        <div className="budget-mini-block" onClick={() => appState.openSetBudgetModal(true)}>
          <span className="budget-mini-label">BUDGET REMAINING</span>
          <span className="budget-mini-val font-mono">
            ₹{budgetRemaining.toLocaleString('en-IN')}
          </span>
        </div>

        {/* Notification Bell Button */}
        <button
          className="dock-round-btn notification-btn"
          onClick={() => appState.openSummaryModal(true)}
          title="View Disaster Telemetry Notifications"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <span className="bell-badge-dot"></span>
        </button>

        {/* Map Controls Toggle Button */}
        <button
          className={`map-controls-toggle-btn ${state.showMapControls ? 'active' : ''}`}
          onClick={() => appState.toggleMapControls()}
          title="Toggle 3D Map Navigation & Controls"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
            <line x1="8" y1="2" x2="8" y2="18"></line>
            <line x1="16" y1="6" x2="16" y2="22"></line>
          </svg>
          <span className="toggle-label font-mono">MAP CONTROLS</span>
          <span className={`toggle-pill font-mono ${state.showMapControls ? 'on' : 'off'}`}>
            {state.showMapControls ? 'ON' : 'OFF'}
          </span>
        </button>
      </div>
    </header>
  );
};
