import * as THREE from 'three';
import type { Asset, InfrastructureState } from '../types/asset';

/**
 * Maps asset types (NOT asset IDs) to visual rendering descriptors.
 * Section 5.11: No asset-ID specific branching allowed.
 */

export interface AssetVisualDescriptor {
  type: string;
  displayName: string;
  icon: string;
  baseColor: number;
  secondaryColor: number;
  height: number;
  radius: number;
  createMesh: (asset: Asset) => THREE.Group;
}

export const STATE_COLORS: Record<InfrastructureState, number> = {
  OPERATIONAL: 0x10b981, // Green
  DEGRADED: 0xf59e0b,    // Amber / Yellow
  BACKUP: 0x3b82f6,      // Blue (running on backup generator/battery)
  CRITICAL: 0xf97316,    // Deep Orange
  FAILED: 0xef4444,      // Crimson Red
  RECOVERING: 0x8b5cf6,  // Purple
};

export const STATE_LABELS: Record<InfrastructureState, string> = {
  OPERATIONAL: 'Operational',
  DEGRADED: 'Degraded Service',
  BACKUP: 'Running on Backup',
  CRITICAL: 'Critical Condition',
  FAILED: 'Failed / Inactive',
  RECOVERING: 'Recovering / Repair',
};

// Procedural 3D model builders for each infrastructure type
function createHospitalMesh(_asset: Asset): THREE.Group {
  const group = new THREE.Group();

  // Main hospital pavilion block
  const mainMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.3,
    metalness: 0.1,
  });
  const mainGeo = new THREE.BoxGeometry(22, 14, 22);
  const mainMesh = new THREE.Mesh(mainGeo, mainMat);
  mainMesh.position.y = 7;
  mainMesh.castShadow = true;
  mainMesh.receiveShadow = true;
  group.add(mainMesh);

  // Red medical cross on top
  const crossMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    roughness: 0.2,
    emissive: 0xef4444,
    emissiveIntensity: 0.3,
  });
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(10, 1.2, 3), crossMat);
  crossH.position.y = 14.7;
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 10), crossMat);
  crossV.position.y = 14.7;
  group.add(crossH, crossV);

  // Helipad circle on roof
  const helipadMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
  const helipadGeo = new THREE.CylinderGeometry(4, 4, 0.4, 16);
  const helipad = new THREE.Mesh(helipadGeo, helipadMat);
  helipad.position.y = 14.3;
  group.add(helipad);

  return group;
}

function createSubstationMesh(_asset: Asset): THREE.Group {
  const group = new THREE.Group();

  // Perimeter concrete slab
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });
  const baseGeo = new THREE.BoxGeometry(18, 1.5, 18);
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.75;
  group.add(base);

  // High-voltage transformer units
  const trafoMat = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    metalness: 0.6,
    roughness: 0.4,
  });
  for (let i = -1; i <= 1; i += 2) {
    for (let j = -1; j <= 1; j += 2) {
      const trafo = new THREE.Mesh(new THREE.BoxGeometry(4.5, 7, 4.5), trafoMat);
      trafo.position.set(i * 4.5, 5, j * 4.5);
      trafo.castShadow = true;
      group.add(trafo);

      // Ceramic insulator bushings
      const bushingMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.2,
      });
      const bushing = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 3, 8), bushingMat);
      bushing.position.set(i * 4.5, 10, j * 4.5);
      group.add(bushing);
    }
  }

  // Central lattice transmission tower
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, wireframe: true });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 3, 16, 4), towerMat);
  tower.position.y = 9;
  group.add(tower);

  return group;
}

function createPowerStationMesh(_asset: Asset): THREE.Group {
  const group = new THREE.Group();

  // Generator hall
  const hallMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.5 });
  const hall = new THREE.Mesh(new THREE.BoxGeometry(24, 12, 16), hallMat);
  hall.position.y = 6;
  hall.castShadow = true;
  group.add(hall);

  // Twin cooling chimneys
  const stackMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
  for (const xOff of [-6, 6]) {
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, 18, 16), stackMat);
    stack.position.set(xOff, 15, 0);
    stack.castShadow = true;
    group.add(stack);

    // Hazard warning rings
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xef4444 });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.3, 2, 16), ringMat);
    ring.position.set(xOff, 20, 0);
    group.add(ring);
  }

  return group;
}

function createWaterPumpMesh(_asset: Asset): THREE.Group {
  const group = new THREE.Group();

  // Pump station foundation
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(10, 11, 2, 24), baseMat);
  base.position.y = 1;
  group.add(base);

  // Large cylindrical water storage reservoir
  const tankMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    metalness: 0.3,
    roughness: 0.3,
  });
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 10, 24), tankMat);
  tank.position.y = 7;
  tank.castShadow = true;
  group.add(tank);

  // Domed roof
  const domeMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(8, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
  dome.position.y = 12;
  group.add(dome);

  // Water manifold pipes
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.5 });
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 14, 12), pipeMat);
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(0, 4, 8);
  group.add(pipe);

  return group;
}

