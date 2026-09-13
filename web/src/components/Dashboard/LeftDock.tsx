import React, { useState } from 'react';
import { ImpactMetricsPanel } from '../ImpactPanel/ImpactMetricsPanel';
import { EventLog } from '../SimulationControls/EventLog';

export const LeftDock: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'metrics' | 'events'>('metrics');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  return (
    <div className={`left-dock-container ${isCollapsed ? 'collapsed' : 'expanded'}`}>
      <button
        className="dock-toggle-btn"
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? 'Expand Analytics Dock' : 'Collapse Analytics Dock'}
      >
        {isCollapsed ? '▶ ANALYTICS' : '◀'}
      </button>

      {!isCollapsed && (
        <div className="dock-content glass-card">
          <div className="dock-tabs-header">
            <button
              className={`dock-tab font-mono ${activeTab === 'metrics' ? 'active' : ''}`}
              onClick={() => setActiveTab('metrics')}
            >
              IMPACT & UNCERTAINTY
            </button>
            <button
              className={`dock-tab font-mono ${activeTab === 'events' ? 'active' : ''}`}
              onClick={() => setActiveTab('events')}
            >
              CASCADE FEED
            </button>
          </div>

          <div className="dock-body">
            {activeTab === 'metrics' ? <ImpactMetricsPanel /> : <EventLog />}
          </div>
        </div>
      )}
    </div>
  );
};
