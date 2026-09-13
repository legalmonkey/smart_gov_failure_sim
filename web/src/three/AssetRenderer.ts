import * as THREE from 'three';
import type { Asset } from '../types/asset';
import { getAssetDescriptor, STATE_COLORS } from '../infrastructure/assetRegistry';
import { latLonToWorld } from '../geo/coordinateTransform';
import type { SimulationAssetStatus } from '../types/simulation';
import type { CriticalityResult } from '../types/criticality';
import type { InterventionRequest } from '../types/intervention';

export class AssetRenderer {
  public group: THREE.Group = new THREE.Group();
  public selectableObjects: THREE.Object3D[] = [];

  private assetMeshes: Map<string, THREE.Group> = new Map();
  private stateIndicators: Map<string, THREE.Mesh> = new Map();
  private selectionRings: Map<string, THREE.Mesh> = new Map();
  private criticalityHalos: Map<string, THREE.Mesh> = new Map();
  private interventionBadges: Map<string, THREE.Group> = new Map();

  // Clickable element halos & floating interaction pins
  private clickableHalos: Map<
    string,
    {
      mesh: THREE.Mesh;
      borderMesh: THREE.Mesh;
      beaconMesh: THREE.Mesh;
      mat: THREE.MeshBasicMaterial;
      borderMat: THREE.MeshBasicMaterial;
      beaconMat: THREE.MeshBasicMaterial;
      baseRadius: number;
      phase: number;
    }
  > = new Map();

  private clickablePins: Map<
    string,
    {
      group: THREE.Group;
      baseHeight: number;
      diamondMat: THREE.MeshBasicMaterial;
      ringMat: THREE.MeshBasicMaterial;
      phase: number;
    }
  > = new Map();

  private elapsedTime: number = 0;

  constructor() {
    this.group.name = 'InfrastructureAssetsGroup';
  }

  public renderAssets(assets: Asset[]): void {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
    }
    this.assetMeshes.clear();
    this.stateIndicators.clear();
    this.selectionRings.clear();
    this.criticalityHalos.clear();
    this.interventionBadges.clear();
    this.clickableHalos.clear();
    this.clickablePins.clear();
    this.selectableObjects = [];

