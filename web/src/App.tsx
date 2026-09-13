import React, { useEffect, useRef, useState } from 'react';
import { SceneManager } from './three/SceneManager';
import type { ApplicationState } from './state/applicationState';
import { appState } from './state/applicationState';
import { Header } from './components/Dashboard/Header';
import { ResilienceOverviewPanel } from './components/Dashboard/ResilienceOverviewPanel';
import { CascadeFeedPanel } from './components/Dashboard/CascadeFeedPanel';
import { MapIndex } from './components/Dashboard/MapIndex';
import { AssetDetailPanel } from './components/AssetPanel/AssetDetailPanel';
import { HoverActionCard } from './components/AssetPanel/HoverActionCard';
import { InterventionModal } from './components/BuildMenu/InterventionModal';
import { SetBudgetModal } from './components/BuildMenu/SetBudgetModal';
import { ComparisonModal } from './components/ScenarioComparison/ComparisonModal';
import { AdvisorModal } from './components/Advisor/AdvisorModal';
import { SimsAdvisorPopup } from './components/Dashboard/SimsAdvisorPopup';
import { FloatingSimulationDock } from './components/SimulationControls/FloatingSimulationDock';
import { SimulateTriggerButton } from './components/SimulationControls/SimulateTriggerButton';
import { OsmAttribution } from './components/Dashboard/OsmAttribution';

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);
  const [state, setState] = useState<ApplicationState>(appState.getState());

  useEffect(() => {
    appState.initialize();

    if (canvasRef.current && !sceneManagerRef.current) {
      sceneManagerRef.current = new SceneManager(canvasRef.current);
    }

    const unsubscribe = appState.subscribe((s) => setState({ ...s }));

    return () => {
      unsubscribe();
      if (sceneManagerRef.current) {
        sceneManagerRef.current.dispose();
        sceneManagerRef.current = null;
      }
    };
  }, []);

  return (
    <div className={`app-shell ${state.showSimulationBar ? 'has-sim-bar' : ''}`}>
      {/* Top Floating Command Dock */}
      <Header />

      {/* 3D WebGL Canvas (Full viewport) */}
      <div ref={canvasRef} className="canvas-container" />

      {/* Interactive Hover Card (Instant HUD on hover) */}
      <HoverActionCard />

      {/* Emerging Left Panel: Resilience Overview (Emerges on demand) */}
      {state.showOverviewPanel && <ResilienceOverviewPanel />}

      {/* Right Floating Dock Column: Selected Asset & Cascade Feed */}
      <div className="right-dock-container">
        <AssetDetailPanel
          onFocusAsset={(assetId) => sceneManagerRef.current?.focusAsset(assetId)}
        />
        {state.showCascadePanel && <CascadeFeedPanel />}
      </div>

      {/* Emerging Map Index (Emerges when requested) */}
      {state.showMapIndex && (
        <MapIndex
          onFlyTo={(lat, lon) => {
            sceneManagerRef.current?.focusCoordinates(lat, lon);
          }}
        />
      )}

      {/* Bottom Right Simulate Trigger Button (Only visible when floating bar is minimized) */}
      {!state.showSimulationBar && <SimulateTriggerButton />}

      {/* Emerging Bottom Floating Simulation Bar (Emerges when Simulate button is pressed) */}
      {state.showSimulationBar && (
        <FloatingSimulationDock
          onResetCamera={() => sceneManagerRef.current?.resetCamera()}
        />
      )}

      {/* Set Budget Modal */}
      {state.isSetBudgetOpen && (
        <SetBudgetModal onClose={() => appState.openSetBudgetModal(false)} />
      )}

      {/* Sims-Style Scenario Summary Popup */}
      {state.isSummaryOpen && (
        <SimsAdvisorPopup
          onClose={() => appState.openSummaryModal(false)}
          onShowOptimalPlan={(assetIds) => {
            if (assetIds.length > 0) {
              sceneManagerRef.current?.focusAsset(assetIds[0]);
            }
          }}
        />
      )}

      {/* Interventions / Build Mode Modal */}
      {state.activeTab === 'interventions' && (
        <InterventionModal onClose={() => appState.setActiveTab('explore')} />
      )}

      {/* Scenario Comparison Modal */}
      {state.activeTab === 'compare' && (
        <ComparisonModal onClose={() => appState.setActiveTab('explore')} />
      )}

      {/* AI Resilience Advisor Modal */}
      {state.activeTab === 'advisor' && (
        <AdvisorModal
          onClose={() => appState.setActiveTab('explore')}
          onHighlightOptimalAssets={(assetIds) => {
            if (assetIds.length > 0) {
              sceneManagerRef.current?.focusAsset(assetIds[0]);
            }
          }}
        />
      )}

      {/* Visible OpenStreetMap Attribution */}
      <OsmAttribution />
    </div>
  );
};

export default App;
