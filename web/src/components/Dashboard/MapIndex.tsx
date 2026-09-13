import React, { useState } from 'react';
import { appState } from '../../state/applicationState';

interface LandmarkItem {
  id: string;
  name: string;
  category: 'hospital' | 'school' | 'power' | 'water' | 'tower' | 'lake' | 'road' | 'commercial' | 'hotel';
  tag: string;
  lat: number;
  lon: number;
  networkAssetId?: string;
}

const LANDMARKS: LandmarkItem[] = [
  // Hospitals
  {
    id: 'hosp_hiranandani',
    name: 'Dr. L. H. Hiranandani Hospital',
    category: 'hospital',
    tag: 'HOSP',
    lat: 19.120406,
    lon: 72.916979,
    networkAssetId: 'hospital_01',
  },
  {
    id: 'hosp_powai',
    name: 'Powai Hospital & Polyclinic',
    category: 'hospital',
    tag: 'HOSP',
    lat: 19.123500,
    lon: 72.912500,
  },
  {
    id: 'hosp_iit',
    name: 'IIT Bombay Hospital',
    category: 'hospital',
    tag: 'HOSP',
    lat: 19.127800,
    lon: 72.914200,
    networkAssetId: 'iit_hospital_01',
  },
  {
    id: 'hosp_nirali',
    name: 'Nirali A M Naik Healthcare',
    category: 'hospital',
    tag: 'HOSP',
    lat: 19.117200,
    lon: 72.919800,
    networkAssetId: 'nirali_healthcare_01',
  },

  // Schools
  {
    id: 'school_hfs',
    name: 'Hiranandani Foundation School',
    category: 'school',
    tag: 'SCHL',
    lat: 19.117982,
    lon: 72.907575,
    networkAssetId: 'school_01',
  },
  {
    id: 'school_kv',
    name: 'Kendriya Vidyalaya IIT Powai',
    category: 'school',
    tag: 'SCHL',
    lat: 19.125200,
    lon: 72.913500,
    networkAssetId: 'kv_iit_school_01',
  },
  {
    id: 'school_shetty',
    name: 'S.M. Shetty High School & College',
    category: 'school',
    tag: 'SCHL',
    lat: 19.115800,
    lon: 72.905800,
    networkAssetId: 'sm_shetty_institute_01',
  },
  {
    id: 'school_iit_som',
    name: 'SJMSOM (IIT Bombay Management)',
    category: 'school',
    tag: 'SCHL',
    lat: 19.131500,
    lon: 72.915200,
    networkAssetId: 'iit_main_building_01',
  },
  {
    id: 'school_nitie',
    name: 'IIM Mumbai / NITIE Campus',
    category: 'school',
    tag: 'SCHL',
    lat: 19.135000,
    lon: 72.898000,
    networkAssetId: 'nitie_campus_01',
  },

  // Power & Water Infrastructure
  {
    id: 'power_substation',
    name: 'Powai Central 220kV Substation',
    category: 'power',
    tag: 'ELEC',
    lat: 19.122500,
    lon: 72.912500,
    networkAssetId: 'substation_01',
  },
  {
    id: 'power_substation_west',
    name: 'Lake Homes & Chandivali 110kV Substation',
    category: 'power',
    tag: 'ELEC',
    lat: 19.116500,
    lon: 72.898500,
    networkAssetId: 'substation_west_01',
  },
  {
    id: 'power_plant_iit',
    name: 'IIT Bombay Power Generation Substation',
    category: 'power',
    tag: 'GEN',
    lat: 19.126500,
    lon: 72.918000,
    networkAssetId: 'power_station_01',
  },
  {
    id: 'water_pumping',
    name: 'Powai Lake Water Pumping Works',
    category: 'water',
    tag: 'WTR',
    lat: 19.119000,
    lon: 72.901500,
    networkAssetId: 'water_pump_01',
  },

  // Hotels & Commercial Hubs
  {
    id: 'hotel_westin',
    name: 'The Westin Mumbai Powai Lake Convention Center',
    category: 'hotel',
    tag: 'HOTEL',
    lat: 19.134800,
    lon: 72.901500,
    networkAssetId: 'westin_powai_01',
  },
  {
    id: 'comm_kensington',
    name: 'Kensington Business Park SEZ',
    category: 'commercial',
    tag: 'COMM',
    lat: 19.107400,
    lon: 72.897800,
    networkAssetId: 'kensington_sez_01',
  },
  {
    id: 'comm_galleria',
    name: 'Galleria Commercial Mall & Retail Center',
    category: 'commercial',
    tag: 'COMM',
    lat: 19.107000,
    lon: 72.897200,
    networkAssetId: 'galleria_complex_01',
  },
  {
    id: 'comm_crisil',
    name: 'Crisil House Financial Intelligence Center',
    category: 'commercial',
    tag: 'COMM',
    lat: 19.116900,
    lon: 72.910800,
    networkAssetId: 'crisil_house_01',
  },
  {
    id: 'comm_bayer',
    name: 'Bayer Life Sciences Regional Headquarters',
    category: 'commercial',
    tag: 'COMM',
    lat: 19.119000,
    lon: 72.912300,
    networkAssetId: 'bayer_headquarters_01',
  },

  // Major Landmark Towers
  {
    id: 'tower_somerset',
    name: 'Somerset Tower Hiranandani',
    category: 'tower',
    tag: 'TWNR',
    lat: 19.117500,
    lon: 72.906600,
    networkAssetId: 'somerset_tower_01',
  },
  {
    id: 'tower_panchvati',
    name: 'Panchvati Residential High-Rise',
    category: 'tower',
    tag: 'TWNR',
    lat: 19.115600,
    lon: 72.903100,
    networkAssetId: 'panchvati_residence_01',
  },
  {
    id: 'tower_lake_castle',
    name: 'Lake Castle Luxury Tower',
    category: 'tower',
    tag: 'TWNR',
    lat: 19.121500,
    lon: 72.908500,
  },
  {
    id: 'tower_rodas',
    name: 'Rodas Enclave Gateway',
    category: 'tower',
    tag: 'TWNR',
    lat: 19.115000,
    lon: 72.910200,
  },

  // Natural Water & Roads
  {
    id: 'lake_powai',
    name: 'Powai Lake Natural Reservoir',
    category: 'lake',
    tag: 'LAKE',
    lat: 19.126500,
    lon: 72.905000,
  },
  {
    id: 'road_jvlr',
    name: 'Jogeshwari - Vikhroli Link Road (JVLR)',
    category: 'road',
    tag: 'ROAD',
    lat: 19.124500,
    lon: 72.910000,
    networkAssetId: 'road_jvlr_01',
  },
  {
    id: 'road_central_ave',
    name: 'Central Avenue Main Spine',
    category: 'road',
    tag: 'ROAD',
    lat: 19.119500,
    lon: 72.909000,
    networkAssetId: 'road_central_ave_01',
  },
];

