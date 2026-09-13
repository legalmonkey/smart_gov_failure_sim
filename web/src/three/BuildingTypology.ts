import * as THREE from 'three';
import type { GeoJsonFeature } from '../geo/geojsonTypes';

export type BuildingTypologyType =
  | 'residential_tower'
  | 'mid_rise_residential'
  | 'commercial'
  | 'low_rise'
  | 'villa'
  | 'institutional';

export interface ArchitecturalMassingSpec {
  typology: BuildingTypologyType;
  totalLevels: number;
  totalHeight: number;
  hasPodium: boolean;
  podiumLevels: number;
  podiumHeight: number;
  podiumScale: number;
  towerScale: number;
  upperSetbackLevels: number;
  upperSetbackScale: number;
  roofType: 'flat_penthouse' | 'stepped_terrace' | 'mechanical_enclosure' | 'pitched_terracotta' | 'parapet_only';
  facadeStyle: 'neoclassical' | 'glass_curtain' | 'sandstone_balcony' | 'institutional_concrete' | 'terracotta_warm';
  wallColor: number;
  accentColor: number;
  hasBalconies: boolean;
  balconyDepth: number;
}

/**
 * High-quality 32-bit FNV-1a + Mulberry32 deterministic PRNG.
 * Guarantees identical procedural results for the same building ID across reloads.
 */
