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
          <span className="brand-title font-mono">CASCADECITY</span>
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
          className={`dock-tab-btn ${state.activeTab === 'interventions' ? 'active' : ''}`}
          onClick={() => appState.setActiveTab('interventions')}
          title="Toggle Hardening & Interventions"
        >
          Interventions
        </button>

        <button
          className={`dock-tab-btn ${state.activeTab === 'compare' ? 'active' : ''}`}
          onClick={() => appState.setActiveTab('compare')}
          title="Toggle Scenario Library & Comparison"
        >
          Scenarios
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

        {/* Profile Badge matching reference image */}
        <div className="user-profile-badge">
          <div className="profile-avatar font-mono">VR</div>
          <div className="profile-info">
            <span className="profile-name">Dr. V. Rao</span>
            <span className="profile-role font-mono">RESILIENCE DIR.</span>
          </div>
        </div>
      </div>
    </header>
  );
};