interface Props {
  onFlyTo: (lat: number, lon: number) => void;
}

export const MapIndex: React.FC<Props> = ({ onFlyTo }) => {
  const [filter, setFilter] = useState<string>('all');

  const filtered = LANDMARKS.filter((l) => {
    if (filter === 'all') return true;
    return l.category === filter;
  });

  const handleItemClick = (item: LandmarkItem) => {
    onFlyTo(item.lat, item.lon);
    if (item.networkAssetId) {
      appState.setSelectedAssetId(item.networkAssetId);
    }
  };

  return (
    <aside className="map-index-panel emerging-panel glass-panel">
      <div className="panel-top-bar">
        <div className="title-with-pill">
          <h2 className="panel-main-title">LANDMARK INDEX</h2>
          <span className="status-pill pill-secondary font-mono">2KM RADIUS</span>
        </div>
        <button
          className="dock-close-btn"
          onClick={() => appState.toggleMapIndex(false)}
          title="Close index"
        >
          ×
        </button>
      </div>

      {/* Category Filter Bar */}
      <div className="index-filter-bar">
        {['all', 'hospital', 'school', 'hotel', 'commercial', 'power', 'water', 'tower', 'road'].map((cat) => (
          <button
            key={cat}
            className={`filter-pill font-mono ${filter === cat ? 'active' : ''}`}
            onClick={() => setFilter(cat)}
          >
            {cat === 'all'
              ? 'ALL'
              : cat === 'power'
              ? 'POWER'
              : cat === 'water'
              ? 'WATER'
              : cat === 'tower'
              ? 'TOWERS'
              : cat === 'road'
              ? 'ROADS'
              : cat === 'hotel'
              ? 'HOTELS'
              : cat === 'commercial'
              ? 'BUSINESS'
              : cat.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Items List */}
      <div className="panel-scroll-content index-items-list">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="index-item-row"
            onClick={() => handleItemClick(item)}
          >
            <span className="item-row-badge font-mono">{item.tag}</span>
            <div className="item-row-info">
              <span className="item-row-name">{item.name}</span>
              <span className="item-row-cat font-mono">
                {item.category.toUpperCase()} • {item.lat.toFixed(4)}N, {item.lon.toFixed(4)}E
              </span>
            </div>
            <button className="item-fly-btn font-mono" title="Focus view">
              FLY
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
};
