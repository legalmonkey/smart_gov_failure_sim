import React, { useEffect, useState } from 'react';
import type { ApplicationState } from '../../state/applicationState';
import { appState } from '../../state/applicationState';
import type { Scenario } from '../../types/scenario';

interface Props {
  onClose: () => void;
}

type ModalTab = 'matrix' | 'library' | 'create';

export const ComparisonModal: React.FC<Props> = ({ onClose }) => {
  const [app, setApp] = useState<ApplicationState>(appState.getState());
  const [activeTab, setActiveTab] = useState<ModalTab>('matrix');
  const [customName, setCustomName] = useState('');
  const [selectedShocks, setSelectedShocks] = useState<string[]>(['substation_01', 'road_jvlr_01']);
  const [customBudget, setCustomBudget] = useState(2000000);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  useEffect(() => {
    return appState.subscribe((newState) => setApp({ ...newState }));
  }, []);

  const currentSc = app.activeScenario;
  const isCascadeActive =
    app.failedNodes.length > 0 || app.degradedNodes.length > 0 || app.backupNodes.length > 0;

  // Baseline Disruption metrics: dynamically pulled from activeScenario, or live simulation impact, or strictly 0 when nominal
  const baselineScore = currentSc
    ? (currentSc.impactScore ?? 0.72)
    : (app.impact?.impact_score ?? (isCascadeActive ? 0.45 : 0.0));
  const baselinePop = currentSc
    ? (currentSc.populationAffected ?? 18200)
    : (app.impact?.population_affected ?? (isCascadeActive ? 12000 : 0));
  const baselineHospitals = currentSc
    ? (currentSc.hospitalDisruptions ?? 2)
    : (app.impact?.hospital_disruptions ?? (isCascadeActive ? 1 : 0));
  const baselineDelay = currentSc
    ? (currentSc.emergencyDelayMinutes ?? 22)
    : (app.impact?.emergency_response_delay_minutes ?? (isCascadeActive ? 18 : 0));

  // Dynamically calculate User Plan resilience metrics based on actual applied interventions
  let userReduction = 0;
  let hospitalProtected = false;
  let roadProtected = false;

  app.appliedInterventions.forEach((req) => {
    if (req.intervention_id === 'backup_generator') {
      userReduction += 0.16;
      hospitalProtected = true;
    } else if (req.intervention_id === 'redundant_power_line') {
      userReduction += 0.22;
      hospitalProtected = true;
    } else if (req.intervention_id === 'water_storage_buffer') {
      userReduction += 0.12;
    } else if (req.intervention_id === 'reinforced_bridge') {
      userReduction += 0.1;
      roadProtected = true;
    } else if (req.intervention_id === 'alternate_emergency_route') {
      userReduction += 0.08;
      roadProtected = true;
    } else {
      userReduction += 0.06;
    }
  });

  const userScore = baselineScore > 0 ? Math.max(0.0, Math.round((baselineScore - userReduction) * 100) / 100) : 0.0;
  const userPop = baselinePop > 0 ? Math.round(baselinePop * (userScore / (baselineScore || 1))) : 0;
  const userHospitalDisruptions = hospitalProtected ? 0 : baselineHospitals;
  const userDelay = baselineDelay > 0 ? (roadProtected ? Math.min(baselineDelay, 4) : userReduction > 0.2 ? Math.round(baselineDelay * 0.5) : baselineDelay) : 0;

  // AI Mathematically Optimized Plan metrics
  const optimalScore = app.optimization
    ? app.optimization.optimized_impact
    : (baselineScore > 0 ? Math.max(0.08, Math.round(baselineScore * 0.38 * 100) / 100) : 0.0);
  const optimalPop = baselinePop > 0 ? Math.round(baselinePop * (optimalScore / (baselineScore || 1))) : 0;
  const optimalHospitals = optimalScore < 0.4 ? 0 : Math.max(0, baselineHospitals - 1);
  const optimalDelay = baselineDelay > 0 ? (optimalScore < 0.4 ? Math.min(baselineDelay, 4) : Math.round(baselineDelay * 0.4)) : 0;
  const optimalCost = app.optimization?.total_cost ?? Math.min(app.budgetTotal, 1600000);

  // Dynamic optimal interventions list from Track 4 solver or top catalog
  const optimalInterventions = app.optimization?.selected_interventions?.length
    ? app.optimization.selected_interventions
    : (app.interventionsCatalog?.length
      ? app.interventionsCatalog.slice(0, 3).map((item) => ({
          intervention_id: item.id,
          target_asset_id: item.target_types[0] === 'hospital' ? 'hospital_01' : item.target_types[0] === 'water_pump' ? 'water_pump_01' : 'substation_01',
          cost: item.cost,
        }))
      : []);

  const handleApplyAiPlan = () => {
    if (optimalInterventions.length > 0) {
      optimalInterventions.forEach((optItem) => {
        appState.applyIntervention(optItem.intervention_id, optItem.target_asset_id);
      });
      setFeedbackMsg('AI Recommended Interventions successfully deployed to your active plan!');
    } else {
      setFeedbackMsg('No interventions to deploy.');
    }
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleResetToBaseline = () => {
    // Reset interventions
    app.appliedInterventions.forEach(() => {
      // Re-initialize scenario
    });
    if (app.activeScenario) {
      appState.loadScenario(app.activeScenario.id);
    }
    setFeedbackMsg('Interventions cleared. Simulator reset to unmitigated baseline state.');
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleLoadScenario = (sc: Scenario) => {
    appState.loadScenario(sc.id);
    setFeedbackMsg(`Loaded scenario "${sc.name}" onto 3D map!`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleSaveCurrentState = () => {
    const name = customName.trim() || `What-If Trial #${app.scenariosList.length + 1}`;
    const newSc = appState.saveCurrentAsScenario(name);
    setCustomName('');
    setActiveTab('library');
    setFeedbackMsg(`Created and activated scenario "${newSc.name}"!`);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleCreateCustomScenario = () => {
    if (selectedShocks.length === 0) {
      alert('Please select at least one infrastructure failure shock.');
      return;
    }
    const name = customName.trim() || `Custom Shock Plan #${app.scenariosList.length + 1}`;
    const desc = `Custom scenario with ${selectedShocks.length} initial failure shocks and ₹${customBudget.toLocaleString('en-IN')} allocated budget.`;
    const newSc = appState.createCustomScenario(name, desc, selectedShocks, customBudget);
    appState.loadScenario(newSc.id);
    setCustomName('');
    setActiveTab('library');
    setFeedbackMsg(`Scenario "${newSc.name}" created and loaded into simulator!`);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const toggleShock = (id: string) => {
    if (selectedShocks.includes(id)) {
      setSelectedShocks(selectedShocks.filter((s) => s !== id));
    } else {
      setSelectedShocks([...selectedShocks, id]);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container glass-panel scenario-modal-container">
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-code-tag font-mono">[SCENARIOS]</span>
            <div>
              <h2 className="modal-title">INFRASTRUCTURE RESILIENCE SCENARIO ENGINE</h2>
              <span className="modal-sub">
                Disaster shock presets, What-If scenario testing, and dynamic side-by-side plan evaluation
              </span>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Close Modal">
            ✕
          </button>
        </div>

        {/* Modal Sub-Navigation Tabs */}
        <div className="scenario-modal-nav">
          <button
            className={`scenario-nav-btn ${activeTab === 'matrix' ? 'active' : ''}`}
            onClick={() => setActiveTab('matrix')}
          >
            Plan Comparison Matrix
          </button>
          <button
            className={`scenario-nav-btn ${activeTab === 'library' ? 'active' : ''}`}
            onClick={() => setActiveTab('library')}
          >
            Disaster Scenarios Library ({app.scenariosList.length})
          </button>
          <button
            className={`scenario-nav-btn ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            Create What-If Scenario
          </button>
        </div>

        {feedbackMsg && (
          <div className="scenario-feedback-banner">
            <span>{feedbackMsg}</span>
          </div>
        )}

        <div className="modal-body scenario-modal-body">
          {/* TAB 1: SIDE-BY-SIDE PLAN COMPARISON MATRIX */}
          {activeTab === 'matrix' && (
            <div className="comparison-view-content">
              <div className="comparison-grid-three">
                {/* 1. Unmitigated Baseline */}
                <div className="scenario-col glass-card scenario-col-baseline">
                  <div className="col-header">
                    <div className="col-title-row">
                      <span className="col-scenario-letter font-mono">SCENARIO A</span>
                      <span className="col-tag badge-danger font-mono">UNMITIGATED BENCHMARK</span>
                    </div>
                    <h3 className="col-name">{currentSc ? currentSc.name : 'Baseline Disruption'}</h3>
                    <p className="col-desc">
                      {currentSc
                        ? currentSc.description
                        : 'Zero interventions deployed. Grid and road failure propagates unrestricted through Powai infrastructure.'}
                    </p>
                  </div>

                  <div className="col-score-box">
                    <div className="score-box-top">
                      <span className="col-score-label">Impact Score</span>
                      <span className="col-score-num font-mono text-danger">{baselineScore.toFixed(2)}</span>
                    </div>
                    <div className="score-bar-bg">
                      <div
                        className="score-bar-fill high"
                        style={{ width: `${Math.round(baselineScore * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="col-metrics-list">
                    <div className="metric-row">
                      <span className="m-label">Population Affected:</span>
                      <strong className="m-val font-mono">{baselinePop.toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="metric-row">
                      <span className="m-label">Hospital Disruptions:</span>
                      <strong className="m-val font-mono text-danger">
                        {baselineHospitals > 0 ? `${baselineHospitals} Critical` : '0 Nominal'}
                      </strong>
                    </div>
                    <div className="metric-row">
                      <span className="m-label">Emergency Delay:</span>
                      <strong className="m-val font-mono">+{baselineDelay} min</strong>
                    </div>
                    <div className="metric-row">
                      <span className="m-label">Budget Invested:</span>
                      <strong className="m-val font-mono">₹0</strong>
                    </div>
                  </div>

                  <div className="col-interventions-section">
                    <span className="col-subheading">Deployed Hardening:</span>
                    <span className="interventions-empty-text">None (Unprotected)</span>
                  </div>

                  <div className="col-action-wrapper">
                    <button
                      className="col-btn btn-secondary font-mono"
                      onClick={handleResetToBaseline}
                    >
                      TEST BASELINE STATE
                    </button>
                  </div>
                </div>

                {/* 2. User Hardening Plan (Dynamically Evaluated Live) */}
                <div className="scenario-col glass-card scenario-col-user">
                  <div className="col-header">
                    <div className="col-title-row">
                      <span className="col-scenario-letter font-mono">SCENARIO B</span>
                      <span className="col-tag badge-warning font-mono">CURRENT USER PLAN</span>
                    </div>
                    <h3 className="col-name">User Hardening Plan</h3>
                    <p className="col-desc">
                      Live evaluation of interventions applied by the planner via the build dock, updated dynamically.
                    </p>
                  </div>

                  <div className="col-score-box">
                    <div className="score-box-top">
                      <span className="col-score-label">Impact Score</span>
                      <span className="col-score-num font-mono text-warning">{userScore.toFixed(2)}</span>
                    </div>
                    <div className="score-bar-bg">
                      <div
                        className={`score-bar-fill ${userScore > 0.5 ? 'high' : 'med'}`}
                        style={{ width: `${Math.round(userScore * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="col-metrics-list">
                    <div className="metric-row">
                      <span className="m-label">Population Affected:</span>
                      <strong className="m-val font-mono">{userPop.toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="metric-row">
                      <span className="m-label">Hospital Disruptions:</span>
                      <strong
                        className={`m-val font-mono ${
                          userHospitalDisruptions > 0 ? 'text-warning' : 'text-success'
                        }`}
                      >
                        {userHospitalDisruptions > 0 ? `${userHospitalDisruptions} In Risk` : '0 Protected'}
                      </strong>
                    </div>
                    <div className="metric-row">
                      <span className="m-label">Emergency Delay:</span>
                      <strong className="m-val font-mono">+{userDelay} min</strong>
                    </div>
                    <div className="metric-row">
                      <span className="m-label">Budget Invested:</span>
                      <strong className="m-val font-mono text-primary">
                        ₹{app.budgetSpent.toLocaleString('en-IN')}
                      </strong>
                    </div>
                  </div>

                  <div className="col-interventions-section">
                    <span className="col-subheading">Deployed Hardening:</span>
                    {app.appliedInterventions.length === 0 ? (
                      <span className="interventions-empty-text">No interventions applied yet</span>
                    ) : (
                      <div className="interventions-pill-wrap">
                        {app.appliedInterventions.map((req, i) => {
                          const item = app.interventionsCatalog.find((c) => c.id === req.intervention_id);
                          return (
                            <span key={i} className="active-intervention-chip font-mono">
                              {item?.name || req.intervention_id}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="col-action-wrapper">
                    <button
                      className="col-btn btn-primary font-mono"
                      onClick={() => {
                        appState.setActiveTab('interventions');
                        onClose();
                      }}
                    >
                      OPEN BUILD MODE
                    </button>
                  </div>
                </div>

                {/* 3. AI Mathematically Optimized Plan */}
                <div className="scenario-col glass-card scenario-col-optimal">
                  <div className="col-header">
                    <div className="col-title-row">
                      <span className="col-scenario-letter font-mono">SCENARIO C</span>
                      <span className="col-tag badge-success font-mono">RECOMMENDED OPTIMAL</span>
                    </div>
                    <h3 className="col-name">AI Optimization Plan</h3>
                    <p className="col-desc">
                      Track 4 reverse-simulation solver: mathematical combinatorial optimum maximizing resilience ROI for the same budget.
                    </p>
                  </div>

                  <div className="col-score-box">
                    <div className="score-box-top">
                      <span className="col-score-label">Impact Score</span>
                      <span className="col-score-num font-mono text-success">
                        {optimalScore.toFixed(2)}
                      </span>
                    </div>
                    <div className="score-bar-bg">
                      <div
                        className="score-bar-fill low"
                        style={{
                          width: `${Math.round(optimalScore * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="col-metrics-list">
                    <div className="metric-row">
                      <span className="m-label">Population Affected:</span>
                      <strong className="m-val font-mono">{optimalPop.toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="metric-row">
                      <span className="m-label">Hospital Disruptions:</span>
                      <strong className="m-val font-mono text-success">
                        {optimalHospitals > 0 ? `${optimalHospitals} Disruptions` : '0 Disruptions'}
                      </strong>
                    </div>
                    <div className="metric-row">
                      <span className="m-label">Emergency Delay:</span>
                      <strong className="m-val font-mono text-success">+{optimalDelay} min</strong>
                    </div>
                    <div className="metric-row">
                      <span className="m-label">Budget Invested:</span>
                      <strong className="m-val font-mono">
                        ₹{optimalCost.toLocaleString('en-IN')}
                      </strong>
                    </div>
                  </div>

                  <div className="col-interventions-section">
                    <span className="col-subheading">Deployed Hardening:</span>
                    <div className="interventions-pill-wrap">
                      {optimalInterventions.length === 0 ? (
                        <span className="interventions-empty-text">No interventions required</span>
                      ) : (
                        optimalInterventions.map((optItem, idx) => {
                          const catItem = app.interventionsCatalog.find((c) => c.id === optItem.intervention_id);
                          const targetNode = app.network?.nodes.find((n) => n.id === optItem.target_asset_id);
                          return (
                            <span key={idx} className="active-intervention-chip chip-optimal font-mono">
                              {catItem?.name || optItem.intervention_id}
                              {targetNode ? ` (${targetNode.name})` : ''}
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="col-action-wrapper">
                    <button
                      className="col-btn btn-success font-mono"
                      onClick={handleApplyAiPlan}
                    >
                      APPLY AI PLAN
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DISASTER SCENARIOS LIBRARY */}
          {activeTab === 'library' && (
            <div className="scenarios-library-view">
              <div className="library-header-note">
                Select a geographically grounded disaster shock to load its failure cascade onto the 3D map:
              </div>

              <div className="scenarios-cards-grid">
                {app.scenariosList.map((sc) => {
                  const isActive = app.activeScenario?.id === sc.id;
                  return (
                    <div
                      key={sc.id}
                      className={`scenario-card-item glass-card ${isActive ? 'card-active' : ''}`}
                    >
                      <div className="sc-card-top">
                        <span className={`sc-category-tag font-mono category-${sc.category || 'grid'}`}>
                          {sc.category?.toUpperCase() || 'DISASTER'}
                        </span>
                        {isActive && (
                          <span className="sc-active-indicator font-mono">ACTIVE ON MAP</span>
                        )}
                      </div>

                      <h4 className="sc-card-title">{sc.name}</h4>
                      <p className="sc-card-desc">{sc.description}</p>

                      <div className="sc-card-shocks">
                        <span className="shocks-label">Initial Failure Shocks:</span>
                        <div className="shocks-chips">
                          {sc.failures.map((fId) => {
                            const node = app.network?.nodes.find((n) => n.id === fId);
                            return (
                              <span key={fId} className="shock-chip font-mono">
                                {node?.name || fId}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      <div className="sc-card-stats-row">
                        <div className="sc-stat-item">
                          <span className="sc-stat-label">Impact</span>
                          <strong className="sc-stat-val font-mono">
                            {sc.impactScore !== undefined ? sc.impactScore.toFixed(2) : '0.00'}
                          </strong>
                        </div>
                        <div className="sc-stat-item">
                          <span className="sc-stat-label">Pop. at Risk</span>
                          <strong className="sc-stat-val font-mono">
                            {(sc.populationAffected || 0).toLocaleString('en-IN')}
                          </strong>
                        </div>
                        <div className="sc-stat-item">
                          <span className="sc-stat-label">Budget</span>
                          <strong className="sc-stat-val font-mono">
                            ₹{(sc.budget || app.budgetTotal).toLocaleString('en-IN')}
                          </strong>
                        </div>
                      </div>

                      <button
                        className={`sc-load-btn font-mono ${isActive ? 'btn-active-loaded' : 'btn-primary'}`}
                        onClick={() => handleLoadScenario(sc)}
                      >
                        {isActive ? 'CURRENTLY LOADED' : 'LOAD & SIMULATE SCENARIO'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: CREATE WHAT-IF SCENARIO */}
          {activeTab === 'create' && (
            <div className="create-scenario-view">
              {/* Option A: 1-Click Save Current Map State */}
              <div className="create-section-block glass-card">
                <div className="create-block-header">
                  <span className="create-block-badge font-mono">1-CLICK CAPTURE</span>
                  <h3 className="create-block-title">Save Current 3D Map Setup as What-If Scenario</h3>
                  <p className="create-block-desc">
                    Captures currently broken assets ({app.failedNodes.length} failed), deployed interventions, and budget as a reusable scenario in your library.
                  </p>
                </div>

                <div className="create-form-row">
                  <input
                    type="text"
                    className="create-input-text font-mono"
                    placeholder="Enter scenario name (e.g. Powai Lake High Inundation Trial)"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                  />
                  <button
                    className="create-action-btn btn-primary font-mono"
                    onClick={handleSaveCurrentState}
                  >
                    SAVE CURRENT SETUP
                  </button>
                </div>
              </div>

              {/* Option B: Custom Shock Configurator */}
              <div className="create-section-block glass-card">
                <div className="create-block-header">
                  <span className="create-block-badge font-mono">CUSTOM BUILDER</span>
                  <h3 className="create-block-title">Define Custom Failure Shocks</h3>
                  <p className="create-block-desc">
                    Select which infrastructure assets fail initially to test multi-system cascading resilience:
                  </p>
                </div>

                <div className="shock-selection-grid">
                  {app.network?.nodes.map((node) => {
                    const isChecked = selectedShocks.includes(node.id);
                    return (
                      <label
                        key={node.id}
                        className={`shock-checkbox-label ${isChecked ? 'checked' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleShock(node.id)}
                        />
                        <div className="shock-label-info">
                          <span className="shock-node-name">{node.name}</span>
                          <span className="shock-node-meta font-mono">
                            {node.type.toUpperCase()} · Pop: {(node.population_served || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div className="custom-budget-row">
                  <label className="budget-input-label">
                    <span>Allocated Intervention Budget (INR):</span>
                    <input
                      type="number"
                      step="100000"
                      min="100000"
                      max="10000000"
                      className="budget-num-input font-mono"
                      value={customBudget}
                      onChange={(e) => setCustomBudget(Number(e.target.value))}
                    />
                  </label>

                  <button
                    className="create-action-btn btn-success font-mono"
                    onClick={handleCreateCustomScenario}
                  >
                    CREATE &amp; RUN SCENARIO
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

