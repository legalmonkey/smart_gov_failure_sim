import * as THREE from 'three';

/**
 * Reusable geographic coordinate transform module for Powai Lake & Hiranandani.
 * Converts [latitude, longitude] in WGS84 to local Three.js Cartesian coordinates (X, Y, Z).
 *
 * Coordinate Convention:
 * - Longitude -> X (East positive)
 * - Latitude  -> Z (North negative, so looking towards -Z is looking North)
 * - Elevation -> Y (Up positive)
 */

// Study area default center (Powai / Hiranandani Gardens, Mumbai)
export const DEFAULT_CENTER = {
  latitude: 19.1200,
  longitude: 72.9080,
};

// Earth radius in meters
const EARTH_RADIUS_METERS = 6378137;
const RAD = Math.PI / 180;

// World scale: 1 unit in Three.js = 4 meters (scale = 0.25)
export const WORLD_SCALE = 0.25;

export class CoordinateTransform {
  private centerLat: number;
  private centerLon: number;
  private scale: number;
  private metersPerDegreeLat: number;
  private metersPerDegreeLon: number;

  constructor(
    centerLat: number = DEFAULT_CENTER.latitude,
    centerLon: number = DEFAULT_CENTER.longitude,
    scale: number = WORLD_SCALE
  ) {
    this.centerLat = centerLat;
    this.centerLon = centerLon;
    this.scale = scale;

    // Local metric scale for small geographic area
    this.metersPerDegreeLat = (Math.PI * EARTH_RADIUS_METERS) / 180;
    this.metersPerDegreeLon =
      ((Math.PI * EARTH_RADIUS_METERS) / 180) * Math.cos(this.centerLat * RAD);
  }

  public setCenter(lat: number, lon: number): void {
    this.centerLat = lat;
    this.centerLon = lon;
    this.metersPerDegreeLon =
      ((Math.PI * EARTH_RADIUS_METERS) / 180) * Math.cos(this.centerLat * RAD);
  }

  /**
   * Converts (latitude, longitude, optional elevation) into Three.js Vector3.
   */
  public latLonToWorld(lat: number, lon: number, elevation: number = 0): THREE.Vector3 {
    const deltaLon = lon - this.centerLon;
    const deltaLat = lat - this.centerLat;

    const xMeters = deltaLon * this.metersPerDegreeLon;
    const zMeters = -deltaLat * this.metersPerDegreeLat; // North is -Z

    const x = xMeters * this.scale;
    const y = elevation * this.scale;
    const z = zMeters * this.scale;

    return new THREE.Vector3(x, y, z);
  }

  /**
   * Converts Three.js (x, z) coordinates back to { latitude, longitude }.
   */
  public worldToLatLon(x: number, z: number): { latitude: number; longitude: number } {
    const xMeters = x / this.scale;
    const zMeters = z / this.scale;

    const deltaLon = xMeters / this.metersPerDegreeLon;
    const deltaLat = -zMeters / this.metersPerDegreeLat;

    return {
      latitude: this.centerLat + deltaLat,
      longitude: this.centerLon + deltaLon,
    };
  }
}

// Global default singleton instance
export const coordinateTransform = new CoordinateTransform();

export function latLonToWorld(lat: number, lon: number, elevation: number = 0): THREE.Vector3 {
  return coordinateTransform.latLonToWorld(lat, lon, elevation);
}

export function worldToLatLon(x: number, z: number): { latitude: number; longitude: number } {
  return coordinateTransform.worldToLatLon(x, z);
}