    assets.forEach((asset) => {
      const desc = getAssetDescriptor(asset.type);
      const assetGroup = new THREE.Group();
      assetGroup.name = `Asset_${asset.id}`;

      // Position from geographic coordinates
      const worldPos = latLonToWorld(asset.location.latitude, asset.location.longitude, 0);
      assetGroup.position.copy(worldPos);

      // Procedural mesh from registry
      const modelMesh = desc.createMesh(asset);
      assetGroup.add(modelMesh);

      // Make all meshes inside selectable
      assetGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.userData = {
            assetId: asset.id,
            isSelectable: true,
          };
          this.selectableObjects.push(child);
        }
      });

      // 1. Clickable Interactive Halo on the Ground (High contrast Royal Sapphire for Light Map)
      const haloInner = desc.radius + 3.0;
      const haloOuter = desc.radius + 22.0; // Instantly visible from any camera zoom
      const haloGeo = new THREE.RingGeometry(haloInner, haloOuter, 48);
      haloGeo.rotateX(-Math.PI / 2);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0x2563eb, // High-contrast Royal Sapphire
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.72,
        blending: THREE.NormalBlending,
        depthWrite: false,
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.position.y = 0.52;
      assetGroup.add(haloMesh);

      // Inner radial foundation disc
      const discGeo = new THREE.CircleGeometry(haloInner + 4.0, 32);
      discGeo.rotateX(-Math.PI / 2);
      const discMat = new THREE.MeshBasicMaterial({
        color: 0x93c5fd,
        transparent: true,
        opacity: 0.42,
        blending: THREE.NormalBlending,
        depthWrite: false,
      });
      const discMesh = new THREE.Mesh(discGeo, discMat);
      discMesh.position.y = 0.48;
      assetGroup.add(discMesh);

      // Outer crisp royal sapphire border ring
      const borderGeo = new THREE.RingGeometry(haloOuter + 2.0, haloOuter + 5.5, 48);
      borderGeo.rotateX(-Math.PI / 2);
      const borderMat = new THREE.MeshBasicMaterial({
        color: 0x1d4ed8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        blending: THREE.NormalBlending,
        depthWrite: false,
      });
      const borderMesh = new THREE.Mesh(borderGeo, borderMat);
      borderMesh.position.y = 0.54;
      assetGroup.add(borderMesh);

      // Subtle ground beacon marker (hidden by default to avoid obscuring city)
      const beaconGeo = new THREE.BufferGeometry();
      const beaconMat = new THREE.MeshBasicMaterial({ visible: false });
      const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
      beaconMesh.visible = false;
      assetGroup.add(beaconMesh);

      const phase = Math.random() * Math.PI * 2;
      this.clickableHalos.set(asset.id, {
        mesh: haloMesh,
        borderMesh,
        beaconMesh,
        mat: haloMat,
        borderMat,
        beaconMat,
        baseRadius: desc.radius,
        phase,
      });

      // 2. Floating Overhead Marker Beacon above building (Large, high-contrast, easily visible)
      const pinGroup = new THREE.Group();
      const baseHeight = desc.height + 14;
      pinGroup.position.set(0, baseHeight, 0);

      const diamondGeo = new THREE.OctahedronGeometry(6.0, 0);
      const diamondMat = new THREE.MeshBasicMaterial({
        color: 0x1d4ed8, // Deep saturated royal blue diamond
        transparent: true,
        opacity: 0.95,
        blending: THREE.NormalBlending,
      });
      const diamond = new THREE.Mesh(diamondGeo, diamondMat);
      pinGroup.add(diamond);

      const pinRingGeo = new THREE.RingGeometry(8.5, 11.5, 32);
      pinRingGeo.rotateX(-Math.PI / 2);
      const pinRingMat = new THREE.MeshBasicMaterial({
        color: 0x2563eb,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        blending: THREE.NormalBlending,
      });
      const pinRing = new THREE.Mesh(pinRingGeo, pinRingMat);
      pinGroup.add(pinRing);

      // Make pin itself selectable as well
      diamond.userData = { assetId: asset.id, isSelectable: true };
      pinRing.userData = { assetId: asset.id, isSelectable: true };
      this.selectableObjects.push(diamond, pinRing);

      assetGroup.add(pinGroup);
      this.clickablePins.set(asset.id, {
        group: pinGroup,
        baseHeight,
        diamondMat,
        ringMat: pinRingMat,
        phase,
      });

      // Status indicator ring on the ground
      const ringGeo = new THREE.RingGeometry(desc.radius + 0.2, desc.radius + 1.0, 32);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: STATE_COLORS[asset.status],
        side: THREE.DoubleSide,
      });
      const stateRing = new THREE.Mesh(ringGeo, ringMat);
      stateRing.position.y = 0.5;
      assetGroup.add(stateRing);
      this.stateIndicators.set(asset.id, stateRing);

      // Selection marker ring (high visibility golden-cyan)
      const selGeo = new THREE.RingGeometry(desc.radius + 5.2, desc.radius + 6.6, 32);
      selGeo.rotateX(-Math.PI / 2);
      const selMat = new THREE.MeshBasicMaterial({
        color: 0xfde047,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
      });
      const selRing = new THREE.Mesh(selGeo, selMat);
      selRing.position.y = 0.6;
      selRing.visible = false;
      assetGroup.add(selRing);
      this.selectionRings.set(asset.id, selRing);

      // Criticality halo (hidden by default)
      const critGeo = new THREE.RingGeometry(desc.radius + 0.5, desc.radius + 7, 32);
      critGeo.rotateX(-Math.PI / 2);
      const critMat = new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5,
      });
      const critHalo = new THREE.Mesh(critGeo, critMat);
      critHalo.position.y = 0.3;
      critHalo.visible = false;
      assetGroup.add(critHalo);
      this.criticalityHalos.set(asset.id, critHalo);

      // Container for intervention badges
      const badgeGroup = new THREE.Group();
      badgeGroup.position.set(desc.radius, desc.height + 2, 0);
      assetGroup.add(badgeGroup);
      this.interventionBadges.set(asset.id, badgeGroup);

      this.assetMeshes.set(asset.id, assetGroup);
      this.group.add(assetGroup);
    });
  }

  public updateStates(states: Record<string, SimulationAssetStatus>): void {
    if (!states) return;
    Object.entries(states).forEach(([assetId, status]) => {
      const ring = this.stateIndicators.get(assetId);
      if (ring) {
        const color = STATE_COLORS[status.state] || 0x94a3b8;
        (ring.material as THREE.MeshBasicMaterial).color.setHex(color);
      }

      // Update clickable halo and floating pin colors based on state
      const halo = this.clickableHalos.get(assetId);
      const pin = this.clickablePins.get(assetId);
      if (halo && pin) {
        if (status.state === 'FAILED') {
          halo.mat.color.setHex(0xef4444);
          halo.borderMat.color.setHex(0xfca5a5);
          halo.beaconMat.color.setHex(0xef4444);
          pin.diamondMat.color.setHex(0xef4444);
          pin.ringMat.color.setHex(0xf87171);
        } else if (
          status.state === 'BACKUP' ||
          status.state === 'DEGRADED' ||
          status.state === 'CRITICAL'
        ) {
          halo.mat.color.setHex(0xf59e0b);
          halo.borderMat.color.setHex(0xfef08a);
          halo.beaconMat.color.setHex(0xf59e0b);
          pin.diamondMat.color.setHex(0xf59e0b);
          pin.ringMat.color.setHex(0xfbbf24);
        } else {
          halo.mat.color.setHex(0x00f0ff);
          halo.borderMat.color.setHex(0x38bdf8);
          halo.beaconMat.color.setHex(0x00f0ff);
          pin.diamondMat.color.setHex(0x00f0ff);
          pin.ringMat.color.setHex(0x38bdf8);
        }
      }

      const assetGroup = this.assetMeshes.get(assetId);
      if (assetGroup) {
        const isFailed = status.state === 'FAILED';
        assetGroup.traverse((child) => {
          if (child instanceof THREE.Mesh && child !== ring) {
            if (child.material instanceof THREE.MeshStandardMaterial) {
              child.material.opacity = isFailed ? 0.45 : 1.0;
              child.material.transparent = isFailed;
            }
          }
        });
      }
    });
  }

  public update(
    deltaTime: number,
    hoveredAssetId: string | null,
    selectedAssetId: string | null
  ): void {
    this.elapsedTime += deltaTime;

    // Animate clickable ground halos & holographic beacon columns
    this.clickableHalos.forEach((info, id) => {
      const isHovered = id === hoveredAssetId;
      const isSelected = id === selectedAssetId;

      const scalePulse = Math.sin(this.elapsedTime * 2.2 + info.phase) * 0.06;
      const targetScale = isHovered ? 1.25 : isSelected ? 1.15 : 1.0 + scalePulse;
      info.mesh.scale.setScalar(targetScale);
      info.borderMesh.scale.setScalar(targetScale);
      info.beaconMesh.scale.set(targetScale, 1.0, targetScale);

      const baseOpacity = isHovered
        ? 0.95
        : isSelected
        ? 0.85
        : 0.55 + Math.sin(this.elapsedTime * 2.5 + info.phase) * 0.2;
      info.mat.opacity = baseOpacity;
      info.borderMat.opacity = Math.min(1.0, baseOpacity + 0.25);
      info.beaconMat.opacity = isHovered
        ? 0.65
        : isSelected
        ? 0.5
        : 0.28 + Math.sin(this.elapsedTime * 2.0 + info.phase) * 0.12;
    });

    // Animate floating interaction pins above buildings
    this.clickablePins.forEach((pin, id) => {
      const isHovered = id === hoveredAssetId;
      const isSelected = id === selectedAssetId;

      // Bobbing motion
      const bob = Math.sin(this.elapsedTime * 3.0 + pin.phase) * (isHovered ? 2.0 : 1.0);
      pin.group.position.y = pin.baseHeight + bob;

      // Rotation
      pin.group.rotation.y += deltaTime * (isHovered ? 3.5 : 1.2);

      // Scale
      const targetScale = isHovered ? 1.4 : isSelected ? 1.2 : 1.0;
      pin.group.scale.setScalar(targetScale);

      // Opacity
      pin.diamondMat.opacity = isHovered ? 1.0 : 0.8;
      pin.ringMat.opacity = isHovered ? 0.95 : 0.65;
    });
  }

  public updateSelection(selectedId: string | null): void {
    this.selectionRings.forEach((ring, id) => {
      ring.visible = id === selectedId;
    });
  }

  public updateCriticality(show: boolean, result: CriticalityResult | null): void {
    this.criticalityHalos.forEach((halo, id) => {
      if (!show || !result) {
        halo.visible = false;
        return;
      }
      const nodeCrit = result.nodes.find((n) => n.asset_id === id);
      if (nodeCrit) {
        halo.visible = true;
        const score = nodeCrit.criticality_score;
        const mat = halo.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0.2, score * 0.85);
        if (score > 0.8) {
          mat.color.setHex(0xef4444);
        } else if (score > 0.6) {
          mat.color.setHex(0xf97316);
        } else {
          mat.color.setHex(0xeab308);
        }
      } else {
        halo.visible = false;
      }
    });
  }

  public updateInterventions(applied: InterventionRequest[]): void {
    this.interventionBadges.forEach((badgeGroup, assetId) => {
      while (badgeGroup.children.length > 0) {
        badgeGroup.remove(badgeGroup.children[0]);
      }
      const matching = applied.filter((a) => a.target_asset_id === assetId);
      matching.forEach((_, idx) => {
        const shieldMat = new THREE.MeshStandardMaterial({
          color: 0x10b981,
          emissive: 0x10b981,
          emissiveIntensity: 0.5,
        });
        const shield = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 1), shieldMat);
        shield.position.set(idx * 3.5, 0, 0);
        badgeGroup.add(shield);
      });
    });
  }

  public getAssetWorldPosition(assetId: string): THREE.Vector3 | null {
    const group = this.assetMeshes.get(assetId);
    return group ? group.position.clone() : null;
  }
}
