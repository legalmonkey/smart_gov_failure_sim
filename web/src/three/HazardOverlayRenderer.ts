import * as THREE from 'three';
import type { HazardDefinition } from '../types/hazard';
import { latLonToWorld } from '../geo/coordinateTransform';
import hazardConfig from '../hazards/hazardConfig.json';

/**
 * Section 17: Restrained 3D Hazard Visualization Layer
 * Renders translucent, visually distinguishable spatial footprints:
 * - Flood: Translucent blue polygon/disc with undulating surface pulse
 * - Extreme rainfall: Atmospheric precipitation zone with rainfall streaks
 * - Storm: Rotating wind circulation vortex bands
 * - Earthquake: Expanding epicenter seismic ripple shockwaves
 * - Fire: Translucent amber/orange heat exclusion zone
 */
export class HazardOverlayRenderer {
  public group: THREE.Group;
  private currentHazard: HazardDefinition | null = null;
  private dynamicObjects: {
    type: string;
    mesh: THREE.Object3D;
    initialScale?: number;
    rotationSpeed?: number;
    pulseSpeed?: number;
    phase?: number;
  }[] = [];
  private rainParticles: THREE.Points | null = null;
  private time: number = 0;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'HazardOverlayGroup';
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public setHazard(hazard: HazardDefinition | null): void {
    this.clear();
    this.currentHazard = hazard;
    if (!hazard) return;

    const area = hazard.affected_area;
    let centerLon = 72.908;
    let centerLat = 19.12;
    let radiusM = area.radius_m || 600;
    let polygonCoords = area.coordinates || [];

    if (area.type === 'zone' && area.zone_id) {
      const zone = hazardConfig.predefined_zones.find(
        (z) => z.zone_id === area.zone_id
      );
      if (zone) {
        centerLon = zone.center[0];
        centerLat = zone.center[1];
        radiusM = zone.radius_m;
        polygonCoords = zone.coordinates as [number, number][];
      }
    } else if (area.center) {
      centerLon = area.center[0];
      centerLat = area.center[1];
    } else if (polygonCoords.length > 0) {
      centerLon = polygonCoords[0][0];
      centerLat = polygonCoords[0][1];
    }

    const centerWorld = latLonToWorld(centerLat, centerLon, 2.0);
    // World scale: 1 Three.js unit = 4m -> radiusInUnits = radiusM * 0.25
    const radiusUnits = radiusM * 0.25;

    switch (hazard.hazard_type) {
      case 'URBAN_FLOOD':
        this.buildFloodOverlay(centerWorld, radiusUnits, polygonCoords);
        break;
      case 'EXTREME_RAINFALL':
        this.buildRainOverlay(centerWorld, radiusUnits, polygonCoords);
        break;
      case 'SEVERE_STORM':
        this.buildStormOverlay(centerWorld, radiusUnits);
        break;
      case 'EARTHQUAKE':
        this.buildEarthquakeOverlay(centerWorld, radiusUnits);
        break;
      case 'URBAN_FIRE':
        this.buildFireOverlay(centerWorld, radiusUnits);
        break;
      default:
        this.buildGenericOverlay(centerWorld, radiusUnits);
        break;
    }
  }

  private clear(): void {
    while (this.group.children.length > 0) {
      const obj = this.group.children[0];
      this.group.remove(obj);
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    }
    this.dynamicObjects = [];
    this.rainParticles = null;
  }

  /**
   * 1. Flood: Translucent blue geographic polygon overlay with wave surface pulse
   */
  private buildFloodOverlay(
    center: THREE.Vector3,
    radius: number,
    _coords: [number, number][]
  ): void {
    const color = 0x0284c7;

    // A. Main flood surface plane
    const geom = new THREE.CircleGeometry(radius, 48);
    geom.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(center.x, center.y + 1.5, center.z);
    this.group.add(mesh);

    this.dynamicObjects.push({
      type: 'pulse',
      mesh,
      initialScale: 1.0,
      pulseSpeed: 1.5,
      phase: 0,
    });

    // B. Outer wave boundary ring
    const ringGeom = new THREE.RingGeometry(radius * 0.96, radius * 1.02, 48);
    ringGeom.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    ringMesh.position.set(center.x, center.y + 2.0, center.z);
    this.group.add(ringMesh);

    this.dynamicObjects.push({
      type: 'ring_wave',
      mesh: ringMesh,
      initialScale: radius,
      pulseSpeed: 1.2,
      phase: 1,
    });
  }

