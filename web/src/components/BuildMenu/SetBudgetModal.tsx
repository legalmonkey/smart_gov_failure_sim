import React, { useState } from 'react';
import { appState } from '../../state/applicationState';

interface Props {
  onClose: () => void;
}

const PRESET_BUDGETS = [
  { label: 'Tight / Austerity', amount: 1000000, desc: 'Severe financial constraints' },
  { label: 'Standard Baseline', amount: 2000000, desc: 'City standard annual allocation' },
  { label: 'Targeted Resilience', amount: 3500000, desc: 'Extended disaster preparedness' },
  { label: 'Maximum Protection', amount: 5000000, desc: 'Full-ward infrastructure hardening' },
];

export const SetBudgetModal: React.FC<Props> = ({ onClose }) => {
  const state = appState.getState();
  const [budgetVal, setBudgetVal] = useState<number>(state.budgetTotal);
  const [inputStr, setInputStr] = useState<string>(String(state.budgetTotal));

  const handleSelectPreset = (amount: number) => {
    setBudgetVal(amount);
    setInputStr(String(amount));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setInputStr(raw);
    const num = parseInt(raw, 10);
    if (!isNaN(num)) {
      setBudgetVal(num);
    } else {
      setBudgetVal(0);
    }
  };

  const handleSave = () => {
    appState.setBudget(budgetVal);
    onClose();
  };

  const remaining = budgetVal - state.budgetSpent;

  return (
    <div className="modal-backdrop">
      <div className="modal-container glass-panel budget-modal">
        <div className="modal-header">
          <div className="modal-title-group">
            <div>
              <h2 className="modal-title">SET RESILIENCE BUDGET</h2>
              <span className="modal-sub">
                Adjust the available municipal budget for protection interventions
              </span>
            </div>
          </div>
          <button className="dock-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="budget-modal-content">
          <div className="budget-overview-card">
            <div className="b-overview-item">
              <span className="b-label font-mono">PROPOSED BUDGET</span>
              <span className="b-val font-mono text-primary">₹{budgetVal.toLocaleString('en-IN')}</span>
            </div>
            <div className="b-overview-item">
              <span className="b-label font-mono">ALREADY COMMITTED</span>
              <span className="b-val font-mono text-warning">₹{state.budgetSpent.toLocaleString('en-IN')}</span>
            </div>
            <div className="b-overview-item">
              <span className="b-label font-mono">NEW REMAINING</span>
              <span className={`b-val font-mono ${remaining < 0 ? 'text-danger' : 'text-success'}`}>
                ₹{remaining.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="budget-presets-section">
            <h4 className="section-label font-mono">QUICK ALLOCATION PRESETS</h4>
            <div className="presets-grid">
              {PRESET_BUDGETS.map((preset) => {
                const isSelected = budgetVal === preset.amount;
                return (
                  <button
                    key={preset.amount}
                    className={`preset-card ${isSelected ? 'active' : ''}`}
                    onClick={() => handleSelectPreset(preset.amount)}
                  >
                    <div className="preset-top">
                      <span className="preset-title">{preset.label}</span>
                      <span className="preset-amount font-mono">
                        ₹{preset.amount.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <span className="preset-desc">{preset.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="custom-budget-section">
            <h4 className="section-label font-mono">CUSTOM BUDGET (INR)</h4>
            <div className="custom-input-row">
              <span className="currency-prefix font-mono">₹</span>
              <input
                type="text"
                className="budget-text-input font-mono"
                value={inputStr}
                onChange={handleInputChange}
                placeholder="Enter custom budget amount"
              />
            </div>
            {remaining < 0 && (
              <p className="warning-note font-mono">
                [ALERT] Proposed budget is less than currently committed interventions (₹{state.budgetSpent.toLocaleString('en-IN')}).
              </p>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary font-mono" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary font-mono" onClick={handleSave}>
            Apply Budget (₹{budgetVal.toLocaleString('en-IN')})
          </button>
        </div>
      </div>
    </div>
  );
};
