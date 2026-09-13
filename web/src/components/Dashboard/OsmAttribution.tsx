import React from 'react';

export const OsmAttribution: React.FC = () => {
  return (
    <div className="osm-attribution-badge">
      <span>
        Map data &copy;{' '}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="osm-link"
        >
          OpenStreetMap contributors
        </a>
      </span>
      <span className="attribution-sep">•</span>
      <span>Powai & Hiranandani Urban Resilience Model</span>
    </div>
  );
};
