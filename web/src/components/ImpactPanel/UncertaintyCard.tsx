import React from 'react';
import type { UncertaintyResult } from '../../types/impact';

interface Props {
  uncertainty: UncertaintyResult | null;
}

export const UncertaintyCard: React.FC<Props> = ({ uncertainty }) => {
  if (!uncertainty) return null;

  const { p05, median, p95 } = uncertainty.population_affected;
  const rangeSpan = p95 - p05 || 1;
  const medianOffsetPct = Math.max(0, Math.min(100, ((median - p05) / rangeSpan) * 100));

  const probPct = Math.round(uncertainty.hospital_failure_probability * 100);

  return (
    <div className="uncertainty-card">
      <div className="card-section-header">
        <span className="card-title font-mono">[MC] MONTE CARLO UNCERTAINTY MODEL</span>
        <span className="sample-size font-mono">{uncertainty.iterations.toLocaleString()} Runs</span>
      </div>

      <div className="distribution-block">
        <div className="dist-header">
          <span className="dist-label">Population Affected (90% Confidence Interval)</span>
          <span className="dist-median font-mono">
            Median: <strong>{median.toLocaleString('en-IN')}</strong>
          </span>
        </div>

        <div className="range-bar-container">
          <div className="range-track">
            <div className="range-fill" style={{ left: '10%', right: '10%' }}>
              <div
                className="median-marker"
                style={{ left: `${medianOffsetPct}%` }}
                title={`Median: ${median}`}
              />
            </div>
          </div>
          <div className="range-labels font-mono">
            <span>p05: {p05.toLocaleString('en-IN')}</span>
            <span className="range-tag">Likely Range</span>
            <span>p95: {p95.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      <div className="probability-block">
        <div className="prob-header">
          <span>Hospital Failure Probability (Within 6h)</span>
          <strong className="prob-value font-mono text-danger">{probPct}%</strong>
        </div>
        <div className="prob-bar-bg">
          <div
            className="prob-bar-fill"
            style={{ width: `${probPct}%` }}
          />
        </div>
        <div className="prob-footer font-mono">
          <span>
            Expected Failure Window: {uncertainty.hospital_failure_time_hours.p05}h –{' '}
            {uncertainty.hospital_failure_time_hours.p95}h (Median:{' '}
            {uncertainty.hospital_failure_time_hours.median}h)
          </span>
        </div>
      </div>
    </div>
  );
};