function createSchoolMesh(_asset: Asset): THREE.Group {
  const group = new THREE.Group();

  // U-shaped school campus
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.6 });
  const centerWing = new THREE.Mesh(new THREE.BoxGeometry(20, 9, 8), wallMat);
  centerWing.position.set(0, 4.5, -4);
  const leftWing = new THREE.Mesh(new THREE.BoxGeometry(8, 9, 14), wallMat);
  leftWing.position.set(-6, 4.5, 3);
  const rightWing = new THREE.Mesh(new THREE.BoxGeometry(8, 9, 14), wallMat);
  rightWing.position.set(6, 4.5, 3);
  group.add(centerWing, leftWing, rightWing);

  // Architectural collegiate clock tower / cupola penthouse
  const towerMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.5 });
  const cupola = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.5, 4.5), towerMat);
  cupola.position.set(0, 10.75, -4);
  cupola.castShadow = true;
  group.add(cupola);

  return group;
}

function createPopulationMesh(_asset: Asset): THREE.Group {
  const group = new THREE.Group();

  // Residential high-rise tower cluster
  const towerMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.4,
  });

  const heights = [22, 28, 18, 25];
  const positions = [
    [-4, -4],
    [4, -4],
    [-4, 4],
    [4, 4],
  ];

  positions.forEach(([x, z], i) => {
    const h = heights[i];
    const tower = new THREE.Mesh(new THREE.BoxGeometry(6, h, 6), towerMat);
    tower.position.set(x, h / 2, z);
    tower.castShadow = true;
    group.add(tower);
  });

  return group;
}

function createRoadMesh(_asset: Asset): THREE.Group {
  const group = new THREE.Group();
  // Road node marker - small traffic beacon
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 6, 8), poleMat);
  pole.position.y = 3;

  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.8,
  });
  const light = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 12), lightMat);
  light.position.y = 6.5;

  group.add(pole, light);
  return group;
}

function createDefaultMesh(_asset: Asset): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), mat);
  mesh.position.y = 5;
  group.add(mesh);
  return group;
}

/**
 * Registry mapping asset types to descriptors.
 */
export const ASSET_REGISTRY: Record<string, AssetVisualDescriptor> = {
  hospital: {
    type: 'hospital',
    displayName: 'Healthcare Facility',
    icon: 'HOSP',
    baseColor: 0xef4444,
    secondaryColor: 0xffffff,
    height: 15,
    radius: 12,
    createMesh: createHospitalMesh,
  },
  substation: {
    type: 'substation',
    displayName: 'Electrical Substation',
    icon: 'ELEC',
    baseColor: 0xf59e0b,
    secondaryColor: 0x3b82f6,
    height: 18,
    radius: 10,
    createMesh: createSubstationMesh,
  },
  power_station: {
    type: 'power_station',
    displayName: 'Power Generation Plant',
    icon: 'GEN',
    baseColor: 0x6366f1,
    secondaryColor: 0xef4444,
    height: 22,
    radius: 14,
    createMesh: createPowerStationMesh,
  },
  water_pump: {
    type: 'water_pump',
    displayName: 'Water Pumping Station',
    icon: 'WTR',
    baseColor: 0x06b6d4,
    secondaryColor: 0x0284c7,
    height: 14,
    radius: 11,
    createMesh: createWaterPumpMesh,
  },
  school: {
    type: 'school',
    displayName: 'Educational Institution',
    icon: 'SCHL',
    baseColor: 0x8b5cf6,
    secondaryColor: 0xfef08a,
    height: 12,
    radius: 10,
    createMesh: createSchoolMesh,
  },
  population: {
    type: 'population',
    displayName: 'Residential Population Zone',
    icon: 'RES',
    baseColor: 0x64748b,
    secondaryColor: 0x94a3b8,
    height: 28,
    radius: 14,
    createMesh: createPopulationMesh,
  },
  road: {
    type: 'road',
    displayName: 'Road Corridor Intersection',
    icon: 'ROAD',
    baseColor: 0xf59e0b,
    secondaryColor: 0x1e293b,
    height: 7,
    radius: 6,
    createMesh: createRoadMesh,
  },
};

export function getAssetDescriptor(type: string): AssetVisualDescriptor {
  return (
    ASSET_REGISTRY[type] || {
      type,
      displayName: type.charAt(0).toUpperCase() + type.slice(1),
      icon: 'BLDG',
      baseColor: 0x64748b,
      secondaryColor: 0x94a3b8,
      height: 10,
      radius: 8,
      createMesh: createDefaultMesh,
    }
  );
}