export function createSeededRandom(seedStr: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Robust inward polygon shrinkage for generating setbacks and podiums.
 * Uses centroid-relative projection to guarantee no self-intersection.
 */
export function shrinkPolygonPoints(points: THREE.Vector2[], scale: number): THREE.Vector2[] {
  if (points.length < 3) return points.map((p) => p.clone());

  const center = new THREE.Vector2();
  for (const p of points) center.add(p);
  center.divideScalar(points.length);

  const clampedScale = Math.max(0.35, Math.min(0.98, scale));
  return points.map((p) => {
    const dir = new THREE.Vector2().subVectors(p, center);
    return new THREE.Vector2().addVectors(center, dir.multiplyScalar(clampedScale));
  });
}

/**
 * Classifies a GeoJSON building feature into one of 6 architectural typologies
 * and generates deterministic massing parameters.
 */
export function generateBuildingMassing(
  feat: GeoJsonFeature,
  footprintAreaApprox: number
): ArchitecturalMassingSpec {
  const osmId = feat.properties.osm_id || 'bld_default';
  const name = (feat.properties.name || '').toLowerCase();
  const rng = createSeededRandom(osmId);

  // 1. Identify Typology based on name, properties, and area
  let typology: BuildingTypologyType;

  if (
    name.includes('hospital') ||
    name.includes('school') ||
    name.includes('college') ||
    name.includes('department') ||
    name.includes('iit') ||
    name.includes('nitie') ||
    name.includes('center') ||
    name.includes('centre') ||
    name.includes('hostel') ||
    name.includes('institute')
  ) {
    typology = 'institutional';
  } else if (
    name.includes('galleria') ||
    name.includes('kensington') ||
    name.includes('crisil') ||
    name.includes('bayer') ||
    name.includes('tech') ||
    name.includes('sez') ||
    name.includes('office') ||
    name.includes('mall') ||
    name.includes('commercial')
  ) {
    typology = 'commercial';
  } else if (footprintAreaApprox < 180 && !name.includes('tower') && !name.includes('building')) {
    // Low footprint standalone structure
    const roll = rng();
    typology = roll < 0.45 ? 'villa' : 'low_rise';
  } else if (footprintAreaApprox > 400 || name.includes('tower') || name.includes('heights')) {
    typology = 'residential_tower';
  } else {
    // Mixed urban fabric: distribute between mid-rise, low-rise, and tower
    const roll = rng();
    if (roll < 0.35) {
      typology = 'low_rise';
    } else if (roll < 0.75) {
      typology = 'mid_rise_residential';
    } else {
      typology = 'residential_tower';
    }
  }

  // 2. Derive Heights and Massing Details per Typology
  const floorHeight = 3.2; // Metric 3.2m per floor

  switch (typology) {
    case 'residential_tower': {
      // Tall landmark tower (16 - 28 floors)
      const baseLevels = feat.properties.building_levels || 22;
      const totalLevels = Math.max(16, Math.min(30, Math.round(baseLevels + (rng() - 0.5) * 8)));
      const totalHeight = totalLevels * floorHeight;

      const podiumLevels = Math.min(3, Math.max(1, Math.round(1 + rng() * 2)));
      const podiumHeight = podiumLevels * (floorHeight + 0.8); // Taller retail podium floor

      const upperSetbackLevels = totalLevels > 20 ? Math.round(2 + rng() * 2) : 0;

      return {
        typology,
        totalLevels,
        totalHeight,
        hasPodium: true,
        podiumLevels,
        podiumHeight,
        podiumScale: 1.0, // Original footprint is podium
        towerScale: 0.85 + rng() * 0.05, // Tower steps in by 10-15%
        upperSetbackLevels,
        upperSetbackScale: 0.72 + rng() * 0.05, // Top tier steps in further
        roofType: 'flat_penthouse',
        facadeStyle: rng() > 0.35 ? 'neoclassical' : 'sandstone_balcony',
        wallColor: rng() > 0.5 ? 0xf8f5ee : 0xeae1d2,
        accentColor: 0x0284c7,
        hasBalconies: true,
        balconyDepth: 1.2,
      };
    }

    case 'mid_rise_residential': {
      // Mid-rise residential block (6 - 13 floors)
      const totalLevels = Math.max(5, Math.min(13, Math.round(6 + rng() * 7)));
      const totalHeight = totalLevels * floorHeight;

      const hasPodium = totalLevels >= 9;
      const podiumLevels = hasPodium ? 2 : 0;
      const podiumHeight = podiumLevels * floorHeight;

      return {
        typology,
        totalLevels,
        totalHeight,
        hasPodium,
        podiumLevels,
        podiumHeight,
        podiumScale: 1.0,
        towerScale: hasPodium ? 0.88 : 1.0,
        upperSetbackLevels: totalLevels > 10 ? 2 : 0,
        upperSetbackScale: 0.78,
        roofType: 'stepped_terrace',
        facadeStyle: 'sandstone_balcony',
        wallColor: rng() > 0.5 ? 0xf1efe7 : 0xe7e2d8,
        accentColor: 0xd97706,
        hasBalconies: true,
        balconyDepth: 1.0,
      };
    }

    case 'commercial': {
      // Modern commercial complex (4 - 10 floors with broad floorplates)
      const totalLevels = Math.max(4, Math.min(11, Math.round(4 + rng() * 6)));
      const totalHeight = totalLevels * (floorHeight + 0.6); // 3.8m commercial floor-to-floor

      return {
        typology,
        totalLevels,
        totalHeight,
        hasPodium: true,
        podiumLevels: 1,
        podiumHeight: 4.8, // Grand entrance lobby
        podiumScale: 1.0,
        towerScale: 0.88,
        upperSetbackLevels: 0,
        upperSetbackScale: 0.88,
        roofType: 'mechanical_enclosure',
        facadeStyle: 'glass_curtain',
        wallColor: 0x334155,
        accentColor: 0x38bdf8,
        hasBalconies: false,
        balconyDepth: 0,
      };
    }

    case 'low_rise': {
      // Low-rise urban building (2 - 4 floors)
      const totalLevels = Math.max(2, Math.min(4, Math.round(2 + rng() * 2)));
      const totalHeight = totalLevels * floorHeight;

      return {
        typology,
        totalLevels,
        totalHeight,
        hasPodium: false,
        podiumLevels: 0,
        podiumHeight: 0,
        podiumScale: 1.0,
        towerScale: 1.0,
        upperSetbackLevels: 0,
        upperSetbackScale: 1.0,
        roofType: 'parapet_only',
        facadeStyle: 'terracotta_warm',
        wallColor: rng() > 0.5 ? 0xf5eedc : 0xede4d3,
        accentColor: 0xb45309,
        hasBalconies: rng() > 0.5,
        balconyDepth: 0.8,
      };
    }

    case 'villa': {
      // Standalone bungalow / villa (1 - 2 floors)
      const totalLevels = Math.max(1, Math.min(2, Math.round(1 + rng())));
      const totalHeight = totalLevels * floorHeight;

      return {
        typology,
        totalLevels,
        totalHeight,
        hasPodium: false,
        podiumLevels: 0,
        podiumHeight: 0,
        podiumScale: 1.0,
        towerScale: 1.0,
        upperSetbackLevels: 0,
        upperSetbackScale: 1.0,
        roofType: 'pitched_terracotta',
        facadeStyle: 'terracotta_warm',
        wallColor: 0xfaf5ee,
        accentColor: 0xc2410c,
        hasBalconies: false,
        balconyDepth: 0,
      };
    }

    case 'institutional':
    default: {
      // Campus research / hospital / academic building (3 - 7 floors)
      const totalLevels = Math.max(3, Math.min(8, Math.round(3 + rng() * 4)));
      const totalHeight = totalLevels * (floorHeight + 0.3);

      return {
        typology,
        totalLevels,
        totalHeight,
        hasPodium: true,
        podiumLevels: 1,
        podiumHeight: 4.2,
        podiumScale: 1.0,
        towerScale: 0.92,
        upperSetbackLevels: 0,
        upperSetbackScale: 0.92,
        roofType: 'mechanical_enclosure',
        facadeStyle: 'institutional_concrete',
        wallColor: 0xe2e8f0,
        accentColor: 0x475569,
        hasBalconies: false,
        balconyDepth: 0,
      };
    }
  }
}