  /**
   * 2. Extreme Rainfall: Atmospheric precipitation cylinder with falling rain streaks
   */
  private buildRainOverlay(
    center: THREE.Vector3,
    radius: number,
    _coords: [number, number][]
  ): void {
    const color = 0x38bdf8;

    // Ground saturation puddle
    const groundGeom = new THREE.CircleGeometry(radius, 40);
    groundGeom.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    const groundMesh = new THREE.Mesh(groundGeom, groundMat);
    groundMesh.position.set(center.x, center.y + 1.2, center.z);
    this.group.add(groundMesh);

    // Rain drop streaks particle cloud
    const count = 350;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(Math.random()) * radius;
      const theta = Math.random() * 2 * Math.PI;
      positions[i * 3] = center.x + r * Math.cos(theta);
      positions[i * 3 + 1] = center.y + Math.random() * 150 + 10;
      positions[i * 3 + 2] = center.z + r * Math.sin(theta);
    }
    const pGeom = new THREE.BufferGeometry();
    pGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const pMat = new THREE.PointsMaterial({
      color: 0xbae6fd,
      size: 2.2,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    this.rainParticles = new THREE.Points(pGeom, pMat);
    this.group.add(this.rainParticles);
  }

  /**
   * 3. Severe Storm: Rotating wind circulation vortex bands
   */
  private buildStormOverlay(center: THREE.Vector3, radius: number): void {
    const color = 0xa855f7;

    // Ground wind footprint
    const groundGeom = new THREE.CircleGeometry(radius, 36);
    groundGeom.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    const groundMesh = new THREE.Mesh(groundGeom, groundMat);
    groundMesh.position.set(center.x, center.y + 1.5, center.z);
    this.group.add(groundMesh);

    // 2 concentric circulation vortex rings
    [0.6, 0.9].forEach((frac, idx) => {
      const rGeom = new THREE.RingGeometry(radius * frac, radius * (frac + 0.08), 32);
      rGeom.rotateX(-Math.PI / 2);
      const rMat = new THREE.MeshBasicMaterial({
        color: idx === 0 ? 0xc084fc : 0x9333ea,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const rMesh = new THREE.Mesh(rGeom, rMat);
      rMesh.position.set(center.x, center.y + 3.0 + idx * 2.0, center.z);
      this.group.add(rMesh);

      this.dynamicObjects.push({
        type: 'rotate',
        mesh: rMesh,
        rotationSpeed: (idx === 0 ? 0.8 : -0.6),
      });
    });
  }

  /**
   * 4. Earthquake: Epicenter beacon and expanding seismic shockwave rings
   */
  private buildEarthquakeOverlay(center: THREE.Vector3, radius: number): void {
    const color = 0xf97316;

    // Epicenter core beacon
    const epiGeom = new THREE.CylinderGeometry(4, 4, 25, 16);
    const epiMat = new THREE.MeshBasicMaterial({
      color: 0xffedd5,
      transparent: true,
      opacity: 0.85,
    });
    const epiMesh = new THREE.Mesh(epiGeom, epiMat);
    epiMesh.position.set(center.x, center.y + 12, center.z);
    this.group.add(epiMesh);

    // 3 expanding concentric seismic shockwave rings
    [0.35, 0.65, 0.95].forEach((frac, idx) => {
      const ringGeom = new THREE.RingGeometry(radius * (frac - 0.03), radius * frac, 36);
      ringGeom.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.55 - idx * 0.12,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.position.set(center.x, center.y + 1.8, center.z);
      this.group.add(ringMesh);

      this.dynamicObjects.push({
        type: 'seismic_pulse',
        mesh: ringMesh,
        initialScale: 1.0,
        pulseSpeed: 1.0 + idx * 0.3,
        phase: idx * 0.7,
      });
    });
  }

  /**
   * 5. Urban Fire: Translucent amber/orange heat radius zone with flickering glow
   */
  private buildFireOverlay(center: THREE.Vector3, radius: number): void {
    const color = 0xef4444;

    const heatGeom = new THREE.CircleGeometry(radius, 36);
    heatGeom.rotateX(-Math.PI / 2);
    const heatMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    const heatMesh = new THREE.Mesh(heatGeom, heatMat);
    heatMesh.position.set(center.x, center.y + 1.5, center.z);
    this.group.add(heatMesh);

    const perimeterGeom = new THREE.RingGeometry(radius * 0.94, radius * 1.0, 36);
    perimeterGeom.rotateX(-Math.PI / 2);
    const perimeterMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    const perimeterMesh = new THREE.Mesh(perimeterGeom, perimeterMat);
    perimeterMesh.position.set(center.x, center.y + 2.0, center.z);
    this.group.add(perimeterMesh);

    this.dynamicObjects.push({
      type: 'fire_flicker',
      mesh: heatMesh,
      pulseSpeed: 3.0,
      phase: 0,
    });
  }

  private buildGenericOverlay(center: THREE.Vector3, radius: number): void {
    const geom = new THREE.CircleGeometry(radius, 32);
    geom.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x64748b,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(center.x, center.y + 1.2, center.z);
    this.group.add(mesh);
  }

  /**
   * Render loop animation updater.
   */
  public update(deltaTime: number): void {
    if (!this.group.visible || !this.currentHazard) return;

    this.time += deltaTime;

    // 1. Dynamic Mesh Animations
    for (const item of this.dynamicObjects) {
      if (item.type === 'rotate') {
        item.mesh.rotation.y += (item.rotationSpeed || 1.0) * deltaTime;
      } else if (item.type === 'pulse' || item.type === 'ring_wave') {
        const p = Math.sin(this.time * (item.pulseSpeed || 1.0) + (item.phase || 0));
        const scale = 1.0 + p * 0.04;
        item.mesh.scale.set(scale, scale, scale);
      } else if (item.type === 'seismic_pulse') {
        const p = (Math.sin(this.time * 2.5 + (item.phase || 0)) + 1) / 2;
        const scale = 0.92 + p * 0.12;
        item.mesh.scale.set(scale, scale, scale);
      } else if (item.type === 'fire_flicker') {
        const flicker = Math.sin(this.time * 5.0) * 0.05 + Math.cos(this.time * 7.3) * 0.03;
        const mat = (item.mesh as THREE.Mesh).material as THREE.MeshBasicMaterial;
        if (mat) {
          mat.opacity = Math.max(0.2, Math.min(0.45, 0.32 + flicker));
        }
      }
    }

    // 2. Rain Particles Fall
    if (this.rainParticles) {
      const posAttr = this.rainParticles.geometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const count = arr.length / 3;
      for (let i = 0; i < count; i++) {
        arr[i * 3 + 1] -= 180 * deltaTime; // Fall speed
        if (arr[i * 3 + 1] < 5) {
          arr[i * 3 + 1] = 140 + Math.random() * 20;
        }
      }
      posAttr.needsUpdate = true;
    }
  }
}
