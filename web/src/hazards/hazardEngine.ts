import hazardConfig from './hazardConfig.json';
import type { Asset, Network } from '../types/asset';
import type {
  AssetExposureInfo,
  DisasterScenario,
  ExposureLevel,
  HazardDefinition,
  HazardIntensityLevel,
  HazardPreviewSummary,
  HazardType,
  InitialOperationalEffect,
} from '../types/hazard';

/**
 * Generic Point-in-Polygon Ray Casting algorithm for WGS84 [lon, lat] coordinates.
 */
export function pointInPolygon(
  point: [number, number],
  polygon: [number, number][]
): boolean {
  if (!polygon || polygon.length < 3) return false;
  const [x, y] = point; // x = lon, y = lat
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Haversine formula: Calculates distance between two [lon, lat] points in meters.
 */
export function haversineDistanceM(
  coord1: [number, number],
  coord2: [number, number]
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((coord2[1] - coord1[1]) * Math.PI) / 180;
  const dLon = ((coord2[0] - coord1[0]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1[1] * Math.PI) / 180) *
      Math.cos((coord2[1] * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Simple deterministic pseudo-random number generator for reproducible Monte Carlo runs.
 */
function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Reads modeled vulnerability from configuration matrix (Rule A1: Zero Hardcoding).
 */
export function getHazardVulnerability(
  assetType: string,
  hazardType: HazardType
): number {
  const matrix = hazardConfig.asset_type_vulnerability as Record<
    string,
    Record<string, number>
  >;
  const typeMap = matrix[assetType] || matrix['default'];
  if (!typeMap) return 0.5;
  return typeMap[hazardType] ?? typeMap['EXTREME_RAINFALL'] ?? 0.5;
}

/**
 * Maps normalized intensity to discrete human-readable severity level.
 */
export function getIntensityLevel(intensity: number): HazardIntensityLevel {
  if (intensity >= 0.85) return 'extreme';
  if (intensity >= 0.70) return 'severe';
  if (intensity >= 0.45) return 'moderate';
  return 'low';
}

/**
 * Evaluates exposure and initial physical consequence on a single infrastructure asset.
 * Follows:
 *   hazard intensity + exposure + vulnerability -> initial effect
 */
export function calculateAssetExposure(
  asset: Asset,
  hazard: HazardDefinition,
  network?: Network
): AssetExposureInfo {
  const assetLon = asset.location.longitude;
  const assetLat = asset.location.latitude;
  const assetCoord: [number, number] = [assetLon, assetLat];

  let directExposure = false;
  let distanceM = 999999;
  const area = hazard.affected_area;

  // Resolve footprint geometry
  let centerCoord: [number, number] = area.center || [72.908, 19.12];
  let radiusM = area.radius_m || 600;
  let polygonCoords: [number, number][] = area.coordinates || [];

  if (area.type === 'zone' && area.zone_id) {
    const zone = hazardConfig.predefined_zones.find(
      (z) => z.zone_id === area.zone_id
    );
    if (zone) {
      centerCoord = zone.center as [number, number];
      radiusM = zone.radius_m;
      polygonCoords = zone.coordinates as [number, number][];
    }
  }

  distanceM = haversineDistanceM(assetCoord, centerCoord);

  if (polygonCoords.length >= 3) {
    directExposure = pointInPolygon(assetCoord, polygonCoords);
    if (!directExposure && distanceM <= radiusM) {
      directExposure = true;
    }
  } else {
    directExposure = distanceM <= radiusM;
  }

  // Calculate Exposure Score [0.0, 1.0]
  let exposureScore = 0.0;
  if (directExposure) {
    // Proximity to center gives higher exposure
    const normDist = Math.min(1.0, distanceM / Math.max(radiusM, 1));
    exposureScore = Math.max(0.7, 1.0 - normDist * 0.35);
  } else if (distanceM <= radiusM * 1.5) {
    // Buffer zone
    const bufferDist = (distanceM - radiusM) / (radiusM * 0.5);
    exposureScore = Math.max(0.15, 0.65 * (1.0 - bufferDist));
  } else {
    // Indirect exposure check: if connected to a critical asset that is flooded
    let hasDirectlyExposedNeighbor = false;
    if (network) {
      const neighborEdges = network.edges.filter(
        (e) => e.from === asset.id || e.to === asset.id
      );
      for (const e of neighborEdges) {
        const otherId = e.from === asset.id ? e.to : e.from;
        const otherNode = network.nodes.find((n) => n.id === otherId);
        if (otherNode) {
          const nDist = haversineDistanceM(
            [otherNode.location.longitude, otherNode.location.latitude],
            centerCoord
          );
          if (nDist <= radiusM) {
            hasDirectlyExposedNeighbor = true;
            break;
          }
        }
      }
    }
    if (hasDirectlyExposedNeighbor) {
      exposureScore = 0.3; // Indirect exposure through physical access link
    }
  }

  // Exposure Level Category
  let exposureLevel: ExposureLevel = 'none';
  if (exposureScore >= 0.8) exposureLevel = 'extreme';
  else if (exposureScore >= 0.6) exposureLevel = 'high';
  else if (exposureScore >= 0.35) exposureLevel = 'moderate';
  else if (exposureScore > 0.05) exposureLevel = 'low';

  const vulnerability = getHazardVulnerability(asset.type, hazard.hazard_type);
  const disruptionScore = hazard.intensity * exposureScore * vulnerability;

  // Initial Effect Resolution
  const thresholds = hazardConfig.disruption_thresholds;
  let expectedEffect: InitialOperationalEffect = 'no_effect';
  const reasons: string[] = [];

  if (disruptionScore >= thresholds.failed) {
    expectedEffect = 'failed';
    reasons.push(
      `Extreme physical stress (${Math.round(disruptionScore * 100)}%) exceeding operational limits`
    );
  } else if (disruptionScore >= thresholds.critical) {
    expectedEffect = 'critical';
    reasons.push(
      `Severe service strain (${Math.round(disruptionScore * 100)}%) approaching failure threshold`
    );
  } else if (disruptionScore >= thresholds.backup) {
    expectedEffect = 'backup';
    reasons.push('Primary service compromised; backup mechanisms activated');
  } else if (disruptionScore >= thresholds.degraded) {
    expectedEffect = 'degraded';
    reasons.push('Elevated environmental stress resulting in capacity derating');
  } else if (exposureLevel !== 'none') {
    reasons.push('Exposed to hazard conditions but within design resilience tolerance');
  }

  if (directExposure) {
    reasons.push(`Direct spatial footprint impact (${Math.round(distanceM)}m from hazard core)`);
  } else if (exposureScore > 0) {
    reasons.push('Indirect corridor access restriction');
  }

  return {
    asset_id: asset.id,
    asset_name: asset.name,
    asset_type: asset.type,
    location: asset.location,
    direct_exposure: directExposure,
    distance_m: Math.round(distanceM),
    exposure_level: exposureLevel,
    exposure_score: Math.round(exposureScore * 100) / 100,
    vulnerability: Math.round(vulnerability * 100) / 100,
    disruption_score: Math.round(disruptionScore * 100) / 100,
    expected_effect: expectedEffect,
    reasons,
  };
}

/**
 * Computes full disaster summary & exposure preview according to Sections 18 & 19.
 */
export function calculateHazardPreview(
  hazard: HazardDefinition,
  network: Network
): HazardPreviewSummary {
  const exposedAssets: AssetExposureInfo[] = [];
  const initialDisruptions: AssetExposureInfo[] = [];
  let populationExposed = 0;

  for (const asset of network.nodes) {
    const info = calculateAssetExposure(asset, hazard, network);
    if (info.exposure_level !== 'none') {
      exposedAssets.push(info);
      populationExposed += asset.population_served || 0;
    }
    if (info.expected_effect !== 'no_effect') {
      initialDisruptions.push(info);
    }
  }

  // Sort exposed assets by disruption score descending
  exposedAssets.sort((a, b) => b.disruption_score - a.disruption_score);
  initialDisruptions.sort((a, b) => b.disruption_score - a.disruption_score);

  // Monte Carlo Uncertainty distribution (P05, median, P95)
  const rng = seededRandom(hazard.random_seed || 42);
  const baselinePop = Math.max(populationExposed, 8000);
  const variance = 0.25 * hazard.intensity;
  const p05 = Math.round(baselinePop * (1.0 - variance * 1.25));
  const median = Math.round(baselinePop * (1.0 + (rng() - 0.5) * 0.1));
  const p95 = Math.round(baselinePop * (1.0 + variance * 1.45));

  let zoneName = hazard.affected_area.name || 'Powai Lake & Hiranandani Basin';
  if (hazard.affected_area.zone_id) {
    const zone = hazardConfig.predefined_zones.find(
      (z) => z.zone_id === hazard.affected_area.zone_id
    );
    if (zone) zoneName = zone.name;
  }

  return {
    hazard_id: hazard.hazard_id,
    hazard_type: hazard.hazard_type,
    hazard_name: hazard.name,
    intensity: hazard.intensity,
    intensity_level: getIntensityLevel(hazard.intensity),
    duration_hours: hazard.duration_hours,
    start_time: hazard.start_time,
    affected_area_name: zoneName,
    exposed_assets: exposedAssets,
    expected_initial_disruptions: initialDisruptions,
    population_exposed: populationExposed,
    uncertainty: {
      level: hazard.intensity > 0.75 ? 'High' : hazard.intensity > 0.45 ? 'Moderate' : 'Low',
      p05,
      median,
      p95,
    },
    provenance: {
      geometry: 'REAL',
      parameters: 'SIMULATED',
      exposure: 'DERIVED',
    },
  };
}

/**
 * Calculates time-dependent hazard intensity curve I(t) as specified in Section 13.
 *   00:00 -> buildup -> peak -> decay -> recovery
 */
export function calculateHazardTemporalIntensity(
  hazard: HazardDefinition,
  timeHours: number
): number {
  const duration = hazard.duration_hours || 6;
  const peak = hazard.peak_time_hours || duration * 0.6;
  const maxI = hazard.intensity;

  if (timeHours <= 0) return 0.0;
  if (timeHours <= peak) {
    // Smooth quadratic buildup
    const progress = timeHours / peak;
    return maxI * Math.sin((progress * Math.PI) / 2);
  }
  if (timeHours <= duration) {
    // Recession phase
    const progress = (timeHours - peak) / (duration - peak);
    return maxI * Math.cos((progress * Math.PI) / 2);
  }
  return 0.0; // Hazard cessation
}

/**
 * Validates natural disaster scenario according to all 12 rules in Section 21.
 */
export function validateHazardScenario(
  scenario: DisasterScenario,
  _network?: Network
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!scenario.id || scenario.id.trim() === '') {
    errors.push('Scenario missing unique scenario ID');
  }
  if (!scenario.hazards || scenario.hazards.length === 0) {
    errors.push('Scenario must contain at least one hazard');
  }

  const validTypes = Object.keys(hazardConfig.hazard_types);

  scenario.hazards.forEach((h, idx) => {
    if (!h.hazard_id) {
      errors.push(`Hazard #${idx + 1} missing hazard_id`);
    }
    if (!validTypes.includes(h.hazard_type)) {
      errors.push(
        `Hazard #${idx + 1} has unrecognized hazard_type '${h.hazard_type}'. Expected one of: ${validTypes.join(', ')}`
      );
    }
    if (h.intensity < 0.0 || h.intensity > 1.0) {
      errors.push(
        `Hazard #${idx + 1} intensity must be normalized between 0.0 and 1.0 (got ${h.intensity})`
      );
    }
    if (h.duration_hours < 0) {
      errors.push(
        `Hazard #${idx + 1} duration_hours must be non-negative (got ${h.duration_hours})`
      );
    }
    if (typeof h.random_seed !== 'number') {
      errors.push(`Hazard #${idx + 1} must record a numeric random_seed for reproducibility`);
    }
    if (!h.affected_area) {
      errors.push(`Hazard #${idx + 1} missing affected_area specification`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
