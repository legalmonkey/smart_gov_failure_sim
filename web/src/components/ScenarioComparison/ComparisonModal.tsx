import React, { useEffect, useState } from 'react';
import type { ApplicationState } from '../../state/applicationState';
import { appState } from '../../state/applicationState';
import type { Scenario } from '../../types/scenario';
import { HazardWizard } from './HazardWizard';

interface Props {
  onClose: () => void;
}

type ModalTab = 'hazards' | 'library' | 'create' | 'matrix';

export const ComparisonModal: React.FC<Props> = ({ onClose }) => {
  const [app, setApp] = useState<ApplicationState>(appState.getState());
  const [activeTab, setActiveTab] = useState<ModalTab>('hazards');
  const [customName, setCustomName] = useState('');
  const [selectedShocks, setSelectedShocks] = useState<string[]>(['substation_01', 'road_jvlr_01']);
  const [customBudget, setCustomBudget] = useState(2000000);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  useEffect(() => {
    return appState.subscribe((newState) => setApp({ ...newState }));
  }, []);

  const currentSc = app.activeScenario;
  const benchmarkSc = currentSc || app.scenariosList[0];
  const isPreview = !currentSc;

  // Baseline Disruption metrics: dynamically pulled from activeScenario, live Track 3 impact, or benchmark preview
  const baselineScore = currentSc
    ? (currentSc.impactScore ?? app.impact?.impact_score ?? 0.85)
    : (benchmarkSc?.impactScore ?? 0.85);
  const baselinePop = currentSc
    ? (currentSc.populationAffected ?? app.impact?.population_affected ?? 48000)
    : (benchmarkSc?.populationAffected ?? 48000);
  const baselineHospitals = currentSc
    ? (currentSc.hospitalDisruptions ?? app.impact?.hospital_disruptions ?? 2)
    : (benchmarkSc?.hospitalDisruptions ?? 2);
  const baselineDelay = currentSc
    ? (currentSc.emergencyDelayMinutes ?? app.impact?.emergency_response_delay_minutes ?? 18)
    : (benchmarkSc?.emergencyDelayMinutes ?? 18);

  // User Plan metrics: read directly from dynamic Track 4 evaluation
  const userScore = app.advisor?.user_plan
    ? app.advisor.user_plan.impact
    : (app.appliedInterventions.length > 0
        ? Math.max(0.05, baselineScore * (1 - app.appliedInterventions.length * 0.18))
        : baselineScore);
  const userReduction = app.advisor?.user_plan?.impact_reduction ?? Math.max(0, (baselineScore - userScore) / (baselineScore || 1));
  const userPop = baselinePop > 0
    ? (baselineScore > 0 ? Math.round(baselinePop * (userScore / baselineScore)) : 0)
    : 0;

  // Check which critical sectors the user protected
  let hospitalProtected = false;
  let roadProtected = false;
  app.appliedInterventions.forEach((req) => {
    const item = app.interventionsCatalog.find((i) => i.id === req.intervention_id);
    if (item?.target_types.includes('hospital')) hospitalProtected = true;
    if (item?.target_types.includes('road')) roadProtected = true;
  });

  const userHospitalDisruptions = hospitalProtected ? 0 : (userReduction > 0.4 ? Math.max(0, baselineHospitals - 1) : baselineHospitals);
  const userDelay = baselineDelay > 0
    ? (roadProtected ? Math.min(baselineDelay, 4) : userReduction > 0.1 ? Math.round(baselineDelay * 0.6) : baselineDelay)
    : 0;

  // AI Mathematically Optimized Plan metrics: read directly from Track 4 solver
  const optimalScore = app.advisor?.optimal_plan
    ? app.advisor.optimal_plan.impact
    : (app.optimization ? app.optimization.optimized_impact : 0.22);
  const optimalPop = baselinePop > 0
    ? (baselineScore > 0 ? Math.round(baselinePop * (optimalScore / baselineScore)) : 0)
    : 0;
  const optimalHospitals = optimalScore < 0.35 ? 0 : Math.max(0, baselineHospitals - 1);
  const optimalDelay = baselineDelay > 0
    ? (optimalScore < 0.35 ? Math.min(baselineDelay, 4) : Math.round(baselineDelay * 0.4))
    : 0;
  const optimalCost = app.optimization?.total_cost ?? 0;
  const optimalInterventions = app.optimization?.selected_interventions ?? [];

  const handleApplyAiPlan = () => {
    if (optimalInterventions.length > 0) {
      appState.clearInterventions();
      optimalInterventions.forEach((optItem) => {
        appState.applyIntervention(optItem.intervention_id, optItem.target_asset_id);
      });
      setFeedbackMsg('AI Recommended Interventions successfully deployed to your active plan!');
    } else {
      setFeedbackMsg('No optimal interventions available.');
    }
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleResetToBaseline = () => {
    appState.clearInterventions();
    if (app.activeScenario) {
      appState.loadScenario(app.activeScenario.id);
    }
    setFeedbackMsg('Interventions cleared. Simulator reset to unmitigated baseline state.');
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleLoadScenario = (sc: Scenario) => {
    appState.loadScenario(sc.id);
    onClose();
  };

  const handleSaveCurrentState = () => {
    const name = customName.trim() || `What-If Trial #${app.scenariosList.length + 1}`;
    appState.saveCurrentAsScenario(name);
    setCustomName('');
    onClose();
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
    onClose();
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
            className={`scenario-nav-btn ${activeTab === 'hazards' ? 'active' : ''}`}
            onClick={() => setActiveTab('hazards')}
          >
            Natural Disaster Hazards (6-Step Simulation)
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
          <button
            className={`scenario-nav-btn ${activeTab === 'matrix' ? 'active' : ''}`}
            onClick={() => setActiveTab('matrix')}
          >
            Plan Comparison Matrix (A / B / C)
          </button>
        </div>

        {feedbackMsg && (
          <div className="scenario-feedback-banner">
            <span>{feedbackMsg}</span>
          </div>
        )}

        <div className="modal-body scenario-modal-body">
          {/* TAB 0: NATURAL DISASTER HAZARDS (6-STEP WORKFLOW) */}
          {activeTab === 'hazards' && (
            <HazardWizard
              onClose={onClose}
              onSuccessMessage={(msg) => {
                setFeedbackMsg(msg);
                setTimeout(() => setFeedbackMsg(null), 4000);
              }}
            />
          )}

          {/* TAB: SIDE-BY-SIDE PLAN COMPARISON MATRIX */}
          {activeTab === 'matrix' && (
            <div className="comparison-view-content">
              {/* Purpose & Context Banner */}
              <div className="matrix-purpose-banner glass-card">
                <div className="matrix-purpose-header">
                  <div className="matrix-purpose-title-group">
                    <span className="matrix-purpose-tag font-mono">[DECISION SUPPORT]</span>
                    <h4 className="matrix-purpose-title">INFRASTRUCTURE RESILIENCE PLAN COMPARISON MATRIX</h4>
                  </div>
                  {currentSc ? (
                    <span className="matrix-active-badge font-mono">
                      BENCHMARK: {currentSc.name.toUpperCase()}
                    </span>
                  ) : (
                    <span className="matrix-active-badge font-mono">
                      PREVIEWING: {benchmarkSc?.name.toUpperCase() || 'MONSOON FLOODING'}
                    </span>
                  )}
                </div>
                <p className="matrix-purpose-desc">
                  This decision-support matrix quantifies mitigation ROI under disaster shocks across three strategies:
                  <strong> Scenario A</strong> measures the unmitigated baseline destruction with zero defenses;
                  <strong> Scenario B</strong> measures the live damage reduction achieved by your manually deployed interventions;
                  <strong> Scenario C</strong> shows the AI knapsack optimizer's mathematically optimal upgrade allocation for the same budget.
                </p>
                {isPreview && (
                  <div className="matrix-empty-cta-box">
                    <span>Currently in nominal explore mode. You can load this benchmark shock or choose another disaster from the Library:</span>
                    <button className="matrix-cta-btn font-mono" onClick={() => setActiveTab('library')}>
                      BROWSE SCENARIOS LIBRARY ({app.scenariosList.length})
                    </button>
                  </div>
                )}
              </div>

              <div className="comparison-grid-three">
                {/* 1. Unmitigated Baseline */}
                <div className="scenario-col glass-card scenario-col-baseline">
                  <div className="col-header">
                    <div className="col-title-row">
                      <span className="col-scenario-letter font-mono">SCENARIO A</span>
                      <span className="col-tag badge-danger font-mono">UNMITIGATED BENCHMARK</span>
                    </div>
                    <h3 className="col-name">
                      {currentSc ? currentSc.name : `${benchmarkSc?.name || 'Monsoon Flooding'} (Benchmark)`}
                    </h3>
                    <p className="col-desc">
                      {currentSc
                        ? currentSc.description
                        : `Unmitigated baseline damage if ${benchmarkSc?.name || 'Monsoon Flooding'} strikes with zero defenses.`}
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
                    {isPreview && benchmarkSc ? (
                      <button
                        className="col-btn btn-primary font-mono"
                        onClick={() => handleLoadScenario(benchmarkSc)}
                      >
                        LOAD BENCHMARK SCENARIO
                      </button>
                    ) : (
                      <button
                        className="col-btn btn-secondary font-mono"
                        onClick={handleResetToBaseline}
                      >
                        TEST BASELINE STATE
                      </button>
                    )}
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
                        isPreview ? (
                          <>
                            <span className="active-intervention-chip chip-optimal font-mono">
                              Substation Flood Barriers (Hiranandani 220kV)
                            </span>
                            <span className="active-intervention-chip chip-optimal font-mono">
                              Aux Generator 250kVA (Dr L H Hiranandani Hospital)
                            </span>
                            <span className="active-intervention-chip chip-optimal font-mono">
                              Pump Submersible Seals (Powai Pumping Station)
                            </span>
                          </>
                        ) : (
                          <span className="interventions-empty-text">No interventions required</span>
                        )
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

