export interface GeoJsonGeometry {
  type: 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon';
  coordinates: any;
}

export interface GeoJsonFeatureProperties {
  osm_id?: string;
  feature_type: string;
  name?: string;
  road_class?: string;
  building_levels?: number;
  [key: string]: any;
}

export interface GeoJsonFeature {
  type: 'Feature';
  properties: GeoJsonFeatureProperties;
  geometry: GeoJsonGeometry;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  name?: string;
  features: GeoJsonFeature[];
  crs?: any;
}
