import React, { useState, useEffect, useMemo } from 'react';
import type { ApplicationState } from '../../state/applicationState';
import { appState } from '../../state/applicationState';
import type {
  DisasterScenario,
  HazardDefinition,
  HazardIntensityLevel,
  HazardType,
} from '../../types/hazard';
import hazardConfig from '../../hazards/hazardConfig.json';
import {
  calculateHazardPreview,
  getIntensityLevel,
  validateHazardScenario,
} from '../../hazards/hazardEngine';
import { PREDEFINED_DISASTER_SCENARIOS } from '../../hazards/hazardScenarios';

interface Props {
  onClose: () => void;
  onSuccessMessage: (msg: string) => void;
}

type StepNumber = 1 | 2 | 3 | 4 | 5 | 6;

export const HazardWizard: React.FC<Props> = ({ onClose, onSuccessMessage }) => {
  const [app, setApp] = useState<ApplicationState>(appState.getState());
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);

  // Wizard state parameters
  const [selectedHazardType, setSelectedHazardType] = useState<HazardType>('EXTREME_RAINFALL');
  const [intensity, setIntensity] = useState<number>(0.82);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('powai_lake_embankment');
  const [radiusM, setRadiusM] = useState<number>(650);
  const [durationHours, setDurationHours] = useState<number>(6);
  const [startTime, setStartTime] = useState<string>('04:00');
  const [randomSeed, setRandomSeed] = useState<number>(42);
  const [previewTab, setPreviewTab] = useState<'summary' | 'exposure' | 'initial_effects' | 'cascade' | 'provenance'>('summary');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    return appState.subscribe((newState) => setApp({ ...newState }));
  }, []);

  const hazardTypesList = Object.values(hazardConfig.hazard_types);
  const zonesList = hazardConfig.predefined_zones;
  const currentZone = zonesList.find((z) => z.zone_id === selectedZoneId) || zonesList[0];
  const currentHazardMeta = hazardConfig.hazard_types[selectedHazardType as keyof typeof hazardConfig.hazard_types] || hazardTypesList[0];

  // Assemble active hazard definition from wizard parameters
  const activeHazardDef: HazardDefinition = useMemo(() => {
    return {
      hazard_id: `hazard_${selectedHazardType.toLowerCase()}_${Date.now().toString().slice(-4)}`,
      hazard_type: selectedHazardType,
      name: `${currentHazardMeta.name} — ${currentZone.name}`,
      intensity,
      duration_hours: durationHours,
      start_time: startTime,
      peak_time_hours: Math.max(1, Math.round(durationHours * 0.6)),
      affected_area: {
        type: 'zone',
        zone_id: currentZone.zone_id,
        name: currentZone.name,
        coordinates: currentZone.coordinates as [number, number][],
        center: currentZone.center as [number, number],
        radius_m: radiusM,
      },
      parameters: {
        ...currentHazardMeta.default_parameters,
      },
      random_seed: randomSeed,
      provenance: {
        geometry: 'REAL',
        parameters: 'SIMULATED',
        exposure: 'DERIVED',
      },
    };
  }, [selectedHazardType, currentHazardMeta, currentZone, intensity, durationHours, startTime, radiusM, randomSeed]);

  // Compute live dynamic exposure and impact preview using hazardEngine
  const previewSummary = useMemo(() => {
    if (!app.network) return null;
    return calculateHazardPreview(activeHazardDef, app.network);
  }, [activeHazardDef, app.network]);

  // Assemble disaster scenario
  const assembledScenario: DisasterScenario = useMemo(() => {
    return {
      schema_version: '1.0',
      id: `disaster_${selectedHazardType.toLowerCase()}_${Date.now()}`,
      name: `${currentHazardMeta.name} (${currentZone.name})`,
      network_id: 'powai_hiranandani',
      description: `${currentHazardMeta.name} at intensity ${(intensity * 100).toFixed(0)}% across ${currentZone.name}. ${currentHazardMeta.description}`,
      duration_hours: durationHours,
      random_seed: randomSeed,
      budget: 2000000,
      hazards: [activeHazardDef],
    };
  }, [selectedHazardType, currentHazardMeta, currentZone, intensity, durationHours, randomSeed, activeHazardDef]);

  // Load a predefined scenario directly into wizard
  const handleLoadPresetScenario = (preset: DisasterScenario) => {
    const h = preset.hazards[0];
    if (h) {
      setSelectedHazardType(h.hazard_type);
      setIntensity(h.intensity);
      if (h.affected_area.zone_id) {
        setSelectedZoneId(h.affected_area.zone_id);
      }
      if (h.affected_area.radius_m) {
        setRadiusM(h.affected_area.radius_m);
      }
      setDurationHours(h.duration_hours);
      setStartTime(h.start_time || '04:00');
      setRandomSeed(h.random_seed || 42);
    }
    setCurrentStep(5); // Jump straight to preview
  };

  // Step 6: Trigger live disaster simulation
  const handleStartSimulation = () => {
    const validation = validateHazardScenario(assembledScenario, app.network || undefined);
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }

    setValidationErrors([]);
    appState.loadDisasterScenario(assembledScenario);
    onSuccessMessage(
      `Disaster Scenario "${assembledScenario.name}" launched! Initial physical disruptions applied. Cascade timeline active.`
    );
    onClose();
  };

  return (
    <div className="hazard-wizard-view">
      {/* Top Presets Quick-Launcher */}
      <div className="hazard-presets-strip glass-card">
        <div className="preset-strip-label font-mono">
          <span>CANONICAL DISASTER SHOCKS (SPECIFICATION SECTION 22–24):</span>
        </div>
        <div className="preset-strip-buttons">
          {PREDEFINED_DISASTER_SCENARIOS.map((preset) => {
            const isFlagship = preset.id === 'scenario_extreme_rainfall_01';
            return (
              <button
                key={preset.id}
                className={`preset-pill-btn font-mono ${isFlagship ? 'btn-flagship' : ''}`}
                onClick={() => handleLoadPresetScenario(preset)}
                title={preset.description}
              >
                {isFlagship && <span className="flagship-badge">FLAGSHIP</span>}
                {preset.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* 6-Step Workflow Progress Navigation */}
      <div className="wizard-stepper-bar glass-card">
        {[
          { step: 1, label: '1. Hazard Type' },
          { step: 2, label: '2. Intensity' },
          { step: 3, label: '3. Geographic Area' },
          { step: 4, label: '4. Duration & Curve' },
          { step: 5, label: '5. Exposure Preview' },
          { step: 6, label: '6. Start Simulation' },
        ].map((item) => {
          const isActive = currentStep === item.step;
          const isPassed = currentStep > item.step;
          return (
            <button
              key={item.step}
              className={`stepper-tab-btn font-mono ${isActive ? 'active' : ''} ${isPassed ? 'passed' : ''}`}
              onClick={() => setCurrentStep(item.step as StepNumber)}
            >
              <span className="step-num">{item.step}</span>
              <span className="step-txt">{item.label}</span>
            </button>
          );
        })}
      </div>

      {validationErrors.length > 0 && (
        <div className="wizard-error-banner">
          <strong>Validation Errors:</strong>
          <ul>
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* STEP 1: SELECT HAZARD TYPE */}
      {currentStep === 1 && (
        <div className="wizard-step-pane glass-card">
          <div className="step-header">
            <span className="step-tag font-mono">STEP 1 OF 6</span>
            <h3 className="step-title">Select Initiating Natural Hazard</h3>
            <p className="step-desc">
              Choose the initiating environmental disruption. The physical hazard generates initial local damage, and the urban infrastructure network dictates subsequent cascading propagation.
            </p>
          </div>

          <div className="hazard-types-grid">
            {hazardTypesList.map((ht) => {
              const isSelected = selectedHazardType === ht.id;
              return (
                <div
                  key={ht.id}
                  className={`hazard-type-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedHazardType(ht.id as HazardType)}
                >
                  <div className="ht-card-top">
                    <span className="ht-badge font-mono" style={{ borderColor: ht.color, color: ht.color }}>
                      {ht.badge}
                    </span>
                    {isSelected && <span className="ht-check font-mono">ACTIVE</span>}
                  </div>
                  <h4 className="ht-name">{ht.name}</h4>
                  <p className="ht-desc">{ht.description}</p>
                  <div className="ht-effects-list">
                    <span className="ht-effects-title font-mono">Potential Effects:</span>
                    <div className="ht-effects-chips">
                      {ht.potential_effects.slice(0, 4).map((eff, i) => (
                        <span key={i} className="eff-chip font-mono">
                          {eff}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="step-footer-actions">
            <button className="btn-wizard-next font-mono btn-primary" onClick={() => setCurrentStep(2)}>
              CONTINUE TO STEP 2: SET INTENSITY &rarr;
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: SET INTENSITY */}
      {currentStep === 2 && (
        <div className="wizard-step-pane glass-card">
          <div className="step-header">
            <span className="step-tag font-mono">STEP 2 OF 6</span>
            <h3 className="step-title">Configure Hazard Intensity: {getIntensityLevel(intensity).toUpperCase()}</h3>
            <p className="step-desc">
              Intensity is modeled on a normalized scale [0.0 = Nominal, 1.0 = Maximum Modeled Event].
              <br />
              <strong>Important:</strong> Intensity does not equal the % of assets that fail. Instead,{' '}
              <span className="formula-highlight font-mono">
                Hazard Intensity + Exposure + Vulnerability &rarr; Initial Disruption
              </span>.
            </p>
          </div>

          {/* Quick Preset Buttons */}
          <div className="intensity-preset-row">
            {(Object.entries(hazardConfig.intensity_levels) as [HazardIntensityLevel, any][]).map(
              ([lvlKey, lvlData]) => {
                const isActive = Math.abs(intensity - lvlData.value) < 0.08;
                return (
                  <button
                    key={lvlKey}
                    className={`intensity-preset-btn ${isActive ? 'active' : ''}`}
                    onClick={() => setIntensity(lvlData.value)}
                  >
                    <span className="lvl-label font-mono">{lvlData.label}</span>
                    <span className="lvl-num font-mono">{(lvlData.value * 100).toFixed(0)}%</span>
                    <span className="lvl-desc">{lvlData.description}</span>
                  </button>
                );
              }
            )}
          </div>

          {/* Continuous Slider */}
          <div className="intensity-slider-wrap">
            <div className="slider-label-row">
              <span className="font-mono">Fine Calibration Slider</span>
              <strong className="font-mono text-primary">{(intensity * 100).toFixed(0)}% Intensity ({intensity.toFixed(2)})</strong>
            </div>
            <input
              type="range"
              min="0.10"
              max="1.00"
              step="0.02"
              value={intensity}
              onChange={(e) => setIntensity(parseFloat(e.target.value))}
              className="intensity-range-slider"
            />
          </div>

          <div className="step-footer-actions">
            <button className="btn-wizard-back font-mono" onClick={() => setCurrentStep(1)}>
              &larr; BACK
            </button>
            <button className="btn-wizard-next font-mono btn-primary" onClick={() => setCurrentStep(3)}>
              CONTINUE TO STEP 3: DEFINE GEOGRAPHY &rarr;
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: DEFINE GEOGRAPHIC AREA */}
      {currentStep === 3 && (
        <div className="wizard-step-pane glass-card">
          <div className="step-header">
            <span className="step-tag font-mono">STEP 3 OF 6</span>
            <h3 className="step-title">Define Geographic Footprint</h3>
            <p className="step-desc">
              Select an authentic geographic zone across the Powai Lake and Hiranandani study area.
              Direct spatial exposure is evaluated using real OpenStreetMap coordinates and distance-decay buffers.
            </p>
          </div>

          <div className="zones-selector-grid">
            {zonesList.map((z) => {
              const isSelected = selectedZoneId === z.zone_id;
              return (
                <div
                  key={z.zone_id}
                  className={`zone-select-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedZoneId(z.zone_id);
                    setRadiusM(z.radius_m);
                  }}
                >
                  <div className="zone-card-top">
                    <span className="zone-id-tag font-mono">{z.zone_id}</span>
                    {isSelected && <span className="zone-active-pill font-mono">SELECTED ZONE</span>}
                  </div>
                  <h4 className="zone-name">{z.name}</h4>
                  <div className="zone-meta-row font-mono">
                    <span>Center: [{z.center[0].toFixed(3)}, {z.center[1].toFixed(3)}]</span>
                    <span>Radius: {z.radius_m}m</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="radius-slider-wrap">
            <div className="slider-label-row">
              <span className="font-mono">Footprint Blast / Inundation Radius</span>
              <strong className="font-mono text-primary">{radiusM} meters</strong>
            </div>
            <input
              type="range"
              min="300"
              max="1500"
              step="50"
              value={radiusM}
              onChange={(e) => setRadiusM(parseInt(e.target.value, 10))}
              className="intensity-range-slider"
            />
          </div>

          <div className="step-footer-actions">
            <button className="btn-wizard-back font-mono" onClick={() => setCurrentStep(2)}>
              &larr; BACK
            </button>
            <button className="btn-wizard-next font-mono btn-primary" onClick={() => setCurrentStep(4)}>
              CONTINUE TO STEP 4: DURATION &amp; TIMING &rarr;
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: SET DURATION */}
      {currentStep === 4 && (
        <div className="wizard-step-pane glass-card">
          <div className="step-header">
            <span className="step-tag font-mono">STEP 4 OF 6</span>
            <h3 className="step-title">Configure Temporal Profile: {durationHours} Hours</h3>
            <p className="step-desc">
              Natural disasters evolve across time. Configure event onset time, duration, and peak intensity curve.
              Hazard cessation does not imply immediate recovery; downstream restoration is governed independently.
            </p>
          </div>

          <div className="duration-quick-row">
            {[6, 12, 24].map((hours) => (
              <button
                key={hours}
                className={`duration-quick-btn font-mono ${durationHours === hours ? 'active' : ''}`}
                onClick={() => setDurationHours(hours)}
              >
                <strong>{hours} Hours</strong>
                <span>{hours === 6 ? 'Rapid Flash Event' : hours === 12 ? 'Sustained Monsoon Surge' : 'Prolonged Grid Emergency'}</span>
              </button>
            ))}
          </div>

          <div className="timing-inputs-row">
            <label className="timing-input-label font-mono">
              <span>Event Start Time:</span>
              <input
                type="text"
                className="timing-text-input font-mono"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="04:00"
              />
            </label>

            <label className="timing-input-label font-mono">
              <span>Deterministic Seed (Reproducibility):</span>
              <input
                type="number"
                className="timing-text-input font-mono"
                value={randomSeed}
                onChange={(e) => setRandomSeed(parseInt(e.target.value, 10) || 42)}
              />
            </label>
          </div>

          {/* Temporal Evolution Timeline Preview */}
          <div className="time-evolution-box glass-card">
            <span className="evolution-title font-mono">TEMPORAL PROFILE PREVIEW (SECTION 13):</span>
            <div className="evolution-steps-grid font-mono">
              <div className="evo-step">
                <span className="evo-time">00:00</span>
                <span className="evo-desc">Rain begins / Hazard onset</span>
              </div>
              <div className="evo-step">
                <span className="evo-time">+{(durationHours * 0.3).toFixed(1)}h</span>
                <span className="evo-desc">Intensity buildup</span>
              </div>
              <div className="evo-step active">
                <span className="evo-time">+{(durationHours * 0.6).toFixed(1)}h</span>
                <span className="evo-desc">PEAK INTENSITY ({Math.round(intensity * 100)}%)</span>
              </div>
              <div className="evo-step">
                <span className="evo-time">+{durationHours}h</span>
                <span className="evo-desc">Hazard recession &amp; recovery begins</span>
              </div>
            </div>
          </div>

          <div className="step-footer-actions">
            <button className="btn-wizard-back font-mono" onClick={() => setCurrentStep(3)}>
              &larr; BACK
            </button>
            <button className="btn-wizard-next font-mono btn-primary" onClick={() => setCurrentStep(5)}>
              CONTINUE TO STEP 5: PREVIEW EXPOSURE &rarr;
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: PREVIEW EXPOSURE & DISASTER SUMMARY */}
      {currentStep === 5 && previewSummary && (
        <div className="wizard-step-pane glass-card">
          <div className="step-header">
            <div className="step-header-row">
              <div>
                <span className="step-tag font-mono">STEP 5 OF 6 — BEFORE SIMULATION</span>
                <h3 className="step-title">Disaster Scenario Summary &amp; Impact Preview</h3>
              </div>
              <button
                className="btn-primary font-mono btn-jump-simulate"
                onClick={() => setCurrentStep(6)}
              >
                PROCEED TO LAUNCH &rarr;
              </button>
            </div>
            <p className="step-desc">
              Sections 18 &amp; 19: Clearly distinguishing <strong>Hazard Exposure</strong> (who is in the danger zone) from{' '}
              <strong>Initial Infrastructure Effects</strong> (what degrades or fails initially) before the cascade propagates.
            </p>
          </div>

          {/* Section 18: Standardized Disaster Scenario Summary Box */}
          <div className="disaster-summary-box glass-card">
            <div className="dsb-top-row">
              <div className="dsb-title-block">
                <span className="dsb-type font-mono">{previewSummary.hazard_type}</span>
                <h4 className="dsb-name">{previewSummary.hazard_name}</h4>
              </div>
              <div className="dsb-badge-block">
                <span className="dsb-severity font-mono">SEVERITY: {previewSummary.intensity_level.toUpperCase()}</span>
                <span className="dsb-duration font-mono">DURATION: {previewSummary.duration_hours} HOURS</span>
              </div>
            </div>

            <div className="dsb-stats-grid">
              <div className="dsb-stat">
                <span className="dsb-stat-lbl">Affected Area:</span>
                <strong className="dsb-stat-val font-mono">{previewSummary.affected_area_name}</strong>
              </div>
              <div className="dsb-stat">
                <span className="dsb-stat-lbl">Infrastructure Exposed:</span>
                <strong className="dsb-stat-val font-mono text-warning">
                  {previewSummary.exposed_assets.length} assets
                </strong>
              </div>
              <div className="dsb-stat">
                <span className="dsb-stat-lbl">Expected Initial Disruptions:</span>
                <strong className="dsb-stat-val font-mono text-danger">
                  {previewSummary.expected_initial_disruptions.length} assets expected to degrade/fail
                </strong>
              </div>
              <div className="dsb-stat">
                <span className="dsb-stat-lbl">Population at Risk:</span>
                <strong className="dsb-stat-val font-mono">
                  {previewSummary.population_exposed.toLocaleString('en-IN')}
                </strong>
              </div>
              <div className="dsb-stat">
                <span className="dsb-stat-lbl">Uncertainty (P05 / Median / P95):</span>
                <strong className="dsb-stat-val font-mono text-info">
                  {previewSummary.uncertainty.p05.toLocaleString('en-IN')} / {previewSummary.uncertainty.median.toLocaleString('en-IN')} / {previewSummary.uncertainty.p95.toLocaleString('en-IN')}
                </strong>
              </div>
            </div>
          </div>

          {/* Navigation tabs for detailed breakdown */}
          <div className="preview-subnav-tabs">
            <button
              className={`preview-tab-btn font-mono ${previewTab === 'summary' ? 'active' : ''}`}
              onClick={() => setPreviewTab('summary')}
            >
              Causal Chain Breakdown
            </button>
            <button
              className={`preview-tab-btn font-mono ${previewTab === 'exposure' ? 'active' : ''}`}
              onClick={() => setPreviewTab('exposure')}
            >
              Hazard Exposure ({previewSummary.exposed_assets.length})
            </button>
            <button
              className={`preview-tab-btn font-mono ${previewTab === 'initial_effects' ? 'active' : ''}`}
              onClick={() => setPreviewTab('initial_effects')}
            >
              Initial Disruptions ({previewSummary.expected_initial_disruptions.length})
            </button>
            <button
              className={`preview-tab-btn font-mono ${previewTab === 'cascade' ? 'active' : ''}`}
              onClick={() => setPreviewTab('cascade')}
            >
              Potential Cascade
            </button>
            <button
              className={`preview-tab-btn font-mono ${previewTab === 'provenance' ? 'active' : ''}`}
              onClick={() => setPreviewTab('provenance')}
            >
              Data Provenance (Section 20)
            </button>
          </div>

          {/* Subtab 1: Causal Chain */}
          {previewTab === 'summary' && (
            <div className="causal-chain-panel glass-card">
              <div className="causal-chain-flow">
                <div className="causal-node">
                  <span className="c-step font-mono">1. NATURAL HAZARD</span>
                  <strong>{currentHazardMeta.name}</strong>
                  <span className="c-sub font-mono">Intensity: {(intensity * 100).toFixed(0)}%</span>
                </div>
                <div className="c-arrow">&rarr;</div>
                <div className="causal-node">
                  <span className="c-step font-mono">2. HAZARD EXPOSURE</span>
                  <strong>{previewSummary.exposed_assets.length} Assets Exposed</strong>
                  <span className="c-sub font-mono">{previewSummary.affected_area_name}</span>
                </div>
                <div className="c-arrow">&rarr;</div>
                <div className="causal-node highlight-node">
                  <span className="c-step font-mono">3. INITIAL EFFECTS</span>
                  <strong>{previewSummary.expected_initial_disruptions.length} Assets Degraded/Tripped</strong>
                  <span className="c-sub font-mono">Physical threshold breach</span>
                </div>
                <div className="c-arrow">&rarr;</div>
                <div className="causal-node">
                  <span className="c-step font-mono">4. CASCADING FAILURE</span>
                  <strong>Downstream Propagation</strong>
                  <span className="c-sub font-mono">Power &rarr; Water &rarr; Health</span>
                </div>
              </div>
            </div>
          )}

          {/* Subtab 2: Hazard Exposure Table */}
          {previewTab === 'exposure' && (
            <div className="preview-table-container glass-card">
              <table className="hazard-preview-table font-mono">
                <thead>
                  <tr>
                    <th>Asset Name</th>
                    <th>Type</th>
                    <th>Distance</th>
                    <th>Exposure</th>
                    <th>Vulnerability</th>
                    <th>Exposure Type</th>
                  </tr>
                </thead>
                <tbody>
                  {previewSummary.exposed_assets.map((asset) => (
                    <tr key={asset.asset_id}>
                      <td><strong>{asset.asset_name}</strong></td>
                      <td>{asset.asset_type.toUpperCase()}</td>
                      <td>{asset.distance_m}m</td>
                      <td>
                        <span className={`exposure-chip ${asset.exposure_level}`}>
                          {asset.exposure_level.toUpperCase()}
                        </span>
                      </td>
                      <td>{(asset.vulnerability * 100).toFixed(0)}%</td>
                      <td>{asset.direct_exposure ? 'Direct Footprint' : 'Indirect Access Link'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Subtab 3: Initial Disruptions Table */}
          {previewTab === 'initial_effects' && (
            <div className="preview-table-container glass-card">
              <table className="hazard-preview-table font-mono">
                <thead>
                  <tr>
                    <th>Asset Name</th>
                    <th>Type</th>
                    <th>Disruption Score</th>
                    <th>Initial Operational Effect</th>
                    <th>Engineering Rationale</th>
                  </tr>
                </thead>
                <tbody>
                  {previewSummary.expected_initial_disruptions.map((asset) => (
                    <tr key={asset.asset_id}>
                      <td><strong>{asset.asset_name}</strong></td>
                      <td>{asset.asset_type.toUpperCase()}</td>
                      <td>{(asset.disruption_score * 100).toFixed(0)}%</td>
                      <td>
                        <span className={`effect-badge status-${asset.expected_effect}`}>
                          {asset.expected_effect.toUpperCase()}
                        </span>
                      </td>
                      <td className="reasons-col">{asset.reasons.join(' · ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Subtab 4: Potential Cascade */}
          {previewTab === 'cascade' && (
            <div className="potential-cascade-panel glass-card">
              <h4 className="pc-heading font-mono">PROJECTED DOWNSTREAM DEPENDENCY PROPAGATION:</h4>
              <p className="pc-sub">
                Once initial disruptions occur, consequences propagate through inter-sector service dependencies:
              </p>
              <div className="cascade-propagation-list">
                {previewSummary.expected_initial_disruptions.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="cascade-prop-item">
                    <span className="prop-initial font-mono">INITIAL: {item.asset_name} ({item.expected_effect.toUpperCase()})</span>
                    <span className="prop-arrow">&darr;</span>
                    <span className="prop-cascaded font-mono">
                      Downstream power loss &rarr; backup battery depletion &rarr; pump/hospital service derating
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subtab 5: Data Provenance */}
          {previewTab === 'provenance' && (
            <div className="provenance-panel glass-card font-mono">
              <h4 className="prov-heading">STRICT DATA PROVENANCE (SECTION 20):</h4>
              <div className="prov-grid">
                <div className="prov-item">
                  <span className="prov-tag real">REAL</span>
                  <span className="prov-label">Study Area &amp; Facilities:</span>
                  <span className="prov-desc">OpenStreetMap spatial geometries, road network, and facility coordinates</span>
                </div>
                <div className="prov-item">
                  <span className="prov-tag sim">SIMULATED</span>
                  <span className="prov-label">Hazard Physics &amp; Vulnerabilities:</span>
                  <span className="prov-desc">Engineered flood depth, wind velocity, and asset fragility curves</span>
                </div>
                <div className="prov-item">
                  <span className="prov-tag der">DERIVED</span>
                  <span className="prov-label">Spatial Exposure &amp; Disruptions:</span>
                  <span className="prov-desc">Computed intersection of hazard footprint, distance decay, and municipal Ward S population</span>
                </div>
              </div>
            </div>
          )}

          <div className="step-footer-actions">
            <button className="btn-wizard-back font-mono" onClick={() => setCurrentStep(4)}>
              &larr; BACK
            </button>
            <button className="btn-wizard-next font-mono btn-primary" onClick={() => setCurrentStep(6)}>
              PROCEED TO STEP 6: START SIMULATION &rarr;
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: START SIMULATION */}
      {currentStep === 6 && (
        <div className="wizard-step-pane glass-card step-launch-pane">
          <div className="step-header">
            <span className="step-tag font-mono">STEP 6 OF 6 — EXECUTE</span>
            <h3 className="step-title">Launch Natural Disaster Simulation</h3>
            <p className="step-desc">
              Ready to execute. Initial disruptions will be applied to the 3D map, the restrained hazard overlay will visualize the footprint, and the discrete-time cascade timeline will begin.
            </p>
          </div>

          <div className="launch-summary-card glass-card">
            <div className="lsc-row">
              <span>Scenario Name:</span>
              <strong className="font-mono text-primary">{assembledScenario.name}</strong>
            </div>
            <div className="lsc-row">
              <span>Hazard Type:</span>
              <strong className="font-mono">{selectedHazardType}</strong>
            </div>
            <div className="lsc-row">
              <span>Initial Disruption Assets:</span>
              <strong className="font-mono text-danger">
                {previewSummary?.expected_initial_disruptions.length || 0} Assets
              </strong>
            </div>
            <div className="lsc-row">
              <span>Simulation Duration:</span>
              <strong className="font-mono">{durationHours} Hours</strong>
            </div>
          </div>

          <div className="launch-cta-wrap">
            <button
              className="btn-launch-simulation font-mono btn-success"
              onClick={handleStartSimulation}
            >
              [ START SIMULATION ]
            </button>
          </div>

          <div className="step-footer-actions">
            <button className="btn-wizard-back font-mono" onClick={() => setCurrentStep(5)}>
              &larr; BACK TO PREVIEW
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
